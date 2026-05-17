import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';
import { TemplateManifest } from './types';

export class TemplateLoader {
  async load(templatePath: string): Promise<TemplateManifest> {
    const manifestPath = path.join(templatePath, 'scaffold-manifest.json');
    const manifestPathYaml = path.join(templatePath, 'scaffold-manifest.yaml');
    
    let manifest: TemplateManifest;
    
    if (await fs.pathExists(manifestPath)) {
      const content = await fs.readFile(manifestPath, 'utf-8');
      manifest = JSON.parse(content);
    } else if (await fs.pathExists(manifestPathYaml)) {
      const content = await fs.readFile(manifestPathYaml, 'utf-8');
      manifest = yaml.load(content) as TemplateManifest;
    } else {
      throw new Error(`Template manifest not found in ${templatePath}`);
    }
    
    if (!manifest.files) manifest.files = [];
    if (!manifest.configs) manifest.configs = [];
    
    return manifest;
  }

  async getTemplateFileContent(templatePath: string, filePath: string): Promise<string | null> {
    const fullPath = path.join(templatePath, filePath);
    if (await fs.pathExists(fullPath)) {
      return await fs.readFile(fullPath, 'utf-8');
    }
    return null;
  }
}
