import * as crypto from 'crypto';
import { SecretRule, Finding, FindingLocation } from '../types';
import { ValueNode } from '../utils/yaml-parser';

export interface ScanContext {
  filePath: string;
  rules: SecretRule[];
  verbose: boolean;
}

export function isBase64(str: string): boolean {
  if (str.length < 8) return false;
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(str)) return false;
  if (str.length % 4 !== 0) return false;
  
  try {
    const decoded = Buffer.from(str, 'base64').toString('utf-8');
    const reEncoded = Buffer.from(decoded, 'utf-8').toString('base64');
    return reEncoded === str || str.replace(/=+$/, '') === reEncoded.replace(/=+$/, '');
  } catch {
    return false;
  }
}

export function tryDecodeBase64(str: string): { decoded: string; isBase64: boolean } {
  try {
    const decoded = Buffer.from(str, 'base64').toString('utf-8');
    const isPrintable = /^[\x20-\x7E\n\r\t]*$/.test(decoded);
    if (isPrintable && decoded.length > 0) {
      return { decoded, isBase64: true };
    }
  } catch {
  }
  return { decoded: str, isBase64: false };
}

function generateFindingId(): string {
  return 'finding_' + crypto.randomBytes(8).toString('hex');
}

export function scanValue(
  valueNode: ValueNode,
  context: ScanContext,
  alreadyDecoded = false
): Finding[] {
  const findings: Finding[] = [];
  const { value, path } = valueNode;

  if (!alreadyDecoded && isBase64(value)) {
    const { decoded, isBase64 } = tryDecodeBase64(value);
    if (isBase64 && decoded !== value) {
      const decodedFindings = scanValue(
        { value: decoded, path, line: valueNode.line },
        context,
        true
      );
      
      for (const finding of decodedFindings) {
        finding.isBase64Encoded = true;
        finding.decodedValue = decoded;
        finding.matchedValue = value;
        finding.evidence = `Base64 解码后: ${decoded.substring(0, 100)}${decoded.length > 100 ? '...' : ''}`;
        findings.push(finding);
      }
    }
  }

  for (const rule of context.rules) {
    try {
      const regex = new RegExp(rule.pattern, 'gi');
      let match: RegExpExecArray | null;
      
      while ((match = regex.exec(value)) !== null) {
        const matchedValue = match[0];
        
        if (matchedValue.length < 4) continue;
        
        const location: FindingLocation = {
          file: context.filePath,
          path: path,
          line: valueNode.line,
          column: match.index
        };

        const finding: Finding = {
          id: generateFindingId(),
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          category: rule.category,
          description: rule.description,
          location,
          matchedValue: matchedValue.substring(0, 200),
          evidence: `路径 ${path} 中发现匹配: "${matchedValue.substring(0, 50)}${matchedValue.length > 50 ? '...' : ''}"`
        };

        if (!findings.some(f => 
          f.ruleId === finding.ruleId && 
          f.location.path === finding.location.path &&
          f.matchedValue === finding.matchedValue
        )) {
          findings.push(finding);
        }
      }
    } catch (e) {
      if (context.verbose) {
        console.warn(`规则 ${rule.id} 执行错误: ${(e as Error).message}`);
      }
    }
  }

  return findings;
}

export function scanContent(
  content: string,
  context: ScanContext,
  basePath = ''
): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split('\n');

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    
    const base64Regex = /([A-Za-z0-9+/]{16,}={0,2})/g;
    let base64Match: RegExpExecArray | null;
    
    while ((base64Match = base64Regex.exec(line)) !== null) {
      const candidate = base64Match[1];
      if (isBase64(candidate)) {
        const { decoded, isBase64 } = tryDecodeBase64(candidate);
        if (isBase64 && decoded.length > 5) {
          const decodedFindings = scanValue(
            { value: decoded, path: basePath || 'content', line: lineNum + 1 },
            context,
            true
          );
          
          for (const finding of decodedFindings) {
            finding.isBase64Encoded = true;
            finding.decodedValue = decoded;
            finding.matchedValue = candidate;
            finding.location.line = lineNum + 1;
            finding.location.column = base64Match.index;
            finding.evidence = `第 ${lineNum + 1} 行 Base64 解码后发现敏感信息: ${decoded.substring(0, 80)}...`;
            findings.push(finding);
          }
        }
      }
    }

    for (const rule of context.rules) {
      try {
        const regex = new RegExp(rule.pattern, 'gi');
        let match: RegExpExecArray | null;
        
        while ((match = regex.exec(line)) !== null) {
          const matchedValue = match[0];
          
          if (matchedValue.length < 4) continue;

          const location: FindingLocation = {
            file: context.filePath,
            path: basePath || 'content',
            line: lineNum + 1,
            column: match.index
          };

          const finding: Finding = {
            id: generateFindingId(),
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            category: rule.category,
            description: rule.description,
            location,
            matchedValue: matchedValue.substring(0, 200),
            evidence: `第 ${lineNum + 1} 行发现敏感内容: "${matchedValue.substring(0, 60)}${matchedValue.length > 60 ? '...' : ''}"`
          };

          if (!findings.some(f => 
            f.ruleId === finding.ruleId && 
            f.location.line === finding.location.line &&
            f.location.column === finding.location.column
          )) {
            findings.push(finding);
          }
        }
      } catch (e) {
        if (context.verbose) {
          console.warn(`规则 ${rule.id} 执行错误: ${(e as Error).message}`);
        }
      }
    }
  }

  return findings;
}

export function scanValueNodes(
  valueNodes: ValueNode[],
  context: ScanContext
): Finding[] {
  const findings: Finding[] = [];

  for (const node of valueNodes) {
    const nodeFindings = scanValue(node, context);
    findings.push(...nodeFindings);
  }

  return findings;
}
