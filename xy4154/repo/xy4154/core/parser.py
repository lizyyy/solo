"""
数据解析模块
负责解析展品清单CSV、装箱扫描JSONL和照片目录
"""

import csv
import json
import os
import re
import hashlib
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple, Dict, Any

from dateutil.parser import parse as parse_date

from .models import Exhibit, ScanRecord, PhotoRecord, ProjectData


class CSVParser:
    """展品清单CSV解析器"""
    
    REQUIRED_FIELDS = ['exhibit_id', 'name']
    
    FIELD_MAPPINGS = {
        'exhibit_id': ['exhibit_id', '展品编号', '编号', 'id', 'item_id'],
        'name': ['name', '展品名称', '名称', 'title'],
        'category': ['category', '类别', '分类', 'type'],
        'location': ['location', '位置', '原位置', '展厅'],
        'condition': ['condition', '状态', '状况'],
        'is_fragile': ['is_fragile', '易碎品', '易碎', 'fragile'],
        'special_requirements': ['special_requirements', '特殊要求', '要求'],
        'estimated_value': ['estimated_value', '价值', '预估价值', 'value'],
        'notes': ['notes', '备注', '说明']
    }
    
    @classmethod
    def parse(cls, file_path: str) -> Tuple[List[Exhibit], List[str]]:
        """
        解析展品清单CSV文件
        
        Args:
            file_path: CSV文件路径
            
        Returns:
            Tuple[List[Exhibit], List[str]]: (展品列表, 错误信息列表)
        """
        exhibits = []
        errors = []
        
        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                # 读取CSV内容
                content = f.read()
                # 检测分隔符
                dialect = csv.Sniffer().sniff(content[:1024]) if content else csv.excel
                f.seek(0)
                reader = csv.DictReader(f, dialect=dialect)
                
                # 规范化字段名
                field_mapping = cls._normalize_fields(reader.fieldnames or [])
                
                for row_num, row in enumerate(reader, start=2):  # 从第2行开始（跳过表头）
                    try:
                        exhibit = cls._parse_row(row, field_mapping, row_num)
                        exhibits.append(exhibit)
                    except Exception as e:
                        errors.append(f"第{row_num}行解析错误: {str(e)}")
                        
        except FileNotFoundError:
            errors.append(f"文件不存在: {file_path}")
        except Exception as e:
            errors.append(f"文件读取错误: {str(e)}")
            
        return exhibits, errors
    
    @classmethod
    def _normalize_fields(cls, actual_fields: List[str]) -> Dict[str, str]:
        """
        规范化字段名映射
        
        将CSV中的实际字段名映射到标准字段名
        """
        mapping = {}
        actual_fields_lower = [f.strip().lower() for f in actual_fields]
        
        for standard_field, possible_names in cls.FIELD_MAPPINGS.items():
            for possible_name in possible_names:
                possible_name_lower = possible_name.lower()
                if possible_name_lower in actual_fields_lower:
                    idx = actual_fields_lower.index(possible_name_lower)
                    mapping[standard_field] = actual_fields[idx]
                    break
                    
        return mapping
    
    @classmethod
    def _parse_row(cls, row: Dict[str, str], field_mapping: Dict[str, str], row_num: int) -> Exhibit:
        """解析单行CSV数据"""
        
        def get_value(field: str, default: Any = "") -> str:
            """获取字段值"""
            actual_field = field_mapping.get(field)
            if actual_field:
                return row.get(actual_field, default) or default
            return default
        
        # 检查必需字段
        exhibit_id = get_value('exhibit_id')
        if not exhibit_id:
            raise ValueError(f"缺少必需字段: 展品编号")
        
        name = get_value('name')
        if not name:
            raise ValueError(f"缺少必需字段: 展品名称")
        
        # 解析布尔值
        is_fragile_str = get_value('is_fragile', 'false').lower()
        is_fragile = is_fragile_str in ['true', '是', 'yes', '1', '易碎']
        
        # 解析数值
        estimated_value = 0.0
        value_str = get_value('estimated_value')
        if value_str:
            try:
                # 移除货币符号和千位分隔符
                cleaned_value = re.sub(r'[^\d.]', '', value_str)
                estimated_value = float(cleaned_value)
            except (ValueError, TypeError):
                pass
        
        return Exhibit(
            exhibit_id=exhibit_id.strip(),
            name=name.strip(),
            category=get_value('category').strip(),
            location=get_value('location').strip(),
            condition=get_value('condition', '完好').strip(),
            is_fragile=is_fragile,
            special_requirements=get_value('special_requirements').strip(),
            estimated_value=estimated_value,
            notes=get_value('notes').strip()
        )


