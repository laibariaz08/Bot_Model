import { Injectable } from '@nestjs/common';
import type { NodeHandler, WorkflowNode, ExecutionContext, IncomingMessage, NodeResult } from '../node-handler.interface';
import { VariableResolver } from '../variable-resolver.service';

@Injectable()
export class SendMediaHandler implements NodeHandler {
  constructor(
    private readonly variables: VariableResolver,
  ) {}

  async execute(
    node: WorkflowNode,
    ctx: ExecutionContext,
    _input?: IncomingMessage,
  ): Promise<NodeResult> {
    const config = node.config || {};
    const mediaType: string = config.mediaType || 'image';
    const rawUrl: string = config.url || '';
    const rawCaption: string = config.caption || '';
    const filename: string = config.filename || '';

    if (!rawUrl) {
      return { status: 'CONTINUE', outputHandle: '__default', output: { skipped: 'no media URL' } };
    }

    const resolveCtx = this.variables.buildContext(
      ctx.session.variables,
      { phone: ctx.customerPhone },
      {},
      ctx.businessName,
    );
    const url = this.variables.resolveText(rawUrl, resolveCtx);
    const caption = rawCaption ? this.variables.resolveText(rawCaption, resolveCtx) : undefined;

    if (config.delay && config.delay > 0) {
      await new Promise((r) => setTimeout(r, Math.min(config.delay, 10000)));
    }

    const result = await ctx.channel.sendMediaMessage(
      ctx.customerPhone,
      {
        type: mediaType as 'image' | 'document' | 'video' | 'audio',
        url,
        caption,
        filename: filename || undefined,
      },
      ctx.credentials,
    );

    if (!result.success) {
      return { status: 'ERROR', error: result.error, output: { mediaType, url } };
    }

    return {
      status: 'CONTINUE',
      outputHandle: '__default',
      output: { mediaType, url, messageId: result.messageId },
    };
  }
}
