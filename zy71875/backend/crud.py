from datetime import datetime, date
from typing import List, Optional, Tuple, Dict, Any
import io
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from models import MealRecord, PredictionBatch, ImportHistory, CorrectionLog, SystemConfig
from schemas import MealRecordCreate, MealRecordUpdate, BatchPredictionRequest
from utils import generate_id, parse_meal_type, clean_filename, FriendlyHTTPException
from prediction import MealPredictor
from fastapi import status


def create_meal_record(db: Session, record_data: MealRecordCreate) -> MealRecord:
    """创建单条用餐记录"""
    existing = db.query(MealRecord).filter(
        MealRecord.record_date == record_data.record_date,
        MealRecord.meal_type == record_data.meal_type,
        MealRecord.dish_name == record_data.dish_name
    ).first()

    if existing:
        raise FriendlyHTTPException(
            status_code=status.HTTP_409_CONFLICT,
            error_code="RECORD_EXISTS",
            error_message="Record with same date, meal type and dish name already exists",
            user_friendly_message=f"{record_data.record_date} {record_data.meal_type}的「{record_data.dish_name}」已经存在了，不能重复添加",
            details={"record_date": str(record_data.record_date), "meal_type": record_data.meal_type, "dish_name": record_data.dish_name},
        )

    db_record = MealRecord(**record_data.model_dump())
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record


def update_meal_record(db: Session, record_id: int, update_data: MealRecordUpdate) -> Optional[MealRecord]:
    """更新用餐记录"""
    record = db.query(MealRecord).filter(MealRecord.id == record_id).first()
    if not record:
        raise FriendlyHTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="RECORD_NOT_FOUND",
            error_message=f"Meal record {record_id} not found",
            user_friendly_message="找不到这条记录了，可能已被删除，请刷新页面后重试",
            details={"record_id": record_id},
        )

    update_dict = update_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(record, key, value)

    db.commit()
    db.refresh(record)
    return record


def get_meal_record(db: Session, record_id: int) -> Optional[MealRecord]:
    """获取单条用餐记录"""
    return db.query(MealRecord).filter(MealRecord.id == record_id).first()


def get_meal_records(
    db: Session,
    page: int = 1,
    page_size: int = 20,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    meal_type: Optional[str] = None,
    is_reviewed: Optional[bool] = None,
    is_corrected: Optional[bool] = None,
    keyword: Optional[str] = None,
) -> Tuple[List[MealRecord], int]:
    """查询用餐记录列表，支持分页和筛选"""
    query = db.query(MealRecord)

    if start_date:
        query = query.filter(MealRecord.record_date >= start_date)
    if end_date:
        query = query.filter(MealRecord.record_date <= end_date)
    if meal_type:
        query = query.filter(MealRecord.meal_type == meal_type)
    if is_reviewed is not None:
        query = query.filter(MealRecord.is_reviewed == is_reviewed)
    if is_corrected is not None:
        query = query.filter(MealRecord.is_corrected == is_corrected)
    if keyword:
        query = query.filter(
            or_(
                MealRecord.dish_name.contains(keyword),
                MealRecord.notes.contains(keyword),
                MealRecord.category.contains(keyword),
            )
        )

    total = query.count()
    records = query.order_by(
        MealRecord.record_date.desc(),
        MealRecord.meal_type,
        MealRecord.dish_name
    ).offset((page - 1) * page_size).limit(page_size).all()

    return records, total


def review_records(db: Session, record_ids: List[int], reviewed_by: str) -> int:
    """批量复核记录"""
    if not record_ids:
        raise FriendlyHTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="EMPTY_RECORD_IDS",
            error_message="No record IDs provided for review",
            user_friendly_message="请先选择要复核的记录，再点击复核按钮",
        )

    records = db.query(MealRecord).filter(MealRecord.id.in_(record_ids)).all()
    if not records:
        raise FriendlyHTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="NO_RECORDS_FOUND",
            error_message="None of the specified records were found",
            user_friendly_message="选择的记录都找不到了，可能已被删除，请刷新页面后重试",
            details={"requested_ids": record_ids},
        )

    now = datetime.utcnow()
    updated_count = 0
    for record in records:
        if not record.is_reviewed:
            record.is_reviewed = True
            record.reviewed_by = reviewed_by
            record.reviewed_at = now
            updated_count += 1

    db.commit()
    return updated_count


