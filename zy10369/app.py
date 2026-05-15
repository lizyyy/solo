from flask import Flask, jsonify, request
from flask_cors import CORS
from datetime import datetime
import json
import uuid
from collections import defaultdict

from models import (
    RequestSample, DownstreamSegment, TimeBucket, TimeoutType,
    TroubleshootNote, FixRecord, SampleStatus, TimeoutCategory
)
from core import TimeoutProfiler
from storage import InMemoryStorage

app = Flask(__name__)
CORS(app)

storage = InMemoryStorage()
profiler = TimeoutProfiler(storage)


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.now().isoformat(),
        'stats': storage.get_stats()
    })


@app.route('/api/samples', methods=['POST'])
def create_sample():
    try:
        data = request.get_json()
        
        required_fields = ['request_id', 'api_name', 'total_time_ms', 'segments']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'error': f'Missing required field: {field}',
                    'code': 'MISSING_FIELD'
                }), 400
        
        if storage.get_sample(data['request_id']):
            return jsonify({
                'error': 'Sample with this request_id already exists',
                'code': 'DUPLICATE_SAMPLE',
                'request_id': data['request_id']
            }), 409
        
        segments = []
        for seg_data in data['segments']:
            segment = DownstreamSegment(
                name=seg_data['name'],
                start_time=seg_data['start_time'],
                end_time=seg_data['end_time'],
                duration_ms=seg_data.get('duration_ms', seg_data['end_time'] - seg_data['start_time']),
                status_code=seg_data.get('status_code'),
                error=seg_data.get('error')
            )
            segments.append(segment)
        
        sample = RequestSample(
            request_id=data['request_id'],
            api_name=data['api_name'],
            total_time_ms=data['total_time_ms'],
            segments=segments,
            metadata=data.get('metadata', {})
        )
        
        result = profiler.analyze_sample(sample)
        storage.save_sample(sample)
        
        return jsonify({
            'message': 'Sample created successfully',
            'request_id': sample.request_id,
            'analysis': result,
            'status': sample.status.value
        }), 201
        
    except Exception as e:
        return jsonify({
            'error': str(e),
            'code': 'CREATE_ERROR'
        }), 500


@app.route('/api/samples', methods=['GET'])
def list_samples():
    try:
        api_name = request.args.get('api_name')
        status = request.args.get('status')
        timeout_type = request.args.get('timeout_type')
        
        samples = storage.list_samples(
            api_name=api_name,
            status=SampleStatus(status) if status else None,
            timeout_type=TimeoutCategory(timeout_type) if timeout_type else None
        )
        
        return jsonify({
            'count': len(samples),
            'samples': [s.to_dict() for s in samples]
        })
        
    except Exception as e:
        return jsonify({
            'error': str(e),
            'code': 'LIST_ERROR'
        }), 500


@app.route('/api/samples/<request_id>', methods=['GET'])
def get_sample(request_id):
    try:
        sample = storage.get_sample(request_id)
        if not sample:
            return jsonify({
                'error': 'Sample not found',
                'code': 'NOT_FOUND'
            }), 404
        
        return jsonify(sample.to_dict())
        
    except Exception as e:
        return jsonify({
            'error': str(e),
            'code': 'GET_ERROR'
        }), 500


@app.route('/api/samples/<request_id>/advance', methods=['POST'])
def advance_sample(request_id):
    try:
        data = request.get_json() or {}
        new_status = data.get('status')
        
        if not new_status:
            return jsonify({
                'error': 'Missing status field',
                'code': 'MISSING_STATUS'
            }), 400
        
        try:
            target_status = SampleStatus(new_status)
        except ValueError:
            return jsonify({
                'error': f'Invalid status: {new_status}',
                'code': 'INVALID_STATUS'
            }), 400
        
        sample = storage.get_sample(request_id)
        if not sample:
            return jsonify({
                'error': 'Sample not found',
                'code': 'NOT_FOUND'
            }), 404
        
        if sample.status == target_status:
            return jsonify({
                'message': 'Sample already in target status',
                'request_id': request_id,
                'status': sample.status.value
            })
        
        valid_transitions = {
            SampleStatus.CREATED: [SampleStatus.ANALYZED, SampleStatus.DISCARDED],
            SampleStatus.ANALYZED: [SampleStatus.TROUBLESHOOTING, SampleStatus.RESOLVED, SampleStatus.DISCARDED],
            SampleStatus.TROUBLESHOOTING: [SampleStatus.RESOLVED, SampleStatus.DISCARDED]
        }
        
        if target_status not in valid_transitions.get(sample.status, []):
            return jsonify({
                'error': f'Invalid status transition from {sample.status.value} to {target_status.value}',
                'code': 'INVALID_TRANSITION'
            }), 400
        
        sample.status = target_status
        sample.updated_at = datetime.now()
        storage.save_sample(sample)
        
        return jsonify({
            'message': 'Status advanced successfully',
            'request_id': request_id,
            'old_status': sample.status.value,
            'new_status': target_status.value
        })
        
    except Exception as e:
        return jsonify({
            'error': str(e),
            'code': 'ADVANCE_ERROR'
        }), 500


