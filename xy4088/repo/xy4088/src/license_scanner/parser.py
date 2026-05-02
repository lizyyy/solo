import csv
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any, TextIO

from dateutil import parser as date_parser

from .models import License, AssetType


CSV_FIELD_MAPPING = {
    'asset_name': ['asset_name', '素材名称', '文件名', 'name', 'file_name', 'asset'],
    'asset_type': ['asset_type', '素材类型', '类型', 'type', 'category'],
    'vendor': ['vendor', '供应商', '厂商', 'provider', 'source'],
    'license_type': ['license_type', '授权类型', 'license', 'type'],
    'purchase_date': ['purchase_date', '购买日期', 'purchase', 'date'],
    'expiry_date': ['expiry_date', '过期日期', '有效期', 'expiry', 'expiration'],
    'seats': ['seats', '授权人数', '用户数', 'users', 'count', '数量'],
    'allowed_usage': ['allowed_usage', '允许用途', '用途', 'usage', 'permission'],
    'restrictions': ['restrictions', '限制条款', '限制', 'restriction', 'forbidden'],
    'asset_hash': ['asset_hash', '文件哈希', 'hash', 'checksum'],
    'notes': ['notes', '备注', '说明', 'note', 'comment'],
    'license_id': ['license_id', '授权编号', 'id', '编号', 'license_number']
}


ASSET_TYPE_MAP = {
    'image': AssetType.IMAGE,
    '图片': AssetType.IMAGE,
    '图像': AssetType.IMAGE,
    'photo': AssetType.IMAGE,
    'font': AssetType.FONT,
    '字体': AssetType.FONT,
    'typeface': AssetType.FONT,
    'audio': AssetType.AUDIO,
    '音频': AssetType.AUDIO,
    'sound': AssetType.AUDIO,
    'music': AssetType.AUDIO,
    'video': AssetType.VIDEO,
    '视频': AssetType.VIDEO,
    'movie': AssetType.VIDEO,
    'document': AssetType.DOCUMENT,
    '文档': AssetType.DOCUMENT,
    'pdf': AssetType.DOCUMENT,
}


def normalize_asset_type(type_str: Optional[str]) -> Optional[AssetType]:
    if not type_str:
        return None
    type_lower = type_str.strip().lower()
    return ASSET_TYPE_MAP.get(type_lower)


def parse_date(date_str: Optional[str]) -> Optional[datetime]:
    if not date_str:
        return None
    try:
        cleaned = str(date_str).strip()
        if not cleaned or cleaned.lower() in ['none', 'null', '', '永久', 'permanent', 'forever']:
            return None
        return date_parser.parse(cleaned, fuzzy=True)
    except (ValueError, TypeError):
        return None


def parse_int(value: Optional[str]) -> Optional[int]:
    if not value:
        return None
    try:
        cleaned = str(value).strip()
        return int(cleaned)
    except (ValueError, TypeError):
        return None


def parse_list(value: Optional[str], separator: str = ',') -> List[str]:
    if not value:
        return []
    items = str(value).split(separator)
    return [item.strip() for item in items if item.strip()]


