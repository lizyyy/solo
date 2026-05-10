from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import func, and_
from sqlalchemy.orm import Session

from app.models import Receipt, ReceiptStatus, Claim, ClaimStatus, Refund, RefundStatus, Reconciliation
from app.schemas import FinancialReport, FinancialReportRow


class ReportService:
    def get_financial_report(
        self,
        db: Session,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> FinancialReport:
        if not start_date:
            start_date = datetime.utcnow() - timedelta(days=30)
        if not end_date:
            end_date = datetime.utcnow()

        total_receipts = (
            db.query(func.coalesce(func.sum(Receipt.amount), Decimal("0")))
            .filter(Receipt.paid_at >= start_date, Receipt.paid_at <= end_date)
            .scalar()
        )

        total_claimed = (
            db.query(func.coalesce(func.sum(Claim.amount), Decimal("0")))
            .filter(
                Claim.status == ClaimStatus.APPROVED,
                Claim.updated_at >= start_date,
                Claim.updated_at <= end_date,
            )
            .scalar()
        )

        total_reconciled = (
            db.query(func.coalesce(func.sum(Reconciliation.amount), Decimal("0")))
            .filter(
                Reconciliation.reconciled_at >= start_date,
                Reconciliation.reconciled_at <= end_date,
            )
            .scalar()
        )

        total_refunded = (
            db.query(func.coalesce(func.sum(Refund.amount), Decimal("0")))
            .filter(
                Refund.status == RefundStatus.PROCESSED,
                Refund.processed_at >= start_date,
                Refund.processed_at <= end_date,
            )
            .scalar()
        )

        unmatched_count = (
            db.query(func.count(Receipt.id))
            .filter(Receipt.status == ReceiptStatus.UNMATCHED)
            .scalar()
        )

        rows = [
            FinancialReportRow(
                period=f"{start_date.strftime('%Y-%m-%d')} ~ {end_date.strftime('%Y-%m-%d')}",
                total_receipts=total_receipts,
                total_claimed=total_claimed,
                total_reconciled=total_reconciled,
                total_refunded=total_refunded,
                unmatched_count=unmatched_count,
            )
        ]

        summary = {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "net_collected": total_receipts - total_refunded,
            "claim_rate": (
                float(total_claimed) / float(total_receipts) if total_receipts > 0 else 0
            ),
            "reconciliation_rate": (
                float(total_reconciled) / float(total_claimed) if total_claimed > 0 else 0
            ),
        }

        return FinancialReport(rows=rows, summary=summary)
