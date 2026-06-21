"""船上记录本解析模块.

使用标准库 csv 模块处理 CSV/TSV/TXT，支持：
- 带引号的字段（内容中包含分隔符，如"带,逗号站"）
- 多编码尝试（utf-8 / gbk / gb2312）
- 脏数据容错：解析失败的行保留原始内容，归入待补件/退回
"""

import csv
import io
import os
from typing import List, Optional, Tuple, Iterator
from .models import SamplingRecord, RecordStatus, CoordinateIssue
from .coordinates import parse_latitude, parse_longitude, detect_lat_lon_reversed


ENCODINGS = ['utf-8-sig', 'utf-8', 'gbk', 'gb2312', 'latin-1']


def _detect_encoding(filepath: str) -> str:
    """尝试多种编码读取文件，返回第一个成功的."""
    for enc in ENCODINGS:
        try:
            with open(filepath, 'r', encoding=enc) as f:
                f.read()
            return enc
        except UnicodeDecodeError:
            continue
    return 'utf-8'


def _detect_dialect(sample: str, filename: str) -> csv.Dialect:
    """检测 CSV 方言（分隔符、引号风格等）."""
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=',\t;|')
        return dialect
    except csv.Error:
        ext = os.path.splitext(filename)[1].lower()
        if ext == '.tsv':
            return csv.excel_tab
        return csv.excel


def parse_text_file(filepath: str) -> List[SamplingRecord]:
    """解析船上记录本文件.

    处理流程:
    1. 多编码尝试读取原始内容
    2. 用 csv.Sniffer 检测分隔符和方言
    3. 用 csv.reader 逐行解析（正确处理带引号的逗号）
    4. 表头映射到标准字段名
    5. 每行提取字段、解析经纬度、检测反写
    6. csv 解析失败的行，保留原始内容并标记为解析失败
    """
    records: List[SamplingRecord] = []
    filename = os.path.basename(filepath)

    encoding = _detect_encoding(filepath)

    with open(filepath, 'r', encoding=encoding, errors='replace', newline='') as f:
        raw_lines = f.readlines()

    if not raw_lines:
        return records

    raw_text = ''.join(raw_lines)
    sample_for_sniff = '\n'.join(raw_lines[:5]) if len(raw_lines) >= 5 else raw_text
    dialect = _detect_dialect(sample_for_sniff, filename)

    reader = csv.reader(io.StringIO(raw_text), dialect)

    try:
        raw_headers = next(reader)
    except StopIteration:
        return records

    headers = [h.strip() for h in raw_headers]
    header_map = _map_headers(headers)
    header_count = len(headers)

    line_tracker = _LineNumberTracker(raw_lines, start_line=2)

    for csv_row in reader:
        actual_line_num = line_tracker.next_row_line()
        original_line = line_tracker.get_last_original()

        if actual_line_num > len(raw_lines):
            actual_line_num = len(raw_lines)

        line_for_record = original_line.rstrip('\n').rstrip('\r') if original_line else ''
        if not line_for_record and (not csv_row or all(c == '' for c in csv_row)):
            continue

        if not csv_row:
            records.append(_make_parse_error_record(
                filename=filename,
                line_num=actual_line_num,
                raw_content=line_for_record,
                error_msg="CSV 行解析为空",
            ))
            continue

        if len(csv_row) != header_count:
            records.append(_make_parse_error_record(
                filename=filename,
                line_num=actual_line_num,
                raw_content=line_for_record,
                error_msg=f"字段数不匹配：表头{header_count}列，本行{len(csv_row)}列",
            ))
            continue

        fields = [f.strip() for f in csv_row]

        record_id = _get_field(fields, header_map, 'record_id', default=f"{filename}:{actual_line_num}")
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
            source_line=actual_line_num,
            raw_content=line_for_record,
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
            issue.source_line = actual_line_num
            record.coordinate_issues.append(issue)

        reversed_flag, rev_issues = detect_lat_lon_reversed(lat_val, lon_val, raw_lat, raw_lon)
        record.lat_lon_reversed = reversed_flag
        for issue in rev_issues:
            issue.source_line = actual_line_num
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


