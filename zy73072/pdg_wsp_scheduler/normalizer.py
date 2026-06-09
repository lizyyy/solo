import re
from typing import Optional, Dict, List
from .models import DeviceId


DEVICE_ID_PATTERN = re.compile(
    r"""
    ^\s*
    (?P<prefix>[A-Za-z]+)?
    [\-\s_]*
    (?P<area>\d{1,2})
    [\-\s_]?
    (?P<sub>[A-Za-z])?
    [\-\s_]?
    (?P<seq>\d{2,3})
    \s*$
    """,
    re.VERBOSE,
)


CANONICAL_FORMAT = "PDG-{area:02d}{sub}-{seq:03d}"
CANONICAL_FORMAT_NO_SUB = "PDG-{area:02d}-{seq:03d}"


DEVICE_ID_VARIANTS: Dict[str, List[str]] = {
    "PDG-01A-001": [
        "1A-001",
        "1A001",
        "1-A-001",
        "配电柜1号A柜001",
        "pdg_01a_001",
        "PDG 01A 001",
    ],
    "PDG-01B-002": [
        "1B-002",
        "1B002",
        "配电柜1号B柜002",
        "PDG-01B002",
    ],
    "PDG-02A-005": [
        "2A-005",
        "2A005",
        "PDG.02A.005",
        "配电柜2A-005",
    ],
    "PDG-03-012": [
        "3-012",
        "3号柜012",
        "PDG-03-12",
    ],
    "PDG-05C-099": [
        "5C-099",
        "5C099",
        "PDG05C-099",
        "配电柜5C柜099",
    ],
}


def _reverse_variant_map() -> Dict[str, str]:
    m: Dict[str, str] = {}
    for canonical, variants in DEVICE_ID_VARIANTS.items():
        for v in variants:
            m[_norm_key(v)] = canonical
        m[_norm_key(canonical)] = canonical
    return m


def _norm_key(s: str) -> str:
    return re.sub(r"[\s\-\_\.]+", "", s).upper()


_REVERSE_MAP = _reverse_variant_map()


def normalize_device_id(raw: str) -> Optional[DeviceId]:
    if not raw or not isinstance(raw, str):
        return None

    key = _norm_key(raw)
    if key in _REVERSE_MAP:
        return DeviceId(canonical=_REVERSE_MAP[key])

    m = DEVICE_ID_PATTERN.match(raw)
    if not m:
        return None

    area = int(m.group("area"))
    sub = (m.group("sub") or "").upper()
    seq = int(m.group("seq"))

    if sub:
        canonical = CANONICAL_FORMAT.format(area=area, sub=sub, seq=seq)
    else:
        canonical = CANONICAL_FORMAT_NO_SUB.format(area=area, seq=seq)

    return DeviceId(canonical=canonical)
