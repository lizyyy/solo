import csv
import json
import os
from datetime import datetime, date
from typing import List, Dict, Any, Optional, Tuple
from models import (
    db, Tank, WaterQualityRecord, FeedingRecord, 
    WaterChangeRecord, FishRecord, Observation
)
from config import Config

def parse_date(date_str: str) -> Optional[date]:
    if not date_str:
        return None
    formats = ['%Y-%m-%d', '%Y/%m/%d', '%m-%d-%Y', '%m/%d/%Y']
    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt).date()
        except (ValueError, AttributeError):
            continue
    return None

def parse_time(time_str: str) -> Optional[datetime.time]:
    if not time_str:
        return None
    formats = ['%H:%M', '%H:%M:%S', '%I:%M %p', '%I:%M:%S %p']
    for fmt in formats:
        try:
            return datetime.strptime(time_str.strip(), fmt).time()
        except (ValueError, AttributeError):
            continue
    return None

def parse_float(value: str) -> Optional[float]:
    if value is None or value == '':
        return None
    try:
        return float(value.strip())
    except (ValueError, AttributeError):
        return None

def parse_int(value: str) -> Optional[int]:
    if value is None or value == '':
        return None
    try:
        return int(value.strip())
    except (ValueError, AttributeError):
        return None

def get_or_create_tank(tank_code: str, tank_name: str = None) -> Tuple[Tank, bool]:
    tank = Tank.query.filter_by(tank_code=tank_code.strip()).first()
    if not tank:
        tank = Tank(tank_code=tank_code.strip(), tank_name=tank_name or tank_code.strip())
        db.session.add(tank)
        db.session.flush()
        return tank, True
    return tank, False

def import_water_quality_csv(file_path: str) -> Dict[str, Any]:
    results = {
        'success': False,
        'total_records': 0,
        'imported_records': 0,
        'tanks_created': 0,
        'errors': [],
        'warnings': []
    }
    
    try:
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            
            for row_num, row in enumerate(reader, start=2):
                results['total_records'] += 1
                
                tank_code = row.get('tank_code') or row.get('展缸编号') or row.get('缸号')
                if not tank_code or not tank_code.strip():
                    results['errors'].append(f'第{row_num}行：展缸编号为空')
                    continue
                
                record_date_str = row.get('date') or row.get('日期') or row.get('record_date')
                record_date = parse_date(record_date_str)
                if not record_date:
                    results['errors'].append(f'第{row_num}行：日期格式无效 ({record_date_str})')
                    continue
                
                try:
                    tank, created = get_or_create_tank(tank_code)
                    if created:
                        results['tanks_created'] += 1
                    
                    existing = WaterQualityRecord.query.filter_by(
                        tank_id=tank.id,
                        record_date=record_date
                    ).first()
                    
                    if existing:
                        results['warnings'].append(f'第{row_num}行：展缸{tank_code}在{record_date}已有水质记录，跳过')
                        continue
                    
                    record = WaterQualityRecord(
                        tank_id=tank.id,
                        record_date=record_date,
                        record_time=parse_time(row.get('time') or row.get('时间')),
                        temp=parse_float(row.get('temp') or row.get('水温') or row.get('温度')),
                        salinity=parse_float(row.get('salinity') or row.get('盐度')),
                        ph=parse_float(row.get('ph') or row.get('pH') or row.get('PH')),
                        ammonia=parse_float(row.get('ammonia') or row.get('氨氮')),
                        notes=row.get('notes') or row.get('备注')
                    )
                    
                    db.session.add(record)
                    results['imported_records'] += 1
                    
                except Exception as e:
                    results['errors'].append(f'第{row_num}行：{str(e)}')
                    continue
            
            db.session.commit()
            results['success'] = True
            
    except Exception as e:
        db.session.rollback()
        results['errors'].append(f'文件读取错误：{str(e)}')
    
    return results

