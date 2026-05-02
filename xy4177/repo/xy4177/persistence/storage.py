# -*- coding: utf-8 -*-
"""
项目存储模块
用于本地保存和加载项目数据
"""

import json
import pickle
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any
from core.models import Project, SKUData, LabelTemplate, TemplateField
from core.constants import BarcodeType, DPI, DEFAULT_DPI


class ProjectStorage:
    """项目存储管理器"""
    
    PROJECT_EXTENSION = ".lblproj"
    
    def __init__(self, default_dir: Optional[str] = None):
        if default_dir:
            self.default_dir = Path(default_dir)
        else:
            self.default_dir = Path.home() / "LabelPrecheckProjects"
        self.default_dir.mkdir(parents=True, exist_ok=True)
    
    def _sku_to_dict(self, sku: SKUData) -> Dict[str, Any]:
        """将SKUData转换为字典"""
        return {
            'sku': sku.sku,
            'box_number': sku.box_number,
            'batch_number': sku.batch_number,
            'expiry_date': sku.expiry_date,
            'product_name': sku.product_name,
            'quantity': sku.quantity,
            'additional_fields': sku.additional_fields,
            'row_index': sku.row_index,
        }
    
    def _sku_from_dict(self, data: Dict[str, Any]) -> SKUData:
        """从字典创建SKUData"""
        return SKUData(
            sku=data.get('sku', ''),
            box_number=data.get('box_number', ''),
            batch_number=data.get('batch_number'),
            expiry_date=data.get('expiry_date'),
            product_name=data.get('product_name'),
            quantity=data.get('quantity'),
            additional_fields=data.get('additional_fields', {}),
            row_index=data.get('row_index', 0),
        )
    
    def _template_field_to_dict(self, field: TemplateField) -> Dict[str, Any]:
        """将TemplateField转换为字典"""
        return {
            'name': field.name,
            'field_type': field.field_type,
            'x': field.x,
            'y': field.y,
            'width': field.width,
            'height': field.height,
            'font_size': field.font_size,
            'barcode_type': field.barcode_type.value if field.barcode_type else None,
            'is_required': field.is_required,
            'default_value': field.default_value,
            'rotation': field.rotation,
        }
    
    def _template_field_from_dict(self, data: Dict[str, Any]) -> TemplateField:
        """从字典创建TemplateField"""
        barcode_type = None
        if data.get('barcode_type'):
            try:
                barcode_type = BarcodeType(data['barcode_type'])
            except ValueError:
                pass
        
        return TemplateField(
            name=data.get('name', ''),
            field_type=data.get('field_type', 'text'),
            x=data.get('x', 0),
            y=data.get('y', 0),
            width=data.get('width'),
            height=data.get('height'),
            font_size=data.get('font_size'),
            barcode_type=barcode_type,
            is_required=data.get('is_required', False),
            default_value=data.get('default_value'),
            rotation=data.get('rotation', 0),
        )
    
    def _template_to_dict(self, template: LabelTemplate) -> Dict[str, Any]:
        """将LabelTemplate转换为字典"""
        return {
            'name': template.name,
            'width_mm': template.width_mm,
            'height_mm': template.height_mm,
            'dpi': template.dpi.value,
            'margin_mm': template.margin_mm,
            'fields': [self._template_field_to_dict(f) for f in template.fields],
            'raw_content': template.raw_content,
            'template_type': template.template_type,
            'created_at': template.created_at.isoformat() if template.created_at else None,
        }
    
    def _template_from_dict(self, data: Dict[str, Any]) -> LabelTemplate:
        """从字典创建LabelTemplate"""
        dpi = DEFAULT_DPI
        try:
            dpi = DPI(data.get('dpi', DEFAULT_DPI.value))
        except ValueError:
            pass
        
        created_at = None
        if data.get('created_at'):
            try:
                created_at = datetime.fromisoformat(data['created_at'])
            except ValueError:
                pass
        
        fields = [self._template_field_from_dict(f) for f in data.get('fields', [])]
        
        return LabelTemplate(
            name=data.get('name', '未命名模板'),
            width_mm=data.get('width_mm', 60.0),
            height_mm=data.get('height_mm', 40.0),
            dpi=dpi,
            margin_mm=data.get('margin_mm', 2.0),
            fields=fields,
            raw_content=data.get('raw_content', ''),
            template_type=data.get('template_type', 'ZPL'),
            created_at=created_at or datetime.now(),
        )
    
    def save_project(self, project: Project, file_path: Optional[str] = None) -> str:
        """保存项目到文件"""
        if file_path:
            path = Path(file_path)
        else:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            safe_name = "".join(c if c.isalnum() or c in '._- ' else '_' for c in project.name)
            filename = f"{safe_name}_{timestamp}{self.PROJECT_EXTENSION}"
            path = self.default_dir / filename
        
        data = {
            'version': '1.0',
            'saved_at': datetime.now().isoformat(),
            'project': {
                'name': project.name,
                'created_at': project.created_at.isoformat() if project.created_at else None,
                'updated_at': project.updated_at.isoformat() if project.updated_at else None,
                'sku_data_list': [self._sku_to_dict(s) for s in project.sku_data_list],
                'template': self._template_to_dict(project.template) if project.template else None,
                'corrections': {str(k): v for k, v in project.corrections.items()},
            }
        }
        
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        return str(path)
    
    def load_project(self, file_path: str) -> Project:
        """从文件加载项目"""
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"项目文件不存在: {file_path}")
        
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        proj_data = data.get('project', {})
        
        created_at = None
        if proj_data.get('created_at'):
            try:
                created_at = datetime.fromisoformat(proj_data['created_at'])
            except ValueError:
                pass
        
        updated_at = None
        if proj_data.get('updated_at'):
            try:
                updated_at = datetime.fromisoformat(proj_data['updated_at'])
            except ValueError:
                pass
        
        sku_list = [self._sku_from_dict(s) for s in proj_data.get('sku_data_list', [])]
        
        template = None
        if proj_data.get('template'):
            template = self._template_from_dict(proj_data['template'])
        
        corrections = {}
        for k, v in proj_data.get('corrections', {}).items():
            try:
                corrections[int(k)] = v
            except ValueError:
                pass
        
        return Project(
            name=proj_data.get('name', '未命名项目'),
            created_at=created_at or datetime.now(),
            updated_at=updated_at or datetime.now(),
            sku_data_list=sku_list,
            template=template,
            corrections=corrections,
        )
    
    def list_projects(self) -> list:
        """列出所有已保存的项目"""
        projects = []
        for file_path in self.default_dir.glob(f"*{self.PROJECT_EXTENSION}"):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                proj_data = data.get('project', {})
                projects.append({
                    'path': str(file_path),
                    'name': proj_data.get('name', file_path.stem),
                    'saved_at': data.get('saved_at'),
                    'record_count': len(proj_data.get('sku_data_list', [])),
                })
            except Exception:
                continue
        
        return projects
