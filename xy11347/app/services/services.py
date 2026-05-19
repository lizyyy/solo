from sqlalchemy.orm import Session
from typing import List, Dict, Any, Tuple
import pandas as pd
import json
from datetime import datetime
from app.models.models import (
    ImportSource, QCStatus, ColorMeasurement, Order, ReworkRecord, QCReport
)
from app.schemas.schemas import (
    ColorMeasurementCreate, OrderCreate, ReworkRecordCreate,
    ImportErrorRecordCreate, ImportResult, ImportErrorRecordResponse
)
from app.repositories.repositories import (
    OrderRepository, ColorMeasurementRepository, ReworkRecordRepository,
    QCReportRepository, ReviewRecordRepository, ImportErrorRecordRepository,
    TrendAnalysisRepository, QCRuleRepository
)
from app.core.security import mask_sensitive_data, mask_sensitive_log


class ImportService:
    def __init__(self, db: Session):
        self.db = db
        self.order_repo = OrderRepository(db)
        self.measurement_repo = ColorMeasurementRepository(db)
        self.rework_repo = ReworkRecordRepository(db)
        self.error_repo = ImportErrorRecordRepository(db)

    def import_color_csv(self, file_content: bytes, filename: str, created_by: str = None) -> ImportResult:
        success_count = 0
        error_count = 0
        error_records = []

        try:
            df = pd.read_csv(pd.io.common.BytesIO(file_content))
        except Exception as e:
            error_record = self.error_repo.create(
                ImportErrorRecordCreate(
                    import_source=ImportSource.COLOR_CSV,
                    file_name=filename,
                    original_data=f"CSV parse error: {str(e)}",
                    error_type="PARSE_ERROR",
                    error_message=f"无法解析CSV文件: {str(e)}",
                    suggestion="请检查文件格式是否正确，确保是标准CSV格式"
                ),
                created_by=created_by
            )
            error_records.append(ImportErrorRecordResponse.from_orm(error_record))
            error_count += 1
            return ImportResult(success_count=0, error_count=1, error_records=error_records)

        required_columns = ["order_no", "l_value", "a_value", "b_value"]
        missing_columns = [col for col in required_columns if col not in df.columns]
        
        if missing_columns:
            error_record = self.error_repo.create(
                ImportErrorRecordCreate(
                    import_source=ImportSource.COLOR_CSV,
                    file_name=filename,
                    original_data=f"Missing columns: {', '.join(missing_columns)}",
                    error_type="SCHEMA_ERROR",
                    error_message=f"缺少必要的列: {', '.join(missing_columns)}",
                    suggestion=f"请确保CSV包含以下列: order_no, l_value, a_value, b_value"
                ),
                created_by=created_by
            )
            error_records.append(ImportErrorRecordResponse.from_orm(error_record))
            error_count += 1
            return ImportResult(success_count=0, error_count=error_count, error_records=error_records)

        for idx, row in df.iterrows():
            row_number = idx + 2
            try:
                for col in ["l_value", "a_value", "b_value"]:
                    if pd.isna(row.get(col)):
                        raise ValueError(f"{col}不能为空")
                
                order_no = str(row.get("order_no", "")).strip()
                if not order_no:
                    raise ValueError("order_no不能为空")
                
                measurement_data = ColorMeasurementCreate(
                    order_no=order_no,
                    measurement_no=str(row.get("measurement_no", "")) if pd.notna(row.get("measurement_no")) else None,
                    measure_point=str(row.get("measure_point", "")) if pd.notna(row.get("measure_point")) else None,
                    l_value=float(row.get("l_value")),
                    a_value=float(row.get("a_value")),
                    b_value=float(row.get("b_value")),
                    paper_batch=str(row.get("paper_batch", "")) if pd.notna(row.get("paper_batch")) else None,
                    operator=str(row.get("operator", "")) if pd.notna(row.get("operator")) else None,
                    equipment=str(row.get("equipment", "")) if pd.notna(row.get("equipment")) else None
                )
                
                self.measurement_repo.create(measurement_data, created_by=created_by)
                success_count += 1
                
            except Exception as e:
                error_count += 1
                self.db.rollback()
                original_row = json.dumps(row.to_dict(), ensure_ascii=False)
                suggestion = self._generate_error_suggestion(e, row)
                error_record = self.error_repo.create(
                    ImportErrorRecordCreate(
                        import_source=ImportSource.COLOR_CSV,
                        file_name=filename,
                        row_number=row_number,
                        original_data=original_row,
                        error_type=type(e).__name__,
                        error_message=str(e),
                        suggestion=suggestion
                    ),
                    created_by=created_by
                )
                error_records.append(ImportErrorRecordResponse.from_orm(error_record))

        return ImportResult(success_count=success_count, error_count=error_count, error_records=error_records)

    def import_order_json(self, file_content: bytes, filename: str, created_by: str = None) -> ImportResult:
        success_count = 0
        error_count = 0
        error_records = []

        try:
            data = json.loads(file_content.decode('utf-8'))
            if isinstance(data, dict):
                orders = [data]
            elif isinstance(data, list):
                orders = data
            else:
                raise ValueError("JSON格式不正确，应该是对象或对象数组")
        except Exception as e:
            error_record = self.error_repo.create(
                ImportErrorRecordCreate(
                    import_source=ImportSource.ORDER_JSON,
                    file_name=filename,
                    original_data=f"JSON parse error: {str(e)}",
                    error_type="PARSE_ERROR",
                    error_message=f"无法解析JSON文件: {str(e)}",
                    suggestion="请检查文件格式是否正确，确保是标准JSON格式"
                ),
                created_by=created_by
            )
            error_records.append(ImportErrorRecordResponse.from_orm(error_record))
            error_count += 1
            return ImportResult(success_count=0, error_count=1, error_records=error_records)

        for idx, order_data in enumerate(orders):
            row_number = idx + 1
            try:
                order = OrderCreate(**order_data)
                existing_order = self.order_repo.get_by_order_no(order.order_no)
                if existing_order:
                    raise ValueError(f"订单号 {order.order_no} 已存在")
                self.order_repo.create(order, created_by=created_by)
                success_count += 1
            except Exception as e:
                error_count += 1
                self.db.rollback()
                original_data = json.dumps(order_data, ensure_ascii=False)
                error_record = self.error_repo.create(
                    ImportErrorRecordCreate(
                        import_source=ImportSource.ORDER_JSON,
                        file_name=filename,
                        row_number=row_number,
                        original_data=original_data,
                        error_type=type(e).__name__,
                        error_message=str(e),
                        suggestion="请检查订单数据是否完整，订单号是否唯一"
                    ),
                    created_by=created_by
                )
                error_records.append(ImportErrorRecordResponse.from_orm(error_record))

        return ImportResult(success_count=success_count, error_count=error_count, error_records=error_records)

    def import_rework_notes(self, file_content: bytes, filename: str, created_by: str = None) -> ImportResult:
        success_count = 0
        error_count = 0
        error_records = []

        try:
            df = pd.read_csv(pd.io.common.BytesIO(file_content))
        except Exception as e:
            error_record = self.error_repo.create(
                ImportErrorRecordCreate(
                    import_source=ImportSource.REWORK_NOTE,
                    file_name=filename,
                    original_data=f"CSV parse error: {str(e)}",
                    error_type="PARSE_ERROR",
                    error_message=f"无法解析CSV文件: {str(e)}",
                    suggestion="请检查文件格式是否正确"
                ),
                created_by=created_by
            )
            error_records.append(ImportErrorRecordResponse.from_orm(error_record))
            error_count += 1
            return ImportResult(success_count=0, error_count=1, error_records=error_records)

        required_columns = ["order_no", "rework_reason"]
        missing_columns = [col for col in required_columns if col not in df.columns]
        
        if missing_columns:
            error_record = self.error_repo.create(
                ImportErrorRecordCreate(
                    import_source=ImportSource.REWORK_NOTE,
                    file_name=filename,
                    original_data=f"Missing columns: {', '.join(missing_columns)}",
                    error_type="SCHEMA_ERROR",
                    error_message=f"缺少必要的列: {', '.join(missing_columns)}",
                    suggestion="请确保CSV包含 order_no 和 rework_reason 列"
                ),
                created_by=created_by
            )
            error_records.append(ImportErrorRecordResponse.from_orm(error_record))
            error_count += 1
            return ImportResult(success_count=0, error_count=error_count, error_records=error_records)

        for idx, row in df.iterrows():
            row_number = idx + 2
            try:
                rework_data = ReworkRecordCreate(
                    order_no=str(row.get("order_no", "")).strip(),
                    rework_type=str(row.get("rework_type", "")) if pd.notna(row.get("rework_type")) else None,
                    rework_reason=str(row.get("rework_reason", "")).strip(),
                    rework_count=int(row.get("rework_count", 1)) if pd.notna(row.get("rework_count")) else 1,
                    operator=str(row.get("operator", "")) if pd.notna(row.get("operator")) else None,
                    remarks=str(row.get("remarks", "")) if pd.notna(row.get("remarks")) else None
                )
                
                if not rework_data.order_no:
                    raise ValueError("order_no不能为空")
                if not rework_data.rework_reason:
                    raise ValueError("rework_reason不能为空")
                
                self.rework_repo.create(rework_data, created_by=created_by)
                success_count += 1
                
            except Exception as e:
                error_count += 1
                self.db.rollback()
                original_row = json.dumps(row.to_dict(), ensure_ascii=False)
                error_record = self.error_repo.create(
                    ImportErrorRecordCreate(
                        import_source=ImportSource.REWORK_NOTE,
                        file_name=filename,
                        row_number=row_number,
                        original_data=original_row,
                        error_type=type(e).__name__,
                        error_message=str(e),
                        suggestion="请检查返工记录数据是否完整"
                    ),
                    created_by=created_by
                )
                error_records.append(ImportErrorRecordResponse.from_orm(error_record))

        return ImportResult(success_count=success_count, error_count=error_count, error_records=error_records)

    def _generate_error_suggestion(self, error: Exception, row: pd.Series) -> str:
        error_str = str(error)
        if "l_value" in error_str or "a_value" in error_str or "b_value" in error_str:
            return "请检查Lab值是否为有效数字，不能为空白或非数字字符"
        elif "order_no" in error_str:
            return "请检查订单号是否填写，不能为空"
        elif "could not convert string to float" in error_str:
            return "数值列包含非数字字符，请检查数据格式"
        else:
            return "请检查数据格式和必填字段是否完整"


