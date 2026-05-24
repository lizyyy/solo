import * as fs from 'fs';
import * as path from 'path';
import { simpleParser } from 'mailparser';
import {
  BounceCategory,
  BounceRecord,
  RetrySuggestion,
  AppConfig,
  ProviderPattern
} from '../types';
import { defaultConfig, smtpCodeMappings } from '../config/default';

export class BounceParser {
  private config: AppConfig;

  constructor(config?: Partial<AppConfig>) {
    this.config = {
      ...defaultConfig,
      ...config,
      providers: config?.providers || defaultConfig.providers
    };
  }

  async parseEmailFile(filePath: string): Promise<BounceRecord> {
    const content = fs.readFileSync(filePath, 'utf-8');
    return this.parseEmailContent(content, filePath);
  }

  async parseEmailContent(content: string, sourceId?: string): Promise<BounceRecord> {
    const parsed = await simpleParser(content);
    
    const recipient = this.extractRecipient(parsed.text || '', parsed.to);
    const smtpCode = this.extractSmtpCode(parsed.text || '');
    const enhancedCode = this.extractEnhancedCode(parsed.text || '');
    const provider = this.detectProvider(recipient, parsed.text || '');
    const subject = parsed.subject || '';
    
    const { category, confidence, reason } = this.classifyBounce(
      parsed.text || '',
      smtpCode,
      enhancedCode,
      provider
    );

    const retrySuggestion = this.generateRetrySuggestion(category, smtpCode);

    return {
      id: sourceId || `bounce-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      recipient,
      smtpCode,
      enhancedCode,
      provider,
      batchId: this.extractBatchId(subject, parsed.text || ''),
      rawMessage: parsed.text || content,
      subject,
      timestamp: parsed.date?.getTime() || Date.now(),
      category,
      confidence,
      reason,
      retrySuggestion
    };
  }

  parseBounceData(data: {
    recipient: string;
    smtpCode?: string;
    enhancedCode?: string;
    provider?: string;
    batchId?: string;
    rawMessage?: string;
    subject?: string;
    timestamp?: number;
  }): BounceRecord {
    const { category, confidence, reason } = this.classifyBounce(
      data.rawMessage || '',
      data.smtpCode,
      data.enhancedCode,
      data.provider
    );

    const retrySuggestion = this.generateRetrySuggestion(category, data.smtpCode);

    return {
      id: `bounce-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      recipient: data.recipient,
      smtpCode: data.smtpCode,
      enhancedCode: data.enhancedCode,
      provider: data.provider || this.detectProvider(data.recipient, data.rawMessage || ''),
      batchId: data.batchId,
      rawMessage: data.rawMessage || '',
      subject: data.subject,
      timestamp: data.timestamp || Date.now(),
      category,
      confidence,
      reason,
      retrySuggestion
    };
  }

