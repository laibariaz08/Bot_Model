import { Injectable } from '@nestjs/common';
import type { NodeHandler, WorkflowNode, ExecutionContext, IncomingMessage, NodeResult } from '../node-handler.interface';
import { VariableResolver } from '../variable-resolver.service';

@Injectable()
export class SendButtonsHandler implements NodeHandler {
  constructor(
    private readonly variables: VariableResolver,
  ) {}

  async execute(
    node: WorkflowNode,
    ctx: ExecutionContext,
    input?: IncomingMessage,
  ): Promise<NodeResult> {
    const config = node.config || {};
    const buttons: Array<{ id: string; title: string }> = config.buttons || [];

    // ─── Resume: customer responded ─────────────────────
    if (input) {
      const clickedId = input.buttonId || input.listRowId;

      // Check if the response matches a button ID
      if (clickedId) {
        const matched = buttons.find((b) => b.id === clickedId);
        if (matched) {
          return {
            status: 'CONTINUE',
            outputHandle: matched.id,
            variables: { 'message.button_id': matched.id },
            output: { matchedButton: matched.id, title: matched.title },
          };
        }
      }

      // Text response — try to match by title (case-insensitive)
      if (input.text) {
        const textMatch = buttons.find(
          (b) => b.title.toLowerCase() === input.text!.toLowerCase(),
        );
        if (textMatch) {
          return {
            status: 'CONTINUE',
            outputHandle: textMatch.id,
            variables: { 'message.button_id': textMatch.id },
            output: { matchedButton: textMatch.id, title: textMatch.title },
          };
        }
      }

      // No match — use fallback edge if it exists
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

      // No fallback edge — return null output handle so the engine can use AI fallback
      return {
        status: 'WAIT',
        output: { unmatched: true, needsAiFallback: true, text: input.text },
      };
    }

    // ─── First execution: send the button message ───────
    const resolveCtx = this.variables.buildContext(
      ctx.session.variables,
      { phone: ctx.customerPhone },
      {},
      ctx.businessName,
    );

    const body = this.variables.resolveText(config.body || '', resolveCtx);
    const footer = config.footer
      ? this.variables.resolveText(config.footer, resolveCtx)
      : undefined;

    const result = await ctx.channel.sendButtonMessage(
      ctx.customerPhone,
      body,
      buttons,
      ctx.credentials,
      footer,
    );

    if (!result.success) {
      return { status: 'ERROR', error: result.error };
    }

    // Wait for customer to click a button
    return {
      status: 'WAIT',
      output: { sent: true, messageId: result.messageId, buttonCount: buttons.length },
    };
  }
}
