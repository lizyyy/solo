import os
import uuid
import json
from datetime import datetime
from flask import Blueprint, request, jsonify, send_file, make_response
from werkzeug.utils import secure_filename
from io import BytesIO, StringIO

from app.db.sqlite_manager import SQLiteManager
from app.validator.sql_validator import SQLValidator, ValidationStatus
from app.storage.persistence import (
    PersistenceManager, ManualConfirmation, 
    OptimizationSuggestion, FailedSample
)
from app.exporter.report_exporter import ReportExporter
from app.config import Config

api_bp = Blueprint('api', __name__)

sqlite_manager = SQLiteManager(Config.SQLITE_TEMP_DIR)
persistence_manager = PersistenceManager(Config.STORAGE_DIR)
sql_validator = SQLValidator(sqlite_manager, Config.SQL_TIMEOUT)
report_exporter = ReportExporter()


@api_bp.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.now().isoformat(),
        'service': 'sql-validator-api'
    })


@api_bp.route('/statistics', methods=['GET'])
def get_statistics():
    stats = persistence_manager.get_statistics()
    return jsonify(stats)


@api_bp.route('/validate', methods=['POST'])
def run_validation():
    try:
        name = request.form.get('name', f'Validation_{datetime.now().strftime("%Y%m%d_%H%M%S")}')
        
        schema_sql = ''
        seed_csv = ''
        cases_yaml = ''
        
        if 'schema' in request.files:
            schema_file = request.files['schema']
            if schema_file.filename:
                schema_sql = schema_file.read().decode('utf-8')
        elif 'schema_sql' in request.form:
            schema_sql = request.form['schema_sql']
        
        if 'seed' in request.files:
            seed_file = request.files['seed']
            if seed_file.filename:
                seed_csv = seed_file.read().decode('utf-8')
        elif 'seed_csv' in request.form:
            seed_csv = request.form['seed_csv']
        
        if 'cases' in request.files:
            cases_file = request.files['cases']
            if cases_file.filename:
                cases_yaml = cases_file.read().decode('utf-8')
        elif 'cases_yaml' in request.form:
            cases_yaml = request.form['cases_yaml']
        
        if not schema_sql:
            return jsonify({
                'error': 'schema.sql is required (provide via file or form field)'
            }), 400
        
        if not cases_yaml:
            return jsonify({
                'error': 'cases.yaml is required (provide via file or form field)'
            }), 400
        
        try:
            cases = sql_validator.parse_cases_from_yaml(cases_yaml)
        except Exception as e:
            return jsonify({'error': f'Failed to parse cases.yaml: {str(e)}'}), 400
        
        if not cases:
            return jsonify({'error': 'No valid test cases found in cases.yaml'}), 400
        
        validation = sql_validator.create_validation(name)
        result = sql_validator.run_validation(
            validation,
            schema_sql,
            seed_csv,
            cases
        )
        
        validation_id = persistence_manager.save_validation(result.to_dict())
        
        for case in result.cases:
            if case.status in [ValidationStatus.FAILED, ValidationStatus.ERROR]:
                sample_data = json.dumps({
                    'comparison_result': case.comparison_result.to_dict() if case.comparison_result else None,
                    'suggestions': case.suggestions
                }) if case.comparison_result else '{}'
                
                failed_sample = FailedSample(
                    sample_id=uuid.uuid4().hex,
                    validation_id=validation_id,
                    case_id=case.case_id,
                    case_name=case.name,
                    original_sql=case.original_sql,
                    optimized_sql=case.optimized_sql,
                    error_type=case.status.value,
                    error_message=case.error_message or 'Result mismatch',
                    sample_data=sample_data,
                    created_at=datetime.now()
                )
                persistence_manager.save_failed_sample(failed_sample)
            
            if case.suggestions:
                for i, suggestion_text in enumerate(case.suggestions):
                    category = 'performance'
                    if 'NULL' in suggestion_text:
                        category = 'null_handling'
                    elif 'JOIN' in suggestion_text:
                        category = 'join_issue'
                    elif '验证失败' in suggestion_text or 'mismatch' in suggestion_text.lower():
                        category = 'correctness'
                    
                    priority = 'high' if '⚠️' in suggestion_text else 'medium'
                    if '✅' in suggestion_text:
                        priority = 'low'
                    
                    suggestion = OptimizationSuggestion(
                        suggestion_id=uuid.uuid4().hex,
                        validation_id=validation_id,
                        case_id=case.case_id,
                        suggestion_text=suggestion_text,
                        category=category,
                        priority=priority,
                        created_at=datetime.now()
                    )
                    persistence_manager.save_optimization_suggestion(suggestion)
        
        return jsonify(result.to_dict())
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/validations', methods=['GET'])
def list_validations():
    limit = int(request.args.get('limit', 100))
    offset = int(request.args.get('offset', 0))
    status = request.args.get('status')
    
    validations = persistence_manager.list_validations(limit, offset, status)
    return jsonify({
        'validations': validations,
        'limit': limit,
        'offset': offset
    })


