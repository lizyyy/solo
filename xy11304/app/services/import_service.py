import pandas as pd
from sqlalchemy.orm import Session
from typing import Optional
from app.schemas.schemas import ElderCreate, DeliveryRouteCreate, MenuCreate
from app.services.elder_service import create_elder, get_elder_by_id_card
from app.services.route_service import create_route, get_route_by_name
from app.services.menu_service import create_menu
from datetime import datetime


def import_elders_from_excel(db: Session, file_path: str, operator: str = None,
                              ip_address: str = None) -> dict:
    try:
        df = pd.read_excel(file_path)
    except Exception as e:
        raise ValueError(f"无法读取文件: {str(e)}")
    
    required_columns = ['姓名']
    for col in required_columns:
        if col not in df.columns:
            raise ValueError(f"缺少必填列: {col}")
    
    results = {
        "success": 0,
        "failed": 0,
        "errors": [],
        "warnings": []
    }
    
    for idx, row in df.iterrows():
        try:
            name = str(row.get('姓名', '')).strip()
            if not name:
                results["warnings"].append(f"第 {idx+2} 行: 姓名为空，跳过")
                continue
            
            id_card = str(row.get('身份证号', '')).strip() if pd.notna(row.get('身份证号')) else None
            phone = str(row.get('联系电话', '')).strip() if pd.notna(row.get('联系电话')) else None
            address = str(row.get('住址', '')).strip() if pd.notna(row.get('住址')) else None
            room_number = str(row.get('房间号', '')).strip() if pd.notna(row.get('房间号')) else None
            
            route_name = str(row.get('配送路线', '')).strip() if pd.notna(row.get('配送路线')) else None
            route_id = None
            if route_name:
                route = get_route_by_name(db, route_name)
                if route:
                    route_id = route.id
                else:
                    results["warnings"].append(
                        f"第 {idx+2} 行: 配送路线 '{route_name}' 不存在，已设置为空"
                    )
            
            dietary_restrictions = str(row.get('忌口', '')).strip() if pd.notna(row.get('忌口')) else None
            chronic_diseases = str(row.get('慢性病', '')).strip() if pd.notna(row.get('慢性病')) else None
            allergies = str(row.get('过敏史', '')).strip() if pd.notna(row.get('过敏史')) else None
            notes = str(row.get('备注', '')).strip() if pd.notna(row.get('备注')) else None
            
            birth_date = None
            if pd.notna(row.get('出生日期')):
                try:
                    if isinstance(row.get('出生日期'), datetime):
                        birth_date = row.get('出生日期').date()
                    else:
                        birth_date = pd.to_datetime(row.get('出生日期')).date()
                except:
                    results["warnings"].append(f"第 {idx+2} 行: 出生日期格式不正确")
            
            gender = str(row.get('性别', '')).strip() if pd.notna(row.get('性别')) else None
            
            if id_card:
                existing = get_elder_by_id_card(db, id_card)
                if existing:
                    results["warnings"].append(
                        f"第 {idx+2} 行: 身份证号 {id_card} 已存在 ({existing.name})，跳过"
                    )
                    results["failed"] += 1
                    continue
            
            elder = ElderCreate(
                name=name,
                id_card=id_card,
                phone=phone,
                address=address,
                birth_date=birth_date,
                gender=gender,
                room_number=room_number,
                route_id=route_id,
                dietary_restrictions=dietary_restrictions,
                chronic_diseases=chronic_diseases,
                allergies=allergies,
                notes=notes
            )
            
            create_elder(db, elder, operator=operator, ip_address=ip_address)
            results["success"] += 1
            
        except Exception as e:
            results["failed"] += 1
            results["errors"].append(f"第 {idx+2} 行: {str(e)}")
    
    return results


