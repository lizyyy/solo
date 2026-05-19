import csv
import json
from datetime import datetime
from typing import List, Tuple
from sqlalchemy.orm import Session
from database import QualityRecord, PaperBatch, ReworkRecord, ImportErrorLog
import schemas


def calculate_delta_e(l1: float, a1: float, b1: float, l2: float, a2: float, b2: float) -> float:
    return ((l1 - l2)**2 + (a1 - a2)**2 + (b1 - b2)**2) ** 0.5


def parse_date(date_str: str) -> datetime:
    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d",
        "%m/%d/%Y %H:%M:%S",
        "%m/%d/%Y",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            continue
    raise ValueError(f"无法解析日期格式: {date_str}")


def import_lab_csv(db: Session, file_path: str, filename: str) -> Tuple[int, int, List[ImportErrorLog]]:
    success_count = 0
    error_count = 0
    errors = []
    
    required_columns = ['batch_id', 'lab_l', 'lab_a', 'lab_b']
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            if not reader.fieldnames:
                error = ImportErrorLog(
                    import_type='lab_csv',
                    source_file=filename,
                    row_number=0,
                    original_data='',
                    error_message='CSV文件为空或没有表头',
                    suggestion='请检查CSV文件格式，确保包含表头行存在'
                )
                db.add(error)
                db.commit()
                errors.append(error)
                return 0, 1, errors
            
            missing_cols = [col for col in required_columns if col not in reader.fieldnames]
            if missing_cols:
                error = ImportErrorLog(
                    import_type='lab_csv',
                    source_file=filename,
                    row_number=0,
                    original_data=','.join(reader.fieldnames) if reader.fieldnames else '',
                    error_message=f'缺少必要列: {", ".join(missing_cols)}',
                    suggestion=f'请确保CSV包含以下列: {", ".join(required_columns)}'
                )
                db.add(error)
                db.commit()
                errors.append(error)
                return 0, 1, errors
            
            for row_num, row in enumerate(reader, start=1):
                try:
                    original_data = json.dumps(row, ensure_ascii=False)
                    
                    batch_id = row.get('batch_id', '').strip()
                    if not batch_id:
                        raise ValueError('batch_id不能为空')
                    
                    try:
                        lab_l = float(row.get('lab_l', ''))
                        lab_a = float(row.get('lab_a', ''))
                        lab_b = float(row.get('lab_b', ''))
                    except ValueError as e:
                            raise ValueError(f'Lab数值格式错误: {str(e)}')
                    
                    standard_l = row.get('standard_l')
                    standard_a = row.get('standard_a')
                    standard_b = row.get('standard_b')
                    
                    if standard_l and standard_a and standard_b:
                        try:
                            standard_l = float(standard_l)
                            standard_a = float(standard_a)
                            standard_b = float(standard_b)
                            delta_e = calculate_delta_e(lab_l, lab_a, lab_b, standard_l, standard_a, standard_b)
                        except ValueError:
                            delta_e = None
                    else:
                        delta_e = None
                    
                    is_qualified = True
                    if delta_e is not None:
                        is_qualified = delta_e <= 2.0
                    
                    inspection_time = row.get('inspection_time')
                    if inspection_time:
                        try:
                            inspection_time = parse_date(inspection_time)
                        except ValueError:
                            inspection_time = datetime.utcnow()
                    else:
                        inspection_time = datetime.utcnow()
                    
                    record = QualityRecord(
                        batch_id=batch_id,
                        order_number=row.get('order_number', '').strip() or None,
                        sample_point=row.get('sample_point', '').strip() or None,
                        lab_l=lab_l,
                        lab_a=lab_a,
                        lab_b=lab_b,
                        standard_l=standard_l,
                        standard_a=standard_a,
                        standard_b=standard_b,
                        delta_e=delta_e,
                        is_qualified=is_qualified,
                        inspector=row.get('inspector', '').strip() or None,
                        inspection_time=inspection_time,
                        notes=row.get('notes', '').strip() or None
                    )
                    
                    paper_batch_num = row.get('paper_batch', '').strip()
                    if paper_batch_num:
                        paper_batch = db.query(PaperBatch).filter(PaperBatch.batch_number == paper_batch_num).first()
                        if paper_batch:
                            record.paper_batch_id = paper_batch.id
                    
                    db.add(record)
                    success_count += 1
                    
                except Exception as e:
                    error_count += 1
                    error_msg = str(e)
                    suggestion = ''
                    
                    if 'batch_id不能为空' in error_msg:
                        suggestion = '请填写batch_id字段'
                    elif 'Lab数值格式错误' in error_msg:
                        suggestion = '确保lab_l, lab_a, lab_b必须是有效的数字'
                    elif 'date' in error_msg.lower():
                        suggestion = '检查日期格式，推荐使用: YYYY-MM-DD HH:MM:SS'
                    else:
                        suggestion = '检查该行数据格式是否正确'
                    
                    error = ImportErrorLog(
                        import_type='lab_csv',
                        source_file=filename,
                        row_number=row_num,
                        original_data=original_data if 'original_data' in locals() else json.dumps(row, ensure_ascii=False),
                        error_message=error_msg,
                        suggestion=suggestion
                    )
                    db.add(error)
                    errors.append(error)
            
            db.commit()
            
    except Exception as e:
        error = ImportErrorLog(
            import_type='lab_csv',
            source_file=filename,
            row_number=0,
            original_data='',
            error_message=f'读取文件失败: {str(e)}',
            suggestion='请检查文件是否存在、编码是否为UTF-8、格式是否正确'
        )
        db.add(error)
        db.commit()
        errors.append(error)
        error_count += 1
    
    return success_count, error_count, errors


