from datetime import datetime
import uuid
from typing import Dict, Any, Optional, List

from app import db
from app.models import Inquiry, InquiryStatus
from app.services.validation_service import ValidationService, ValidationError
from app.services.operation_log_service import OperationLogService
from app.models import OperationType

class InquiryService:
    @staticmethod
    def generate_inquiry_no() -> str:
        date_str = datetime.utcnow().strftime('%Y%m%d')
        random_str = uuid.uuid4().hex[:6].upper()
        return f'INQ-{date_str}-{random_str}'
    
    @staticmethod
    def create_inquiry(data: Dict[str, Any]) -> Dict[str, Any]:
        validation_result = ValidationService.validate_inquiry(data)
        if not validation_result.valid:
            return {
                'success': False,
                'error': '数据验证失败',
                'validation_errors': validation_result.to_dict()
            }
        
        try:
            inquiry = Inquiry(
                inquiry_no=InquiryService.generate_inquiry_no(),
                title=data['title'],
                description=data.get('description'),
                created_by=data['created_by'],
                department=data.get('department'),
                project=data.get('project'),
                status=InquiryStatus.DRAFT,
                required_items=data.get('required_items', []),
                quote_deadline=datetime.fromisoformat(
                    str(data['quote_deadline']).replace('Z', '+00:00')
                )
            )
            
            db.session.add(inquiry)
            db.session.flush()
            
            OperationLogService.log_inquiry_operation(
                inquiry=inquiry,
                operation_type=OperationType.CREATE,
                operation_by=data['created_by'],
                before_snapshot=None,
                change_reason='创建询价单'
            )
            
            db.session.commit()
            
            return {
                'success': True,
                'data': inquiry.to_dict()
            }
        except Exception as e:
            db.session.rollback()
            return {
                'success': False,
                'error': f'创建询价单失败: {str(e)}',
                'error_code': 'create_inquiry_failed'
            }
    
    @staticmethod
    def publish_inquiry(inquiry_id: int, operation_by: str) -> Dict[str, Any]:
        inquiry = Inquiry.query.get(inquiry_id)
        if not inquiry:
            return {
                'success': False,
                'error': '询价单不存在',
                'error_code': 'inquiry_not_found'
            }
        
        if inquiry.status not in [InquiryStatus.DRAFT]:
            return {
                'success': False,
                'error': f'当前状态{inquiry.status.value}不允许发布',
                'error_code': 'invalid_status'
            }
        
        try:
            before_snapshot = inquiry.to_dict()
            
            inquiry.status = InquiryStatus.PUBLISHED
            inquiry.publish_date = datetime.utcnow()
            
            OperationLogService.log_inquiry_operation(
                inquiry=inquiry,
                operation_type=OperationType.SUBMIT,
                operation_by=operation_by,
                before_snapshot=before_snapshot,
                change_reason='发布询价单'
            )
            
            db.session.commit()
            
            return {
                'success': True,
                'data': inquiry.to_dict()
            }
        except Exception as e:
            db.session.rollback()
            return {
                'success': False,
                'error': f'发布询价单失败: {str(e)}',
                'error_code': 'publish_inquiry_failed'
            }
    
    @staticmethod
    def update_inquiry(inquiry_id: int, data: Dict[str, Any], operation_by: str) -> Dict[str, Any]:
        inquiry = Inquiry.query.get(inquiry_id)
        if not inquiry:
            return {
                'success': False,
                'error': '询价单不存在',
                'error_code': 'inquiry_not_found'
            }
        
        if inquiry.status not in [InquiryStatus.DRAFT, InquiryStatus.PUBLISHED]:
            return {
                'success': False,
                'error': f'当前状态{inquiry.status.value}不允许修改',
                'error_code': 'invalid_status'
            }
        
        before_snapshot = inquiry.to_dict()
        
        try:
            if 'title' in data:
                inquiry.title = data['title']
            if 'description' in data:
                inquiry.description = data['description']
            if 'department' in data:
                inquiry.department = data['department']
            if 'project' in data:
                inquiry.project = data['project']
            if 'required_items' in data:
                inquiry.required_items = data['required_items']
            if 'quote_deadline' in data:
                inquiry.quote_deadline = datetime.fromisoformat(
                    str(data['quote_deadline']).replace('Z', '+00:00')
                )
            
            OperationLogService.log_inquiry_operation(
                inquiry=inquiry,
                operation_type=OperationType.MANUAL_EDIT,
                operation_by=operation_by,
                before_snapshot=before_snapshot,
                change_reason=data.get('change_reason', '更新询价单信息')
            )
            
            db.session.commit()
            
            return {
                'success': True,
                'data': inquiry.to_dict()
            }
        except Exception as e:
            db.session.rollback()
            return {
                'success': False,
                'error': f'更新询价单失败: {str(e)}',
                'error_code': 'update_inquiry_failed'
            }
    
    @staticmethod
    def cancel_inquiry(inquiry_id: int, operation_by: str, reason: str = None) -> Dict[str, Any]:
        inquiry = Inquiry.query.get(inquiry_id)
        if not inquiry:
            return {
                'success': False,
                'error': '询价单不存在',
                'error_code': 'inquiry_not_found'
            }
        
        if inquiry.status in [InquiryStatus.AWARDED, InquiryStatus.CANCELLED]:
            return {
                'success': False,
                'error': f'当前状态{inquiry.status.value}不允许取消',
                'error_code': 'invalid_status'
            }
        
        try:
            before_snapshot = inquiry.to_dict()
            inquiry.status = InquiryStatus.CANCELLED
            
            OperationLogService.log_inquiry_operation(
                inquiry=inquiry,
                operation_type=OperationType.REJECT,
                operation_by=operation_by,
                before_snapshot=before_snapshot,
                change_reason=reason or '取消询价单'
            )
            
            db.session.commit()
            
            return {
                'success': True,
                'data': inquiry.to_dict()
            }
        except Exception as e:
            db.session.rollback()
            return {
                'success': False,
                'error': f'取消询价单失败: {str(e)}',
                'error_code': 'cancel_inquiry_failed'
            }
    
    @staticmethod
    def get_inquiry(inquiry_id: int) -> Dict[str, Any]:
        inquiry = Inquiry.query.get(inquiry_id)
        if not inquiry:
            return {
                'success': False,
                'error': '询价单不存在',
                'error_code': 'inquiry_not_found'
            }
        
        return {
            'success': True,
            'data': inquiry.to_dict()
        }
    
    @staticmethod
    def get_inquiry_by_no(inquiry_no: str) -> Dict[str, Any]:
        inquiry = Inquiry.query.filter_by(inquiry_no=inquiry_no).first()
        if not inquiry:
            return {
                'success': False,
                'error': '询价单不存在',
                'error_code': 'inquiry_not_found'
            }
        
        return {
            'success': True,
            'data': inquiry.to_dict()
        }
    
    @staticmethod
    def list_inquiries(filters: Dict[str, Any] = None, page: int = 1, per_page: int = 20) -> Dict[str, Any]:
        query = Inquiry.query
        
        if filters:
            if 'status' in filters:
                try:
                    query = query.filter_by(status=InquiryStatus(filters['status']))
                except ValueError:
                    pass
            if 'created_by' in filters:
                query = query.filter_by(created_by=filters['created_by'])
            if 'department' in filters:
                query = query.filter_by(department=filters['department'])
            if 'project' in filters:
                query = query.filter_by(project=filters['project'])
        
        query = query.order_by(Inquiry.created_at.desc())
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return {
            'success': True,
            'data': {
                'items': [inquiry.to_dict() for inquiry in pagination.items],
                'total': pagination.total,
                'page': page,
                'per_page': per_page,
                'pages': pagination.pages
            }
        }
    
    @staticmethod
    def check_deadline_expired(inquiry_id: int) -> Dict[str, Any]:
        inquiry = Inquiry.query.get(inquiry_id)
        if not inquiry:
            return {
                'success': False,
                'error': '询价单不存在',
                'error_code': 'inquiry_not_found'
            }
        
        now = datetime.utcnow()
        is_expired = inquiry.quote_deadline <= now
        
        if is_expired and inquiry.status == InquiryStatus.PUBLISHED:
            before_snapshot = inquiry.to_dict()
            inquiry.status = InquiryStatus.EXPIRED
            
            OperationLogService.log_inquiry_operation(
                inquiry=inquiry,
                operation_type=OperationType.EXPIRE,
                operation_by='system',
                before_snapshot=before_snapshot,
                change_reason='报价截止时间已过，询价单自动过期'
            )
            db.session.commit()
        
        return {
            'success': True,
            'data': {
                'inquiry_id': inquiry_id,
                'is_expired': is_expired,
                'quote_deadline': inquiry.quote_deadline.isoformat(),
                'current_status': inquiry.status.value
            }
        }
