from flask import Flask, request, jsonify, send_file
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import os
import json
import tempfile

from config import Config
from models import (
    db, RpcService, RpcMethod, ProtoService, ProtoMethod, ProtoMessage,
    MigrationTask, MethodMapping, ComparisonResult, Difference,
    ManualConfirmation, ExportRecord, BadExample
)
from parsers import RpcServicesParser, ProtoParser
from comparators import (
    FieldComparator, DeadlineComparator, StatusCodeComparator,
    RetryComparator, ErrorMappingComparator, MetadataComparator
)
from adapters import LegacyRpcAdapter, GrpcAdapter
from reports import MarkdownReport, JsonReport

app = Flask(__name__)
app.config.from_object(Config)
Config.init_app(app)
db.init_app(app)


def init_db():
    """初始化数据库"""
    with app.app_context():
        db.create_all()
        print('Database initialized.')


def to_dict(model, exclude=None):
    """将模型转换为字典"""
    exclude = exclude or []
    data = {}
    for column in model.__table__.columns:
        if column.name not in exclude:
            value = getattr(model, column.name)
            if isinstance(value, datetime):
                value = value.isoformat()
            data[column.name] = value
    return data


@app.route('/api/health', methods=['GET'])
def health_check():
    """健康检查"""
    return jsonify({'status': 'ok', 'timestamp': datetime.utcnow().isoformat()})


