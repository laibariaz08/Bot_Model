import { Injectable } from '@nestjs/common';
import type { NodeHandler, WorkflowNode, ExecutionContext, IncomingMessage, NodeResult } from '../node-handler.interface';
import { VariableResolver } from '../variable-resolver.service';
import { WhatsAppChannelAdapter } from '../whatsapp-channel.adapter';

/**
 * SendListHandler
 *
 * Sends an interactive list message (max 10 rows across sections).
 * On first execution: sends the message and returns WAIT.
 * On resume: matches the selected row to an output handle.
 *
 * Config: { body: string, buttonText: string, sections: Array<{ title, rows: Array<{ id, title, description? }> }> }
 * Outputs: one per row ID (sourceHandle = row.id) + optional 'fallback'
 */
@Injectable()
export class SendListHandler implements NodeHandler {
  constructor(
    private readonly variables: VariableResolver,
    private readonly channel: WhatsAppChannelAdapter,
  ) {}

  async execute(
    node: WorkflowNode,
    ctx: ExecutionContext,
    input?: IncomingMessage,
  ): Promise<NodeResult> {
    const config = node.config || {};
    const sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>
      = config.sections || [];

    // Flatten all row IDs for matching
    const allRows = sections.flatMap((s) => s.rows);

    // ─── Resume: customer selected a list item ──────────
    if (input) {
      const selectedId = input.listRowId || input.buttonId;

      if (selectedId) {
        const matched = allRows.find((r) => r.id === selectedId);
        if (matched) {
          return {
            status: 'CONTINUE',
            outputHandle: matched.id,
            variables: { 'message.button_id': matched.id },
            output: { matchedRow: matched.id, title: matched.title },
          };
        }
      }

      // Text match by title
      if (input.text) {
        const textMatch = allRows.find(
          (r) => r.title.toLowerCase() === input.text!.toLowerCase(),
        );
        if (textMatch) {
          return {
            status: 'CONTINUE',
            outputHandle: textMatch.id,
            variables: { 'message.button_id': textMatch.id },
            output: { matchedRow: textMatch.id, title: textMatch.title },
          };
        }
      }

      // Fallback
      const hasFallbackEdge = ctx.edges.some(
        (e) => e.sourceNodeId === node.id && (e.sourceHandle === '__fallback' || e.sourceHandle === 'fallback'),
      );
      if (hasFallbackEdge) {
        return {
          status: 'CONTINUE',
          outputHandle: '__fallback',
          output: { unmatched: true, text: input.text },
        };
      }

      return {
        status: 'WAIT',
        output: { unmatched: true, needsAiFallback: true, text: input.text },
      };
    }

    // ─── First execution: send the list message ─────────
    const resolveCtx = this.variables.buildContext(
      ctx.session.variables,
      { phone: ctx.customerPhone },
      {},
      ctx.businessName,
    );

    const body = this.variables.resolveText(config.body || '', resolveCtx);
    const buttonText = config.buttonText || 'View Options';

    const result = await this.channel.sendListMessage(
      ctx.customerPhone,
      body,
      buttonText,
      sections,
      ctx.credentials,
    );

    if (!result.success) {
      return { status: 'ERROR', error: result.error };
    }

    return {
      status: 'WAIT',
      output: { sent: true, messageId: result.messageId, rowCount: allRows.length },
    };
  }
}
