import { Injectable } from '@nestjs/common';
import type { NodeHandler, WorkflowNode, ExecutionContext, IncomingMessage, NodeResult } from '../node-handler.interface';
import { VariableResolver } from '../variable-resolver.service';
import { WhatsAppChannelAdapter } from '../whatsapp-channel.adapter';

/**
 * SendMessageHandler
 *
 * Sends a plain text message to the customer.
 * Supports variable interpolation in the message body.
 * Optionally applies a delay before sending.
 *
 * Config: { message: string, delay?: number (ms) }
 */
@Injectable()
export class SendMessageHandler implements NodeHandler {
  constructor(
    private readonly variables: VariableResolver,
    private readonly channel: WhatsAppChannelAdapter,
  ) {}

  async execute(
    node: WorkflowNode,
    ctx: ExecutionContext,
    _input?: IncomingMessage,
  ): Promise<NodeResult> {
    const config = node.config || {};
    const rawMessage: string = config.message || '';

    if (!rawMessage) {
      return { status: 'CONTINUE', outputHandle: '__default', output: { skipped: 'empty message' } };
    }

    // Resolve variables
    const resolveCtx = this.variables.buildContext(
      ctx.session.variables,
      { phone: ctx.customerPhone },
      {},
      ctx.businessName,
    );
    const message = this.variables.resolveText(rawMessage, resolveCtx);

    // Optional delay
    if (config.delay && config.delay > 0) {
      await new Promise((r) => setTimeout(r, Math.min(config.delay, 10000)));
    }

    // Send via channel adapter
    const result = await this.channel.sendTextMessage(
      ctx.customerPhone,
      message,
      ctx.credentials,
    );

    if (!result.success) {
      return { status: 'ERROR', error: result.error, output: { message } };
    }

    return {
      status: 'CONTINUE',
      outputHandle: '__default',
      output: { message, messageId: result.messageId },
    };
  }
}
