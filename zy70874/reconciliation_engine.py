from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date
from typing import List, Dict, Tuple
import uuid

from models import (
    Session as SessionModel,
    BoxOfficeRecord,
    FilmContract,
    ReconciliationRecord,
    ReconciliationSummary,
    SessionStatus,
    DiscrepancyType
)


class ReconciliationEngine:
    def __init__(self, db: Session):
        self.db = db
        self.discrepancy_explanations = []

    def generate_batch_id(self) -> str:
        return f"REC-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"

    def calculate_expected_subsidy(
        self,
        contract: FilmContract,
        tickets_sold: int,
        show_date: date,
        daily_subsidy_used: float,
        total_subsidy_used: float
    ) -> Tuple[float, List[str]]:
        discrepancies = []
        
        base_subsidy = tickets_sold * contract.subsidy_per_ticket
        expected_subsidy = base_subsidy
        
        if contract.subsidy_daily_cap > 0:
            remaining_daily = contract.subsidy_daily_cap - daily_subsidy_used
            if remaining_daily < 0:
                remaining_daily = 0
            
            if expected_subsidy > remaining_daily:
                expected_subsidy = remaining_daily
                discrepancies.append(f"达到当日补贴上限 {contract.subsidy_daily_cap} 元")
        
        if contract.subsidy_total_cap > 0:
            remaining_total = contract.subsidy_total_cap - total_subsidy_used
            if remaining_total < 0:
                remaining_total = 0
            
            if expected_subsidy > remaining_total:
                expected_subsidy = remaining_total
                discrepancies.append(f"达到总补贴上限 {contract.subsidy_total_cap} 元")
        
        return round(expected_subsidy, 2), discrepancies

    def calculate_refund_deduction(
        self,
        contract: FilmContract,
        refund_amount: float,
        tickets_refunded: int
    ) -> Tuple[float, List[str]]:
        discrepancies = []
        
        deduction = refund_amount * contract.refund_deduction_rate
        
        if tickets_refunded > 0:
            discrepancies.append(
                f"退票 {tickets_refunded} 张，退票金额 {refund_amount} 元，按合同费率 {contract.refund_deduction_rate*100}% 扣减 {deduction} 元"
            )
        
        return round(deduction, 2), discrepancies

    def calculate_min_boxoffice(
        self,
        contract: FilmContract,
        actual_boxoffice: float,
        session_count: int
    ) -> Tuple[float, float, List[str]]:
        discrepancies = []
        
        if contract.minimum_boxoffice <= 0:
            return 0, actual_boxoffice, discrepancies
        
        expected_min = contract.minimum_boxoffice
        
        if actual_boxoffice < expected_min:
            shortfall = expected_min - actual_boxoffice
            discrepancies.append(
                f"实际票房 {actual_boxoffice} 元低于合同最低票房承诺 {expected_min} 元，缺口 {shortfall} 元"
            )
        
        return round(expected_min, 2), round(actual_boxoffice, 2), discrepancies

    def explain_discrepancies(
        self,
        session: SessionModel,
        boxoffice: BoxOfficeRecord,
        contract: FilmContract,
        discrepancy_types: List[str],
        subsidy_discrepancy: float,
        min_boxoffice_discrepancy: float,
        refund_deduction: float
    ) -> str:
        explanations = []
        
        if session.is_cross_day:
            explanations.append(
                f"【跨日场次】本场次 {session.session_code} 为跨日场次，"
                f"开始于 {session.show_time.strftime('%Y-%m-%d %H:%M')}，"
                f"结束于 {session.end_time.strftime('%Y-%m-%d %H:%M') if session.end_time else '未知'}"
            )
        
        if DiscrepancyType.SUBSIDY_LIMIT.value in discrepancy_types:
            explanations.append(
                f"【补贴上限】补贴差异 {subsidy_discrepancy} 元，"
                f"原因：该场次已达到合同约定的每日或累计补贴上限（{contract.subsidy_daily_cap} 元/日，{contract.subsidy_total_cap} 元/总）"
            )
        
        if DiscrepancyType.REFUND_DEDUCTION.value in discrepancy_types:
            explanations.append(
                f"【退票扣减】本场次产生退票扣减 {refund_deduction} 元，"
                f"按合同约定费率 {contract.refund_deduction_rate * 100}% 计算"
            )
        
        if DiscrepancyType.MIN_BOXOFFICE.value in discrepancy_types:
            explanations.append(
                f"【最低票房】票房缺口 {min_boxoffice_discrepancy} 元，"
                f"合同承诺最低票房 {contract.minimum_boxoffice} 元，实际票房未达标"
            )
        
        return "\n".join(explanations)

    def process_single_session(
        self,
        session: SessionModel,
        boxoffice: BoxOfficeRecord,
        contract: FilmContract,
        daily_subsidy_tracker: Dict[str, float],
        total_subsidy_tracker: Dict[str, float]
    ) -> Tuple[ReconciliationRecord, List[str]]:
        discrepancy_types = []
        all_discrepancies = []
        
        show_date = session.show_time.date()
        film_key = contract.film_code
        date_key = f"{film_key}_{show_date}"
        
        daily_subsidy_used = daily_subsidy_tracker.get(date_key, 0)
        total_subsidy_used = total_subsidy_tracker.get(film_key, 0)
        
        expected_subsidy, subsidy_discrepancies = self.calculate_expected_subsidy(
            contract, boxoffice.tickets_sold, show_date, daily_subsidy_used, total_subsidy_used
        )
        
        if subsidy_discrepancies:
            discrepancy_types.append(DiscrepancyType.SUBSIDY_LIMIT.value)
            all_discrepancies.extend(subsidy_discrepancies)
        
        actual_subsidy = boxoffice.tickets_sold * contract.subsidy_per_ticket
        subsidy_discrepancy = actual_subsidy - expected_subsidy
        
        refund_deduction, refund_discrepancies = self.calculate_refund_deduction(
            contract, boxoffice.refund_amount, boxoffice.tickets_refunded
        )
        
        if refund_discrepancies:
            discrepancy_types.append(DiscrepancyType.REFUND_DEDUCTION.value)
            all_discrepancies.extend(refund_discrepancies)
        
        expected_min_boxoffice, actual_boxoffice, min_boxoffice_discrepancies = self.calculate_min_boxoffice(
            contract, boxoffice.gross_boxoffice, 1
        )
        min_boxoffice_discrepancy = expected_min_boxoffice - actual_boxoffice
        
        if min_boxoffice_discrepancies:
            discrepancy_types.append(DiscrepancyType.MIN_BOXOFFICE.value)
            all_discrepancies.extend(min_boxoffice_discrepancies)
        
        if session.is_cross_day:
            discrepancy_types.append(DiscrepancyType.CROSS_DAY.value)
        
        total_discrepancy = subsidy_discrepancy + min_boxoffice_discrepancy + refund_deduction
        
        if abs(total_discrepancy) < 0.01:
            status = SessionStatus.MATCHED
        else:
            status = SessionStatus.DISPUTED
        
        discrepancy_explanation = self.explain_discrepancies(
            session, boxoffice, contract, discrepancy_types,
            subsidy_discrepancy, min_boxoffice_discrepancy, refund_deduction
        )
        
        daily_subsidy_tracker[date_key] = daily_subsidy_used + expected_subsidy
        total_subsidy_tracker[film_key] = total_subsidy_used + expected_subsidy
        
        record = ReconciliationRecord(
            session_id=session.id,
            boxoffice_id=boxoffice.id,
            contract_id=contract.id,
            expected_subsidy=expected_subsidy,
            actual_subsidy=actual_subsidy,
            subsidy_discrepancy=subsidy_discrepancy,
            expected_min_boxoffice=expected_min_boxoffice,
            actual_boxoffice=actual_boxoffice,
            min_boxoffice_discrepancy=min_boxoffice_discrepancy,
            refund_deduction=refund_deduction,
            total_discrepancy=total_discrepancy,
            discrepancy_types=",".join(discrepancy_types),
            discrepancy_explanation=discrepancy_explanation,
            status=status
        )
        
        return record, all_discrepancies

    def run_reconciliation(self, film_code: str = None) -> Dict:
        batch_id = self.generate_batch_id()
        
        query = self.db.query(SessionModel).join(
            BoxOfficeRecord,
            SessionModel.session_code == BoxOfficeRecord.session_code
        ).join(
            FilmContract,
            SessionModel.film_code == FilmContract.film_code
        ).filter(FilmContract.is_active == True)
        
        if film_code:
            query = query.filter(FilmContract.film_code == film_code)
        
        sessions_with_data = query.all()
        
        daily_subsidy_tracker = {}
        total_subsidy_tracker = {}
        all_discrepancies = []
        
        matched_count = 0
        disputed_count = 0
        
        for session in sessions_with_data:
            boxoffice = self.db.query(BoxOfficeRecord).filter(
                BoxOfficeRecord.session_code == session.session_code
            ).first()
            
            contract = self.db.query(FilmContract).filter(
                FilmContract.film_code == session.film_code,
                FilmContract.is_active == True
            ).first()
            
            if not boxoffice or not contract:
                continue
            
            existing = self.db.query(ReconciliationRecord).filter(
                ReconciliationRecord.session_id == session.id
            ).first()
            
            if existing:
                continue
            
            record, discrepancies = self.process_single_session(
                session, boxoffice, contract,
                daily_subsidy_tracker, total_subsidy_tracker
            )
            record.reconciliation_batch = batch_id
            
            self.db.add(record)
            
            all_discrepancies.extend(discrepancies)
            
            if record.status == SessionStatus.MATCHED:
                matched_count += 1
            else:
                disputed_count += 1
        
        self.create_summary(batch_id)
        
        self.db.commit()
        
        return {
            "batch_id": batch_id,
            "total_processed": len(sessions_with_data),
            "matched": matched_count,
            "disputed": disputed_count,
            "discrepancies_found": all_discrepancies
        }

    def create_summary(self, batch_id: str):
        records = self.db.query(ReconciliationRecord).filter(
            ReconciliationRecord.reconciliation_batch == batch_id
        ).all()
        
        summary = ReconciliationSummary(
            reconciliation_batch=batch_id,
            total_sessions=len(records),
            matched_sessions=sum(1 for r in records if r.status == SessionStatus.MATCHED),
            disputed_sessions=sum(1 for r in records if r.status == SessionStatus.DISPUTED),
            approved_sessions=sum(1 for r in records if r.status == SessionStatus.APPROVED),
            rejected_sessions=sum(1 for r in records if r.status == SessionStatus.REJECTED),
            total_expected_subsidy=sum(r.expected_subsidy for r in records),
            total_actual_subsidy=sum(r.actual_subsidy for r in records),
            total_subsidy_discrepancy=sum(r.subsidy_discrepancy for r in records),
            total_expected_min_boxoffice=sum(r.expected_min_boxoffice for r in records),
            total_actual_boxoffice=sum(r.actual_boxoffice for r in records),
            total_min_boxoffice_discrepancy=sum(r.min_boxoffice_discrepancy for r in records),
            total_refund_deduction=sum(r.refund_deduction for r in records),
            grand_total_discrepancy=sum(r.total_discrepancy for r in records)
        )
        
        self.db.add(summary)

    def update_summary(self, batch_id: str):
        summary = self.db.query(ReconciliationSummary).filter(
            ReconciliationSummary.reconciliation_batch == batch_id
        ).first()
        
        if not summary:
            self.create_summary(batch_id)
            return
        
        records = self.db.query(ReconciliationRecord).filter(
            ReconciliationRecord.reconciliation_batch == batch_id
        ).all()
        
        summary.total_sessions = len(records)
        summary.matched_sessions = sum(1 for r in records if r.status == SessionStatus.MATCHED)
        summary.disputed_sessions = sum(1 for r in records if r.status == SessionStatus.DISPUTED)
        summary.approved_sessions = sum(1 for r in records if r.status == SessionStatus.APPROVED)
        summary.rejected_sessions = sum(1 for r in records if r.status == SessionStatus.REJECTED)
        summary.total_expected_subsidy = sum(r.expected_subsidy for r in records)
        summary.total_actual_subsidy = sum(r.actual_subsidy for r in records)
        summary.total_subsidy_discrepancy = sum(r.subsidy_discrepancy for r in records)
        summary.total_expected_min_boxoffice = sum(r.expected_min_boxoffice for r in records)
        summary.total_actual_boxoffice = sum(r.actual_boxoffice for r in records)
        summary.total_min_boxoffice_discrepancy = sum(r.min_boxoffice_discrepancy for r in records)
        summary.total_refund_deduction = sum(r.refund_deduction for r in records)
        summary.grand_total_discrepancy = sum(r.total_discrepancy for r in records)
        
        self.db.commit()
