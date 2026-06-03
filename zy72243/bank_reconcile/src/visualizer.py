from datetime import datetime
from .database import get_session
from .models import ClearingBatch, TransactionRecord, AuditTrail


class Visualizer:
    def __init__(self):
        self.session = get_session()

    def generate_currency_3d_chart(self, batch_no):
        batch = self.session.query(ClearingBatch).filter_by(batch_no=batch_no).first()
        if not batch:
            return {"error": "批次不存在"}

        transactions = self.session.query(TransactionRecord).filter_by(batch_id=batch.id).all()

        cny_normal = []
        cny_mixed = []
        hkd_normal = []
        hkd_mixed = []

        for idx, txn in enumerate(transactions):
            date_num = idx
            amount = abs(txn.amount)

            if txn.has_mixed_currency:
                if "CNY" in (txn.detected_currencies or ""):
                    cny_mixed.append({
                        "x": date_num,
                        "y": amount,
                        "z": idx * 0.5,
                        "transaction_id": txn.id,
                        "transaction_no": txn.transaction_no,
                        "summary": txn.summary,
                        "amount_column_raw": txn.amount_column_raw
                    })
                if "HKD" in (txn.detected_currencies or ""):
                    hkd_mixed.append({
                        "x": date_num,
                        "y": amount,
                        "z": idx * 0.5 + 0.3,
                        "transaction_id": txn.id,
                        "transaction_no": txn.transaction_no,
                        "summary": txn.summary,
                        "amount_column_raw": txn.amount_column_raw
                    })
            else:
                if txn.currency == "CNY":
                    cny_normal.append({
                        "x": date_num,
                        "y": amount,
                        "z": idx * 0.5,
                        "transaction_id": txn.id,
                        "transaction_no": txn.transaction_no,
                        "summary": txn.summary
                    })
                elif txn.currency == "HKD":
                    hkd_normal.append({
                        "x": date_num,
                        "y": amount,
                        "z": idx * 0.5,
                        "transaction_id": txn.id,
                        "transaction_no": txn.transaction_no,
                        "summary": txn.summary
                    })

        return {
            "chart_type": "scatter3d",
            "title": f"清算批次 {batch_no} - 币种分布3D图",
            "subtitle": "点击红色/橙色点可查看详情并跳转到清算批次或节假日说明",
            "data": [
                {
                    "name": "CNY正常",
                    "color": "rgba(46, 204, 113, 0.8)",
                    "points": cny_normal
                },
                {
                    "name": "HKD正常",
                    "color": "rgba(52, 152, 219, 0.8)",
                    "points": hkd_normal
                },
                {
                    "name": "CNY币种混合⚠️",
                    "color": "rgba(231, 76, 60, 1.0)",
                    "points": cny_mixed
                },
                {
                    "name": "HKD币种混合⚠️",
                    "color": "rgba(243, 156, 18, 1.0)",
                    "points": hkd_mixed
                }
            ],
            "labels": {
                "x": "交易序号",
                "y": "金额",
                "z": "时间轴"
            },
            "mixed_count": batch.mixed_currency_count,
            "total_count": batch.total_records
        }

    def generate_status_pie_chart(self, batch_no):
        batch = self.session.query(ClearingBatch).filter_by(batch_no=batch_no).first()
        if not batch:
            return {"error": "批次不存在"}

        audits = self.session.query(AuditTrail).filter_by(batch_id=batch.id).all()

        resolved = sum(1 for a in audits if a.is_resolved)
        pending = len(audits) - resolved
        mixed_currency = sum(1 for a in audits if a.audit_type == "mixed_currency" and not a.is_resolved)
        missing_holiday = sum(1 for a in audits if a.audit_type == "missing_holiday_note" and not a.is_resolved)

        transactions = self.session.query(TransactionRecord).filter_by(batch_id=batch.id).all()
        reviewed = sum(1 for t in transactions if t.is_reviewed)
        unreviewed = len(transactions) - reviewed

        return {
            "chart_type": "pie",
            "title": f"清算批次 {batch_no} - 状态分布",
            "audit_status": [
                {"name": "已完成", "value": resolved, "color": "#27ae60"},
                {"name": "待处理", "value": pending, "color": "#f39c12"}
            ],
            "audit_breakdown": [
                {"name": "币种混合待复核", "value": mixed_currency, "color": "#e74c3c"},
                {"name": "缺少节假日说明", "value": missing_holiday, "color": "#e67e22"},
                {"name": "已完成", "value": resolved, "color": "#27ae60"}
            ],
            "review_status": [
                {"name": "已复核", "value": reviewed, "color": "#27ae60"},
                {"name": "待复核", "value": unreviewed, "color": "#e74c3c"}
            ]
        }

    def generate_timeline_chart(self, batch_no):
        batch = self.session.query(ClearingBatch).filter_by(batch_no=batch_no).first()
        if not batch:
            return {"error": "批次不存在"}

        transactions = self.session.query(TransactionRecord).filter_by(batch_id=batch.id).order_by(
            TransactionRecord.transaction_date).all()

        events = []

        if batch.import_date:
            events.append({
                "date": batch.import_date.strftime("%Y-%m-%d %H:%M:%S"),
                "type": "import",
                "title": "批次导入",
                "description": f"导入 {batch.total_records} 条记录",
                "color": "#3498db"
            })

        for txn in transactions:
            if txn.has_mixed_currency:
                events.append({
                    "date": txn.transaction_date.strftime("%Y-%m-%d") if txn.transaction_date else "未知",
                    "type": "mixed_currency",
                    "title": "币种混合",
                    "description": f"流水号: {txn.transaction_no}, 金额: {txn.amount_column_raw}",
                    "transaction_id": txn.id,
                    "color": "#e74c3c"
                })

            if txn.is_reviewed and txn.reviewed_at:
                events.append({
                    "date": txn.reviewed_at.strftime("%Y-%m-%d %H:%M:%S"),
                    "type": "review",
                    "title": "已复核",
                    "description": f"{txn.reviewed_by}: {txn.review_note}",
                    "color": "#27ae60"
                })

        holidays = self.session.query(TransactionRecord).filter_by(batch_id=batch.id).all()
        holiday_adjustments = self.session.query(TransactionRecord).filter_by(batch_id=batch.id).all()
        from .models import HolidayAdjustment
        has_holiday = self.session.query(HolidayAdjustment).filter_by(batch_id=batch.id).first()
        if has_holiday:
            events.append({
                "date": has_holiday.applied_at.strftime("%Y-%m-%d %H:%M:%S") if has_holiday.applied_at else "未知",
                "type": "holiday",
                "title": "节假日顺延补录",
                "description": f"{has_holiday.reason}",
                "color": "#f39c12"
            })

        events.sort(key=lambda x: x["date"])

        return {
            "chart_type": "timeline",
            "title": f"清算批次 {batch_no} - 处理时间线",
            "events": events
        }

    def generate_batch_comparison(self, batch_nos):
        result = []
        for batch_no in batch_nos:
            batch = self.session.query(ClearingBatch).filter_by(batch_no=batch_no).first()
            if batch:
                result.append({
                    "batch_no": batch_no,
                    "total_records": batch.total_records,
                    "mixed_currency_count": batch.mixed_currency_count,
                    "status": batch.status
                })
        return {
            "chart_type": "bar",
            "title": "多批次对比",
            "data": result
        }
