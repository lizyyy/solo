import csv
import yaml
import json
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from io import StringIO, TextIOWrapper
import models, schemas, crud
from datetime import datetime


def get_type_display(type_str: str) -> str:
    type_map = {
        "桁架": "TRUSS",
        "灯具": "LIGHT",
        "屏幕": "SCREEN",
        "其他": "OTHER",
        "TRUSS": "桁架",
        "LIGHT": "灯具",
        "SCREEN": "屏幕",
        "OTHER": "其他"
    }
    return type_map.get(type_str, type_str)


def parse_material_type(type_str: str) -> models.MaterialType:
    if not type_str:
        raise ValueError("物料类型不能为空")
    
    type_str = type_str.strip().upper()
    type_map = {
        "桁架": models.MaterialType.TRUSS,
        "TRUSS": models.MaterialType.TRUSS,
        "灯具": models.MaterialType.LIGHT,
        "LIGHT": models.MaterialType.LIGHT,
        "屏幕": models.MaterialType.SCREEN,
        "SCREEN": models.MaterialType.SCREEN,
        "其他": models.MaterialType.OTHER,
        "OTHER": models.MaterialType.OTHER
    }
    
    if type_str not in type_map:
        raise ValueError(f"无效的物料类型: {type_str}，有效类型为：桁架、灯具、屏幕、其他")
    
    return type_map[type_str]


def validate_material_row(row: Dict[str, str], row_num: int) -> Tuple[bool, Dict[str, Any], str]:
    errors = []
    
    required_fields = ['material_code', 'name', 'type', 'quantity_total', 'quantity_available']
    for field in required_fields:
        if field not in row or not str(row.get(field, '')).strip():
            errors.append(f"缺少必填字段: {field}")
    
    if errors:
        return False, {}, "; ".join(errors)
    
    material_data = {
        'material_code': str(row['material_code']).strip(),
        'name': str(row['name']).strip(),
        'specification': str(row.get('specification', '')).strip() or None,
        'unit': str(row.get('unit', '件')).strip(),
        'location': str(row.get('location', '')).strip() or None,
        'remark': str(row.get('remark', '')).strip() or None
    }
    
    try:
        material_data['type'] = parse_material_type(row['type'])
    except ValueError as e:
        errors.append(str(e))
    
    try:
        material_data['quantity_total'] = int(str(row['quantity_total']).strip())
        if material_data['quantity_total'] < 0:
            errors.append("总数量不能为负数")
    except ValueError:
        errors.append("quantity_total 必须是整数")
    
    try:
        material_data['quantity_available'] = int(str(row['quantity_available']).strip())
        if material_data['quantity_available'] < 0:
            errors.append("可用数量不能为负数")
    except ValueError:
        errors.append("quantity_available 必须是整数")
    
    if 'quantity_available' in material_data and 'quantity_total' in material_data:
        if material_data['quantity_available'] > material_data['quantity_total']:
            errors.append("可用数量不能大于总数量")
    
    if errors:
        return False, {}, "; ".join(errors)
    
    return True, material_data, ""


def get_import_suggestion(error_msg: str) -> str:
    if "缺少必填字段" in error_msg:
        return "请检查CSV文件的表头，确保包含所有必填字段：material_code, name, type, quantity_total, quantity_available"
    elif "无效的物料类型" in error_msg:
        return "请将物料类型修改为：桁架、灯具、屏幕 或 其他"
    elif "必须是整数" in error_msg:
        return "请确保数量字段填写有效的整数"
    elif "不能为负数" in error_msg:
        return "请将数量修改为非负数"
    elif "不能大于总数量" in error_msg:
        return "请调整可用数量，使其小于或等于总数量"
    else:
        return "请检查数据格式是否正确"


