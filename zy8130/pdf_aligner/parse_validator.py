"""
解析校验模块 - 负责解析和验证各种输入文件
"""
import json
import csv
from pathlib import Path
from typing import Dict, List, Any, Optional, Union
from dataclasses import dataclass, field
from enum import Enum


class PageSize(Enum):
    A4 = "A4"
    LETTER = "Letter"


@dataclass
class FieldConfig:
    """字段配置"""
    name: str
    x: float
    y: float
    width: float
    height: float
    unit: str = "pt"
    font_size: Optional[float] = None
    font_name: str = "Helvetica"
    is_qr_code: bool = False
    is_barcode: bool = False
    is_image: bool = False
    required: bool = False
    description: str = ""


@dataclass
class TemplateConfig:
    """模板配置"""
    name: str
    page_size: PageSize
    orientation: str = "portrait"  # portrait or landscape
    margins: Dict[str, float] = field(default_factory=lambda: {"top": 0, "bottom": 0, "left": 0, "right": 0})
    fields: List[FieldConfig] = field(default_factory=list)
    background_path: Optional[str] = None


@dataclass
class BusinessData:
    """业务数据"""
    id: str
    fields: Dict[str, Any] = field(default_factory=dict)


class ParseValidator:
    """解析校验器"""
    
    def __init__(self):
        self.errors: List[str] = []
        self.warnings: List[str] = []
    
    def validate_file(self, file_path: str, file_type: str) -> Path:
        """验证文件是否存在"""
        path = Path(file_path)
        if not path.exists():
            self.errors.append(f"{file_type}文件不存在: {file_path}")
            raise FileNotFoundError(f"{file_type}文件不存在: {file_path}")
        if not path.is_file():
            self.errors.append(f"{file_type}路径不是文件: {file_path}")
            raise ValueError(f"{file_type}路径不是文件: {file_path}")
        return path
    
    def parse_template_config(self, config_path: str) -> TemplateConfig:
        """解析模板配置JSON"""
        path = self.validate_file(config_path, "模板配置")
        
        with open(path, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError as e:
                self.errors.append(f"模板配置JSON解析错误: {e}")
                raise
        
        # 解析页面尺寸
        page_size_str = data.get("page_size", "A4").upper()
        try:
            page_size = PageSize(page_size_str)
        except ValueError:
            self.errors.append(f"不支持的页面尺寸: {page_size_str}")
            page_size = PageSize.A4
        
        # 解析边距
        margins = data.get("margins", {"top": 0, "bottom": 0, "left": 0, "right": 0})
        
        # 解析字段
        fields = []
        fields_data = data.get("fields", [])
        
        for field_data in fields_data:
            field = FieldConfig(
                name=field_data.get("name", ""),
                x=float(field_data.get("x", 0)),
                y=float(field_data.get("y", 0)),
                width=float(field_data.get("width", 0)),
                height=float(field_data.get("height", 0)),
                unit=field_data.get("unit", "pt").lower(),
                font_size=float(field_data["font_size"]) if field_data.get("font_size") else None,
                font_name=field_data.get("font_name", "Helvetica"),
                is_qr_code=field_data.get("is_qr_code", False),
                is_barcode=field_data.get("is_barcode", False),
                is_image=field_data.get("is_image", False),
                required=field_data.get("required", False),
                description=field_data.get("description", "")
            )
            
            # 验证字段
            if not field.name:
                self.warnings.append("字段缺少名称")
            
            if field.width <= 0 or field.height <= 0:
                self.warnings.append(f"字段 '{field.name}' 尺寸无效")
            
            if field.unit not in ["pt", "mm"]:
                self.warnings.append(f"字段 '{field.name}' 使用未知单位 '{field.unit}'，默认使用 pt")
                field.unit = "pt"
            
            fields.append(field)
        
        template = TemplateConfig(
            name=data.get("name", "Unknown"),
            page_size=page_size,
            orientation=data.get("orientation", "portrait"),
            margins=margins,
            fields=fields,
            background_path=data.get("background_path")
        )
        
        return template
    
    def parse_coordinates_csv(self, csv_path: str) -> List[FieldConfig]:
        """解析坐标CSV文件"""
        path = self.validate_file(csv_path, "坐标CSV")
        
        fields = []
        
        with open(path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                # 尝试不同的列名组合
                name = row.get("name", row.get("field_name", row.get("字段名", "")))
                x_str = row.get("x", row.get("x1", row.get("left", row.get("X", "0"))))
                y_str = row.get("y", row.get("y1", row.get("top", row.get("Y", "0"))))
                width_str = row.get("width", row.get("w", row.get("宽度", "0")))
                height_str = row.get("height", row.get("h", row.get("高度", "0")))
                unit = row.get("unit", row.get("单位", "pt")).lower()
                
                try:
                    x = float(x_str)
                    y = float(y_str)
                    width = float(width_str)
                    height = float(height_str)
                except ValueError as e:
                    self.errors.append(f"CSV行解析错误: {row}, 错误: {e}")
                    continue
                
                field = FieldConfig(
                    name=name,
                    x=x,
                    y=y,
                    width=width,
                    height=height,
                    unit=unit,
                    is_qr_code=row.get("is_qr_code", "false").lower() == "true",
                    is_barcode=row.get("is_barcode", "false").lower() == "true",
                    is_image=row.get("is_image", "false").lower() == "true",
                    required=row.get("required", "false").lower() == "true",
                    description=row.get("description", row.get("描述", ""))
                )
                
                fields.append(field)
        
        return fields
    
    def parse_business_data(self, data_path: str) -> List[BusinessData]:
        """解析业务数据（支持JSON或CSV格式）"""
        path = self.validate_file(data_path, "业务数据")
        
        # 根据文件扩展名决定解析方式
        if path.suffix.lower() == ".json":
            return self._parse_business_json(path)
        elif path.suffix.lower() == ".csv":
            return self._parse_business_csv(path)
        else:
            # 尝试自动检测
            with open(path, 'r', encoding='utf-8') as f:
                first_char = f.read(1)
                f.seek(0)
                if first_char in ["{", "["]:
                    return self._parse_business_json(path)
                else:
                    return self._parse_business_csv(path)
    
    def _parse_business_json(self, path: Path) -> List[BusinessData]:
        """解析JSON格式的业务数据"""
        with open(path, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError as e:
                self.errors.append(f"业务数据JSON解析错误: {e}")
                raise
        
        business_data_list = []
        
        # 处理数组格式
        if isinstance(data, list):
            for i, item in enumerate(data):
                business_data = BusinessData(
                    id=str(item.get("id", item.get("ID", f"record_{i}"))),
                    fields=item.get("fields", item) if isinstance(item.get("fields"), dict) else item
                )
                business_data_list.append(business_data)
        # 处理对象格式
        elif isinstance(data, dict):
            business_data = BusinessData(
                id=str(data.get("id", data.get("ID", "record_0"))),
                fields=data.get("fields", data) if isinstance(data.get("fields"), dict) else data
            )
            business_data_list.append(business_data)
        
        return business_data_list
    
    def _parse_business_csv(self, path: Path) -> List[BusinessData]:
        """解析CSV格式的业务数据"""
        business_data_list = []
        
        with open(path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            for i, row in enumerate(reader):
                # 尝试获取ID列
                record_id = row.get("id", row.get("ID", row.get("record_id", f"record_{i}")))
                
                # 所有列都作为字段
                fields = dict(row)
                
                business_data = BusinessData(
                    id=str(record_id),
                    fields=fields
                )
                business_data_list.append(business_data)
        
        return business_data_list
    
    def validate_data_match(
        self, 
        template_config: TemplateConfig, 
        business_data_list: List[BusinessData]
    ) -> Dict[str, List[str]]:
        """
        验证业务数据与模板配置是否匹配
        
        返回: {
            "missing_fields": [...],  # 缺少的必填字段
            "extra_fields": [...],    # 额外的字段（警告）
            "empty_values": [...]     # 空值字段
        }
        """
        result = {
            "missing_fields": [],
            "extra_fields": [],
            "empty_values": []
        }
        
        # 提取模板中的字段名
        template_field_names = {field.name for field in template_config.fields}
        required_field_names = {field.name for field in template_config.fields if field.required}
        
        for data in business_data_list:
            data_field_names = set(data.fields.keys())
            
            # 检查必填字段
            missing = required_field_names - data_field_names
            for field_name in missing:
                result["missing_fields"].append(f"记录 {data.id}: 缺少必填字段 '{field_name}'")
            
            # 检查空值
            for field_name, value in data.fields.items():
                if value is None or value == "" or (isinstance(value, str) and value.strip() == ""):
                    if field_name in required_field_names:
                        result["missing_fields"].append(f"记录 {data.id}: 必填字段 '{field_name}' 为空")
                    else:
                        result["empty_values"].append(f"记录 {data.id}: 字段 '{field_name}' 为空")
            
            # 检查额外字段（警告）
            extra = data_field_names - template_field_names
            for field_name in extra:
                if field_name not in ["id", "ID", "record_id"]:
                    result["extra_fields"].append(f"记录 {data.id}: 存在模板未定义的字段 '{field_name}'")
        
        return result
    
    def get_errors(self) -> List[str]:
        """获取所有错误"""
        return self.errors
    
    def get_warnings(self) -> List[str]:
        """获取所有警告"""
        return self.warnings
    
    def has_errors(self) -> bool:
        """是否有错误"""
        return len(self.errors) > 0
    
    def has_warnings(self) -> bool:
        """是否有警告"""
        return len(self.warnings) > 0
    
    def clear(self):
        """清空错误和警告"""
        self.errors = []
        self.warnings = []
