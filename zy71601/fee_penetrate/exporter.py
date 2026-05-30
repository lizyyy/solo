from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict
from calendar import monthrange
import json

import pandas as pd
from sqlalchemy import and_

from .database import Database
from .config import Config
from .models import (
    Product, FeeRule, NavFlow, CustomerShare, ChannelRebate,
    FeeAccrual, ChannelAllocation, SalesChannel, FeeType,
    AuditReport, AnomalyRecord, ChangeHistory
)
from .calculator import FeeCalculator
from .anomaly_detector import AnomalyDetector


class MonthlyReportExporter:
    def __init__(self, db: Optional[Database] = None):
        self.db = db or Database()
        self.calculator = FeeCalculator(self.db)
        self.detector = AnomalyDetector(self.db)

    def _generate_report_code(self, year: int, month: int) -> str:
        return f"REPORT{year:04d}{month:02d}{datetime.now().strftime('%H%M%S')}"

    def _get_period_dates(self, year: int, month: int) -> Tuple[date, date]:
        period_start = date(year, month, 1)
        period_end = date(year, month, monthrange(year, month)[1])
        return period_start, period_end

    def generate_monthly_report(
        self,
        year: int,
        month: int,
        operator: str,
        reviewer: Optional[str] = None,
        recalculate: bool = True,
        product_code: Optional[str] = None
    ) -> Dict[str, Any]:
        period_start, period_end = self._get_period_dates(year, month)

        if recalculate:
            self.calculator.calculate_monthly_fees(
                year, month, product_code, operator
            )

        anomaly_result = self.detector.run_all_checks(
            product_code=product_code,
            period_start=period_start,
            period_end=period_end,
            operator=operator
        )

        with self.db.get_session() as session:
            query = session.query(FeeAccrual).filter(
                and_(
                    FeeAccrual.period_start == period_start,
                    FeeAccrual.period_end == period_end,
                    FeeAccrual.is_active == True
                )
            )
            if product_code:
                product = session.query(Product).filter(
                    Product.product_code == product_code
                ).first()
                if product:
                    query = query.filter(FeeAccrual.product_id == product.id)

            accruals = query.all()

            product_totals: Dict[str, Dict[str, Any]] = defaultdict(
                lambda: {
                    "product_code": "",
                    "product_name": "",
                    "management_fee": Decimal("0"),
                    "custodian_fee": Decimal("0"),
                    "sales_service_fee": Decimal("0"),
                    "total_fee": Decimal("0"),
                    "tax_amount": Decimal("0"),
                    "net_total": Decimal("0"),
                    "manual_adjusted": False,
                    "has_anomaly": False,
                }
            )

            channel_allocations: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

            total_management = Decimal("0")
            total_custodian = Decimal("0")
            total_sales = Decimal("0")
            total_tax = Decimal("0")
            manual_adjustment_count = 0

            product_ids = set()

            for accrual in accruals:
                product = session.query(Product).filter(
                    Product.id == accrual.product_id
                ).first()
                if not product:
                    continue

                product_ids.add(product.id)
                key = product.product_code

                product_totals[key]["product_code"] = product.product_code
                product_totals[key]["product_name"] = product.product_name
                product_totals[key]["tax_amount"] += accrual.tax_amount

                if accrual.fee_type == FeeType.MANAGEMENT.value:
                    product_totals[key]["management_fee"] = accrual.net_amount
                    total_management += accrual.net_amount
                elif accrual.fee_type == FeeType.CUSTODIAN.value:
                    product_totals[key]["custodian_fee"] = accrual.net_amount
                    total_custodian += accrual.net_amount
                elif accrual.fee_type == FeeType.SALES_SERVICE.value:
                    product_totals[key]["sales_service_fee"] = accrual.net_amount
                    total_sales += accrual.net_amount

                    allocs = session.query(ChannelAllocation).filter(
                        and_(
                            ChannelAllocation.fee_rule_id.in_(
                                session.query(FeeRule.id).filter(
                                    and_(
                                        FeeRule.product_id == product.id,
                                        FeeRule.fee_type == FeeType.SALES_SERVICE.value
                                    )
                                )
                            ),
                            ChannelAllocation.period_start == period_start,
                            ChannelAllocation.period_end == period_end,
                            ChannelAllocation.is_active == True
                        )
                    ).all()

                    for alloc in allocs:
                        channel = session.query(SalesChannel).filter(
                            SalesChannel.id == alloc.channel_id
                        ).first()
                        channel_allocations[key].append({
                            "channel_code": channel.channel_code if channel else "unknown",
                            "channel_name": channel.channel_name if channel else "未知",
                            "allocation_ratio": alloc.allocation_ratio,
                            "allocation_amount": alloc.allocation_amount,
                            "allocation_basis": alloc.allocation_basis,
                        })

                product_totals[key]["total_fee"] = (
                    product_totals[key]["management_fee"] +
                    product_totals[key]["custodian_fee"] +
                    product_totals[key]["sales_service_fee"]
                )
                product_totals[key]["net_total"] = (
                    product_totals[key]["management_fee"] +
                    product_totals[key]["custodian_fee"] +
                    product_totals[key]["sales_service_fee"]
                )

                if accrual.is_manual_adjusted:
                    product_totals[key]["manual_adjusted"] = True
                    manual_adjustment_count += 1

                total_tax += accrual.tax_amount

            unresolved_anomalies = self.detector.get_unresolved_anomalies()
            anomaly_ids = {(a["entity_type"], a["entity_id"]) for a in unresolved_anomalies}

            for pid in product_ids:
                product = session.query(Product).filter(Product.id == pid).first()
                if product and ("Product", pid) in anomaly_ids:
                    product_totals[product.product_code]["has_anomaly"] = True

            grand_total = total_management + total_custodian + total_sales

            report_code = self._generate_report_code(year, month)

            existing_report = session.query(AuditReport).filter(
                and_(
                    AuditReport.report_period == f"{year}-{month:02d}",
                    AuditReport.report_status != "final"
                )
            ).first()

            if existing_report:
                existing_report.report_code = report_code
                existing_report.report_date = date.today()
                existing_report.operator = operator
                existing_report.reviewer = reviewer
                existing_report.product_count = len(product_totals)
                existing_report.total_management_fee = total_management
                existing_report.total_custodian_fee = total_custodian
                existing_report.total_sales_service_fee = total_sales
                existing_report.total_anomalies = anomaly_result["total"]
                existing_report.unresolved_anomalies = len(unresolved_anomalies)
                existing_report.manual_adjustments = manual_adjustment_count
                report_id = existing_report.id
            else:
                report = AuditReport(
                    report_code=report_code,
                    report_period=f"{year}-{month:02d}",
                    report_date=date.today(),
                    operator=operator,
                    reviewer=reviewer,
                    report_status="draft",
                    product_count=len(product_totals),
                    total_management_fee=total_management,
                    total_custodian_fee=total_custodian,
                    total_sales_service_fee=total_sales,
                    total_anomalies=anomaly_result["total"],
                    unresolved_anomalies=len(unresolved_anomalies),
                    manual_adjustments=manual_adjustment_count,
                )
                session.add(report)
                session.flush()
                report_id = report.id

        return {
            "report_id": report_id,
            "report_code": report_code,
            "period": f"{year}-{month:02d}",
            "period_start": period_start,
            "period_end": period_end,
            "summary": {
                "product_count": len(product_totals),
                "total_management_fee": total_management,
                "total_custodian_fee": total_custodian,
                "total_sales_service_fee": total_sales,
                "grand_total": grand_total,
                "total_tax": total_tax,
                "net_total": grand_total,
                "anomalies": anomaly_result["total"],
                "unresolved_anomalies": len(unresolved_anomalies),
                "manual_adjustments": manual_adjustment_count,
            },
            "by_product": list(product_totals.values()),
            "channel_allocations": dict(channel_allocations),
            "anomalies": anomaly_result,
        }

    def export_to_excel(
        self,
        year: int,
        month: int,
        report_data: Optional[Dict[str, Any]] = None,
        output_path: Optional[str] = None,
        operator: str = "system"
    ) -> str:
        if report_data is None:
            report_data = self.generate_monthly_report(
                year, month, operator=operator, recalculate=False
            )

        Config.init_dirs()
        if output_path is None:
            output_path = str(
                Config.EXPORT_DIR / f"理财产品费用核对报告_{year:04d}{month:02d}_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
            )

        with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
            summary_df = pd.DataFrame([{
                "项目": "产品数量",
                "数值": report_data["summary"]["product_count"],
            }, {
                "项目": "管理费合计（净额）",
                "数值": float(report_data["summary"]["total_management_fee"]),
            }, {
                "项目": "托管费合计（净额）",
                "数值": float(report_data["summary"]["total_custodian_fee"]),
            }, {
                "项目": "销售服务费合计（净额）",
                "数值": float(report_data["summary"]["total_sales_service_fee"]),
            }, {
                "项目": "费用总计",
                "数值": float(report_data["summary"]["grand_total"]),
            }, {
                "项目": "增值税合计",
                "数值": float(report_data["summary"]["total_tax"]),
            }, {
                "项目": "异常检测数量",
                "数值": report_data["summary"]["anomalies"],
            }, {
                "项目": "待处理异常",
                "数值": report_data["summary"]["unresolved_anomalies"],
            }, {
                "项目": "人工调整次数",
                "数值": report_data["summary"]["manual_adjustments"],
            }])
            summary_df.to_excel(writer, sheet_name="汇总", index=False)

            product_data = []
            for p in report_data["by_product"]:
                product_data.append({
                    "产品代码": p["product_code"],
                    "产品名称": p["product_name"],
                    "管理费（净额）": float(p["management_fee"]),
                    "托管费（净额）": float(p["custodian_fee"]),
                    "销售服务费（净额）": float(p["sales_service_fee"]),
                    "费用合计": float(p["total_fee"]),
                    "是否人工调整": "是" if p["manual_adjusted"] else "否",
                    "是否存在异常": "是" if p["has_anomaly"] else "否",
                })

            if product_data:
                product_df = pd.DataFrame(product_data)
                product_df.to_excel(writer, sheet_name="产品明细", index=False)

            channel_data = []
            for product_code, allocs in report_data["channel_allocations"].items():
                for alloc in allocs:
                    channel_data.append({
                        "产品代码": product_code,
                        "渠道代码": alloc["channel_code"],
                        "渠道名称": alloc["channel_name"],
                        "分摊比例(%)": float(alloc["allocation_ratio"] * 100),
                        "分摊金额": float(alloc["allocation_amount"]),
                        "分摊基数（份额）": float(alloc["allocation_basis"] or 0),
                    })

            if channel_data:
                channel_df = pd.DataFrame(channel_data)
                channel_df.to_excel(writer, sheet_name="渠道分摊", index=False)

            anomaly_data = []
            for a in report_data["anomalies"]["anomalies"]:
                anomaly_data.append({
                    "异常类型": a["anomaly_type"],
                    "严重程度": a["severity"],
                    "实体类型": a["entity_type"],
                    "实体ID": a["entity_id"],
                    "描述": a["description"],
                    "期望值": a["expected_value"],
                    "实际值": a["actual_value"],
                    "开始日期": a["period_start"],
                    "结束日期": a["period_end"],
                })

            if anomaly_data:
                anomaly_df = pd.DataFrame(anomaly_data)
                anomaly_df.to_excel(writer, sheet_name="异常记录", index=False)

            history_query = f"""
            报告生成时间: {datetime.now()}
            报告期间: {report_data['period']}
            报告编码: {report_data['report_code']}
            操作员: {operator}
            """

            pd.DataFrame([{"信息": history_query}]).to_excel(
                writer, sheet_name="导出历史", index=False
            )

        return output_path

    def export_to_json(
        self,
        year: int,
        month: int,
        report_data: Optional[Dict[str, Any]] = None,
        output_path: Optional[str] = None,
        operator: str = "system"
    ) -> str:
        if report_data is None:
            report_data = self.generate_monthly_report(
                year, month, operator=operator, recalculate=False
            )

        Config.init_dirs()
        if output_path is None:
            output_path = str(
                Config.EXPORT_DIR / f"理财产品费用核对报告_{year:04d}{month:02d}_{datetime.now().strftime('%Y%m%d%H%M%S')}.json"
            )

        def default_serializer(obj):
            if isinstance(obj, Decimal):
                return float(obj)
            if isinstance(obj, (date, datetime)):
                return obj.isoformat()
            raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

        export_data = {
            "metadata": {
                "export_time": datetime.now().isoformat(),
                "report_code": report_data["report_code"],
                "period": report_data["period"],
                "operator": operator,
                "version": "1.0.0",
            },
            "summary": report_data["summary"],
            "by_product": report_data["by_product"],
            "channel_allocations": report_data["channel_allocations"],
            "anomalies": report_data["anomalies"]["anomalies"],
        }

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(export_data, f, default=default_serializer,
                      ensure_ascii=False, indent=2)

        return output_path

    def finalize_report(
        self,
        report_id: int,
        operator: str,
        reviewer: str,
        signed_file_path: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        with self.db.get_session() as session:
            report = session.query(AuditReport).filter(
                AuditReport.id == report_id
            ).first()

            if not report:
                return None

            report.report_status = "final"
            report.reviewer = reviewer
            report.signed_file_path = signed_file_path
            report.report_date = date.today()

            batch = self.db.create_batch(
                source_type="report_finalize",
                operator=operator,
                remark=f"报告定稿 {report.report_code}"
            )

            self.db.log_change(
                batch_id=batch.id,
                entity_type="AuditReport",
                entity_id=report.id,
                field_name="report_status",
                old_value="draft",
                new_value="final",
                change_type="update",
                operator=operator,
                reason="报告定稿"
            )

            session.flush()
            return {
                "id": report.id,
                "report_code": report.report_code,
                "report_period": report.report_period,
                "report_status": report.report_status,
                "product_count": report.product_count,
                "total_management_fee": report.total_management_fee,
                "total_custodian_fee": report.total_custodian_fee,
                "total_sales_service_fee": report.total_sales_service_fee,
                "reviewer": report.reviewer,
                "report_date": report.report_date,
                "signed_file_path": report.signed_file_path,
            }

    def get_report_history(
        self,
        period: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        with self.db.get_session() as session:
            query = session.query(AuditReport).order_by(
                AuditReport.report_date.desc()
            )
            if period:
                query = query.filter(AuditReport.report_period == period)

            reports = query.limit(limit).all()

            result = []
            for r in reports:
                changes = self.db.get_change_history(
                    entity_type="AuditReport", entity_id=r.id
                )
                result.append({
                    "id": r.id,
                    "report_code": r.report_code,
                    "report_period": r.report_period,
                    "report_date": r.report_date,
                    "operator": r.operator,
                    "reviewer": r.reviewer,
                    "status": r.report_status,
                    "total_fee": float(
                        r.total_management_fee +
                        r.total_custodian_fee +
                        r.total_sales_service_fee
                    ),
                    "anomalies": r.total_anomalies,
                    "unresolved_anomalies": r.unresolved_anomalies,
                    "manual_adjustments": r.manual_adjustments,
                    "change_count": len(changes),
                })

            return result
