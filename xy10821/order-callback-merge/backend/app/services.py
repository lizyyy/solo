import json
import hashlib
from datetime import datetime
from decimal import Decimal
from app.models import db, PlatformOrder, CallbackPayload, UnifiedOrder, MergeRule, ExceptionReceipt, SearchIndex

def _init_default_rules():
    if MergeRule.query.count() > 0:
        return
    
    default_rules = [
        {
            'name': '淘宝载荷归一化',
            'rule_type': 'normalization',
            'platform': 'taobao',
            'priority': 10,
            'config': {
                'field_mapping': {
                    'tid': 'platform_order_id',
                    'payment': 'amount',
                    'buyer_nick': 'customer_name',
                    'status': 'platform_status',
                    'created': 'order_time'
                },
                'status_mapping': {
                    'WAIT_BUYER_PAY': 'pending_payment',
                    'WAIT_SELLER_SEND_GOODS': 'paid',
                    'WAIT_BUYER_CONFIRM_GOODS': 'shipped',
                    'TRADE_FINISHED': 'completed',
                    'TRADE_CLOSED': 'cancelled'
                }
            }
        },
        {
            'name': '京东载荷归一化',
            'rule_type': 'normalization',
            'platform': 'jd',
            'priority': 10,
            'config': {
                'field_mapping': {
                    'orderId': 'platform_order_id',
                    'orderPrice': 'amount',
                    'buyerName': 'customer_name',
                    'orderState': 'platform_status',
                    'orderStartTime': 'order_time'
                },
                'status_mapping': {
                    'WAIT_PAYMENT': 'pending_payment',
                    'PAID': 'paid',
                    'WAIT_DELIVERY': 'paid',
                    'DELIVERING': 'shipped',
                    'COMPLETED': 'completed',
                    'CANCELLED': 'cancelled'
                }
            }
        },
        {
            'name': '拼多多载荷归一化',
            'rule_type': 'normalization',
            'platform': 'pdd',
            'priority': 10,
            'config': {
                'field_mapping': {
                    'orderSn': 'platform_order_id',
                    'orderAmount': 'amount',
                    'buyerNick': 'customer_name',
                    'orderStatus': 'platform_status',
                    'createdAt': 'order_time'
                },
                'status_mapping': {
                    0: 'pending_payment',
                    1: 'paid',
                    2: 'shipped',
                    3: 'completed',
                    4: 'cancelled',
                    5: 'after_sale'
                }
            }
        },
        {
            'name': '状态合并规则',
            'rule_type': 'status_merge',
            'platform': None,
            'priority': 5,
            'config': {
                'status_priority': {
                    'after_sale': 100,
                    'exception': 90,
                    'completed': 80,
                    'cancelled': 70,
                    'shipped': 60,
                    'paid': 50,
                    'pending_payment': 40,
                    'pending': 30
                },
                'final_statuses': ['completed', 'cancelled']
            }
        },
        {
            'name': '重复事件去重',
            'rule_type': 'deduplication',
            'platform': None,
            'priority': 1,
            'config': {
                'hash_fields': ['event_type', 'platform_order_id', 'amount', 'status'],
                'time_window_seconds': 300
            }
        }
    ]
    
    for rule_data in default_rules:
        rule = MergeRule(**rule_data)
        db.session.add(rule)
    
    db.session.commit()

class OrderNormalizer:
    @staticmethod
    def normalize(platform, raw_data):
        rule = MergeRule.query.filter_by(
            rule_type='normalization',
            platform=platform,
            is_active=True
        ).order_by(MergeRule.priority.desc()).first()
        
        if not rule:
            return None
        
        config = rule.config
        field_mapping = config.get('field_mapping', {})
        status_mapping = config.get('status_mapping', {})
        
        normalized = {}
        for src_field, dst_field in field_mapping.items():
            if src_field in raw_data:
                normalized[dst_field] = raw_data[src_field]
        
        if 'platform_status' in normalized:
            platform_status = normalized['platform_status']
            if platform_status in status_mapping:
                normalized['unified_status'] = status_mapping[platform_status]
        
        return normalized

class StatusMerger:
    @staticmethod
    def merge_statuses(statuses):
        rule = MergeRule.query.filter_by(
            rule_type='status_merge',
            is_active=True
        ).order_by(MergeRule.priority.desc()).first()
        
        if not rule:
            return statuses[0] if statuses else 'pending'
        
        config = rule.config
        priority = config.get('status_priority', {})
        final_statuses = config.get('final_statuses', [])
        
        for status in statuses:
            if status in final_statuses:
                return status
        
        max_priority = -1
        result_status = 'pending'
        for status in statuses:
            p = priority.get(status, 0)
            if p > max_priority:
                max_priority = p
                result_status = status
        
        return result_status

class Deduplicator:
    @staticmethod
    def generate_hash(platform, event_data):
        rule = MergeRule.query.filter_by(
            rule_type='deduplication',
            is_active=True
        ).order_by(MergeRule.priority.desc()).first()
        
        if not rule:
            return None
        
        config = rule.config
        hash_fields = config.get('hash_fields', ['event_type'])
        
        hash_data = {'platform': platform}
        for field in hash_fields:
            if field in event_data:
                hash_data[field] = event_data[field]
        
        hash_str = json.dumps(hash_data, sort_keys=True)
        return hashlib.md5(hash_str.encode()).hexdigest()

