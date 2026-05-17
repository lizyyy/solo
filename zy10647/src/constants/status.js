const APPLICATION_STATUS = {
    DRAFT: 0,
    SUBMITTED: 1,
    APPROVED: 2,
    REJECTED: 3,
    WITHDRAWN: 4,
    EXPIRED: 5
};

const APPLICATION_STATUS_TEXT = {
    0: '草稿',
    1: '已提交待审核',
    2: '审核通过已恢复',
    3: '审核拒绝',
    4: '已撤回',
    5: '已失效'
};

const EXAM_STATUS = {
    NOT_STARTED: 0,
    IN_PROGRESS: 1,
    COMPLETED: 2
};

const OPERATOR_TYPE = {
    APPLICANT: 1,
    REVIEWER: 2,
    SYSTEM: 3
};

const OPERATION_TYPE = {
    CREATE: 'CREATE',
    SUBMIT: 'SUBMIT',
    REVIEW: 'REVIEW',
    WITHDRAW: 'WITHDRAW',
    UPDATE: 'UPDATE',
    EXPIRE: 'EXPIRE'
};

const ERROR_CODES = {
    SUCCESS: 0,
    ALREADY_RETOOK: 1001,
    DUPLICATE_REQUEST: 1002,
    NOT_ABSENT: 1003,
    INVALID_STATUS: 1004,
    VALIDATION_ERROR: 1005
};

const ERROR_MESSAGES = {
    1001: '考生已参加过补考，不能再次申请恢复资格',
    1002: '已有有效的恢复申请，请勿重复提交',
    1003: '考生未缺考，无需申请恢复资格',
    1004: '当前申请状态不允许此操作',
    1005: '参数校验失败'
};

module.exports = {
    APPLICATION_STATUS,
    APPLICATION_STATUS_TEXT,
    EXAM_STATUS,
    OPERATOR_TYPE,
    OPERATION_TYPE,
    ERROR_CODES,
    ERROR_MESSAGES
};
