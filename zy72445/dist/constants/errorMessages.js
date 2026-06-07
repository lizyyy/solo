"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorMessages = void 0;
exports.getHumanReadableError = getHumanReadableError;
exports.errorMessages = {
    'track_not_found': {
        message: '找不到对应的曲目记录',
        suggestion: '请检查曲目ID是否正确，或确认该曲目已成功导入'
    },
    'duplicate_import_batch': {
        message: '这批曲目别名表之前已经导入过了',
        suggestion: '系统会自动跳过重复曲目，不会重复计数。如需更新请使用"修改备注"功能'
    },
    'rework_reason_pending': {
        message: '该轨道备注中存在未处理的返工原因',
        suggestion: '请先由版权运营小鹿复核返工原因，确认后再进行下一步操作'
    },
    'invalid_status_transition': {
        message: '当前状态不允许执行此操作',
        suggestion: '请按照审批流程顺序操作，或联系管理员确认状态流转规则'
    },
    'missing_checkin_photo': {
        message: '还没有上传课时签到照片',
        suggestion: '请先补传签到照片到群里，再进行审批复核'
    },
    'display_mode_requires_review': {
        message: '切换到3D或图表展示前需要先进行服务复核',
        suggestion: '请先完成当前轨道的服务复核流程，再切换展示模式'
    },
    'permission_denied': {
        message: '你没有权限执行此操作',
        suggestion: '请联系版权运营小鹿或管理员获取相应权限'
    },
    'batch_identifier_required': {
        message: '导入批次标识不能为空',
        suggestion: '请填写批次号或导入时间作为唯一标识，避免重复导入'
    },
    'cannot_rollback_normal': {
        message: '已标记为"正常"的记录无法直接回滚',
        suggestion: '如需修改请使用"申请返工"功能，由版权运营复核后处理'
    }
};
function getHumanReadableError(errorCode, fieldName) {
    const error = exports.errorMessages[errorCode];
    if (!error) {
        return {
            message: '操作失败，请稍后重试',
            suggestion: '如问题持续出现，请联系技术支持',
            fieldName
        };
    }
    return { ...error, fieldName };
}
//# sourceMappingURL=errorMessages.js.map