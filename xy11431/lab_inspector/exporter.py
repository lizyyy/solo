import os
import json
import pandas as pd
from datetime import datetime
from .database import get_session, ConsumableRecord, FailedRecord, ImportBatch


def export_records(output_path, format="xlsx", start_date=None, end_date=None, department=None):
    session = get_session()

    try:
        query = session.query(ConsumableRecord).filter(ConsumableRecord.is_valid == True)

        if start_date:
            if isinstance(start_date, str):
                start_date = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(ConsumableRecord.record_date >= start_date)

        if end_date:
            if isinstance(end_date, str):
                end_date = datetime.strptime(end_date, "%Y-%m-%d")
            query = query.filter(ConsumableRecord.record_date <= end_date)

        if department:
            query = query.filter(ConsumableRecord.department.like(f"%{department}%"))

        records = query.all()

        data = []
        for r in records:
            data.append({
                "记录ID": r.id,
                "来源类型": r.source_type,
                "原始行号": r.original_row,
                "导入批次": r.batch_id,
                "日期": r.record_date.strftime("%Y-%m-%d") if r.record_date else "",
                "物料编码": r.material_code,
                "物料名称": r.material_name,
                "规格型号": r.specification,
                "单位": r.unit,
                "数量": r.quantity,
                "单价": r.unit_price,
                "金额": r.total_price,
                "部门": r.department,
                "课题组": r.research_group,
                "领用人/申请人": r.applicant,
                "签收人": r.receiver,
                "经手人": r.handler,
                "用途": r.purpose,
                "存放地点": r.location,
                "供应商": r.supplier,
                "订单号": r.order_no,
                "入库单号": r.receipt_no,
                "状态": r.status,
                "备注": r.remark,
                "创建时间": r.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "更新时间": r.updated_at.strftime("%Y-%m-%d %H:%M:%S"),
            })

        df = pd.DataFrame(data)

        if format == "xlsx":
            if not output_path.endswith(".xlsx"):
                output_path += ".xlsx"
            df.to_excel(output_path, index=False, sheet_name="有效记录")
        elif format == "csv":
            if not output_path.endswith(".csv"):
                output_path += ".csv"
            df.to_csv(output_path, index=False, encoding="utf-8-sig")
        elif format == "json":
            if not output_path.endswith(".json"):
                output_path += ".json"
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        else:
            raise ValueError(f"不支持的导出格式: {format}")

        return {"path": os.path.abspath(output_path), "count": len(data)}

    finally:
        session.close()


def export_failed_records(output_path, batch_id=None, format="xlsx"):
    session = get_session()

    try:
        query = session.query(FailedRecord)
        if batch_id:
            query = query.filter(FailedRecord.batch_id == batch_id)

        records = query.order_by(FailedRecord.created_at.desc()).all()

        data = []
        for r in records:
            data.append({
                "失败记录ID": r.id,
                "导入批次": r.batch_id,
                "来源类型": r.source_type,
                "原始行号": r.original_row,
                "错误类型": r.error_type,
                "错误信息": r.error_message,
                "是否已解决": "是" if r.is_resolved else "否",
                "解决后记录ID": r.resolved_record_id or "",
                "创建时间": r.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            })

        df = pd.DataFrame(data)

        if format == "xlsx":
            if not output_path.endswith(".xlsx"):
                output_path += ".xlsx"
            df.to_excel(output_path, index=False, sheet_name="失败记录")
        elif format == "csv":
            if not output_path.endswith(".csv"):
                output_path += ".csv"
            df.to_csv(output_path, index=False, encoding="utf-8-sig")
        elif format == "json":
            if not output_path.endswith(".json"):
                output_path += ".json"
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        else:
            raise ValueError(f"不支持的导出格式: {format}")

        return {"path": os.path.abspath(output_path), "count": len(data)}

    finally:
        session.close()


def export_full_report(output_path):
    if not output_path.endswith(".xlsx"):
        output_path += ".xlsx"

    session = get_session()

    try:
        with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
            records = session.query(ConsumableRecord).filter(ConsumableRecord.is_valid == True).all()
            data = []
            for r in records:
                data.append({
                    "记录ID": r.id,
                    "来源类型": r.source_type,
                    "原始行号": r.original_row,
                    "导入批次": r.batch_id,
                    "日期": r.record_date.strftime("%Y-%m-%d") if r.record_date else "",
                    "物料编码": r.material_code,
                    "物料名称": r.material_name,
                    "规格型号": r.specification,
                    "单位": r.unit,
                    "数量": r.quantity,
                    "单价": r.unit_price,
                    "金额": r.total_price,
                    "部门": r.department,
                    "课题组": r.research_group,
                    "领用人": r.applicant,
                    "用途": r.purpose,
                    "状态": r.status,
                    "备注": r.remark,
                })
            pd.DataFrame(data).to_excel(writer, index=False, sheet_name="有效记录")

            failed = session.query(FailedRecord).all()
            failed_data = []
            for r in failed:
                failed_data.append({
                    "失败ID": r.id,
                    "批次": r.batch_id,
                    "来源": r.source_type,
                    "原始行号": r.original_row,
                    "错误类型": r.error_type,
                    "错误信息": r.error_message,
                    "已解决": "是" if r.is_resolved else "否",
                })
            pd.DataFrame(failed_data).to_excel(writer, index=False, sheet_name="失败记录")

            batches = session.query(ImportBatch).all()
            batch_data = []
            for b in batches:
                batch_data.append({
                    "批次ID": b.id,
                    "来源类型": b.source_type,
                    "文件名": b.file_name,
                    "导入时间": b.import_time.strftime("%Y-%m-%d %H:%M:%S"),
                    "总行数": b.total_rows,
                    "成功": b.success_count,
                    "失败": b.failed_count,
                    "导入人": b.imported_by,
                })
            pd.DataFrame(batch_data).to_excel(writer, index=False, sheet_name="导入批次")

            from .database import CorrectionLog
            corrections = session.query(CorrectionLog).all()
            corr_data = []
            for c in corrections:
                corr_data.append({
                    "修正ID": c.id,
                    "记录ID": c.record_id,
                    "字段": c.field_name,
                    "原值": c.old_value,
                    "新值": c.new_value,
                    "原因": c.reason,
                    "修正人": c.corrected_by,
                    "修正时间": c.corrected_at.strftime("%Y-%m-%d %H:%M:%S"),
                })
            pd.DataFrame(corr_data).to_excel(writer, index=False, sheet_name="修正记录")

        return {"path": os.path.abspath(output_path), "sheets": ["有效记录", "失败记录", "导入批次", "修正记录"]}

    finally:
        session.close()
