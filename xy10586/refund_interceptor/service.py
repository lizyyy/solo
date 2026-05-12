import json
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional

from .models import (
    WorkspaceState, OrderPayment, BlacklistItem, ApprovalRecord,
    HistoricalRefund, RefundRequest, CorrectionRecord,
    RefundStatus, ApprovalStatus, CheckResult
)
from .config import Config
from .storage import DataManager
from .rules import RulesEngine


class RefundService:
    def __init__(self, config: Config):
        self.config = config
        self.data_manager = DataManager(config)
        self.rules_engine = RulesEngine()
    
    def init_workspace(self) -> WorkspaceState:
        self.config.ensure_dirs()
        state = self.data_manager.get_state()
        state.initialized = True
        state.initialized_at = datetime.now()
        self.data_manager.save_state(state)
        return state
    
    def is_initialized(self) -> bool:
        state = self.data_manager.get_state()
        return state.initialized
    
    def _parse_datetime(self, dt_str: str) -> datetime:
        for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"]:
            try:
                return datetime.strptime(dt_str, fmt)
            except ValueError:
                continue
        raise ValueError(f"无法解析日期: {dt_str}")
    
    def import_payments(self, file_path: str):
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        payments = []
        for item in data:
            payments.append(OrderPayment(
                order_id=item['order_id'],
                user_id=item['user_id'],
                user_account=item['user_account'],
                amount=float(item['amount']),
                paid_at=self._parse_datetime(item['paid_at']),
                currency=item.get('currency', 'CNY'),
                status=item.get('status', 'success')
            ))
        
        existing = {p.order_id: p for p in self.data_manager.get_payments()}
        for p in payments:
            existing[p.order_id] = p
        
        self.data_manager.save_payments(list(existing.values()))
        
        state = self.data_manager.get_state()
        state.last_import_at = datetime.now()
        self.data_manager.save_state(state)
        
        return len(payments)
    
    def import_blacklist(self, file_path: str):
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        items = []
        for item in data:
            added_at_val = item.get('added_at')
            if added_at_val is None:
                added_at_dt = datetime.now()
            elif isinstance(added_at_val, str):
                added_at_dt = self._parse_datetime(added_at_val)
            else:
                added_at_dt = added_at_val
            
            items.append(BlacklistItem(
                account=item['account'],
                reason=item['reason'],
                added_at=added_at_dt,
                added_by=item['added_by'],
                is_active=item.get('is_active', True)
            ))
        
        existing = {b.account: b for b in self.data_manager.get_blacklist()}
        for item in items:
            existing[item.account] = item
        
        self.data_manager.save_blacklist(list(existing.values()))
        return len(items)
    
    def import_approvals(self, file_path: str):
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        approvals = []
        for item in data:
            expires_at = item.get('expires_at')
            expires_at_dt = None
            if expires_at:
                expires_at_dt = self._parse_datetime(expires_at)
            
            approved_at = item.get('approved_at')
            approved_at_dt = None
            if approved_at:
                approved_at_dt = self._parse_datetime(approved_at)
            
            approvals.append(ApprovalRecord(
                approval_id=item['approval_id'],
                order_id=item['order_id'],
                refund_request_id=item['refund_request_id'],
                approver=item['approver'],
                amount=float(item['amount']),
                status=ApprovalStatus(item['status']),
                approved_at=approved_at_dt,
                expires_at=expires_at_dt,
                reason=item.get('reason')
            ))
        
        existing = {a.approval_id: a for a in self.data_manager.get_approvals()}
        for a in approvals:
            existing[a.approval_id] = a
        
        self.data_manager.save_approvals(list(existing.values()))
        return len(approvals)
    
    def import_historical_refunds(self, file_path: str):
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        refunds = []
        for item in data:
            refunds.append(HistoricalRefund(
                refund_id=item['refund_id'],
                order_id=item['order_id'],
                amount=float(item['amount']),
                processed_at=self._parse_datetime(item['processed_at']),
                status=item.get('status', 'success'),
                processor=item.get('processor')
            ))
        
        existing = {h.refund_id: h for h in self.data_manager.get_historical_refunds()}
        for h in refunds:
            existing[h.refund_id] = h
        
        self.data_manager.save_historical_refunds(list(existing.values()))
        return len(refunds)
    
    def import_refund_requests(self, file_path: str):
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        requests = []
        for item in data:
            requests.append(RefundRequest(
                request_id=item['request_id'],
                order_id=item['order_id'],
                user_account=item['user_account'],
                amount=float(item['amount']),
                reason=item['reason'],
                requested_at=self._parse_datetime(item['requested_at']),
                requested_by=item['requested_by'],
                status=RefundStatus.PENDING
            ))
        
        existing = {r.request_id: r for r in self.data_manager.get_refund_requests()}
        for r in requests:
            if r.request_id not in existing:
                existing[r.request_id] = r
        
        self.data_manager.save_refund_requests(list(existing.values()))
        return len(requests)
    
    def check_all(self) -> List[RefundRequest]:
        all_requests = self.data_manager.get_refund_requests()
        all_payments = self.data_manager.get_payments()
        all_blacklist = self.data_manager.get_blacklist()
        all_approvals = self.data_manager.get_approvals()
        all_historical = self.data_manager.get_historical_refunds()
        
        payments_map = {p.order_id: p for p in all_payments}
        blacklist_map = {b.account: b for b in all_blacklist if b.is_active}
        approvals_map = {a.refund_request_id: a for a in all_approvals}
        
        updated_requests = []
        
        for request in all_requests:
            if request.status in [RefundStatus.PROCESSED, RefundStatus.REJECTED]:
                updated_requests.append(request)
                continue
            
            context = {
                'payment': payments_map.get(request.order_id),
                'blacklist_item': blacklist_map.get(request.user_account),
                'approval': approvals_map.get(request.request_id),
                'all_requests': all_requests,
                'historical_refunds': all_historical
            }
            
            if request.check_results:
                for old_result in request.check_results:
                    request.historical_checks.append(old_result)
            
            results = self.rules_engine.execute(request, context)
            request.check_results = results
            request.status = self.rules_engine.determine_status(results)
            
            updated_requests.append(request)
        
        self.data_manager.save_refund_requests(updated_requests)
        
        state = self.data_manager.get_state()
        state.last_check_at = datetime.now()
        self.data_manager.save_state(state)
        
        return updated_requests
    
    def get_request_detail(self, request_id: str) -> Optional[dict]:
        request = self.data_manager.get_request_by_id(request_id)
        if not request:
            return None
        
        payment = self.data_manager.get_payment_by_order(request.order_id)
        approval = self.data_manager.get_approval_by_request(request_id)
        blacklist_item = self.data_manager.get_blacklist_by_account(request.user_account)
        historical_refunds = self.data_manager.get_historical_by_order(request.order_id)
        corrections = self.data_manager.get_corrections_by_request(request_id)
        
        return {
            'request': request,
            'payment': payment,
            'approval': approval,
            'blacklist_item': blacklist_item,
            'historical_refunds': historical_refunds,
            'corrections': corrections
        }
    
    def correct_request(
        self,
        request_id: str,
        field: str,
        new_value: str,
        corrected_by: str,
        reason: str
    ) -> Optional[RefundRequest]:
        request = self.data_manager.get_request_by_id(request_id)
        if not request:
            return None
        
        all_requests = self.data_manager.get_refund_requests()
        
        old_value = getattr(request, field, None)
        
        if field == 'amount':
            new_value_parsed = float(new_value)
        else:
            new_value_parsed = new_value
        
        setattr(request, field, new_value_parsed)
        
        correction = CorrectionRecord(
            correction_id=str(uuid.uuid4()),
            request_id=request_id,
            field=field,
            old_value=str(old_value),
            new_value=str(new_value),
            corrected_by=corrected_by,
            corrected_at=datetime.now(),
            reason=reason
        )
        
        self.data_manager.save_corrections(
            self.data_manager.get_corrections() + [correction]
        )
        
        request.status = RefundStatus.PENDING
        request.check_results = []
        
        request_map = {r.request_id: r for r in all_requests}
        request_map[request_id] = request
        self.data_manager.save_refund_requests(list(request_map.values()))
        
        return request
    
    def get_report(self) -> dict:
        requests = self.data_manager.get_refund_requests()
        
        approved = [r for r in requests if r.status == RefundStatus.APPROVED]
        review = [r for r in requests if r.status == RefundStatus.REVIEW_REQUIRED]
        blocked = [r for r in requests if r.status == RefundStatus.BLOCKED]
        pending = [r for r in requests if r.status == RefundStatus.PENDING]
        processed = [r for r in requests if r.status == RefundStatus.PROCESSED]
        rejected = [r for r in requests if r.status == RefundStatus.REJECTED]
        
        return {
            'total': len(requests),
            'approved': approved,
            'review_required': review,
            'blocked': blocked,
            'pending': pending,
            'processed': processed,
            'rejected': rejected,
            'summary': {
                'approved_count': len(approved),
                'review_count': len(review),
                'blocked_count': len(blocked),
                'pending_count': len(pending),
                'processed_count': len(processed),
                'rejected_count': len(rejected),
                'total_amount_approved': sum(r.amount for r in approved),
                'total_amount_review': sum(r.amount for r in review),
                'total_amount_blocked': sum(r.amount for r in blocked)
            }
        }
