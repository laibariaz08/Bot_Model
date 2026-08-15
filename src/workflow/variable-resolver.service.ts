import { Injectable } from '@nestjs/common';

/**
 * VariableResolver
 *
 * Resolves {{namespace.variable}} expressions in message strings.
 *
 * Namespaces:
 *   customer.*  — from contact/chat metadata (name, phone, email)
 *   workflow.*  — values collected during flow execution (ask_question, set_variable)
 *   system.*    — system-provided values (current_date, current_time, business_name)
 *   message.*   — current incoming message (text, type, button_id)
 *   ai.*        — values extracted by ai_response nodes
 */

export interface ResolveContext {
  /** Runtime variables stored on WorkflowSession.variables */
  sessionVariables: Record<string, any>;

  /** Customer info */
  customer: {
    name?: string;
    phone?: string;
    email?: string;
  };

  /** Current incoming message */
  message: {
    text?: string;
    type?: string;
    buttonId?: string;
  };

  /** Business / system info */
  system: {
    businessName?: string;
  };
}

// Matches {{namespace.variable}} — greedy-safe, allows nested dots
const VAR_PATTERN = /\{\{([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\}\}/g;

@Injectable()
export class VariableResolver {
  /**
   * Replace all {{namespace.variable}} tokens in `text` with their
   * resolved values. Unresolved variables become empty string.
   * Returns { result, unresolved[] } so callers can log warnings.
   */
  resolve(
    text: string,
    ctx: ResolveContext,
  ): { result: string; unresolved: string[] } {
    const unresolved: string[] = [];

    const result = text.replace(VAR_PATTERN, (match, path: string) => {
      const value = this.lookup(path, ctx);
      if (value === undefined || value === null) {
        unresolved.push(path);
        return '';
      }
      return String(value);
    });

    return { result, unresolved };
  }

  /**
   * Convenience — resolve and return just the string (ignoring unresolved list).
   */
  resolveText(text: string, ctx: ResolveContext): string {
    return this.resolve(text, ctx).result;
  }

  /** Build a ResolveContext from raw session + incoming data */
  buildContext(
    sessionVariables: Record<string, any>,
    customer: { name?: string; phone?: string; email?: string },
    message: { text?: string; type?: string; buttonId?: string },
    businessName?: string,
  ): ResolveContext {
    return {
      sessionVariables,
      customer,
      message,
      system: { businessName },
    };
  }

  // ─── Internal ─────────────────────────────────────────

  private lookup(path: string, ctx: ResolveContext): any {
    const [namespace, ...rest] = path.split('.');
    const key = rest.join('.');

    switch (namespace) {
      case 'customer':
        return this.getNestedValue(ctx.customer, key);

      case 'workflow':
        return this.getNestedValue(ctx.sessionVariables, key);

      case 'system':
        return this.resolveSystemVar(key, ctx);

      case 'message':
        return this.resolveMessageVar(key, ctx);

      case 'ai':
        // AI-extracted variables are stored in session variables under ai.* keys
        return this.getNestedValue(ctx.sessionVariables, `ai.${key}`) ??
               this.getNestedValue(ctx.sessionVariables, key);

      default:
        // Try as a flat key in session variables
        return this.getNestedValue(ctx.sessionVariables, path);
    }
  }

  private resolveSystemVar(key: string, ctx: ResolveContext): any {
    switch (key) {
      case 'current_date':
        return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      case 'current_time':
        return new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
      case 'business_name':
        return ctx.system.businessName;
      default:
        return undefined;
    }
  }

  private resolveMessageVar(key: string, ctx: ResolveContext): any {
    switch (key) {
      case 'text':
        return ctx.message.text;
      case 'type':
        return ctx.message.type;
      case 'button_id':
        return ctx.message.buttonId;
      default:
        return undefined;
    }
  }

  private getNestedValue(obj: any, path: string): any {
    if (!obj || !path) return undefined;
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    return current;
  }
}
