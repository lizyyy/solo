#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
import命令 - 导入数据文件
"""

import csv
import json
from pathlib import Path
from datetime import date, datetime
from typing import Optional, List, Dict, Any

from core.storage import DataStore
from core.models import (
    BOM, BOMPart, PickPlaceData, PickPlaceItem, 
    OvenProfile, OvenProfilePoint, SolderPasteBatch,
    StencilBatch, AOI_Report, AOI_Defect, ReworkRecord,
    ProductionBatch, generate_id
)


def parse_date(date_str: str) -> date:
    formats = [
        '%Y-%m-%d',
        '%Y/%m/%d',
        '%d-%m-%Y',
        '%d/%m/%Y',
        '%Y%m%d',
    ]
    
    date_str = date_str.strip()
    
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).date()
        except ValueError:
            continue
    
    raise ValueError(f"无法解析日期: {date_str}")


def parse_datetime(datetime_str: str) -> datetime:
    formats = [
        '%Y-%m-%d %H:%M:%S',
        '%Y-%m-%d %H:%M',
        '%Y/%m/%d %H:%M:%S',
        '%Y/%m/%d %H:%M',
        '%Y-%m-%dT%H:%M:%S',
        '%Y-%m-%dT%H:%M:%SZ',
        '%Y-%m-%dT%H:%M',
    ]
    
    datetime_str = datetime_str.strip()
    
    for fmt in formats:
        try:
            return datetime.strptime(datetime_str, fmt)
        except ValueError:
            continue
    
    try:
        d = parse_date(datetime_str)
        return datetime.combine(d, datetime.min.time())
    except ValueError:
        pass
    
    raise ValueError(f"无法解析日期时间: {datetime_str}")


def parse_float(value_str: str, default: float = 0.0) -> float:
    if not value_str or not value_str.strip():
        return default
    value_str = value_str.strip()
    try:
        return float(value_str.replace(',', ''))
    except ValueError:
        return default


def parse_int(value_str: str, default: int = 0) -> int:
    if not value_str or not value_str.strip():
        return default
    value_str = value_str.strip()
    try:
        return int(value_str.replace(',', ''))
    except ValueError:
        return default


def detect_file_type(file_path: Path) -> Optional[str]:
    ext = file_path.suffix.lower()
    
    if ext == '.json':
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if isinstance(data, dict):
                if 'solder_pastes' in data or 'stencils' in data:
                    return 'paste_stencil'
                if 'solder_paste_type' in data or 'lot_number' in data:
                    return 'paste_stencil'
                if 'profile_id' in data or 'name' in data and 'points' in data:
                    return 'oven_profile'
                if 'aoi_id' in data or 'defects' in data:
                    return 'aoi'
                if 'bom_id' in data or 'parts' in data:
                    return 'bom'
                if 'pick_place_id' in data or 'items' in data:
                    return 'pick_place'
            elif isinstance(data, list) and len(data) > 0:
                first = data[0]
                if 'reference' in first and ('part_number' in first or 'description' in first):
                    return 'bom'
                if 'reference' in first and 'x' in first and 'y' in first:
                    return 'pick_place'
                if 'time' in first and 'temperature' in first:
                    return 'oven_profile'
        except:
            pass
    
    if ext == '.csv':
        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                headers = reader.fieldnames or []
                
                header_str = ','.join(headers).lower()
                
                if ('reference' in header_str or '位号' in header_str) and \
                   ('part_number' in header_str or '料号' in header_str or '型号' in header_str) and \
                   ('description' in header_str or '描述' in header_str or '名称' in header_str):
                    if 'x' not in header_str and 'y' not in header_str and '温度' not in header_str:
                        return 'bom'
                
                if ('reference' in header_str or '位号' in header_str) and \
                   ('x' in header_str or 'x坐标' in header_str) and \
                   ('y' in header_str or 'y坐标' in header_str):
                    if '温度' not in header_str and '时间' not in header_str:
                        return 'pick_place'
                
                if ('temperature' in header_str or '温度' in header_str or 'temp' in header_str) and \
                   ('time' in header_str or '时间' in header_str):
                    return 'oven_profile'
                
                if ('reference' in header_str or '位号' in header_str) and \
                   ('defect' in header_str or '缺陷' in header_str or '错误' in header_str):
                    return 'aoi'
                
                if ('lot_number' in header_str or '批次号' in header_str) and \
                   ('solder' in header_str or '锡膏' in header_str):
                    return 'paste_stencil'
        except:
            pass
    
    return None


def import_bom(file_path: Path, store: DataStore) -> Dict[str, Any]:
    parts = []
    board_number = ""
    board_revision = ""
    description = ""
    
    if file_path.suffix.lower() == '.json':
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if isinstance(data, dict):
            board_number = data.get('board_number', data.get('board_id', ""))
            board_revision = data.get('board_revision', data.get('revision', ""))
            description = data.get('description', "")
            parts_data = data.get('parts', data.get('items', []))
        else:
            parts_data = data
        
        for part_data in parts_data:
            part = BOMPart(
                reference=part_data.get('reference', part_data.get('ref', part_data.get('位号', ""))),
                part_number=part_data.get('part_number', part_data.get('part', part_data.get('料号', ""))),
                description=part_data.get('description', part_data.get('desc', part_data.get('描述', ""))),
                quantity=parse_int(part_data.get('quantity', part_data.get('qty', part_data.get('数量', '1')))),
                package=part_data.get('package', part_data.get('封装', part_data.get('footprint', ""))),
                manufacturer=part_data.get('manufacturer', part_data.get('mfr', part_data.get('制造商', ""))),
                supplier=part_data.get('supplier', part_data.get('供应商', "")),
                supplier_part_number=part_data.get('supplier_part_number', part_data.get('供应商料号', "")),
                value=part_data.get('value', part_data.get('值', "")),
                tolerance=part_data.get('tolerance', part_data.get('公差', "")),
                voltage=part_data.get('voltage', part_data.get('电压', "")),
                power=part_data.get('power', part_data.get('功率', "")),
                notes=part_data.get('notes', part_data.get('备注', ""))
            )
            if part.reference:
                parts.append(part)
    
    else:
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                reference = row.get('reference') or row.get('ref') or row.get('位号') or row.get('Ref') or ""
                if not reference:
                    continue
                
                part = BOMPart(
                    reference=reference,
                    part_number=row.get('part_number') or row.get('part') or row.get('料号') or row.get('Part Number') or row.get('PN') or "",
                    description=row.get('description') or row.get('desc') or row.get('描述') or row.get('Description') or row.get('名称') or "",
                    quantity=parse_int(row.get('quantity') or row.get('qty') or row.get('数量') or row.get('Qty') or '1'),
                    package=row.get('package') or row.get('封装') or row.get('footprint') or row.get('Footprint') or "",
                    manufacturer=row.get('manufacturer') or row.get('mfr') or row.get('制造商') or "",
                    supplier=row.get('supplier') or row.get('供应商') or "",
                    supplier_part_number=row.get('supplier_part_number') or row.get('供应商料号') or "",
                    value=row.get('value') or row.get('值') or row.get('Value') or "",
                    tolerance=row.get('tolerance') or row.get('公差') or "",
                    voltage=row.get('voltage') or row.get('电压') or "",
                    power=row.get('power') or row.get('功率') or "",
                    notes=row.get('notes') or row.get('备注') or ""
                )
                parts.append(part)
    
    if not board_number:
        board_number = f"BOARD_{datetime.now().strftime('%Y%m%d')}"
    
    bom_id = generate_id("BOM")
    
    bom = BOM(
        bom_id=bom_id,
        board_number=board_number,
        board_revision=board_revision,
        description=description or f"导入自 {file_path.name}",
        parts=parts
    )
    
    existing = store.get_bom_by_board(board_number, board_revision)
    if existing:
        print(f"  警告: 已存在板号 {board_number} (版本 {board_revision}) 的BOM")
        print(f"  现有BOM ID: {existing.bom_id}")
        print(f"  本次导入将创建新的BOM记录")
    
    store.save_bom(bom)
    
    return {
        "bom_id": bom_id,
        "board_number": board_number,
        "board_revision": board_revision,
        "parts_count": len(parts)
    }


def import_pick_place(file_path: Path, store: DataStore) -> Dict[str, Any]:
    items = []
    board_number = ""
    board_revision = ""
    machine = ""
    program = ""
    
    if file_path.suffix.lower() == '.json':
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if isinstance(data, dict):
            board_number = data.get('board_number', data.get('board_id', ""))
            board_revision = data.get('board_revision', data.get('revision', ""))
            machine = data.get('machine', data.get('机器', ""))
            program = data.get('program', data.get('程序', ""))
            items_data = data.get('items', data.get('components', []))
        else:
            items_data = data
        
        for item_data in items_data:
            item = PickPlaceItem(
                reference=item_data.get('reference', item_data.get('ref', item_data.get('位号', ""))),
                x=parse_float(item_data.get('x', item_data.get('x坐标', '0'))),
                y=parse_float(item_data.get('y', item_data.get('y坐标', '0'))),
                rotation=parse_float(item_data.get('rotation', item_data.get('角度', item_data.get('旋转', '0')))),
                layer=item_data.get('layer', item_data.get('层', item_data.get('Layer', 'Top'))),
                package=item_data.get('package', item_data.get('封装', "")),
                part_number=item_data.get('part_number', item_data.get('料号', "")),
                value=item_data.get('value', item_data.get('值', "")),
                feeder=item_data.get('feeder', item_data.get('feeder_id', item_data.get('飞达', ""))),
                nozzel=item_data.get('nozzel', item_data.get('吸嘴', "")),
                speed=parse_float(item_data.get('speed', '0')),
                skip=item_data.get('skip', item_data.get('跳过', False)),
                notes=item_data.get('notes', item_data.get('备注', ""))
            )
            if item.reference:
                items.append(item)
    
    else:
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                reference = row.get('reference') or row.get('ref') or row.get('位号') or row.get('Ref') or ""
                if not reference:
                    continue
                
                item = PickPlaceItem(
                    reference=reference,
                    x=parse_float(row.get('x') or row.get('x坐标') or row.get('X') or row.get('X(mm)') or '0'),
                    y=parse_float(row.get('y') or row.get('y坐标') or row.get('Y') or row.get('Y(mm)') or '0'),
                    rotation=parse_float(row.get('rotation') or row.get('角度') or row.get('旋转') or row.get('Rotation') or row.get('Angle') or '0'),
                    layer=row.get('layer') or row.get('层') or row.get('Layer') or row.get('Side') or 'Top',
                    package=row.get('package') or row.get('封装') or row.get('Package') or "",
                    part_number=row.get('part_number') or row.get('料号') or row.get('Part') or row.get('PN') or "",
                    value=row.get('value') or row.get('值') or row.get('Value') or "",
                    feeder=row.get('feeder') or row.get('feeder_id') or row.get('飞达') or row.get('Feeder') or "",
                    nozzel=row.get('nozzel') or row.get('吸嘴') or row.get('Nozzel') or "",
                    speed=parse_float(row.get('speed') or row.get('速度') or '0'),
                    skip=(row.get('skip') or row.get('跳过') or row.get('Skip') or '').lower() in ['true', '1', 'yes', '是'],
                    notes=row.get('notes') or row.get('备注') or ""
                )
                items.append(item)
    
    if not board_number:
        board_number = f"BOARD_{datetime.now().strftime('%Y%m%d')}"
    
    pick_place_id = generate_id("PP")
    
    pick_place = PickPlaceData(
        pick_place_id=pick_place_id,
        board_number=board_number,
        board_revision=board_revision,
        machine=machine,
        program=program,
        items=items
    )
    
    existing = store.get_pick_place_by_board(board_number, board_revision)
    if existing:
        print(f"  警告: 已存在板号 {board_number} (版本 {board_revision}) 的贴片坐标")
        print(f"  现有贴片数据ID: {existing.pick_place_id}")
        print(f"  本次导入将创建新的贴片数据记录")
    
    store.save_pick_place(pick_place)
    
    return {
        "pick_place_id": pick_place_id,
        "board_number": board_number,
        "board_revision": board_revision,
        "items_count": len(items)
    }


def import_oven_profile(file_path: Path, store: DataStore) -> Dict[str, Any]:
    points = []
    name = ""
    description = ""
    solder_paste_type = ""
    target_peak_min = 0.0
    target_peak_max = 0.0
    target_soak_start = 0.0
    target_soak_end = 0.0
    target_soak_min_time = 0.0
    target_soak_max_time = 0.0
    
    if file_path.suffix.lower() == '.json':
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if isinstance(data, dict):
            name = data.get('name', data.get('名称', ""))
            description = data.get('description', data.get('描述', ""))
            solder_paste_type = data.get('solder_paste_type', data.get('锡膏类型', ""))
            target_peak_min = parse_float(data.get('target_peak_min', '0'))
            target_peak_max = parse_float(data.get('target_peak_max', '0'))
            target_soak_start = parse_float(data.get('target_soak_start', '0'))
            target_soak_end = parse_float(data.get('target_soak_end', '0'))
            target_soak_min_time = parse_float(data.get('target_soak_min_time', '0'))
            target_soak_max_time = parse_float(data.get('target_soak_max_time', '0'))
            points_data = data.get('points', data.get('profile', []))
        else:
            points_data = data
        
        for point_data in points_data:
            point = OvenProfilePoint(
                time=parse_float(point_data.get('time', point_data.get('时间', '0'))),
                temperature=parse_float(point_data.get('temperature', point_data.get('temp', point_data.get('温度', '0')))),
                zone=parse_int(point_data.get('zone', point_data.get('温区', '-1'))) if point_data.get('zone') or point_data.get('温区') else None
            )
            points.append(point)
    
    else:
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                time_str = row.get('time') or row.get('时间') or row.get('Time') or row.get('t') or ""
                temp_str = row.get('temperature') or row.get('温度') or row.get('Temperature') or row.get('Temp') or row.get('T') or ""
                
                if not time_str or not temp_str:
                    continue
                
                point = OvenProfilePoint(
                    time=parse_float(time_str),
                    temperature=parse_float(temp_str),
                    zone=parse_int(row.get('zone') or row.get('温区') or row.get('Zone') or '-1') if (row.get('zone') or row.get('温区') or row.get('Zone')) else None
                )
                points.append(point)
    
    if not name:
        name = f"炉温曲线_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    profile_id = generate_id("OVEN")
    
    profile = OvenProfile(
        profile_id=profile_id,
        name=name,
        description=description or f"导入自 {file_path.name}",
        solder_paste_type=solder_paste_type,
        target_peak_min=target_peak_min,
        target_peak_max=target_peak_max,
        target_soak_start=target_soak_start,
        target_soak_end=target_soak_end,
        target_soak_min_time=target_soak_min_time,
        target_soak_max_time=target_soak_max_time,
        points=points
    )
    
    existing = store.get_oven_profile_by_name(name)
    if existing:
        print(f"  警告: 已存在名称为 '{name}' 的炉温曲线")
        print(f"  现有曲线ID: {existing.profile_id}")
        print(f"  本次导入将创建新的炉温曲线记录")
    
    store.save_oven_profile(profile)
    
    return {
        "profile_id": profile_id,
        "name": name,
        "points_count": len(points),
        "peak_temp": profile.get_peak_temperature()
    }


def import_paste_stencil(file_path: Path, store: DataStore) -> Dict[str, Any]:
    paste_count = 0
    stencil_count = 0
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if isinstance(data, dict):
        pastes_data = data.get('solder_pastes', data.get('锡膏批次', []))
        stencils_data = data.get('stencils', data.get('钢网批次', []))
        
        for paste_data in pastes_data:
            batch_id = paste_data.get('batch_id', generate_id("PASTE"))
            lot_number = paste_data.get('lot_number', paste_data.get('批次号', ""))
            
            existing = store.get_solder_paste_by_lot(lot_number) if lot_number else None
            if existing:
                print(f"  警告: 已存在批次号 {lot_number} 的锡膏，跳过")
                continue
            
            try:
                manufacture_date = parse_date(paste_data.get('manufacture_date', paste_data.get('生产日期', date.today().isoformat())))
            except:
                manufacture_date = date.today()
            
            try:
                expiry_date = parse_date(paste_data.get('expiry_date', paste_data.get('有效期', (date.today().replace(year=date.today().year + 1)).isoformat())))
            except:
                expiry_date = date.today().replace(year=date.today().year + 1)
            
            thaw_start_time = None
            if paste_data.get('thaw_start_time') or paste_data.get('回温开始时间'):
                try:
                    thaw_start_time = parse_datetime(paste_data.get('thaw_start_time', paste_data.get('回温开始时间', '')))
                except:
                    pass
            
            thaw_complete_time = None
            if paste_data.get('thaw_complete_time') or paste_data.get('回温完成时间'):
                try:
                    thaw_complete_time = parse_datetime(paste_data.get('thaw_complete_time', paste_data.get('回温完成时间', '')))
                except:
                    pass
            
            open_time = None
            if paste_data.get('open_time') or paste_data.get('开封时间'):
                try:
                    open_time = parse_datetime(paste_data.get('open_time', paste_data.get('开封时间', '')))
                except:
                    pass
            
            paste = SolderPasteBatch(
                batch_id=batch_id,
                lot_number=lot_number,
                solder_paste_type=paste_data.get('solder_paste_type', paste_data.get('锡膏类型', '无铅锡膏')),
                manufacturer=paste_data.get('manufacturer', paste_data.get('制造商', "")),
                alloy_type=paste_data.get('alloy_type', paste_data.get('合金类型', "")),
                particle_size=paste_data.get('particle_size', paste_data.get('颗粒尺寸', "")),
                flux_type=paste_data.get('flux_type', paste_data.get('助焊剂类型', "")),
                shelf_life_months=parse_int(paste_data.get('shelf_life_months', paste_data.get('保质期月', '12'))),
                manufacture_date=manufacture_date,
                expiry_date=expiry_date,
                thaw_start_time=thaw_start_time,
                thaw_complete_time=thaw_complete_time,
                max_thaw_hours=parse_float(paste_data.get('max_thaw_hours', paste_data.get('最大回温小时', '8'))),
                max_room_temp_hours=parse_float(paste_data.get('max_room_temp_hours', paste_data.get('最大室温使用小时', '24'))),
                open_time=open_time,
                usage_count=parse_int(paste_data.get('usage_count', paste_data.get('使用次数', '0'))),
                status=paste_data.get('status', paste_data.get('状态', '未开封')),
                notes=paste_data.get('notes', paste_data.get('备注', ""))
            )
            
            store.save_solder_paste(paste)
            paste_count += 1
        
        for stencil_data in stencils_data:
            batch_id = stencil_data.get('batch_id', generate_id("STENCIL"))
            stencil_id = stencil_data.get('stencil_id', stencil_data.get('钢网编号', ""))
            
            existing = store.get_stencil_by_id(stencil_id) if stencil_id else None
            if existing:
                print(f"  警告: 已存在钢网编号 {stencil_id} 的钢网，跳过")
                continue
            
            try:
                manufacture_date = parse_date(stencil_data.get('manufacture_date', stencil_data.get('生产日期', date.today().isoformat())))
            except:
                manufacture_date = date.today()
            
            last_cleaned = None
            if stencil_data.get('last_cleaned') or stencil_data.get('上次清洗'):
                try:
                    last_cleaned = parse_date(stencil_data.get('last_cleaned', stencil_data.get('上次清洗', '')))
                except:
                    pass
            
            stencil = StencilBatch(
                batch_id=batch_id,
                stencil_id=stencil_id,
                manufacturer=stencil_data.get('manufacturer', stencil_data.get('制造商', "")),
                manufacture_date=manufacture_date,
                thickness=parse_float(stencil_data.get('thickness', stencil_data.get('厚度', '0'))),
                material=stencil_data.get('material', stencil_data.get('材质', "")),
                aperture_count=parse_int(stencil_data.get('aperture_count', stencil_data.get('开孔数', '0'))),
                board_number=stencil_data.get('board_number', stencil_data.get('板号', "")),
                board_revision=stencil_data.get('board_revision', stencil_data.get('版本', "")),
                use_count=parse_int(stencil_data.get('use_count', stencil_data.get('使用次数', '0'))),
                last_cleaned=last_cleaned,
                max_uses=parse_int(stencil_data.get('max_uses', stencil_data.get('最大使用次数', '10000'))),
                status=stencil_data.get('status', stencil_data.get('状态', '正常')),
                notes=stencil_data.get('notes', stencil_data.get('备注', ""))
            )
            
            store.save_stencil(stencil)
            stencil_count += 1
    
    return {
        "paste_count": paste_count,
        "stencil_count": stencil_count
    }


def import_aoi(file_path: Path, store: DataStore) -> Dict[str, Any]:
    defects = []
    board_number = ""
    board_revision = ""
    serial_number = ""
    machine = ""
    program = ""
    operator = ""
    total_components = 0
    inspected_count = 0
    pass_count = 0
    fail_count = 0
    overall_result = "PASS"
    
    if file_path.suffix.lower() == '.json':
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if isinstance(data, dict):
            board_number = data.get('board_number', data.get('板号', ""))
            board_revision = data.get('board_revision', data.get('版本', ""))
            serial_number = data.get('serial_number', data.get('序列号', ""))
            machine = data.get('machine', data.get('机器', ""))
            program = data.get('program', data.get('程序', ""))
            operator = data.get('operator', data.get('操作员', ""))
            total_components = parse_int(data.get('total_components', data.get('总元件数', '0')))
            inspected_count = parse_int(data.get('inspected_count', data.get('已检查数', '0')))
            pass_count = parse_int(data.get('pass_count', data.get('通过数', '0')))
            fail_count = parse_int(data.get('fail_count', data.get('失败数', '0')))
            overall_result = data.get('overall_result', data.get('整体结果', 'PASS'))
            defects_data = data.get('defects', data.get('缺陷列表', []))
        else:
            defects_data = data
        
        for defect_data in defects_data:
            defect = AOI_Defect(
                reference=defect_data.get('reference', defect_data.get('ref', defect_data.get('位号', ""))),
                defect_type=defect_data.get('defect_type', defect_data.get('缺陷类型', "")),
                x=parse_float(defect_data.get('x', '0')),
                y=parse_float(defect_data.get('y', '0')),
                image_file=defect_data.get('image_file', defect_data.get('图片', "")),
                description=defect_data.get('description', defect_data.get('描述', "")),
                confirmed=defect_data.get('confirmed', defect_data.get('已确认', False)),
                false_alarm=defect_data.get('false_alarm', defect_data.get('误报', False)),
                rework_needed=defect_data.get('rework_needed', defect_data.get('需要返修', False)),
                rework_status=defect_data.get('rework_status', defect_data.get('返修状态', '无返修')),
                rework_notes=defect_data.get('rework_notes', defect_data.get('返修备注', "")),
                rework_operator=defect_data.get('rework_operator', defect_data.get('返修员', "")),
                rework_time=parse_datetime(defect_data.get('rework_time', '')) if defect_data.get('rework_time') else None,
                notes=defect_data.get('notes', defect_data.get('备注', ""))
            )
            if defect.reference or defect.defect_type:
                defects.append(defect)
    
    else:
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                reference = row.get('reference') or row.get('ref') or row.get('位号') or row.get('Ref') or ""
                defect_type = row.get('defect_type') or row.get('缺陷类型') or row.get('缺陷') or row.get('Defect') or row.get('Error') or ""
                
                if not reference and not defect_type:
                    continue
                
                defect = AOI_Defect(
                    reference=reference,
                    defect_type=defect_type,
                    x=parse_float(row.get('x') or row.get('X') or '0'),
                    y=parse_float(row.get('y') or row.get('Y') or '0'),
                    image_file=row.get('image_file') or row.get('图片') or row.get('Image') or "",
                    description=row.get('description') or row.get('描述') or row.get('Description') or "",
                    confirmed=(row.get('confirmed') or row.get('已确认') or '').lower() in ['true', '1', 'yes', '是'],
                    false_alarm=(row.get('false_alarm') or row.get('误报') or row.get('False Alarm') or '').lower() in ['true', '1', 'yes', '是'],
                    rework_needed=(row.get('rework_needed') or row.get('需要返修') or '').lower() in ['true', '1', 'yes', '是'],
                    rework_status=row.get('rework_status') or row.get('返修状态') or '无返修',
                    rework_notes=row.get('rework_notes') or row.get('返修备注') or "",
                    rework_operator=row.get('rework_operator') or row.get('返修员') or "",
                    rework_time=parse_datetime(row.get('rework_time', '')) if row.get('rework_time') else None,
                    notes=row.get('notes') or row.get('备注') or ""
                )
                defects.append(defect)
    
    if not board_number:
        board_number = f"BOARD_{datetime.now().strftime('%Y%m%d')}"
    
    aoi_id = generate_id("AOI")
    
    if defects:
        fail_count = len([d for d in defects if not d.false_alarm])
        if fail_count > 0:
            overall_result = "FAIL"
    
    aoi = AOI_Report(
        aoi_id=aoi_id,
        board_number=board_number,
        board_revision=board_revision,
        serial_number=serial_number,
        machine=machine,
        program=program,
        operator=operator,
        total_components=total_components,
        inspected_count=inspected_count,
        pass_count=pass_count,
        fail_count=fail_count,
        defects=defects,
        overall_result=overall_result
    )
    
    if serial_number:
        existing_reports = store.get_aoi_reports_by_serial(serial_number)
        if existing_reports:
            print(f"  警告: 序列号 {serial_number} 已有 {len(existing_reports)} 条AOI记录")
    
    store.save_aoi_report(aoi)
    
    return {
        "aoi_id": aoi_id,
        "board_number": board_number,
        "board_revision": board_revision,
        "serial_number": serial_number,
        "defects_count": len(defects),
        "rework_needed_count": len([d for d in defects if d.rework_needed and not d.false_alarm]),
        "overall_result": overall_result
    }


def import_command(work_dir: Path, file_path: Path, file_type: Optional[str] = None):
    if not file_path.exists():
        raise FileNotFoundError(f"文件不存在: {file_path}")
    
    store = DataStore(work_dir)
    
    file_hash = store.calculate_file_hash(file_path)
    
    if store.is_file_imported(file_hash):
        print(f"该文件已导入过: {file_path.name}")
        print("如需重新导入，请使用不同的文件或修改内容。")
        return
    
    if not file_type:
        file_type = detect_file_type(file_path)
    
    if not file_type:
        raise ValueError(f"无法自动识别文件类型: {file_path.name}\n"
                         f"请使用 --type 参数指定类型: bom, pick_place, oven_profile, paste_stencil, aoi")
    
    print(f"正在导入: {file_path.name}")
    print(f"  文件类型: {file_type}")
    
    result = {}
    
    if file_type == 'bom':
        result = import_bom(file_path, store)
        print(f"  导入BOM记录: 板号={result['board_number']}, 元件数={result['parts_count']}")
        store.save_import_record(file_hash, file_path.name, file_type, 
                                  result['parts_count'], result['board_number'], result.get('board_revision', ''))
    
    elif file_type == 'pick_place':
        result = import_pick_place(file_path, store)
        print(f"  导入贴片坐标: 板号={result['board_number']}, 坐标数={result['items_count']}")
        store.save_import_record(file_hash, file_path.name, file_type, 
                                  result['items_count'], result['board_number'], result.get('board_revision', ''))
    
    elif file_type == 'oven_profile':
        result = import_oven_profile(file_path, store)
        print(f"  导入炉温曲线: 名称={result['name']}, 点数={result['points_count']}")
        print(f"  峰值温度: {result['peak_temp']:.1f}°C")
        store.save_import_record(file_hash, file_path.name, file_type, result['points_count'])
    
    elif file_type == 'paste_stencil':
        result = import_paste_stencil(file_path, store)
        total_count = result['paste_count'] + result['stencil_count']
        print(f"  导入钢网锡膏批次: 锡膏={result['paste_count']}条, 钢网={result['stencil_count']}条")
        store.save_import_record(file_hash, file_path.name, file_type, total_count)
    
    elif file_type == 'aoi':
        result = import_aoi(file_path, store)
        print(f"  导入AOI报告: 板号={result['board_number']}, 缺陷数={result['defects_count']}")
        print(f"  整体结果: {result['overall_result']}")
        store.save_import_record(file_hash, file_path.name, file_type, 
                                  result['defects_count'], result['board_number'], result.get('board_revision', ''))
    
    print(f"\n导入完成！")
    return result
