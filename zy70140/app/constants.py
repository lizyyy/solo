class AuditStatus:
    PENDING = 'PENDING'
    PROCESSING = 'PROCESSING'
    APPROVED = 'APPROVED'
    REJECTED = 'REJECTED'
    NEED_MANUAL_REVIEW = 'NEED_MANUAL_REVIEW'
    MANUALLY_APPROVED = 'MANUALLY_APPROVED'
    MANUALLY_REJECTED = 'MANUALLY_REJECTED'

    _DESCRIPTIONS = {
        PENDING: '待审核',
        PROCESSING: '审核中',
        APPROVED: '审核通过',
        REJECTED: '审核拒绝',
        NEED_MANUAL_REVIEW: '需人工复审',
        MANUALLY_APPROVED: '人工通过',
        MANUALLY_REJECTED: '人工拒绝'
    }

    @classmethod
    def get_desc(cls, status):
        return cls._DESCRIPTIONS.get(status, '未知状态')

    @classmethod
    def is_final_status(cls, status):
        return status in [cls.APPROVED, cls.REJECTED, cls.MANUALLY_APPROVED, cls.MANUALLY_REJECTED]

    @classmethod
    def is_manual_final_status(cls, status):
        return status in [cls.MANUALLY_APPROVED, cls.MANUALLY_REJECTED]

class ReviewSource:
    THIRD_PARTY = 'THIRD_PARTY'
    MANUAL = 'MANUAL'
    SYSTEM = 'SYSTEM'

class TransitionError:
    ALREADY_FINAL = '当前任务已处于终态，不允许状态变更'
    OLD_SEQUENCE = '回调序号小于当前最大序号，旧结果已忽略'
    DUPLICATE_CALLBACK = '回调ID已存在，重复提交已忽略'
    INVALID_TRANSITION = '非法的状态流转'
    TASK_NOT_FOUND = '任务不存在'
    INVALID_PARAM = '参数错误'
    NO_PERMISSION = '无操作权限'

VALID_TRANSITIONS = {
    AuditStatus.PENDING: [
        AuditStatus.PROCESSING,
        AuditStatus.APPROVED,
        AuditStatus.REJECTED,
        AuditStatus.NEED_MANUAL_REVIEW
    ],
    AuditStatus.PROCESSING: [
        AuditStatus.APPROVED,
        AuditStatus.REJECTED,
        AuditStatus.NEED_MANUAL_REVIEW,
        AuditStatus.PROCESSING
    ],
    AuditStatus.NEED_MANUAL_REVIEW: [
        AuditStatus.APPROVED,
        AuditStatus.REJECTED,
        AuditStatus.MANUALLY_APPROVED,
        AuditStatus.MANUALLY_REJECTED
    ],
    AuditStatus.APPROVED: [],
    AuditStatus.REJECTED: [],
    AuditStatus.MANUALLY_APPROVED: [],
    AuditStatus.MANUALLY_REJECTED: []
}
