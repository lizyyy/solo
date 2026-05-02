import { readFile } from 'fs/promises';
import { join } from 'path';
import { PluginManifest } from './types.js';

export class ManifestParser {
  async parse(pluginDir: string): Promise<PluginManifest> {
    const manifestPath = join(pluginDir, 'plugin-manifest.json');
    const content = await readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(content) as PluginManifest;
    
    this.validateManifest(manifest);
    return manifest;
  }

  private validateManifest(manifest: PluginManifest): void {
    if (!manifest.name || typeof manifest.name !== 'string') {
      throw new Error('Manifest must have a valid name');
    }
    if (!manifest.version || typeof manifest.version !== 'string') {
      throw new Error('Manifest must have a valid version');
    }
    if (!manifest.platformVersion || typeof manifest.platformVersion !== 'string') {
      throw new Error('Manifest must have a valid platformVersion');
    }
    if (!Array.isArray(manifest.hooks)) {
      throw new Error('Manifest hooks must be an array');
    }
    
    manifest.hooks.forEach((hook, index) => {
      if (!hook.id || typeof hook.id !== 'string') {
        throw new Error(`Hook ${index} must have a valid id`);
      }
      if (!hook.entry || typeof hook.entry !== 'string') {
        throw new Error(`Hook ${hook.id} must have a valid entry`);
      }
      if (!hook.inputSchema || typeof hook.inputSchema !== 'object') {
        throw new Error(`Hook ${hook.id} must have a valid inputSchema`);
      }
      if (!hook.outputSchema || typeof hook.outputSchema !== 'object') {
        throw new Error(`Hook ${hook.id} must have a valid outputSchema`);
      }
    });
  }

  checkVersionCompatibility(manifest: PluginManifest, supportedVersion: string): boolean {
    const manifestMajor = parseInt(manifest.platformVersion.split('.')[0] || '0');
    const supportedMajor = parseInt(supportedVersion.split('.')[0] || '0');
    return manifestMajor === supportedMajor;
  }
}