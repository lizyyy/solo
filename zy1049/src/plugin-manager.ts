import * as fs from 'fs/promises';
import * as path from 'path';
import { PluginInfo, PluginManifest, Permission } from './types';

const VALID_PERMISSIONS: Permission[] = [
  'fs:read',
  'fs:write',
  'fs:delete',
  'network:fetch',
  'network:http',
  'env:read',
  'env:write',
  'event:subscribe',
  'event:publish',
  'process:spawn',
  'process:exec',
];

export class PluginManager {
  private pluginsDir: string;

  constructor(pluginsDir: string) {
    this.pluginsDir = pluginsDir;
  }

  async discoverPlugins(): Promise<PluginInfo[]> {
    const plugins: PluginInfo[] = [];
    
    try {
      const entries = await fs.readdir(this.pluginsDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pluginPath = path.join(this.pluginsDir, entry.name);
          const pluginInfo = await this.loadPluginInfo(pluginPath);
          plugins.push(pluginInfo);
        }
      }
    } catch (error) {
      console.error(`Error discovering plugins in ${this.pluginsDir}:`, error);
    }

    return plugins;
  }

  private async loadPluginInfo(pluginPath: string): Promise<PluginInfo> {
    const name = path.basename(pluginPath);
    const manifestPath = path.join(pluginPath, 'manifest.json');
    const validationErrors: string[] = [];
    let manifest: PluginManifest | null = null;
    let mainPath = '';

    try {
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      manifest = JSON.parse(manifestContent) as PluginManifest;
      
      const validation = this.validateManifest(manifest);
      if (!validation.valid) {
        validationErrors.push(...validation.errors);
      } else {
        mainPath = path.resolve(pluginPath, manifest.main);
        try {
          await fs.access(mainPath);
        } catch {
          validationErrors.push(`Main file not found: ${manifest.main}`);
        }
      }
    } catch (error) {
      validationErrors.push(`Failed to read or parse manifest.json: ${(error as Error).message}`);
    }

    return {
      name,
      version: manifest?.version || '0.0.0',
      path: pluginPath,
      manifestPath,
      mainPath,
      manifest: manifest || {
        name,
        version: '0.0.0',
        description: '',
        main: '',
        permissions: [],
      },
      manifestValid: validationErrors.length === 0,
      validationErrors,
    };
  }

  private validateManifest(manifest: PluginManifest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!manifest.name || typeof manifest.name !== 'string') {
      errors.push('Manifest must have a "name" field (string)');
    }

    if (!manifest.version || typeof manifest.version !== 'string') {
      errors.push('Manifest must have a "version" field (string)');
    }

    if (manifest.description !== undefined && typeof manifest.description !== 'string') {
      errors.push('"description" must be a string');
    }

    if (!manifest.main || typeof manifest.main !== 'string') {
      errors.push('Manifest must have a "main" field (string) pointing to the entry script');
    }

    if (!Array.isArray(manifest.permissions)) {
      errors.push('"permissions" must be an array');
    } else {
      for (const perm of manifest.permissions) {
        if (!VALID_PERMISSIONS.includes(perm as Permission)) {
          errors.push(`Invalid permission: "${perm}". Valid permissions: ${VALID_PERMISSIONS.join(', ')}`);
        }
      }

      const seen = new Set<Permission>();
      for (const perm of manifest.permissions) {
        if (seen.has(perm as Permission)) {
          errors.push(`Duplicate permission: "${perm}"`);
        }
        seen.add(perm as Permission);
      }
    }

    if (manifest.timeout !== undefined) {
      if (typeof manifest.timeout !== 'number' || manifest.timeout < 0) {
        errors.push('"timeout" must be a non-negative number (milliseconds)');
      }
    }

    if (manifest.metadata !== undefined && typeof manifest.metadata !== 'object') {
      errors.push('"metadata" must be an object');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async getPluginByName(name: string): Promise<PluginInfo | null> {
    const plugins = await this.discoverPlugins();
    return plugins.find(p => p.name === name) || null;
  }

  getValidPermissions(): Permission[] {
    return [...VALID_PERMISSIONS];
  }
}

export default PluginManager;
