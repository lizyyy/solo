"""船上记录本解析模块."""

import csv
import os
from typing import List
from .models import SamplingRecord, RecordStatus, CoordinateIssue
from .coordinates import parse_latitude, parse_longitude, detect_lat_lon_reversed


def _guess_delimiter(line: str) -> str:
    """猜测CSV分隔符."""
    candidates = [',', '\t', ';', '|']
    counts = {d: line.count(d) for d in candidates}
    return max(counts, key=counts.get) if max(counts.values()) > 0 else ','


def parse_text_file(filepath: str) -> List[SamplingRecord]:
    """解析文本格式的船上记录本."""
    records = []
    filename = os.path.basename(filepath)

    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        lines = f.readlines()

    if not lines:
        return records

    delimiter = _guess_delimiter(lines[0])
    header_line = lines[0].strip()
    headers = [h.strip() for h in header_line.split(delimiter)]

    header_map = _map_headers(headers)

    for line_num, line in enumerate(lines[1:], start=2):
        line = line.rstrip('\n').rstrip('\r')
        if not line.strip():
            continue

        fields = line.split(delimiter)
        fields = [f.strip() for f in fields]

        record_id = _get_field(fields, header_map, 'record_id', default=f"{filename}:{line_num}")
        station_name = _get_field(fields, header_map, 'station_name')
        sample_time = _get_field(fields, header_map, 'sample_time')
        raw_lat = _get_field(fields, header_map, 'latitude', '')
        raw_lon = _get_field(fields, header_map, 'longitude', '')
        depth = _get_field(fields, header_map, 'depth')
        temperature = _get_field(fields, header_map, 'temperature')
        salinity = _get_field(fields, header_map, 'salinity')

        record = SamplingRecord(
            record_id=str(record_id),
            source_file=filename,
            source_line=line_num,
            raw_content=line,
            station_name=station_name,
            sample_time=sample_time,
            raw_latitude=raw_lat,
            raw_longitude=raw_lon,
        )

        lat_val, lat_issues, _ = parse_latitude(raw_lat)
        lon_val, lon_issues, _ = parse_longitude(raw_lon)

        record.latitude = lat_val
        record.longitude = lon_val

        for issue in lat_issues + lon_issues:
            issue.source_line = line_num
            record.coordinate_issues.append(issue)

        reversed_flag, rev_issues = detect_lat_lon_reversed(lat_val, lon_val, raw_lat, raw_lon)
        record.lat_lon_reversed = reversed_flag
        for issue in rev_issues:
            issue.source_line = line_num
            record.coordinate_issues.append(issue)

        try:
            record.depth = float(depth) if depth else None
        except (ValueError, TypeError):
            pass

        try:
            record.temperature = float(temperature) if temperature else None
        except (ValueError, TypeError):
            pass

        try:
            record.salinity = float(salinity) if salinity else None
        except (ValueError, TypeError):
            pass

        records.append(record)

    return records


def _map_headers(headers: List[str]) -> dict:
    """将CSV表头映射到标准字段名."""
    mapping = {}

    lat_keywords = ['纬度', 'lat', 'latitude', '北纬', '南纬']
    lon_keywords = ['经度', 'lon', 'lng', 'longitude', '东经', '西经']
    station_keywords = ['站点', '站号', 'station', '站位', '站名']
    time_keywords = ['时间', '日期', 'time', 'date', '采样时间']
    depth_keywords = ['深度', '水深', 'depth']
    temp_keywords = ['温度', '水温', 'temp', 'temperature']
    sal_keywords = ['盐度', 'sal', 'salinity']
    id_keywords = ['编号', 'id', '序号', '记录号']

    for i, h in enumerate(headers):
        h_lower = h.lower()
        if any(k in h_lower for k in id_keywords):
            mapping['record_id'] = i
        elif any(k in h_lower for k in station_keywords):
            mapping['station_name'] = i
        elif any(k in h_lower for k in time_keywords):
            mapping['sample_time'] = i
        elif any(k in h_lower for k in lat_keywords):
            mapping['latitude'] = i
        elif any(k in h_lower for k in lon_keywords):
            mapping['longitude'] = i
        elif any(k in h_lower for k in depth_keywords):
            mapping['depth'] = i
        elif any(k in h_lower for k in temp_keywords):
            mapping['temperature'] = i
        elif any(k in h_lower for k in sal_keywords):
            mapping['salinity'] = i

    return mapping


def _get_field(fields: List[str], header_map: dict, field_name: str, default=None):
    """根据字段名获取值."""
    if field_name in header_map and header_map[field_name] < len(fields):
        val = fields[header_map[field_name]]
        return val if val else default
    return default


def parse_directory(input_dir: str) -> List[SamplingRecord]:
    """解析输入目录下所有记录本文件."""
    all_records = []
    supported_extensions = ('.csv', '.txt', '.tsv')

    if not os.path.isdir(input_dir):
        raise FileNotFoundError(f"输入目录不存在: {input_dir}")

    for filename in sorted(os.listdir(input_dir)):
        if filename.startswith('.'):
            continue
        if not filename.lower().endswith(supported_extensions):
            continue
        filepath = os.path.join(input_dir, filename)
        if os.path.isfile(filepath):
            records = parse_text_file(filepath)
            all_records.extend(records)

    return all_records
