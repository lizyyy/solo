"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuleEngineService = void 0;
const RuleVersionDAO_1 = require("../models/RuleVersionDAO");
const types_1 = require("../models/types");
class RuleEngineService {
    static async validateSubmission(submission, ruleDate) {
        const rule = ruleDate
            ? RuleVersionDAO_1.RuleVersionDAO.getByDate(ruleDate)
            : RuleVersionDAO_1.RuleVersionDAO.getById(submission.ruleVersionId);
        if (!rule) {
            return {
                valid: false,
                status: types_1.SubmissionStatus.REJECTED,
                summary: '未找到适用的规则版本',
                conclusion: '系统错误：无法找到审核规则',
                errors: ['未找到适用的规则版本'],
                warnings: []
            };
        }
        return this.applyRules(submission, rule.rules, rule.version);
    }
    static async validateWithRuleId(submission, ruleVersionId) {
        const rule = RuleVersionDAO_1.RuleVersionDAO.getById(ruleVersionId);
        if (!rule) {
            return {
                valid: false,
                status: types_1.SubmissionStatus.REJECTED,
                summary: '未找到指定的规则版本',
                conclusion: '系统错误：无法找到审核规则',
                errors: ['未找到指定的规则版本'],
                warnings: []
            };
        }
        return this.applyRules(submission, rule.rules, rule.version);
    }
    static getRuleForSubmission(submission) {
        return RuleVersionDAO_1.RuleVersionDAO.getById(submission.ruleVersionId);
    }
    static applyRules(submission, rules, ruleVersion) {
        const errors = [];
        const warnings = [];
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
        let status;
        let conclusion;
        let summary;
        if (hasExpiredAttachments) {
            status = types_1.SubmissionStatus.ATTACHMENT_EXPIRED;
            conclusion = '附件已过期，请重新上传';
            summary = '提交因附件过期被标记';
        }
        else if (errors.length > 0) {
            status = types_1.SubmissionStatus.REJECTED;
            conclusion = `发现 ${errors.length} 个错误，请修正后重新提交`;
            summary = '提交被拒绝，需要修正错误';
        }
        else {
            status = types_1.SubmissionStatus.APPROVED;
            conclusion = '提交通过所有规则检查';
            summary = '提交审核通过';
        }
        if (warnings.length > 0) {
            summary += `（含 ${warnings.length} 个警告）`;
        }
        summary += ` [规则版本: ${ruleVersion}]`;
        return {
            valid: status === types_1.SubmissionStatus.APPROVED,
            status,
            summary,
            conclusion,
            errors,
            warnings
        };
    }
    static createNewRuleVersion(version, name, description, rules, effectiveFrom, createdBy) {
        RuleVersionDAO_1.RuleVersionDAO.deactivateOldVersions(effectiveFrom);
        return RuleVersionDAO_1.RuleVersionDAO.create({
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
exports.RuleEngineService = RuleEngineService;
//# sourceMappingURL=RuleEngineService.js.map