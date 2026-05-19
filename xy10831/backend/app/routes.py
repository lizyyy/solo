from flask import request, jsonify
import json
import uuid
from datetime import datetime
from app.models import (
    db, OriginalRequest, MaskingRule, ReplayEnvironment,
    AuthorizationRecord, ReplayResult, ResponseComparison, AuditLog
)
from app.services import (
    MaskingEngine, ReplayExecutor, ApprovalService, 
    ComparisonService, AuditService
)

def register_routes(app):
    
    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({'status': 'ok', 'timestamp': datetime.utcnow().isoformat()})
    
    @app.route('/api/requests', methods=['GET', 'POST'])
    def requests_list():
        if request.method == 'POST':
            data = request.json
            req = OriginalRequest(
                request_id=data.get('request_id', 'req_' + uuid.uuid4().hex[:8]),
                method=data.get('method', 'POST'),
                url=data.get('url', ''),
                headers=json.dumps(data.get('headers', {})),
                body=json.dumps(data.get('body', {})),
                source=data.get('source', 'manual'),
                status='pending',
                created_by=data.get('created_by', 'system')
            )
            db.session.add(req)
            db.session.commit()
            
            AuditService.log(
                'request_created', 'original_request', str(req.id),
                data.get('created_by', 'system'), data
            )
            
            return jsonify(req.to_dict()), 201
        else:
            page = request.args.get('page', 1, type=int)
            per_page = request.args.get('per_page', 20, type=int)
            status = request.args.get('status')
            search = request.args.get('search')
            
            query = OriginalRequest.query
            if status:
                query = query.filter_by(status=status)
            if search:
                query = query.filter(OriginalRequest.url.contains(search))
            
            pagination = query.order_by(OriginalRequest.captured_at.desc())\
                .paginate(page=page, per_page=per_page, error_out=False)
            
            return jsonify({
                'items': [r.to_dict() for r in pagination.items],
                'total': pagination.total,
                'page': page,
                'per_page': per_page
            })
    
    @app.route('/api/requests/<request_id>', methods=['GET'])
    def get_request(request_id):
        req = OriginalRequest.query.filter_by(request_id=request_id).first()
        if not req:
            return jsonify({'error': 'Not found'}), 404
        return jsonify(req.to_dict())
    
    @app.route('/api/rules', methods=['GET', 'POST'])
    def rules_list():
        if request.method == 'POST':
            data = request.json
            rule = MaskingRule(
                name=data.get('name', ''),
                description=data.get('description', ''),
                field_path=data.get('field_path', ''),
                mask_type=data.get('mask_type', 'full'),
                mask_pattern=data.get('mask_pattern'),
                is_active=data.get('is_active', True)
            )
            db.session.add(rule)
            db.session.commit()
            return jsonify(rule.to_dict()), 201
        else:
            rules = MaskingRule.query.order_by(MaskingRule.created_at.desc()).all()
            return jsonify([r.to_dict() for r in rules])
    
    @app.route('/api/rules/<int:rule_id>', methods=['PUT', 'DELETE'])
    def rule_detail(rule_id):
        rule = MaskingRule.query.get(rule_id)
        if not rule:
            return jsonify({'error': 'Not found'}), 404
        
        if request.method == 'DELETE':
            db.session.delete(rule)
            db.session.commit()
            return jsonify({'message': 'deleted'})
        
        data = request.json
        rule.name = data.get('name', rule.name)
        rule.description = data.get('description', rule.description)
        rule.field_path = data.get('field_path', rule.field_path)
        rule.mask_type = data.get('mask_type', rule.mask_type)
        rule.mask_pattern = data.get('mask_pattern', rule.mask_pattern)
        rule.is_active = data.get('is_active', rule.is_active)
        db.session.commit()
        return jsonify(rule.to_dict())
    
    @app.route('/api/environments', methods=['GET', 'POST'])
    def environments_list():
        if request.method == 'POST':
            data = request.json
            env = ReplayEnvironment(
                name=data.get('name', ''),
                base_url=data.get('base_url', ''),
                description=data.get('description', ''),
                is_production=data.get('is_production', False),
                requires_approval=data.get('requires_approval', False),
                headers=json.dumps(data.get('headers', {})),
                is_active=True
            )
            db.session.add(env)
            db.session.commit()
            return jsonify(env.to_dict()), 201
        else:
            envs = ReplayEnvironment.query.filter_by(is_active=True)\
                .order_by(ReplayEnvironment.created_at.desc()).all()
            return jsonify([e.to_dict() for e in envs])
    
    @app.route('/api/environments/<int:env_id>', methods=['PUT', 'DELETE'])
    def environment_detail(env_id):
        env = ReplayEnvironment.query.get(env_id)
        if not env:
            return jsonify({'error': 'Not found'}), 404
        
        if request.method == 'DELETE':
            env.is_active = False
            db.session.commit()
            return jsonify({'message': 'deleted'})
        
        data = request.json
        env.name = data.get('name', env.name)
        env.base_url = data.get('base_url', env.base_url)
        env.description = data.get('description', env.description)
        env.is_production = data.get('is_production', env.is_production)
        env.requires_approval = data.get('requires_approval', env.requires_approval)
        env.headers = json.dumps(data.get('headers', json.loads(env.headers)))
        db.session.commit()
        return jsonify(env.to_dict())
    
    @app.route('/api/authorizations', methods=['GET', 'POST'])
    def authorizations_list():
        if request.method == 'POST':
            data = request.json
            auth = ApprovalService.request_approval(
                data.get('request_id'),
                data.get('environment_id'),
                data.get('requester', 'system'),
                data.get('reason', '')
            )
            return jsonify(auth.to_dict()), 201
        else:
            status = request.args.get('status')
            query = AuthorizationRecord.query.order_by(AuthorizationRecord.requested_at.desc())
            if status:
                query = query.filter_by(status=status)
            return jsonify([a.to_dict() for a in query.all()])
    
    @app.route('/api/authorizations/<int:auth_id>/approve', methods=['POST'])
    def approve_authorization(auth_id):
        data = request.json
        auth, error = ApprovalService.approve(
            auth_id,
            data.get('approver', 'system'),
            data.get('note', '')
        )
        if error:
            return jsonify({'error': error}), 400
        return jsonify(auth.to_dict())
    
    @app.route('/api/authorizations/<int:auth_id>/reject', methods=['POST'])
    def reject_authorization(auth_id):
        data = request.json
        auth, error = ApprovalService.reject(
            auth_id,
            data.get('approver', 'system'),
            data.get('note', '')
        )
        if error:
            return jsonify({'error': error}), 400
        return jsonify(auth.to_dict())
    
    @app.route('/api/replays', methods=['GET', 'POST'])
    def replays_list():
        if request.method == 'POST':
            data = request.json
            result, error = ReplayExecutor.execute_replay(
                data.get('request_id'),
                data.get('environment_id'),
                data.get('executed_by', 'system'),
                data.get('authorization_id')
            )
            if error:
                return jsonify({'error': error}), 400
            return jsonify(result.to_dict()), 201
        else:
            results = ReplayResult.query.order_by(ReplayResult.started_at.desc())\
                .limit(50).all()
            return jsonify([r.to_dict() for r in results])
    
    @app.route('/api/replays/<int:result_id>', methods=['GET'])
    def get_replay_result(result_id):
        result = ReplayResult.query.get(result_id)
        if not result:
            return jsonify({'error': 'Not found'}), 404
        return jsonify(result.to_dict())
    
    @app.route('/api/comparisons', methods=['GET', 'POST'])
    def comparisons_list():
        if request.method == 'POST':
            data = request.json
            result, error = ComparisonService.compare_results(
                data.get('baseline_id'),
                data.get('comparison_id')
            )
            if error:
                return jsonify({'error': error}), 400
            return jsonify(result.to_dict()), 201
        else:
            results = ResponseComparison.query.order_by(ResponseComparison.created_at.desc())\
                .limit(20).all()
            return jsonify([r.to_dict() for r in results])
    
    @app.route('/api/audit', methods=['GET'])
    def audit_logs():
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        action = request.args.get('action')
        
        query = AuditLog.query.order_by(AuditLog.created_at.desc())
        if action:
            query = query.filter_by(action=action)
        
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        return jsonify({
            'items': [a.to_dict() for a in pagination.items],
            'total': pagination.total
        })
    
    @app.route('/api/mask/preview', methods=['POST'])
    def preview_mask():
        data = request.json
        original_data = data.get('data', {})
        masked_data = MaskingEngine.apply_masking(original_data)
        return jsonify({
            'original': original_data,
            'masked': masked_data
        })
    
    @app.route('/api/export/requests', methods=['GET'])
    def export_requests():
        requests = OriginalRequest.query.order_by(OriginalRequest.captured_at.desc()).limit(1000).all()
        return jsonify([r.to_dict() for r in requests])
    
    @app.route('/api/init-demo', methods=['POST'])
    def init_demo_data():
        if MaskingRule.query.count() > 0:
            return jsonify({'message': 'already initialized'})
        
        phone_rule = MaskingRule(
            name='手机号脱敏', description='对手机号中间4位打码',
            field_path='phone', mask_type='phone'
        )
        email_rule = MaskingRule(
            name='邮箱脱敏', description='对邮箱本地部分打码',
            field_path='email', mask_type='email'
        )
        secret_rule = MaskingRule(
            name='密钥完全脱敏', description='完全隐藏密钥字段',
            field_path='secret_key', mask_type='full'
        )
        idcard_rule = MaskingRule(
            name='身份证号脱敏', description='身份证号部分隐藏',
            field_path='id_card', mask_type='partial'
        )
        db.session.add_all([phone_rule, email_rule, secret_rule, idcard_rule])
        
        dev_env = ReplayEnvironment(
            name='开发环境', base_url='http://httpbin.org',
            description='本地开发测试环境',
            is_production=False, requires_approval=False,
            headers=json.dumps({'X-Env': 'dev'})
        )
        staging_env = ReplayEnvironment(
            name='预发环境', base_url='https://httpbin.org',
            description='预发验证环境',
            is_production=False, requires_approval=True,
            headers=json.dumps({'X-Env': 'staging'})
        )
        prod_env = ReplayEnvironment(
            name='生产环境', base_url='https://httpbin.org',
            description='生产环境-需要严格审批',
            is_production=True, requires_approval=True,
            headers=json.dumps({'X-Env': 'prod'})
        )
        db.session.add_all([dev_env, staging_env, prod_env])
        
        demo_body = {
            'phone': '13812345678',
            'email': 'user@example.com',
            'secret_key': 'sk-xxxx-yyyy-zzzz',
            'id_card': '110101199001011234',
            'amount': 100.50,
            'order_id': 'ORD001'
        }
        demo_req = OriginalRequest(
            request_id='req_demo_001', method='POST',
            url='/post', headers=json.dumps({'Content-Type': 'application/json'}),
            body=json.dumps(demo_body), source='demo', created_by='system'
        )
        db.session.add(demo_req)
        
        db.session.commit()
        return jsonify({'message': 'demo data initialized'})