def correct_record(
    db: Session,
    record_id: int,
    field_name: str,
    new_value: Any,
    reason: str,
    corrected_by: str,
) -> MealRecord:
    """修正单条记录，记录修改日志"""
    record = get_meal_record(db, record_id)
    if not record:
        raise FriendlyHTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="RECORD_NOT_FOUND",
            error_message=f"Meal record {record_id} not found",
            user_friendly_message="找不到这条记录了，可能已被删除，请刷新页面后重试",
            details={"record_id": record_id},
        )

    if record.is_reviewed:
        raise FriendlyHTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="RECORD_ALREADY_REVIEWED",
            error_message="Cannot correct a reviewed record",
            user_friendly_message="这条记录已经复核过了，不能再修改。如果确实需要修改，请先联系管理员取消复核",
            details={"record_id": record_id, "reviewed_by": record.reviewed_by},
        )

    old_value = str(getattr(record, field_name))

    if field_name in ['predicted_count', 'actual_count']:
        try:
            new_value = int(new_value)
            if new_value < 0:
                raise ValueError("Negative value")
        except (ValueError, TypeError):
            raise FriendlyHTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                error_code="INVALID_COUNT_VALUE",
                error_message=f"Invalid value for {field_name}: {new_value}",
                user_friendly_message=f"份数必须是大于等于0的整数，你输入的「{new_value}」不对",
                details={"field": field_name, "invalid_value": new_value},
            )

    if field_name == 'price':
        try:
            new_value = float(new_value)
            if new_value < 0:
                raise ValueError("Negative price")
        except (ValueError, TypeError):
            raise FriendlyHTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                error_code="INVALID_PRICE_VALUE",
                error_message=f"Invalid price value: {new_value}",
                user_friendly_message=f"价格必须是大于等于0的数字，你输入的「{new_value}」不对",
                details={"invalid_value": new_value},
            )

    setattr(record, field_name, new_value)
    record.is_corrected = True
    record.corrected_by = corrected_by
    record.corrected_at = datetime.utcnow()
    record.correction_reason = reason

    log = CorrectionLog(
        record_id=record_id,
        field_name=field_name,
        old_value=old_value,
        new_value=str(new_value),
        reason=reason,
        corrected_by=corrected_by,
    )
    db.add(log)

    db.commit()
    db.refresh(record)
    return record


def import_from_file(db: Session, file_content: bytes, filename: str, imported_by: str) -> Dict:
    """从Excel或CSV文件导入数据"""
    import_id = generate_id("IMP")
    clean_name = clean_filename(filename)

    import_history = ImportHistory(
        import_id=import_id,
        file_name=clean_name,
        file_type=filename.split('.')[-1].lower() if '.' in filename else 'unknown',
        status="processing",
        imported_by=imported_by,
    )
    db.add(import_history)
    db.commit()

    try:
        if filename.lower().endswith('.csv'):
            df = pd.read_csv(io.BytesIO(file_content))
        else:
            df = pd.read_excel(io.BytesIO(file_content))

        column_mapping = {
            '日期': 'record_date', 'date': 'record_date', '用餐日期': 'record_date',
            '餐次': 'meal_type', '时段': 'meal_type', 'meal': 'meal_type',
            '菜品名称': 'dish_name', '菜品': 'dish_name', '菜名': 'dish_name', 'dish': 'dish_name',
            '预测份数': 'predicted_count', '预测': 'predicted_count', '预计': 'predicted_count',
            '实际份数': 'actual_count', '实际': 'actual_count', '实售': 'actual_count',
            '单位': 'unit', 'unit': 'unit',
            '单价': 'price', '价格': 'price', 'price': 'price',
            '分类': 'category', '菜品分类': 'category', 'category': 'category',
            '备注': 'notes', '说明': 'notes', 'note': 'notes',
        }

        df.columns = [str(col).strip() for col in df.columns]
        df = df.rename(columns={k: v for k, v in column_mapping.items() if k in df.columns})

        required_cols = ['record_date', 'meal_type', 'dish_name']
        missing_cols = [c for c in required_cols if c not in df.columns]
        if missing_cols:
            col_names = {v: k for k, v in column_mapping.items()}
            readable_missing = [col_names.get(c, c) for c in missing_cols]
            raise FriendlyHTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                error_code="MISSING_REQUIRED_COLUMNS",
                error_message=f"Missing required columns: {missing_cols}",
                user_friendly_message=f"导入的文件缺少必要的列：{', '.join(readable_missing)}，请检查文件格式后重试",
                details={"missing_columns": missing_cols, "available_columns": list(df.columns)},
            )

        total_rows = len(df)
        success_rows = 0
        failed_rows = 0
        errors = []

        batch_id = generate_id("BATCH")

        for idx, row in df.iterrows():
            try:
                row_num = idx + 2

                record_date = pd.to_datetime(row.get('record_date')).date()

                meal_type = parse_meal_type(str(row.get('meal_type', '')))

                dish_name = str(row.get('dish_name', '')).strip()
                if not dish_name:
                    raise ValueError("菜品名称不能为空")

                predicted_count = int(row.get('predicted_count', 0) or 0)
                actual_count = int(row.get('actual_count', 0) or 0)
                price = float(row.get('price', 0.0) or 0.0)
                unit = str(row.get('unit', '份') or '份').strip()
                category = str(row.get('category', '') or '').strip() or None
                notes = str(row.get('notes', '') or '').strip() or None

                if predicted_count < 0 or actual_count < 0:
                    raise ValueError("份数不能为负数")
                if price < 0:
                    raise ValueError("价格不能为负数")

                existing = db.query(MealRecord).filter(
                    MealRecord.record_date == record_date,
                    MealRecord.meal_type == meal_type,
                    MealRecord.dish_name == dish_name
                ).first()

                if existing:
                    existing.predicted_count = predicted_count
                    existing.actual_count = actual_count
                    existing.price = price
                    existing.unit = unit
                    existing.category = category or existing.category
                    existing.notes = notes or existing.notes
                    existing.batch_id = batch_id
                else:
                    new_record = MealRecord(
                        record_date=record_date,
                        meal_type=meal_type,
                        dish_name=dish_name,
                        predicted_count=predicted_count,
                        actual_count=actual_count,
                        price=price,
                        unit=unit,
                        category=category,
                        notes=notes,
                        batch_id=batch_id,
                    )
                    db.add(new_record)

                success_rows += 1

                if success_rows % 100 == 0:
                    db.commit()

            except Exception as e:
                failed_rows += 1
                errors.append(f"第{row_num}行：{str(e)}")
                if len(errors) > 50:
                    errors.append("... 还有更多错误，只显示前50条")
                    break

        db.commit()

        import_history.total_rows = total_rows
        import_history.success_rows = success_rows
        import_history.failed_rows = failed_rows
        import_history.status = "completed" if failed_rows == 0 else "partial"
        import_history.error_details = "\n".join(errors) if errors else None
        db.commit()

        return {
            "import_id": import_id,
            "file_name": clean_name,
            "total_rows": total_rows,
            "success_rows": success_rows,
            "failed_rows": failed_rows,
            "status": import_history.status,
            "errors": errors[:10],
            "user_message": f"导入完成！共 {total_rows} 行，成功 {success_rows} 行，失败 {failed_rows} 行" + (f"。前几个错误：{'; '.join(errors[:3])}" if errors else ""),
        }

    except Exception as e:
        import_history.status = "failed"
        import_history.error_details = str(e)
        db.commit()
        raise


