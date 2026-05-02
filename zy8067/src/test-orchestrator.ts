import { ManifestParser } from './manifest-parser.js';
import { FixtureLoader } from './fixture-loader.js';
import { PolicyLoader } from './policy-loader.js';
import { SandboxExecutor } from './sandbox.js';
import { SchemaValidator } from './schema-validator.js';
import { CompatibilityReport, HookExecutionResult } from './types.js';

export class TestOrchestrator {
  private manifestParser: ManifestParser;
  private fixtureLoader: FixtureLoader;
  private policyLoader: PolicyLoader;
  private supportedPlatformVersion: string;

  constructor(supportedPlatformVersion: string = '2.0.0') {
    this.manifestParser = new ManifestParser();
    this.fixtureLoader = new FixtureLoader();
    this.policyLoader = new PolicyLoader();
    this.supportedPlatformVersion = supportedPlatformVersion;
  }

  async run(pluginDir: string): Promise<CompatibilityReport> {
    const manifest = await this.manifestParser.parse(pluginDir);
    const fixtures = await this.fixtureLoader.load(pluginDir);
    const policy = await this.policyLoader.load(pluginDir);

    const sandbox = new SandboxExecutor(policy);
    const schemaValidator = new SchemaValidator();
    const results: HookExecutionResult[] = [];

    for (const fixture of fixtures) {
      const hook = manifest.hooks.find(h => h.id === fixture.hookId);
      if (!hook) {
        results.push({
          hookId: fixture.hookId,
          fixtureName: fixture.name,
          success: false,
          error: `Hook ${fixture.hookId} not found in manifest`,
          duration: 0,
          timedOut: false,
          sideEffectsDetected: false,
          inputValid: false,
          outputValid: false,
          versionCompatible: false
        });
        continue;
      }

      const versionCompatible = this.manifestParser.checkVersionCompatibility(
        manifest,
        this.supportedPlatformVersion
      );

      const inputValidation = schemaValidator.validateInput(hook, fixture.input);

      let executionResult;
      if (inputValidation.valid) {
        executionResult = await sandbox.execute(
          pluginDir,
          hook,
          fixture.input,
          hook.timeout || policy.maxExecutionTime
        );
      } else {
        executionResult = {
          output: undefined,
          duration: 0,
          timedOut: false,
          sideEffectsDetected: false,
          error: 'Invalid input'
        };
      }

      const outputValidation = executionResult.output !== undefined
        ? schemaValidator.validateOutput(hook, executionResult.output)
        : { valid: false };

      const success = versionCompatible &&
        inputValidation.valid &&
        !executionResult.timedOut &&
        !executionResult.sideEffectsDetected &&
        !executionResult.error &&
        outputValidation.valid;

      results.push({
        hookId: hook.id,
        fixtureName: fixture.name,
        success,
        output: executionResult.output,
        error: executionResult.error,
        duration: executionResult.duration,
        timedOut: executionResult.timedOut,
        sideEffectsDetected: executionResult.sideEffectsDetected,
        inputValid: inputValidation.valid,
        outputValid: outputValidation.valid,
        versionCompatible
      });
    }

    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return {
      plugin: {
        name: manifest.name,
        version: manifest.version,
        platformVersion: manifest.platformVersion
      },
      timestamp: new Date().toISOString(),
      summary: {
        total: results.length,
        passed,
        failed,
        warnings: results.filter(r => !r.versionCompatible || r.duration > 3000).length
      },
      results
    };
  }
}