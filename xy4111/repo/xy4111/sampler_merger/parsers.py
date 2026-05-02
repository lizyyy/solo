import csv
import hashlib
import re
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
import xml.etree.ElementTree as ET

try:
    from PIL import Image
    from PIL.ExifTags import TAGS, GPSTAGS
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

try:
    import openpyxl
    HAS_OPENPYXL = True
except ImportError:
    HAS_OPENPYXL = False

from sampler_merger.config import Sample


class BaseParser:
    """解析器基类"""
    
    def parse(self, file_path: Path) -> List[Sample]:
        """解析文件，返回Sample列表"""
        raise NotImplementedError("子类必须实现此方法")
    
    def get_file_hash(self, file_path: Path) -> str:
        """计算文件哈希（SHA256）"""
        sha256 = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                sha256.update(chunk)
        return sha256.hexdigest()


class CSVParser(BaseParser):
    """CSV文件解析器"""
    
    # 常见的字段名映射
    FIELD_MAPPINGS = {
        'id': ['id', 'sample_id', '样点编号', '编号', 'site_id', 'point_id'],
        'latitude': ['latitude', 'lat', '纬度', 'y'],
        'longitude': ['longitude', 'lon', 'lng', '经度', 'x'],
        'timestamp': ['timestamp', 'time', 'date', 'datetime', '时间', '日期', '采样时间'],
        'depth': ['depth', '水深', '深度'],
        'temperature': ['temperature', 'temp', '水温', '温度'],
        'description': ['description', 'desc', '备注', '描述', '说明'],
    }
    
    def parse(self, file_path: Path) -> List[Sample]:
        """解析CSV文件"""
        samples = []
        
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            # 尝试检测方言
            try:
                dialect = csv.Sniffer().sniff(f.read(1024))
                f.seek(0)
            except:
                dialect = csv.excel
                f.seek(0)
            
            reader = csv.DictReader(f, dialect=dialect)
            field_names = [fn.lower().strip() for fn in reader.fieldnames] if reader.fieldnames else []
            
            # 映射字段
            mapped_fields = self._map_fields(reader.fieldnames or [])
            
            for row_num, row in enumerate(reader, 2):
                sample = self._parse_row(row, mapped_fields, file_path, row_num)
                if sample:
                    samples.append(sample)
        
        return samples
    
    def _map_fields(self, field_names: List[str]) -> Dict[str, str]:
        """将CSV字段名映射到标准字段名"""
        mapped = {}
        
        for std_field, possible_names in self.FIELD_MAPPINGS.items():
            for csv_field in field_names:
                if csv_field.lower().strip() in [n.lower() for n in possible_names]:
                    mapped[std_field] = csv_field
                    break
        
        return mapped
    
    def _parse_row(
        self,
        row: Dict[str, str],
        mapped_fields: Dict[str, str],
        file_path: Path,
        row_num: int
    ) -> Optional[Sample]:
        """解析单行数据"""
        # 获取样点ID - 必需
        sample_id = self._get_value(row, mapped_fields, 'id')
        if not sample_id:
            # 尝试使用行号作为ID
            sample_id = f"row_{row_num}"
        
        # 解析坐标
        latitude = self._parse_float(self._get_value(row, mapped_fields, 'latitude'))
        longitude = self._parse_float(self._get_value(row, mapped_fields, 'longitude'))
        
        # 解析时间
        timestamp = self._parse_timestamp(self._get_value(row, mapped_fields, 'timestamp'))
        
        # 收集元数据
        metadata = {}
        for key in ['depth', 'temperature', 'description']:
            value = self._get_value(row, mapped_fields, key)
            if value:
                metadata[key] = value
        
        # 保存原始行数据
        original_data = dict(row)
        
        return Sample(
            sample_id=str(sample_id).strip(),
            latitude=latitude,
            longitude=longitude,
            timestamp=timestamp,
            source_file=str(file_path),
            source_type="csv",
            metadata=metadata,
            original_data=original_data,
        )
    
    def _get_value(self, row: Dict[str, str], mapped_fields: Dict[str, str], field: str) -> str:
        """获取字段值"""
        if field in mapped_fields:
            return row.get(mapped_fields[field], "").strip()
        return ""
    
    def _parse_float(self, value: str) -> Optional[float]:
        """解析浮点数值"""
        if not value:
            return None
        try:
            # 移除可能的单位和空格
            cleaned = re.sub(r'[^\d.\-+]', '', value)
            return float(cleaned)
        except (ValueError, TypeError):
            return None
    
    def _parse_timestamp(self, value: str) -> Optional[datetime]:
        """解析时间戳"""
        if not value:
            return None
        
        # 常见时间格式尝试
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
            "%d-%m-%Y %H:%M:%S",
            "%d/%m/%Y %H:%M:%S",
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%m/%d/%Y",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(value.strip(), fmt)
            except ValueError:
                continue
        
        # 尝试ISO格式
        try:
            return datetime.fromisoformat(value.strip())
        except ValueError:
            pass
        
        return None


