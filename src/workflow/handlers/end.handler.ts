import { Injectable } from '@nestjs/common';
import type { NodeHandler, WorkflowNode, ExecutionContext, IncomingMessage, NodeResult } from '../node-handler.interface';
import { VariableResolver } from '../variable-resolver.service';

@Injectable()
export class EndHandler implements NodeHandler {
  constructor(
    private readonly variables: VariableResolver,
  ) {}

  async execute(
    node: WorkflowNode,
    ctx: ExecutionContext,
    _input?: IncomingMessage,
  ): Promise<NodeResult> {
    const config = node.config || {};

    if (config.message) {
      const resolveCtx = this.variables.buildContext(
        ctx.session.variables,
        { phone: ctx.customerPhone },
        {},
        ctx.businessName,
      );
      const message = this.variables.resolveText(config.message, resolveCtx);

      await ctx.channel.sendTextMessage(
        ctx.customerPhone,
        message,
        ctx.credentials,
      );
    }

    return {
      status: 'END',
      output: { completed: true },
    };
  }
}
