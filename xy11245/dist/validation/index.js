"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeBookData = exports.validateBookData = exports.validateGrade = exports.validateCondition = exports.validateIsbn = exports.isValidIsbn = void 0;
const VALID_CONDITIONS = ['全新', '九成新', '八成新', '七成新', '六成新', '其他'];
const VALID_GRADES = ['幼儿园', '一年级', '二年级', '三年级', '四年级', '五年级', '六年级',
    '初一', '初二', '初三', '初中', '高一', '高二', '高三', '高中', '通用'];
const isValidIsbn = (isbn) => {
    const cleanIsbn = isbn.replace(/[-\s]/g, '');
    if (!/^\d{10}(\d{3})?$/.test(cleanIsbn)) {
        return false;
    }
    return true;
};
exports.isValidIsbn = isValidIsbn;
const validateIsbn = (isbn) => {
    if (!isbn || isbn.trim() === '') {
        return {
            type: 'missing_required',
            message: 'ISBN 不能为空',
            suggestion: '请扫描书籍条形码或手动输入完整 ISBN'
        };
    }
    if (!(0, exports.isValidIsbn)(isbn)) {
        return {
            type: 'invalid_isbn',
            message: `ISBN 格式无效: ${isbn}`,
            suggestion: '请检查 ISBN 是否为 10 位或 13 位有效数字，或使用标准格式（如 978-7-111-54493-7）'
        };
    }
    return null;
};
exports.validateIsbn = validateIsbn;
const validateCondition = (condition) => {
    if (!condition || condition.trim() === '') {
        return null;
    }
    if (!VALID_CONDITIONS.includes(condition.trim())) {
        return {
            type: 'invalid_condition',
            message: `品相 "${condition}" 不是标准值`,
            suggestion: `请从以下选项中选择: ${VALID_CONDITIONS.join('、')}`
        };
    }
    return null;
};
exports.validateCondition = validateCondition;
const validateGrade = (grade) => {
    if (!grade || grade.trim() === '') {
        return null;
    }
    if (!VALID_GRADES.includes(grade.trim())) {
        return {
            type: 'invalid_grade',
            message: `年级 "${grade}" 不是标准值`,
            suggestion: `请从以下选项中选择: ${VALID_GRADES.join('、')}`
        };
    }
    return null;
};
exports.validateGrade = validateGrade;
const validateBookData = (data) => {
    const errors = [];
    const isbnError = (0, exports.validateIsbn)(data.isbn);
    if (isbnError) {
        errors.push(isbnError);
    }
    const conditionError = (0, exports.validateCondition)(data.condition || '');
    if (conditionError) {
        errors.push(conditionError);
    }
    const gradeError = (0, exports.validateGrade)(data.grade || '');
    if (gradeError) {
        errors.push(gradeError);
    }
    if (errors.length > 0) {
        const combinedMessage = errors.map(e => e.message).join('; ');
        const combinedSuggestion = errors.map(e => e.suggestion).join('; ');
        return {
            valid: false,
            error: {
                type: errors[0].type,
                message: combinedMessage,
                suggestion: combinedSuggestion
            }
        };
    }
    return {
        valid: true,
        data: {
            ...data,
            isbn: data.isbn.replace(/[-\s]/g, ''),
            condition: data.condition?.trim() || '其他',
            grade: data.grade?.trim() || '通用'
        }
    };
};
exports.validateBookData = validateBookData;
const normalizeBookData = (data) => {
    const findKey = (keys) => {
        for (const key of keys) {
            const found = Object.keys(data).find(k => k.toLowerCase().includes(key.toLowerCase()) ||
                key.toLowerCase().includes(k.toLowerCase()));
            if (found)
                return found;
        }
        return undefined;
    };
    return {
        isbn: data[findKey(['isbn', 'ISBN', '条码']) || 'isbn'] || '',
        title: data[findKey(['title', '书名', '名称']) || 'title'],
        condition: data[findKey(['condition', '品相', '成色']) || 'condition'],
        grade: data[findKey(['grade', '年级', '适用年级']) || 'grade'],
        donor: data[findKey(['donor', '捐赠人', '捐赠']) || 'donor'],
        scanned_at: data[findKey(['scanned_at', '扫码时间', '时间']) || 'scanned_at']
    };
};
exports.normalizeBookData = normalizeBookData;
