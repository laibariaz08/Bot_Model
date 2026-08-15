import { Injectable } from '@nestjs/common';
import type { NodeHandler, WorkflowNode, ExecutionContext, IncomingMessage, NodeResult } from '../node-handler.interface';
import { VariableResolver } from '../variable-resolver.service';
import { WhatsAppChannelAdapter } from '../whatsapp-channel.adapter';

/**
 * AskQuestionHandler
 *
 * Sends a question, waits for free-text input, validates it,
 * and stores the response in a session variable.
 *
 * Config: {
 *   question: string,
 *   variableName: string,
 *   inputType: 'text'|'email'|'phone'|'number'|'date'|'time'|'selection',
 *   validation?: { pattern?: string, min?: number, max?: number },
 *   required: boolean,
 *   retryMessage?: string,
 *   maxRetries?: number
 * }
 */
@Injectable()
export class AskQuestionHandler implements NodeHandler {
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
    const variableName: string = config.variableName || 'answer';
    const inputType: string = config.inputType || 'text';
    const maxRetries: number = config.maxRetries ?? ctx.session.maxRetries ?? 3;

    // ─── Resume: customer answered ──────────────────────
    if (input) {
      const answer = input.text || '';

      // Validate
      const validationError = this.validate(answer, inputType, config.validation);

      if (validationError) {
        // Check retry limit
        if (ctx.session.retryCount >= maxRetries) {
          // Exceeded retries — continue with whatever we have
          return {
            status: 'CONTINUE',
            outputHandle: '__default',
            variables: { [variableName]: answer },
            output: { value: answer, retriesExhausted: true },
          };
        }

        // Send retry message
        const retryMsg = config.retryMessage || `Invalid input. ${validationError} Please try again.`;
        const resolveCtx = this.variables.buildContext(
          ctx.session.variables,
          { phone: ctx.customerPhone },
          { text: answer },
          ctx.businessName,
        );
        await this.channel.sendTextMessage(
          ctx.customerPhone,
          this.variables.resolveText(retryMsg, resolveCtx),
          ctx.credentials,
        );

        return {
          status: 'WAIT',
          output: { retrying: true, attempt: ctx.session.retryCount + 1, reason: validationError },
        };
      }

      // Valid — store variable and continue
      const parsedValue = this.parseValue(answer, inputType);
      return {
        status: 'CONTINUE',
        outputHandle: '__default',
        variables: { [variableName]: parsedValue },
        output: { value: parsedValue, inputType },
      };
    }

    // ─── First execution: send the question ─────────────
    const resolveCtx = this.variables.buildContext(
      ctx.session.variables,
      { phone: ctx.customerPhone },
      {},
      ctx.businessName,
    );
    const question = this.variables.resolveText(config.question || 'Please provide your input:', resolveCtx);

    const result = await this.channel.sendTextMessage(
      ctx.customerPhone,
      question,
      ctx.credentials,
    );

    if (!result.success) {
      return { status: 'ERROR', error: result.error };
    }

    return {
      status: 'WAIT',
      output: { sent: true, messageId: result.messageId, expecting: inputType },
    };
  }

  // ─── Validation ────────────────────────────────────────

  private validate(
    value: string,
    inputType: string,
    validation?: { pattern?: string; min?: number; max?: number },
  ): string | null {
    if (!value.trim()) {
      return 'A response is required.';
    }

    switch (inputType) {
      case 'email':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return 'Please enter a valid email address.';
        }
        break;

      case 'phone':
        if (!/^\+?[\d\s\-()]{7,20}$/.test(value)) {
          return 'Please enter a valid phone number.';
        }
        break;

      case 'number': {
        const num = Number(value);
        if (isNaN(num)) {
          return 'Please enter a valid number.';
        }
        if (validation?.min !== undefined && num < validation.min) {
          return `Value must be at least ${validation.min}.`;
        }
        if (validation?.max !== undefined && num > validation.max) {
          return `Value must be at most ${validation.max}.`;
        }
        break;
      }

      case 'date':
        if (isNaN(Date.parse(value))) {
          return 'Please enter a valid date (e.g. 2024-01-15).';
        }
        break;

      case 'time':
        if (!/^\d{1,2}:\d{2}(\s?[AaPp][Mm])?$/.test(value.trim())) {
          return 'Please enter a valid time (e.g. 2:30 PM or 14:30).';
        }
        break;

      case 'text':
      default:
        // Custom regex validation
        if (validation?.pattern) {
          try {
            if (!new RegExp(validation.pattern).test(value)) {
              return 'Input does not match the expected format.';
            }
          } catch {
            // Invalid regex — skip validation
          }
        }
        break;
    }

    return null; // valid
  }

  private parseValue(value: string, inputType: string): any {
    switch (inputType) {
      case 'number':
        return Number(value);
      default:
        return value.trim();
    }
  }
}
