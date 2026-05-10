from flask import jsonify


class BusinessError(Exception):
    def __init__(self, code, message, details=None):
        self.code = code
        self.message = message
        self.details = details or {}
        super().__init__(message)


class PatrolRouteError(BusinessError):
    def __init__(self, message, details=None):
        super().__init__('ROUTE_ERROR', message, details)


class CheckinError(BusinessError):
    def __init__(self, message, details=None):
        super().__init__('CHECKIN_ERROR', message, details)


class SupplementError(BusinessError):
    def __init__(self, message, details=None):
        super().__init__('SUPPLEMENT_ERROR', message, details)


class DetectionError(BusinessError):
    def __init__(self, message, details=None):
        super().__init__('DETECTION_ERROR', message, details)


class StateTransitionError(BusinessError):
    def __init__(self, message, details=None):
        super().__init__('STATE_ERROR', message, details)


def register_error_handlers(app):
    @app.errorhandler(BusinessError)
    def handle_business_error(e):
        response = {
            'success': False,
            'error': {
                'code': e.code,
                'message': e.message,
                'details': e.details
            }
        }
        return jsonify(response), 400

    @app.errorhandler(404)
    def handle_not_found(e):
        response = {
            'success': False,
            'error': {
                'code': 'NOT_FOUND',
                'message': '请求的资源不存在',
                'details': {}
            }
        }
        return jsonify(response), 404

    @app.errorhandler(400)
    def handle_bad_request(e):
        response = {
            'success': False,
            'error': {
                'code': 'BAD_REQUEST',
                'message': '请求参数错误',
                'details': str(e)
            }
        }
        return jsonify(response), 400

    @app.errorhandler(500)
    def handle_internal_error(e):
        response = {
            'success': False,
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '服务器内部错误',
                'details': {}
            }
        }
        return jsonify(response), 500