def import_feeding_json(file_path: str) -> Dict[str, Any]:
    results = {
        'success': False,
        'total_records': 0,
        'imported_records': 0,
        'tanks_created': 0,
        'errors': [],
        'warnings': []
    }
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        records = data.get('records', []) if isinstance(data, dict) else data
        if not isinstance(records, list):
            records = [data]
        
        for idx, item in enumerate(records):
            row_num = idx + 1
            results['total_records'] += 1
            
            tank_code = item.get('tank_code') or item.get('展缸编号')
            if not tank_code or not tank_code.strip():
                results['errors'].append(f'第{row_num}条记录：展缸编号为空')
                continue
            
            record_date_str = item.get('date') or item.get('日期') or item.get('record_date')
            record_date = parse_date(record_date_str)
            if not record_date:
                results['errors'].append(f'第{row_num}条记录：日期格式无效 ({record_date_str})')
                continue
            
            try:
                tank, created = get_or_create_tank(tank_code)
                if created:
                    results['tanks_created'] += 1
                
                existing = FeedingRecord.query.filter_by(
                    tank_id=tank.id,
                    record_date=record_date
                ).first()
                
                if existing:
                    results['warnings'].append(f'第{row_num}条：展缸{tank_code}在{record_date}已有投喂记录，跳过')
                    continue
                
                record = FeedingRecord(
                    tank_id=tank.id,
                    record_date=record_date,
                    record_time=parse_time(item.get('time') or item.get('时间')),
                    feed_type=item.get('feed_type') or item.get('饲料类型'),
                    feed_amount_g=parse_float(str(item.get('feed_amount_g') or item.get('投喂量', 0))),
                    feeder_name=item.get('feeder_name') or item.get('投喂人'),
                    notes=item.get('notes') or item.get('备注')
                )
                
                db.session.add(record)
                results['imported_records'] += 1
                
            except Exception as e:
                results['errors'].append(f'第{row_num}条记录：{str(e)}')
                continue
        
        db.session.commit()
        results['success'] = True
        
    except Exception as e:
        db.session.rollback()
        results['errors'].append(f'文件读取错误：{str(e)}')
    
    return results

def import_water_change_plan(file_path: str) -> Dict[str, Any]:
    results = {
        'success': False,
        'total_records': 0,
        'imported_records': 0,
        'tanks_created': 0,
        'errors': [],
        'warnings': []
    }
    
    try:
        if file_path.endswith('.json'):
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            records = data.get('records', []) if isinstance(data, dict) else data
            if not isinstance(records, list):
                records = [data]
            
            for idx, item in enumerate(records):
                row_num = idx + 1
                results['total_records'] += 1
                
                tank_code = item.get('tank_code') or item.get('展缸编号')
                if not tank_code or not tank_code.strip():
                    results['errors'].append(f'第{row_num}条记录：展缸编号为空')
                    continue
                
                change_date_str = item.get('change_date') or item.get('换水日期') or item.get('date')
                change_date = parse_date(change_date_str)
                if not change_date:
                    results['errors'].append(f'第{row_num}条记录：日期格式无效 ({change_date_str})')
                    continue
                
                try:
                    tank, created = get_or_create_tank(tank_code)
                    if created:
                        results['tanks_created'] += 1
                    
                    record = WaterChangeRecord(
                        tank_id=tank.id,
                        change_date=change_date,
                        change_percent=parse_float(str(item.get('change_percent') or item.get('换水比例', 0))),
                        change_volume_liters=parse_float(str(item.get('change_volume_liters') or item.get('换水量', 0))),
                        new_salinity=parse_float(str(item.get('new_salinity') or item.get('新盐度'))),
                        new_temp=parse_float(str(item.get('new_temp') or item.get('新温度'))),
                        next_scheduled_date=parse_date(item.get('next_scheduled_date') or item.get('下次换水日期')),
                        notes=item.get('notes') or item.get('备注')
                    )
                    
                    db.session.add(record)
                    results['imported_records'] += 1
                    
                except Exception as e:
                    results['errors'].append(f'第{row_num}条记录：{str(e)}')
                    continue
        
        else:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                
                for row_num, row in enumerate(reader, start=2):
                    results['total_records'] += 1
                    
                    tank_code = row.get('tank_code') or row.get('展缸编号') or row.get('缸号')
                    if not tank_code or not tank_code.strip():
                        results['errors'].append(f'第{row_num}行：展缸编号为空')
                        continue
                    
                    change_date_str = row.get('change_date') or row.get('换水日期') or row.get('date')
                    change_date = parse_date(change_date_str)
                    if not change_date:
                        results['errors'].append(f'第{row_num}行：日期格式无效 ({change_date_str})')
                        continue
                    
                    try:
                        tank, created = get_or_create_tank(tank_code)
                        if created:
                            results['tanks_created'] += 1
                        
                        record = WaterChangeRecord(
                            tank_id=tank.id,
                            change_date=change_date,
                            change_percent=parse_float(row.get('change_percent') or row.get('换水比例')),
                            change_volume_liters=parse_float(row.get('change_volume_liters') or row.get('换水量')),
                            new_salinity=parse_float(row.get('new_salinity') or row.get('新盐度')),
                            new_temp=parse_float(row.get('new_temp') or row.get('新温度')),
                            next_scheduled_date=parse_date(row.get('next_scheduled_date') or row.get('下次换水日期')),
                            notes=row.get('notes') or row.get('备注')
                        )
                        
                        db.session.add(record)
                        results['imported_records'] += 1
                        
                    except Exception as e:
                        results['errors'].append(f'第{row_num}行：{str(e)}')
                        continue
        
        db.session.commit()
        results['success'] = True
        
    except Exception as e:
        db.session.rollback()
        results['errors'].append(f'文件读取错误：{str(e)}')
    
    return results