class CSVParser:
    def __init__(self, field_mapping: Optional[Dict[str, List[str]]] = None):
        self.field_mapping = field_mapping or CSV_FIELD_MAPPING

    def _find_column(self, headers: List[str], target_field: str) -> Optional[str]:
        possible_names = self.field_mapping.get(target_field, [target_field])
        for header in headers:
            header_lower = header.lower().strip()
            for possible in possible_names:
                if possible.lower() == header_lower or header_lower in possible.lower():
                    return header
        return None

    def parse(self, file_path: str) -> List[License]:
        path = Path(file_path)
        if not path.exists():
            raise ValueError(f"File not found: {file_path}")
        if not path.suffix.lower() == '.csv':
            raise ValueError(f"Not a CSV file: {file_path}")

        licenses: List[License] = []

        with open(path, 'r', encoding='utf-8-sig', newline='') as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames or []

            column_map = {
                field: self._find_column(headers, field)
                for field in self.field_mapping.keys()
            }

            for row_num, row in enumerate(reader, start=2):
                try:
                    license_obj = self._row_to_license(row, column_map, row_num)
                    license_obj.original_file = str(path)
                    licenses.append(license_obj)
                except Exception as e:
                    continue

        return licenses

    def _row_to_license(self, row: Dict[str, Any], column_map: Dict[str, Optional[str]], row_num: int) -> License:
        def get_val(field: str) -> Optional[str]:
            col = column_map.get(field)
            if col and col in row:
                val = row[col]
                return val if val and str(val).strip() else None
            return None

        license_id = get_val('license_id')
        if not license_id:
            license_id = f"LIC-{uuid.uuid4().hex[:8]}"

        asset_name = get_val('asset_name')
        if not asset_name:
            asset_name = f"Unnamed-Asset-{row_num}"

        asset_type = normalize_asset_type(get_val('asset_type'))

        purchase_date = parse_date(get_val('purchase_date'))
        expiry_date = parse_date(get_val('expiry_date'))
        seats = parse_int(get_val('seats'))

        allowed_usage = parse_list(get_val('allowed_usage'))
        restrictions = parse_list(get_val('restrictions'))

        return License(
            license_id=license_id,
            asset_name=asset_name,
            asset_type=asset_type,
            vendor=get_val('vendor'),
            license_type=get_val('license_type'),
            purchase_date=purchase_date,
            expiry_date=expiry_date,
            seats=seats,
            allowed_usage=allowed_usage,
            restrictions=restrictions,
            asset_hash=get_val('asset_hash'),
            notes=get_val('notes'),
            source="csv"
        )


