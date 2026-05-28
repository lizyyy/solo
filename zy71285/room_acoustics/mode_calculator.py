"""
房间模式计算核心模块
计算轴向、切向、斜向驻波模式
"""
import math
from dataclasses import dataclass, field
from typing import List, Tuple, Optional
from enum import Enum


class ModeType(Enum):
    AXIAL = "axial"
    TANGENTIAL = "tangential"
    OBLIQUE = "oblique"


@dataclass
class RoomMode:
    frequency: float
    nx: int
    ny: int
    nz: int
    mode_type: ModeType
    wavelength: float
    degeneracy: int = 1

    def __post_init__(self):
        self.mode_key = (self.nx, self.ny, self.nz)

    def to_dict(self):
        return {
            'frequency': round(self.frequency, 2),
            'nx': self.nx,
            'ny': self.ny,
            'nz': self.nz,
            'mode_type': self.mode_type.value,
            'wavelength': round(self.wavelength, 3),
            'degeneracy': self.degeneracy
        }


@dataclass
class RoomDimensions:
    length: float
    width: float
    height: float
    unit: str = "m"

    def to_tuple(self) -> Tuple[float, float, float]:
        return (self.length, self.width, self.height)

    def to_dict(self):
        return {
            'length': self.length,
            'width': self.width,
            'height': self.height,
            'unit': self.unit
        }


@dataclass
class ListeningPoint:
    x: float
    y: float
    z: float
    unit: str = "m"

    def to_tuple(self) -> Tuple[float, float, float]:
        return (self.x, self.y, self.z)

    def is_within_room(self, room: RoomDimensions) -> bool:
        return (0 <= self.x <= room.length and
                0 <= self.y <= room.width and
                0 <= self.z <= room.height)

    def to_dict(self):
        return {
            'x': self.x,
            'y': self.y,
            'z': self.z,
            'unit': self.unit
        }


class ModeCalculator:
    def __init__(self, sound_speed: float = 343.0):
        self.sound_speed = sound_speed

    def calculate_mode_frequency(
        self,
        room: RoomDimensions,
        nx: int,
        ny: int,
        nz: int
    ) -> float:
        Lx, Ly, Lz = room.to_tuple()
        term = (nx / Lx) ** 2 + (ny / Ly) ** 2 + (nz / Lz) ** 2
        return (self.sound_speed / 2.0) * math.sqrt(term)

    def determine_mode_type(self, nx: int, ny: int, nz: int) -> ModeType:
        non_zero = sum(1 for n in [nx, ny, nz] if n != 0)
        if non_zero == 1:
            return ModeType.AXIAL
        elif non_zero == 2:
            return ModeType.TANGENTIAL
        else:
            return ModeType.OBLIQUE

    def calculate_degeneracy(self, nx: int, ny: int, nz: int) -> int:
        counts = {}
        for n in [nx, ny, nz]:
            if n != 0:
                counts[n] = counts.get(n, 0) + 1
        degenerate_pairs = sum(1 for count in counts.values() if count >= 2)
        return 1 + degenerate_pairs

    def calculate_wavelength(self, frequency: float) -> float:
        return self.sound_speed / frequency if frequency > 0 else 0.0

    def calculate_all_modes(
        self,
        room: RoomDimensions,
        min_freq: float = 20.0,
        max_freq: float = 200.0
    ) -> List[RoomMode]:
        modes = []
        Lx, Ly, Lz = room.to_tuple()

        max_nx = int((2 * max_freq * Lx) / self.sound_speed) + 1
        max_ny = int((2 * max_freq * Ly) / self.sound_speed) + 1
        max_nz = int((2 * max_freq * Lz) / self.sound_speed) + 1

        for nx in range(max_nx + 1):
            for ny in range(max_ny + 1):
                for nz in range(max_nz + 1):
                    if nx == 0 and ny == 0 and nz == 0:
                        continue

                    freq = self.calculate_mode_frequency(room, nx, ny, nz)

                    if min_freq <= freq <= max_freq:
                        mode_type = self.determine_mode_type(nx, ny, nz)
                        wavelength = self.calculate_wavelength(freq)
                        degeneracy = self.calculate_degeneracy(nx, ny, nz)

                        mode = RoomMode(
                            frequency=freq,
                            nx=nx,
                            ny=ny,
                            nz=nz,
                            mode_type=mode_type,
                            wavelength=wavelength,
                            degeneracy=degeneracy
                        )
                        modes.append(mode)

        modes.sort(key=lambda m: m.frequency)
        return modes

    def find_duplicate_modes(
        self,
        modes: List[RoomMode],
        tolerance: float = 0.5
    ) -> List[Tuple[RoomMode, List[RoomMode]]]:
        duplicates = []
        used_indices = set()

        for i, mode in enumerate(modes):
            if i in used_indices:
                continue

            group = []
            for j, other in enumerate(modes[i + 1:], start=i + 1):
                if j in used_indices:
                    continue
                if abs(mode.frequency - other.frequency) <= tolerance:
                    group.append(other)
                    used_indices.add(j)

            if group:
                used_indices.add(i)
                duplicates.append((mode, group))

        return duplicates
