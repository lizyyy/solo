"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MEDICATION_EXPIRY_WARNING_DAYS = exports.FEVER_THRESHOLD = exports.SEVERITY_MAPPING = exports.DISCREPANCY_EXPLANATIONS = void 0;
exports.DISCREPANCY_EXPLANATIONS = {
    FEVER_DETECTED: '晨检发现体温异常，需启动发热隔离流程',
    OVERDUE_MEDICATION: '授权药品已过期或有效期不足3天',
    PARENT_NOT_CONFIRMED: '家长未对用药进行签字确认',
    STUDENT_NOT_IN_CLASS: '晨检名单中的学生不在班级名单内',
    MEDICATION_NOT_RECORDED: '有晨检记录但无对应用药授权',
    SYMPTOMS_UNCHECKED: '学生有症状但未在备注中说明处理措施',
    DATA_MISMATCH: '多方数据不一致，需人工核实',
};
exports.SEVERITY_MAPPING = {
    FEVER_DETECTED: 'HIGH',
    OVERDUE_MEDICATION: 'HIGH',
    PARENT_NOT_CONFIRMED: 'MEDIUM',
    STUDENT_NOT_IN_CLASS: 'LOW',
    MEDICATION_NOT_RECORDED: 'LOW',
    SYMPTOMS_UNCHECKED: 'MEDIUM',
    DATA_MISMATCH: 'MEDIUM',
};
exports.FEVER_THRESHOLD = 37.3;
exports.MEDICATION_EXPIRY_WARNING_DAYS = 3;
