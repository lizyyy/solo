# -*- coding: utf-8 -*-
"""
标签模板解析器
支持ZPL和JSON格式的模板
"""

import re
import json
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from core.models import LabelTemplate, TemplateField
from core.constants import BarcodeType, DPI, DEFAULT_DPI, MM_TO_INCH, INCH_TO_MM


class ZPLParser:
    """ZPL标签模板解析器"""
    
    ZPL_COMMAND_PATTERN = re.compile(r'\^([A-Z][A-Z0-9])([^,]*)?(?:,([^,\^]*))?(?:,([^,\^]*))?(?:,([^,\^]*))?(?:,([^,\^]*))?(?:,([^,\^]*))?')
    
    def __init__(self, dpi: DPI = DEFAULT_DPI):
        self.dpi = dpi
    
    def _dots_to_mm(self, dots: int) -> float:
        """将点转换为毫米"""
        return (dots / self.dpi) * INCH_TO_MM
    
    def _mm_to_dots(self, mm: float) -> int:
        """将毫米转换为点"""
        return int(mm * MM_TO_INCH * self.dpi)
    
    def parse_string(self, zpl_content: str, name: str = "未命名模板") -> LabelTemplate:
        """解析ZPL字符串"""
        lines = zpl_content.split('\n')
        fields: List[TemplateField] = []
        
        label_width = 60.0
        label_height = 40.0
        
        current_x = 0
        current_y = 0
        current_font_size = 12
        field_name: Optional[str] = None
        field_data: str = ""
        
        in_field = False
        is_barcode = False
        barcode_type: Optional[BarcodeType] = None
        barcode_height: Optional[float] = None
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            matches = self.ZPL_COMMAND_PATTERN.findall(line)
            for cmd_tuple in matches:
                cmd = cmd_tuple[0]
                params = list(cmd_tuple[1:])
                
                if cmd == 'XA':
                    fields = []
                elif cmd == 'PW':
                    if params[0]:
                        try:
                            dots = int(params[0])
                            label_width = self._dots_to_mm(dots)
                        except ValueError:
                            pass
                elif cmd == 'LL':
                    if params[0]:
                        try:
                            dots = int(params[0])
                            label_height = self._dots_to_mm(dots)
                        except ValueError:
                            pass
                elif cmd == 'FO':
                    try:
                        x = int(params[0]) if params[0] else 0
                        y = int(params[1]) if params[1] else 0
                        current_x = x
                        current_y = y
                    except (ValueError, IndexError):
                        pass
                elif cmd == 'A':
                    try:
                        height = int(params[2]) if params[2] else 12
                        current_font_size = self._dots_to_mm(height) * 3
                    except (ValueError, IndexError):
                        pass
                elif cmd in ['BC', 'B3', 'B8', 'BU', 'BE', 'BQ', 'BD', 'B7', 'BI']:
                    is_barcode = True
                    barcode_height = None
                    
                    if cmd == 'BC':
                        barcode_type = BarcodeType.CODE128
                    elif cmd == 'B3':
                        barcode_type = BarcodeType.CODE39
                    elif cmd == 'B8':
                        barcode_type = BarcodeType.EAN8
                    elif cmd in ['BU', 'BE']:
                        barcode_type = BarcodeType.EAN13
                    elif cmd == 'BQ':
                        barcode_type = BarcodeType.QRCODE
                    elif cmd == 'BD':
                        barcode_type = BarcodeType.DATAMATRIX
                    elif cmd == 'B7':
                        barcode_type = BarcodeType.PDF417
                    elif cmd == 'BI':
                        barcode_type = BarcodeType.ITF14
                    
                    if params[1]:
                        try:
                            h = int(params[1])
                            barcode_height = self._dots_to_mm(h)
                        except ValueError:
                            pass
                elif cmd == 'FD':
                    in_field = True
                    field_data = params[0] if params[0] else ""
                    
                    field_match = re.search(r'\{(\w+)\}', field_data)
                    if field_match:
                        field_name = field_match.group(1)
                    elif field_data:
                        field_name = field_data
                    else:
                        field_name = f"field_{len(fields)}"
                elif cmd == 'FS':
                    in_field = False
                    
                    if field_name:
                        if is_barcode:
                            field = TemplateField(
                                name=field_name,
                                field_type='barcode',
                                x=self._dots_to_mm(current_x),
                                y=self._dots_to_mm(current_y),
                                width=None,
                                height=barcode_height,
                                barcode_type=barcode_type,
                                is_required=True,
                            )
                        else:
                            field = TemplateField(
                                name=field_name,
                                field_type='text',
                                x=self._dots_to_mm(current_x),
                                y=self._dots_to_mm(current_y),
                                font_size=current_font_size,
                                is_required=False,
                            )
                        fields.append(field)
                    
                    is_barcode = False
                    barcode_type = None
                    barcode_height = None
                    field_name = None
                    field_data = ""
        
        template = LabelTemplate(
            name=name,
            width_mm=label_width,
            height_mm=label_height,
            dpi=self.dpi,
            fields=fields,
            raw_content=zpl_content,
            template_type="ZPL"
        )
        
        return template
    
    def parse_file(self, file_path: str) -> LabelTemplate:
        """解析ZPL文件"""
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"ZPL文件不存在: {file_path}")
        
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        name = path.stem
        return self.parse_string(content, name)


