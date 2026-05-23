import os
import json
from datetime import datetime
import pandas as pd
from dateutil import parser as date_parser
from .database import get_session, ImportBatch, ConsumableRecord, FailedRecord, AuditLog

SOURCE_TYPES = ["领用单", "采购到货表", "老师补签记录", "门店交接纸", "客服备注"]


def parse_date(date_str):
    if pd.isna(date_str) or date_str == "":
        return None
    try:
        if isinstance(date_str, datetime):
            return date_str
        return date_parser.parse(str(date_str), fuzzy=True)
    except Exception:
        return None


def parse_float(value):
    if pd.isna(value) or value == "" or value is None:
        return 0.0
    try:
        return float(value)
    except (ValueError, TypeError):
        s = str(value).replace(",", "").strip()
        try:
            return float(s)
        except ValueError:
            return 0.0


def validate_record(data, source_type):
    errors = []

    if not data.get("material_name"):
        errors.append("缺少耗材名称")

    qty = data.get("quantity", 0)
    if qty <= 0:
        errors.append("数量必须大于0")

    return errors


def map_columns(df, source_type):
    column_mapping = {
        "领用单": {
            "日期": "record_date", "领用日期": "record_date", "date": "record_date",
            "物料编码": "material_code", "物品编码": "material_code", "code": "material_code",
            "物品名称": "material_name", "耗材名称": "material_name", "名称": "material_name",
            "规格型号": "specification", "规格": "specification", "型号": "specification",
            "单位": "unit",
            "数量": "quantity", "领用数量": "quantity",
            "单价": "unit_price",
            "金额": "total_price", "总价": "total_price",
            "部门": "department", "学院": "department",
            "课题组": "research_group", "实验室": "research_group",
            "领用人": "applicant", "申请人": "applicant", "老师": "applicant",
            "签收人": "receiver",
            "经手人": "handler",
            "用途": "purpose", "使用方向": "purpose",
            "存放地点": "location", "地点": "location",
            "备注": "remark", "说明": "remark",
        },
        "采购到货表": {
            "到货日期": "record_date", "采购日期": "record_date", "日期": "record_date",
            "物料编码": "material_code",
            "物品名称": "material_name", "耗材名称": "material_name",
            "规格型号": "specification",
            "单位": "unit",
            "到货数量": "quantity", "采购数量": "quantity", "数量": "quantity",
            "单价": "unit_price",
            "金额": "total_price",
            "供应商": "supplier",
            "订单号": "order_no",
            "入库单号": "receipt_no", "验收单号": "receipt_no",
            "备注": "remark",
        },
        "老师补签记录": {
            "日期": "record_date", "补签日期": "record_date",
            "物料编码": "material_code",
            "物品名称": "material_name",
            "规格型号": "specification",
            "单位": "unit",
            "数量": "quantity", "补领数量": "quantity",
            "单价": "unit_price",
            "金额": "total_price",
            "老师": "applicant", "补签人": "applicant",
            "部门": "department",
            "课题组": "research_group",
            "原因": "remark", "补签原因": "remark",
        },
        "门店交接纸": {
            "日期": "record_date", "交接日期": "record_date",
            "物品名称": "material_name",
            "规格": "specification",
            "单位": "unit",
            "数量": "quantity", "交接数量": "quantity",
            "转出门店": "department",
            "转入门店": "location",
            "交接人": "handler",
            "备注": "remark",
        },
        "客服备注": {
            "日期": "record_date",
            "物品名称": "material_name",
            "数量": "quantity",
            "备注": "remark", "客服说明": "remark",
        },
    }

    mapping = column_mapping.get(source_type, column_mapping["领用单"])
    df = df.rename(columns=mapping)
    return df


def import_file(file_path, source_type, imported_by="system", notes=""):
    if source_type not in SOURCE_TYPES:
        raise ValueError(f"不支持的数据源类型: {source_type}。支持的类型: {', '.join(SOURCE_TYPES)}")

    if not os.path.exists(file_path):
        raise FileNotFoundError(f"文件不存在: {file_path}")

    session = get_session()

    try:
        if file_path.endswith(".csv"):
            df = pd.read_csv(file_path, dtype=str)
        elif file_path.endswith((".xlsx", ".xls")):
            df = pd.read_excel(file_path, dtype=str)
        else:
            raise ValueError("只支持 CSV 或 Excel 文件")

        df = map_columns(df, source_type)

        batch = ImportBatch(
            source_type=source_type,
            file_name=os.path.basename(file_path),
            file_path=os.path.abspath(file_path),
            total_rows=len(df),
            imported_by=imported_by,
            notes=notes,
        )
        session.add(batch)
        session.flush()

        success_count = 0
        failed_count = 0

        for idx, row in df.iterrows():
            original_row = idx + 2
            try:
                data = {
                    "source_type": source_type,
                    "original_row": original_row,
                    "record_date": parse_date(row.get("record_date")),
                    "material_code": str(row.get("material_code", "")) if pd.notna(row.get("material_code")) else "",
                    "material_name": str(row.get("material_name", "")).strip() if pd.notna(row.get("material_name")) else "",
                    "specification": str(row.get("specification", "")) if pd.notna(row.get("specification")) else "",
                    "unit": str(row.get("unit", "")) if pd.notna(row.get("unit")) else "",
                    "quantity": parse_float(row.get("quantity")),
                    "unit_price": parse_float(row.get("unit_price")),
                    "total_price": parse_float(row.get("total_price")),
                    "department": str(row.get("department", "")) if pd.notna(row.get("department")) else "",
                    "research_group": str(row.get("research_group", "")) if pd.notna(row.get("research_group")) else "",
                    "applicant": str(row.get("applicant", "")) if pd.notna(row.get("applicant")) else "",
                    "receiver": str(row.get("receiver", "")) if pd.notna(row.get("receiver")) else "",
                    "handler": str(row.get("handler", "")) if pd.notna(row.get("handler")) else "",
                    "purpose": str(row.get("purpose", "")) if pd.notna(row.get("purpose")) else "",
                    "location": str(row.get("location", "")) if pd.notna(row.get("location")) else "",
                    "supplier": str(row.get("supplier", "")) if pd.notna(row.get("supplier")) else "",
                    "order_no": str(row.get("order_no", "")) if pd.notna(row.get("order_no")) else "",
                    "receipt_no": str(row.get("receipt_no", "")) if pd.notna(row.get("receipt_no")) else "",
                    "remark": str(row.get("remark", "")) if pd.notna(row.get("remark")) else "",
                }

                errors = validate_record(data, source_type)
                if errors:
                    raise ValueError("; ".join(errors))

                record = ConsumableRecord(batch_id=batch.id, **data)
                session.add(record)
                success_count += 1

            except Exception as e:
                raw_data = json.dumps(row.to_dict(), ensure_ascii=False, default=str)
                failed = FailedRecord(
                    batch_id=batch.id,
                    source_type=source_type,
                    original_row=original_row,
                    raw_data=raw_data,
                    error_message=str(e),
                    error_type=type(e).__name__,
                )
                session.add(failed)
                failed_count += 1

        batch.success_count = success_count
        batch.failed_count = failed_count
        session.commit()

        return {
            "batch_id": batch.id,
            "total": batch.total_rows,
            "success": success_count,
            "failed": failed_count,
        }

    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
