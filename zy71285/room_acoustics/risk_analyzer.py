"""
风险分析和监听点验证模块
"""
from dataclasses import dataclass, field
from typing import List, Tuple, Dict, Optional
from enum import Enum
import math

from .mode_calculator import RoomMode, RoomDimensions, ListeningPoint, ModeType


class RiskLevel(Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    NORMAL = "normal"
    GOOD = "good"


@dataclass
class FrequencyGap:
    start_freq: float
    end_freq: float
    gap_size: float
    risk_level: RiskLevel

    def to_dict(self):
        return {
            'start_freq': round(self.start_freq, 2),
            'end_freq': round(self.end_freq, 2),
            'gap_size': round(self.gap_size, 2),
            'risk_level': self.risk_level.value
        }


@dataclass
class ModeCluster:
    center_freq: float
    modes: List[RoomMode]
    bandwidth: float
    risk_level: RiskLevel

    def to_dict(self):
        return {
            'center_freq': round(self.center_freq, 2),
            'mode_count': len(self.modes),
            'bandwidth': round(self.bandwidth, 2),
            'risk_level': self.risk_level.value,
            'modes': [m.to_dict() for m in self.modes]
        }


@dataclass
class ListeningPointAnalysis:
    point: ListeningPoint
    is_valid: bool
    issues: List[str] = field(default_factory=list)
    mode_amplitude_factors: Dict[Tuple[int, int, int], float] = field(default_factory=dict)

    def to_dict(self):
        return {
            'point': self.point.to_dict(),
            'is_valid': self.is_valid,
            'issues': self.issues,
            'mode_amplitude_factors': {
                f"{k[0]},{k[1]},{k[2]}": round(v, 3)
                for k, v in self.mode_amplitude_factors.items()
            }
        }


class RiskAnalyzer:
    def __init__(
        self,
        critical_gap: float = 5.0,
        warning_gap: float = 10.0,
        cluster_tolerance: float = 1.0
    ):
        self.critical_gap = critical_gap
        self.warning_gap = warning_gap
        self.cluster_tolerance = cluster_tolerance

    def classify_gap_risk(self, gap_size: float) -> RiskLevel:
        if gap_size >= self.critical_gap * 4:
            return RiskLevel.CRITICAL
        elif gap_size >= self.warning_gap * 2:
            return RiskLevel.WARNING
        elif gap_size >= self.warning_gap:
            return RiskLevel.NORMAL
        else:
            return RiskLevel.GOOD

    def classify_cluster_risk(self, mode_count: int, bandwidth: float) -> RiskLevel:
        if mode_count >= 4 and bandwidth <= 5.0:
            return RiskLevel.CRITICAL
        elif mode_count >= 3 and bandwidth <= 8.0:
            return RiskLevel.WARNING
        elif mode_count >= 2 and bandwidth <= 10.0:
            return RiskLevel.NORMAL
        else:
            return RiskLevel.GOOD

    def analyze_frequency_gaps(
        self,
        modes: List[RoomMode]
    ) -> List[FrequencyGap]:
        if len(modes) < 2:
            return []

        gaps = []
        sorted_modes = sorted(modes, key=lambda m: m.frequency)

        for i in range(len(sorted_modes) - 1):
            current_freq = sorted_modes[i].frequency
            next_freq = sorted_modes[i + 1].frequency
            gap_size = next_freq - current_freq

            if gap_size >= self.warning_gap:
                risk_level = self.classify_gap_risk(gap_size)
                gaps.append(FrequencyGap(
                    start_freq=current_freq,
                    end_freq=next_freq,
                    gap_size=gap_size,
                    risk_level=risk_level
                ))

        return sorted(gaps, key=lambda g: g.gap_size, reverse=True)

    def find_mode_clusters(
        self,
        modes: List[RoomMode]
    ) -> List[ModeCluster]:
        if len(modes) < 2:
            return []

        sorted_modes = sorted(modes, key=lambda m: m.frequency)
        clusters = []
        current_cluster = [sorted_modes[0]]

        for mode in sorted_modes[1:]:
            if abs(mode.frequency - current_cluster[0].frequency) <= self.cluster_tolerance:
                current_cluster.append(mode)
            else:
                if len(current_cluster) >= 2:
                    bandwidth = current_cluster[-1].frequency - current_cluster[0].frequency
                    center_freq = (current_cluster[0].frequency + current_cluster[-1].frequency) / 2
                    risk_level = self.classify_cluster_risk(len(current_cluster), bandwidth)
                    clusters.append(ModeCluster(
                        center_freq=center_freq,
                        modes=current_cluster.copy(),
                        bandwidth=bandwidth,
                        risk_level=risk_level
                    ))
                current_cluster = [mode]

        if len(current_cluster) >= 2:
            bandwidth = current_cluster[-1].frequency - current_cluster[0].frequency
            center_freq = (current_cluster[0].frequency + current_cluster[-1].frequency) / 2
            risk_level = self.classify_cluster_risk(len(current_cluster), bandwidth)
            clusters.append(ModeCluster(
                center_freq=center_freq,
                modes=current_cluster.copy(),
                bandwidth=bandwidth,
                risk_level=risk_level
            ))

        return sorted(clusters, key=lambda c: c.bandwidth)

    def analyze_listening_point(
        self,
        point: ListeningPoint,
        room: RoomDimensions,
        modes: List[RoomMode]
    ) -> ListeningPointAnalysis:
        issues = []
        is_valid = True

        if not point.is_within_room(room):
            issues.append(f"监听点越界: 坐标 ({point.x}, {point.y}, {point.z}) 超出房间范围")
            is_valid = False

        if point.x == 0 or point.x == room.length:
            issues.append("监听点位于X方向边界，可能导致轴向模式节点问题")
        if point.y == 0 or point.y == room.width:
            issues.append("监听点位于Y方向边界，可能导致轴向模式节点问题")
        if point.z == 0 or point.z == room.height:
            issues.append("监听点位于Z方向边界，可能导致轴向模式节点问题")

        Lx, Ly, Lz = room.to_tuple()
        amplitude_factors = {}

        for mode in modes:
            nx, ny, nz = mode.nx, mode.ny, mode.nz
            px, py, pz = point.to_tuple()

            ax = math.sin(nx * math.pi * px / Lx) if nx > 0 else 1.0
            ay = math.sin(ny * math.pi * py / Ly) if ny > 0 else 1.0
            az = math.sin(nz * math.pi * pz / Lz) if nz > 0 else 1.0

            amplitude = abs(ax * ay * az)
            amplitude_factors[(nx, ny, nz)] = amplitude

            if amplitude < 0.1:
                issues.append(
                    f"模式 ({nx},{ny},{nz}) 在监听点处存在节点 (振幅={amplitude:.3f})"
                )

        return ListeningPointAnalysis(
            point=point,
            is_valid=is_valid,
            issues=issues,
            mode_amplitude_factors=amplitude_factors
        )

    def calculate_bonello_criterion(
        self,
        modes: List[RoomMode],
        max_freq: float = 200.0
    ) -> Dict[int, int]:
        band_counts = {}
        band_width = 10.0

        for mode in modes:
            band = int(mode.frequency // band_width)
            band_counts[band] = band_counts.get(band, 0) + 1

        return band_counts

    def analyze_surface_modes(
        self,
        absorption_coefficients: Dict[str, float],
        modes: List[RoomMode]
    ) -> Dict[str, List[RoomMode]]:
        surface_modes = {
            'front_back': [],
            'side_to_side': [],
            'floor_ceiling': []
        }

        for mode in modes:
            if mode.mode_type == ModeType.AXIAL:
                if mode.nx > 0 and mode.ny == 0 and mode.nz == 0:
                    surface_modes['front_back'].append(mode)
                elif mode.nx == 0 and mode.ny > 0 and mode.nz == 0:
                    surface_modes['side_to_side'].append(mode)
                elif mode.nx == 0 and mode.ny == 0 and mode.nz > 0:
                    surface_modes['floor_ceiling'].append(mode)

        return surface_modes