@app.route('/api/samples/<request_id>/notes', methods=['POST'])
def add_note(request_id):
    try:
        data = request.get_json()
        
        if 'content' not in data:
            return jsonify({
                'error': 'Missing content field',
                'code': 'MISSING_CONTENT'
            }), 400
        
        sample = storage.get_sample(request_id)
        if not sample:
            return jsonify({
                'error': 'Sample not found',
                'code': 'NOT_FOUND'
            }), 404
        
        note = TroubleshootNote(
            note_id=str(uuid.uuid4()),
            content=data['content'],
            author=data.get('author', 'system'),
            tags=data.get('tags', [])
        )
        
        sample.notes.append(note)
        sample.updated_at = datetime.now()
        storage.save_sample(sample)
        
        return jsonify({
            'message': 'Note added successfully',
            'note_id': note.note_id,
            'request_id': request_id
        }), 201
        
    except Exception as e:
        return jsonify({
            'error': str(e),
            'code': 'NOTE_ERROR'
        }), 500


@app.route('/api/samples/<request_id>/fixes', methods=['POST'])
def add_fix_record(request_id):
    try:
        data = request.get_json()
        
        required_fields = ['description', 'fix_type']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'error': f'Missing required field: {field}',
                    'code': 'MISSING_FIELD'
                }), 400
        
        sample = storage.get_sample(request_id)
        if not sample:
            return jsonify({
                'error': 'Sample not found',
                'code': 'NOT_FOUND'
            }), 404
        
        fix = FixRecord(
            fix_id=str(uuid.uuid4()),
            description=data['description'],
            fix_type=data['fix_type'],
            author=data.get('author', 'system'),
            effectiveness=data.get('effectiveness')
        )
        
        sample.fix_records.append(fix)
        sample.updated_at = datetime.now()
        storage.save_sample(sample)
        
        return jsonify({
            'message': 'Fix record added successfully',
            'fix_id': fix.fix_id,
            'request_id': request_id
        }), 201
        
    except Exception as e:
        return jsonify({
            'error': str(e),
            'code': 'FIX_ERROR'
        }), 500


@app.route('/api/samples/<request_id>/revoke', methods=['POST'])
def revoke_sample(request_id):
    try:
        sample = storage.get_sample(request_id)
        if not sample:
            return jsonify({
                'error': 'Sample not found',
                'code': 'NOT_FOUND'
            }), 404
        
        if sample.status == SampleStatus.DISCARDED:
            return jsonify({
                'message': 'Sample already discarded',
                'request_id': request_id
            })
        
        data = request.get_json() or {}
        reason = data.get('reason', 'No reason provided')
        
        note = TroubleshootNote(
            note_id=str(uuid.uuid4()),
            content=f'Revoked: {reason}',
            author='system',
            tags=['revocation']
        )
        sample.notes.append(note)
        sample.status = SampleStatus.DISCARDED
        sample.updated_at = datetime.now()
        storage.save_sample(sample)
        
        return jsonify({
            'message': 'Sample revoked successfully',
            'request_id': request_id,
            'reason': reason
        })
        
    except Exception as e:
        return jsonify({
            'error': str(e),
            'code': 'REVOKE_ERROR'
        }), 500


@app.route('/api/export/profile', methods=['GET'])
def export_profile():
    try:
        api_name = request.args.get('api_name')
        format_type = request.args.get('format', 'json')
        
        samples = storage.list_samples(api_name=api_name)
        
        if not samples:
            return jsonify({
                'error': 'No samples found for export',
                'code': 'NO_SAMPLES'
            }), 404
        
        profile = profiler.generate_profile(samples, api_name)
        
        if format_type == 'json':
            return jsonify(profile)
        elif format_type == 'summary':
            return jsonify({
                'api_name': api_name or 'all',
                'total_samples': profile['total_samples'],
                'timeout_distribution': profile['timeout_distribution'],
                'top_slow_segments': profile['segment_stats'][:5],
                'status_summary': profile['status_summary']
            })
        else:
            return jsonify({
                'error': f'Unsupported format: {format_type}',
                'code': 'UNSUPPORTED_FORMAT'
            }), 400
            
    except Exception as e:
        return jsonify({
            'error': str(e),
            'code': 'EXPORT_ERROR'
        }), 500