class JSONLParser:
    """装箱扫描JSONL解析器"""
    
    REQUIRED_FIELDS = ['scan_id', 'exhibit_id', 'box_number', 'scan_time', 'operator']
    
    @classmethod
    def parse(cls, file_path: str) -> Tuple[List[ScanRecord], List[str]]:
        """
        解析装箱扫描JSONL文件
        
        Args:
            file_path: JSONL文件路径
            
        Returns:
            Tuple[List[ScanRecord], List[str]]: (扫描记录列表, 错误信息列表)
        """
        scan_records = []
        errors = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                for line_num, line in enumerate(f, start=1):
                    line = line.strip()
                    if not line:
                        continue
                    
                    try:
                        data = json.loads(line)
                        scan_record = cls._parse_record(data, line_num)
                        scan_records.append(scan_record)
                    except json.JSONDecodeError as e:
                        errors.append(f"第{line_num}行JSON格式错误: {str(e)}")
                    except Exception as e:
                        errors.append(f"第{line_num}行解析错误: {str(e)}")
                        
        except FileNotFoundError:
            errors.append(f"文件不存在: {file_path}")
        except Exception as e:
            errors.append(f"文件读取错误: {str(e)}")
            
        return scan_records, errors
    
    @classmethod
    def _parse_record(cls, data: Dict[str, Any], line_num: int) -> ScanRecord:
        """解析单条扫描记录"""
        
        # 检查必需字段
        for field in cls.REQUIRED_FIELDS:
            if field not in data:
                raise ValueError(f"缺少必需字段: {field}")
        
        # 解析时间
        scan_time_str = data.get('scan_time', '')
        try:
            scan_time = parse_date(scan_time_str)
        except (ValueError, TypeError):
            raise ValueError(f"无效的时间格式: {scan_time_str}")
        
        # 解析温湿度
        temperature = data.get('temperature')
        if temperature is not None:
            try:
                temperature = float(temperature)
            except (ValueError, TypeError):
                temperature = None
        
        humidity = data.get('humidity')
        if humidity is not None:
            try:
                humidity = float(humidity)
            except (ValueError, TypeError):
                humidity = None
        
        # 解析布尔值
        buffer_verified = cls._parse_bool(data.get('buffer_verified', False))
        has_signature = cls._parse_bool(data.get('has_signature', False))
        
        # 解析照片引用列表
        photo_references = data.get('photo_references', [])
        if not isinstance(photo_references, list):
            photo_references = [str(photo_references)]
        
        return ScanRecord(
            scan_id=str(data['scan_id']).strip(),
            exhibit_id=str(data['exhibit_id']).strip(),
            box_number=str(data['box_number']).strip(),
            scan_time=scan_time,
            operator=str(data['operator']).strip(),
            location=str(data.get('location', '')).strip(),
            temperature=temperature,
            humidity=humidity,
            buffer_verified=buffer_verified,
            has_signature=has_signature,
            notes=str(data.get('notes', '')).strip(),
            photo_references=[str(p).strip() for p in photo_references]
        )
    
    @staticmethod
    def _parse_bool(value: Any) -> bool:
        """解析布尔值"""
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.lower() in ['true', '是', 'yes', '1', '已确认', '确认']
        return bool(value)


