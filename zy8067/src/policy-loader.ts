import { readFile } from 'fs/promises';
import { join } from 'path';
import yaml from 'js-yaml';
import { Policy } from './types.js';

export class PolicyLoader {
  async load(pluginDir: string): Promise<Policy> {
    const policyPath = join(pluginDir, 'policy.yaml');
    const content = await readFile(policyPath, 'utf-8');
    const policy = yaml.load(content) as Policy;
    
    return {
      forbiddenAPIs: policy.forbiddenAPIs || ['fs', 'net', 'http', 'https', 'child_process'],
      maxExecutionTime: policy.maxExecutionTime || 5000,
      allowedGlobals: policy.allowedGlobals || ['console', 'JSON', 'Math', 'Date']
    };
  }
}