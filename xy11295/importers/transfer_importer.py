import yaml
from sqlalchemy.orm import Session
import schemas, crud, models
from datetime import datetime
import json


def json_serial(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")


def import_transfers_from_yaml(db: Session, file_path: str, file_name: str):
    success_count = 0
    failed_count = 0
    errors = []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
    except Exception as e:
        error_log = schemas.ImportErrorLogCreate(
            import_type="transfer",
            file_name=file_name,
            row_number=None,
            original_data=f"文件读取失败: {file_path}",
            error_message=f"YAML文件读取错误: {str(e)}",
            suggestion="请检查YAML文件格式是否正确，确保是UTF-8编码"
        )
        db_error = crud.create_import_error_log(db, error_log)
        errors.append(schemas.ImportErrorLog.model_validate(db_error))
        return success_count, failed_count + 1, errors
    
    if not isinstance(data, list):
        error_log = schemas.ImportErrorLogCreate(
            import_type="transfer",
            file_name=file_name,
            row_number=None,
            original_data=str(data)[:500],
            error_message="YAML文件根节点必须是数组格式",
            suggestion="请确保YAML文件以-开头的数组格式存储调拨单数据"
        )
        db_error = crud.create_import_error_log(db, error_log)
        errors.append(schemas.ImportErrorLog.model_validate(db_error))
        return success_count, failed_count + 1, errors
    
    for idx, item in enumerate(data):
        row_num = idx + 1
        original_data = json.dumps(item, ensure_ascii=False, default=json_serial)
        
        try:
            required_fields = ['order_no', 'material_code', 'booth_code', 'quantity', 
                              'borrower', 'operator', 'transfer_time']
            missing_fields = [field for field in required_fields if field not in item or item[field] is None]
            
            if missing_fields:
                raise ValueError(f"缺少必需字段: {', '.join(missing_fields)}")
            
            order_no = str(item['order_no']).strip()
            material_code = str(item['material_code']).strip()
            booth_code = str(item['booth_code']).strip()
            quantity = int(item['quantity'])
            borrower = str(item['borrower']).strip()
            operator = str(item['operator']).strip()
            
            if not order_no:
                raise ValueError("调拨单号不能为空")
            if quantity <= 0:
                raise ValueError("数量必须大于0")
            
            existing = crud.get_transfer_order_by_no(db, order_no)
            if existing:
                raise ValueError(f"调拨单号 {order_no} 已存在")
            
            transfer_time_str = str(item['transfer_time']).strip()
            try:
                if 'T' in transfer_time_str:
                    transfer_time = datetime.fromisoformat(transfer_time_str.replace('Z', '+00:00'))
                else:
                    transfer_time = datetime.strptime(transfer_time_str, '%Y-%m-%d %H:%M:%S')
            except ValueError:
                raise ValueError(f"时间格式错误: {transfer_time_str}，请使用 YYYY-MM-DD HH:MM:SS 格式")
            
            expected_return_time = None
            if item.get('expected_return_time'):
                exp_time_str = str(item['expected_return_time']).strip()
                try:
                    if 'T' in exp_time_str:
                        expected_return_time = datetime.fromisoformat(exp_time_str.replace('Z', '+00:00'))
                    else:
                        expected_return_time = datetime.strptime(exp_time_str, '%Y-%m-%d %H:%M:%S')
                except ValueError:
                    raise ValueError(f"预计归还时间格式错误: {exp_time_str}")
            
            material = crud.get_material_by_code(db, material_code)
            if not material:
                raise ValueError(f"物料编码 {material_code} 不存在，请先导入物料数据")
            
            booth = crud.get_booth_by_code(db, booth_code)
            if not booth:
                raise ValueError(f"展位编码 {booth_code} 不存在，请先创建展位数据")
            
            if material.available_quantity < quantity:
                raise ValueError(f"物料 {material.name} 库存不足，可用数量: {material.available_quantity}")
            
            transfer_data = schemas.TransferOrderCreate(
                order_no=order_no,
                material_code=material_code,
                booth_code=booth_code,
                quantity=quantity,
                borrower=borrower,
                operator=operator,
                transfer_time=transfer_time,
                expected_return_time=expected_return_time,
                remark=str(item.get('remark', '')).strip() or None
            )
            
            crud.create_transfer_order(db, transfer_data)
            success_count += 1
            
        except Exception as e:
            failed_count += 1
            suggestion = ""
            if "调拨单号" in str(e) and "已存在" in str(e):
                suggestion = "请修改调拨单号为唯一值"
            elif "物料编码" in str(e) and "不存在" in str(e):
                suggestion = "请先在物料表中导入该物料，或检查物料编码是否正确"
            elif "展位编码" in str(e) and "不存在" in str(e):
                suggestion = "请先创建该展位信息"
            elif "库存不足" in str(e):
                suggestion = "请检查物料库存或减少调拨数量"
            elif "时间格式" in str(e):
                suggestion = "请使用标准时间格式: YYYY-MM-DD HH:MM:SS"
            
            error_log = schemas.ImportErrorLogCreate(
                import_type="transfer",
                file_name=file_name,
                row_number=row_num,
                original_data=original_data,
                error_message=str(e),
                suggestion=suggestion or "请检查数据格式是否正确"
            )
            db_error = crud.create_import_error_log(db, error_log)
            errors.append(schemas.ImportErrorLog.model_validate(db_error))
    
    return success_count, failed_count, errors


def import_booths_from_yaml(db: Session, file_path: str, file_name: str):
    success_count = 0
    failed_count = 0
    errors = []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
    except Exception as e:
        error_log = schemas.ImportErrorLogCreate(
            import_type="booth",
            file_name=file_name,
            row_number=None,
            original_data=f"文件读取失败: {file_path}",
            error_message=f"YAML文件读取错误: {str(e)}",
            suggestion="请检查YAML文件格式是否正确"
        )
        db_error = crud.create_import_error_log(db, error_log)
        errors.append(schemas.ImportErrorLog.model_validate(db_error))
        return success_count, failed_count + 1, errors
    
    if not isinstance(data, list):
        error_log = schemas.ImportErrorLogCreate(
            import_type="booth",
            file_name=file_name,
            row_number=None,
            original_data=str(data)[:500],
            error_message="YAML文件根节点必须是数组格式",
            suggestion="请确保YAML文件以-开头的数组格式存储展位数据"
        )
        db_error = crud.create_import_error_log(db, error_log)
        errors.append(schemas.ImportErrorLog.model_validate(db_error))
        return success_count, failed_count + 1, errors
    
    for idx, item in enumerate(data):
        row_num = idx + 1
        original_data = json.dumps(item, ensure_ascii=False, default=json_serial)
        
        try:
            required_fields = ['booth_code', 'name', 'manager']
            missing_fields = [field for field in required_fields if field not in item or item[field] is None]
            
            if missing_fields:
                raise ValueError(f"缺少必需字段: {', '.join(missing_fields)}")
            
            booth_code = str(item['booth_code']).strip()
            name = str(item['name']).strip()
            manager = str(item['manager']).strip()
            
            if not booth_code:
                raise ValueError("展位编码不能为空")
            if not name:
                raise ValueError("展位名称不能为空")
            if not manager:
                raise ValueError("负责人不能为空")
            
            existing = crud.get_booth_by_code(db, booth_code)
            if existing:
                raise ValueError(f"展位编码 {booth_code} 已存在")
            
            booth_data = schemas.BoothCreate(
                booth_code=booth_code,
                name=name,
                manager=manager,
                contact=str(item.get('contact', '')).strip() or None
            )
            
            crud.create_booth(db, booth_data)
            success_count += 1
            
        except Exception as e:
            failed_count += 1
            suggestion = ""
            if "展位编码" in str(e) and "已存在" in str(e):
                suggestion = "请修改展位编码为唯一值"
            
            error_log = schemas.ImportErrorLogCreate(
                import_type="booth",
                file_name=file_name,
                row_number=row_num,
                original_data=original_data,
                error_message=str(e),
                suggestion=suggestion or "请检查数据格式是否正确"
            )
            db_error = crud.create_import_error_log(db, error_log)
            errors.append(schemas.ImportErrorLog.model_validate(db_error))
    
    return success_count, failed_count, errors
