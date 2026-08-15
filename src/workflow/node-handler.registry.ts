import { Injectable } from '@nestjs/common';
import type { NodeHandler } from './node-handler.interface';

/**
 * NodeHandlerRegistry
 *
 * Maps node type strings to their handler instances.
 * Handlers register themselves at module init time.
 * The engine looks up handlers by type at runtime.
 */
@Injectable()
export class NodeHandlerRegistry {
  private readonly handlers = new Map<string, NodeHandler>();

  register(type: string, handler: NodeHandler) {
    this.handlers.set(type, handler);
  }

  get(type: string): NodeHandler | undefined {
    return this.handlers.get(type);
  }

  has(type: string): boolean {
    return this.handlers.has(type);
  }

  getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys());
  }
}
