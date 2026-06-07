import pandas as pd
import hashlib
import os
from datetime import datetime
from typing import Tuple, List, Dict
from models import (
    store, GridInspection, ConstructionNotice, 
    ImportRecord
)
from config import RAW_DATA_DIR

COLUMN_MAPPINGS = {
    'inspection': {
        'normal': {
            '网格员姓名': 'inspector_name',
            '巡查日期': 'inspection_date',
            '巡查地点': 'location',
            '经度': 'lng',
            '纬度': 'lat',
            '道路状况': 'road_condition',
            '是否通行': 'passable',
            '障碍物': 'obstacle',
            '巡查时间': 'inspection_time',
            '备注': 'remarks'
        },
        'alternate': {
            '姓名': 'inspector_name',
            '日期': 'inspection_date',
            '地点': 'location',
            'lng': 'lng',
            'lat': 'lat',
            '路况': 'road_condition',
            '通行': 'passable',
            '障碍': 'obstacle',
            '时间': 'inspection_time',
            '备注说明': 'remarks'
        }
    },
    'notice': {
        'normal': {
            '告示编号': 'notice_no',
            '工程名称': 'project_name',
            '施工单位': 'construction_unit',
            '施工地点': 'location',
            '经度': 'lng',
            '纬度': 'lat',
            '开始日期': 'start_date',
            '结束日期': 'end_date',
            '施工类型': 'construction_type',
            '是否封路': 'road_closure',
            '影响范围': 'affected_area',
            '备注': 'remarks'
        },
        'alternate': {
            '编号': 'notice_no',
            '项目名': 'project_name',
            '单位': 'construction_unit',
            '地点': 'location',
            'lng': 'lng',
            'lat': 'lat',
            '开工': 'start_date',
            '完工': 'end_date',
            '类型': 'construction_type',
            '封路': 'road_closure',
            '影响': 'affected_area',
            '备注说明': 'remarks'
        }
    }
}

def calculate_file_hash(file_path: str) -> str:
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()

def detect_column_mapping(df: pd.DataFrame, data_type: str) -> Tuple[Dict, str]:
    columns = set(df.columns.str.strip())
    for mapping_type, mapping in COLUMN_MAPPINGS[data_type].items():
        source_cols = set(mapping.keys())
        if len(columns.intersection(source_cols)) >= len(source_cols) * 0.5:
            return mapping, mapping_type
    return COLUMN_MAPPINGS[data_type]['normal'], 'unknown'

def is_duplicate_inspection(inspection: GridInspection) -> bool:
    for existing in store.inspections:
        if (existing.inspector_name == inspection.inspector_name and
            existing.inspection_date == inspection.inspection_date and
            existing.location == inspection.location and
            existing.inspection_time == inspection.inspection_time):
            return True
    return False

def is_duplicate_notice(notice: ConstructionNotice) -> bool:
    for existing in store.notices:
        if existing.notice_no == notice.notice_no and existing.notice_no:
            return True
        if (existing.project_name == notice.project_name and
            existing.location == notice.location and
            existing.start_date == notice.start_date):
            return True
    return False

def parse_bool(value) -> bool:
    if isinstance(value, bool):
        return value
    if pd.isna(value):
        return False
    val = str(value).strip().lower()
    return val in ['是', 'true', '1', 'yes', '有', '封路', '通行']

def import_inspections(file_path: str, import_type: str = 'normal', 
                       operator: str = '') -> ImportRecord:
    file_name = os.path.basename(file_path)
    file_hash = calculate_file_hash(file_path)
    
    for record in store.import_records:
        if record.file_hash == file_hash and record.data_type == 'inspection':
            return ImportRecord(
                file_name=file_name,
                file_hash=file_hash,
                data_type='inspection',
                import_type=import_type,
                record_count=0,
                success_count=0,
                duplicate_count=0,
                operator=operator,
                status='skipped',
                message=f'文件已导入过，导入记录ID: {record.id}'
            )
    
    df = pd.read_excel(file_path) if file_path.endswith('.xlsx') else pd.read_csv(file_path)
    mapping, mapping_type = detect_column_mapping(df, 'inspection')
    
    record_count = len(df)
    success_count = 0
    duplicate_count = 0
    
    for _, row in df.iterrows():
        inspection = GridInspection()
        inspection.source_file = file_name
        inspection.data_type = import_type
        
        for src_col, dst_col in mapping.items():
            if src_col in df.columns:
                value = row[src_col]
                if pd.notna(value):
                    if dst_col == 'passable':
                        setattr(inspection, dst_col, parse_bool(value))
                    elif dst_col in ['lng', 'lat']:
                        setattr(inspection, dst_col, float(value) if pd.notna(value) else 0.0)
                    else:
                        setattr(inspection, dst_col, str(value).strip())
        
        if is_duplicate_inspection(inspection):
            duplicate_count += 1
            continue
        
        store.inspections.append(inspection)
        success_count += 1
    
    import_record = ImportRecord(
        file_name=file_name,
        file_hash=file_hash,
        data_type='inspection',
        import_type=import_type,
        record_count=record_count,
        success_count=success_count,
        duplicate_count=duplicate_count,
        operator=operator,
        status='completed',
        message=f'列口径: {mapping_type}'
    )
    
    store.import_records.append(import_record)
    store.save()
    
    return import_record

def import_notices(file_path: str, import_type: str = 'normal',
                   operator: str = '') -> ImportRecord:
    file_name = os.path.basename(file_path)
    file_hash = calculate_file_hash(file_path)
    
    for record in store.import_records:
        if record.file_hash == file_hash and record.data_type == 'notice':
            return ImportRecord(
                file_name=file_name,
                file_hash=file_hash,
                data_type='notice',
                import_type=import_type,
                record_count=0,
                success_count=0,
                duplicate_count=0,
                operator=operator,
                status='skipped',
                message=f'文件已导入过，导入记录ID: {record.id}'
            )
    
    df = pd.read_excel(file_path) if file_path.endswith('.xlsx') else pd.read_csv(file_path)
    mapping, mapping_type = detect_column_mapping(df, 'notice')
    
    record_count = len(df)
    success_count = 0
    duplicate_count = 0
    
    for _, row in df.iterrows():
        notice = ConstructionNotice()
        notice.source_file = file_name
        
        for src_col, dst_col in mapping.items():
            if src_col in df.columns:
                value = row[src_col]
                if pd.notna(value):
                    if dst_col == 'road_closure':
                        setattr(notice, dst_col, parse_bool(value))
                    elif dst_col in ['lng', 'lat']:
                        setattr(notice, dst_col, float(value) if pd.notna(value) else 0.0)
                    else:
                        setattr(notice, dst_col, str(value).strip())
        
        if is_duplicate_notice(notice):
            duplicate_count += 1
            continue
        
        store.notices.append(notice)
        success_count += 1
    
    import_record = ImportRecord(
        file_name=file_name,
        file_hash=file_hash,
        data_type='notice',
        import_type=import_type,
        record_count=record_count,
        success_count=success_count,
        duplicate_count=duplicate_count,
        operator=operator,
        status='completed',
        message=f'列口径: {mapping_type}'
    )
    
    store.import_records.append(import_record)
    store.save()
    
    return import_record

def get_import_history() -> List[Dict]:
    return [r.to_dict() for r in reversed(store.import_records)]
