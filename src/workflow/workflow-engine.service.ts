import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { NodeHandlerRegistry } from './node-handler.registry';
import { WorkflowSessionService } from './workflow-session.service';
import { VariableResolver } from './variable-resolver.service';
import { WhatsAppChannelAdapter } from './whatsapp-channel.adapter';
import type {
  WorkflowNode,
  WorkflowEdge,
  ExecutionContext,
  IncomingMessage,
  NodeResult,
} from './node-handler.interface';
import type { BusinessCredentials } from './channel-adapter.interface';

// Handlers
import {
  StartHandler,
  SendMessageHandler,
  SendButtonsHandler,
  SendListHandler,
  AskQuestionHandler,
  ConditionHandler,
  AiResponseHandler,
  SetVariableHandler,
  WaitHandler,
  HumanHandoverHandler,
  EndHandler,
} from './handlers';

/** Max nodes to execute in a single pass (prevent infinite loops) */
const MAX_EXECUTION_STEPS = 50;

/**
 * WorkflowEngineService
 *
 * The core execution engine. Orchestrates:
 *   1. Trigger matching — does an incoming message activate a published workflow?
 *   2. Session management — create / resume / complete sessions
 *   3. Node execution loop — walk the graph, execute handlers, follow edges
 *   4. AI fallback — when user input doesn't match the expected flow
 *
 * Entry point: processMessage() — called from ChatController.handleWebhook.
 * Returns true if the workflow handled the message, false to fall through to AI.
 */
/** Interval for expiring stale sessions (every 5 minutes) */
const EXPIRY_INTERVAL_MS = 5 * 60 * 1000;
/** Sessions waiting for input longer than this are auto-completed */
const SESSION_EXPIRY_MINUTES = 60;