class JSONTemplateParser:
    """JSON格式标签模板解析器"""
    
    def parse_string(self, json_content: str, name: str = "未命名模板") -> LabelTemplate:
        """解析JSON字符串"""
        data = json.loads(json_content)
        
        width = data.get('width', 60.0)
        height = data.get('height', 40.0)
        dpi_value = data.get('dpi', DEFAULT_DPI)
        
        try:
            dpi = DPI(dpi_value)
        except ValueError:
            dpi = DEFAULT_DPI
        
        fields_data = data.get('fields', [])
        fields: List[TemplateField] = []
        
        for fd in fields_data:
            field_type = fd.get('type', 'text')
            
            barcode_type = None
            if field_type == 'barcode' and 'barcode_type' in fd:
                try:
                    barcode_type = BarcodeType(fd['barcode_type'])
                except ValueError:
                    barcode_type = BarcodeType.CODE128
            
            field = TemplateField(
                name=fd.get('name', f"field_{len(fields)}"),
                field_type=field_type,
                x=fd.get('x', 0),
                y=fd.get('y', 0),
                width=fd.get('width'),
                height=fd.get('height'),
                font_size=fd.get('font_size'),
                barcode_type=barcode_type,
                is_required=fd.get('required', False),
                default_value=fd.get('default_value'),
                rotation=fd.get('rotation', 0),
            )
            fields.append(field)
        
        template = LabelTemplate(
            name=name,
            width_mm=width,
            height_mm=height,
            dpi=dpi,
            margin_mm=data.get('margin', 2.0),
            fields=fields,
            raw_content=json_content,
            template_type="JSON"
        )
        
        return template
    
    def parse_file(self, file_path: str) -> LabelTemplate:
        """解析JSON文件"""
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"JSON文件不存在: {file_path}")
        
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        name = path.stem
        return self.parse_string(content, name)


class TemplateParserFactory:
    """模板解析器工厂"""
    
    @staticmethod
    def get_parser(file_path: str, dpi: DPI = DEFAULT_DPI):
        """根据文件扩展名获取对应的解析器"""
        path = Path(file_path)
        ext = path.suffix.lower()
        
        if ext == '.zpl' or ext == '.lbl':
            return ZPLParser(dpi)
        elif ext == '.json':
            return JSONTemplateParser()
        else:
            with open(file_path, 'r', encoding='utf-8') as f:
                first_line = f.readline().strip()
            
            if first_line.startswith('^XA') or first_line.startswith('^FO'):
                return ZPLParser(dpi)
            else:
                try:
                    json.loads(first_line)
                    return JSONTemplateParser()
                except json.JSONDecodeError:
                    return ZPLParser(dpi)
    
    @staticmethod
    def parse_file(file_path: str, dpi: DPI = DEFAULT_DPI) -> LabelTemplate:
        """自动检测格式并解析文件"""
        parser = TemplateParserFactory.get_parser(file_path, dpi)
        return parser.parse_file(file_path)