class PDFTextParser:
    DATE_PATTERNS = [
        r'(?:有效期|过期|expir(?:y|ation)|截止)[^\d]*(\d{4}[-/年]\d{1,2}[-/月]?\d{0,2})',
        r'(\d{4}[-/年]\d{1,2}[-/月]?\d{0,2})[^\d]*(?:有效期|过期|expir(?:y|ation)|截止)',
    ]
    
    SEAT_PATTERNS = [
        r'(?:授权|用户|user|seat)[^\d]*(\d+)[^\d]*(?:人|个|用户|user|seat)',
        r'(\d+)[^\d]*(?:人|个|用户|user|seat)[^\d]*(?:授权|许可)',
    ]
    
    ASSET_NAME_PATTERNS = [
        r'(?:文件名|素材|名称|asset|file|name)[^\n]*[:：]\s*([^\n]+)',
        r'([^\n]{3,50})\.(?:jpg|jpeg|png|gif|ttf|otf|woff|mp3|wav|mp4|avi|pdf)',
    ]

    def __init__(self):
        pass

    def parse(self, file_path: str) -> List[License]:
        path = Path(file_path)
        if not path.exists():
            raise ValueError(f"File not found: {file_path}")
        if not path.suffix.lower() == '.pdf':
            raise ValueError(f"Not a PDF file: {file_path}")

        try:
            from pypdf import PdfReader
            reader = PdfReader(str(path))
            text = ""
            for page in reader.pages:
                page_text = page.extract_text() or ""
                text += page_text + "\n"
        except Exception as e:
            return []

        return self.parse_text(text, str(path))

    def parse_text(self, text: str, source_file: str = "text") -> List[License]:
        licenses: List[License] = []
        
        sections = self._split_into_sections(text)
        
        for i, section in enumerate(sections):
            if len(section.strip()) < 20:
                continue
                
            license_obj = self._extract_license_from_section(section, i)
            if license_obj:
                license_obj.original_file = source_file
                licenses.append(license_obj)
        
        if not licenses and text.strip():
            license_obj = self._extract_license_from_section(text, 0)
            if license_obj:
                license_obj.original_file = source_file
                licenses.append(license_obj)
        
        return licenses

    def _split_into_sections(self, text: str) -> List[str]:
        markers = [
            r'\n\s*[-*•]\s+',
            r'\n\s*\d+\.\s+',
            r'\n\s*(?:授权|License|Asset|素材|文件)[：:]\s*',
        ]
        
        sections = [text]
        for pattern in markers:
            new_sections = []
            for section in sections:
                parts = re.split(pattern, section, flags=re.IGNORECASE)
                new_sections.extend(parts)
            sections = new_sections
        
        return [s.strip() for s in sections if s.strip()]

    def _extract_license_from_section(self, section: str, index: int) -> Optional[License]:
        asset_name = self._extract_asset_name(section) or f"PDF-Extracted-{index + 1}"
        
        purchase_date = None
        expiry_date = self._extract_date(section)
        
        seats = self._extract_seats(section)
        
        allowed_usage = self._extract_usage(section)
        
        vendor = self._extract_vendor(section)
        
        return License(
            license_id=f"PDF-{uuid.uuid4().hex[:8]}",
            asset_name=asset_name,
            vendor=vendor,
            expiry_date=expiry_date,
            seats=seats,
            allowed_usage=allowed_usage,
            notes=section[:500] if len(section) > 500 else section,
            source="pdf_text"
        )

    def _extract_asset_name(self, text: str) -> Optional[str]:
        for pattern in self.ASSET_NAME_PATTERNS:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                name = match.group(1).strip()
                if len(name) > 2 and len(name) < 100:
                    return name
        return None

    def _extract_date(self, text: str) -> Optional[datetime]:
        for pattern in self.DATE_PATTERNS:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                date_str = match.group(1)
                return parse_date(date_str)
        return None

    def _extract_seats(self, text: str) -> Optional[int]:
        for pattern in self.SEAT_PATTERNS:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return int(match.group(1))
        return None

    def _extract_usage(self, text: str) -> List[str]:
        usage_keywords = [
            ('商业使用', ['商业', 'commercial', 'business', '商用']),
            ('个人使用', ['个人', 'personal', 'private', '非商业', 'non-commercial']),
            ('编辑使用', ['编辑', 'editorial']),
            ('印刷使用', ['印刷', 'print']),
            ('网络使用', ['网络', 'web', 'online', '网站', '网页']),
            ('修改权限', ['修改', 'modify', 'edit', '可编辑', 'derivative']),
            ('转售权限', ['转售', 'resell', 're-sell', '分发', 'distribute']),
        ]
        
        found = []
        text_lower = text.lower()
        
        for usage_name, keywords in usage_keywords:
            for keyword in keywords:
                if keyword.lower() in text_lower:
                    if usage_name not in found:
                        found.append(usage_name)
                    break
        
        return found

    def _extract_vendor(self, text: str) -> Optional[str]:
        vendor_patterns = [
            r'(?:供应商|厂商|provider|vendor|from|by)[：:]\s*([^\n,，]+)',
            r'©\s*([^\n\d]+?)(?:\d|$)',
        ]
        
        for pattern in vendor_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                vendor = match.group(1).strip()
                if len(vendor) > 1 and len(vendor) < 100:
                    return vendor
        return None


def parse_license_file(file_path: str) -> List[License]:
    path = Path(file_path)
    suffix = path.suffix.lower()
    
    if suffix == '.csv':
        parser = CSVParser()
        return parser.parse(file_path)
    elif suffix == '.pdf':
        parser = PDFTextParser()
        return parser.parse(file_path)
    elif suffix == '.txt':
        parser = PDFTextParser()
        with open(file_path, 'r', encoding='utf-8') as f:
            text = f.read()
        return parser.parse_text(text, file_path)
    else:
        raise ValueError(f"Unsupported file type: {suffix}")