class PhotoScanner:
    """照片目录扫描器"""
    
    # 支持的图片格式
    SUPPORTED_FORMATS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'}
    
    # 用于从文件名提取展品编号和箱号的正则模式
    # 支持格式: EX-001, EX_001, EX001, 展品-EX-001, 箱-BOX-A01 等
    EXHIBIT_PATTERNS = [
        # 匹配: 展品_EX-001, exhibit-EX001, item_EX_001 等
        re.compile(r'(?:展品|exhibit|item)[_\-]?([A-Za-z]+[-_]?\d+)', re.IGNORECASE),
        # 匹配文件名开头或中间的编号格式: EX-001, EX_001
        re.compile(r'(?<![A-Za-z0-9])([A-Za-z]{2,}[-_]\d+)', re.IGNORECASE),
    ]
    
    BOX_PATTERNS = [
        # 匹配: 箱-BOX-A01, box-B01, case_A02 等
        re.compile(r'(?:箱|box|case)[_\-]?([A-Za-z0-9\-_]+?)[_\.]', re.IGNORECASE),
        # 备用模式: 直接匹配箱号
        re.compile(r'(?:箱|box|case)[_\-]?([A-Za-z0-9\-_]+)', re.IGNORECASE),
    ]
    
    @classmethod
    def scan(cls, directory_path: str) -> Tuple[List[PhotoRecord], List[str]]:
        """
        扫描照片目录
        
        Args:
            directory_path: 照片目录路径
            
        Returns:
            Tuple[List[PhotoRecord], List[str]]: (照片记录列表, 错误信息列表)
        """
        photo_records = []
        errors = []
        
        dir_path = Path(directory_path)
        
        if not dir_path.exists():
            errors.append(f"目录不存在: {directory_path}")
            return photo_records, errors
        
        if not dir_path.is_dir():
            errors.append(f"不是有效目录: {directory_path}")
            return photo_records, errors
        
        # 递归扫描所有图片文件
        for file_path in dir_path.rglob('*'):
            if file_path.is_file() and file_path.suffix.lower() in cls.SUPPORTED_FORMATS:
                try:
                    photo_record = cls._process_file(file_path, dir_path)
                    photo_records.append(photo_record)
                except Exception as e:
                    errors.append(f"处理文件 {file_path.name} 时出错: {str(e)}")
        
        return photo_records, errors
    
    @classmethod
    def _process_file(cls, file_path: Path, base_dir: Path) -> PhotoRecord:
        """处理单个图片文件"""
        
        # 生成唯一ID（使用文件路径的哈希）
        photo_id = cls._generate_file_id(file_path)
        
        # 获取文件信息
        file_name = file_path.name
        file_size = file_path.stat().st_size
        
        # 尝试从文件名或EXIF获取拍摄时间
        capture_time = cls._extract_capture_time(file_path)
        
        # 尝试从文件名提取展品编号和箱号引用
        exhibit_references = cls._extract_exhibit_references(file_name)
        box_references = cls._extract_box_references(file_name)
        
        return PhotoRecord(
            photo_id=photo_id,
            file_path=str(file_path),
            file_name=file_name,
            file_size=file_size,
            capture_time=capture_time,
            exhibit_references=exhibit_references,
            box_references=box_references,
            is_evidence_photo=True,
            notes=""
        )
    
    @staticmethod
    def _generate_file_id(file_path: Path) -> str:
        """生成文件唯一ID"""
        # 使用文件路径的SHA256哈希作为ID
        hash_obj = hashlib.sha256(str(file_path).encode('utf-8'))
        return hash_obj.hexdigest()[:16]  # 取前16个字符
    
    @classmethod
    def _extract_capture_time(cls, file_path: Path) -> Optional[datetime]:
        """尝试从文件名或文件修改时间提取拍摄时间"""
        
        # 1. 尝试从文件名提取时间戳
        file_name = file_path.stem
        
        # 常见的时间戳格式: YYYYMMDD_HHMMSS 或 YYYY-MM-DD_HH-MM-SS
        timestamp_patterns = [
            re.compile(r'(\d{8})[_\-]?(\d{6})'),  # YYYYMMDD_HHMMSS
            re.compile(r'(\d{4})[_\-](\d{2})[_\-](\d{2})[_\-T]?(\d{2})[_\-:](\d{2})[_\-:](\d{2})'),
            re.compile(r'IMG_(\d{8})_(\d{6})'),  # iPhone格式
        ]
        
        for pattern in timestamp_patterns:
            match = pattern.search(file_name)
            if match:
                try:
                    if len(match.groups()) == 2:
                        # YYYYMMDD_HHMMSS 格式
                        date_str = match.group(1)
                        time_str = match.group(2)
                        dt_str = f"{date_str}{time_str}"
                        return datetime.strptime(dt_str, "%Y%m%d%H%M%S")
                    elif len(match.groups()) == 6:
                        # YYYY-MM-DD_HH-MM-SS 格式
                        return datetime(
                            int(match.group(1)), int(match.group(2)), int(match.group(3)),
                            int(match.group(4)), int(match.group(5)), int(match.group(6))
                        )
                except ValueError:
                    continue
        
        # 2. 使用文件修改时间作为备选
        try:
            mtime = file_path.stat().st_mtime
            return datetime.fromtimestamp(mtime)
        except Exception:
            return None
    
    @classmethod
    def _extract_exhibit_references(cls, file_name: str) -> List[str]:
        """从文件名提取展品编号引用"""
        references = []
        
        for pattern in cls.EXHIBIT_PATTERNS:
            matches = pattern.findall(file_name)
            for match in matches:
                if isinstance(match, tuple):
                    references.extend(match)
                else:
                    references.append(match)
        
        # 去重
        return list(set(references))
    
    @classmethod
    def _extract_box_references(cls, file_name: str) -> List[str]:
        """从文件名提取箱号引用"""
        references = []
        
        for pattern in cls.BOX_PATTERNS:
            matches = pattern.findall(file_name)
            for match in matches:
                if isinstance(match, tuple):
                    references.extend(match)
                else:
                    references.append(match)
        
        # 去重
        return list(set(references))