@app.route('/api/demo/create-samples', methods=['POST'])
def create_demo_samples():
    try:
        data = request.get_json() or {}
        count = data.get('count', 10)
        api_name = data.get('api_name', 'demo_api')
        
        from demo import generate_demo_samples
        samples = generate_demo_samples(count, api_name)
        
        created_count = 0
        duplicate_count = 0
        
        for sample in samples:
            if storage.get_sample(sample.request_id):
                duplicate_count += 1
                continue
            
            profiler.analyze_sample(sample)
            storage.save_sample(sample)
            created_count += 1
        
        return jsonify({
            'message': 'Demo samples created',
            'created': created_count,
            'duplicates': duplicate_count,
            'total': count
        }), 201
        
    except Exception as e:
        return jsonify({
            'error': str(e),
            'code': 'DEMO_ERROR'
        }), 500


@app.route('/api/demo/trigger-error', methods=['POST'])
def trigger_demo_error():
    try:
        data = request.get_json() or {}
        error_type = data.get('error_type', 'validation')
        
        errors = {
            'validation': {
                'error': 'Demo validation error',
                'code': 'DEMO_VALIDATION_ERROR',
                'example': 'Missing required field: request_id'
            },
            'duplicate': {
                'error': 'Demo duplicate error',
                'code': 'DEMO_DUPLICATE_SAMPLE',
                'example': 'Sample with request_id demo-001 already exists'
            },
            'transition': {
                'error': 'Demo status transition error',
                'code': 'DEMO_INVALID_TRANSITION',
                'example': 'Cannot transition from RESOLVED to TROUBLESHOOTING'
            },
            'notfound': {
                'error': 'Demo not found error',
                'code': 'DEMO_NOT_FOUND',
                'example': 'Sample with request_id non-existent not found'
            }
        }
        
        if error_type not in errors:
            return jsonify({
                'error': f'Unknown error type: {error_type}',
                'available_types': list(errors.keys())
            }), 400
        
        return jsonify(errors[error_type]), 400
        
    except Exception as e:
        return jsonify({
            'error': str(e),
            'code': 'DEMO_ERROR_TRIGGER'
        }), 500


@app.route('/api/stats', methods=['GET'])
def get_stats():
    try:
        return jsonify(storage.get_stats())
    except Exception as e:
        return jsonify({
            'error': str(e),
            'code': 'STATS_ERROR'
        }), 500


@app.route('/api/history', methods=['GET'])
def get_history():
    try:
        request_id = request.args.get('request_id')
        limit = int(request.args.get('limit', 50))
        
        if request_id:
            sample = storage.get_sample(request_id)
            if not sample:
                return jsonify({
                    'error': 'Sample not found',
                    'code': 'NOT_FOUND'
                }), 404
            
            history = []
            if sample.notes:
                for note in sample.notes:
                    history.append({
                        'type': 'note',
                        'timestamp': note.created_at.isoformat(),
                        'data': note.to_dict()
                    })
            if sample.fix_records:
                for fix in sample.fix_records:
                    history.append({
                        'type': 'fix',
                        'timestamp': fix.created_at.isoformat(),
                        'data': fix.to_dict()
                    })
            
            history.sort(key=lambda x: x['timestamp'], reverse=True)
            return jsonify({
                'request_id': request_id,
                'history': history[:limit]
            })
        else:
            samples = storage.list_samples()
            all_history = []
            for sample in samples:
                for note in sample.notes:
                    all_history.append({
                        'request_id': sample.request_id,
                        'type': 'note',
                        'timestamp': note.created_at.isoformat(),
                        'content': note.content
                    })
                for fix in sample.fix_records:
                    all_history.append({
                        'request_id': sample.request_id,
                        'type': 'fix',
                        'timestamp': fix.created_at.isoformat(),
                        'description': fix.description
                    })
            
            all_history.sort(key=lambda x: x['timestamp'], reverse=True)
            return jsonify({
                'count': len(all_history),
                'history': all_history[:limit]
            })
            
    except Exception as e:
        return jsonify({
            'error': str(e),
            'code': 'HISTORY_ERROR'
        }), 500


if __name__ == '__main__':
    print("=" * 60)
    print("下游超时画像 API - 服务启动")
    print("=" * 60)
    print("API 文档可用端点:")
    print("  GET  /api/health          - 健康检查")
    print("  POST /api/samples         - 创建样本")
    print("  GET  /api/samples         - 样本列表")
    print("  GET  /api/samples/<id>    - 查询样本")
    print("  POST /api/samples/<id>/advance - 推进状态")
    print("  POST /api/samples/<id>/notes   - 添加备注")
    print("  POST /api/samples/<id>/fixes   - 添加修复记录")
    print("  POST /api/samples/<id>/revoke  - 撤销样本")
    print("  GET  /api/export/profile  - 导出画像")
    print("  GET  /api/stats           - 统计信息")
    print("  GET  /api/history         - 处理记录")
    print("=" * 60)
    print("演示端点:")
    print("  POST /api/demo/create-samples  - 生成演示数据")
    print("  POST /api/demo/trigger-error   - 触发异常演示")
    print("=" * 60)
    app.run(host='0.0.0.0', port=5000, debug=True)