@api_bp.route('/validations/<validation_id>', methods=['GET'])
def get_validation(validation_id):
    validation = persistence_manager.get_validation(validation_id)
    if not validation:
        return jsonify({'error': 'Validation not found'}), 404
    return jsonify(validation)


@api_bp.route('/validations/<validation_id>/export/<format>', methods=['GET'])
def export_validation(validation_id, format):
    validation = persistence_manager.get_validation(validation_id)
    if not validation:
        return jsonify({'error': 'Validation not found'}), 404
    
    try:
        if format == 'json':
            return jsonify(validation)
        
        elif format == 'markdown':
            markdown = report_exporter.export_to_markdown(validation)
            output = BytesIO(markdown.encode('utf-8'))
            output.seek(0)
            
            response = make_response(output.getvalue())
            response.headers['Content-Type'] = 'text/markdown; charset=utf-8'
            response.headers['Content-Disposition'] = f'attachment; filename=validation_{validation_id}.md'
            return response
        
        else:
            return jsonify({'error': 'Unsupported format. Use json or markdown'}), 400
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/failed-samples', methods=['GET'])
def list_failed_samples():
    limit = int(request.args.get('limit', 100))
    offset = int(request.args.get('offset', 0))
    resolved = request.args.get('resolved')
    validation_id = request.args.get('validation_id')
    
    resolved_bool = None
    if resolved is not None:
        resolved_bool = resolved.lower() in ['true', '1', 'yes']
    
    samples = persistence_manager.list_failed_samples(
        limit, offset, resolved_bool, validation_id
    )
    
    return jsonify({
        'samples': [s.to_dict() for s in samples],
        'limit': limit,
        'offset': offset
    })


@api_bp.route('/failed-samples/<sample_id>', methods=['GET'])
def get_failed_sample(sample_id):
    sample = persistence_manager.get_failed_sample(sample_id)
    if not sample:
        return jsonify({'error': 'Failed sample not found'}), 404
    return jsonify(sample.to_dict())


@api_bp.route('/failed-samples/<sample_id>/resolve', methods=['POST'])
def resolve_failed_sample(sample_id):
    data = request.get_json() or {}
    note = data.get('note', '')
    
    success = persistence_manager.resolve_failed_sample(sample_id, note)
    if not success:
        return jsonify({'error': 'Failed sample not found'}), 404
    
    sample = persistence_manager.get_failed_sample(sample_id)
    return jsonify(sample.to_dict())


@api_bp.route('/manual-confirmations', methods=['GET', 'POST'])
def manual_confirmations():
    if request.method == 'GET':
        limit = int(request.args.get('limit', 100))
        offset = int(request.args.get('offset', 0))
        validation_id = request.args.get('validation_id')
        
        confirmations = persistence_manager.list_manual_confirmations(
            limit, offset, validation_id
        )
        
        return jsonify({
            'confirmations': [c.to_dict() for c in confirmations],
            'limit': limit,
            'offset': offset
        })
    
    else:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'JSON body required'}), 400
        
        confirmation = ManualConfirmation(
            confirmation_id=uuid.uuid4().hex,
            validation_id=data.get('validation_id', ''),
            case_id=data.get('case_id', ''),
            confirmed_by=data.get('confirmed_by', 'api_user'),
            confirmed_at=datetime.now(),
            confirmation_type=data.get('confirmation_type', 'result_verification'),
            notes=data.get('notes', ''),
            is_valid=data.get('is_valid', True)
        )
        
        confirmation_id = persistence_manager.save_manual_confirmation(confirmation)
        return jsonify(confirmation.to_dict()), 201


@api_bp.route('/optimization-suggestions', methods=['GET'])
def list_optimization_suggestions():
    limit = int(request.args.get('limit', 100))
    offset = int(request.args.get('offset', 0))
    validation_id = request.args.get('validation_id')
    applied = request.args.get('applied')
    
    applied_bool = None
    if applied is not None:
        applied_bool = applied.lower() in ['true', '1', 'yes']
    
    suggestions = persistence_manager.list_optimization_suggestions(
        limit, offset, validation_id, applied_bool
    )
    
    return jsonify({
        'suggestions': [s.to_dict() for s in suggestions],
        'limit': limit,
        'offset': offset
    })