class QCJudgmentService:
    def __init__(self, db: Session):
        self.db = db
        self.measurement_repo = ColorMeasurementRepository(db)
        self.order_repo = OrderRepository(db)
        self.rule_repo = QCRuleRepository(db)

    def evaluate_measurement(self, measurement_id: int) -> Tuple[bool, List[str]]:
        measurement = self.measurement_repo.get_by_id(measurement_id)
        if not measurement:
            return False, ["找不到测色记录"]

        if measurement.order_id:
            order = self.order_repo.get_by_id(measurement.order_id)
            if order:
                is_pass = (
                    abs(measurement.delta_l or 0) <= order.tolerance_l and
                    abs(measurement.delta_a or 0) <= order.tolerance_a and
                    abs(measurement.delta_b or 0) <= order.tolerance_b
                )
                return is_pass, []

        rules = self.rule_repo.get_active_rules()
        issues = []
        for rule in rules:
            if not self._apply_rule(measurement, rule):
                issues.append(rule.description)

        return len(issues) == 0, issues

    def _apply_rule(self, measurement: ColorMeasurement, rule) -> bool:
        try:
            context = {
                "l_value": measurement.l_value,
                "a_value": measurement.a_value,
                "b_value": measurement.b_value,
                "delta_l": measurement.delta_l or 0,
                "delta_a": measurement.delta_a or 0,
                "delta_b": measurement.delta_b or 0,
                "delta_e": measurement.delta_e or 0
            }
            return eval(rule.condition_expression, {"__builtins__": {}}, context)
        except:
            return True

    def evaluate_order(self, order_id: int) -> Dict[str, Any]:
        stats = self.measurement_repo.get_stats_by_order(order_id)
        order = self.order_repo.get_by_id(order_id)

        if not order:
            return {"status": QCStatus.PENDING, "message": "订单不存在"}

        if stats["total"] == 0:
            return {"status": QCStatus.PENDING, "message": "暂无测色数据"}

        pass_rate = stats["pass_rate"]
        
        if pass_rate >= 0.95:
            status = QCStatus.PASS
        elif pass_rate >= 0.8:
            status = QCStatus.REVIEWING
        else:
            status = QCStatus.FAIL

        self.order_repo.update_status(order_id, status)

        return {
            "status": status,
            "pass_rate": pass_rate,
            "total_measurements": stats["total"],
            "pass_count": stats["pass_count"],
            "fail_count": stats["fail_count"],
            "avg_delta_e": stats["avg_delta_e"]
        }