class GPXParser(BaseParser):
    """GPX轨迹文件解析器"""
    
    NAMESPACE = {'gpx': 'http://www.topografix.com/GPX/1/1'}
    
    def parse(self, file_path: Path) -> List[Sample]:
        """解析GPX文件"""
        samples = []
        tree = ET.parse(file_path)
        root = tree.getroot()
        
        # 解析航点 (waypoints)
        wpts = root.findall('.//gpx:wpt', self.NAMESPACE)
        for idx, wpt in enumerate(wpts):
            sample = self._parse_waypoint(wpt, file_path, idx)
            if sample:
                samples.append(sample)
        
        # 解析轨迹点 (track points)
        trkpts = root.findall('.//gpx:trkpt', self.NAMESPACE)
        for idx, trkpt in enumerate(trkpts):
            sample = self._parse_trackpoint(trkpt, file_path, idx)
            if sample:
                samples.append(sample)
        
        return samples
    
    def _parse_waypoint(self, wpt: ET.Element, file_path: Path, idx: int) -> Optional[Sample]:
        """解析航点"""
        lat = wpt.get('lat')
        lon = wpt.get('lon')
        
        if lat is None or lon is None:
            return None
        
        # 获取名称
        name_elem = wpt.find('gpx:name', self.NAMESPACE)
        sample_id = name_elem.text if name_elem is not None and name_elem.text else f"wpt_{idx}"
        
        # 获取时间
        time_elem = wpt.find('gpx:time', self.NAMESPACE)
        timestamp = None
        if time_elem is not None and time_elem.text:
            try:
                timestamp = datetime.fromisoformat(time_elem.text.replace('Z', '+00:00'))
            except ValueError:
                pass
        
        # 获取描述
        desc_elem = wpt.find('gpx:desc', self.NAMESPACE)
        metadata = {}
        if desc_elem is not None and desc_elem.text:
            metadata['description'] = desc_elem.text
        
        # 获取高程
        ele_elem = wpt.find('gpx:ele', self.NAMESPACE)
        if ele_elem is not None and ele_elem.text:
            try:
                metadata['elevation'] = float(ele_elem.text)
            except ValueError:
                pass
        
        return Sample(
            sample_id=str(sample_id),
            latitude=float(lat),
            longitude=float(lon),
            timestamp=timestamp,
            source_file=str(file_path),
            source_type="gpx",
            metadata=metadata,
            original_data={'type': 'waypoint', 'element': ET.tostring(wpt, encoding='unicode')},
        )
    
    def _parse_trackpoint(self, trkpt: ET.Element, file_path: Path, idx: int) -> Optional[Sample]:
        """解析轨迹点"""
        lat = trkpt.get('lat')
        lon = trkpt.get('lon')
        
        if lat is None or lon is None:
            return None
        
        # 轨迹点通常没有名称，使用索引
        sample_id = f"trkpt_{idx}"
        
        # 获取时间
        time_elem = trkpt.find('gpx:time', self.NAMESPACE)
        timestamp = None
        if time_elem is not None and time_elem.text:
            try:
                timestamp = datetime.fromisoformat(time_elem.text.replace('Z', '+00:00'))
            except ValueError:
                pass
        
        # 获取高程
        metadata = {}
        ele_elem = trkpt.find('gpx:ele', self.NAMESPACE)
        if ele_elem is not None and ele_elem.text:
            try:
                metadata['elevation'] = float(ele_elem.text)
            except ValueError:
                pass
        
        return Sample(
            sample_id=sample_id,
            latitude=float(lat),
            longitude=float(lon),
            timestamp=timestamp,
            source_file=str(file_path),
            source_type="gpx",
            metadata=metadata,
            original_data={'type': 'trackpoint', 'element': ET.tostring(trkpt, encoding='unicode')},
        )


