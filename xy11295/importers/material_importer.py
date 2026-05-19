import pandas as pd
from sqlalchemy.orm import Session
import schemas, crud, models
import json


def import_materials_from_csv(db: Session, file_path: str, file_name: str):
    success_count = 0
    failed_count = 0
    errors = []
    
    try:
        df = pd.read_csv(file_path, dtype=str)
    except Exception as e:
        error_log = schemas.ImportErrorLogCreate(
            import_type="material",
            file_name=file_name,
            row_number=None,
            original_data=f"文件读取失败: {file_path}",
            error_message=f"CSV文件读取错误: {str(e)}",
            suggestion="请检查文件格式是否正确，确保是UTF-8编码的CSV文件"
        )
        db_error = crud.create_import_error_log(db, error_log)
        errors.append(schemas.ImportErrorLog.model_validate(db_error))
        return success_count, failed_count + 1, errors
    
    required_columns = ['material_code', 'name', 'type', 'total_quantity', 'available_quantity']
    missing_columns = [col for col in required_columns if col not in df.columns]
    
    if missing_columns:
        error_log = schemas.ImportErrorLogCreate(
            import_type="material",
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
            material_code = str(row['material_code']).strip()
            name = str(row['name']).strip()
            material_type = str(row['type']).strip()
            total_quantity = int(str(row['total_quantity']).strip())
            available_quantity = int(str(row['available_quantity']).strip())
            
            if not material_code:
                raise ValueError("物料编码不能为空")
            if not name:
                raise ValueError("物料名称不能为空")
            
            valid_types = [e.value for e in models.MaterialType]
            if material_type not in valid_types:
                raise ValueError(f"物料类型必须是: {', '.join(valid_types)}")
            
            if available_quantity > total_quantity:
                raise ValueError("可用数量不能大于总数量")
            
            existing = crud.get_material_by_code(db, material_code)
            if existing:
                raise ValueError(f"物料编码 {material_code} 已存在")
            
            material_data = schemas.MaterialCreate(
                material_code=material_code,
                name=name,
                type=material_type,
                specification=str(row.get('specification', '')).strip() or None,
                unit=str(row.get('unit', '件')).strip() or '件',
                total_quantity=total_quantity,
                available_quantity=available_quantity,
                location=str(row.get('location', '')).strip() or None,
                description=str(row.get('description', '')).strip() or None
            )
            
            crud.create_material(db, material_data)
            success_count += 1
            
        except Exception as e:
            failed_count += 1
            suggestion = ""
            if "物料编码" in str(e) and "已存在" in str(e):
                suggestion = "请修改物料编码为唯一值"
            elif "物料类型" in str(e):
                suggestion = "请从下拉列表中选择正确的物料类型"
            elif "数量" in str(e):
                suggestion = "请检查数量是否为正整数，且可用数量不超过总数量"
            
            error_log = schemas.ImportErrorLogCreate(
                import_type="material",
                file_name=file_name,
                row_number=row_num,
                original_data=original_data,
                error_message=str(e),
                suggestion=suggestion or "请检查数据格式是否正确"
            )
            db_error = crud.create_import_error_log(db, error_log)
            errors.append(schemas.ImportErrorLog.model_validate(db_error))
    
    return success_count, failed_count, errors