@api_bp.route('/bad-cases/examples', methods=['GET'])
def get_bad_case_examples():
    examples = {
        'wrong_row_count': {
            'title': '行数不一致（常见错误）',
            'description': '优化后的 SQL 返回行数与原始 SQL 不同，可能是 JOIN 条件或 WHERE 子句修改错误',
            'original_sql': 'SELECT * FROM orders WHERE status = "completed"',
            'optimized_sql': 'SELECT * FROM orders WHERE status = "paid"',
            'error_hint': 'WHERE 条件从 "completed" 变成了 "paid"，行数会不同'
        },
        'column_mismatch': {
            'title': '列结构不一致',
            'description': '优化后的 SQL 返回的列名或列顺序与原始 SQL 不同',
            'original_sql': 'SELECT id, name, email FROM users',
            'optimized_sql': 'SELECT id, name FROM users',
            'error_hint': '优化后缺少了 email 列'
        },
        'order_sensitivity': {
            'title': '排序语义破坏',
            'description': '当有 ORDER BY 时，优化不能改变结果的顺序',
            'original_sql': 'SELECT * FROM users ORDER BY created_at DESC LIMIT 10',
            'optimized_sql': 'SELECT * FROM users LIMIT 10',
            'error_hint': '去掉了 ORDER BY，LIMIT 10 的结果可能不同'
        },
        'null_aggregation': {
            'title': 'NULL 聚合问题',
            'description': 'COUNT(*) 和 COUNT(column) 对 NULL 的处理不同',
            'original_sql': 'SELECT COUNT(*) FROM users WHERE email IS NULL',
            'optimized_sql': 'SELECT COUNT(email) FROM users',
            'error_hint': 'COUNT(email) 不统计 NULL 值，而 COUNT(*) 会统计'
        },
        'join_issue': {
            'title': 'JOIN 条件错误',
            'description': '修改 JOIN 类型或条件时容易引入错误',
            'original_sql': 'SELECT u.name, o.amount FROM users u LEFT JOIN orders o ON u.id = o.user_id',
            'optimized_sql': 'SELECT u.name, o.amount FROM users u JOIN orders o ON u.id = o.user_id',
            'error_hint': 'LEFT JOIN 改成了 INNER JOIN，没有订单的用户会被过滤掉'
        }
    }
    
    return jsonify(examples)


@api_bp.route('/curl-examples', methods=['GET'])
def get_curl_examples():
    examples = {
        'run_validation_with_files': '''
# 使用文件上传方式运行验证
curl -X POST http://localhost:5000/api/validate \\
  -F "name=My SQL Validation" \\
  -F "schema=@schema.sql" \\
  -F "seed=@seed-data.csv" \\
  -F "cases=@cases.yaml"
''',
        'run_validation_with_form_data': '''
# 使用表单字段方式运行验证
curl -X POST http://localhost:5000/api/validate \\
  -F "name=Quick Test" \\
  -F "schema_sql=CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);" \\
  -F "seed_csv=id,name
1,Alice
2,Bob" \\
  -F "cases_yaml=cases:
  - case_id: case_001
    name: Basic Select Test
    original_sql: SELECT * FROM users
    optimized_sql: SELECT id, name FROM users"
''',
        'list_validations': '''
# 获取验证列表
curl "http://localhost:5000/api/validations?limit=10&offset=0"
''',
        'get_validation': '''
# 获取单个验证详情
curl http://localhost:5000/api/validations/{validation_id}
''',
        'export_markdown': '''
# 导出 Markdown 报告
curl -o report.md http://localhost:5000/api/validations/{validation_id}/export/markdown
''',
        'list_failed_samples': '''
# 获取失败样本列表
curl "http://localhost:5000/api/failed-samples?resolved=false"
''',
        'resolve_failed_sample': '''
# 标记失败样本为已解决
curl -X POST http://localhost:5000/api/failed-samples/{sample_id}/resolve \\
  -H "Content-Type: application/json" \\
  -d '{"note": "已确认是已知问题，优化方案需要调整"}'
''',
        'add_manual_confirmation': '''
# 添加人工确认
curl -X POST http://localhost:5000/api/manual-confirmations \\
  -H "Content-Type: application/json" \\
  -d '{
    "validation_id": "abc123",
    "case_id": "case_001",
    "confirmed_by": "developer",
    "confirmation_type": "result_verification",
    "notes": "已人工验证，结果确实等价",
    "is_valid": true
  }'
''',
        'get_statistics': '''
# 获取统计信息
curl http://localhost:5000/api/statistics
'''
    }
    
    return jsonify(examples)

