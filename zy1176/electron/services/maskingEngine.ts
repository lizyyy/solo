import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database';
import { SensitiveHit, ProcessingResult, SensitiveRule } from '../types';

interface MatchResult {
  match: string;
  index: number;
  length: number;
  rule: SensitiveRule;
  confidence: number;
}

export class MaskingEngine {
  private getActiveRules(): SensitiveRule[] {
    const db = getDatabase();
    const rows = db.prepare(
      'SELECT * FROM sensitive_rules WHERE is_active = 1 ORDER BY priority DESC'
    ).all();
    
    return rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      pattern: row.pattern,
      description: row.description,
      isActive: row.is_active === 1,
      isBuiltin: row.is_builtin === 1,
      priority: row.priority,
      createdAt: row.created_at,
    }));
  }

  analyzeFile(
    fileId: string,
    filePath: string,
    fileType: string
  ): SensitiveHit[] {
    const db = getDatabase();
    
    db.prepare('UPDATE files SET status = ? WHERE id = ?').run('analyzing', fileId);
    
    db.prepare('DELETE FROM sensitive_hits WHERE file_id = ?').run(fileId);
    
    let content = '';
    try {
      content = this.extractText(filePath, fileType);
    } catch (e) {
      db.prepare('UPDATE files SET status = ? WHERE id = ?').run('error', fileId);
      return [];
    }
    
    const rules = this.getActiveRules();
    const allHits: SensitiveHit[] = [];
    
    for (const rule of rules) {
      const matches = this.findAllMatches(content, rule);
      
      for (const match of matches) {
        const isOverlapping = allHits.some(
          hit => 
            (match.index >= hit.startOffset && match.index < hit.endOffset) ||
            (hit.startOffset >= match.index && hit.startOffset < match.index + match.length)
        );
        
        if (isOverlapping) continue;
        
        const contextBefore = this.getContext(content, match.index, 50, true);
        const contextAfter = this.getContext(content, match.index + match.length, 50, false);
        
        const lineNumber = this.getLineNumber(content, match.index);
        
        const hit: SensitiveHit = {
          id: uuidv4(),
          fileId,
          ruleId: rule.id,
          ruleName: rule.name,
          category: rule.category,
          matchedText: match.match,
          replacementText: this.getDefaultReplacement(rule.category, match.match),
          contextBefore,
          contextAfter,
          lineNumber,
          startOffset: match.index,
          endOffset: match.index + match.length,
          status: 'pending',
          confidence: match.confidence,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        allHits.push(hit);
      }
    }
    
    const insertHit = db.prepare(`
      INSERT INTO sensitive_hits (
        id, file_id, rule_id, rule_name, category, matched_text,
        replacement_text, context_before, context_after, line_number,
        start_offset, end_offset, status, confidence
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const hit of allHits) {
      insertHit.run(
        hit.id, hit.fileId, hit.ruleId, hit.ruleName, hit.category,
        hit.matchedText, hit.replacementText, hit.contextBefore,
        hit.contextAfter, hit.lineNumber, hit.startOffset, hit.endOffset,
        hit.status, hit.confidence
      );
    }
    
    const confirmedCount = 0;
    const ignoredCount = 0;
    
    db.prepare(`
      UPDATE files SET 
        status = 'analyzed', 
        sensitive_count = ?,
        confirmed_count = ?,
        ignored_count = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(allHits.length, confirmedCount, ignoredCount, fileId);
    
    return allHits;
  }

  private extractText(filePath: string, fileType: string): string {
    if (fileType === 'text') {
      try {
        return fs.readFileSync(filePath, 'utf-8');
      } catch {
        return '';
      }
    }
    
    if (fileType === 'pdf') {
      return this.extractPdfText(filePath);
    }
    
    return '';
  }

  private extractPdfText(_filePath: string): string {
    return '';
  }

  private findAllMatches(content: string, rule: SensitiveRule): MatchResult[] {
    const results: MatchResult[] = [];
    
    try {
      const regex = new RegExp(rule.pattern, 'g');
      let match: RegExpExecArray | null;
      
      while ((match = regex.exec(content)) !== null) {
        let confidence = 1.0;
        
        if (rule.name === '中文姓名') {
          confidence = 0.5;
          
          const contextStart = Math.max(0, match.index - 10);
          const contextEnd = Math.min(content.length, match.index + match[0].length + 10);
          const context = content.substring(contextStart, contextEnd);
          
          if (context.includes('先生') || context.includes('女士') || 
              context.includes('经理') || context.includes('总监') ||
              context.includes('老师') || context.includes('总')) {
            confidence = 0.9;
          }
        }
        
        if (rule.name === '银行卡号') {
          const digits = match[0].replace(/\D/g, '');
          if (!this.luhnCheck(digits)) {
            continue;
          }
        }
        
        results.push({
          match: match[0],
          index: match.index,
          length: match[0].length,
          rule,
          confidence,
        });
      }
    } catch (e) {
      console.error(`Regex error for rule ${rule.name}: ${e}`);
    }
    
    return results;
  }

  private luhnCheck(digits: string): boolean {
    if (!/^\d+$/.test(digits)) return false;
    
    let sum = 0;
    let isEven = false;
    
    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i], 10);
      
      if (isEven) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      
      sum += digit;
      isEven = !isEven;
    }
    
    return sum % 10 === 0;
  }

  private getContext(content: string, offset: number, length: number, before: boolean): string {
    if (before) {
      const start = Math.max(0, offset - length);
      return content.substring(start, offset).replace(/\n/g, ' ');
    } else {
      const end = Math.min(content.length, offset + length);
      return content.substring(offset, end).replace(/\n/g, ' ');
    }
  }

  private getLineNumber(content: string, offset: number): number {
    const lines = content.substring(0, offset).split('\n');
    return lines.length;
  }

  private getDefaultReplacement(category: string, original: string): string {
    const masks: Record<string, string> = {
      contact: '[联系方式]',
      identity: '[身份信息]',
      organization: '[机构名称]',
      finance: '[金融信息]',
      location: '[地理位置]',
    };
    
    if (category === 'contact' && original.includes('@')) {
      return '***@***.com';
    }
    if (category === 'contact' && /^1[3-9]/.test(original)) {
      return original.substring(0, 3) + '****' + original.substring(7);
    }
    if (category === 'identity') {
      return original.substring(0, 6) + '********' + original.substring(14);
    }
    
    return masks[category] || '[敏感信息]';
  }

  processFile(
    fileId: string,
    filePath: string,
    fileType: string,
    confirmedHits: SensitiveHit[]
  ): ProcessingResult {
    const db = getDatabase();
    
    db.prepare('UPDATE files SET status = ? WHERE id = ?').run('processing', fileId);
    
    if (confirmedHits.length === 0) {
      db.prepare(`
        UPDATE files SET status = 'processed', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(fileId);
      
      return {
        fileId,
        outputPath: filePath,
        success: true,
        hitsProcessed: 0,
      };
    }
    
    if (fileType === 'text') {
      return this.processTextFile(fileId, filePath, confirmedHits);
    }
    
    db.prepare(`
      UPDATE files SET status = 'processed', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(fileId);
    
    return {
      fileId,
      outputPath: filePath,
      success: true,
      hitsProcessed: 0,
      error: '不支持的文件类型，无法进行脱敏处理',
    };
  }

  private processTextFile(
    fileId: string,
    filePath: string,
    confirmedHits: SensitiveHit[]
  ): ProcessingResult {
    try {
      let content = fs.readFileSync(filePath, 'utf-8');
      
      const sortedHits = [...confirmedHits].sort((a, b) => b.startOffset - a.startOffset);
      
      let processedCount = 0;
      for (const hit of sortedHits) {
        const replacement = hit.replacementText || '[敏感信息]';
        content = content.substring(0, hit.startOffset) + 
                  replacement + 
                  content.substring(hit.endOffset);
        processedCount++;
      }
      
      const fileName = path.basename(filePath);
      const ext = path.extname(filePath);
      const baseName = path.basename(fileName, ext);
      const outputFileName = `${baseName}_masked${ext}`;
      const outputDir = path.join(path.dirname(filePath), '_masked');
      
      fs.ensureDirSync(outputDir);
      const outputPath = path.join(outputDir, outputFileName);
      
      fs.writeFileSync(outputPath, content, 'utf-8');
      
      const db = getDatabase();
      db.prepare(`
        UPDATE files SET 
          status = 'processed', 
          mask_output_path = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(outputPath, fileId);
      
      for (const hit of confirmedHits) {
        db.prepare(`
          UPDATE sensitive_hits SET 
            status = 'processed',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(hit.id);
      }
      
      return {
        fileId,
        outputPath,
        success: true,
        hitsProcessed: processedCount,
      };
    } catch (error) {
      const db = getDatabase();
      db.prepare('UPDATE files SET status = ? WHERE id = ?').run('error', fileId);
      
      return {
        fileId,
        outputPath: filePath,
        success: false,
        hitsProcessed: 0,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }
}