class DataImporter:
    """数据导入器 - 整合所有解析器"""
    
    def __init__(self):
        self.csv_parser = CSVParser()
        self.jsonl_parser = JSONLParser()
        self.photo_scanner = PhotoScanner()
    
    def import_all(
        self,
        csv_path: Optional[str] = None,
        jsonl_path: Optional[str] = None,
        photo_dir: Optional[str] = None,
        project_name: str = "未命名项目"
    ) -> Tuple[ProjectData, Dict[str, List[str]]]:
        """
        导入所有数据文件
        
        Args:
            csv_path: 展品清单CSV路径
            jsonl_path: 装箱扫描JSONL路径
            photo_dir: 照片目录路径
            project_name: 项目名称
            
        Returns:
            Tuple[ProjectData, Dict[str, List[str]]]: (项目数据, 各文件的错误信息)
        """
        project_data = ProjectData(project_name=project_name)
        errors = {
            'csv': [],
            'jsonl': [],
            'photos': []
        }
        
        # 导入CSV
        if csv_path and os.path.exists(csv_path):
            exhibits, csv_errors = CSVParser.parse(csv_path)
            project_data.exhibits = exhibits
            errors['csv'] = csv_errors
        
        # 导入JSONL
        if jsonl_path and os.path.exists(jsonl_path):
            scan_records, jsonl_errors = JSONLParser.parse(jsonl_path)
            project_data.scan_records = scan_records
            errors['jsonl'] = jsonl_errors
        
        # 导入照片
        if photo_dir and os.path.exists(photo_dir):
            photo_records, photo_errors = PhotoScanner.scan(photo_dir)
            project_data.photo_records = photo_records
            errors['photos'] = photo_errors
        
        return project_data, errors
