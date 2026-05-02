import { readFile } from 'fs/promises';
import { join } from 'path';
import { VM } from 'vm2';
import { HookDefinition, Policy } from './types.js';

export class SandboxExecutor {
  private policy: Policy;

  constructor(policy: Policy) {
    this.policy = policy;
  }

  async execute(
    pluginDir: string,
    hook: HookDefinition,
    input: any,
    timeout: number = 5000
  ): Promise<{ output: any; duration: number; timedOut: boolean; sideEffectsDetected: boolean; error?: string }> {
    const startTime = Date.now();
    let timedOut = false;
    let sideEffectsDetected = false;
    let output: any = undefined;
    let error: string | undefined = undefined;

    try {
      const hookPath = join(pluginDir, hook.entry);
      const hookCode = await readFile(hookPath, 'utf-8');

      const vm = new VM({
        timeout: timeout,
        sandbox: {
          input,
          console: {
            log: () => {},
            warn: () => {},
            error: () => {}
          },
          JSON,
          Math,
          Date
        }
      });

      const wrapperCode = `
        ${hookCode}
        handler(input);
      `;

      output = vm.run(wrapperCode);
    } catch (err: any) {
      if (err.message && err.message.includes('Script execution timed out')) {
        timedOut = true;
        error = 'Execution timed out';
      } else if (err.message && (err.message.includes('Cannot access') || err.message.includes('is not defined'))) {
        sideEffectsDetected = true;
        error = `Forbidden API access: ${err.message}`;
      } else {
        error = err.message || String(err);
      }
    }

    const duration = Date.now() - startTime;

    return {
      output,
      duration,
      timedOut,
      sideEffectsDetected,
      error
    };
  }
}