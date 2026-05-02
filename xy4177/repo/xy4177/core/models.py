# -*- coding: utf-8 -*-
"""
核心数据模型
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Any, Union
from enum import Enum
from .constants import BarcodeType, ErrorLevel, PaperSize, DPI, DEFAULT_DPI


@dataclass
class SKUData:
    sku: str
    box_number: str
    batch_number: Optional[str] = None
    expiry_date: Optional[str] = None
    product_name: Optional[str] = None
    quantity: Optional[int] = None
    additional_fields: Dict[str, Any] = field(default_factory=dict)
    row_index: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        result = {
            'sku': self.sku,
            'box_number': self.box_number,
            'batch_number': self.batch_number,
            'expiry_date': self.expiry_date,
            'product_name': self.product_name,
            'quantity': self.quantity,
            'row_index': self.row_index,
        }
        result.update(self.additional_fields)
        return result
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any], row_index: int = 0) -> 'SKUData':
        sku = data.get('sku') or data.get('SKU') or data.get('sku_code', '')
        box_number = data.get('box_number') or data.get('boxNo') or data.get('箱号', '')
        
        additional_fields = {k: v for k, v in data.items() 
                           if k not in ['sku', 'SKU', 'sku_code', 'box_number', 'boxNo', '箱号',
                                       'batch_number', 'batchNo', '批号', 'expiry_date', 
                                       'expiryDate', '效期', 'product_name', 'productName', 
                                       '品名', 'quantity', '数量']}
        
        return cls(
            sku=sku,
            box_number=box_number,
            batch_number=data.get('batch_number') or data.get('batchNo') or data.get('批号'),
            expiry_date=data.get('expiry_date') or data.get('expiryDate') or data.get('效期'),
            product_name=data.get('product_name') or data.get('productName') or data.get('品名'),
            quantity=data.get('quantity') or data.get('数量'),
            additional_fields=additional_fields,
            row_index=row_index
        )


@dataclass
class TemplateField:
    name: str
    field_type: str
    x: float
    y: float
    width: Optional[float] = None
    height: Optional[float] = None
    font_size: Optional[float] = None
    barcode_type: Optional[BarcodeType] = None
    is_required: bool = False
    default_value: Optional[str] = None
    rotation: int = 0


@dataclass
class LabelTemplate:
    name: str
    width_mm: float
    height_mm: float
    dpi: DPI = DEFAULT_DPI
    margin_mm: float = 2.0
    fields: List[TemplateField] = field(default_factory=list)
    raw_content: str = ""
    template_type: str = "ZPL"
    created_at: datetime = field(default_factory=datetime.now)
    
    def get_field_names(self) -> List[str]:
        return [f.name for f in self.fields]
    
    def get_required_fields(self) -> List[TemplateField]:
        return [f for f in self.fields if f.is_required]
    
    def get_barcode_fields(self) -> List[TemplateField]:
        return [f for f in self.fields if f.barcode_type is not None]


@dataclass
class ValidationError:
    error_code: str
    message: str
    level: ErrorLevel
    field: Optional[str] = None
    box_number: Optional[str] = None
    row_index: Optional[int] = None
    details: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'error_code': self.error_code,
            'message': self.message,
            'level': self.level.value,
            'field': self.field,
            'box_number': self.box_number,
            'row_index': self.row_index,
            'details': self.details,
        }


@dataclass
class ValidationResult:
    sku_data: SKUData
    is_valid: bool = True
    errors: List[ValidationError] = field(default_factory=list)
    warnings: List[ValidationError] = field(default_factory=list)
    
    @property
    def has_errors(self) -> bool:
        return len(self.errors) > 0
    
    @property
    def has_warnings(self) -> bool:
        return len(self.warnings) > 0
    
    def add_error(self, error: ValidationError):
        if error.level == ErrorLevel.ERROR:
            self.errors.append(error)
            self.is_valid = False
        else:
            self.warnings.append(error)
    
    def get_all_issues(self) -> List[ValidationError]:
        return self.errors + self.warnings


@dataclass
class LabelPreview:
    sku_data: SKUData
    template: LabelTemplate
    image_data: bytes = b""
    rendered_at: datetime = field(default_factory=datetime.now)
    validation_result: Optional[ValidationResult] = None


@dataclass
class AuditPackage:
    version: str = "1.0"
    generated_at: datetime = field(default_factory=datetime.now)
    template_name: str = ""
    template_hash: str = ""
    total_records: int = 0
    valid_records: int = 0
    invalid_records: int = 0
    all_errors: List[ValidationError] = field(default_factory=list)
    duplicate_box_numbers: List[str] = field(default_factory=list)
    missing_fields: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'version': self.version,
            'generated_at': self.generated_at.isoformat() if self.generated_at else None,
            'template_name': self.template_name,
            'template_hash': self.template_hash,
            'summary': {
                'total_records': self.total_records,
                'valid_records': self.valid_records,
                'invalid_records': self.invalid_records,
            },
            'issues': {
                'duplicate_box_numbers': self.duplicate_box_numbers,
                'missing_fields': self.missing_fields,
                'all_errors': [e.to_dict() for e in self.all_errors],
            }
        }


@dataclass
class Project:
    name: str = "未命名项目"
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    sku_data_list: List[SKUData] = field(default_factory=list)
    template: Optional[LabelTemplate] = None
    validation_results: List[ValidationResult] = field(default_factory=list)
    corrections: Dict[int, Dict[str, Any]] = field(default_factory=dict)
    
    def save_correction(self, row_index: int, field_name: str, new_value: Any):
        if row_index not in self.corrections:
            self.corrections[row_index] = {}
        self.corrections[row_index][field_name] = new_value
        self.updated_at = datetime.now()
    
    def get_corrected_sku(self, original: SKUData) -> SKUData:
        if original.row_index not in self.corrections:
            return original
        
        corrections = self.corrections[original.row_index]
        data = original.to_dict()
        data.update(corrections)
        return SKUData.from_dict(data, original.row_index)