class QCReportService:
    def __init__(self, db: Session):
        self.db = db
        self.report_repo = QCReportRepository(db)
        self.measurement_repo = ColorMeasurementRepository(db)
        self.rework_repo = ReworkRecordRepository(db)
        self.order_repo = OrderRepository(db)

    def generate_report(self, order_no: str, created_by: str = None) -> QCReport:
        order = self.order_repo.get_by_order_no(order_no)
        if not order:
            raise ValueError(f"订单 {order_no} 不存在")

        stats = self.measurement_repo.get_stats_by_order(order.id)
        rework_count = self.rework_repo.count_by_order(order.id)

        from app.schemas.schemas import QCReportCreate
        import uuid
        report_no = f"QC{uuid.uuid4().hex[:12].upper()}"
        
        report_data = QCReportCreate(
            order_no=order_no,
            total_measurements=stats["total"],
            pass_count=stats["pass_count"],
            fail_count=stats["fail_count"],
            pass_rate=stats.get("pass_rate", 0),
            avg_delta_e=stats.get("avg_delta_e"),
            max_delta_e=stats.get("max_delta_e"),
            min_delta_e=stats.get("min_delta_e"),
            rework_count=rework_count
        )

        try:
            report = self.report_repo.create_with_report_no(report_data, report_no, created_by=created_by)
        except Exception as e:
            self.db.rollback()
            raise e
        
        if stats["pass_rate"] >= 0.95:
            conclusion = QCStatus.PASS
        elif stats["pass_rate"] >= 0.8:
            conclusion = QCStatus.REVIEWING
        else:
            conclusion = QCStatus.FAIL
        
        self.report_repo.update_conclusion(report.id, conclusion, created_by or "system")
        self.order_repo.update_status(order.id, conclusion)

        return report


