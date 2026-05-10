from datetime import date, datetime
from typing import Dict, List, Optional, Tuple
from uuid import uuid4

from models import Invoice, InvoiceStatus, PaymentPlan
from repositories import InvoiceRepository, PaymentPlanRepository


class InvoiceService:
    def __init__(
        self,
        invoice_repo: InvoiceRepository,
        plan_repo: PaymentPlanRepository
    ):
        self.invoice_repo = invoice_repo
        self.plan_repo = plan_repo

    def create_invoice(
        self,
        invoice_no: str,
        vendor_id: str,
        purchase_order_id: str,
        invoice_date: date,
        invoice_amount: float,
        tax_amount: Optional[float] = None,
        invoice_code: Optional[str] = None
    ) -> Tuple[Invoice, Dict]:
        rule_traces = []
        
        invoice_id = f'INV-{datetime.now().strftime("%Y%m%d")}-{str(uuid4())[:6].upper()}'
        
        rule_traces.append({
            'rule': 'INV_CREATE_001',
            'description': '发票ID生成',
            'input': {'invoice_no': invoice_no},
            'output': invoice_id,
            'passed': True
        })
        
        existing = self.invoice_repo.get_by_invoice_no(invoice_no)
        if existing:
            rule_traces.append({
                'rule': 'INV_CREATE_002',
                'description': '检查发票号是否已存在',
                'input': {'invoice_no': invoice_no},
                'output': '发票号已存在',
                'passed': False
            })
            raise ValueError(f'发票号 {invoice_no} 已存在')
        
        rule_traces.append({
            'rule': 'INV_CREATE_002',
            'description': '检查发票号是否已存在',
            'input': {'invoice_no': invoice_no},
            'output': '发票号可用',
            'passed': True
        })
        
        invoice = Invoice(
            id=invoice_id,
            invoice_no=invoice_no,
            invoice_code=invoice_code,
            vendor_id=vendor_id,
            purchase_order_id=purchase_order_id,
            invoice_date=invoice_date,
            invoice_amount=invoice_amount,
            tax_amount=tax_amount,
            status=InvoiceStatus.PENDING_RECEIVED
        )
        
        self.invoice_repo.save(invoice)
        
        rule_traces.append({
            'rule': 'INV_CREATE_003',
            'description': '发票创建成功',
            'input': {'invoice_id': invoice_id},
            'output': {'status': InvoiceStatus.PENDING_RECEIVED.value},
            'passed': True
        })
        
        return invoice, {
            'invoice_id': invoice_id,
            'status': invoice.status.value,
            'next_action': '请录入发票收到日期后完成收票',
            'rule_traces': rule_traces
        }

    def mark_received(
        self,
        invoice_id: str,
        received_date: date,
        operator: str
    ) -> Tuple[Invoice, Dict]:
        rule_traces = []
        
        invoice = self.invoice_repo.get_by_id(invoice_id)
        if not invoice:
            raise ValueError(f'发票 {invoice_id} 不存在')
        
        rule_traces.append({
            'rule': 'INV_RECEIVE_001',
            'description': '检查发票是否存在',
            'input': {'invoice_id': invoice_id},
            'output': '发票存在',
            'passed': True
        })
        
        if invoice.status not in [InvoiceStatus.PENDING_RECEIVED, InvoiceStatus.RECEIVED]:
            rule_traces.append({
                'rule': 'INV_RECEIVE_002',
                'description': '检查发票当前状态',
                'input': {'current_status': invoice.status.value},
                'output': f'当前状态{invoice.status.value}不允许标记收票',
                'passed': False
            })
            return invoice, {
                'invoice_id': invoice_id,
                'status': invoice.status.value,
                'success': False,
                'error': f'发票当前状态为{invoice.status.value}，无法标记收票',
                'rule_traces': rule_traces
            }
        
        invoice.received_date = received_date
        invoice.status = InvoiceStatus.RECEIVED
        invoice.mark_updated()
        self.invoice_repo.save(invoice)
        
        rule_traces.append({
            'rule': 'INV_RECEIVE_003',
            'description': '发票收票完成',
            'input': {'received_date': received_date.isoformat()},
            'output': {'status': InvoiceStatus.RECEIVED.value},
            'passed': True
        })
        
        return invoice, {
            'invoice_id': invoice_id,
            'status': invoice.status.value,
            'success': True,
            'next_action': '请完成发票认证后再匹配付款计划',
            'rule_traces': rule_traces
        }

    def mark_verified(
        self,
        invoice_id: str,
        verified_date: date,
        operator: str
    ) -> Tuple[Invoice, Dict]:
        rule_traces = []
        
        invoice = self.invoice_repo.get_by_id(invoice_id)
        if not invoice:
            raise ValueError(f'发票 {invoice_id} 不存在')
        
        if invoice.status != InvoiceStatus.RECEIVED:
            rule_traces.append({
                'rule': 'INV_VERIFY_001',
                'description': '检查发票状态是否为已收票',
                'input': {'current_status': invoice.status.value},
                'output': '仅已收票发票可认证',
                'passed': False
            })
            return invoice, {
                'invoice_id': invoice_id,
                'status': invoice.status.value,
                'success': False,
                'error': f'发票当前状态为{invoice.status.value}，请先完成收票',
                'rule_traces': rule_traces
            }
        
        invoice.verified_date = verified_date
        invoice.status = InvoiceStatus.VERIFIED
        invoice.mark_updated()
        self.invoice_repo.save(invoice)
        
        rule_traces.append({
            'rule': 'INV_VERIFY_002',
            'description': '发票认证完成',
            'input': {'verified_date': verified_date.isoformat()},
            'output': {'status': InvoiceStatus.VERIFIED.value},
            'passed': True
        })
        
        return invoice, {
            'invoice_id': invoice_id,
            'status': invoice.status.value,
            'success': True,
            'next_action': '可以匹配到付款计划了',
            'rule_traces': rule_traces
        }

    def match_to_plan(
        self,
        invoice_id: str,
        payment_plan_id: str,
        operator: str
    ) -> Dict:
        rule_traces = []
        
        invoice = self.invoice_repo.get_by_id(invoice_id)
        if not invoice:
            raise ValueError(f'发票 {invoice_id} 不存在')
        
        plan = self.plan_repo.get_by_id(payment_plan_id)
        if not plan:
            raise ValueError(f'付款计划 {payment_plan_id} 不存在')
        
        rule_traces.append({
            'rule': 'INV_MATCH_001',
            'description': '校验发票和付款计划存在性',
            'input': {
                'invoice_id': invoice_id,
                'plan_id': payment_plan_id
            },
            'output': '发票和付款计划均存在',
            'passed': True
        })
        
        if invoice.vendor_id != plan.vendor_id:
            rule_traces.append({
                'rule': 'INV_MATCH_002',
                'description': '检查供应商一致性',
                'input': {
                    'invoice_vendor': invoice.vendor_id,
                    'plan_vendor': plan.vendor_id
                },
                'output': '供应商不一致',
                'passed': False
            })
            return {
                'success': False,
                'error': '发票供应商与付款计划供应商不一致',
                'rule_traces': rule_traces
            }
        
        rule_traces.append({
            'rule': 'INV_MATCH_002',
            'description': '检查供应商一致性',
            'output': '供应商一致',
            'passed': True
        })
        
        if invoice.purchase_order_id != plan.purchase_order_id:
            rule_traces.append({
                'rule': 'INV_MATCH_003',
                'description': '检查采购订单一致性',
                'input': {
                    'invoice_po': invoice.purchase_order_id,
                    'plan_po': plan.purchase_order_id
                },
                'output': '采购订单不一致',
                'passed': False
            })
            return {
                'success': False,
                'error': '发票采购订单与付款计划采购订单不一致',
                'needs_manual_review': True,
                'review_reason': '跨订单发票匹配需要人工确认',
                'rule_traces': rule_traces
            }
        
        rule_traces.append({
            'rule': 'INV_MATCH_003',
            'description': '检查采购订单一致性',
            'output': '采购订单一致',
            'passed': True
        })
        
        if invoice.status not in [InvoiceStatus.VERIFIED, InvoiceStatus.MATCHED]:
            rule_traces.append({
                'rule': 'INV_MATCH_004',
                'description': '检查发票状态是否可匹配',
                'input': {'invoice_status': invoice.status.value},
                'output': '发票未认证，无法匹配',
                'passed': False
            })
            return {
                'success': False,
                'error': f'发票状态为{invoice.status.value}，请先完成认证',
                'rule_traces': rule_traces
            }
        
        if invoice.matched_payment_plan_id and invoice.matched_payment_plan_id != payment_plan_id:
            rule_traces.append({
                'rule': 'INV_MATCH_005',
                'description': '检查发票是否已匹配其他计划',
                'input': {'current_matched_plan': invoice.matched_payment_plan_id},
                'output': '发票已匹配到其他付款计划',
                'passed': False
            })
            return {
                'success': False,
                'error': f'发票已匹配到付款计划 {invoice.matched_payment_plan_id}',
                'rule_traces': rule_traces
            }
        
        invoice.matched_payment_plan_id = payment_plan_id
        invoice.status = InvoiceStatus.MATCHED
        invoice.mark_updated()
        self.invoice_repo.save(invoice)
        
        if invoice_id not in plan.invoice_ids:
            plan.invoice_ids.append(invoice_id)
            plan.mark_updated()
            self.plan_repo.save(plan)
        
        rule_traces.append({
            'rule': 'INV_MATCH_006',
            'description': '发票匹配成功',
            'input': {
                'invoice_id': invoice_id,
                'plan_id': payment_plan_id
            },
            'output': '匹配关系已建立',
            'passed': True
        })
        
        return {
            'success': True,
            'invoice_id': invoice_id,
            'payment_plan_id': payment_plan_id,
            'message': f'发票已成功匹配到付款计划 {payment_plan_id}',
            'rule_traces': rule_traces
        }