def batch_predict(db: Session, request: BatchPredictionRequest, created_by: str) -> Dict:
    """批量生成预测"""
    predictor = MealPredictor(db)
    model_info = predictor.get_model_info()

    batch_name = request.batch_name or f"预测_{request.start_date}_至_{request.end_date}"

    batch = PredictionBatch(
        batch_id=generate_id("BATCH"),
        batch_name=batch_name,
        start_date=request.start_date,
        end_date=request.end_date,
        model_version=request.model_version,
        model_description=model_info["model_description"],
        status="processing",
        created_by=created_by,
    )
    db.add(batch)
    db.commit()

    try:
        predictions, added_count, skipped_count, batch_id = predictor.generate_predictions(
            request.start_date,
            request.end_date,
            overwrite_existing=request.overwrite_existing,
        )

        for pred in predictions:
            existing = db.query(MealRecord).filter(
                MealRecord.record_date == pred["record_date"],
                MealRecord.meal_type == pred["meal_type"],
                MealRecord.dish_name == pred["dish_name"]
            ).first()

            if existing:
                existing.predicted_count = pred["predicted_count"]
                existing.category = pred["category"] or existing.category
                existing.price = pred["price"] or existing.price
                existing.batch_id = pred["batch_id"]
            else:
                new_record = MealRecord(**pred)
                db.add(new_record)

        db.commit()

        batch.batch_id = batch_id
        batch.status = "completed"
        batch.total_records = added_count
        batch.completed_at = datetime.utcnow()
        db.commit()

        message_parts = [f"预测生成完成！共新增/更新 {added_count} 条记录"]
        if skipped_count > 0:
            message_parts.append(f"，跳过已复核或已存在的记录 {skipped_count} 条")
        if request.overwrite_existing:
            message_parts.append("（已覆盖旧数据）")

        return {
            "batch_id": batch_id,
            "status": "completed",
            "total_records": added_count,
            "skipped_count": skipped_count,
            "model_version": model_info["model_version"],
            "message": "".join(message_parts),
        }

    except Exception as e:
        batch.status = "failed"
        batch.error_message = str(e)
        db.commit()
        raise


