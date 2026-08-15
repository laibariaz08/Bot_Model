import { Injectable } from '@nestjs/common';
import type { NodeHandler, WorkflowNode, ExecutionContext, IncomingMessage, NodeResult } from '../node-handler.interface';

/**
 * ConditionHandler
 *
 * Evaluates conditions against session variables and routes to the first matching branch.
 * If no condition matches, follows the 'default' branch.
 *
 * Config: {
 *   conditions: Array<{
 *     id: string,
 *     variable: string,
 *     operator: 'equals'|'not_equals'|'contains'|'greater_than'|'less_than'|'is_empty'|'is_not_empty',
 *     value: any,
 *     label: string
 *   }>,
 *   defaultBranch: string
 * }
 * Outputs: one per condition.id + 'default'
 */
@Injectable()
export class ConditionHandler implements NodeHandler {
  async execute(
    node: WorkflowNode,
    ctx: ExecutionContext,
    _input?: IncomingMessage,
  ): Promise<NodeResult> {
    const config = node.config || {};
    const conditions: Array<{
      id: string;
      variable: string;
      operator: string;
      value: any;
      label: string;
    }> = config.conditions || [];

    // Evaluate conditions top-to-bottom, first match wins
    for (const cond of conditions) {
      const varValue = this.resolveVariable(cond.variable, ctx.session.variables);

      if (this.evaluate(varValue, cond.operator, cond.value)) {
        return {
          status: 'CONTINUE',
          outputHandle: cond.id,
          output: { matchedCondition: cond.id, label: cond.label, variable: cond.variable, value: varValue },
        };
      }
    }

    // No match — use default branch
    return {
      status: 'CONTINUE',
      outputHandle: 'default',
      output: { matchedCondition: 'default', noMatch: true },
    };
  }

  private resolveVariable(variable: string, sessionVars: Record<string, any>): any {
    if (!variable) return undefined;

    // Support dotted paths like "workflow.booking_date" or just "booking_date"
    const parts = variable.split('.');
    let current: any = sessionVars;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }

    // If dotted path didn't resolve, try the full string as a flat key
    if (current === undefined && parts.length > 1) {
      return sessionVars[variable];
    }

    return current;
  }

  private evaluate(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'equals':
        return String(actual ?? '').toLowerCase() === String(expected ?? '').toLowerCase();

      case 'not_equals':
        return String(actual ?? '').toLowerCase() !== String(expected ?? '').toLowerCase();

      case 'contains':
        return String(actual ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase());

      case 'greater_than':
        return Number(actual) > Number(expected);

      case 'less_than':
        return Number(actual) < Number(expected);

      case 'is_empty':
        return actual === undefined || actual === null || actual === '';

      case 'is_not_empty':
        return actual !== undefined && actual !== null && actual !== '';

      default:
        return false;
    }
  }
}
