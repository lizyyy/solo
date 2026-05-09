from datetime import datetime, timedelta
from typing import List, Dict
from dataclasses import dataclass
from models import (
    Bill, BillStatus, EndorsementStatus, CollectionStatus,
    TransactionType, FailedOperation
)
from bill_service import BillService


@dataclass
class RiskReport:
    report_time: datetime
    total_bills: int
    status_breakdown: Dict[str, int]
    abnormal_status_bills: List[str]
    broken_chain_bills: List[str]
    overdue_collection_bills: List[str]
    pending_return_bills: List[str]
    failed_operations: List[str]
    fund_transaction_count: int
    summary: str


class RiskService:
    
    def __init__(self, bill_service: BillService):
        self.bill_service = bill_service
    
    def detect_abnormal_status(self, bill: Bill) -> bool:
        if bill.status == BillStatus.ERROR:
            return True
        
        if bill.status == BillStatus.RETURNED and not bill.return_record:
            return True
        
        if bill.status == BillStatus.PAID:
            payment_transactions = [
                t for t in bill.transactions
                if t.transaction_type == TransactionType.PAYMENT
            ]
            if not payment_transactions:
                return True
        
        return False
    
    def detect_broken_chain(self, bill: Bill) -> bool:
        return not bill.verify_endorsement_chain()
    
    def detect_overdue_collection(self, bill: Bill) -> bool:
        now = datetime.now()
        overdue_days = 3
        
        if bill.status in [BillStatus.COLLECTION_PENDING, BillStatus.COLLECTION_SUBMITTED]:
            if bill.collection_request:
                if bill.collection_request.created_at:
                    days_passed = (now - bill.collection_request.created_at).days
                    return days_passed > overdue_days
        
        return False
    
    def detect_pending_return(self, bill: Bill) -> bool:
        if bill.return_record and not bill.return_record.handled_at:
            return True
        return False
    
    def detect_failed_operations(self, bill: Bill) -> List[FailedOperation]:
        return [
            op for op in bill.failed_operations
            if not op.resolved
        ]
    
    def generate_report(self) -> RiskReport:
        bills = self.bill_service.get_all_bills()
        now = datetime.now()
        
        status_breakdown = {}
        abnormal_bills = []
        broken_chain_bills = []
        overdue_collection_bills = []
        pending_return_bills = []
        failed_ops_ids = []
        total_transactions = 0
        
        for bill in bills:
            status_key = bill.status.value
            status_breakdown[status_key] = status_breakdown.get(status_key, 0) + 1
            
            if self.detect_abnormal_status(bill):
                abnormal_bills.append(bill.bill_no)
            
            if self.detect_broken_chain(bill):
                broken_chain_bills.append(bill.bill_no)
            
            if self.detect_overdue_collection(bill):
                overdue_collection_bills.append(bill.bill_no)
            
            if self.detect_pending_return(bill):
                pending_return_bills.append(bill.bill_no)
            
            failed_ops = self.detect_failed_operations(bill)
            for op in failed_ops:
                failed_ops_ids.append(f"{bill.bill_no}:{op.operation_type}")
            
            total_transactions += len(bill.transactions)
        
        summary_parts = []
        if abnormal_bills:
            summary_parts.append(f"发现 {len(abnormal_bills)} 张状态异常票据")
        if broken_chain_bills:
            summary_parts.append(f"发现 {len(broken_chain_bills)} 张背书链断裂票据")
        if overdue_collection_bills:
            summary_parts.append(f"发现 {len(overdue_collection_bills)} 张托收超期票据")
        if pending_return_bills:
            summary_parts.append(f"发现 {len(pending_return_bills)} 张待处理退票")
        if failed_ops_ids:
            summary_parts.append(f"发现 {len(failed_ops_ids)} 个失败操作待重试")
        
        if not summary_parts:
            summary = "所有票据状态正常，无风险预警"
        else:
            summary = " | ".join(summary_parts)
        
        return RiskReport(
            report_time=now,
            total_bills=len(bills),
            status_breakdown=status_breakdown,
            abnormal_status_bills=abnormal_bills,
            broken_chain_bills=broken_chain_bills,
            overdue_collection_bills=overdue_collection_bills,
            pending_return_bills=pending_return_bills,
            failed_operations=failed_ops_ids,
            fund_transaction_count=total_transactions,
            summary=summary
        )
    
    def print_report(self, report: RiskReport):
        print("=" * 60)
        print("银行票据托收风险报表")
        print(f"生成时间: {report.report_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 60)
        
        print(f"\n票据总数: {report.total_bills}")
        print(f"资金流水总数: {report.fund_transaction_count}")
        
        print("\n状态分布:")
        for status, count in report.status_breakdown.items():
            print(f"  {status}: {count}")
        
        if report.abnormal_status_bills:
            print(f"\n状态异常票据 ({len(report.abnormal_status_bills)}):")
            for b in report.abnormal_status_bills:
                print(f"  - {b}")
        
        if report.broken_chain_bills:
            print(f"\n背书链断裂票据 ({len(report.broken_chain_bills)}):")
            for b in report.broken_chain_bills:
                print(f"  - {b}")
        
        if report.overdue_collection_bills:
            print(f"\n托收超期票据 ({len(report.overdue_collection_bills)}):")
            for b in report.overdue_collection_bills:
                print(f"  - {b}")
        
        if report.pending_return_bills:
            print(f"\n待处理退票 ({len(report.pending_return_bills)}):")
            for b in report.pending_return_bills:
                print(f"  - {b}")
        
        if report.failed_operations:
            print(f"\n失败操作待重试 ({len(report.failed_operations)}):")
            for op in report.failed_operations:
                print(f"  - {op}")
        
        print("\n" + "=" * 60)
        print(f"摘要: {report.summary}")
        print("=" * 60)