def import_observations(file_path: str) -> Dict[str, Any]:
    results = {
        'success': False,
        'total_records': 0,
        'imported_records': 0,
        'tanks_created': 0,
        'errors': [],
        'warnings': []
    }
    
    try:
        if file_path.endswith('.json'):
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            records = data.get('records', []) if isinstance(data, dict) else data
            if not isinstance(records, list):
                records = [data]
            
            for idx, item in enumerate(records):
                row_num = idx + 1
                results['total_records'] += 1
                
                tank_code = item.get('tank_code') or item.get('展缸编号')
                if not tank_code or not tank_code.strip():
                    results['errors'].append(f'第{row_num}条记录：展缸编号为空')
                    continue
                
                obs_date_str = item.get('observation_date') or item.get('观察日期') or item.get('date')
                obs_date = parse_date(obs_date_str)
                if not obs_date:
                    results['errors'].append(f'第{row_num}条记录：日期格式无效 ({obs_date_str})')
                    continue
                
                description = item.get('description') or item.get('描述') or item.get('内容')
                if not description:
                    results['errors'].append(f'第{row_num}条记录：观察描述为空')
                    continue
                
                try:
                    tank, created = get_or_create_tank(tank_code)
                    if created:
                        results['tanks_created'] += 1
                    
                    observation = Observation(
                        tank_id=tank.id,
                        observation_date=obs_date,
                        observation_time=parse_time(item.get('time') or item.get('观察时间')),
                        observer_name=item.get('observer_name') or item.get('观察人'),
                        observation_type=item.get('observation_type') or item.get('类型', '异常'),
                        description=description,
                        severity=item.get('severity') or item.get('严重程度', 'warning')
                    )
                    
                    db.session.add(observation)
                    results['imported_records'] += 1
                    
                except Exception as e:
                    results['errors'].append(f'第{row_num}条记录：{str(e)}')
                    continue
        
        else:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                
                for row_num, row in enumerate(reader, start=2):
                    results['total_records'] += 1
                    
                    tank_code = row.get('tank_code') or row.get('展缸编号') or row.get('缸号')
                    if not tank_code or not tank_code.strip():
                        results['errors'].append(f'第{row_num}行：展缸编号为空')
                        continue
                    
                    obs_date_str = row.get('observation_date') or row.get('观察日期') or row.get('date')
                    obs_date = parse_date(obs_date_str)
                    if not obs_date:
                        results['errors'].append(f'第{row_num}行：日期格式无效 ({obs_date_str})')
                        continue
                    
                    description = row.get('description') or row.get('描述') or row.get('内容')
                    if not description:
                        results['errors'].append(f'第{row_num}行：观察描述为空')
                        continue
                    
                    try:
                        tank, created = get_or_create_tank(tank_code)
                        if created:
                            results['tanks_created'] += 1
                        
                        observation = Observation(
                            tank_id=tank.id,
                            observation_date=obs_date,
                            observation_time=parse_time(row.get('time') or row.get('观察时间')),
                            observer_name=row.get('observer_name') or row.get('观察人'),
                            observation_type=row.get('observation_type') or row.get('类型', '异常'),
                            description=description,
                            severity=row.get('severity') or row.get('严重程度', 'warning')
                        )
                        
                        db.session.add(observation)
                        results['imported_records'] += 1
                        
                    except Exception as e:
                        results['errors'].append(f'第{row_num}行：{str(e)}')
                        continue
        
        db.session.commit()
        results['success'] = True
        
    except Exception as e:
        db.session.rollback()
        results['errors'].append(f'文件读取错误：{str(e)}')
    
    return results

