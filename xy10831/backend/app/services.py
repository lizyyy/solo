import json
import re
import requests
import time
from datetime import datetime, timedelta
from difflib import SequenceMatcher
from app.models import (
    db, MaskingRule, ReplayResult, AuthorizationRecord,
    ResponseComparison, AuditLog, OriginalRequest, ReplayEnvironment
)

class MaskingEngine:
    @staticmethod
    def get_nested_value(data, path):
        keys = path.split('.')
        value = data
        for key in keys:
            if isinstance(value, dict) and key in value:
                value = value[key]
            else:
                return None
        return value

    @staticmethod
    def set_nested_value(data, path, value):
        keys = path.split('.')
        current = data
        for key in keys[:-1]:
            if key not in current:
                current[key] = {}
            current = current[key]
        current[keys[-1]] = value

    @staticmethod
    def mask_value(value, mask_type, pattern=None):
        if value is None:
            return None
        
        if mask_type == 'phone':
            s = str(value)
            if len(s) >= 7:
                return s[:3] + '****' + s[-4:]
            return '****'
        
        elif mask_type == 'email':
            s = str(value)
            if '@' in s:
                local, domain = s.split('@', 1)
                return local[0] + '***@' + domain
            return '***@***.com'
        
        elif mask_type == 'full':
            return '***'
        
        elif mask_type == 'partial':
            s = str(value)
            if len(s) > 4:
                return s[:2] + '***' + s[-2:]
            return '***'
        
        elif mask_type == 'regex' and pattern:
            return re.sub(pattern, '***', str(value))
        
        return '***'

    @classmethod
    def apply_masking(cls, data, rules=None):
        if rules is None:
            rules = MaskingRule.query.filter_by(is_active=True).all()
        
        masked_data = json.loads(json.dumps(data))
        
        for rule in rules:
            value = cls.get_nested_value(masked_data, rule.field_path)
            if value is not None:
                masked_value = cls.mask_value(value, rule.mask_type, rule.mask_pattern)
                cls.set_nested_value(masked_data, rule.field_path, masked_value)
        
        return masked_data

class ReplayExecutor:
    @staticmethod
    def execute_replay(request_id, environment_id, user='system', authorization_id=None):
        original_request = OriginalRequest.query.filter_by(request_id=request_id).first()
        environment = ReplayEnvironment.query.get(environment_id)
        
        if not original_request or not environment:
            return None, "请求或环境不存在"
        
        if environment.requires_approval and not authorization_id:
            auth = AuthorizationRecord.query.filter_by(
                request_id=request_id,
                environment_id=environment_id,
                status='approved'
            ).first()
            if not auth:
                return None, "该环境需要审批授权"
            authorization_id = auth.id
        
        replay_result = ReplayResult(
            request_id=request_id,
            environment_id=environment_id,
            authorization_id=authorization_id,
            status='running',
            started_at=datetime.utcnow(),
            executed_by=user
        )
        db.session.add(replay_result)
        db.session.commit()
        
        try:
            original_body = json.loads(original_request.body) if original_request.body else {}
            masked_body = MaskingEngine.apply_masking(original_body)
            
            replay_result.masked_body = json.dumps(masked_body)
            db.session.commit()
            
            env_headers = json.loads(environment.headers) if environment.headers else {}
            original_headers = json.loads(original_request.headers) if original_request.headers else {}
            headers = {**original_headers, **env_headers}
            
            url = environment.base_url.rstrip('/') + '/' + original_request.url.lstrip('/')
            
            start_time = time.time()
            
            response = requests.request(
                method=original_request.method,
                url=url,
                headers=headers,
                json=masked_body if original_request.method != 'GET' else None,
                params=masked_body if original_request.method == 'GET' else None,
                timeout=30
            )
            
            end_time = time.time()
            
            replay_result.status = 'success'
            replay_result.response_status = response.status_code
            replay_result.response_headers = json.dumps(dict(response.headers))
            replay_result.response_body = response.text[:10000] if response.text else ''
            replay_result.response_time_ms = int((end_time - start_time) * 1000)
            replay_result.completed_at = datetime.utcnow()
            
        except Exception as e:
            replay_result.status = 'failed'
            replay_result.error_message = str(e)
            replay_result.completed_at = datetime.utcnow()
        
        db.session.commit()
        
        AuditService.log(
            'replay_execute',
            'replay_result',
            str(replay_result.id),
            user,
            {'status': replay_result.status}
        )
        
        return replay_result, None

