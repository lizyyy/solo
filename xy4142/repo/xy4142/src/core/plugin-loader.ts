import * as fs from 'fs-extra';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { PluginManifest, Capability } from '../types';
import { createLogger } from '../utils/logger';
import { PluginLoadError, ManifestValidationError, CapabilityError } from '../utils/error';
import { checkVersionCompatibility, parseSemver } from '../utils/version';

const logger = createLogger('plugin-loader');

export interface LoadedPlugin {
  id: string;
  manifest: PluginManifest;
  wasmBuffer: Buffer;
  wasmPath: string;
  pluginDir: string;
  loadedAt: number;
}

export interface PluginLoadOptions {
  validateManifest?: boolean;
  validateCapabilities?: boolean;
  allowedCapabilities?: Capability[];
  systemVersion?: string;
  maxWasmSizeBytes?: number;
}

const DEFAULT_OPTIONS: Required<PluginLoadOptions> = {
  validateManifest: true,
  validateCapabilities: true,
  allowedCapabilities: [],
  systemVersion: '1.0.0',
  maxWasmSizeBytes: 100 * 1024 * 1024
};

const MANIFEST_SCHEMA = {
  type: 'object',
  required: ['id', 'name', 'version', 'pluginType', 'wasm', 'interfaces', 'constraints'],
  properties: {
    id: { type: 'string', minLength: 1 },
    name: { type: 'string', minLength: 1 },
    version: { type: 'string' },
    description: { type: 'string' },
    author: { type: 'string' },
    vendor: { type: 'string' },
    pluginType: {
      enum: ['inspection', 'measurement', 'classification', 'quality', 'custom']
    },
    wasm: {
      type: 'object',
      required: ['entrypoint'],
      properties: {
        entrypoint: { type: 'string' },
        memoryPages: { type: 'number', minimum: 1 },
        features: { type: 'array', items: { type: 'string' } }
      }
    },
    dependencies: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'version'],
        properties: {
          name: { type: 'string' },
          version: { type: 'string' },
          required: { type: 'boolean' },
          type: { enum: ['runtime', 'data', 'library'] }
        }
      }
    },
    interfaces: {
      type: 'object',
      required: ['input', 'output'],
      properties: {
        input: {
          type: 'object',
          required: ['format'],
          properties: {
            schemaRef: { type: 'string' },
            schema: { type: 'object' },
            format: { enum: ['json', 'binary', 'protobuf'] }
          }
        },
        output: {
          type: 'object',
          required: ['format'],
          properties: {
            schemaRef: { type: 'string' },
            schema: { type: 'object' },
            format: { enum: ['json', 'binary', 'protobuf'] }
          }
        },
        lifecycle: {
          type: 'object',
          properties: {
            init: { type: 'boolean' },
            cleanup: { type: 'boolean' },
            reset: { type: 'boolean' }
          }
        }
      }
    },
    capabilities: {
      type: 'array',
      items: {
        enum: ['file_read', 'file_write', 'network', 'clock', 'random', 'environment']
      }
    },
    constraints: {
      type: 'object',
      required: ['timeoutMs', 'memoryPagesMax'],
      properties: {
        timeoutMs: { type: 'number', minimum: 1 },
        memoryPagesMax: { type: 'number', minimum: 1 },
        memoryBytesMax: { type: 'number', minimum: 0 },
        callStackDepth: { type: 'number', minimum: 1 },
        maxTableElements: { type: 'number', minimum: 0 }
      }
    },
    metadata: { type: 'object' }
  }
};

export class PluginLoader {
  private options: Required<PluginLoadOptions>;

  constructor(options?: PluginLoadOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async loadFromDirectory(pluginDir: string): Promise<LoadedPlugin> {
    logger.info(`Loading plugin from directory: ${pluginDir}`);

    const stat = await fs.stat(pluginDir);
    if (!stat.isDirectory()) {
      throw new PluginLoadError(`Path is not a directory: ${pluginDir}`);
    }

    const manifestPath = path.join(pluginDir, 'manifest.json');
    const manifest = await this.loadManifest(manifestPath);

    if (this.options.validateManifest) {
      this.validateManifest(manifest);
    }

    if (this.options.validateCapabilities) {
      this.validateCapabilities(manifest);
    }

    const wasmPath = path.join(pluginDir, manifest.wasm.entrypoint);
    const wasmBuffer = await this.loadWasmFile(wasmPath);

    const loadedPlugin: LoadedPlugin = {
      id: manifest.id,
      manifest,
      wasmBuffer,
      wasmPath,
      pluginDir,
      loadedAt: Date.now()
    };

    logger.info(`Successfully loaded plugin: ${manifest.id} v${manifest.version}`);
    return loadedPlugin;
  }

  async loadFromManifest(manifestPath: string): Promise<LoadedPlugin> {
    logger.info(`Loading plugin from manifest: ${manifestPath}`);

    const manifest = await this.loadManifest(manifestPath);

    if (this.options.validateManifest) {
      this.validateManifest(manifest);
    }

    if (this.options.validateCapabilities) {
      this.validateCapabilities(manifest);
    }

    const pluginDir = path.dirname(manifestPath);
    const wasmPath = path.join(pluginDir, manifest.wasm.entrypoint);
    const wasmBuffer = await this.loadWasmFile(wasmPath);

    const loadedPlugin: LoadedPlugin = {
      id: manifest.id,
      manifest,
      wasmBuffer,
      wasmPath,
      pluginDir,
      loadedAt: Date.now()
    };

    logger.info(`Successfully loaded plugin: ${manifest.id} v${manifest.version}`);
    return loadedPlugin;
  }

  private async loadManifest(manifestPath: string): Promise<PluginManifest> {
    try {
      const content = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(content) as PluginManifest;

      if (manifest.constraints.memoryBytesMax === undefined && manifest.constraints.memoryPagesMax) {
        manifest.constraints.memoryBytesMax = manifest.constraints.memoryPagesMax * 64 * 1024;
      }

      return manifest;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new ManifestValidationError(`Invalid JSON in manifest: ${manifestPath}`, {
          error: error.message
        });
      }
      throw new PluginLoadError(`Failed to load manifest: ${manifestPath}`, {
        error: (error as Error).message
      });
    }
  }