class _LineNumberTracker:
    """追踪 csv.reader 每行对应的原始行号（处理跨行字段）.

    csv.reader 可能把多行原始文本拼成一个 csv 记录（带引号的换行符字段），
    通过对比原始文本中引号的开闭状态，判断每次 reader 返回的行消耗了多少原始行。
    """

    def __init__(self, raw_lines: List[str], start_line: int = 1):
        self._lines = list(raw_lines)
        self._pos = start_line
        self._last_original = ''

    def next_row_line(self) -> int:
        """返回下一条 csv 记录起始的原始行号，并推进内部指针."""
        start_line = self._pos
        self._last_original = ''

        if self._pos > len(self._lines):
            return start_line

        in_quotes = False
        quote_char = '"'
        consumed = 0

        for i in range(self._pos - 1, len(self._lines)):
            line = self._lines[i]
            consumed += 1
            self._last_original += line

            for ch in line:
                if ch == quote_char:
                    in_quotes = not in_quotes

            if not in_quotes:
                break

        self._pos = start_line + consumed
        return start_line

    def get_last_original(self) -> str:
        """返回最后一条 csv 记录对应的原始文本（可能多行）."""
        return self._last_original


def _make_parse_error_record(filename: str, line_num: int,
                             raw_content: str, error_msg: str) -> SamplingRecord:
    """为 CSV 解析失败的行创建一条记录，归入待补件/退回.

    保留文件名、行号、原始内容，在 coordinate_issues 中追加解析失败原因。
    """
    record = SamplingRecord(
        record_id=f"{filename}:{line_num}",
        source_file=filename,
        source_line=line_num,
        raw_content=raw_content,
    )
    record.coordinate_issues.append(CoordinateIssue(
        issue_type="记录解析失败",
        description=error_msg,
        source_line=line_num,
        raw_value=raw_content,
    ))
    return record


def _map_headers(headers: List[str]) -> dict:
    """将CSV表头映射到标准字段名，按优先级第一个匹配的保留."""
    mapping = {}

    id_keywords = ['编号', 'id', '序号', '记录号', '站点编号', '站号编号']
    station_keywords = ['站点名称', '站点名', '站名', '站点', '站号', 'station', '站位']
    time_keywords = ['采样时间', '采样日期', '时间', '日期', 'time', 'date', '观测时间']
    lat_keywords = ['纬度', '北纬', '南纬', 'lat', 'latitude', 'lat.', 'lat°']
    lon_keywords = ['经度', '东经', '西经', 'lon', 'lng', 'longitude', 'lon.', 'lon°']
    depth_keywords = ['深度(m)', '深度（m）', '深度', '水深', 'depth']
    temp_keywords = ['温度(℃)', '温度（℃）', '温度', '水温', 'temp', 'temperature']
    sal_keywords = ['盐度(‰)', '盐度（‰）', '盐度', 'sal', 'salinity']

    for i, h in enumerate(headers):
        h_lower = h.lower()
        if 'record_id' not in mapping and any(k in h_lower for k in id_keywords):
            mapping['record_id'] = i
        elif 'station_name' not in mapping and any(k in h_lower for k in station_keywords):
            mapping['station_name'] = i
        elif 'sample_time' not in mapping and any(k in h_lower for k in time_keywords):
            mapping['sample_time'] = i
        elif 'latitude' not in mapping and any(k in h_lower for k in lat_keywords):
            mapping['latitude'] = i
        elif 'longitude' not in mapping and any(k in h_lower for k in lon_keywords):
            mapping['longitude'] = i
        elif 'depth' not in mapping and any(k in h_lower for k in depth_keywords):
            mapping['depth'] = i
        elif 'temperature' not in mapping and any(k in h_lower for k in temp_keywords):
            mapping['temperature'] = i
        elif 'salinity' not in mapping and any(k in h_lower for k in sal_keywords):
            mapping['salinity'] = i

    return mapping


def _get_field(fields: List[str], header_map: dict, field_name: str, default=None):
    """根据字段名获取值，超出范围返回 default."""
    if field_name in header_map:
        idx = header_map[field_name]
        if 0 <= idx < len(fields):
            val = fields[idx].strip()
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
