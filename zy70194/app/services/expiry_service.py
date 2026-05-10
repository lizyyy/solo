from datetime import datetime
from typing import Dict, Any, List

from app import db
from app.models import (
    Inquiry, Quote,
    InquiryStatus, QuoteStatus
)
from app.services.operation_log_service import OperationLogService
from app.models import OperationType

class ExpiryService:
    @staticmethod
    def check_all_expiry() -> Dict[str, Any]:
        now = datetime.utcnow()
        inquiries_checked = 0
        expired_inquiries = 0
        quotes_checked = 0
        expired_quotes = 0
        
        try:
            published_inquiries = Inquiry.query.filter_by(
                status=InquiryStatus.PUBLISHED
            ).all()
            
            for inquiry in published_inquiries:
                inquiries_checked += 1
                if inquiry.quote_deadline <= now:
                    before_snapshot = inquiry.to_dict()
                    inquiry.status = InquiryStatus.EXPIRED
                    
                    OperationLogService.log_inquiry_operation(
                        inquiry=inquiry,
                        operation_type=OperationType.EXPIRE,
                        operation_by='system',
                        before_snapshot=before_snapshot,
                        change_reason='报价截止时间已过，询价单自动过期'
                    )
                    expired_inquiries += 1
            
            active_quotes = Quote.query.filter(
                Quote.status.in_([QuoteStatus.SUBMITTED, QuoteStatus.REVISED])
            ).all()
            
            for quote in active_quotes:
                quotes_checked += 1
                is_expired = now > quote.valid_until or now < quote.valid_from
                
                if quote.is_expired != is_expired:
                    before_snapshot = quote.to_dict()
                    quote.is_expired = is_expired
                    quote.expiry_check_at = now
                    
                    expiry_reason = '报价尚未生效' if now < quote.valid_from else '报价已过期'
                    
                    OperationLogService.log_quote_operation(
                        quote=quote,
                        operation_type=OperationType.EXPIRE,
                        operation_by='system',
                        before_snapshot=before_snapshot,
                        change_reason=expiry_reason
                    )
                    
                    if is_expired:
                        expired_quotes += 1
            
            db.session.commit()
            
            return {
                'success': True,
                'data': {
                    'checked_at': now.isoformat(),
                    'inquiries_checked': inquiries_checked,
                    'expired_inquiries': expired_inquiries,
                    'quotes_checked': quotes_checked,
                    'expired_quotes': expired_quotes
                }
            }
        except Exception as e:
            db.session.rollback()
            return {
                'success': False,
                'error': f'有效期检查失败: {str(e)}',
                'error_code': 'expiry_check_failed'
            }
    
    @staticmethod
    def check_inquiry_expiry(inquiry_id: int) -> Dict[str, Any]:
        from app.services.inquiry_service import InquiryService
        return InquiryService.check_deadline_expired(inquiry_id)
    
    @staticmethod
    def check_quote_validity(quote_id: int) -> Dict[str, Any]:
        from app.services.quote_service import QuoteService
        return QuoteService.check_validity(quote_id)
    
    @staticmethod
    def get_expired_quotes(inquiry_id: int = None) -> Dict[str, Any]:
        query = Quote.query.filter_by(is_expired=True)
        
        if inquiry_id:
            query = query.filter_by(inquiry_id=inquiry_id)
        
        quotes = query.all()
        
        return {
            'success': True,
            'data': [quote.to_dict(include_items=False) for quote in quotes]
        }
    
    @staticmethod
    def get_expiring_soon(days: int = 7) -> Dict[str, Any]:
        now = datetime.utcnow()
        future = now + datetime.timedelta(days=days)
        
        expiring_quotes = Quote.query.filter(
            Quote.status.in_([QuoteStatus.SUBMITTED, QuoteStatus.REVISED]),
            Quote.is_expired == False,
            Quote.valid_until > now,
            Quote.valid_until <= future
        ).all()
        
        expiring_inquiries = Inquiry.query.filter(
            Inquiry.status == InquiryStatus.PUBLISHED,
            Inquiry.quote_deadline > now,
            Inquiry.quote_deadline <= future
        ).all()
        
        return {
            'success': True,
            'data': {
                'expiring_quotes': [quote.to_dict(include_items=False) for quote in expiring_quotes],
                'expiring_inquiries': [inquiry.to_dict() for inquiry in expiring_inquiries]
            }
        }

import datetime