def import_order_json(db: Session, file_path: str, filename: str) -> Tuple[int, int, List[ImportErrorLog]]:
    success_count = 0
    error_count = 0
    errors = []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if not isinstance(data, list):
            data = [data]
        
        for row_num, item in enumerate(data, start=1):
            try:
                original_data = json.dumps(item, ensure_ascii=False)
                
                batch_id = item.get('batch_id', '').strip()
                if not batch_id:
                    raise ValueError('batch_id不能为空')
                
                existing = db.query(QualityRecord).filter(QualityRecord.batch_id == batch_id).first()
                
                if existing:
                    existing.order_number = item.get('order_number', existing.order_number)
                    existing.notes = item.get('notes', existing.notes)
                    if item.get('inspector'):
                        existing.inspector = item.get('inspector')
                    if item.get('inspection_time'):
                        try:
                            existing.inspection_time = parse_date(item.get('inspection_time'))
                        except ValueError:
                            pass
                    success_count += 1
                else:
                    try:
                        lab_l = float(item.get('lab_l', 0))
                        lab_a = float(item.get('lab_a', 0))
                        lab_b = float(item.get('lab_b', 0))
                    except ValueError:
                        lab_l = lab_a = lab_b = 0
                    
                    record = QualityRecord(
                        batch_id=batch_id,
                        order_number=item.get('order_number', ''),
                        lab_l=lab_l,
                        lab_a=lab_a,
                        lab_b=lab_b,
                        inspector=item.get('inspector'),
                        notes=item.get('notes', '')
                    )
                    
                    if item.get('inspection_time'):
                        try:
                            record.inspection_time = parse_date(item.get('inspection_time'))
                        except ValueError:
                            pass
                    
                    db.add(record)
                    success_count += 1
                    
            except Exception as e:
                error_count += 1
                error = ImportErrorLog(
                    import_type='order_json',
                    source_file=filename,
                    row_number=row_num,
                    original_data=original_data if 'original_data' in locals() else json.dumps(item, ensure_ascii=False),
                    error_message=str(e),
                    suggestion='检查JSON数据结构是否正确'
                )
                db.add(error)
                errors.append(error)
        
        db.commit()
        
    except json.JSONDecodeError as e:
        error = ImportErrorLog(
            import_type='order_json',
            source_file=filename,
            row_number=0,
            original_data='',
            error_message=f'JSON解析错误: {str(e)}',
            suggestion='请检查JSON格式是否正确'
        )
        db.add(error)
        db.commit()
        errors.append(error)
        error_count += 1
    except Exception as e:
        error = ImportErrorLog(
            import_type='order_json',
            source_file=filename,
            row_number=0,
            original_data='',
            error_message=f'读取文件失败: {str(e)}',
            suggestion='请检查文件是否存在、编码是否为UTF-8'
        )
        db.add(error)
        db.commit()
        errors.append(error)
        error_count += 1
    
    return success_count, error_count, errors


