import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { RulesFile, SamplesFile, SampleSeries } from "../types";

export class FileReader {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  read(): { content: string; lines: string[] } {
    const content = fs.readFileSync(this.filePath, "utf-8");
    const lines = content.split("\n");
    return { content, lines };
  }

  parseYaml(): RulesFile {
    const { content } = this.read();
    const parsed = yaml.load(content) as RulesFile;
    
    if (!parsed.groups) {
      throw new Error("Invalid Prometheus rules file: missing groups field");
    }
    
    return parsed;
  }

  findRuleLineNumber(ruleName: string, groupName: string): number | undefined {
    const { lines } = this.read();
    let inGroup = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.includes(`name: ${groupName}`)) {
        inGroup = true;
      }
      
      if (inGroup && line.includes(`alert: ${ruleName}`)) {
        return i + 1;
      }
      
      if (inGroup && line.match(/^\s*- name:/) && !line.includes(groupName)) {
        break;
      }
    }
    
    return undefined;
  }

  parseSamplesYaml(): SampleSeries[] {
    const { content } = this.read();
    const parsed = yaml.load(content) as SamplesFile;
    
    if (!parsed.samples || !Array.isArray(parsed.samples)) {
      throw new Error("Invalid samples file: missing 'samples' array field");
    }
    
    return parsed.samples;
  }
}

export function resolveInputPath(inputPath: string): string[] {
  const resolved = path.resolve(inputPath);
  
  if (fs.statSync(resolved).isDirectory()) {
    return fs.readdirSync(resolved)
      .filter(f => f.endsWith(".yml") || f.endsWith(".yaml"))
      .map(f => path.join(resolved, f));
  }
  
  return [resolved];
}