class ReviewService:
    def __init__(self, db: Session):
        self.db = db
        self.report_repo = QCReportRepository(db)
        self.review_repo = ReviewRecordRepository(db)
        self.order_repo = OrderRepository(db)

    def perform_review(self, report_id: int, review_action: str, review_notes: str,
                       after_status: QCStatus, reviewer: str) -> Dict[str, Any]:
        from app.schemas.schemas import ReviewRecordCreate
        review_data = ReviewRecordCreate(
            qc_report_id=report_id,
            review_action=review_action,
            review_notes=review_notes,
            after_status=after_status
        )
        
        review = self.review_repo.create(review_data, reviewer)
        
        report = self.report_repo.get_by_id(report_id)
        if report:
            self.report_repo.update_conclusion(report_id, after_status, reviewer)
            if report.order_id:
                self.order_repo.update_status(report.order_id, after_status)

        return {
            "review_id": review.id,
            "report_id": report_id,
            "before_status": review.before_status,
            "after_status": after_status,
            "reviewer": reviewer,
            "review_date": review.review_date
        }


class TrendAnalysisService:
    def __init__(self, db: Session):
        self.db = db
        self.trend_repo = TrendAnalysisRepository(db)

    def get_daily_trend(self, paper_batch: str = None, days: int = 30) -> Dict[str, Any]:
        data = self.trend_repo.get_daily_trend(paper_batch, days)
        paper_batches = self.trend_repo.get_paper_batch_list()
        
        return {
            "paper_batch": paper_batch or "all",
            "days": days,
            "data_points": data,
            "available_paper_batches": paper_batches
        }

    def compare_paper_batches(self, days: int = 30) -> Dict[str, Any]:
        paper_batches = self.trend_repo.get_paper_batch_list()
        results = {}
        
        for batch in paper_batches:
            data = self.trend_repo.get_daily_trend(batch, days)
            if data:
                avg_pass_rate = sum(d["pass_rate"] for d in data) / len(data)
                avg_delta_e = sum(d["avg_delta_e"] for d in data) / len(data)
                total_count = sum(d["total_count"] for d in data)
                
                results[batch] = {
                    "avg_pass_rate": avg_pass_rate,
                    "avg_delta_e": avg_delta_e,
                    "total_count": total_count,
                    "days_with_data": len(data)
                }
        
        return results


