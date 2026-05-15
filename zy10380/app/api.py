from flask import Blueprint, request, jsonify
from app.services import ImportService
from app import db

bp = Blueprint('api', __name__)

def make_error_response(message, code, status_code):
    return jsonify({
        'success': False,
        'error': message,
        'code': code
    }), status_code

@bp.route('/packages', methods=['POST'])
def create_package():
    try:
        data = request.get_json()
        
        required_fields = ['filename', 'file_type', 'file_size', 'uploaded_by']
        for field in required_fields:
            if field not in data:
                return make_error_response(f'Missing required field: {field}', 'MISSING_FIELD', 400)
        
        package, created = ImportService.create_upload_package(
            filename=data['filename'],
            file_type=data['file_type'],
            file_size=data['file_size'],
            uploaded_by=data['uploaded_by']
        )
        
        return jsonify({
            'success': True,
            'created': created,
            'data': package.to_dict()
        }), 201 if created else 200
    except Exception as e:
        return make_error_response(str(e), 'INTERNAL_ERROR', 500)

@bp.route('/packages', methods=['GET'])
def list_packages():
    try:
        status = request.args.get('status')
        uploaded_by = request.args.get('uploaded_by')
        limit = int(request.args.get('limit', 50))
        
        packages = ImportService.list_packages(
            status=status,
            uploaded_by=uploaded_by,
            limit=limit
        )
        
        return jsonify({
            'success': True,
            'data': packages,
            'count': len(packages)
        })
    except Exception as e:
        return make_error_response(str(e), 'INTERNAL_ERROR', 500)

@bp.route('/packages/<package_id>', methods=['GET'])
def get_package(package_id):
    try:
        status = ImportService.get_package_status(package_id)
        return jsonify({
            'success': True,
            'data': status
        })
    except ValueError as e:
        return make_error_response(str(e), 'NOT_FOUND', 404)
    except Exception as e:
        return make_error_response(str(e), 'INTERNAL_ERROR', 500)

@bp.route('/packages/<package_id>/parse', methods=['POST'])
def parse_package(package_id):
    try:
        data = request.get_json(silent=True) or {}
        parsed_by = data.get('parsed_by', 'system')
        
        parse_result = ImportService.parse_package(package_id, parsed_by)
        return jsonify({
            'success': True,
            'data': parse_result.to_dict()
        })
    except ValueError as e:
        return make_error_response(str(e), 'PARSE_ERROR', 400)
    except Exception as e:
        return make_error_response(str(e), 'INTERNAL_ERROR', 500)

@bp.route('/packages/<package_id>/preview', methods=['GET'])
def get_preview(package_id):
    try:
        preview = ImportService.get_preview_diff(package_id)
        return jsonify({
            'success': True,
            'data': preview
        })
    except ValueError as e:
        return make_error_response(str(e), 'NOT_FOUND', 404)
    except Exception as e:
        return make_error_response(str(e), 'INTERNAL_ERROR', 500)

@bp.route('/packages/<package_id>/confirm-token', methods=['POST'])
def create_confirmation(package_id):
    try:
        data = request.get_json(silent=True) or {}
        created_by = data.get('created_by', 'system')
        
        token = ImportService.create_confirmation_token(package_id, created_by)
        return jsonify({
            'success': True,
            'data': token.to_dict()
        })
    except ValueError as e:
        return make_error_response(str(e), 'TOKEN_ERROR', 400)
    except Exception as e:
        return make_error_response(str(e), 'INTERNAL_ERROR', 500)

@bp.route('/packages/<package_id>/write', methods=['POST'])
def confirm_and_write(package_id):
    try:
        data = request.get_json(silent=True) or {}
        
        if 'token' not in data:
            return make_error_response('Missing confirmation token', 'MISSING_TOKEN', 400)
        
        confirmed_by = data.get('confirmed_by', 'system')
        
        batches = ImportService.confirm_and_write(
            package_id,
            data['token'],
            confirmed_by
        )
        return jsonify({
            'success': True,
            'data': [b.to_dict() for b in batches],
            'batch_count': len(batches)
        })
    except ValueError as e:
        return make_error_response(str(e), 'WRITE_ERROR', 400)
    except Exception as e:
        return make_error_response(str(e), 'INTERNAL_ERROR', 500)

@bp.route('/batches/<batch_id>/revoke', methods=['POST'])
def revoke_batch(batch_id):
    try:
        data = request.get_json(silent=True) or {}
        revoked_by = data.get('revoked_by', 'system')
        reason = data.get('reason', 'Manual revocation')
        
        revocation = ImportService.revoke_batch(batch_id, revoked_by, reason)
        return jsonify({
            'success': True,
            'data': revocation.to_dict()
        })
    except ValueError as e:
        return make_error_response(str(e), 'REVOCATION_ERROR', 400)
    except Exception as e:
        return make_error_response(str(e), 'INTERNAL_ERROR', 500)

@bp.route('/history', methods=['GET'])
def get_history():
    try:
        package_id = request.args.get('package_id')
        operator = request.args.get('operator')
        limit = int(request.args.get('limit', 100))
        
        history = ImportService.get_history(
            package_id=package_id,
            operator=operator,
            limit=limit
        )
        
        return jsonify({
            'success': True,
            'data': history,
            'count': len(history)
        })
    except Exception as e:
        return make_error_response(str(e), 'INTERNAL_ERROR', 500)

@bp.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'success': True,
        'status': 'healthy',
        'service': 'multi-step-import-api'
    })
