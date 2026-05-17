import * as fs from 'fs';
import * as path from 'path';
import { TestFailure, ParseResult } from './types';
import { createHash } from 'crypto';

function generateId(...parts: string[]): string {
  return createHash('md5').update(parts.join('|')).digest('hex').slice(0, 12);
}

export function parseLogFile(filePath: string): ParseResult {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  const successes: TestFailure[] = [];
  const errors: ParseResult['errors'] = [];
  
  let currentFailure: Partial<TestFailure> = {};
  let inStackTrace = false;
  let stackLines: string[] = [];
  let failureStartLine = 0;
  let lastFailureEndLine = 0;
  let suspiciousLines: {line: number, content: string}[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    if (line.includes('TEST FAILED') || line.includes('FAIL:') || line.includes('✗')) {
      if (suspiciousLines.length > 0) {
        for (const sl of suspiciousLines) {
          errors.push({
            line: sl.line,
            content: sl.content,
            reason: 'Suspicious content between test failure entries'
          });
        }
        suspiciousLines = [];
      }
      
      if (currentFailure.testName) {
        finishCurrentFailure();
      }
      currentFailure = {};
      stackLines = [];
      inStackTrace = false;
      failureStartLine = lineNum;
      continue;
    }
    
    if (failureStartLine === 0 && line.trim() !== '') {
      if (line.toLowerCase().includes('error') || line.toLowerCase().includes('fail')) {
        errors.push({
          line: lineNum,
          content: line,
          reason: 'Potential error outside test failure block'
        });
      }
      continue;
    }
    
    if (line.match(/^Test:/i) || line.match(/^\s*Test Name:/i)) {
      currentFailure.testName = line.replace(/^Test:\s*/i, '').trim();
      continue;
    }
    
    if (line.match(/^Error:/i) || line.match(/^AssertionError:/i) || line.match(/^Error /i)) {
      inStackTrace = true;
      currentFailure.errorMessage = line.replace(/^Error:\s*/i, '').trim();
      continue;
    }
    
    if (inStackTrace && (line.startsWith('    at ') || line.startsWith('\tat '))) {
      stackLines.push(line.trim());
      continue;
    }
    
    if (inStackTrace && line.trim() === '' && currentFailure.errorMessage) {
      finishCurrentFailure();
      lastFailureEndLine = lineNum;
      continue;
    }
    
    if (line.match(/^=====/) || line.match(/^-----/) || line.match(/^\*{5}/)) {
      if (currentFailure.errorMessage) {
        finishCurrentFailure();
        lastFailureEndLine = lineNum;
      }
      continue;
    }
    
    if (failureStartLine > 0 && line.trim() !== '' && !inStackTrace) {
      suspiciousLines.push({line: lineNum, content: line});
    }
  }
  
  if (suspiciousLines.length > 0) {
    for (const sl of suspiciousLines) {
      errors.push({
        line: sl.line,
        content: sl.content,
        reason: 'Unparsable content in failure block'
      });
    }
  }
  
  finishCurrentFailure();
  
  function finishCurrentFailure() {
    if (currentFailure.testName && currentFailure.errorMessage) {
      const failure: TestFailure = {
        id: generateId(currentFailure.testName, currentFailure.errorMessage, String(failureStartLine)),
        testName: currentFailure.testName,
        errorMessage: currentFailure.errorMessage,
        stackTrace: stackLines.join('\n'),
        sourceLine: failureStartLine,
        raw: lines.slice(failureStartLine - 1, failureStartLine + stackLines.length + 2).join('\n')
      };
      successes.push(failure);
    } else if (currentFailure.errorMessage || stackLines.length > 0) {
      errors.push({
        line: failureStartLine,
        content: lines.slice(failureStartLine - 1, failureStartLine + 5).join('\n'),
        reason: 'Missing test name or incomplete failure entry'
      });
    }
    currentFailure = {};
    stackLines = [];
    inStackTrace = false;
  }
  
  return { successes, errors };
}

export function parseJsonFile(filePath: string): ParseResult {
  const content = fs.readFileSync(filePath, 'utf-8');
  const successes: TestFailure[] = [];
  const errors: ParseResult['errors'] = [];
  
  try {
    const data = JSON.parse(content);
    
    if (!Array.isArray(data)) {
      return {
        successes: [],
        errors: [{ line: 1, content: 'Root element is not an array', reason: 'Expected JSON array' }]
      };
    }
    
    data.forEach((item: any, index: number) => {
      const lineNum = index + 1;
      
      if (!item.testName || !item.errorMessage) {
        errors.push({
          line: lineNum,
          content: JSON.stringify(item),
          reason: 'Missing required fields: testName or errorMessage'
        });
        return;
      }
      
      successes.push({
        id: generateId(item.testName, item.errorMessage, String(lineNum)),
        testName: item.testName,
        errorMessage: item.errorMessage,
        stackTrace: item.stackTrace || '',
        timestamp: item.timestamp,
        sourceLine: lineNum
      });
    });
    
  } catch (e: any) {
    const match = e.message?.match(/position (\d+)/);
    const lineNum = match ? parseInt(match[1]) : 1;
    
    return {
      successes: [],
      errors: [{ line: lineNum, content: content.slice(0, 100), reason: `JSON parse error: ${e.message}` }]
    };
  }
  
  return { successes, errors };
}

export function parseInputFile(filePath: string): ParseResult {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.json') {
    return parseJsonFile(filePath);
  }
  
  return parseLogFile(filePath);
}

export function loadBaseline(filePath: string): any {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}
