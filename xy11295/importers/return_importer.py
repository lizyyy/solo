import pandas as pd
from sqlalchemy.orm import Session
import schemas, crud, models
from datetime import datetime
import json


def import_returns_from_csv(db: Session, file_path: str, file_name: str):
    success_count = 0
    failed_count = 0
    errors = []
    
    try:
        df = pd.read_csv(file_path, dtype=str)
    except Exception as e:
        error_log = schemas.ImportErrorLogCreate(
            import_type="return",
            file_name=file_name,
            row_number=None,
            original_data=f"文件读取失败: {file_path}",
            error_message=f"CSV文件读取错误: {str(e)}",
            suggestion="请检查文件格式是否正确，确保是UTF-8编码的CSV文件"
        )
        db_error = crud.create_import_error_log(db, error_log)
        errors.append(schemas.ImportErrorLog.model_validate(db_error))
        return success_count, failed_count + 1, errors
    
    required_columns = ['order_no', 'quantity', 'return_time', 'receiver']
    missing_columns = [col for col in required_columns if col not in df.columns]
    
    if missing_columns:
        error_log = schemas.ImportErrorLogCreate(
            import_type="return",
            file_name=file_name,
            row_number=None,
            original_data=f"表头: {list(df.columns)}",
            error_message=f"缺少必需的列: {', '.join(missing_columns)}",
            suggestion=f"请确保CSV文件包含以下列: {', '.join(required_columns)}"
        )
        db_error = crud.create_import_error_log(db, error_log)
        errors.append(schemas.ImportErrorLog.model_validate(db_error))
        return success_count, failed_count + 1, errors
    
    for idx, row in df.iterrows():
        row_num = idx + 2
        original_data = json.dumps(row.to_dict(), ensure_ascii=False)
        
        try:
            order_no = str(row['order_no']).strip()
            quantity = int(str(row['quantity']).strip())
            receiver = str(row['receiver']).strip()
            
            if not order_no:
                raise ValueError("调拨单号不能为空")
            if quantity <= 0:
                raise ValueError("数量必须大于0")
            if not receiver:
                raise ValueError("接收人不能为空")
            
            return_time_str = str(row['return_time']).strip()
            try:
                if 'T' in return_time_str:
                    return_time = datetime.fromisoformat(return_time_str.replace('Z', '+00:00'))
                else:
                    return_time = datetime.strptime(return_time_str, '%Y-%m-%d %H:%M:%S')
            except ValueError:
                raise ValueError(f"时间格式错误: {return_time_str}，请使用 YYYY-MM-DD HH:MM:SS 格式")
            
            exception_type = str(row.get('exception_type', '')).strip() or "无异常"
            valid_exceptions = [e.value for e in models.ExceptionType]
            if exception_type not in valid_exceptions:
                raise ValueError(f"异常类型必须是: {', '.join(valid_exceptions)}")
            
            return_data = schemas.ReturnRecordCreate(
                order_no=order_no,
                quantity=quantity,
                return_time=return_time,
                receiver=receiver,
                condition=str(row.get('condition', '')).strip() or None,
                exception_type=exception_type,
                exception_note=str(row.get('exception_note', '')).strip() or None,
                remark=str(row.get('remark', '')).strip() or None
            )
            
            crud.create_return_record(db, return_data)
            success_count += 1
            
        except Exception as e:
            failed_count += 1
            suggestion = ""
            if "调拨单号" in str(e) and "不存在" in str(e):
                suggestion = "请检查调拨单号是否正确，或先创建调拨单"
            elif "数量超过" in str(e):
                suggestion = "请检查归还数量，不能超过调拨总数量减去已归还数量"
            elif "时间格式" in str(e):
                suggestion = "请使用标准时间格式: YYYY-MM-DD HH:MM:SS"
            elif "异常类型" in str(e):
                suggestion = "请从下拉列表中选择正确的异常类型"
            
            error_log = schemas.ImportErrorLogCreate(
                import_type="return",
                file_name=file_name,
                row_number=row_num,
                original_data=original_data,
                error_message=str(e),
                suggestion=suggestion or "请检查数据格式是否正确"
            )
            db_error = crud.create_import_error_log(db, error_log)
            errors.append(schemas.ImportErrorLog.model_validate(db_error))
    
    return success_count, failed_count, errors
