import csv
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
import xml.etree.ElementTree as ET


class CSVParser:
    """CSV文件解析器 - 解析取样记录"""
    
    REQUIRED_COLUMNS = ['孔号', '箱号', '深度起始', '深度结束', '取样编号']
    
    def __init__(self, file_path: str):
        self.file_path = Path(file_path)
        if not self.file_path.exists():
            raise ValueError(f"CSV文件不存在: {file_path}")
        
        self.records: List[Dict[str, Any]] = []
        self.header_map: Dict[str, str] = {}
    
    def parse(self) -> List[Dict[str, Any]]:
        """解析CSV文件"""
        with open(self.file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            if reader.fieldnames:
                self._map_headers(reader.fieldnames)
            
            for row_num, row in enumerate(reader, start=2):
                record = self._parse_row(row, row_num)
                if record:
                    self.records.append(record)
        
        return self.records
    
    def _map_headers(self, headers: List[str]):
        """映射CSV表头到标准字段名"""
        header_mappings = {
            '孔号': ['孔号', 'hole_id', 'holeid', 'hole_id', '钻孔编号', 'zk'],
            '箱号': ['箱号', 'box_no', 'boxno', 'box_num', 'bx'],
            '深度起始': ['深度起始', '深度开始', 'start_depth', 'depth_start', '起始深度'],
            '深度结束': ['深度结束', 'end_depth', 'depth_end', '结束深度'],
            '取样编号': ['取样编号', 'sample_id', 'sampleid', '样品编号', 'sample_no'],
            '样品类型': ['样品类型', 'sample_type', '类型'],
            '描述': ['描述', 'description', '备注'],
        }
        
        for header in headers:
            header_lower = header.lower().strip()
            for standard_name, variations in header_mappings.items():
                if header_lower in [v.lower() for v in variations]:
                    self.header_map[header] = standard_name
                    break
    
    def _parse_row(self, row: Dict[str, str], row_num: int) -> Optional[Dict[str, Any]]:
        """解析单行数据"""
        mapped_row = {}
        for original_key, value in row.items():
            standard_key = self.header_map.get(original_key, original_key)
            mapped_row[standard_key] = value.strip() if value else ''
        
        try:
            hole_number = mapped_row.get('孔号', '')
            if not hole_number:
                return None
            
            box_number = self._safe_int(mapped_row.get('箱号', ''))
            depth_start = self._safe_float(mapped_row.get('深度起始', ''))
            depth_end = self._safe_float(mapped_row.get('深度结束', ''))
            
            return {
                'hole_number': self._normalize_hole_number(hole_number),
                'box_number': box_number,
                'depth_start': depth_start,
                'depth_end': depth_end,
                'sample_id': mapped_row.get('取样编号', ''),
                'sample_type': mapped_row.get('样品类型', ''),
                'description': mapped_row.get('描述', ''),
                'row_number': row_num,
                'raw_data': mapped_row
            }
        except (ValueError, TypeError):
            return None
    
    def _normalize_hole_number(self, hole_num: str) -> str:
        """标准化孔号格式"""
        hole_num = hole_num.strip().upper()
        if not hole_num.startswith('ZK'):
            hole_num = 'ZK' + re.sub(r'^[A-Za-z]+', '', hole_num)
        return hole_num
    
    def _safe_int(self, value: str) -> Optional[int]:
        """安全转换为整数"""
        try:
            return int(float(value))
        except (ValueError, TypeError):
            return None
    
    def _safe_float(self, value: str) -> Optional[float]:
        """安全转换为浮点数"""
        try:
            return float(value)
        except (ValueError, TypeError):
            return None
    
    def get_hole_box_map(self) -> Dict[str, Dict[int, List[Dict[str, Any]]]]:
        """获取按孔号和箱号分组的映射"""
        hole_map: Dict[str, Dict[int, List[Dict[str, Any]]]] = {}
        
        for record in self.records:
            hole_num = record['hole_number']
            box_num = record['box_number']
            
            if hole_num not in hole_map:
                hole_map[hole_num] = {}
            if box_num not in hole_map[hole_num]:
                hole_map[hole_num][box_num] = []
            
            hole_map[hole_num][box_num].append(record)
        
        return hole_map


class GPXParser:
    """GPX文件解析器 - 解析GPS轨迹"""
    
    def __init__(self, file_path: str):
        self.file_path = Path(file_path)
        if not self.file_path.exists():
            raise ValueError(f"GPX文件不存在: {file_path}")
        
        self.track_points: List[Dict[str, Any]] = []
        self.waypoints: List[Dict[str, Any]] = []
    
    def parse(self) -> Dict[str, List[Dict[str, Any]]]:
        """解析GPX文件"""
        namespaces = {
            'gpx': 'http://www.topografix.com/GPX/1/1',
            'gpx10': 'http://www.topografix.com/GPX/1/0'
        }
        
        try:
            tree = ET.parse(self.file_path)
            root = tree.getroot()
            
            self.waypoints = self._parse_waypoints(root, namespaces)
            self.track_points = self._parse_track_points(root, namespaces)
            
            if not self.track_points and not self.waypoints:
                self._parse_without_namespace(root)
            
        except ET.ParseError as e:
            raise ValueError(f"GPX文件解析错误: {e}")
        
        return {
            'track_points': self.track_points,
            'waypoints': self.waypoints
        }
    
    def _parse_waypoints(self, root: ET.Element, namespaces: Dict[str, str]) -> List[Dict[str, Any]]:
        """解析航点"""
        waypoints = []
        
        for ns_prefix, ns_uri in namespaces.items():
            wpts = root.findall(f'.//{{{ns_uri}}}wpt')
            for wpt in wpts:
                waypoint = self._parse_point_element(wpt, ns_uri)
                if waypoint:
                    waypoints.append(waypoint)
        
        return waypoints
    
    def _parse_track_points(self, root: ET.Element, namespaces: Dict[str, str]) -> List[Dict[str, Any]]:
        """解析轨迹点"""
        track_points = []
        
        for ns_prefix, ns_uri in namespaces.items():
            trkpts = root.findall(f'.//{{{ns_uri}}}trkpt')
            for trkpt in trkpts:
                point = self._parse_point_element(trkpt, ns_uri)
                if point:
                    track_points.append(point)
        
        return track_points
    
    def _parse_point_element(self, element: ET.Element, namespace: str) -> Optional[Dict[str, Any]]:
        """解析单个点元素"""
        try:
            lat = float(element.get('lat', 0))
            lon = float(element.get('lon', 0))
            
            time_elem = element.find(f'{{{namespace}}}time')
            time_str = time_elem.text if time_elem is not None else None
            
            ele_elem = element.find(f'{{{namespace}}}ele')
            elevation = float(ele_elem.text) if ele_elem is not None and ele_elem.text else None
            
            name_elem = element.find(f'{{{namespace}}}name')
            name = name_elem.text if name_elem is not None else None
            
            return {
                'latitude': lat,
                'longitude': lon,
                'elevation': elevation,
                'time': self._parse_time(time_str),
                'name': name,
                'raw_time': time_str
            }
        except (ValueError, TypeError):
            return None
    
    def _parse_without_namespace(self, root: ET.Element):
        """不使用命名空间解析"""
        wpts = root.findall('.//wpt')
        trkpts = root.findall('.//trkpt')
        
        for wpt in wpts:
            point = self._parse_simple_point(wpt)
            if point:
                self.waypoints.append(point)
        
        for trkpt in trkpts:
            point = self._parse_simple_point(trkpt)
            if point:
                self.track_points.append(point)
    
    def _parse_simple_point(self, element: ET.Element) -> Optional[Dict[str, Any]]:
        """简单解析点元素（无命名空间）"""
        try:
            lat = float(element.get('lat', 0))
            lon = float(element.get('lon', 0))
            
            time_elem = element.find('time')
            time_str = time_elem.text if time_elem is not None else None
            
            ele_elem = element.find('ele')
            elevation = float(ele_elem.text) if ele_elem is not None and ele_elem.text else None
            
            return {
                'latitude': lat,
                'longitude': lon,
                'elevation': elevation,
                'time': self._parse_time(time_str),
                'raw_time': time_str
            }
        except (ValueError, TypeError):
            return None
    
    def _parse_time(self, time_str: Optional[str]) -> Optional[datetime]:
        """解析时间字符串"""
        if not time_str:
            return None
        
        formats = [
            '%Y-%m-%dT%H:%M:%SZ',
            '%Y-%m-%dT%H:%M:%S%z',
            '%Y-%m-%dT%H:%M:%S',
            '%Y/%m/%d %H:%M:%S',
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(time_str, fmt)
            except ValueError:
                continue
        
        return None
    
    def get_time_range(self) -> Tuple[Optional[datetime], Optional[datetime]]:
        """获取轨迹时间范围"""
        all_times = []
        for point in self.track_points + self.waypoints:
            if point.get('time'):
                all_times.append(point['time'])
        
        if not all_times:
            return (None, None)
        
        return (min(all_times), max(all_times))
    
    def get_location_at_time(self, target_time: datetime, tolerance_minutes: int = 30) -> Optional[Dict[str, Any]]:
        """根据时间查找最近的位置"""
        from datetime import timedelta
        
        tolerance = timedelta(minutes=tolerance_minutes)
        closest_point = None
        closest_diff = None
        
        for point in self.track_points + self.waypoints:
            point_time = point.get('time')
            if not point_time:
                continue
            
            time_diff = abs((point_time - target_time).total_seconds())
            
            if time_diff <= tolerance.total_seconds():
                if closest_diff is None or time_diff < closest_diff:
                    closest_diff = time_diff
                    closest_point = point
        
        return closest_point


class OCRTextParser:
    """OCR文本解析器 - 解析手写备注"""
    
    def __init__(self, file_path: str):
        self.file_path = Path(file_path)
        if not self.file_path.exists():
            raise ValueError(f"OCR文本文件不存在: {file_path}")
        
        self.notes: List[Dict[str, Any]] = []
    
    def parse(self) -> List[Dict[str, Any]]:
        """解析OCR文本文件"""
        with open(self.file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        paragraphs = self._split_paragraphs(content)
        
        for i, para in enumerate(paragraphs):
            note = self._parse_paragraph(para, i + 1)
            if note:
                self.notes.append(note)
        
        return self.notes
    
    def _split_paragraphs(self, content: str) -> List[str]:
        """分割段落"""
        lines = content.split('\n')
        paragraphs = []
        current_para = []
        
        for line in lines:
            line = line.strip()
            if line:
                current_para.append(line)
            else:
                if current_para:
                    paragraphs.append('\n'.join(current_para))
                    current_para = []
        
        if current_para:
            paragraphs.append('\n'.join(current_para))
        
        return paragraphs
    
    def _parse_paragraph(self, text: str, para_num: int) -> Optional[Dict[str, Any]]:
        """解析单个段落"""
        if not text.strip():
            return None
        
        note_id = self._extract_note_id(text)
        hole_number = self._extract_hole_number(text)
        box_number = self._extract_box_number(text)
        depth_range = self._extract_depth_range(text)
        
        return {
            'note_id': note_id,
            'hole_number': hole_number,
            'box_number': box_number,
            'depth_start': depth_range.get('start') if depth_range else None,
            'depth_end': depth_range.get('end') if depth_range else None,
            'content': text,
            'paragraph_number': para_num
        }
    
    def _extract_note_id(self, text: str) -> Optional[str]:
        """提取备注编号"""
        patterns = [
            r'备注[：:]\s*(\d+)',
            r'Note[：:]\s*(\d+)',
            r'编号[：:]\s*(\d+)',
            r'^(\d+)[、．\.]',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.MULTILINE | re.IGNORECASE)
            if match:
                return match.group(1)
        
        return None
    
    def _extract_hole_number(self, text: str) -> Optional[str]:
        """提取孔号"""
        patterns = [
            r'ZK-?(\d+)',
            r'孔号[：:]\s*(\d+)',
            r'钻孔[：:]\s*ZK?(\d+)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return f"ZK{match.group(1)}"
        
        return None
    
    def _extract_box_number(self, text: str) -> Optional[int]:
        """提取箱号"""
        patterns = [
            r'箱[：:]\s*(\d+)',
            r'Box[：:]\s*(\d+)',
            r'第(\d+)箱',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return int(match.group(1))
        
        return None
    
    def _extract_depth_range(self, text: str) -> Optional[Dict[str, float]]:
        """提取深度区间"""
        pattern = r'(\d+\.?\d*)\s*[-~至米到]\s*(\d+\.?\d*)'
        match = re.search(pattern, text)
        if match:
            return {
                'start': float(match.group(1)),
                'end': float(match.group(2))
            }
        return None