@app.route('/api/rpc-services', methods=['POST'])
def import_rpc_services():
    """导入 rpc-services.yaml"""
    try:
        if 'file' in request.files:
            file = request.files['file']
            content = file.read().decode('utf-8')
        elif request.is_json:
            content = json.dumps(request.json)
        else:
            content = request.data.decode('utf-8')
        
        parser = RpcServicesParser()
        parsed_data = parser.parse_content(content)
        saved_services = parser.save_to_db(parsed_data)
        
        result = []
        for service in saved_services:
            service_dict = to_dict(service)
            service_dict['methods'] = [to_dict(m) for m in service.methods.all()]
            result.append(service_dict)
        
        return jsonify({
            'success': True,
            'data': result,
            'message': f'成功导入 {len(saved_services)} 个服务'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400


@app.route('/api/rpc-services', methods=['GET'])
def list_rpc_services():
    """列出所有已导入的老 RPC 服务"""
    services = RpcService.query.all()
    result = []
    for service in services:
        service_dict = to_dict(service)
        service_dict['methods'] = [to_dict(m) for m in service.methods.all()]
        result.append(service_dict)
    return jsonify({'success': True, 'data': result})


@app.route('/api/proto-services', methods=['POST'])
def import_proto_services():
    """导入 proto 文件"""
    try:
        if 'file' in request.files:
            file = request.files['file']
            content = file.read().decode('utf-8')
            filename = file.filename or 'unknown.proto'
        elif request.is_json:
            data = request.json
            content = data.get('content', '')
            filename = data.get('filename', 'unknown.proto')
        else:
            content = request.data.decode('utf-8')
            filename = 'unknown.proto'
        
        parser = ProtoParser()
        parsed_data = parser.parse_content(content, filename)
        saved_services = parser.save_to_db(parsed_data)
        
        result = []
        for service in saved_services:
            service_dict = to_dict(service)
            service_dict['methods'] = [to_dict(m) for m in service.methods.all()]
            service_dict['messages'] = [to_dict(m) for m in service.messages.all()]
            result.append(service_dict)
        
        return jsonify({
            'success': True,
            'data': result,
            'message': f'成功导入 {len(saved_services)} 个 Proto 服务'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400


@app.route('/api/proto-services', methods=['GET'])
def list_proto_services():
    """列出所有已导入的 Proto 服务"""
    services = ProtoService.query.all()
    result = []
    for service in services:
        service_dict = to_dict(service)
        service_dict['methods'] = [to_dict(m) for m in service.methods.all()]
        service_dict['messages'] = [to_dict(m) for m in service.messages.all()]
        result.append(service_dict)
    return jsonify({'success': True, 'data': result})


@app.route('/api/tasks', methods=['POST'])
def create_task():
    """创建迁移评审任务"""
    try:
        data = request.json
        
        task = MigrationTask(
            name=data.get('name', '未命名任务'),
            description=data.get('description', ''),
            rpc_service_id=data.get('rpc_service_id'),
            proto_service_id=data.get('proto_service_id'),
            status='pending'
        )
        task.config = data.get('config', {})
        
        db.session.add(task)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': to_dict(task),
            'message': '任务创建成功'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400


@app.route('/api/tasks', methods=['GET'])
def list_tasks():
    """列出所有任务"""
    tasks = MigrationTask.query.order_by(MigrationTask.created_at.desc()).all()
    result = []
    for task in tasks:
        task_dict = to_dict(task)
        if task.rpc_service:
            task_dict['rpc_service'] = to_dict(task.rpc_service)
        if task.proto_service:
            task_dict['proto_service'] = to_dict(task.proto_service)
        result.append(task_dict)
    return jsonify({'success': True, 'data': result})


@app.route('/api/tasks/<int:task_id>', methods=['GET'])
def get_task(task_id):
    """获取单个任务详情"""
    task = MigrationTask.query.get_or_404(task_id)
    
    task_dict = to_dict(task)
    if task.rpc_service:
        task_dict['rpc_service'] = to_dict(task.rpc_service)
        task_dict['rpc_methods'] = [to_dict(m) for m in task.rpc_service.methods.all()]
    if task.proto_service:
        task_dict['proto_service'] = to_dict(task.proto_service)
        task_dict['proto_methods'] = [to_dict(m) for m in task.proto_service.methods.all()]
    
    return jsonify({'success': True, 'data': task_dict})


@app.route('/api/tasks/<int:task_id>/run', methods=['POST'])
def run_task(task_id):
    """运行迁移评审任务"""
    try:
        task = MigrationTask.query.get_or_404(task_id)
        task.status = 'running'
        db.session.commit()
        
        data = request.json or {}
        test_cases = data.get('test_cases', [])
        
        if not test_cases:
            test_cases = [
                {
                    'method': 'GetUser',
                    'request': {'user_id': '123', 'name': 'Test'},
                    'metadata': [{'key': 'Authorization', 'value': 'Bearer token'}]
                }
            ]
        
        all_comparison_results = []
        all_differences = []
        
        legacy_adapter = LegacyRpcAdapter(task.config.get('legacy_adapter', {}))
        grpc_adapter = GrpcAdapter(task.config.get('grpc_adapter', {}))
        
        for test_case in test_cases:
            method_name = test_case.get('method', 'Unknown')
            request_data = test_case.get('request', {})
            metadata = test_case.get('metadata', [])
            deadline_ms = test_case.get('deadline_ms', 30000)
            
            legacy_response = legacy_adapter.call(
                method_name, request_data, metadata, deadline_ms
            )
            
            grpc_response = grpc_adapter.call(
                task.proto_service.service_name if task.proto_service else 'Service',
                method_name, request_data, metadata, deadline_ms
            )
            
            comparators = [
                ('field', FieldComparator()),
                ('deadline', DeadlineComparator()),
                ('status_code', StatusCodeComparator()),
                ('retry', RetryComparator()),
                ('error_mapping', ErrorMappingComparator()),
                ('metadata', MetadataComparator()),
            ]
            
            for comp_type, comparator in comparators:
                if comp_type == 'field':
                    legacy_data = legacy_response.get('data', {})
                    grpc_data = grpc_response.get('data', {})
                else:
                    legacy_data = {
                        **legacy_response,
                        'retry_policy': task.config.get('retry_policy', {}),
                        'error_codes': [],
                        'metadata': metadata,
                        'deadline_ms': deadline_ms
                    }
                    grpc_data = {
                        **grpc_response,
                        'retry_policy': task.config.get('grpc_retry_policy', {}),
                        'error_config': task.config.get('error_mapping', {}),
                        'metadata': metadata,
                        'deadline_ms': deadline_ms
                    }
                
                result = comparator.compare(legacy_data, grpc_data)
                result_dict = comparator.to_dict(result)
                result_dict['test_case'] = test_case
                
                comparison_result = ComparisonResult(
                    task_id=task.id,
                    comparison_type=comp_type,
                    is_match=result.is_match
                )
                comparison_result.legacy_data = legacy_data
                comparison_result.grpc_data = grpc_data
                comparison_result.details = result.details
                
                db.session.add(comparison_result)
                db.session.flush()
                
                for issue in result.issues:
                    diff = Difference(
                        task_id=task.id,
                        comparison_result_id=comparison_result.id,
                        difference_type=issue.issue_type,
                        severity=issue.severity,
                        description=issue.message,
                        suggestion=issue.suggestion
                    )
                    diff.legacy_value = issue.legacy_value
                    diff.grpc_value = issue.grpc_value
                    
                    db.session.add(diff)
                    all_differences.append({
                        'difference_type': issue.issue_type,
                        'severity': issue.severity,
                        'description': issue.message,
                        'legacy_value': issue.legacy_value,
                        'grpc_value': issue.grpc_value
                    })
                
                all_comparison_results.append(result_dict)
        
        task.status = 'completed'
        task.progress = 100
        task.completed_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': {
                'task': to_dict(task),
                'comparison_results': all_comparison_results,
                'differences': all_differences,
                'total_comparisons': len(all_comparison_results),
                'total_differences': len(all_differences)
            },
            'message': '任务执行完成'
        })
    except Exception as e:
        task.status = 'failed'
        db.session.commit()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/tasks/<int:task_id>/differences', methods=['GET'])
def get_task_differences(task_id):
    """获取任务的差异列表"""
    task = MigrationTask.query.get_or_404(task_id)
    
    differences = Difference.query.filter_by(task_id=task_id).order_by(
        Difference.severity.desc(),
        Difference.created_at.desc()
    ).all()
    
    result = []
    for diff in differences:
        diff_dict = to_dict(diff)
        result.append(diff_dict)
    
    return jsonify({'success': True, 'data': result})


@app.route('/api/differences/<int:diff_id>/confirm', methods=['POST'])
def confirm_difference(diff_id):
    """人工确认差异"""
    try:
        diff = Difference.query.get_or_404(diff_id)
        data = request.json
        
        confirmation_type = data.get('type', 'ignore')
        comment = data.get('comment', '')
        confirmed_by = data.get('confirmed_by', 'unknown')
        
        confirmation = ManualConfirmation(
            task_id=diff.task_id,
            difference_id=diff.id,
            confirmed_by=confirmed_by,
            confirmation_type=confirmation_type,
            comment=comment
        )
        db.session.add(confirmation)
        
        if confirmation_type in ['accept', 'ignore']:
            diff.is_resolved = True
            diff.resolved_by = confirmed_by
            diff.resolved_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': {
                'difference': to_dict(diff),
                'confirmation': to_dict(confirmation)
            },
            'message': '确认成功'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400