def export_data(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    meal_types: Optional[List[str]] = None,
    categories: Optional[List[str]] = None,
    include_model_info: bool = True,
    format: str = "excel",
) -> Tuple[bytes, str, str]:
    """导出数据，返回(文件内容, 文件名, MIME类型)"""
    query = db.query(MealRecord)

    if start_date:
        query = query.filter(MealRecord.record_date >= start_date)
    if end_date:
        query = query.filter(MealRecord.record_date <= end_date)
    if meal_types:
        query = query.filter(MealRecord.meal_type.in_(meal_types))
    if categories:
        query = query.filter(MealRecord.category.in_(categories))

    records = query.order_by(
        MealRecord.record_date,
        MealRecord.meal_type,
        MealRecord.dish_name
    ).all()

    data = []
    for rec in records:
        data.append({
            "日期": rec.record_date.strftime("%Y-%m-%d"),
            "星期": ["周一", "周二", "周三", "周四", "周五", "周六", "周日"][rec.record_date.weekday()],
            "餐次": rec.meal_type,
            "菜品分类": rec.category or "",
            "菜品名称": rec.dish_name,
            "预测份数": rec.predicted_count,
            "实际份数": rec.actual_count,
            "差异": rec.actual_count - rec.predicted_count if rec.actual_count > 0 else "",
            "单位": rec.unit,
            "单价(元)": rec.price,
            "金额(元)": round(rec.actual_count * rec.price, 2) if rec.actual_count > 0 else "",
            "是否复核": "是" if rec.is_reviewed else "否",
            "复核人": rec.reviewed_by or "",
            "是否修正": "是" if rec.is_corrected else "否",
            "修正原因": rec.correction_reason or "",
            "备注": rec.notes or "",
        })

    df = pd.DataFrame(data)

    if include_model_info:
        predictor = MealPredictor(db)
        model_info = predictor.get_model_info()

        export_metadata = {
            "导出时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "日期范围": f"{start_date or '不限'} 至 {end_date or '不限'}",
            "筛选条件": {
                "餐次": meal_types or "全部",
                "菜品分类": categories or "全部",
            },
            "预测模型版本": model_info["model_version"],
            "数据记录数": len(data),
        }

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    if format == "csv":
        content = df.to_csv(index=False).encode("utf-8-sig")
        filename = f"食堂备餐数据_{timestamp}.csv"
        mime_type = "text/csv"
    else:
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name="备餐数据", index=False)

            if include_model_info:
                meta_df = pd.DataFrame([
                    {"项目": k, "值": str(v)} for k, v in export_metadata.items()
                ])
                meta_df.to_excel(writer, sheet_name="导出说明", index=False)

                from openpyxl import load_workbook
                from openpyxl.worksheet.page import PageMargins

        output.seek(0)
        content = output.getvalue()
        filename = f"食堂备餐数据_{timestamp}.xlsx"
        mime_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    return content, filename, mime_type


def get_prediction_history(db: Session, page: int = 1, page_size: int = 20) -> Tuple[List[PredictionBatch], int]:
    """获取预测批处理历史"""
    query = db.query(PredictionBatch).order_by(PredictionBatch.created_at.desc())
    total = query.count()
    batches = query.offset((page - 1) * page_size).limit(page_size).all()
    return batches, total


def get_import_history(db: Session, page: int = 1, page_size: int = 20) -> Tuple[List[ImportHistory], int]:
    """获取导入历史"""
    query = db.query(ImportHistory).order_by(ImportHistory.imported_at.desc())
    total = query.count()
    history = query.offset((page - 1) * page_size).limit(page_size).all()
    return history, total


def get_correction_logs(db: Session, record_id: Optional[int] = None, page: int = 1, page_size: int = 50) -> Tuple[List[CorrectionLog], int]:
    """获取修正日志"""
    query = db.query(CorrectionLog)
    if record_id:
        query = query.filter(CorrectionLog.record_id == record_id)
    query = query.order_by(CorrectionLog.corrected_at.desc())
    total = query.count()
    logs = query.offset((page - 1) * page_size).limit(page_size).all()
    return logs, total


def get_model_info(db: Session) -> Dict:
    """获取模型说明信息"""
    predictor = MealPredictor(db)
    return predictor.get_model_info()


def init_default_configs(db: Session):
    """初始化系统默认配置"""
    defaults = [
        ("default_operator", "系统管理员", "默认操作人姓名"),
        ("max_batch_days", "365", "单次批量处理最大天数"),
        ("export_include_model", "true", "导出时是否包含模型说明"),
        ("prediction_model_version", "v1.0", "当前使用的预测模型版本"),
    ]

    for key, value, desc in defaults:
        existing = db.query(SystemConfig).filter(SystemConfig.config_key == key).first()
        if not existing:
            config = SystemConfig(config_key=key, config_value=value, description=desc)
            db.add(config)

    db.commit()
