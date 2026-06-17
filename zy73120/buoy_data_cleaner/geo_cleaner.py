import re
from typing import Optional, Tuple


def _normalize_str(s: str) -> str:
    if s is None:
        return ""
    s = s.strip()
    s = re.sub(r"度", "°", s)
    s = re.sub(r"分", "'", s)
    s = re.sub(r"秒", '"', s)
    s = re.sub(r"(\d)。(\d)", r"\1°\2", s)
    s = s.replace("，", ",").replace("。", ".").replace("：", ":")
    s = s.replace("°", "°").replace("′", "'").replace("″", '"')
    s = s.replace("＇", "'").replace("＂", '"')
    s = s.replace(" ", "")
    return s


_DIRECTION_MAP = {
    "N": 1, "S": -1, "E": 1, "W": -1,
    "北": 1, "南": -1, "东": 1, "西": -1,
}


def parse_coordinate(raw: str, is_lat: bool) -> Optional[float]:
    s = _normalize_str(raw)
    if not s:
        return None

    direction = 1
    for ch, sign in _DIRECTION_MAP.items():
        if ch in s.upper() or ch in s:
            direction = sign
            s = s.replace(ch, "").replace(ch.upper(), "")
            break

    if not s:
        return None

    m = re.match(r"^(\d+(?:\.\d+)?)°(\d+(?:\.\d+)?)?'?(\d+(?:\.\d+)?)?\"?$", s)
    if m:
        deg = float(m.group(1))
        minute = float(m.group(2)) if m.group(2) else 0.0
        second = float(m.group(3)) if m.group(3) else 0.0
        val = deg + minute / 60.0 + second / 3600.0
    else:
        m = re.match(r"^(\d+(?:\.\d+)?)°(\d+(?:\.\d+)?)?\"?(\d+(?:\.\d+)?)?'?$", s)
        if m:
            deg = float(m.group(1))
            minute = float(m.group(3)) if m.group(3) else 0.0
            second = float(m.group(2)) if m.group(2) else 0.0
            val = deg + minute / 60.0 + second / 3600.0
        else:
            m = re.match(r"^(\d+(?:\.\d+)?)°(\d+(?:\.\d+)?)'$", s)
            if m:
                deg = float(m.group(1))
                minute = float(m.group(2))
                val = deg + minute / 60.0
            else:
                m = re.match(r"^-?\d+(?:\.\d+)?$", s)
                if not m:
                    return None
                val = abs(float(s))
                if float(s) < 0:
                    direction *= -1

    if is_lat:
        if val < 0 or val > 90:
            return None
    else:
        if val < 0 or val > 180:
            return None

    return round(val * direction, 6)


def standardize_record(record) -> Tuple[Optional[float], Optional[float]]:
    lat = parse_coordinate(record.latitude_raw, is_lat=True)
    lon = parse_coordinate(record.longitude_raw, is_lat=False)
    return lat, lon
