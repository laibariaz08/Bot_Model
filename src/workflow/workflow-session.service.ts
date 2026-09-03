import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * WorkflowSessionService
 *
 * Manages WorkflowSession lifecycle:
 *   - Create a session when a trigger activates
 *   - Find active/waiting session for a chat
 *   - Update execution state (currentNodeId, status, variables)
 *   - Complete / fail / hand over sessions
 *   - Write WorkflowLog entries
 */
@Injectable()
export class WorkflowSessionService {
  private readonly logger = new Logger(WorkflowSessionService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Find Active Session ───────────────────────────────

  /**
   * Find a session for this chat that is still in progress and within the 24-hour window.
   * If the last activity is older than 24 hours, the session is auto-completed
   * so a new flow can start fresh.
   */
  async findActiveSession(chatId: string) {
    const session = await this.prisma.workflowSession.findFirst({
      where: {
        chatId,
        status: { in: ['ACTIVE', 'WAITING_INPUT'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) return null;

    const hoursSinceActivity = (Date.now() - new Date(session.lastActivityAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceActivity >= 24) {
      await this.prisma.workflowSession.update({
        where: { id: session.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      this.logger.log(`Session ${session.id} expired (24h window exceeded), allowing new flow`);
      return null;
    }

    return session;
  }

  /**
   * Find a session that is handed over (agent is handling).
   * Also respects the 24-hour window.
   */
  async findHandedOverSession(chatId: string) {
    const session = await this.prisma.workflowSession.findFirst({
      where: {
        chatId,
        status: 'HANDED_OVER',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) return null;

    const hoursSinceActivity = (Date.now() - new Date(session.lastActivityAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceActivity >= 24) {
      await this.prisma.workflowSession.update({
        where: { id: session.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      this.logger.log(`Handed-over session ${session.id} expired (24h window exceeded)`);
      return null;
    }

    return session;
  }

  // ─── Create Session ────────────────────────────────────

  /**
   * Start a new workflow session. Snapshots the current workflow definition
   * so the session runs against a fixed version even if the workflow is later edited.
   */
  async createSession(params: {
    chatId: string;
    businessId: string;
    workflowId: string;
    workflowVersion: number;
    workflowSnapshot: any; // full nodes + edges + triggerConfig
    startNodeId: string;
  }) {
    const session = await this.prisma.workflowSession.create({
      data: {
        chatId: params.chatId,
        businessId: params.businessId,
        workflowId: params.workflowId,
        workflowVersion: params.workflowVersion,
        workflowSnapshot: params.workflowSnapshot,
        currentNodeId: params.startNodeId,
        status: 'ACTIVE',
        variables: {},
        context: {},
        history: [],
        retryCount: 0,
        maxRetries: 3,
        lastActivityAt: new Date(),
      },
    });

    this.logger.log(
      `Session created: ${session.id} for chat ${params.chatId}, workflow ${params.workflowId}`,
    );
    return session;
  }

  // ─── Update State ──────────────────────────────────────

  /**
   * Move to a new node and optionally change status.
   */
  async advanceToNode(
    sessionId: string,
    nodeId: string,
    status: 'ACTIVE' | 'WAITING_INPUT' = 'ACTIVE',
  ) {
    return this.prisma.workflowSession.update({
      where: { id: sessionId },
      data: {
        currentNodeId: nodeId,
        status,
        lastActivityAt: new Date(),
      },
    });
  }

  /**
   * Merge new variables into the session's variable store.
   */
  async setVariables(sessionId: string, newVars: Record<string, any>) {
    const session = await this.prisma.workflowSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) return null;

    const existing =
      typeof session.variables === 'object' && session.variables !== null
        ? (session.variables as Record<string, any>)
        : {};

    return this.prisma.workflowSession.update({
      where: { id: sessionId },
      data: {
        variables: { ...existing, ...newVars },
        lastActivityAt: new Date(),
      },
    });
  }

  /**
   * Increment retry count (for input validation retries).
   */
  async incrementRetry(sessionId: string) {
    return this.prisma.workflowSession.update({
      where: { id: sessionId },
      data: {
        retryCount: { increment: 1 },
        lastActivityAt: new Date(),
      },
    });
  }

  /**
   * Reset retry count (after successful input).
   */
  async resetRetry(sessionId: string) {
    return this.prisma.workflowSession.update({
      where: { id: sessionId },
      data: {
        retryCount: 0,
        lastActivityAt: new Date(),
      },
    });
  }

  /**
   * Append a node visit to the history trail.
   */
  async appendHistory(sessionId: string, nodeId: string, nodeType: string) {
    const session = await this.prisma.workflowSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) return;

    const history = Array.isArray(session.history) ? session.history as any[] : [];
    history.push({ nodeId, nodeType, timestamp: new Date().toISOString() });

    await this.prisma.workflowSession.update({
      where: { id: sessionId },
      data: { history },
    });
  }

  // ─── Terminal States ───────────────────────────────────

  async completeSession(sessionId: string) {
    return this.prisma.workflowSession.update({
      where: { id: sessionId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        lastActivityAt: new Date(),
      },
    });
  }

  async failSession(sessionId: string, reason?: string) {
    this.logger.warn(`Session ${sessionId} failed: ${reason}`);
    return this.prisma.workflowSession.update({
      where: { id: sessionId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        lastActivityAt: new Date(),
        context: reason ? { failReason: reason } : undefined,
      },
    });
  }

  async handOverSession(sessionId: string) {
    return this.prisma.workflowSession.update({
      where: { id: sessionId },
      data: {
        status: 'HANDED_OVER',
        lastActivityAt: new Date(),
      },
    });
  }

  // ─── Logging ───────────────────────────────────────────

  /**
   * Write a WorkflowLog entry for a node execution.
   */
  async log(params: {
    sessionId: string;
    nodeId: string;
    nodeType: string;
    status: 'SUCCESS' | 'ERROR' | 'SKIPPED';
    input?: any;
    output?: any;
    error?: string;
    duration?: number;
  }) {
    return this.prisma.workflowLog.create({
      data: {
        sessionId: params.sessionId,
        nodeId: params.nodeId,
        nodeType: params.nodeType,
        status: params.status,
        input: params.input ?? undefined,
        output: params.output ?? undefined,
        error: params.error,
        duration: params.duration,
      },
    });
  }

  // ─── Query Helpers ─────────────────────────────────────

  async getSession(sessionId: string) {
    return this.prisma.workflowSession.findUnique({
      where: { id: sessionId },
    });
  }

  /**
   * Get session with its full variable store parsed.
   */
  async getSessionVariables(sessionId: string): Promise<Record<string, any>> {
    const session = await this.prisma.workflowSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) return {};
    return typeof session.variables === 'object' && session.variables !== null
      ? (session.variables as Record<string, any>)
      : {};
  }

  /**
   * Complete any stale sessions that have been WAITING_INPUT for too long.
   * Called by a scheduled job.
   */
  async expireStale(maxAgeMinutes = 60) {
    const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
    const result = await this.prisma.workflowSession.updateMany({
      where: {
        status: 'WAITING_INPUT',
        lastActivityAt: { lt: cutoff },
      },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} stale workflow sessions`);
    }
    return result.count;
  }
}
