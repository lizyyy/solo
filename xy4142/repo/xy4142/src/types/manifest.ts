export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  vendor: string;
  pluginType: PluginType;
  wasm: WasmInfo;
  dependencies: Dependency[];
  interfaces: PluginInterfaces;
  capabilities: Capability[];
  constraints: Constraints;
  metadata: Record<string, unknown>;
}

export type PluginType = 'inspection' | 'measurement' | 'classification' | 'quality' | 'custom';

export interface WasmInfo {
  entrypoint: string;
  memoryPages: number;
  features: string[];
}

export interface Dependency {
  name: string;
  version: string;
  required: boolean;
  type: 'runtime' | 'data' | 'library';
}

export interface PluginInterfaces {
  input: InterfaceSpec;
  output: InterfaceSpec;
  lifecycle: LifecycleHooks;
}

export interface InterfaceSpec {
  schemaRef: string;
  schema: Record<string, unknown>;
  format: 'json' | 'binary' | 'protobuf';
}

export interface LifecycleHooks {
  init: boolean;
  cleanup: boolean;
  reset: boolean;
}

export type Capability = 'file_read' | 'file_write' | 'network' | 'clock' | 'random' | 'environment';

export interface Constraints {
  timeoutMs: number;
  memoryPagesMax: number;
  memoryBytesMax: number;
  callStackDepth: number;
  maxTableElements: number;
}
