import math
from typing import List, Dict, Tuple
from dataclasses import dataclass
from .parser import Weld, Probe, Echo, INCH_TO_MM


@dataclass
class Defect:
    defect_id: str
    weld_id: str
    depth_mm: float
    horizontal_position_mm: float
    amplitude: float
    echo_ids: List[str]
    probe_ids: List[str]
    severity_level: int = 0
    rule_name: str = ""


def calculate_defect_position(
    echo: Echo, probe: Probe, weld: Weld
) -> Tuple[float, float]:
    effective_tof = echo.time_of_flight - probe.wedge_delay
    # 假设时间单位是微秒，声速单位是 m/s = mm/us
    # 5900 m/s = 5.9 mm/us
    sound_path_mm = (effective_tof * probe.velocity / 1000.0) / 2

    angle_rad = math.radians(probe.angle)
    depth_mm = sound_path_mm * math.cos(angle_rad)
    horizontal_dist_mm = sound_path_mm * math.sin(angle_rad)

    scan_pos_mm = (
        echo.scan_position * INCH_TO_MM
        if echo.unit == "inch"
        else echo.scan_position
    )
    ref_point_mm = (
        probe.ref_point * INCH_TO_MM if probe.unit == "inch" else probe.ref_point
    )
    horizontal_position_mm = scan_pos_mm + ref_point_mm + horizontal_dist_mm

    return depth_mm, horizontal_position_mm


def merge_duplicate_defects(
    defects: List[Defect], tolerance_mm: float = 3.0
) -> List[Defect]:
    if not defects:
        return []

    merged: List[Defect] = []

    for defect in defects:
        found = False
        for m_defect in merged:
            if (
                m_defect.weld_id == defect.weld_id
                and abs(m_defect.depth_mm - defect.depth_mm) <= tolerance_mm
                and abs(
                    m_defect.horizontal_position_mm - defect.horizontal_position_mm
                )
                <= tolerance_mm
            ):
                m_defect.amplitude = max(m_defect.amplitude, defect.amplitude)
                m_defect.echo_ids.extend(defect.echo_ids)
                m_defect.probe_ids.extend(
                    [p for p in defect.probe_ids if p not in m_defect.probe_ids]
                )
                found = True
                break
        if not found:
            merged.append(defect)

    return merged


def process_echoes(
    echoes: List[Echo],
    welds: Dict[str, Weld],
    probes: Dict[str, Probe],
    merge_tolerance_mm: float = 3.0,
) -> List[Defect]:
    defects = []
    defect_counter = 0

    for echo in echoes:
        if echo.weld_id not in welds:
            continue
        if echo.probe_id not in probes:
            continue

        weld = welds[echo.weld_id]
        probe = probes[echo.probe_id]

        depth_mm, horz_pos_mm = calculate_defect_position(echo, probe, weld)

        defect = Defect(
            defect_id=f"DEF-{defect_counter:04d}",
            weld_id=echo.weld_id,
            depth_mm=depth_mm,
            horizontal_position_mm=horz_pos_mm,
            amplitude=echo.amplitude,
            echo_ids=[echo.echo_id],
            probe_ids=[echo.probe_id],
        )
        defects.append(defect)
        defect_counter += 1

    merged_defects = merge_duplicate_defects(defects, merge_tolerance_mm)
    return merged_defects