class PhotoParser(BaseParser):
    """照片解析器 - 从EXIF提取GPS和时间信息"""
    
    def parse(self, file_path: Path) -> List[Sample]:
        """解析照片文件"""
        samples = []
        
        if not HAS_PIL:
            # 如果没有PIL，仅创建基本记录
            sample = Sample(
                sample_id=file_path.stem,
                source_file=str(file_path),
                source_type="photo",
                attachments=[str(file_path)],
                metadata={'file_size': file_path.stat().st_size},
            )
            return [sample]
        
        try:
            with Image.open(file_path) as img:
                exif_data = img._getexif() if hasattr(img, '_getexif') else None
                
                if exif_data is None:
                    # 没有EXIF数据
                    sample = Sample(
                        sample_id=file_path.stem,
                        source_file=str(file_path),
                        source_type="photo",
                        attachments=[str(file_path)],
                        metadata={
                            'file_size': file_path.stat().st_size,
                            'format': img.format,
                            'size': img.size,
                        },
                    )
                    return [sample]
                
                # 解析EXIF标签
                exif = {}
                for tag_id, value in exif_data.items():
                    tag = TAGS.get(tag_id, tag_id)
                    exif[tag] = value
                
                # 解析GPS信息
                latitude, longitude = self._parse_gps(exif)
                
                # 解析时间
                timestamp = self._parse_photo_time(exif, file_path)
                
                # 样点ID使用文件名
                sample_id = file_path.stem
                
                # 元数据
                metadata = {
                    'file_size': file_path.stat().st_size,
                    'format': img.format,
                    'size': img.size,
                }
                
                # 添加相机信息
                if 'Make' in exif:
                    metadata['camera_make'] = exif['Make']
                if 'Model' in exif:
                    metadata['camera_model'] = exif['Model']
                
                sample = Sample(
                    sample_id=sample_id,
                    latitude=latitude,
                    longitude=longitude,
                    timestamp=timestamp,
                    source_file=str(file_path),
                    source_type="photo",
                    attachments=[str(file_path)],
                    metadata=metadata,
                    original_data={'exif_keys': list(exif.keys())},
                )
                samples.append(sample)
                
        except Exception as e:
            # 解析失败时创建基本记录
            sample = Sample(
                sample_id=file_path.stem,
                source_file=str(file_path),
                source_type="photo",
                attachments=[str(file_path)],
                metadata={
                    'file_size': file_path.stat().st_size,
                    'parse_error': str(e),
                },
            )
            samples.append(sample)
        
        return samples
    
    def _parse_gps(self, exif: Dict) -> Tuple[Optional[float], Optional[float]]:
        """从EXIF解析GPS坐标"""
        if 'GPSInfo' not in exif:
            return None, None
        
        gps_info = exif['GPSInfo']
        
        # 解析纬度
        lat = None
        if 2 in gps_info and 1 in gps_info:
            lat_deg = self._convert_to_degrees(gps_info[2])
            if gps_info[1] == 'S':
                lat = -lat_deg
            else:
                lat = lat_deg
        
        # 解析经度
        lon = None
        if 4 in gps_info and 3 in gps_info:
            lon_deg = self._convert_to_degrees(gps_info[4])
            if gps_info[3] == 'W':
                lon = -lon_deg
            else:
                lon = lon_deg
        
        return lat, lon
    
    def _convert_to_degrees(self, value) -> float:
        """将GPS坐标格式转换为度数"""
        if isinstance(value, tuple) and len(value) == 3:
            degrees = float(value[0])
            minutes = float(value[1]) / 60.0
            seconds = float(value[2]) / 3600.0
            return degrees + minutes + seconds
        return float(value)
    
    def _parse_photo_time(self, exif: Dict, file_path: Path) -> Optional[datetime]:
        """解析照片拍摄时间"""
        # 优先使用EXIF时间
        time_tags = ['DateTimeOriginal', 'DateTimeDigitized', 'DateTime']
        for tag in time_tags:
            if tag in exif:
                try:
                    # EXIF时间格式: "2023:05:15 14:30:00"
                    time_str = exif[tag]
                    if isinstance(time_str, bytes):
                        time_str = time_str.decode('utf-8')
                    return datetime.strptime(time_str.strip(), "%Y:%m:%d %H:%M:%S")
                except (ValueError, TypeError):
                    continue
        
        # 使用文件修改时间作为后备
        try:
            mtime = file_path.stat().st_mtime
            return datetime.fromtimestamp(mtime)
        except:
            return None