def import_rework_notes(db: Session, file_path: str, filename: str) -> Tuple[int, int, List[ImportErrorLog]]:
    success_count = 0
    error_count = 0
    errors = []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            if filename.endswith('.json'):
                data = json.load(f)
                if not isinstance(data, list):
                    data = [data]
            else:
                data = []
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            data.append(json.loads(line))
                        except json.JSONDecodeError:
                            pass
        
        for row_num, item in enumerate(data, start=1):
            try:
                original_data = json.dumps(item, ensure_ascii=False)
                
                quality_record_id = item.get('quality_record_id')
                batch_id = item.get('batch_id', '').strip()
                
                if not quality_record_id and not batch_id:
                    raise ValueError('必须提供quality_record_id或batch_id')
                
                if not quality_record_id and batch_id:
                    record = db.query(QualityRecord).filter(QualityRecord.batch_id == batch_id).first()
                    if record:
                        quality_record_id = record.id
                    else:
                        raise ValueError(f'找不到batch_id={batch_id}的品控记录不存在')
                
                if not quality_record_id:
                    raise ValueError('无法找到对应的品控记录')
                
                rework_reason = item.get('rework_reason', '').strip()
                if not rework_reason:
                    raise ValueError('rework_reason不能为空')
                
                rework_record = ReworkRecord(
                    quality_record_id=quality_record_id,
                    rework_reason=rework_reason,
                    rework_type=item.get('rework_type', '').strip() or None,
                    rework_operator=item.get('rework_operator', '').strip() or None,
                    before_status=item.get('before_status', '').strip() or None,
                    after_status=item.get('after_status', '').strip() or None,
                    is_successful=item.get('is_successful', True),
                    notes=item.get('notes', '').strip() or None
                )
                
                if item.get('rework_time'):
                    try:
                        rework_record.rework_time = parse_date(item.get('rework_time'))
                    except ValueError:
                        pass
                
                db.add(rework_record)
                success_count += 1
                
            except Exception as e:
                error_count += 1
                error_msg = str(e)
                suggestion = ''
                
                if '找不到' in error_msg:
                    suggestion = '请先导入对应的品控记录'
                elif '不能为空' in error_msg:
                    suggestion = '填写必填字段'
                else:
                    suggestion = '检查数据格式是否正确'
                
                error = ImportErrorLog(
                    import_type='rework_notes',
                    source_file=filename,
                    row_number=row_num,
                    original_data=original_data if 'original_data' in locals() else json.dumps(item, ensure_ascii=False),
                    error_message=error_msg,
                    suggestion=suggestion
                )
                db.add(error)
                errors.append(error)
        
        db.commit()
        
    except Exception as e:
        error = ImportErrorLog(
            import_type='rework_notes',
            source_file=filename,
            row_number=0,
            original_data='',
            error_message=f'读取文件失败: {str(e)}',
            suggestion='请检查文件格式是否正确'
        )
        db.add(error)
        db.commit()
        errors.append(error)
        error_count += 1
    
    return success_count, error_count, errors