def import_materials_from_csv(db: Session, file_content: str, batch_id: str = None) -> schemas.ImportResult:
    if not batch_id:
        batch_id = f"CSV_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    success_count = 0
    error_count = 0
    errors = []
    
    try:
        csv_file = StringIO(file_content)
        reader = csv.DictReader(csv_file)
        
        for row_num, row in enumerate(reader, start=2):
            is_valid, material_data, error_msg = validate_material_row(row, row_num)
            
            if not is_valid:
                error_record = schemas.ImportErrorRecordCreate(
                    import_batch=batch_id,
                    source_type=models.RecordSource.CSV,
                    row_number=row_num,
                    original_data=json.dumps(row, ensure_ascii=False),
                    error_message=error_msg,
                    suggestion=get_import_suggestion(error_msg)
                )
                db_error = crud.create_import_error(db, error_record)
                errors.append(db_error)
                error_count += 1
                continue
            
            existing_material = crud.get_material_by_code(db, material_data['material_code'])
            if existing_material:
                error_msg = f"物料编码 {material_data['material_code']} 已存在"
                error_record = schemas.ImportErrorRecordCreate(
                    import_batch=batch_id,
                    source_type=models.RecordSource.CSV,
                    row_number=row_num,
                    original_data=json.dumps(row, ensure_ascii=False),
                    error_message=error_msg,
                    suggestion="请修改物料编码为唯一值，或使用更新接口"
                )
                db_error = crud.create_import_error(db, error_record)
                errors.append(db_error)
                error_count += 1
                continue
            
            try:
                material_create = schemas.MaterialCreate(**material_data)
                crud.create_material(db, material_create)
                success_count += 1
            except Exception as e:
                error_msg = f"创建物料失败: {str(e)}"
                error_record = schemas.ImportErrorRecordCreate(
                    import_batch=batch_id,
                    source_type=models.RecordSource.CSV,
                    row_number=row_num,
                    original_data=json.dumps(row, ensure_ascii=False),
                    error_message=error_msg,
                    suggestion="请检查数据是否符合要求，或联系技术支持"
                )
                db_error = crud.create_import_error(db, error_record)
                errors.append(db_error)
                error_count += 1
    
    except Exception as e:
        error_msg = f"解析CSV文件失败: {str(e)}"
        error_record = schemas.ImportErrorRecordCreate(
            import_batch=batch_id,
            source_type=models.RecordSource.CSV,
            row_number=None,
            original_data=file_content[:1000],
            error_message=error_msg,
            suggestion="请检查CSV文件格式是否正确，确保使用逗号分隔"
        )
        db_error = crud.create_import_error(db, error_record)
        errors.append(db_error)
        error_count += 1
    
    return schemas.ImportResult(
        success_count=success_count,
        error_count=error_count,
        batch_id=batch_id,
        errors=errors
    )


def validate_transfer_item(item: Dict[str, Any], item_num: int) -> Tuple[bool, Dict[str, Any], str]:
    errors = []
    
    if 'material_code' not in item:
        errors.append(f"第 {item_num} 个物料缺少 material_code 字段")
    
    if 'quantity' not in item:
        errors.append(f"第 {item_num} 个物料缺少 quantity 字段")
    else:
        try:
            quantity = int(item['quantity'])
            if quantity <= 0:
                errors.append(f"第 {item_num} 个物料数量必须大于0")
        except ValueError:
            errors.append(f"第 {item_num} 个物料数量必须是整数")
    
    if errors:
        return False, {}, "; ".join(errors)
    
    item_data = {
        'material_code': str(item['material_code']).strip(),
        'quantity': int(item['quantity'])
    }
    
    return True, item_data, ""


def validate_transfer_order_data(data: Dict[str, Any]) -> Tuple[bool, Dict[str, Any], str]:
    errors = []
    
    if 'order_code' not in data or not str(data['order_code']).strip():
        errors.append("缺少必填字段: order_code")
    
    if 'items' not in data or not isinstance(data['items'], list) or len(data['items']) == 0:
        errors.append("调拨单必须包含至少一个物料")
    
    if errors:
        return False, {}, "; ".join(errors)
    
    order_data = {
        'order_code': str(data['order_code']).strip(),
        'source_location': str(data.get('source_location', '')).strip() or None,
        'target_location': str(data.get('target_location', '')).strip() or None,
        'operator': str(data.get('operator', '')).strip() or None,
        'approver': str(data.get('approver', '')).strip() or None,
        'remark': str(data.get('remark', '')).strip() or None,
        'items': []
    }
    
    for i, item in enumerate(data['items'], start=1):
        is_valid, item_data, error_msg = validate_transfer_item(item, i)
        if not is_valid:
            errors.append(error_msg)
        else:
            order_data['items'].append(item_data)
    
    if errors:
        return False, {}, "; ".join(errors)
    
    return True, order_data, ""


