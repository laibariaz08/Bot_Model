import { Injectable } from '@nestjs/common';
import type { NodeHandler, WorkflowNode, ExecutionContext, IncomingMessage, NodeResult } from '../node-handler.interface';
import { VariableResolver } from '../variable-resolver.service';
import { WhatsAppChannelAdapter } from '../whatsapp-channel.adapter';
import { AiService } from '../../ai/ai.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * AiResponseHandler
 *
 * Passes conversation to the AI engine for a dynamic response.
 * Can optionally extract structured data from the AI output.
 *
 * Config: {
 *   prompt?: string,           // additional system context
 *   extractVariables?: Array<{ name: string, description: string }>,
 *   historyDepth?: number      // how many recent messages to include (default 5)
 * }
 */
@Injectable()
export class AiResponseHandler implements NodeHandler {
  constructor(
    private readonly variables: VariableResolver,
    private readonly channel: WhatsAppChannelAdapter,
    private readonly aiService: AiService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    node: WorkflowNode,
    ctx: ExecutionContext,
    input?: IncomingMessage,
  ): Promise<NodeResult> {
    const config = node.config || {};
    const historyDepth = config.historyDepth || 5;
    const extractVars: Array<{ name: string; description: string }> = config.extractVariables || [];

    try {
      // Get chat history
      const history = await this.prisma.message.findMany({
        where: { chatId: ctx.session.chatId },
        orderBy: { createdAt: 'desc' },
        take: historyDepth,
      });

      // Get business knowledge and agent config
      const knowledge = await this.prisma.knowledgeBase.findMany({
        where: { businessId: ctx.session.businessId },
      });

      const business = await this.prisma.business.findUnique({
        where: { id: ctx.session.businessId },
        select: { agentName: true, agentInstructions: true, websiteUrl: true },
      });

      // Build enriched message with workflow context
      const resolveCtx = this.variables.buildContext(
        ctx.session.variables,
        { phone: ctx.customerPhone },
        { text: input?.text },
        ctx.businessName,
      );

      let userMessage = input?.text || '';

      // Add workflow context prompt if configured
      if (config.prompt) {
        const resolvedPrompt = this.variables.resolveText(config.prompt, resolveCtx);
        // The prompt is passed as additional context to the AI
        userMessage = `[Workflow context: ${resolvedPrompt}]\n\nCustomer message: ${userMessage}`;
      }

      // If we need to extract variables, add extraction instructions
      if (extractVars.length > 0) {
        const extractionPrompt = extractVars
          .map((v) => `- ${v.name}: ${v.description}`)
          .join('\n');
        userMessage += `\n\n[After responding, extract the following values from the conversation and include them as JSON at the very end of your response wrapped in <extracted> tags:\n${extractionPrompt}\nFormat: <extracted>{"key": "value"}</extracted>]`;
      }

      // Call AI service
      const aiResponse = await this.aiService.getResponse(
        userMessage,
        history,
        knowledge,
        business ? { agentName: business.agentName, agentInstructions: business.agentInstructions, websiteUrl: business.websiteUrl } : undefined,
      );

      if (!aiResponse) {
        return { status: 'ERROR', error: 'AI returned empty response' };
      }

      // Extract variables if configured
      let cleanResponse = aiResponse;
      const extractedVars: Record<string, any> = {};

      if (extractVars.length > 0) {
        const extractMatch = aiResponse.match(/<extracted>([\s\S]*?)<\/extracted>/);
        if (extractMatch) {
          cleanResponse = aiResponse.replace(/<extracted>[\s\S]*?<\/extracted>/, '').trim();
          try {
            const parsed = JSON.parse(extractMatch[1]);
            for (const v of extractVars) {
              if (parsed[v.name] !== undefined) {
                extractedVars[`ai.${v.name}`] = parsed[v.name];
              }
            }
          } catch {
            // Extraction failed — continue without extracted vars
          }
        }
      }

      // Send AI response to customer
      const sendResult = await this.channel.sendTextMessage(
        ctx.customerPhone,
        cleanResponse,
        ctx.credentials,
      );

      return {
        status: 'CONTINUE',
        outputHandle: '__default',
        variables: Object.keys(extractedVars).length > 0 ? extractedVars : undefined,
        output: {
          aiResponse: cleanResponse,
          messageId: sendResult.messageId,
          extractedVariables: extractedVars,
        },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'AI call failed';
      return { status: 'ERROR', error: msg };
    }
  }
}