class ApprovalService:
    @staticmethod
    def request_approval(request_id, environment_id, requester, reason):
        auth = AuthorizationRecord(
            request_id=request_id,
            environment_id=environment_id,
            requester=requester,
            reason=reason,
            status='pending',
            expires_at=datetime.utcnow() + timedelta(days=7)
        )
        db.session.add(auth)
        db.session.commit()
        
        AuditService.log(
            'approval_requested',
            'authorization',
            str(auth.id),
            requester,
            {'reason': reason}
        )
        
        return auth

    @staticmethod
    def approve(auth_id, approver, note=''):
        auth = AuthorizationRecord.query.get(auth_id)
        if not auth:
            return None, "授权记录不存在"
        
        auth.status = 'approved'
        auth.approver = approver
        auth.approval_note = note
        auth.approved_at = datetime.utcnow()
        db.session.commit()
        
        AuditService.log(
            'approval_approved',
            'authorization',
            str(auth.id),
            approver,
            {'note': note}
        )
        
        return auth, None

    @staticmethod
    def reject(auth_id, approver, note=''):
        auth = AuthorizationRecord.query.get(auth_id)
        if not auth:
            return None, "授权记录不存在"
        
        auth.status = 'rejected'
        auth.approver = approver
        auth.approval_note = note
        auth.approved_at = datetime.utcnow()
        db.session.commit()
        
        AuditService.log(
            'approval_rejected',
            'authorization',
            str(auth.id),
            approver,
            {'note': note}
        )
        
        return auth, None

class ComparisonService:
    @staticmethod
    def compare_results(baseline_id, comparison_id):
        baseline = ReplayResult.query.get(baseline_id)
        comparison = ReplayResult.query.get(comparison_id)
        
        if not baseline or not comparison:
            return None, "重放结果不存在"
        
        status_code_match = baseline.response_status == comparison.response_status
        
        baseline_body = baseline.response_body or ''
        comparison_body = comparison.response_body or ''
        body_similarity = SequenceMatcher(None, baseline_body, comparison_body).ratio()
        
        differences = []
        
        if baseline.response_status != comparison.response_status:
            differences.append({
                'type': 'status_code',
                'field': 'status',
                'baseline': baseline.response_status,
                'comparison': comparison.response_status
            })
        
        if baseline.response_time_ms and comparison.response_time_ms:
            time_diff = abs(baseline.response_time_ms - comparison.response_time_ms)
            if time_diff > 100:
                differences.append({
                    'type': 'response_time',
                    'field': 'response_time_ms',
                    'baseline': baseline.response_time_ms,
                    'comparison': comparison.response_time_ms,
                    'diff_ms': time_diff
                })
        
        comparison_result = ResponseComparison(
            baseline_result_id=baseline_id,
            comparison_result_id=comparison_id,
            status_code_match=status_code_match,
            body_similarity=body_similarity,
            differences=json.dumps(differences),
            comparison_summary=f"状态码{'一致' if status_code_match else '不一致'}, 响应相似度: {body_similarity:.2%}"
        )
        db.session.add(comparison_result)
        db.session.commit()
        
        return comparison_result, None

class AuditService:
    @staticmethod
    def log(action, entity_type, entity_id, user, details=None, ip_address=None):
        audit = AuditLog(
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            user=user,
            details=json.dumps(details) if details else None,
            ip_address=ip_address
        )
        db.session.add(audit)
        db.session.commit()
        return audit