class ManualParser(BaseParser):
    """手填样点表解析器（Excel格式）"""
    
    def parse(self, file_path: Path) -> List[Sample]:
        """解析Excel手填样点表"""
        samples = []
        
        if not HAS_OPENPYXL:
            # 没有openpyxl，尝试用CSV方式或返回空
            raise ImportError("需要安装openpyxl来解析Excel文件: pip install openpyxl")
        
        wb = openpyxl.load_workbook(file_path, data_only=True)
        
        # 尝试所有工作表
        for sheet_name in wb.sheetnames:
            ws = wb[sheet_name]
            
            # 获取表头行
            header_row = None
            for row_idx, row in enumerate(ws.iter_rows(values_only=True)):
                # 检查是否有常见的表头字段
                row_str = str(row).lower()
                if any(keyword in row_str for keyword in ['id', '编号', '样点', '纬度', '经度', '时间']):
                    header_row = row_idx
                    headers = [str(h).strip() if h else "" for h in row]
                    break
            
            if header_row is None:
                continue
            
            # 映射字段
            mapped_fields = self._map_manual_fields(headers)
            
            # 解析数据行
            for row_idx, row in enumerate(ws.iter_rows(min_row=header_row + 2, values_only=True), start=header_row + 2):
                sample = self._parse_manual_row(row, headers, mapped_fields, file_path, sheet_name, row_idx)
                if sample:
                    samples.append(sample)
        
        wb.close()
        return samples
    
    def _map_manual_fields(self, headers: List[str]) -> Dict[str, int]:
        """映射手填表字段到列索引"""
        mappings = {
            'id': ['id', 'sample_id', '样点编号', '编号', 'site_id', '点号', '序号'],
            'latitude': ['latitude', 'lat', '纬度', 'y', '北坐标'],
            'longitude': ['longitude', 'lon', 'lng', '经度', 'x', '东坐标'],
            'timestamp': ['timestamp', 'time', 'date', 'datetime', '时间', '日期', '采样时间', '调查时间'],
            'depth': ['depth', '水深', '深度', '水位'],
            'temperature': ['temperature', 'temp', '水温', '温度'],
            'description': ['description', 'desc', '备注', '描述', '说明', '情况'],
            'observer': ['observer', '调查人', '记录人', '操作员'],
        }
        
        mapped = {}
        headers_lower = [h.lower() for h in headers]
        
        for std_field, possible_names in mappings.items():
            for idx, h in enumerate(headers_lower):
                if h in [n.lower() for n in possible_names]:
                    mapped[std_field] = idx
                    break
        
        return mapped
    
    def _parse_manual_row(
        self,
        row: tuple,
        headers: List[str],
        mapped_fields: Dict[str, int],
        file_path: Path,
        sheet_name: str,
        row_idx: int
    ) -> Optional[Sample]:
        """解析手填表单行"""
        # 获取样点ID
        sample_id = None
        if 'id' in mapped_fields and mapped_fields['id'] < len(row):
            val = row[mapped_fields['id']]
            if val is not None:
                sample_id = str(val).strip()
        
        if not sample_id:
            sample_id = f"{sheet_name}_row_{row_idx}"
        
        # 解析坐标
        latitude = None
        if 'latitude' in mapped_fields and mapped_fields['latitude'] < len(row):
            val = row[mapped_fields['latitude']]
            if val is not None:
                try:
                    latitude = float(val)
                except (ValueError, TypeError):
                    pass
        
        longitude = None
        if 'longitude' in mapped_fields and mapped_fields['longitude'] < len(row):
            val = row[mapped_fields['longitude']]
            if val is not None:
                try:
                    longitude = float(val)
                except (ValueError, TypeError):
                    pass
        
        # 解析时间
        timestamp = None
        if 'timestamp' in mapped_fields and mapped_fields['timestamp'] < len(row):
            val = row[mapped_fields['timestamp']]
            if val is not None:
                if isinstance(val, datetime):
                    timestamp = val
                else:
                    # 尝试解析字符串
                    try:
                        timestamp = self._parse_manual_timestamp(str(val))
                    except:
                        pass
        
        # 收集元数据
        metadata = {}
        for key in ['depth', 'temperature', 'description', 'observer']:
            if key in mapped_fields and mapped_fields[key] < len(row):
                val = row[mapped_fields[key]]
                if val is not None:
                    metadata[key] = str(val)
        
        # 保存原始行数据
        original_data = {}
        for idx, (header, value) in enumerate(zip(headers, row)):
            if value is not None:
                original_data[header] = value
        
        original_data['_sheet'] = sheet_name
        original_data['_row'] = row_idx
        
        return Sample(
            sample_id=sample_id,
            latitude=latitude,
            longitude=longitude,
            timestamp=timestamp,
            source_file=str(file_path),
            source_type="manual",
            metadata=metadata,
            original_data=original_data,
        )
    
    def _parse_manual_timestamp(self, value: str) -> Optional[datetime]:
        """解析手填表时间格式"""
        if not value:
            return None
        
        # 常见格式
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%d-%m-%Y",
            "%d/%m/%Y",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(value.strip(), fmt)
            except ValueError:
                continue
        
        return None


def get_parser(file_type: str) -> BaseParser:
    """根据文件类型获取解析器"""
    parsers = {
        'csv': CSVParser(),
        'gpx': GPXParser(),
        'photos': PhotoParser(),
        'photo': PhotoParser(),
        'manual': ManualParser(),
    }
    return parsers.get(file_type.lower(), BaseParser())
