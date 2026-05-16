from flask import jsonify

class ErrorCode:
    SUCCESS = 0
    PARAM_ERROR = 10001
    PARAM_MISSING = 10002
    SUPPLIER_NOT_FOUND = 20001
    SUPPLIER_ALREADY_EXISTS = 20002
    STRATEGY_NOT_FOUND = 20003
    EVIDENCE_CHAIN_BROKEN = 30001
    EVIDENCE_VALIDATION_FAILED = 30002
    ERROR_SAMPLE_DETECTED = 30003
    EXECUTION_FAILED = 40001
    BATCH_NOT_FOUND = 40002
    REPORT_NOT_FOUND = 50001
    CORRECTION_NOT_ALLOWED = 60001
    INTERNAL_ERROR = 99999

ERROR_MESSAGES = {
    ErrorCode.SUCCESS: '操作成功',
    ErrorCode.PARAM_ERROR: '参数错误',
    ErrorCode.PARAM_MISSING: '缺少必要参数',
    ErrorCode.SUPPLIER_NOT_FOUND: '供应商不存在',
    ErrorCode.SUPPLIER_ALREADY_EXISTS: '供应商已存在',
    ErrorCode.STRATEGY_NOT_FOUND: '压缩策略不存在',
    ErrorCode.EVIDENCE_CHAIN_BROKEN: '证据链断裂',
    ErrorCode.EVIDENCE_VALIDATION_FAILED: '证据验证失败',
    ErrorCode.ERROR_SAMPLE_DETECTED: '检测到错误样本',
    ErrorCode.EXECUTION_FAILED: '执行失败',
    ErrorCode.BATCH_NOT_FOUND: '批次不存在',
    ErrorCode.REPORT_NOT_FOUND: '报告不存在',
    ErrorCode.CORRECTION_NOT_ALLOWED: '不允许此修正操作',
    ErrorCode.INTERNAL_ERROR: '系统内部错误'
}

class ApiResponse:
    @staticmethod
    def success(data=None, message=None):
        response = {
            'code': ErrorCode.SUCCESS,
            'message': message or ERROR_MESSAGES[ErrorCode.SUCCESS],
            'success': True
        }
        if data is not None:
            response['data'] = data
        return jsonify(response), 200

    @staticmethod
    def error(error_code, message=None, details=None, status_code=400):
        response = {
            'code': error_code,
            'message': message or ERROR_MESSAGES.get(error_code, '未知错误'),
            'success': False
        }
        if details is not None:
            response['details'] = details
        return jsonify(response), status_code

    @staticmethod
    def error_with_data(error_code, data=None, message=None, status_code=400):
        response = {
            'code': error_code,
            'message': message or ERROR_MESSAGES.get(error_code, '未知错误'),
            'success': False
        }
        if data is not None:
            response['data'] = data
        return jsonify(response), status_code
