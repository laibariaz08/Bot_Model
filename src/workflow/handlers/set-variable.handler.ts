import { Injectable } from '@nestjs/common';
import type { NodeHandler, WorkflowNode, ExecutionContext, IncomingMessage, NodeResult } from '../node-handler.interface';
import { VariableResolver } from '../variable-resolver.service';

/**
 * SetVariableHandler
 *
 * Sets or transforms a session variable. No message is sent.
 *
 * Config: { variable: string, value: string }
 * The value supports variable interpolation (e.g. "Hello {{customer.name}}").
 */
@Injectable()
export class SetVariableHandler implements NodeHandler {
  constructor(private readonly variableResolver: VariableResolver) {}

  async execute(
    node: WorkflowNode,
    ctx: ExecutionContext,
    _input?: IncomingMessage,
  ): Promise<NodeResult> {
    const config = node.config || {};
    const varName: string = config.variable || '';
    const rawValue: string = config.value ?? '';

    if (!varName) {
      return { status: 'CONTINUE', outputHandle: '__default', output: { skipped: 'no variable name' } };
    }

    // Resolve interpolation in the value
    const resolveCtx = this.variableResolver.buildContext(
      ctx.session.variables,
      { phone: ctx.customerPhone },
      {},
      ctx.businessName,
    );
    const resolved = this.variableResolver.resolveText(rawValue, resolveCtx);

    return {
      status: 'CONTINUE',
      outputHandle: '__default',
      variables: { [varName]: resolved },
      output: { variable: varName, value: resolved },
    };
  }
}