def import_transfer_order_from_yaml(db: Session, yaml_content: str, batch_id: str = None) -> schemas.ImportResult:
    if not batch_id:
        batch_id = f"YAML_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    success_count = 0
    error_count = 0
    errors = []
    
    try:
        data = yaml.safe_load(yaml_content)
        
        if isinstance(data, list):
            orders = data
        else:
            orders = [data]
        
        for order_num, order_data in enumerate(orders, start=1):
            is_valid, validated_data, error_msg = validate_transfer_order_data(order_data)
            
            if not is_valid:
                error_record = schemas.ImportErrorRecordCreate(
                    import_batch=batch_id,
                    source_type=models.RecordSource.YAML,
                    row_number=order_num,
                    original_data=yaml.safe_dump(order_data, allow_unicode=True),
                    error_message=error_msg,
                    suggestion="请检查YAML格式，确保包含所有必填字段"
                )
                db_error = crud.create_import_error(db, error_record)
                errors.append(db_error)
                error_count += 1
                continue
            
            existing_order = crud.get_transfer_order_by_code(db, validated_data['order_code'])
            if existing_order:
                error_msg = f"调拨单号 {validated_data['order_code']} 已存在"
                error_record = schemas.ImportErrorRecordCreate(
                    import_batch=batch_id,
                    source_type=models.RecordSource.YAML,
                    row_number=order_num,
                    original_data=yaml.safe_dump(order_data, allow_unicode=True),
                    error_message=error_msg,
                    suggestion="请修改调拨单号为唯一值"
                )
                db_error = crud.create_import_error(db, error_record)
                errors.append(db_error)
                error_count += 1
                continue
            
            try:
                items_with_id = []
                for item in validated_data['items']:
                    material = crud.get_material_by_code(db, item['material_code'])
                    if not material:
                        raise ValueError(f"物料编码 {item['material_code']} 不存在")
                    items_with_id.append({
                        'material_id': material.id,
                        'quantity': item['quantity']
                    })
                
                validated_data['items'] = items_with_id
                order_create = schemas.TransferOrderCreate(**validated_data)
                crud.create_transfer_order(db, order_create)
                success_count += 1
                
            except Exception as e:
                error_msg = f"创建调拨单失败: {str(e)}"
                error_record = schemas.ImportErrorRecordCreate(
                    import_batch=batch_id,
                    source_type=models.RecordSource.YAML,
                    row_number=order_num,
                    original_data=yaml.safe_dump(order_data, allow_unicode=True),
                    error_message=error_msg,
                    suggestion="请检查物料编码是否存在，或联系技术支持"
                )
                db_error = crud.create_import_error(db, error_record)
                errors.append(db_error)
                error_count += 1
    
    except yaml.YAMLError as e:
        error_msg = f"解析YAML文件失败: {str(e)}"
        error_record = schemas.ImportErrorRecordCreate(
            import_batch=batch_id,
            source_type=models.RecordSource.YAML,
            row_number=None,
            original_data=yaml_content[:1000],
            error_message=error_msg,
            suggestion="请检查YAML格式是否正确，缩进使用2个空格"
        )
        db_error = crud.create_import_error(db, error_record)
        errors.append(db_error)
        error_count += 1
    
    except Exception as e:
        error_msg = f"导入失败: {str(e)}"
        error_record = schemas.ImportErrorRecordCreate(
            import_batch=batch_id,
            source_type=models.RecordSource.YAML,
            row_number=None,
            original_data=yaml_content[:1000],
            error_message=error_msg,
            suggestion="请检查YAML文件格式是否正确"
        )
        db_error = crud.create_import_error(db, error_record)
        errors.append(db_error)
        error_count += 1
    
    return schemas.ImportResult(
        success_count=success_count,
        error_count=error_count,
        batch_id=batch_id,
        errors=errors
    )


def import_return_records_from_csv(db: Session, file_content: str, batch_id: str = None) -> schemas.ImportResult:
    if not batch_id:
        batch_id = f"RET_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    success_count = 0
    error_count = 0
    errors = []
    
    try:
        csv_file = StringIO(file_content)
        reader = csv.DictReader(csv_file)
        
        for row_num, row in enumerate(reader, start=2):
            try:
                required_fields = ['allocation_code', 'quantity_returned']
                for field in required_fields:
                    if field not in row or not str(row.get(field, '')).strip():
                        raise ValueError(f"缺少必填字段: {field}")
                
                allocation_code = str(row['allocation_code']).strip()
                quantity_returned = int(str(row['quantity_returned']).strip())
                quantity_damaged = int(str(row.get('quantity_damaged', '0')).strip())
                operator = str(row.get('operator', '')).strip() or None
                remark = str(row.get('remark', '')).strip() or None
                
                if quantity_returned <= 0:
                    raise ValueError("归还数量必须大于0")
                
                if quantity_damaged < 0:
                    raise ValueError("损坏数量不能为负数")
                
                if quantity_damaged > quantity_returned:
                    raise ValueError("损坏数量不能大于归还数量")
                
                allocation = crud.get_allocation_by_code(db, allocation_code)
                if not allocation:
                    raise ValueError(f"调拨记录 {allocation_code} 不存在")
                
                crud.return_allocation(
                    db, allocation.id, quantity_returned, 
                    quantity_damaged, operator, remark
                )
                success_count += 1
                
            except Exception as e:
                error_msg = str(e)
                error_record = schemas.ImportErrorRecordCreate(
                    import_batch=batch_id,
                    source_type=models.RecordSource.CSV,
                    row_number=row_num,
                    original_data=json.dumps(row, ensure_ascii=False),
                    error_message=error_msg,
                    suggestion="请检查调拨记录编码是否存在，数量是否正确"
                )
                db_error = crud.create_import_error(db, error_record)
                errors.append(db_error)
                error_count += 1
    
    except Exception as e:
        error_msg = f"解析CSV文件失败: {str(e)}"
        error_record = schemas.ImportErrorRecordCreate(
            import_batch=batch_id,
            source_type=models.RecordSource.CSV,
            row_number=None,
            original_data=file_content[:1000],
            error_message=error_msg,
            suggestion="请检查CSV文件格式是否正确"
        )
        db_error = crud.create_import_error(db, error_record)
        errors.append(db_error)
        error_count += 1
    
    return schemas.ImportResult(
        success_count=success_count,
        error_count=error_count,
        batch_id=batch_id,
        errors=errors
    )