@app.route('/api/tasks/<int:task_id>/export/<format_type>', methods=['GET'])
def export_task(task_id, format_type):
    """导出任务报告"""
    try:
        task = MigrationTask.query.get_or_404(task_id)
        
        comparison_results = ComparisonResult.query.filter_by(task_id=task_id).all()
        differences = Difference.query.filter_by(task_id=task_id).all()
        confirmations = ManualConfirmation.query.filter_by(task_id=task_id).all()
        
        results_dict = []
        for r in comparison_results:
            rd = to_dict(r)
            rd['legacy_data'] = r.legacy_data
            rd['grpc_data'] = r.grpc_data
            rd['details'] = r.details
            results_dict.append(rd)
        
        diffs_dict = []
        for d in differences:
            dd = to_dict(d)
            dd['legacy_value'] = d.legacy_value
            dd['grpc_value'] = d.grpc_value
            diffs_dict.append(dd)
        
        confs_dict = [to_dict(c) for c in confirmations]
        
        task_dict = to_dict(task)
        
        if format_type.lower() == 'markdown':
            generator = MarkdownReport()
            content = generator.generate(task_dict, results_dict, diffs_dict, confs_dict)
            
            with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False) as f:
                f.write(content)
                temp_path = f.name
            
            export_record = ExportRecord(
                task_id=task.id,
                format_type='markdown',
                file_path=temp_path
            )
            db.session.add(export_record)
            db.session.commit()
            
            return send_file(
                temp_path,
                mimetype='text/markdown',
                as_attachment=True,
                download_name=f'migration-report-{task.id}.md'
            )
        
        elif format_type.lower() == 'json':
            generator = JsonReport()
            content = generator.generate(task_dict, results_dict, diffs_dict, confs_dict)
            
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
                f.write(content)
                temp_path = f.name
            
            export_record = ExportRecord(
                task_id=task.id,
                format_type='json',
                file_path=temp_path
            )
            db.session.add(export_record)
            db.session.commit()
            
            return send_file(
                temp_path,
                mimetype='application/json',
                as_attachment=True,
                download_name=f'migration-report-{task.id}.json'
            )
        
        else:
            return jsonify({
                'success': False,
                'error': f'不支持的格式: {format_type}'
            }), 400
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/bad-examples', methods=['POST'])
def create_bad_example():
    """创建坏样例"""
    try:
        data = request.json
        
        example = BadExample(
            task_id=data.get('task_id'),
            example_type=data.get('example_type', 'field_mismatch'),
            name=data.get('name', '未命名坏样例'),
            description=data.get('description', '')
        )
        example.test_data = data.get('test_data', {})
        example.expected_issues = data.get('expected_issues', [])
        
        db.session.add(example)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': to_dict(example),
            'message': '坏样例创建成功'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400