  private extractRecipient(text: string, to: any): string {
    const patterns = [
      /Original-Recipient:\s*rfc822;([^\s]+)/i,
      /Final-Recipient:\s*rfc822;([^\s]+)/i,
      /Recipient:\s*([^\s<>"']+@[^\s>]+)/i,
      /The following address\(es\) failed:\s*[\r\n]+\s*([^\s<>"']+@[^\s>]+)/i,
      /收件人[：:]\s*([^\s<>"']+@[^\s>]+)/i,
      /RCPT TO:<([^>]+)>/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) return match[1];
    }

    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) return emailMatch[0];

    if (to && to.text) {
      const match = to.text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (match) return match[0];
    }

    return 'unknown@unknown.com';
  }

  private extractSmtpCode(text: string): string | undefined {
    const patterns = [
      /\b(550|551|552|553|554|450|451|452|421)\b/,
      /SMTP\s*[Cc]ode\s*[=:]\s*(\d+)/,
      /Diagnostic-Code:\s*smtp;\s*(\d+)/
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }

    return undefined;
  }

  private extractEnhancedCode(text: string): string | undefined {
    const pattern = /\b(4|5)\.\d\.\d\b/;
    const match = text.match(pattern);
    return match?.[0];
  }

  private detectProvider(recipient: string, text: string): string | undefined {
    const domain = recipient.split('@')[1]?.toLowerCase() || '';
    
    for (const provider of this.config.providers) {
      if (provider.patterns.some(p => domain.includes(p))) {
        return provider.name;
      }
      if (provider.smtpPatterns.some(p => text.toLowerCase().includes(p))) {
        return provider.name;
      }
    }

    return undefined;
  }

  private extractBatchId(subject: string, text: string): string | undefined {
    const patterns = [
      /\[batch:([^\]]+)\]/i,
      /batch[_\-]?id[=:]\s*([^\s,]+)/i,
      /批次[：:]\s*([^\s,]+)/i,
      /campaign[_\-]?id[=:]\s*([^\s,]+)/i
    ];

    const combined = subject + ' ' + text;
    for (const pattern of patterns) {
      const match = combined.match(pattern);
      if (match) return match[1];
    }

    return undefined;
  }

  private classifyBounce(
    text: string,
    smtpCode?: string,
    enhancedCode?: string,
    provider?: string
  ): { category: BounceCategory; confidence: number; reason: string } {
    const lowerText = text.toLowerCase();
    let category = BounceCategory.UNKNOWN;
    let confidence = 0;
    let reason = '无法确定退信原因';

    if (enhancedCode && smtpCodeMappings[enhancedCode]) {
      const mapping = smtpCodeMappings[enhancedCode];
      category = mapping.category as BounceCategory;
      confidence = 0.9;
      reason = mapping.reason;
    }

    if (smtpCode && smtpCodeMappings[smtpCode] && confidence < 0.9) {
      const mapping = smtpCodeMappings[smtpCode];
      category = mapping.category as BounceCategory;
      confidence = 0.8;
      reason = mapping.reason;
    }

    const providerConfig = this.config.providers.find(p => p.name === provider);
    if (providerConfig) {
      const { category: providerCategory, confidence: providerConfidence } = 
        this.matchProviderPatterns(lowerText, providerConfig);
      
      if (providerConfidence > confidence) {
        category = providerCategory;
        confidence = providerConfidence;
        reason = this.getReasonForCategory(category, provider || 'unknown');
      }
    }

    const { category: generalCategory, confidence: generalConfidence } = 
      this.matchGeneralPatterns(lowerText);
    
    if (generalConfidence > confidence) {
      category = generalCategory;
      confidence = generalConfidence;
      reason = this.getReasonForCategory(category, '通用规则');
    }

    return { category, confidence, reason };
  }

  private matchProviderPatterns(
    text: string,
    provider: ProviderPattern
  ): { category: BounceCategory; confidence: number } {
    const patterns = [
      { category: BounceCategory.MAILBOX_NOT_EXIST, patterns: provider.mailboxNotExist },
      { category: BounceCategory.POLICY_REJECTION, patterns: provider.policyRejection },
      { category: BounceCategory.CONTENT_BLOCKED, patterns: provider.contentBlocked },
      { category: BounceCategory.TEMPORARY_FAILURE, patterns: provider.temporaryFailure }
    ];

    for (const { category, patterns: categoryPatterns } of patterns) {
      const matches = categoryPatterns.filter(p => 
        new RegExp(p.toLowerCase()).test(text)
      ).length;
      
      if (matches > 0) {
        return {
          category,
          confidence: Math.min(0.7 + matches * 0.1, 0.95)
        };
      }
    }

    return { category: BounceCategory.UNKNOWN, confidence: 0 };
  }

  private matchGeneralPatterns(text: string): { category: BounceCategory; confidence: number } {
    const patternMap: Array<{ category: BounceCategory; patterns: string[] }> = [
      {
        category: BounceCategory.MAILBOX_NOT_EXIST,
        patterns: [
          'user unknown', 'mailbox not found', 'no such user',
          'recipient.*invalid', 'address.*rejected', 'not exist',
          '不存在', '用户不存在', '收件人不存在', '邮箱不存在',
          'mailbox.*unavailable', 'recipient.*unknown'
        ]
      },
      {
        category: BounceCategory.POLICY_REJECTION,
        patterns: [
          'spf.*fail', 'dmarc', 'dkim.*fail', 'ip.*block',
          'reputation', '黑名单', 'blocklist', 'policy',
          'frequency', 'limit', '速率', '频率',
          '策略拒收', '被拒收', '拒绝接收', 'policy.*reject',
          'unsolicited', '5\\.7\\.', 'blocked'
        ]
      },
      {
        category: BounceCategory.CONTENT_BLOCKED,
        patterns: [
          'spam', '垃圾邮件', 'virus', '恶意', '违禁',
          'phish', 'malware', 'content.*reject',
          '内容被拦', '内容违规', '敏感词', '垃圾内容',
          '违规关键词', '内容被拦截', '垃圾内容'
        ]
      },
      {
        category: BounceCategory.TEMPORARY_FAILURE,
        patterns: [
          'temporary', 'deferred', 'try again', 'later',
          'timeout', 'busy', '临时', '稍后', '4\\d{2}',
          'service.*unavailable', 'system busy', 'try again later'
        ]
      }
    ];

    for (const { category, patterns } of patternMap) {
      const matches = patterns.filter(p => 
        new RegExp(p.toLowerCase()).test(text)
      ).length;
      
      if (matches > 0) {
        return {
          category,
          confidence: Math.min(0.5 + matches * 0.1, 0.75)
        };
      }
    }

    return { category: BounceCategory.UNKNOWN, confidence: 0 };
  }

  private getReasonForCategory(category: BounceCategory, source: string): string {
    const reasons: Record<BounceCategory, string> = {
      [BounceCategory.MAILBOX_NOT_EXIST]: '邮箱地址不存在或已被注销',
      [BounceCategory.POLICY_REJECTION]: '被对方邮件策略拒收（IP/域名/发送频率）',
      [BounceCategory.CONTENT_BLOCKED]: '邮件内容被判定为垃圾邮件或包含违规内容',
      [BounceCategory.TEMPORARY_FAILURE]: '临时性失败，可稍后重试',
      [BounceCategory.UNKNOWN]: '无法确定具体退信原因'
    };
    return `${reasons[category]} (${source})`;
  }

  private generateRetrySuggestion(category: BounceCategory, smtpCode?: string): RetrySuggestion {
    const { retry } = this.config;

    switch (category) {
      case BounceCategory.MAILBOX_NOT_EXIST:
        return {
          shouldRetry: false,
          maxRetries: 0,
          reason: '邮箱不存在，重试无效'
        };
      
      case BounceCategory.TEMPORARY_FAILURE:
        return {
          shouldRetry: true,
          retryAfterHours: retry.temporaryFailureHours,
          maxRetries: retry.maxRetries,
          reason: '临时性故障，建议等待后重试'
        };
      
      case BounceCategory.POLICY_REJECTION:
        if (smtpCode && ['450', '451', '452'].includes(smtpCode)) {
          return {
            shouldRetry: true,
            retryAfterHours: retry.policyRetryHours,
            maxRetries: 2,
            reason: '策略临时限制，可间隔较长时间后重试'
          };
        }
        return {
          shouldRetry: false,
          maxRetries: 0,
          reason: '硬策略拒绝，需先解决发件信誉问题'
        };
      
      case BounceCategory.CONTENT_BLOCKED:
        return {
          shouldRetry: false,
          maxRetries: 0,
          reason: '内容问题，需修改邮件内容后重发'
        };
      
      default:
        return {
          shouldRetry: false,
          maxRetries: 1,
          reason: '原因未知，可尝试一次重试'
        };
    }
  }

  async parseDirectory(dirPath: string): Promise<BounceRecord[]> {
    const files = fs.readdirSync(dirPath)
      .filter(f => f.endsWith('.eml') || f.endsWith('.txt'))
      .map(f => path.join(dirPath, f));

    const records: BounceRecord[] = [];
    for (const file of files) {
      try {
        const record = await this.parseEmailFile(file);
        records.push(record);
      } catch (e) {
        console.error(`解析文件失败 ${file}:`, (e as Error).message);
      }
    }
    return records;
  }
}
