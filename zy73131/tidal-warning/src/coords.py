import re
from dataclasses import dataclass
from typing import Optional, Tuple


@dataclass
class CoordResult:
    normalized: Optional[str]
    source_format: str
    is_valid: bool
    issue: Optional[str] = None


DEGREE_SYMBOLS = ['°', 'º', '°', '°', '度']
MINUTE_SYMBOLS = ['分']
SECOND_SYMBOLS = ['秒']
DIR_N = ['N', 'n', '北纬', '北']
DIR_S = ['S', 's', '南纬', '南']
DIR_E = ['E', 'e', '东经', '东']
DIR_W = ['W', 'w', '西经', '西']


def _strip_dir(val: str) -> Tuple[float, Optional[str]]:
    v = val.strip()
    v = v.replace('\\"', '"').replace("\\'", "'")
    direction = None
    for d in sorted(DIR_N + DIR_S + DIR_E + DIR_W, key=len, reverse=True):
        if v.startswith(d):
            direction = d
            v = v[len(d):].strip()
            break
        if v.endswith(d):
            direction = d
            v = v[:-len(d)].strip()
            break
    for sym in DEGREE_SYMBOLS:
        v = v.replace(sym, ' ')
    for sym in MINUTE_SYMBOLS:
        v = v.replace(sym, ' ')
    for sym in SECOND_SYMBOLS:
        v = v.replace(sym, ' ')
    v = v.replace("'", ' ').replace('"', ' ').replace('′', ' ').replace('″', ' ')
    parts = re.split(r'[\s,:]+', v.strip())
    parts = [p for p in parts if p]
    try:
        deg = float(parts[0])
        minute = float(parts[1]) / 60.0 if len(parts) > 1 else 0.0
        second = float(parts[2]) / 3600.0 if len(parts) > 2 else 0.0
        total = deg + minute + second
        if direction:
            if direction in DIR_S or direction in DIR_W:
                total = -total
        return total, direction
    except (ValueError, IndexError):
        raise ValueError(f"无法解析数值: {val}")


def parse_coord(coord_str: str, coord_type: str) -> CoordResult:
    raw = coord_str.strip()
    if not raw or raw in ['-', '--', '无', '缺失', 'N/A', 'null']:
        return CoordResult(None, 'EMPTY', False, '空值或缺失标记')

    try:
        if ',' in raw and ' ' not in raw.replace(',', ''):
            return CoordResult(None, 'UNKNOWN', False, '疑似逗号分隔的经纬度对，请拆成单独字段')

        num_val, direction = _strip_dir(raw)

        if coord_type == 'lat':
            if not (-90 <= num_val <= 90):
                return CoordResult(None, 'INVALID_RANGE', False, f'纬度超出范围 [-90,90]: {num_val}')
        elif coord_type == 'lon':
            if not (-180 <= num_val <= 180):
                return CoordResult(None, 'INVALID_RANGE', False, f'经度超出范围 [-180,180]: {num_val}')

        sign_char = 'N' if coord_type == 'lat' else 'E'
        if num_val < 0:
            sign_char = 'S' if coord_type == 'lat' else 'W'
            num_val = -num_val

        deg = int(num_val)
        minute_f = (num_val - deg) * 60
        minute = int(minute_f)
        second = round((minute_f - minute) * 60, 2)

        fmt = f"{deg}°{minute:02d}′{second:05.2f}″{sign_char}"

        source_format = 'DECIMAL'
        if direction:
            source_format = f'DIR_{source_format}'
        if any(s in raw for s in DEGREE_SYMBOLS + ["'", '"', '′', '″']):
            source_format = 'DMS'
            if direction:
                source_format = f'DIR_{source_format}'

        return CoordResult(fmt, source_format, True)
    except ValueError as e:
        return CoordResult(None, 'PARSE_ERROR', False, str(e))


def format_decimal(coord_str: str, coord_type: str) -> Optional[float]:
    r = parse_coord(coord_str, coord_type)
    if not r.is_valid:
        return None
    sign = 1
    num, _ = _strip_dir(coord_str)
    return round(num, 6)
