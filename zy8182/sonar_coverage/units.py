NM_TO_M = 1852.0
M_TO_NM = 1.0 / NM_TO_M
KNOTS_TO_MPS = NM_TO_M / 3600.0
MPS_TO_KNOTS = 3600.0 / NM_TO_M


def nm_to_m(nm: float) -> float:
    return nm * NM_TO_M


def m_to_nm(m: float) -> float:
    return m * M_TO_NM


def knots_to_mps(knots: float) -> float:
    return knots * KNOTS_TO_MPS


def mps_to_knots(mps: float) -> float:
    return mps * MPS_TO_KNOTS


def to_meters(value: float, unit: str) -> float:
    unit = unit.lower().strip()
    if unit in ('m', 'meter', 'meters', '米'):
        return value
    elif unit in ('nm', 'nautical mile', 'nautical miles', '海里'):
        return nm_to_m(value)
    else:
        raise ValueError(f"Unknown length unit: {unit}")


def to_knots(speed: float, unit: str) -> float:
    unit = unit.lower().strip()
    if unit in ('knots', 'kn', '节'):
        return speed
    elif unit in ('m/s', 'mps', '米/秒'):
        return mps_to_knots(speed)
    elif unit in ('km/h', 'kph', '公里/小时'):
        return speed * 1000.0 / NM_TO_M
    else:
        raise ValueError(f"Unknown speed unit: {unit}")


def to_mps(speed: float, unit: str) -> float:
    knots = to_knots(speed, unit)
    return knots_to_mps(knots)
