import { parseCassette } from './parsers/cassette-parser';
import { DiffEngine } from './diff/diff-engine';
import { getDefaultConfig, loadConfigFromFile } from './masking/masking-engine';
import { TerminalReporter } from './reporters/terminal-reporter';
import { JsonReporter } from './reporters/json-reporter';
import { MarkdownReporter } from './reporters/markdown-reporter';
import { DiffConfig, DiffResult, CLIOptions, ExitCodes } from './types';
import * as fs from 'fs';
import * as path from 'path';

export interface CompareOptions {
  expectedFile: string;
  actualFile: string;
  config?: DiffConfig;
  configFile?: string;
  outputDir?: string;
  ignoreOrder?: boolean;
  ignoreFields?: string[];
  format?: 'text' | 'json' | 'markdown' | 'all';
  verbose?: boolean;
  quiet?: boolean;
}

export async function compareCassettes(
  options: CompareOptions
): Promise<{ result: DiffResult; exitCode: number }> {
  let config: DiffConfig;
  
  if (options.config) {
    config = options.config;
  } else if (options.configFile) {
    try {
      config = loadConfigFromFile(options.configFile);
    } catch (error) {
      throw {
        message: `配置文件加载失败: ${(error as Error).message}`,
        code: ExitCodes.CONFIG_ERROR
      };
    }
  } else {
    config = getDefaultConfig();
  }

  if (options.ignoreOrder !== undefined) {
    config.ignoreOrder = options.ignoreOrder;
  }
  if (options.ignoreFields && options.ignoreFields.length > 0) {
    config.ignoreFields = [...new Set([...config.ignoreFields, ...options.ignoreFields])];
  }

  let expected, actual;
  
  try {
    expected = await parseCassette(options.expectedFile);
  } catch (error: any) {
    throw {
      message: `解析期望文件失败: ${error.message}`,
      code: error.code || ExitCodes.PARSE_ERROR,
      line: error.line
    };
  }

  try {
    actual = await parseCassette(options.actualFile);
  } catch (error: any) {
    throw {
      message: `解析实际文件失败: ${error.message}`,
      code: error.code || ExitCodes.PARSE_ERROR,
      line: error.line
    };
  }

  const diffEngine = new DiffEngine(config);
  const result = diffEngine.compare(expected, actual);

  const outputDir = options.outputDir || process.cwd();
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const format = options.format || 'text';

  if (!options.quiet) {
    const terminalReporter = new TerminalReporter(
      result,
      outputDir,
      options.expectedFile,
      options.actualFile,
      options.verbose
    );
    console.log(terminalReporter.generate());
  }

  if (format === 'json' || format === 'all') {
    const jsonReporter = new JsonReporter(
      result,
      outputDir,
      options.expectedFile,
      options.actualFile
    );
    const jsonPath = path.join(outputDir, 'cassette-diff.json');
    fs.writeFileSync(jsonPath, jsonReporter.generate(), 'utf-8');
    if (!options.quiet) {
      console.log(`\n📄 JSON 报告已保存: ${jsonPath}`);
    }
  }

  if (format === 'markdown' || format === 'all') {
    const mdReporter = new MarkdownReporter(
      result,
      outputDir,
      options.expectedFile,
      options.actualFile
    );
    const mdPath = path.join(outputDir, 'cassette-diff.md');
    fs.writeFileSync(mdPath, mdReporter.generate(), 'utf-8');
    if (!options.quiet) {
      console.log(`📄 Markdown 报告已保存: ${mdPath}`);
    }
  }

  return { result, exitCode: result.exitCode };
}

export { parseCassette };
export { DiffEngine };
export { getDefaultConfig, loadConfigFromFile };
export * from './types';