  private validateManifest(manifest: PluginManifest): void {
    logger.debug(`Validating manifest: ${manifest.id}`);

    try {
      parseSemver(manifest.version);
    } catch (error) {
      throw new ManifestValidationError(`Invalid version format: ${manifest.version}`, {
        version: manifest.version
      });
    }

    const versionCheck = checkVersionCompatibility(
      manifest.version,
      this.options.systemVersion
    );

    if (!versionCheck.compatible) {
      throw new ManifestValidationError(versionCheck.reason || 'Version incompatibility', {
        pluginVersion: versionCheck.pluginVersion,
        systemVersion: versionCheck.systemVersion,
        recommendedAction: versionCheck.recommendedAction
      });
    }

    this.validateManifestStructure(manifest);
    logger.debug(`Manifest validation passed: ${manifest.id}`);
  }

  private validateManifestStructure(manifest: PluginManifest): void {
    const requiredFields = ['id', 'name', 'version', 'pluginType', 'wasm', 'interfaces', 'constraints'];
    const missingFields = requiredFields.filter(field => !(field in manifest));

    if (missingFields.length > 0) {
      throw new ManifestValidationError(`Missing required fields: ${missingFields.join(', ')}`, {
        missingFields
      });
    }

    if (!manifest.wasm.entrypoint) {
      throw new ManifestValidationError('WASM entrypoint is required');
    }

    if (manifest.constraints.timeoutMs <= 0) {
      throw new ManifestValidationError('timeoutMs must be a positive number');
    }

    if (manifest.constraints.memoryPagesMax <= 0) {
      throw new ManifestValidationError('memoryPagesMax must be a positive number');
    }
  }

  private validateCapabilities(manifest: PluginManifest): void {
    const requestedCapabilities = manifest.capabilities || [];
    const allowed = this.options.allowedCapabilities;

    const disallowed = requestedCapabilities.filter(cap => !allowed.includes(cap));

    if (disallowed.length > 0) {
      throw new CapabilityError(
        disallowed[0],
        `Plugin requests disallowed capabilities: ${disallowed.join(', ')}`,
        {
          requested: requestedCapabilities,
          allowed,
          disallowed
        }
      );
    }

    if (requestedCapabilities.includes('file_read') || requestedCapabilities.includes('file_write')) {
      logger.warn(`Plugin requests file system access. Ensure this is necessary.`);
    }

    logger.debug(`Capability validation passed. Requested: ${requestedCapabilities.join(', ') || 'none'}`);
  }

  private async loadWasmFile(wasmPath: string): Promise<Buffer> {
    try {
      const stat = await fs.stat(wasmPath);

      if (stat.size > this.options.maxWasmSizeBytes) {
        throw new PluginLoadError(
          `WASM file exceeds maximum allowed size: ${stat.size} bytes (max: ${this.options.maxWasmSizeBytes} bytes)`,
          {
            wasmPath,
            size: stat.size,
            maxSize: this.options.maxWasmSizeBytes
          }
        );
      }

      const buffer = await fs.readFile(wasmPath);

      if (!this.isValidWasmModule(buffer)) {
        throw new PluginLoadError(`Invalid WASM module: ${wasmPath}`, { wasmPath });
      }

      logger.debug(`Loaded WASM file: ${wasmPath} (${stat.size} bytes)`);
      return buffer;
    } catch (error) {
      if (error instanceof PluginLoadError) {
        throw error;
      }
      throw new PluginLoadError(`Failed to load WASM file: ${wasmPath}`, {
        error: (error as Error).message
      });
    }
  }

  private isValidWasmModule(buffer: Buffer): boolean {
    const wasmMagic = [0x00, 0x61, 0x73, 0x6d];
    const wasmVersion = [0x01, 0x00, 0x00, 0x00];

    if (buffer.length < 8) {
      return false;
    }

    for (let i = 0; i < 4; i++) {
      if (buffer[i] !== wasmMagic[i]) {
        return false;
      }
    }

    for (let i = 0; i < 4; i++) {
      if (buffer[4 + i] !== wasmVersion[i]) {
        return false;
      }
    }

    return true;
  }
}

export async function loadPlugin(
  pluginPath: string,
  options?: PluginLoadOptions
): Promise<LoadedPlugin> {
  const loader = new PluginLoader(options);
  const stat = await fs.stat(pluginPath);

  if (stat.isDirectory()) {
    return loader.loadFromDirectory(pluginPath);
  } else if (pluginPath.endsWith('manifest.json')) {
    return loader.loadFromManifest(pluginPath);
  }

  throw new PluginLoadError(`Invalid plugin path: ${pluginPath}. Expected directory or manifest.json.`);
}
