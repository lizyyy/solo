from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import crud
import models
import pandas as pd
import os


REPORTS_DIR = "./reports"
os.makedirs(REPORTS_DIR, exist_ok=True)


def validate_raw_material(material, line_number: int):
    errors = []

    required_fields = ['sku_name', 'sku_code', 'quantity', 'location_code', 'location_name', 'inventory_time']
    for field in required_fields:
        if not getattr(material, field, None):
            errors.append(f"缺少必填字段: {field}")

    if material.quantity is not None and material.quantity < 0:
        errors.append("数量不能为负数")

    if material.expiry_date and material.inventory_time:
        if material.expiry_date < material.inventory_time:
            errors.append("过期时间早于盘点时间")

    return errors


def calculate_priority_score(material):
    score = 0.0

    if material.expiry_date:
        now = datetime.now()
        days_to_expiry = (material.expiry_date - now).days
        if days_to_expiry <= 0:
            score += 100
        elif days_to_expiry <= 3:
            score += 80
        elif days_to_expiry <= 7:
            score += 50
        elif days_to_expiry <= 14:
            score += 30

    score += min(material.quantity * 0.1, 20)

    return score


def process_single_material(db: Session, material: models.RawMaterial, batch_id: int):
    crud.create_process_record(
        db, batch_id, material.id, material.sku_code, material.quantity, 0,
        "processing", "start", "开始处理材料"
    )

    errors = validate_raw_material(material, material.line_number)
    if errors:
        error_msg = "; ".join(errors)
        crud.update_raw_material_error(db, material.id, error_msg)
        crud.create_process_record(
            db, batch_id, material.id, material.sku_code, material.quantity, 0,
            "error", "validation", f"验证失败: {error_msg}"
        )
        return False

    canonical_sku = crud.get_canonical_sku(db, material.sku_code)
    crud.create_process_record(
        db, batch_id, material.id, canonical_sku, material.quantity, 0,
        "processing", "sku_normalization",
        f"SKU标准化: {material.sku_code} -> {canonical_sku}"
    )

    standard_time = crud.get_standard_inventory_time(db, material.location_code)
    inventory_time_diff = None
    if standard_time:
        time_diff = abs((material.inventory_time - standard_time).total_seconds() // 3600)
        inventory_time_diff = int(time_diff)
        crud.create_process_record(
            db, batch_id, material.id, canonical_sku, material.quantity, 0,
            "processing", "time_alignment",
            f"盘点时间对齐: 差异 {time_diff} 小时"
        )

    priority_score = calculate_priority_score(material)
    adjusted_quantity = material.quantity

    crud.create_process_record(
        db, batch_id, material.id, canonical_sku, adjusted_quantity, priority_score,
        "success", "complete", "处理完成", inventory_time_diff
    )

    return True


def process_batch(db: Session, batch_id: int):
    materials = crud.get_raw_materials_by_batch(db, batch_id)

    for material in materials:
        process_single_material(db, material, batch_id)

    report_path = generate_report(db, batch_id)

    crud.update_batch_status(db, batch_id, "completed", report_path)

    return report_path


def generate_report(db: Session, batch_id: int):
    materials = crud.get_raw_materials_by_batch(db, batch_id)
    process_records = crud.get_process_records_by_batch(db, batch_id)

    data = []
    for material in materials:
        records = [r for r in process_records if r.raw_material_id == material.id]
        final_record = next((r for r in records if r.step == "complete"), None)

        row = {
            '原始行号': material.line_number,
            'SKU名称': material.sku_name,
            '原始SKU编码': material.sku_code,
            '标准SKU编码': final_record.canonical_sku if final_record else material.sku_code,
            '原始数量': material.quantity,
            '调整后数量': final_record.adjusted_quantity if final_record else material.quantity,
            '优先级分数': final_record.priority_score if final_record else 0,
            '点位编码': material.location_code,
            '点位名称': material.location_name,
            '盘点时间': material.inventory_time,
            '过期时间': material.expiry_date,
            '盘点时间差异(小时)': final_record.inventory_time_diff if final_record else None,
            '处理状态': '错误' if material.is_error else '成功',
            '错误信息': material.error_message
        }
        data.append(row)

    df = pd.DataFrame(data)

    batch = crud.get_batch_by_no(db, str(batch_id))
    if not batch:
        batch = db.query(models.Batch).filter(models.Batch.id == batch_id).first()

    filename = f"replenishment_report_{batch.batch_no}_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    filepath = os.path.join(REPORTS_DIR, filename)

    df.to_excel(filepath, index=False, engine='openpyxl')

    return filepath
