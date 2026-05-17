import * as fs from 'fs';
import * as path from 'path';
import { AnalysisResult, CLIOptions } from '../types';

export class JsonOutput {
  write(result: AnalysisResult, options: CLIOptions): string {
    const outputPath = this.getOutputPath(options);
    this.ensureOutputDir(outputPath);
    
    const json = JSON.stringify(result, null, 2);
    fs.writeFileSync(outputPath, json, 'utf8');
    
    return outputPath;
  }

  private getOutputPath(options: CLIOptions): string {
    if (options.outputJson) {
      return options.outputJson;
    }

    const inputName = path.basename(options.input, path.extname(options.input));
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${inputName}-analysis-${timestamp}.json`;

    if (options.outputDir) {
      return path.join(options.outputDir, filename);
    }

    return path.join(process.cwd(), filename);
  }

  private ensureOutputDir(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

export function writeJsonOutput(result: AnalysisResult, options: CLIOptions): string {
  const output = new JsonOutput();
  return output.write(result, options);
}
