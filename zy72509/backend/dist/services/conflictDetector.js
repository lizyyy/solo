"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectConflict = detectConflict;
const CONFLICT_KEYWORDS = {
    intercept: ['拦截', '拒绝', '越权', '敏感', '违规', '不能', '不行', '不可以'],
    allow: ['通过', '允许', '可以', '正常', '没问题', '放行', '批准'],
};
function detectConflict(record) {
    const evidence = [];
    const types = [];
    const comment = (record.annotator_comment || '').toLowerCase();
    const output = (record.model_output || '').toLowerCase();
    const commentSaysIntercept = CONFLICT_KEYWORDS.intercept.some(k => comment.includes(k.toLowerCase()));
    const outputSaysIntercept = CONFLICT_KEYWORDS.intercept.some(k => output.includes(k.toLowerCase()));
    const commentSaysAllow = CONFLICT_KEYWORDS.allow.some(k => comment.includes(k.toLowerCase()));
    const outputSaysAllow = CONFLICT_KEYWORDS.allow.some(k => output.includes(k.toLowerCase()));
    if (record.annotator_comment && record.model_output) {
        if ((commentSaysIntercept && outputSaysAllow) || (commentSaysAllow && outputSaysIntercept)) {
            types.push('keyword_conflict');
            evidence.push('标注员留言与模型输出在"拦截/放行"判定上存在明显矛盾');
            if (commentSaysIntercept)
                evidence.push(`标注员留言含拦截倾向关键词`);
            if (outputSaysAllow)
                evidence.push(`模型输出含放行倾向关键词`);
            if (commentSaysAllow)
                evidence.push(`标注员留言含放行倾向关键词`);
            if (outputSaysIntercept)
                evidence.push(`模型输出含拦截倾向关键词`);
        }
        const dbIntercept = Boolean(record.is_intercepted);
        if (commentSaysIntercept !== dbIntercept && comment.length > 0) {
            types.push('intercept_mismatch');
            evidence.push(`标注员留言倾向${commentSaysIntercept ? '拦截' : '放行'}，但数据库标记为${dbIntercept ? '拦截' : '放行'}`);
        }
    }
    if (record.phone_number) {
        const commentMasksPhone = comment.includes('***') || comment.includes('脱敏') || comment.includes('隐藏');
        const outputMasksPhone = output.includes('***') || output.includes('脱敏') || output.includes('隐藏');
        if ((commentMasksPhone && !outputMasksPhone) || (!commentMasksPhone && outputMasksPhone)) {
            types.push('phone_handling_conflict');
            evidence.push('双方对手机号的脱敏处理方式不一致');
        }
    }
    if (evidence.length === 0)
        return null;
    return {
        type: types[0],
        evidence,
    };
}