@app.route('/api/bad-examples/<int:example_id>/run', methods=['POST'])
def run_bad_example(example_id):
    """运行坏样例校验"""
    try:
        example = BadExample.query.get_or_404(example_id)
        
        test_data = example.test_data
        legacy_data = test_data.get('legacy', {})
        grpc_data = test_data.get('grpc', {})
        example_type = example.example_type
        
        comparator_map = {
            'field_mismatch': FieldComparator,
            'deadline_mismatch': DeadlineComparator,
            'status_code_mismatch': StatusCodeComparator,
            'error_mapping': ErrorMappingComparator,
            'metadata': MetadataComparator,
            'retry': RetryComparator
        }
        
        comparator_class = comparator_map.get(example_type)
        if not comparator_class:
            comparator_class = FieldComparator
        
        comparator = comparator_class()
        result = comparator.compare(legacy_data, grpc_data)
        
        detected_issues = [
            {
                'issue_type': i.issue_type,
                'severity': i.severity,
                'message': i.message,
                'field_path': i.field_path
            }
            for i in result.issues
        ]
        
        expected_issues = example.expected_issues
        expected_set = set(i.get('issue_type') for i in expected_issues)
        detected_set = set(i.get('issue_type') for i in detected_issues)
        
        is_detected = len(expected_set & detected_set) == len(expected_set)
        
        example.is_detected = is_detected
        example.detected_issues = detected_issues
        example.tested_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': {
                'example': to_dict(example),
                'is_detected': is_detected,
                'expected_issues': expected_issues,
                'detected_issues': detected_issues,
                'missing_issues': list(expected_set - detected_set),
                'extra_issues': list(detected_set - expected_set)
            },
            'message': '坏样例校验完成'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/bad-examples', methods=['GET'])
def list_bad_examples():
    """列出所有坏样例"""
    examples = BadExample.query.order_by(BadExample.created_at.desc()).all()
    result = []
    for example in examples:
        ex_dict = to_dict(example)
        ex_dict['test_data'] = example.test_data
        ex_dict['expected_issues'] = example.expected_issues
        ex_dict['detected_issues'] = example.detected_issues
        result.append(ex_dict)
    return jsonify({'success': True, 'data': result})


@app.route('/api/seed', methods=['POST'])
def seed_data():
    """导入样例数据"""
    try:
        from seed import seed_all
        result = seed_all()
        return jsonify({
            'success': True,
            'data': result,
            'message': '样例数据导入成功'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)
