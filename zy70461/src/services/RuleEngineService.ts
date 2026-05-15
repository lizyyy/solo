import { RuleVersionDAO } from '../models/RuleVersionDAO';
import { Submission, SubmissionStatus, RuleDefinition, RuleVersion } from '../models/types';

export interface ValidationResult {
  valid: boolean;
  status: SubmissionStatus;
  summary: string;
  conclusion: string;
  errors: string[];
  warnings: string[];
}

export class RuleEngineService {
  static async validateSubmission(submission: Submission, ruleDate?: Date): Promise<ValidationResult> {
    const rule = ruleDate 
      ? RuleVersionDAO.getByDate(ruleDate)
      : RuleVersionDAO.getById(submission.ruleVersionId);

    if (!rule) {
      return {
        valid: false,
        status: SubmissionStatus.REJECTED,
        summary: '未找到适用的规则版本',
        conclusion: '系统错误：无法找到审核规则',
        errors: ['未找到适用的规则版本'],
        warnings: []
      };
    }

    return this.applyRules(submission, rule.rules, rule.version);
  }

  static async validateWithRuleId(submission: Submission, ruleVersionId: string): Promise<ValidationResult> {
    const rule = RuleVersionDAO.getById(ruleVersionId);
    if (!rule) {
      return {
        valid: false,
        status: SubmissionStatus.REJECTED,
        summary: '未找到指定的规则版本',
        conclusion: '系统错误：无法找到审核规则',
        errors: ['未找到指定的规则版本'],
        warnings: []
      };
    }
    return this.applyRules(submission, rule.rules, rule.version);
  }

  static getRuleForSubmission(submission: Submission): RuleVersion | null {
    return RuleVersionDAO.getById(submission.ruleVersionId);
  }

  private static applyRules(submission: Submission, rules: RuleDefinition, ruleVersion: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const hasExpiredAttachments = submission.attachments.some(att => att.isExpired);
    if (hasExpiredAttachments) {
      errors.push(`存在已过期的附件（有效期: ${rules.attachmentValidDays}天）`);
    }

    if (rules.requireStudentId && !submission.studentId) {
      errors.push('缺少学号信息');
    }

    if (rules.requireCourseCode && !submission.courseCode) {
      errors.push('缺少课程代码');
    }

    submission.attachments.forEach(att => {
      const fileExt = att.name.substring(att.name.lastIndexOf('.')).toLowerCase();
      if (!rules.allowedFileTypes.includes(fileExt)) {
        errors.push(`附件 ${att.name} 文件类型不允许，允许类型: ${rules.allowedFileTypes.join(', ')}`);
      }
      if (att.size > rules.maxFileSizeMB * 1024 * 1024) {
        errors.push(`附件 ${att.name} 超过最大文件大小限制 ${rules.maxFileSizeMB}MB`);
      }
    });

    if (submission.content.length < 50) {
      warnings.push('提交内容较短，建议提供更详细的说明');
    }

    let status: SubmissionStatus;
    let conclusion: string;
    let summary: string;

    if (hasExpiredAttachments) {
      status = SubmissionStatus.ATTACHMENT_EXPIRED;
      conclusion = '附件已过期，请重新上传';
      summary = '提交因附件过期被标记';
    } else if (errors.length > 0) {
      status = SubmissionStatus.REJECTED;
      conclusion = `发现 ${errors.length} 个错误，请修正后重新提交`;
      summary = '提交被拒绝，需要修正错误';
    } else {
      status = SubmissionStatus.APPROVED;
      conclusion = '提交通过所有规则检查';
      summary = '提交审核通过';
    }

    if (warnings.length > 0) {
      summary += `（含 ${warnings.length} 个警告）`;
    }

    summary += ` [规则版本: ${ruleVersion}]`;

    return {
      valid: status === SubmissionStatus.APPROVED,
      status,
      summary,
      conclusion,
      errors,
      warnings
    };
  }

  static createNewRuleVersion(
    version: string,
    name: string,
    description: string,
    rules: RuleDefinition,
    effectiveFrom: Date,
    createdBy: string
  ): RuleVersion {
    RuleVersionDAO.deactivateOldVersions(effectiveFrom);

    return RuleVersionDAO.create({
      version,
      name,
      description,
      rules,
      effectiveFrom,
      isActive: true,
      createdBy
    });
  }
}
