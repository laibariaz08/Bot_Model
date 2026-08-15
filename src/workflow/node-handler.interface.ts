import type { SendResult, BusinessCredentials } from './channel-adapter.interface';

/**
 * Represents a single node in the workflow graph (deserialized from JSON).
 */
export interface WorkflowNode {
  id: string;
  type: string;
  label: string;
  position: { x: number; y: number };
  config: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Represents an edge connecting two nodes.
 */
export interface WorkflowEdge {
  id: string;
  sourceNodeId: string;
  sourceHandle?: string;
  targetNodeId: string;
  label?: string;
}

/**
 * The parsed incoming message passed to handlers.
 */
export interface IncomingMessage {
  from: string;
  text?: string;
  type: string;           // 'text' | 'interactive' | 'image' | etc.
  buttonId?: string;      // set when type=interactive, button_reply
  listRowId?: string;     // set when type=interactive, list_reply
  messageId: string;
}

/**
 * Execution context available to every handler.
 */
export interface ExecutionContext {
  session: {
    id: string;
    chatId: string;
    businessId: string;
    variables: Record<string, any>;
    retryCount: number;
    maxRetries: number;
  };
  /** The customer's phone number */
  customerPhone: string;
  /** Per-business WhatsApp credentials */
  credentials: BusinessCredentials;
  /** Business name for variable resolution */
  businessName: string;
  /** All nodes in the workflow (for cross-node lookups) */
  nodes: WorkflowNode[];
  /** All edges in the workflow */
  edges: WorkflowEdge[];
}

/**
 * Result returned by a node handler after execution.
 */
export interface NodeResult {
  /**
   * CONTINUE  — move to the next node immediately
   * WAIT      — set session to WAITING_INPUT, stop execution
   * END       — mark session as COMPLETED
   * HANDOVER  — mark session as HANDED_OVER
   * ERROR     — mark session as FAILED
   */
  status: 'CONTINUE' | 'WAIT' | 'END' | 'HANDOVER' | 'ERROR';

  /**
   * Which output handle was used (for branching nodes like buttons, conditions).
   * Defaults to '__default' for single-output nodes.
   */
  outputHandle?: string;

  /**
   * Variables to merge into session.variables.
   */
  variables?: Record<string, any>;

  /**
   * For logging — what the node produced.
   */
  output?: any;

  /**
   * Error message if status is ERROR.
   */
  error?: string;
}

/**
 * Every node type implements this interface.
 */
export interface NodeHandler {
  /**
   * Execute the node's logic.
   *
   * @param node     The node definition (with config)
   * @param ctx      Execution context (session, credentials, etc.)
   * @param input    The incoming message (only present when resuming from WAITING_INPUT)
   */
  execute(
    node: WorkflowNode,
    ctx: ExecutionContext,
    input?: IncomingMessage,
  ): Promise<NodeResult>;
}