@Injectable()
export class WorkflowEngineService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkflowEngineService.name);
  private expiryTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly registry: NodeHandlerRegistry,
    private readonly sessionService: WorkflowSessionService,
    private readonly variableResolver: VariableResolver,
    private readonly channelAdapter: WhatsAppChannelAdapter,
    // Individual handlers injected for registration
    private readonly startHandler: StartHandler,
    private readonly sendMessageHandler: SendMessageHandler,
    private readonly sendButtonsHandler: SendButtonsHandler,
    private readonly sendListHandler: SendListHandler,
    private readonly askQuestionHandler: AskQuestionHandler,
    private readonly conditionHandler: ConditionHandler,
    private readonly aiResponseHandler: AiResponseHandler,
    private readonly setVariableHandler: SetVariableHandler,
    private readonly waitHandler: WaitHandler,
    private readonly humanHandoverHandler: HumanHandoverHandler,
    private readonly endHandler: EndHandler,
  ) {}

  /** Register all node handlers at startup */
  onModuleInit() {
    this.registry.register('start', this.startHandler);
    this.registry.register('send_message', this.sendMessageHandler);
    this.registry.register('send_buttons', this.sendButtonsHandler);
    this.registry.register('send_list', this.sendListHandler);
    this.registry.register('ask_question', this.askQuestionHandler);
    this.registry.register('condition', this.conditionHandler);
    this.registry.register('ai_response', this.aiResponseHandler);
    this.registry.register('set_variable', this.setVariableHandler);
    this.registry.register('wait', this.waitHandler);
    this.registry.register('human_handover', this.humanHandoverHandler);
    this.registry.register('end', this.endHandler);

    this.logger.log(`Registered ${this.registry.getRegisteredTypes().length} node handlers`);

    // Start session expiry timer
    this.expiryTimer = setInterval(async () => {
      try {
        await this.sessionService.expireStale(SESSION_EXPIRY_MINUTES);
      } catch (err) {
        this.logger.error(`Session expiry check failed: ${err}`);
      }
    }, EXPIRY_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.expiryTimer) {
      clearInterval(this.expiryTimer);
      this.expiryTimer = null;
    }
  }

  // ═══════════════════════════════════════════════════════
  //  MAIN ENTRY POINT
  // ═══════════════════════════════════════════════════════

  /**
   * Process an incoming message through the workflow system.
   *
   * @returns true if the workflow handled the message (caller should NOT call AI)
   * @returns false if no workflow applies (caller should fall through to AI)
   */
  async processMessage(
    chatId: string,
    businessId: string,
    incomingData: {
      from: string;
      text?: string;
      type: string;
      buttonId?: string;
      listRowId?: string;
      messageId: string;
    },
  ): Promise<boolean> {
    const input: IncomingMessage = {
      from: incomingData.from,
      text: incomingData.text,
      type: incomingData.type,
      buttonId: incomingData.buttonId,
      listRowId: incomingData.listRowId,
      messageId: incomingData.messageId,
    };

    try {
      // 1. Check for handed-over session — skip workflow entirely
      const handedOver = await this.sessionService.findHandedOverSession(chatId);
      if (handedOver) {
        this.logger.debug(`Chat ${chatId} is handed over, skipping workflow`);
        return false;
      }

      // 2. Check for active/waiting session
      const activeSession = await this.sessionService.findActiveSession(chatId);

      if (activeSession) {
        if (activeSession.status === 'WAITING_INPUT') {
          return this.handleInput(activeSession, input);
        }
        // ACTIVE but between nodes — queue or ignore
        this.logger.debug(`Chat ${chatId} has ACTIVE session, message queued implicitly`);
        return true;
      }

      // 3. No active session — try trigger matching
      return this.tryTrigger(chatId, businessId, input);
    } catch (error) {
      this.logger.error(
        `processMessage error for chat ${chatId}: ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════
  //  TRIGGER MATCHING
  // ═══════════════════════════════════════════════════════

  /**
   * Find a published workflow whose trigger matches the incoming message.
   * If found, create a session and start executing.
   */
  private async tryTrigger(
    chatId: string,
    businessId: string,
    input: IncomingMessage,
  ): Promise<boolean> {
    // Get all published workflows for this business
    const workflows = await this.prisma.workflow.findMany({
      where: { businessId, status: 'PUBLISHED' },
      orderBy: { updatedAt: 'desc' },
    });

    if (workflows.length === 0) return false;

    // Count messages for NEW_CONVERSATION trigger check
    const chatMessageCount = await this.prisma.message.count({
      where: { chatId },
    });

    for (const workflow of workflows) {
      if (this.matchesTrigger(workflow, input, chatId, chatMessageCount)) {
        this.logger.log(`Trigger matched: workflow "${workflow.name}" (${workflow.id})`);
        await this.startWorkflow(workflow, chatId, businessId, input);
        return true;
      }
    }

    return false;
  }

  private matchesTrigger(
    workflow: any,
    input: IncomingMessage,
    _chatId: string,
    chatMessageCount?: number,
  ): boolean {
    const triggerType: string = workflow.triggerType;
    const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
    const startNode = nodes.find((n: any) => n.type === 'start');
    const triggerConfig = startNode?.config || (workflow.triggerConfig as any) || {};

    switch (triggerType) {
      case 'KEYWORD': {
        const keywords: string[] = triggerConfig.keywords || [];
        const matchMode: string = triggerConfig.matchMode || 'exact';
        const text = (input.text || '').toLowerCase().trim();

        if (!text || keywords.length === 0) return false;

        return keywords.some((kw) => {
          const keyword = kw.toLowerCase().trim();
          switch (matchMode) {
            case 'contains':
              return text.includes(keyword);
            case 'regex':
              try { return new RegExp(keyword, 'i').test(text); } catch { return false; }
            case 'exact':
            default:
              return text === keyword;
          }
        });
      }

      case 'NEW_CONVERSATION':
        // Only matches if this is the first message in the chat
        // (chatMessageCount === 1 means only the current message exists)
        return chatMessageCount !== undefined && chatMessageCount <= 1;

      case 'BUTTON_CLICK':
        return !!input.buttonId;

      case 'MANUAL':
        // Manual triggers are only activated from the dashboard, not from customer messages
        return false;

      case 'WEBHOOK':
        // Webhook triggers are activated via API, not from customer messages
        return false;

      case 'CONTACT_EVENT':
        // Contact event triggers are for system events, not customer messages
        return false;

      default:
        return false;
    }
  }

  // ═══════════════════════════════════════════════════════
  //  START WORKFLOW
  // ═══════════════════════════════════════════════════════

  private async startWorkflow(
    workflow: any,
    chatId: string,
    businessId: string,
    input: IncomingMessage,
  ) {
    const nodes: WorkflowNode[] = Array.isArray(workflow.nodes) ? workflow.nodes : [];
    const edges: WorkflowEdge[] = Array.isArray(workflow.edges) ? workflow.edges : [];
    const startNode = nodes.find((n) => n.type === 'start');

    if (!startNode) {
      this.logger.warn(`Workflow ${workflow.id} has no start node`);
      return;
    }

    // Create session with workflow snapshot
    const session = await this.sessionService.createSession({
      chatId,
      businessId,
      workflowId: workflow.id,
      workflowVersion: workflow.version,
      workflowSnapshot: { nodes, edges, triggerType: workflow.triggerType, triggerConfig: workflow.triggerConfig },
      startNodeId: startNode.id,
    });

    // Build execution context
    const credentials = await this.getBusinessCredentials(businessId);
    const business = await this.prisma.business.findUnique({ where: { id: businessId } });

    const ctx: ExecutionContext = {
      session: {
        id: session.id,
        chatId,
        businessId,
        variables: {},
        retryCount: 0,
        maxRetries: 3,
      },
      customerPhone: input.from,
      credentials,
      businessName: business?.name || '',
      nodes,
      edges,
    };

    // Set chatId on adapter so outgoing messages are saved to chat history
    this.channelAdapter.setChatId(chatId);

    try {
      // Execute from start node
      await this.executeFromNode(session.id, startNode.id, ctx, input);
    } finally {
      this.channelAdapter.setChatId(null);
    }
  }

  // ═══════════════════════════════════════════════════════
  //  HANDLE INPUT (resume from WAITING_INPUT)
  // ═══════════════════════════════════════════════════════

  private async handleInput(
    session: any,
    input: IncomingMessage,
  ): Promise<boolean> {
    const snapshot = session.workflowSnapshot as any;
    const nodes: WorkflowNode[] = snapshot?.nodes || [];
    const edges: WorkflowEdge[] = snapshot?.edges || [];
    const currentNodeId: string = session.currentNodeId;

    const currentNode = nodes.find((n) => n.id === currentNodeId);
    if (!currentNode) {
      this.logger.warn(`Session ${session.id}: currentNodeId ${currentNodeId} not found in snapshot`);
      await this.sessionService.failSession(session.id, 'Current node not found');
      return false;
    }

    const credentials = await this.getBusinessCredentials(session.businessId);
    const business = await this.prisma.business.findUnique({ where: { id: session.businessId } });
    const sessionVars = typeof session.variables === 'object' ? session.variables as Record<string, any> : {};

    const ctx: ExecutionContext = {
      session: {
        id: session.id,
        chatId: session.chatId,
        businessId: session.businessId,
        variables: sessionVars,
        retryCount: session.retryCount || 0,
        maxRetries: session.maxRetries || 3,
      },
      customerPhone: input.from,
      credentials,
      businessName: business?.name || '',
      nodes,
      edges,
    };

    // Set chatId on adapter so outgoing messages are saved to chat history
    this.channelAdapter.setChatId(session.chatId);

    try {
      return await this._handleInputInner(session, currentNode, ctx, input);
    } finally {
      this.channelAdapter.setChatId(null);
    }
  }

  private async _handleInputInner(
    session: any,
    currentNode: WorkflowNode,
    ctx: ExecutionContext,
    input: IncomingMessage,
  ): Promise<boolean> {
    // Execute the current node with the input
    const handler = this.registry.get(currentNode.type);
    if (!handler) {
      this.logger.error(`No handler for node type: ${currentNode.type}`);
      await this.sessionService.failSession(session.id, `Unknown node type: ${currentNode.type}`);
      return false;
    }

    const startTime = Date.now();
    const result = await handler.execute(currentNode, ctx, input);
    const duration = Date.now() - startTime;

    // Log execution
    await this.sessionService.log({
      sessionId: session.id,
      nodeId: currentNode.id,
      nodeType: currentNode.type,
      status: result.status === 'ERROR' ? 'ERROR' : 'SUCCESS',
      input: { text: input.text, buttonId: input.buttonId, listRowId: input.listRowId },
      output: result.output,
      error: result.error,
      duration,
    });

    // Handle AI fallback — node returned WAIT with needsAiFallback
    if (result.status === 'WAIT' && result.output?.needsAiFallback) {
      await this.aiFallback(session, currentNode, input, ctx);
      // Increment retry
      await this.sessionService.incrementRetry(session.id);
      return true;
    }

    // Handle retry (ask_question validation failure)
    if (result.status === 'WAIT' && result.output?.retrying) {
      await this.sessionService.incrementRetry(session.id);
      return true;
    }

    // Merge variables
    if (result.variables) {
      await this.sessionService.setVariables(session.id, result.variables);
      ctx.session.variables = { ...ctx.session.variables, ...result.variables };
    }

    // Reset retry on successful input
    await this.sessionService.resetRetry(session.id);

    // Handle terminal states
    if (result.status === 'END') {
      await this.sessionService.completeSession(session.id);
      return true;
    }
    if (result.status === 'HANDOVER') {
      await this.sessionService.handOverSession(session.id);
      return true;
    }
    if (result.status === 'ERROR') {
      await this.sessionService.failSession(session.id, result.error);
      return true;
    }

    // CONTINUE — find next node and keep executing
    if (result.status === 'CONTINUE') {
      const nextNodeId = this.findNextNode(ctx.edges, currentNode.id, result.outputHandle);
      if (nextNodeId) {
        await this.executeFromNode(session.id, nextNodeId, ctx);
      } else {
        // Dead end
        await this.sessionService.completeSession(session.id);
      }
      return true;
    }

    // WAIT — already in WAITING_INPUT, the handler re-sent the prompt
    return true;
  }

  // ═══════════════════════════════════════════════════════
  //  NODE EXECUTION LOOP
  // ═══════════════════════════════════════════════════════

  /**
   * Execute nodes sequentially starting from nodeId until hitting
   * a WAIT, END, HANDOVER, or ERROR.
   */
  private async executeFromNode(
    sessionId: string,
    nodeId: string,
    ctx: ExecutionContext,
    input?: IncomingMessage,
  ) {
    let currentNodeId = nodeId;
    let step = 0;

    while (step < MAX_EXECUTION_STEPS) {
      step++;
      const node = ctx.nodes.find((n) => n.id === currentNodeId);
      if (!node) {
        this.logger.warn(`Node ${currentNodeId} not found, completing session`);
        await this.sessionService.completeSession(sessionId);
        return;
      }

      const handler = this.registry.get(node.type);
      if (!handler) {
        this.logger.error(`No handler for node type: ${node.type}`);
        await this.sessionService.failSession(sessionId, `Unknown node type: ${node.type}`);
        return;
      }

      // Record history
      await this.sessionService.appendHistory(sessionId, node.id, node.type);

      // Execute with error guard
      let result: NodeResult;
      const startTime = Date.now();
      try {
        result = await handler.execute(node, ctx, step === 1 ? input : undefined);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Node ${node.id} (${node.type}) threw: ${errMsg}`);
        await this.sessionService.log({
          sessionId,
          nodeId: node.id,
          nodeType: node.type,
          status: 'ERROR',
          error: errMsg,
          duration: Date.now() - startTime,
        });
        await this.sessionService.failSession(sessionId, `Node "${node.label}" failed: ${errMsg}`);
        return;
      }
      const duration = Date.now() - startTime;

      // Log
      await this.sessionService.log({
        sessionId,
        nodeId: node.id,
        nodeType: node.type,
        status: result.status === 'ERROR' ? 'ERROR' : 'SUCCESS',
        input: step === 1 && input ? { text: input.text, buttonId: input.buttonId } : undefined,
        output: result.output,
        error: result.error,
        duration,
      });

      // Merge variables
      if (result.variables) {
        await this.sessionService.setVariables(sessionId, result.variables);
        ctx.session.variables = { ...ctx.session.variables, ...result.variables };
      }

      // Handle result
      switch (result.status) {
        case 'WAIT':
          await this.sessionService.advanceToNode(sessionId, node.id, 'WAITING_INPUT');
          return;

        case 'END':
          await this.sessionService.completeSession(sessionId);
          return;

        case 'HANDOVER':
          await this.sessionService.handOverSession(sessionId);
          return;

        case 'ERROR':
          await this.sessionService.failSession(sessionId, result.error);
          return;

        case 'CONTINUE': {
          const nextNodeId = this.findNextNode(ctx.edges, node.id, result.outputHandle);
          if (!nextNodeId) {
            // No outgoing edge — workflow ends here
            await this.sessionService.completeSession(sessionId);
            return;
          }
          // Advance session state
          await this.sessionService.advanceToNode(sessionId, nextNodeId, 'ACTIVE');
          currentNodeId = nextNodeId;
          break;
        }
      }
    }

    // Safety: hit max steps
    this.logger.warn(`Session ${sessionId} hit max execution steps (${MAX_EXECUTION_STEPS})`);
    await this.sessionService.failSession(sessionId, 'Max execution steps exceeded (possible infinite loop)');
  }

  // ═══════════════════════════════════════════════════════
  //  AI FALLBACK
  // ═══════════════════════════════════════════════════════

  /**
   * When the user's response doesn't match expected input (wrong button, off-topic text),
   * call AI with workflow context to give a helpful response while keeping the session
   * at the current node.
   */
  private async aiFallback(
    session: any,
    currentNode: WorkflowNode,
    input: IncomingMessage,
    ctx: ExecutionContext,
  ) {
    try {
      const history = await this.prisma.message.findMany({
        where: { chatId: session.chatId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

      const knowledge = await this.prisma.knowledgeBase.findMany({
        where: { businessId: session.businessId },
      });

      const workflowContext = `The customer is currently in a workflow at step "${currentNode.label}" (type: ${currentNode.type}). ` +
        `Their response "${input.text}" doesn't match the expected options. ` +
        `Respond helpfully and try to guide them back to the expected input. ` +
        `Do NOT proceed with the workflow — just help them understand what's expected.`;

      const aiResponse = await this.aiService.getResponse(
        `[Workflow context: ${workflowContext}]\n\nCustomer message: ${input.text}`,
        history,
        knowledge,
      );

      if (aiResponse) {
        await this.channelAdapter.sendTextMessage(
          input.from,
          aiResponse,
          ctx.credentials,
        );
      }
    } catch (error) {
      this.logger.error(`AI fallback failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  // ═══════════════════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════════════════

  /**
   * Find the target node ID by following the edge from sourceNodeId
   * with the matching sourceHandle.
   */
  private findNextNode(
    edges: WorkflowEdge[],
    sourceNodeId: string,
    outputHandle?: string,
  ): string | undefined {
    const handle = outputHandle || '__default';

    // Try exact handle match first
    let edge = edges.find(
      (e) => e.sourceNodeId === sourceNodeId && e.sourceHandle === handle,
    );

    // Fallback: if handle is '__default', try edges with no sourceHandle
    if (!edge && handle === '__default') {
      edge = edges.find(
        (e) => e.sourceNodeId === sourceNodeId && (!e.sourceHandle || e.sourceHandle === '__default'),
      );
    }

    // Last resort: just find any edge from this source
    if (!edge) {
      edge = edges.find((e) => e.sourceNodeId === sourceNodeId);
    }

    return edge?.targetNodeId;
  }

  /**
   * Get WhatsApp credentials for a business.
   */
  private async getBusinessCredentials(businessId: string): Promise<BusinessCredentials> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { whatsappPhoneNumberId: true, whatsappAccessToken: true },
    });

    // Fall back to env vars if business doesn't have per-business credentials
    return {
      phoneNumberId: business?.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      accessToken: business?.whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN || '',
    };
  }
}
