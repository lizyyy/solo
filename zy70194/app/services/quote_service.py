from datetime import datetime, timedelta
import uuid
from typing import Dict, Any, Optional, List

from app import db
from app.models import (
    Inquiry, Quote, QuoteItem, QuoteVersion, PriceChange,
    QuoteStatus, InquiryStatus
)
from app.services.validation_service import ValidationService
from app.services.operation_log_service import OperationLogService
from app.models import OperationType

class QuoteService:
    @staticmethod
    def generate_quote_no() -> str:
        date_str = datetime.utcnow().strftime('%Y%m%d')
        random_str = uuid.uuid4().hex[:6].upper()
        return f'QUO-{date_str}-{random_str}'
    
    @staticmethod
    def _calculate_prices(item_data: Dict[str, Any], quote_tax_rate: float) -> Dict[str, Any]:
        quantity = float(item_data['quantity'])
        unit_price_excl = float(item_data['unit_price_excl_tax'])
        tax_rate = float(item_data.get('tax_rate', quote_tax_rate))
        freight_per_unit = float(item_data.get('freight_per_unit', 0.0))
        
        unit_price_incl = round(unit_price_excl * (1 + tax_rate), 4)
        line_total_excl = round(unit_price_excl * quantity, 4)
        tax_amount = round(line_total_excl * tax_rate, 4)
        line_total_incl = round(line_total_excl + tax_amount, 4)
        freight_total = round(freight_per_unit * quantity, 4)
        
        return {
            'unit_price_incl_tax': unit_price_incl,
            'tax_rate': tax_rate,
            'tax_amount': tax_amount,
            'freight_total': freight_total,
            'line_total_excl_tax': line_total_excl,
            'line_total_incl_tax': line_total_incl
        }
    
    @staticmethod
    def _recalculate_quote_totals(quote: Quote) -> None:
        items = quote.items.all()
        if not items:
            quote.total_price_excl_tax = 0.0
            quote.total_price_incl_tax = 0.0
            quote.total_amount = quote.total_freight
            return
        
        total_excl = sum(item.line_total_excl_tax for item in items)
        total_incl = sum(item.line_total_incl_tax for item in items)
        total_freight = quote.total_freight
        
        quote.total_price_excl_tax = round(total_excl, 4)
        quote.total_price_incl_tax = round(total_incl, 4)
        quote.total_amount = round(total_incl + total_freight, 4)
    
    @staticmethod
    def _create_version(quote: Quote, change_reason: str, changed_by: str) -> QuoteVersion:
        max_version = db.session.query(db.func.max(QuoteVersion.version_no)).filter_by(
            quote_id=quote.id
        ).scalar() or 0
        
        version = QuoteVersion(
            quote_id=quote.id,
            version_no=max_version + 1,
            snapshot_data=quote.to_dict(include_items=True),
            change_reason=change_reason,
            changed_by=changed_by
        )
        db.session.add(version)
        return version
    
    @staticmethod
    def create_quote(data: Dict[str, Any]) -> Dict[str, Any]:
        validation_result = ValidationService.validate_quote(data)
        if not validation_result.valid:
            return {
                'success': False,
                'error': '数据验证失败',
                'validation_errors': validation_result.to_dict()
            }
        
        inquiry = Inquiry.query.get(data.get('inquiry_id'))
        if not inquiry:
            return {
                'success': False,
                'error': '询价单不存在',
                'error_code': 'inquiry_not_found'
            }
        
        if inquiry.status not in [InquiryStatus.PUBLISHED, InquiryStatus.QUOTING]:
            return {
                'success': False,
                'error': f'询价单当前状态{inquiry.status.value}不允许报价',
                'error_code': 'invalid_inquiry_status'
            }
        
        existing_quote = Quote.query.filter_by(
            inquiry_id=inquiry.id,
            vendor_id=data['vendor_id'],
            status=QuoteStatus.SUBMITTED
        ).first()
        
        if existing_quote:
            return {
                'success': False,
                'error': '该供应商已提交报价，如需修改请使用更新接口',
                'error_code': 'duplicate_quote',
                'existing_quote_id': existing_quote.id
            }
        
        try:
            quote = Quote(
                inquiry_id=inquiry.id,
                quote_no=QuoteService.generate_quote_no(),
                vendor_id=data['vendor_id'],
                vendor_name=data['vendor_name'],
                vendor_contact=data.get('vendor_contact'),
                vendor_phone=data.get('vendor_phone'),
                status=QuoteStatus.DRAFT,
                currency=data.get('currency', 'CNY'),
                tax_rate=float(data.get('tax_rate', 0.13)),
                valid_from=datetime.fromisoformat(
                    str(data.get('valid_from', datetime.utcnow().isoformat())).replace('Z', '+00:00')
                ),
                valid_until=datetime.fromisoformat(
                    str(data['valid_until']).replace('Z', '+00:00')
                ),
                total_freight=float(data.get('total_freight', 0.0)),
                payment_terms=data.get('payment_terms'),
                delivery_terms=data.get('delivery_terms'),
                delivery_location=data.get('delivery_location'),
                delivery_time=data.get('delivery_time'),
                remarks=data.get('remarks'),
                created_by=data['created_by']
            )
            
            db.session.add(quote)
            db.session.flush()
            
            items = data.get('items', [])
            for idx, item_data in enumerate(items):
                item_validation = ValidationService.validate_quote_item(item_data, idx)
                if not item_validation.valid:
                    db.session.rollback()
                    return {
                        'success': False,
                        'error': f'第{idx+1}个报价项验证失败',
                        'validation_errors': item_validation.to_dict()
                    }
                
                prices = QuoteService._calculate_prices(item_data, quote.tax_rate)
                
                item = QuoteItem(
                    quote_id=quote.id,
                    item_no=item_data.get('item_no', f'ITEM-{idx+1:03d}'),
                    item_name=item_data['item_name'],
                    item_description=item_data.get('item_description'),
                    specification=item_data.get('specification'),
                    unit=item_data['unit'],
                    quantity=float(item_data['quantity']),
                    unit_price_excl_tax=float(item_data['unit_price_excl_tax']),
                    unit_price_incl_tax=prices['unit_price_incl_tax'],
                    tax_rate=prices['tax_rate'],
                    tax_amount=prices['tax_amount'],
                    freight_per_unit=float(item_data.get('freight_per_unit', 0.0)),
                    freight_total=prices['freight_total'],
                    line_total_excl_tax=prices['line_total_excl_tax'],
                    line_total_incl_tax=prices['line_total_incl_tax'],
                    delivery_time=item_data.get('delivery_time'),
                    warranty=item_data.get('warranty'),
                    remarks=item_data.get('remarks')
                )
                db.session.add(item)
            
            db.session.flush()
            QuoteService._recalculate_quote_totals(quote)
            
            OperationLogService.log_quote_operation(
                quote=quote,
                operation_type=OperationType.CREATE,
                operation_by=data['created_by'],
                before_snapshot=None,
                change_reason='创建报价单'
            )
            
            db.session.commit()
            
            return {
                'success': True,
                'data': quote.to_dict()
            }
        except Exception as e:
            db.session.rollback()
            return {
                'success': False,
                'error': f'创建报价单失败: {str(e)}',
                'error_code': 'create_quote_failed'
            }
    
    @staticmethod
    def submit_quote(quote_id: int, operation_by: str) -> Dict[str, Any]:
        quote = Quote.query.get(quote_id)
        if not quote:
            return {
                'success': False,
                'error': '报价单不存在',
                'error_code': 'quote_not_found'
            }
        
        if quote.status not in [QuoteStatus.DRAFT, QuoteStatus.REVISED]:
            return {
                'success': False,
                'error': f'当前状态{quote.status.value}不允许提交',
                'error_code': 'invalid_status'
            }
        
        items = quote.items.all()
        if not items:
            return {
                'success': False,
                'error': '报价单没有任何报价项，无法提交',
                'error_code': 'no_quote_items'
            }
        
        try:
            before_snapshot = quote.to_dict(include_items=True)
            
            quote.status = QuoteStatus.SUBMITTED
            
            inquiry = quote.inquiry
            if inquiry.status == InquiryStatus.PUBLISHED:
                inquiry.status = InquiryStatus.QUOTING
            
            QuoteService._create_version(quote, '提交报价', operation_by)
            
            OperationLogService.log_quote_operation(
                quote=quote,
                operation_type=OperationType.SUBMIT,
                operation_by=operation_by,
                before_snapshot=before_snapshot,
                change_reason='提交报价单'
            )
            
            db.session.commit()
            
            return {
                'success': True,
                'data': quote.to_dict()
            }
        except Exception as e:
            db.session.rollback()
            return {
                'success': False,
                'error': f'提交报价单失败: {str(e)}',
                'error_code': 'submit_quote_failed'
            }
    
    @staticmethod
    def revise_quote(quote_id: int, data: Dict[str, Any], operation_by: str, change_reason: str = None) -> Dict[str, Any]:
        quote = Quote.query.get(quote_id)
        if not quote:
            return {
                'success': False,
                'error': '报价单不存在',
                'error_code': 'quote_not_found'
            }
        
        if quote.status not in [QuoteStatus.SUBMITTED, QuoteStatus.REVISED, QuoteStatus.DRAFT]:
            return {
                'success': False,
                'error': f'当前状态{quote.status.value}不允许修改',
                'error_code': 'invalid_status'
            }
        
        before_snapshot = quote.to_dict(include_items=True)
        
        try:
            old_totals = {
                'total_price_excl_tax': quote.total_price_excl_tax,
                'total_price_incl_tax': quote.total_price_incl_tax,
                'total_freight': quote.total_freight,
                'total_amount': quote.total_amount
            }
            
            if 'vendor_name' in data:
                quote.vendor_name = data['vendor_name']
            if 'vendor_contact' in data:
                quote.vendor_contact = data['vendor_contact']
            if 'vendor_phone' in data:
                quote.vendor_phone = data['vendor_phone']
            if 'currency' in data:
                quote.currency = data['currency']
            if 'tax_rate' in data:
                quote.tax_rate = float(data['tax_rate'])
            if 'valid_from' in data:
                quote.valid_from = datetime.fromisoformat(
                    str(data['valid_from']).replace('Z', '+00:00')
                )
            if 'valid_until' in data:
                quote.valid_until = datetime.fromisoformat(
                    str(data['valid_until']).replace('Z', '+00:00')
                )
            if 'total_freight' in data:
                quote.total_freight = float(data['total_freight'])
            if 'payment_terms' in data:
                quote.payment_terms = data['payment_terms']
            if 'delivery_terms' in data:
                quote.delivery_terms = data['delivery_terms']
            if 'delivery_location' in data:
                quote.delivery_location = data['delivery_location']
            if 'delivery_time' in data:
                quote.delivery_time = data['delivery_time']
            if 'remarks' in data:
                quote.remarks = data['remarks']
            
            if 'items' in data:
                for old_item in quote.items.all():
                    db.session.delete(old_item)
                db.session.flush()
                
                for idx, item_data in enumerate(data['items']):
                    item_validation = ValidationService.validate_quote_item(item_data, idx)
                    if not item_validation.valid:
                        db.session.rollback()
                        return {
                            'success': False,
                            'error': f'第{idx+1}个报价项验证失败',
                            'validation_errors': item_validation.to_dict()
                        }
                    
                    prices = QuoteService._calculate_prices(item_data, quote.tax_rate)
                    
                    item = QuoteItem(
                        quote_id=quote.id,
                        item_no=item_data.get('item_no', f'ITEM-{idx+1:03d}'),
                        item_name=item_data['item_name'],
                        item_description=item_data.get('item_description'),
                        specification=item_data.get('specification'),
                        unit=item_data['unit'],
                        quantity=float(item_data['quantity']),
                        unit_price_excl_tax=float(item_data['unit_price_excl_tax']),
                        unit_price_incl_tax=prices['unit_price_incl_tax'],
                        tax_rate=prices['tax_rate'],
                        tax_amount=prices['tax_amount'],
                        freight_per_unit=float(item_data.get('freight_per_unit', 0.0)),
                        freight_total=prices['freight_total'],
                        line_total_excl_tax=prices['line_total_excl_tax'],
                        line_total_incl_tax=prices['line_total_incl_tax'],
                        delivery_time=item_data.get('delivery_time'),
                        warranty=item_data.get('warranty'),
                        remarks=item_data.get('remarks')
                    )
                    db.session.add(item)
            
            db.session.flush()
            QuoteService._recalculate_quote_totals(quote)
            
            new_totals = {
                'total_price_excl_tax': quote.total_price_excl_tax,
                'total_price_incl_tax': quote.total_price_incl_tax,
                'total_freight': quote.total_freight,
                'total_amount': quote.total_amount
            }
            
            for field in ['total_price_excl_tax', 'total_price_incl_tax', 'total_freight', 'total_amount']:
                if old_totals[field] != new_totals[field]:
                    price_change = PriceChange(
                        quote_id=quote.id,
                        field_changed=field,
                        old_value=old_totals[field],
                        new_value=new_totals[field],
                        change_reason=change_reason or '修改报价',
                        changed_by=operation_by,
                        is_manual=True
                    )
                    db.session.add(price_change)
            
            if quote.status == QuoteStatus.SUBMITTED:
                quote.status = QuoteStatus.REVISED
            
            QuoteService._create_version(quote, change_reason or '修改报价', operation_by)
            
            OperationLogService.log_quote_operation(
                quote=quote,
                operation_type=OperationType.MANUAL_EDIT,
                operation_by=operation_by,
                before_snapshot=before_snapshot,
                change_reason=change_reason or '修改报价单'
            )
            
            db.session.commit()
            
            return {
                'success': True,
                'data': quote.to_dict()
            }
        except Exception as e:
            db.session.rollback()
            return {
                'success': False,
                'error': f'修改报价单失败: {str(e)}',
                'error_code': 'revise_quote_failed'
            }
    
    @staticmethod
    def get_quote(quote_id: int) -> Dict[str, Any]:
        quote = Quote.query.get(quote_id)
        if not quote:
            return {
                'success': False,
                'error': '报价单不存在',
                'error_code': 'quote_not_found'
            }
        
        return {
            'success': True,
            'data': quote.to_dict()
        }
    
    @staticmethod
    def list_quotes(inquiry_id: int = None, vendor_id: str = None, status: str = None,
                   page: int = 1, per_page: int = 20) -> Dict[str, Any]:
        query = Quote.query
        
        if inquiry_id:
            query = query.filter_by(inquiry_id=inquiry_id)
        if vendor_id:
            query = query.filter_by(vendor_id=vendor_id)
        if status:
            try:
                query = query.filter_by(status=QuoteStatus(status))
            except ValueError:
                pass
        
        query = query.order_by(Quote.created_at.desc())
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return {
            'success': True,
            'data': {
                'items': [quote.to_dict(include_items=False) for quote in pagination.items],
                'total': pagination.total,
                'page': page,
                'per_page': per_page,
                'pages': pagination.pages
            }
        }
    
    @staticmethod
    def get_quote_versions(quote_id: int) -> Dict[str, Any]:
        quote = Quote.query.get(quote_id)
        if not quote:
            return {
                'success': False,
                'error': '报价单不存在',
                'error_code': 'quote_not_found'
            }
        
        versions = QuoteVersion.query.filter_by(
            quote_id=quote_id
        ).order_by(QuoteVersion.version_no.desc()).all()
        
        return {
            'success': True,
            'data': [v.to_dict() for v in versions]
        }
    
    @staticmethod
    def check_validity(quote_id: int) -> Dict[str, Any]:
        quote = Quote.query.get(quote_id)
        if not quote:
            return {
                'success': False,
                'error': '报价单不存在',
                'error_code': 'quote_not_found'
            }
        
        now = datetime.utcnow()
        is_expired = now > quote.valid_until or now < quote.valid_from
        is_valid = not is_expired and quote.status in [QuoteStatus.SUBMITTED, QuoteStatus.REVISED, QuoteStatus.AWARDED]
        
        expiry_reason = None
        if is_expired:
            if now < quote.valid_from:
                expiry_reason = '报价尚未生效'
            else:
                expiry_reason = '报价已过期'
        
        if quote.is_expired != is_expired:
            before_snapshot = quote.to_dict()
            quote.is_expired = is_expired
            quote.expiry_check_at = now
            
            OperationLogService.log_quote_operation(
                quote=quote,
                operation_type=OperationType.EXPIRE,
                operation_by='system',
                before_snapshot=before_snapshot,
                change_reason=expiry_reason or '报价有效期校验'
            )
            db.session.commit()
        
        return {
            'success': True,
            'data': {
                'quote_id': quote_id,
                'is_valid': is_valid,
                'is_expired': is_expired,
                'expiry_reason': expiry_reason,
                'valid_from': quote.valid_from.isoformat(),
                'valid_until': quote.valid_until.isoformat(),
                'checked_at': now.isoformat(),
                'current_status': quote.status.value
            }
        }
