#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
导入导出模块
支持 CSV、Excel 等格式的导入导出
"""

import csv
import json
from datetime import date, datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from io import StringIO

from models import (
    Reagent, Cabinet, ResponsiblePerson, UsageRecord,
    ChemicalCategory
)


class ImportExportManager:
    """导入导出管理器"""
    
    @staticmethod
    def export_reagents_to_csv(reagents: List[Reagent], file_path: str) -> bool:
        """
        导出试剂列表到 CSV 文件
        
        Args:
            reagents: 试剂列表
            file_path: 导出文件路径
        
        Returns:
            是否成功
        """
        try:
            with open(file_path, 'w', newline='', encoding='utf-8-sig') as f:
                writer = csv.writer(f)
                
                # 写入表头
                writer.writerow([
                    '瓶号', '试剂名称', '类别', '纯度', '规格', '生产厂家',
                    '生产日期', '有效期至', '柜位ID', '当前数量', '单位',
                    '最低库存', '责任人ID', '购入日期', '备注'
                ])
                
                # 写入数据
                for reagent in reagents:
                    writer.writerow([
                        reagent.bottle_number,
                        reagent.name,
                        reagent.category.value,
                        reagent.purity or '',
                        reagent.specification or '',
                        reagent.manufacturer or '',
                        reagent.production_date.isoformat() if reagent.production_date else '',
                        reagent.expiration_date.isoformat() if reagent.expiration_date else '',
                        reagent.cabinet_id or '',
                        reagent.quantity,
                        reagent.unit,
                        reagent.min_quantity,
                        reagent.responsible_person_id or '',
                        reagent.purchase_date.isoformat() if reagent.purchase_date else '',
                        reagent.notes or ''
                    ])
            
            return True
        except Exception as e:
            print(f"导出试剂到 CSV 失败: {e}")
            return False
    
    @staticmethod
    def import_reagents_from_csv(file_path: str) -> List[Dict[str, Any]]:
        """
        从 CSV 文件导入试剂数据
        
        Args:
            file_path: CSV 文件路径
        
        Returns:
            试剂数据字典列表
        """
        reagents_data: List[Dict[str, Any]] = []
        
        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                
                for row in reader:
                    reagent_data = ImportExportManager._parse_reagent_row(row)
                    if reagent_data:
                        reagents_data.append(reagent_data)
            
            return reagents_data
        except Exception as e:
            print(f"从 CSV 导入试剂失败: {e}")
            return []
    
    @staticmethod
    def _parse_reagent_row(row: Dict[str, str]) -> Optional[Dict[str, Any]]:
        """
        解析 CSV 行数据为试剂数据字典
        
        Args:
            row: CSV 行数据
        
        Returns:
            试剂数据字典或 None
        """
        try:
            # 解析类别
            category_str = row.get('类别', '').strip()
            category = None
            for cat in ChemicalCategory:
                if cat.value == category_str:
                    category = cat
                    break
            if category is None:
                category = ChemicalCategory.OTHER
            
            # 解析日期
            production_date = None
            if row.get('生产日期'):
                try:
                    production_date = date.fromisoformat(row['生产日期'])
                except ValueError:
                    pass
            
            expiration_date = None
            if row.get('有效期至'):
                try:
                    expiration_date = date.fromisoformat(row['有效期至'])
                except ValueError:
                    pass
            
            purchase_date = None
            if row.get('购入日期'):
                try:
                    purchase_date = date.fromisoformat(row['购入日期'])
                except ValueError:
                    pass
            
            # 解析数值
            quantity = float(row.get('当前数量', 0) or 0)
            min_quantity = float(row.get('最低库存', 0) or 0)
            
            # 解析柜位ID和责任人ID
            cabinet_id = int(row['柜位ID']) if row.get('柜位ID') else None
            responsible_person_id = int(row['责任人ID']) if row.get('责任人ID') else None
            
            return {
                'bottle_number': row.get('瓶号', '').strip(),
                'name': row.get('试剂名称', '').strip(),
                'category': category,
                'purity': row.get('纯度', '').strip(),
                'specification': row.get('规格', '').strip(),
                'manufacturer': row.get('生产厂家', '').strip(),
                'production_date': production_date,
                'expiration_date': expiration_date,
                'cabinet_id': cabinet_id,
                'quantity': quantity,
                'unit': row.get('单位', '').strip() or '瓶',
                'min_quantity': min_quantity,
                'responsible_person_id': responsible_person_id,
                'purchase_date': purchase_date,
                'notes': row.get('备注', '').strip()
            }
        except Exception as e:
            print(f"解析试剂行失败: {e}")
            return None
    
    @staticmethod
    def export_usage_records_to_csv(records: List[UsageRecord], file_path: str) -> bool:
        """
        导出领用/归还记录到 CSV 文件
        
        Args:
            records: 领用/归还记录列表
            file_path: 导出文件路径
        
        Returns:
            是否成功
        """
        try:
            with open(file_path, 'w', newline='', encoding='utf-8-sig') as f:
                writer = csv.writer(f)
                
                # 写入表头
                writer.writerow([
                    '瓶号', '操作类型', '数量', '单位', '操作人ID',
                    '预计归还日期', '实际归还日期', '用途', '备注', '操作时间'
                ])
                
                # 写入数据
                for record in records:
                    writer.writerow([
                        record.bottle_number,
                        record.operation_type,
                        record.quantity,
                        record.unit,
                        record.operator_id,
                        record.expected_return_date.isoformat() if record.expected_return_date else '',
                        record.actual_return_date.isoformat() if record.actual_return_date else '',
                        record.purpose or '',
                        record.notes or '',
                        record.created_at.isoformat()
                    ])
            
            return True
        except Exception as e:
            print(f"导出领用记录到 CSV 失败: {e}")
            return False
    
    @staticmethod
    def export_cabinets_to_csv(cabinets: List[Cabinet], file_path: str) -> bool:
        """
        导出柜位信息到 CSV 文件
        
        Args:
            cabinets: 柜位列表
            file_path: 导出文件路径
        
        Returns:
            是否成功
        """
        try:
            with open(file_path, 'w', newline='', encoding='utf-8-sig') as f:
                writer = csv.writer(f)
                
                # 写入表头
                writer.writerow([
                    '柜位名称', '位置', '描述', '责任人ID', '容量'
                ])
                
                # 写入数据
                for cabinet in cabinets:
                    writer.writerow([
                        cabinet.name,
                        cabinet.location,
                        cabinet.description or '',
                        cabinet.responsible_person_id or '',
                        cabinet.capacity or ''
                    ])
            
            return True
        except Exception as e:
            print(f"导出柜位到 CSV 失败: {e}")
            return False
    
    @staticmethod
    def export_responsible_persons_to_csv(persons: List[ResponsiblePerson], file_path: str) -> bool:
        """
        导出责任人信息到 CSV 文件
        
        Args:
            persons: 责任人列表
            file_path: 导出文件路径
        
        Returns:
            是否成功
        """
        try:
            with open(file_path, 'w', newline='', encoding='utf-8-sig') as f:
                writer = csv.writer(f)
                
                # 写入表头
                writer.writerow([
                    '姓名', '工号', '部门', '电话', '邮箱'
                ])
                
                # 写入数据
                for person in persons:
                    writer.writerow([
                        person.name,
                        person.employee_id,
                        person.department,
                        person.phone or '',
                        person.email or ''
                    ])
            
            return True
        except Exception as e:
            print(f"导出责任人到 CSV 失败: {e}")
            return False
    
    @staticmethod
    def export_to_json(data: Dict[str, Any], file_path: str) -> bool:
        """
        导出数据到 JSON 文件
        
        Args:
            data: 数据字典
            file_path: 导出文件路径
        
        Returns:
            是否成功
        """
        try:
            # 自定义序列化函数处理 date 和 datetime
            def default_serializer(obj):
                if isinstance(obj, (date, datetime)):
                    return obj.isoformat()
                if isinstance(obj, ChemicalCategory):
                    return obj.value
                raise TypeError(f"Type {type(obj)} not serializable")
            
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2, default=default_serializer)
            
            return True
        except Exception as e:
            print(f"导出到 JSON 失败: {e}")
            return False
    
    @staticmethod
    def import_from_json(file_path: str) -> Optional[Dict[str, Any]]:
        """
        从 JSON 文件导入数据
        
        Args:
            file_path: JSON 文件路径
        
        Returns:
            数据字典或 None
        """
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            return data
        except Exception as e:
            print(f"从 JSON 导入失败: {e}")
            return None