class OrderMergeService:
    @staticmethod
    def process_callback(platform, platform_order_id, event_type, event_id, payload):
        existing = CallbackPayload.query.filter_by(
            event_id=event_id
        ).first()
        
        if existing:
            return {
                'success': False,
                'is_duplicate': True,
                'message': 'Duplicate event detected',
                'duplicate_of': existing.id
            }
        
        platform_order = PlatformOrder.query.filter_by(
            platform=platform,
            platform_order_id=platform_order_id
        ).first()
        
        if not platform_order:
            platform_order = PlatformOrder(
                platform=platform,
                platform_order_id=platform_order_id,
                raw_data=payload
            )
            db.session.add(platform_order)
            db.session.flush()
        
        normalized_data = OrderNormalizer.normalize(platform, payload)
        
        callback = CallbackPayload(
            platform_order_id=platform_order.id,
            event_type=event_type,
            event_id=event_id,
            payload=payload,
            normalized_data=normalized_data
        )
        db.session.add(callback)
        db.session.flush()
        
        unified_order = None
        if platform_order.unified_order_id:
            unified_order = UnifiedOrder.query.get(platform_order.unified_order_id)
        
        if not unified_order:
            unified_order = UnifiedOrder(
                unified_order_no=f"U{datetime.utcnow().strftime('%Y%m%d%H%M%S')}{platform_order.id}"
            )
            db.session.add(unified_order)
            db.session.flush()
            platform_order.unified_order_id = unified_order.id
        
        if normalized_data:
            if 'unified_status' in normalized_data:
                current_statuses = [unified_order.status, normalized_data['unified_status']]
                unified_order.status = StatusMerger.merge_statuses(current_statuses)
            
            if 'amount' in normalized_data:
                try:
                    unified_order.amount = Decimal(str(normalized_data['amount']))
                except:
                    pass
            
            if 'customer_name' in normalized_data:
                if not unified_order.customer_info:
                    unified_order.customer_info = {}
                unified_order.customer_info['name'] = normalized_data['customer_name']
        
        SearchIndex.query.filter_by(unified_order_id=unified_order.id).delete()
        
        search_entries = [
            {'key': 'unified_order_no', 'value': unified_order.unified_order_no, 'type': 'string'},
            {'key': 'platform', 'value': platform, 'type': 'string'},
            {'key': 'platform_order_id', 'value': platform_order_id, 'type': 'string'},
            {'key': 'status', 'value': unified_order.status, 'type': 'string'},
        ]
        
        if unified_order.customer_info and 'name' in unified_order.customer_info:
            search_entries.append({
                'key': 'customer_name',
                'value': unified_order.customer_info['name'],
                'type': 'string'
            })
        
        for entry in search_entries:
            idx = SearchIndex(
                unified_order_id=unified_order.id,
                search_key=entry['key'],
                search_value=entry['value'],
                value_type=entry['type']
            )
            db.session.add(idx)
        
        db.session.commit()
        
        return {
            'success': True,
            'unified_order_id': unified_order.id,
            'unified_order_no': unified_order.unified_order_no,
            'callback_id': callback.id,
            'platform_order_id': platform_order.id
        }

    @staticmethod
    def record_exception(unified_order_id, exception_type, message, severity='warning', callback_id=None, raw_data=None):
        exception = ExceptionReceipt(
            unified_order_id=unified_order_id,
            callback_payload_id=callback_id,
            exception_type=exception_type,
            severity=severity,
            message=message,
            raw_data=raw_data
        )
        db.session.add(exception)
        
        unified_order = UnifiedOrder.query.get(unified_order_id)
        if unified_order and unified_order.status not in ['completed', 'cancelled']:
            unified_order.status = 'exception'
        
        db.session.commit()
        return exception

    @staticmethod
    def resolve_exception(exception_id, resolved_by, resolution_note):
        exception = ExceptionReceipt.query.get(exception_id)
        if not exception:
            return None
        
        exception.status = 'resolved'
        exception.resolved_by = resolved_by
        exception.resolved_at = datetime.utcnow()
        exception.resolution_note = resolution_note
        
        unified_order = UnifiedOrder.query.get(exception.unified_order_id)
        if unified_order and unified_order.status == 'exception':
            open_exceptions = ExceptionReceipt.query.filter_by(
                unified_order_id=unified_order.id,
                status='open'
            ).count()
            if open_exceptions == 0:
                unified_order.status = 'pending'
        
        db.session.commit()
        return exception

    @staticmethod
    def advance_status(unified_order_id, new_status, operator=None):
        unified_order = UnifiedOrder.query.get(unified_order_id)
        if not unified_order:
            return None
        
        old_status = unified_order.status
        unified_order.status = new_status
        
        if operator:
            if not unified_order.merged_data:
                unified_order.merged_data = {}
            unified_order.merged_data['status_history'] = unified_order.merged_data.get('status_history', [])
            unified_order.merged_data['status_history'].append({
                'from': old_status,
                'to': new_status,
                'operator': operator,
                'time': datetime.utcnow().isoformat()
            })
        
        db.session.commit()
        return unified_order