class ExportService:
    def __init__(self, db: Session):
        self.db = db
        self.report_repo = QCReportRepository(db)
        self.order_repo = OrderRepository(db)
        self.measurement_repo = ColorMeasurementRepository(db)
        self.rework_repo = ReworkRecordRepository(db)

    def export_qc_report(self, report_id: int, include_sensitive: bool = False) -> Dict[str, Any]:
        report = self.report_repo.get_by_id(report_id)
        if not report:
            raise ValueError(f"质检报告 {report_id} 不存在")

        order = self.order_repo.get_by_id(report.order_id) if report.order_id else None
        measurements = self.measurement_repo.get_by_order_id(report.order_id) if report.order_id else []
        rework_records = self.rework_repo.get_by_order_no(report.order_no)

        report_data = {
            "report_no": report.report_no,
            "order_no": report.order_no,
            "created_at": report.created_at.isoformat(),
            "total_measurements": report.total_measurements,
            "pass_count": report.pass_count,
            "fail_count": report.fail_count,
            "pass_rate": report.pass_rate,
            "avg_delta_e": report.avg_delta_e,
            "max_delta_e": report.max_delta_e,
            "min_delta_e": report.min_delta_e,
            "rework_count": report.rework_count,
            "conclusion": report.conclusion.value if report.conclusion else None,
            "reviewer": report.reviewer,
            "review_date": report.review_date.isoformat() if report.review_date else None,
            "review_remarks": report.review_remarks,
            "measurements": [
                {
                    "l_value": m.l_value,
                    "a_value": m.a_value,
                    "b_value": m.b_value,
                    "delta_l": m.delta_l,
                    "delta_a": m.delta_a,
                    "delta_b": m.delta_b,
                    "delta_e": m.delta_e,
                    "is_pass": m.is_pass,
                    "measure_point": m.measure_point,
                    "operator": mask_sensitive_data({"operator": m.operator})["operator"] if not include_sensitive else m.operator
                }
                for m in measurements
            ],
            "rework_records": [
                {
                    "rework_type": r.rework_type,
                    "rework_reason": r.rework_reason,
                    "rework_count": r.rework_count,
                    "operator": mask_sensitive_data({"operator": r.operator})["operator"] if not include_sensitive else r.operator
                }
                for r in rework_records
            ]
        }

        if order:
            report_data["order_info"] = {
                "product_name": order.product_name,
                "customer": mask_sensitive_data({"customer": order.customer})["customer"] if not include_sensitive else order.customer,
                "paper_batch": order.paper_batch,
                "paper_type": order.paper_type,
                "target_l": order.target_l,
                "target_a": order.target_a,
                "target_b": order.target_b,
                "tolerance_l": order.tolerance_l,
                "tolerance_a": order.tolerance_a,
                "tolerance_b": order.tolerance_b,
                "operator": mask_sensitive_data({"operator": order.operator})["operator"] if not include_sensitive else order.operator,
                "print_date": order.print_date.isoformat() if order.print_date else None
            }

        return report_data

    def export_to_excel(self, report_id: int, output_path: str, include_sensitive: bool = False):
        data = self.export_qc_report(report_id, include_sensitive)
        
        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            summary_df = pd.DataFrame([{
                "报告编号": data["report_no"],
                "订单编号": data["order_no"],
                "生成时间": data["created_at"],
                "总测色次数": data["total_measurements"],
                "合格次数": data["pass_count"],
                "不合格次数": data["fail_count"],
                "合格率": f"{data['pass_rate']*100:.2f}%" if data["pass_rate"] else None,
                "平均ΔE": f"{data['avg_delta_e']:.4f}" if data["avg_delta_e"] else None,
                "最大ΔE": f"{data['max_delta_e']:.4f}" if data["max_delta_e"] else None,
                "最小ΔE": f"{data['min_delta_e']:.4f}" if data["min_delta_e"] else None,
                "返工次数": data["rework_count"],
                "结论": data["conclusion"],
                "复核人": data["reviewer"],
                "复核时间": data["review_date"]
            }])
            summary_df.to_excel(writer, sheet_name='摘要', index=False)

            if data["measurements"]:
                measurements_df = pd.DataFrame(data["measurements"])
                measurements_df.to_excel(writer, sheet_name='测色明细', index=False)

            if data["rework_records"]:
                rework_df = pd.DataFrame(data["rework_records"])
                rework_df.to_excel(writer, sheet_name='返工记录', index=False)

            if "order_info" in data:
                order_df = pd.DataFrame([data["order_info"]])
                order_df.to_excel(writer, sheet_name='订单信息', index=False)
