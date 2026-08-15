import { Injectable } from '@nestjs/common';
import type { NodeHandler, WorkflowNode, ExecutionContext, IncomingMessage, NodeResult } from '../node-handler.interface';

/**
 * StartHandler
 *
 * The start node is not really "executed" — trigger matching happens
 * before the engine enters the graph. When the engine calls execute on
 * the start node, it simply passes through to the next node.
 */
@Injectable()
export class StartHandler implements NodeHandler {
  async execute(
    _node: WorkflowNode,
    _ctx: ExecutionContext,
    _input?: IncomingMessage,
  ): Promise<NodeResult> {
    return { status: 'CONTINUE', outputHandle: '__default' };
  }
}
