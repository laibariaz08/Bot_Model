import { Injectable } from '@nestjs/common';
import type { NodeHandler, WorkflowNode, ExecutionContext, IncomingMessage, NodeResult } from '../node-handler.interface';

/**
 * WaitHandler
 *
 * Pauses execution for a specified duration.
 * For short waits (< 30s), uses setTimeout inline.
 * For longer waits, the engine should schedule a resume — but for now
 * we cap at 30s and use inline delay (Phase 3 can add scheduled resume).
 *
 * Config: { duration: number, unit: 'seconds'|'minutes'|'hours' }
 */
@Injectable()
export class WaitHandler implements NodeHandler {
  async execute(
    node: WorkflowNode,
    _ctx: ExecutionContext,
    _input?: IncomingMessage,
  ): Promise<NodeResult> {
    const config = node.config || {};
    const duration = Number(config.duration) || 0;
    const unit: string = config.unit || 'seconds';

    let ms = 0;
    switch (unit) {
      case 'minutes':
        ms = duration * 60 * 1000;
        break;
      case 'hours':
        ms = duration * 60 * 60 * 1000;
        break;
      default:
        ms = duration * 1000;
    }

    // Cap inline wait at 30 seconds to avoid blocking the webhook handler
    const cappedMs = Math.min(ms, 30000);

    if (cappedMs > 0) {
      await new Promise((r) => setTimeout(r, cappedMs));
    }

    return {
      status: 'CONTINUE',
      outputHandle: '__default',
      output: { waited: cappedMs, requested: ms },
    };
  }
}