def import_fish_records(file_path: str) -> Dict[str, Any]:
    results = {
        'success': False,
        'total_records': 0,
        'imported_records': 0,
        'tanks_created': 0,
        'errors': [],
        'warnings': []
    }
    
    try:
        if file_path.endswith('.json'):
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            records = data.get('records', []) if isinstance(data, dict) else data
            if not isinstance(records, list):
                records = [data]
            
            for idx, item in enumerate(records):
                row_num = idx + 1
                results['total_records'] += 1
                
                tank_code = item.get('tank_code') or item.get('展缸编号')
                if not tank_code or not tank_code.strip():
                    results['errors'].append(f'第{row_num}条记录：展缸编号为空')
                    continue
                
                species = item.get('fish_species') or item.get('鱼种') or item.get('品种')
                if not species:
                    results['errors'].append(f'第{row_num}条记录：鱼种为空')
                    continue
                
                intro_date_str = item.get('introduction_date') or item.get('入缸日期') or item.get('日期')
                intro_date = parse_date(intro_date_str)
                if not intro_date:
                    results['errors'].append(f'第{row_num}条记录：日期格式无效 ({intro_date_str})')
                    continue
                
                try:
                    tank, created = get_or_create_tank(tank_code)
                    if created:
                        results['tanks_created'] += 1
                    
                    is_quarantined = item.get('is_quarantined')
                    if is_quarantined is None:
                        is_quarantined = item.get('是否隔离', True)
                    if isinstance(is_quarantined, str):
                        is_quarantined = is_quarantined.lower() in ('true', '是', 'yes', '1')
                    
                    quarantine_end_date = parse_date(item.get('quarantine_end_date') or item.get('隔离结束日期'))
                    if not quarantine_end_date and is_quarantined:
                        from datetime import timedelta
                        quarantine_end_date = intro_date + timedelta(days=Config.ISOLATION_DAYS_REQUIRED)
                    
                    fish = FishRecord(
                        tank_id=tank.id,
                        fish_species=species,
                        fish_name=item.get('fish_name') or item.get('名称'),
                        quantity=parse_int(str(item.get('quantity') or item.get('数量', 1))),
                        introduction_date=intro_date,
                        is_quarantined=is_quarantined,
                        quarantine_end_date=quarantine_end_date,
                        notes=item.get('notes') or item.get('备注')
                    )
                    
                    db.session.add(fish)
                    results['imported_records'] += 1
                    
                except Exception as e:
                    results['errors'].append(f'第{row_num}条记录：{str(e)}')
                    continue
        
        db.session.commit()
        results['success'] = True
        
    except Exception as e:
        db.session.rollback()
        results['errors'].append(f'文件读取错误：{str(e)}')
    
    return results
