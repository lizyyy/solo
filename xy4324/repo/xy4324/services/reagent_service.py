#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
试剂库存管理服务
"""

import csv
from typing import List, Dict, Optional, Tuple
from datetime import datetime
from pathlib import Path

from config import get_config
from database import get_db


class ReagentService:
    """试剂库存管理服务"""
    
    def __init__(self):
        self.config = get_config()
        self.db = get_db()
    
    def get_all_reagents(self, include_inactive: bool = False) -> List[Dict]:
        """获取所有试剂"""
        cursor = self.db.cursor()
        
        if include_inactive:
            cursor.execute('''
                SELECT r.*, 
                       (SELECT name FROM reagent_categories WHERE code = r.category) as category_name
                FROM reagents r
                ORDER BY r.name
            ''')
        else:
            cursor.execute('''
                SELECT r.*
                FROM reagents r
                WHERE r.is_active = 1
                ORDER BY r.name
            ''')
        
        return [dict(row) for row in cursor.fetchall()]
    
    def get_reagent(self, reagent_id: int) -> Optional[Dict]:
        """获取单个试剂"""
        cursor = self.db.cursor()
        
        cursor.execute('''
            SELECT r.*
            FROM reagents r
            WHERE r.id = ?
        ''', (reagent_id,))
        
        row = cursor.fetchone()
        return dict(row) if row else None
    
    def add_reagent(self, reagent_data: Dict) -> int:
        """添加新试剂"""
        cursor = self.db.cursor()
        
        cursor.execute('''
            INSERT INTO reagents 
            (name, english_name, cas_number, formula, category, 
             danger_level, concentration, purity, unit, total_quantity,
             available_quantity, minimum_quantity, location, shelf,
             expiry_date, manufacturer, batch_number, remarks)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            reagent_data.get('name'),
            reagent_data.get('english_name'),
            reagent_data.get('cas_number'),
            reagent_data.get('formula'),
            reagent_data.get('category', 'salt'),
            reagent_data.get('danger_level', 3),
            reagent_data.get('concentration'),
            reagent_data.get('purity'),
            reagent_data.get('unit', '克'),
            reagent_data.get('total_quantity', 0),
            reagent_data.get('available_quantity', reagent_data.get('total_quantity', 0)),
            reagent_data.get('minimum_quantity', 0),
            reagent_data.get('location'),
            reagent_data.get('shelf'),
            reagent_data.get('expiry_date'),
            reagent_data.get('manufacturer'),
            reagent_data.get('batch_number'),
            reagent_data.get('remarks')
        ))
        
        self.db.commit()
        return cursor.lastrowid
    
    def update_reagent(self, reagent_id: int, reagent_data: Dict) -> bool:
        """更新试剂信息"""
        cursor = self.db.cursor()
        
        cursor.execute('''
            UPDATE reagents
            SET name = ?, english_name = ?, cas_number = ?, formula = ?,
                category = ?, danger_level = ?, concentration = ?, purity = ?,
                unit = ?, total_quantity = ?, available_quantity = ?, 
                minimum_quantity = ?, location = ?, shelf = ?,
                expiry_date = ?, manufacturer = ?, batch_number = ?, remarks = ?
            WHERE id = ?
        ''', (
            reagent_data.get('name'),
            reagent_data.get('english_name'),
            reagent_data.get('cas_number'),
            reagent_data.get('formula'),
            reagent_data.get('category', 'salt'),
            reagent_data.get('danger_level', 3),
            reagent_data.get('concentration'),
            reagent_data.get('purity'),
            reagent_data.get('unit', '克'),
            reagent_data.get('total_quantity', 0),
            reagent_data.get('available_quantity', 0),
            reagent_data.get('minimum_quantity', 0),
            reagent_data.get('location'),
            reagent_data.get('shelf'),
            reagent_data.get('expiry_date'),
            reagent_data.get('manufacturer'),
            reagent_data.get('batch_number'),
            reagent_data.get('remarks'),
            reagent_id
        ))
        
        self.db.commit()
        return cursor.rowcount > 0
    
    def delete_reagent(self, reagent_id: int) -> bool:
        """软删除试剂"""
        cursor = self.db.cursor()
        
        cursor.execute('''
            UPDATE reagents
            SET is_active = 0
            WHERE id = ?
        ''', (reagent_id,))
        
        self.db.commit()
        return cursor.rowcount > 0
    
    def update_quantity(self, reagent_id: int, quantity_change: float) -> bool:
        """更新库存数量（正数增加，负数减少）"""
        cursor = self.db.cursor()
        
        cursor.execute('''
            UPDATE reagents
            SET available_quantity = available_quantity + ?
            WHERE id = ? AND available_quantity + ? >= 0
        ''', (quantity_change, reagent_id, quantity_change))
        
        self.db.commit()
        return cursor.rowcount > 0
    
    def import_from_csv(self, file_path: str) -> Tuple[int, int, List[str]]:
        """
        从CSV文件导入试剂
        
        Returns:
            (成功数量, 失败数量, 错误信息列表)
        """
        success_count = 0
        fail_count = 0
        errors = []
        
        # 必需字段映射
        required_fields = {
            'name': ['试剂名称', '名称', 'name', '试剂名'],
            'category': ['类别', '分类', 'category', '类型'],
            'danger_level': ['危险等级', '等级', 'danger_level', '危险级别'],
            'unit': ['单位', 'unit', '计量单位'],
            'total_quantity': ['总量', '总数量', 'total_quantity', '数量'],
            'available_quantity': ['可用量', '可用数量', 'available_quantity', '库存'],
        }
        
        # 可选字段映射
        optional_fields = {
            'english_name': ['英文名称', 'english_name', '英文名'],
            'cas_number': ['CAS号', 'cas_number', 'cas'],
            'formula': ['分子式', 'formula', '化学式'],
            'concentration': ['浓度', 'concentration'],
            'purity': ['纯度', 'purity'],
            'minimum_quantity': ['最小库存', 'minimum_quantity', '安全库存'],
            'location': ['存放位置', 'location', '位置'],
            'shelf': ['货架', 'shelf', '货架号'],
            'expiry_date': ['有效期', 'expiry_date', '到期日期'],
            'manufacturer': ['生产厂家', 'manufacturer', '厂家'],
            'batch_number': ['批号', 'batch_number', '批次号'],
            'remarks': ['备注', 'remarks', '说明'],
        }
        
        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                
                # 构建字段映射
                field_mapping = {}
                
                # 检查表头
                headers = [h.strip() for h in reader.fieldnames]
                
                # 映射必需字段
                for target_field, possible_names in required_fields.items():
                    for possible_name in possible_names:
                        if possible_name in headers:
                            field_mapping[target_field] = possible_name
                            break
                
                # 映射可选字段
                for target_field, possible_names in optional_fields.items():
                    for possible_name in possible_names:
                        if possible_name in headers:
                            field_mapping[target_field] = possible_name
                            break
                
                # 处理每一行
                for row_num, row in enumerate(reader, start=2):
                    try:
                        reagent_data = {}
                        
                        # 提取必需字段
                        for target_field in required_fields.keys():
                            if target_field in field_mapping:
                                value = row.get(field_mapping[target_field], '').strip()
                                
                                # 类型转换
                                if target_field in ['total_quantity', 'available_quantity', 'minimum_quantity']:
                                    value = float(value) if value else 0.0
                                elif target_field == 'danger_level':
                                    # 尝试转换危险等级
                                    if value in ['高危险', '高危', '1']:
                                        value = 1
                                    elif value in ['中危险', '中危', '2']:
                                        value = 2
                                    elif value in ['低危险', '低危', '3']:
                                        value = 3
                                    else:
                                        value = 4
                                
                                reagent_data[target_field] = value
                            else:
                                # 设置默认值
                                if target_field == 'name':
                                    raise ValueError(f"缺少试剂名称")
                                elif target_field == 'category':
                                    reagent_data[target_field] = 'salt'
                                elif target_field == 'danger_level':
                                    reagent_data[target_field] = 3
                                elif target_field == 'unit':
                                    reagent_data[target_field] = '克'
                                elif target_field in ['total_quantity', 'available_quantity']:
                                    reagent_data[target_field] = 0
                        
                        # 提取可选字段
                        for target_field in optional_fields.keys():
                            if target_field in field_mapping:
                                value = row.get(field_mapping[target_field], '').strip()
                                
                                if target_field == 'minimum_quantity':
                                    value = float(value) if value else 0.0
                                
                                reagent_data[target_field] = value
                        
                        # 检查名称
                        if not reagent_data.get('name'):
                            raise ValueError("试剂名称不能为空")
                        
                        # 处理类别名称转换
                        category = reagent_data.get('category', '')
                        category_map = {
                            '酸类': 'acid', '酸': 'acid',
                            '碱类': 'base', '碱': 'base',
                            '氧化剂': 'oxidizer',
                            '还原剂': 'reducer',
                            '有机物': 'organic', '有机': 'organic',
                            '金属': 'metal',
                            '盐类': 'salt', '盐': 'salt',
                            '指示剂': 'indicator',
                            '水溶液': 'water', '水': 'water'
                        }
                        reagent_data['category'] = category_map.get(category, category)
                        
                        # 添加到数据库
                        self.add_reagent(reagent_data)
                        success_count += 1
                        
                    except Exception as e:
                        fail_count += 1
                        errors.append(f"第{row_num}行: {str(e)}")
        
        except Exception as e:
            errors.append(f"文件读取错误: {str(e)}")
            fail_count = 0  # 重置
        
        return success_count, fail_count, errors
    
    def export_to_csv(self, file_path: str, reagent_ids: List[int] = None) -> bool:
        """导出试剂到CSV"""
        cursor = self.db.cursor()
        
        if reagent_ids:
            placeholders = ','.join(['?'] * len(reagent_ids))
            cursor.execute(f'''
                SELECT r.name, r.english_name, r.cas_number, r.formula,
                       r.category, r.danger_level, r.concentration, r.purity,
                       r.unit, r.total_quantity, r.available_quantity,
                       r.minimum_quantity, r.location, r.shelf,
                       r.expiry_date, r.manufacturer, r.batch_number, r.remarks
                FROM reagents r
                WHERE r.id IN ({placeholders}) AND r.is_active = 1
                ORDER BY r.name
            ''', reagent_ids)
        else:
            cursor.execute('''
                SELECT r.name, r.english_name, r.cas_number, r.formula,
                       r.category, r.danger_level, r.concentration, r.purity,
                       r.unit, r.total_quantity, r.available_quantity,
                       r.minimum_quantity, r.location, r.shelf,
                       r.expiry_date, r.manufacturer, r.batch_number, r.remarks
                FROM reagents r
                WHERE r.is_active = 1
                ORDER BY r.name
            ''')
        
        rows = cursor.fetchall()
        
        # 类别名称映射
        category_names = {v['name']: k for k, v in self.config.reagent_categories.items()}
        category_names_reverse = {k: v['name'] for k, v in self.config.reagent_categories.items()}
        
        # 危险等级名称
        danger_level_names = {k: v['name'] for k, v in self.config.danger_levels.items()}
        
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            
            # 写入表头
            writer.writerow([
                '试剂名称', '英文名称', 'CAS号', '分子式',
                '类别', '危险等级', '浓度', '纯度',
                '单位', '总量', '可用量',
                '安全库存', '存放位置', '货架',
                '有效期', '生产厂家', '批号', '备注'
            ])
            
            for row in rows:
                writer.writerow([
                    row['name'],
                    row['english_name'] or '',
                    row['cas_number'] or '',
                    row['formula'] or '',
                    category_names_reverse.get(row['category'], row['category']),
                    danger_level_names.get(row['danger_level'], f'等级{row["danger_level"]}'),
                    row['concentration'] or '',
                    row['purity'] or '',
                    row['unit'],
                    row['total_quantity'],
                    row['available_quantity'],
                    row['minimum_quantity'],
                    row['location'] or '',
                    row['shelf'] or '',
                    row['expiry_date'] or '',
                    row['manufacturer'] or '',
                    row['batch_number'] or '',
                    row['remarks'] or ''
                ])
        
        return True
    
    def get_low_stock_reagents(self) -> List[Dict]:
        """获取低于安全库存的试剂"""
        cursor = self.db.cursor()
        
        cursor.execute('''
            SELECT r.*
            FROM reagents r
            WHERE r.is_active = 1 
              AND r.available_quantity <= r.minimum_quantity
            ORDER BY r.available_quantity ASC
        ''')
        
        return [dict(row) for row in cursor.fetchall()]
    
    def get_expiring_reagents(self, days: int = 30) -> List[Dict]:
        """获取即将过期的试剂"""
        cursor = self.db.cursor()
        
        cursor.execute('''
            SELECT r.*,
                   julianday(r.expiry_date) - julianday('now') as days_remaining
            FROM reagents r
            WHERE r.is_active = 1
              AND r.expiry_date IS NOT NULL
              AND julianday(r.expiry_date) - julianday('now') <= ?
              AND julianday(r.expiry_date) - julianday('now') >= 0
            ORDER BY r.expiry_date ASC
        ''', (days,))
        
        return [dict(row) for row in cursor.fetchall()]
