/**
 * MCP tool contract
 */

export interface ToolAnnotation {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export type ToolSchema = {
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
  properties?: Record<string, ToolSchema>;
  items?: ToolSchema;
  required?: string[];
  examples?: unknown[];
  allOf?: ToolSchema[];
  anyOf?: ToolSchema[];
  oneOf?: ToolSchema[];
  if?: ToolSchema;
  then?: ToolSchema;
  else?: ToolSchema;
  enum?: unknown[];
  const?: unknown;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  description?: string;
  default?: unknown;
};

export type ToolInputSchema = ToolSchema & {
  type: 'object';
  properties: Record<string, ToolSchema>;
};

export type ToolOutputSchema = {
  type: 'object';
  properties: Record<string, unknown>;
};

export interface ToolDefinition {
  name: string;
  title?: string;
  description: string;
  inputSchema: ToolInputSchema;
  annotations?: ToolAnnotation;
}

export type ListedToolDefinition = ToolDefinition & {
  title: string;
  outputSchema: ToolOutputSchema;
};

export type RenderOptions = {
  detailLevel?: 'default' | 'more' | 'full';
} & Record<string, unknown>;

export type TransportDetailLevel = 'default' | 'more' | 'full';

export interface ToolContract<TInput = unknown, TOutput = unknown, TOptions extends RenderOptions = RenderOptions> {
  definition: ToolDefinition;
  execute: (input: TInput) => TOutput | Promise<TOutput>;
  renderText: (result: TOutput, options?: TOptions) => string;
  renderJSON: (result: TOutput, options?: TOptions) => unknown;
  outputSchema: ToolOutputSchema;
  mergeRuntimeExtras?: (canonicalJSON: unknown, rawResult: unknown) => unknown;
}

export function defineToolContract<TInput, TOutput, TOptions extends RenderOptions = RenderOptions>(
  contract: ToolContract<TInput, TOutput, TOptions>,
): ToolContract<TInput, TOutput, TOptions> {
  return contract;
}

export function normalizeTransportDetailLevel(detailLevel: unknown): TransportDetailLevel {
  if (detailLevel === 'full') return 'full';
  if (detailLevel === 'more') return 'more';
  return 'default';
}

export function mergePlaceResolutionInfo(canonicalJSON: unknown, rawResult: unknown): unknown {
  if (typeof canonicalJSON !== 'object' || canonicalJSON === null) return canonicalJSON;
  if (typeof rawResult !== 'object' || rawResult === null) return canonicalJSON;
  if (!('placeResolutionInfo' in rawResult)) return canonicalJSON;

  return {
    ...canonicalJSON,
    placeResolutionInfo: (rawResult as { placeResolutionInfo?: unknown }).placeResolutionInfo,
  };
}