def import_routes_from_excel(db: Session, file_path: str, operator: str = None,
                              ip_address: str = None) -> dict:
    try:
        df = pd.read_excel(file_path)
    except Exception as e:
        raise ValueError(f"无法读取文件: {str(e)}")
    
    required_columns = ['路线名称']
    for col in required_columns:
        if col not in df.columns:
            raise ValueError(f"缺少必填列: {col}")
    
    results = {
        "success": 0,
        "failed": 0,
        "errors": [],
        "warnings": []
    }
    
    for idx, row in df.iterrows():
        try:
            name = str(row.get('路线名称', '')).strip()
            if not name:
                results["warnings"].append(f"第 {idx+2} 行: 路线名称为空，跳过")
                continue
            
            existing = get_route_by_name(db, name)
            if existing:
                results["warnings"].append(
                    f"第 {idx+2} 行: 路线名称 '{name}' 已存在，跳过"
                )
                results["failed"] += 1
                continue
            
            description = str(row.get('描述', '')).strip() if pd.notna(row.get('描述')) else None
            sequence = int(row.get('顺序', 0)) if pd.notna(row.get('顺序')) else 0
            is_active = bool(row.get('是否启用', True)) if pd.notna(row.get('是否启用')) else True
            
            route = DeliveryRouteCreate(
                name=name,
                description=description,
                sequence=sequence,
                is_active=is_active
            )
            
            create_route(db, route, operator=operator, ip_address=ip_address)
            results["success"] += 1
            
        except Exception as e:
            results["failed"] += 1
            results["errors"].append(f"第 {idx+2} 行: {str(e)}")
    
    return results


def import_menus_from_excel(db: Session, file_path: str, operator: str = None,
                             ip_address: str = None) -> dict:
    try:
        df = pd.read_excel(file_path)
    except Exception as e:
        raise ValueError(f"无法读取文件: {str(e)}")
    
    required_columns = ['日期', '用餐类型', '主菜']
    for col in required_columns:
        if col not in df.columns:
            raise ValueError(f"缺少必填列: {col}")
    
    results = {
        "success": 0,
        "failed": 0,
        "errors": [],
        "warnings": []
    }
    
    meal_type_map = {
        '早餐': 'breakfast',
        '午餐': 'lunch',
        '晚餐': 'dinner'
    }
    
    for idx, row in df.iterrows():
        try:
            date_str = row.get('日期')
            if pd.isna(date_str):
                results["warnings"].append(f"第 {idx+2} 行: 日期为空，跳过")
                continue
            
            if isinstance(date_str, datetime):
                menu_date = date_str.date()
            else:
                menu_date = pd.to_datetime(date_str).date()
            
            meal_type_label = str(row.get('用餐类型', '')).strip()
            meal_type = meal_type_map.get(meal_type_label, meal_type_label)
            if meal_type not in ['breakfast', 'lunch', 'dinner']:
                results["warnings"].append(
                    f"第 {idx+2} 行: 用餐类型 '{meal_type_label}' 不正确，使用原值"
                )
            
            main_dish = str(row.get('主菜', '')).strip()
            if not main_dish:
                results["warnings"].append(f"第 {idx+2} 行: 主菜为空，跳过")
                continue
            
            route_name = str(row.get('配送路线', '')).strip() if pd.notna(row.get('配送路线')) else None
            route_id = None
            if route_name:
                route = get_route_by_name(db, route_name)
                if route:
                    route_id = route.id
                else:
                    results["warnings"].append(
                        f"第 {idx+2} 行: 配送路线 '{route_name}' 不存在，已设置为空"
                    )
            
            side_dish1 = str(row.get('副菜1', '')).strip() if pd.notna(row.get('副菜1')) else None
            side_dish2 = str(row.get('副菜2', '')).strip() if pd.notna(row.get('副菜2')) else None
            soup = str(row.get('汤品', '')).strip() if pd.notna(row.get('汤品')) else None
            staple = str(row.get('主食', '')).strip() if pd.notna(row.get('主食')) else None
            special_notes = str(row.get('特殊说明', '')).strip() if pd.notna(row.get('特殊说明')) else None
            
            menu = MenuCreate(
                date=menu_date,
                meal_type=meal_type,
                route_id=route_id,
                main_dish=main_dish,
                side_dish1=side_dish1,
                side_dish2=side_dish2,
                soup=soup,
                staple=staple,
                special_notes=special_notes
            )
            
            create_menu(db, menu, operator=operator, ip_address=ip_address)
            results["success"] += 1
            
        except Exception as e:
            results["failed"] += 1
            results["errors"].append(f"第 {idx+2} 行: {str(e)}")
    
    return results
