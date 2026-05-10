from datetime import datetime
import uuid
from typing import Dict, Any, Optional, List
from decimal import Decimal

from app import db
from app.models import (
    Inquiry, Quote, QuoteItem, ComparisonResult,
    InquiryStatus, QuoteStatus
)
from app.services.operation_log_service import OperationLogService
from app.models import OperationType
from app.services.quote_service import QuoteService

class ComparisonService:
    @staticmethod
    def generate_comparison_no() -> str:
        date_str = datetime.utcnow().strftime('%Y%m%d')
        random_str = uuid.uuid4().hex[:6].upper()
        return f'CMP-{date_str}-{random_str}'
    
    @staticmethod
    def _check_quote_validity(quote: Quote) -> Dict[str, Any]:
        now = datetime.utcnow()
        is_expired = now > quote.valid_until or now < quote.valid_from
        is_status_valid = quote.status in [QuoteStatus.SUBMITTED, QuoteStatus.REVISED]
        
        expiry_reason = None
        if is_expired:
            if now < quote.valid_from:
                expiry_reason = '报价尚未生效'
            else:
                expiry_reason = '报价已过期'
        
        return {
            'is_valid': not is_expired and is_status_valid,
            'is_expired': is_expired,
            'expiry_reason': expiry_reason
        }
    
    @staticmethod
    def _calculate_comparison_scores(quotes_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        sorted_quotes = sorted(quotes_data, key=lambda q: q['total_amount'])
        
        for idx, quote_data in enumerate(sorted_quotes):
            quote_data['rank'] = idx + 1
            if idx == 0:
                quote_data['price_difference'] = 0
                quote_data['price_difference_percent'] = 0
            else:
                base_price = sorted_quotes[0]['total_amount']
                current_price = quote_data['total_amount']
                if base_price > 0:
                    quote_data['price_difference'] = current_price - base_price
                    quote_data['price_difference_percent'] = round((current_price - base_price) / base_price * 100, 2)
                else:
                    quote_data['price_difference'] = 0
                    quote_data['price_difference_percent'] = 0
        
        return sorted_quotes
    
    @staticmethod
    def generate_comparison(inquiry_id: int, operation_by: str) -> Dict[str, Any]:
        inquiry = Inquiry.query.get(inquiry_id)
        if not inquiry:
            return {
                'success': False,
                'error': '询价单不存在',
                'error_code': 'inquiry_not_found'
            }
        
        if inquiry.status not in [InquiryStatus.QUOTING, InquiryStatus.COMPARING]:
            return {
                'success': False,
                'error': f'询价单当前状态{inquiry.status.value}不允许比价',
                'error_code': 'invalid_inquiry_status'
            }
        
        quotes = Quote.query.filter_by(
            inquiry_id=inquiry_id
        ).filter(Quote.status.in_([QuoteStatus.SUBMITTED, QuoteStatus.REVISED])).all()
        
        quotes_list = quotes
        
        if len(quotes_list) < 2:
            return {
                'success': False,
                'error': f'有效报价数量不足，至少需要2份有效报价',
                'error_code': 'insufficient_quotes',
                'current_quotes_count': len(quotes_list)
            }
        
        try:
            quotes_data = []
            validity_results = []
            
            for quote in quotes_list:
                validity = ComparisonService._check_quote_validity(quote)
                items = []
                
                for item in quote.items.all():
                    items.append({
                        'item_no': item.item_no,
                        'item_name': item.item_name,
                        'specification': item.specification,
                        'quantity': item.quantity,
                        'unit': item.unit,
                        'unit_price_excl_tax': item.unit_price_excl_tax,
                        'unit_price_incl_tax': item.unit_price_incl_tax,
                        'tax_rate': item.tax_rate,
                        'tax_amount': item.tax_amount,
                        'freight_per_unit': item.freight_per_unit,
                        'freight_total': item.freight_total,
                        'line_total_excl_tax': item.line_total_excl_tax,
                        'line_total_incl_tax': item.line_total_incl_tax,
                        'delivery_time': item.delivery_time,
                        'warranty': item.warranty
                    })
                
                quotes_data.append({
                    'quote_id': quote.id,
                    'quote_no': quote.quote_no,
                    'vendor_id': quote.vendor_id,
                    'vendor_name': quote.vendor_name,
                    'currency': quote.currency,
                    'tax_rate': quote.tax_rate,
                    'valid_from': quote.valid_from.isoformat(),
                    'valid_until': quote.valid_until.isoformat(),
                    'validity_status': validity,
                    'total_price_excl_tax': quote.total_price_excl_tax,
                    'total_price_incl_tax': quote.total_price_incl_tax,
                    'total_freight': quote.total_freight,
                    'total_amount': quote.total_amount,
                    'payment_terms': quote.payment_terms,
                    'delivery_terms': quote.delivery_terms,
                    'delivery_location': quote.delivery_location,
                    'delivery_time': quote.delivery_time,
                    'remarks': quote.remarks,
                    'items': items
                })
                
                validity_results.append({
                    'quote_id': quote.id,
                    'quote_no': quote.quote_no,
                    'vendor_name': quote.vendor_name,
                    **validity
                })
            
            valid_quotes = [q for q in quotes_data if q['validity_status']['is_valid']]
            
            if len(valid_quotes) < 2:
                return {
                    'success': False,
                    'error': '有效报价数量不足，至少需要2份有效报价（部分报价已过期）',
                    'error_code': 'insufficient_valid_quotes',
                    'validity_results': validity_results
                }
            
            ranked_quotes = ComparisonService._calculate_comparison_scores(valid_quotes)
            
            if ranked_quotes:
                best_quote = ranked_quotes[0]
                recommendation_reason = f'供应商 {best_quote["vendor_name"]} 的总报价最低（含税含运费），报价有效期至 {best_quote["valid_until"].split("T")[0]}'
            else:
                best_quote = None
                recommendation_reason = None
            
            all_item_comparison = []
            required_items = inquiry.required_items or []
            
            for req_item in required_items:
                item_no = req_item.get('item_no', req_item.get('item_name'))
                item_comparison = {
                    'item_no': item_no,
                    'item_name': req_item.get('item_name'),
                    'required_quantity': req_item.get('quantity'),
                    'quotes': []
                }
                
                for quote_data in valid_quotes:
                    quote_item = next(
                        (item for item in quote_data['items'] 
                         if item['item_no'] == item_no or item['item_name'] == req_item.get('item_name')),
                        None
                    )
                    
                    if quote_item:
                        item_comparison['quotes'].append({
                            'vendor_id': quote_data['vendor_id'],
                            'vendor_name': quote_data['vendor_name'],
                            **quote_item
                        })
                
                all_item_comparison.append(item_comparison)
            
            max_version = db.session.query(db.func.max(ComparisonResult.version)).filter_by(
                inquiry_id=inquiry_id
            ).scalar() or 0
            
            comparison = ComparisonResult(
                inquiry_id=inquiry_id,
                comparison_no=ComparisonService.generate_comparison_no(),
                version=max_version + 1,
                comparison_data={
                    'quotes': ranked_quotes,
                    'item_comparison': all_item_comparison,
                    'validity_results': validity_results
                },
                recommended_vendor_id=best_quote['vendor_id'] if best_quote else None,
                recommended_vendor_name=best_quote['vendor_name'] if best_quote else None,
                recommendation_reason=recommendation_reason,
                comparison_summary={
                    'total_quotes': len(quotes_data),
                    'valid_quotes': len(valid_quotes),
                    'best_price': best_quote['total_amount'] if best_quote else None,
                    'best_vendor': best_quote['vendor_name'] if best_quote else None,
                    'comparison_date': datetime.utcnow().isoformat()
                },
                generated_by=operation_by
            )
            
            db.session.add(comparison)
            
            if inquiry.status == InquiryStatus.QUOTING:
                inquiry.status = InquiryStatus.COMPARING
            
            OperationLogService.log_inquiry_operation(
                inquiry=inquiry,
                operation_type=OperationType.COMPARE,
                operation_by=operation_by,
                before_snapshot=None,
                change_reason='生成比价结果'
            )
            
            db.session.commit()
            
            return {
                'success': True,
                'data': comparison.to_dict()
            }
        except Exception as e:
            db.session.rollback()
            return {
                'success': False,
                'error': f'生成比价失败: {str(e)}',
                'error_code': 'generate_comparison_failed'
            }
    
    @staticmethod
    def get_comparison(comparison_id: int) -> Dict[str, Any]:
        comparison = ComparisonResult.query.get(comparison_id)
        if not comparison:
            return {
                'success': False,
                'error': '比价结果不存在',
                'error_code': 'comparison_not_found'
            }
        
        return {
            'success': True,
            'data': comparison.to_dict()
        }
    
    @staticmethod
    def list_comparisons(inquiry_id: int = None, page: int = 1, per_page: int = 20) -> Dict[str, Any]:
        query = ComparisonResult.query
        
        if inquiry_id:
            query = query.filter_by(inquiry_id=inquiry_id)
        
        query = query.order_by(ComparisonResult.generated_at.desc())
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return {
            'success': True,
            'data': {
                'items': [c.to_dict() for c in pagination.items],
                'total': pagination.total,
                'page': page,
                'per_page': per_page,
                'pages': pagination.pages
            }
        }
    
    @staticmethod
    def award_quote(comparison_id: int, quote_id: int, operation_by: str, reason: str = None) -> Dict[str, Any]:
        comparison = ComparisonResult.query.get(comparison_id)
        if not comparison:
            return {
                'success': False,
                'error': '比价结果不存在',
                'error_code': 'comparison_not_found'
            }
        
        quote = Quote.query.get(quote_id)
        if not quote:
            return {
                'success': False,
                'error': '报价单不存在',
                'error_code': 'quote_not_found'
            }
        
        if quote.inquiry_id != comparison.inquiry_id:
            return {
                'success': False,
                'error': '报价单不属于该询价单',
                'error_code': 'quote_not_match'
            }
        
        try:
            inquiry = Inquiry.query.get(comparison.inquiry_id)
            
            quote.status = QuoteStatus.AWARDED
            
            for other_quote in inquiry.quotes.all():
                if other_quote.id != quote_id and other_quote.status not in [QuoteStatus.WITHDRAWN, QuoteStatus.REJECTED]:
                    other_quote.status = QuoteStatus.REJECTED
            
            inquiry.status = InquiryStatus.AWARDED
            
            OperationLogService.log_inquiry_operation(
                inquiry=inquiry,
                operation_type=OperationType.AWARD,
                operation_by=operation_by,
                before_snapshot=None,
                change_reason=reason or f'确定中标供应商: {quote.vendor_name}'
            )
            
            OperationLogService.log_quote_operation(
                quote=quote,
                operation_type=OperationType.AWARD,
                operation_by=operation_by,
                before_snapshot=None,
                change_reason='确定中标'
            )
            
            db.session.commit()
            
            return {
                'success': True,
                'data': {
                    'inquiry_id': inquiry.id,
                    'inquiry_status': inquiry.status.value,
                    'awarded_quote_id': quote.id,
                    'awarded_vendor': quote.vendor_name
                }
            }
        except Exception as e:
            db.session.rollback()
            return {
                'success': False,
                'error': f'确定中标失败: {str(e)}',
                'error_code': 'award_failed'
            }
