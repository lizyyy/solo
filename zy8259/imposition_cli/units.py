import re
from typing import Union, Tuple
from dataclasses import dataclass


@dataclass(frozen=True)
class Dimension:
    value_mm: float
    
    @classmethod
    def parse(cls, value: Union[str, int, float]) -> 'Dimension':
        if isinstance(value, (int, float)):
            return cls(float(value))
        
        value = str(value).strip().lower()
        
        if value.endswith('mm'):
            num_part = value[:-2]
        elif value.endswith('cm'):
            num_part = value[:-2]
            multiplier = 10.0
        else:
            num_part = value
            multiplier = 1.0
        
        try:
            num = float(num_part)
        except ValueError:
            raise ValueError(f"无法解析尺寸值: {value}")
        
        if value.endswith('cm'):
            return cls(num * 10.0)
        else:
            return cls(num)
    
    def to_mm(self) -> float:
        return self.value_mm
    
    def to_cm(self) -> float:
        return self.value_mm / 10.0
    
    def to_str(self, unit: str = 'mm') -> str:
        if unit == 'mm':
            return f"{self.value_mm}mm"
        elif unit == 'cm':
            return f"{self.value_mm / 10.0}cm"
        else:
            raise ValueError(f"不支持的单位: {unit}")
    
    def __add__(self, other: 'Dimension') -> 'Dimension':
        return Dimension(self.value_mm + other.value_mm)
    
    def __sub__(self, other: 'Dimension') -> 'Dimension':
        return Dimension(self.value_mm - other.value_mm)
    
    def __mul__(self, factor: float) -> 'Dimension':
        return Dimension(self.value_mm * factor)
    
    def __truediv__(self, divisor: float) -> 'Dimension':
        return Dimension(self.value_mm / divisor)
    
    def __lt__(self, other: 'Dimension') -> bool:
        return self.value_mm < other.value_mm
    
    def __le__(self, other: 'Dimension') -> bool:
        return self.value_mm <= other.value_mm
    
    def __gt__(self, other: 'Dimension') -> bool:
        return self.value_mm > other.value_mm
    
    def __ge__(self, other: 'Dimension') -> bool:
        return self.value_mm >= other.value_mm
    
    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Dimension):
            return False
        return abs(self.value_mm - other.value_mm) < 0.001
    
    def __repr__(self) -> str:
        return f"Dimension({self.value_mm}mm)"


@dataclass(frozen=True)
class Size:
    width: Dimension
    height: Dimension
    
    @classmethod
    def parse(cls, width: Union[str, int, float], height: Union[str, int, float]) -> 'Size':
        return cls(
            width=Dimension.parse(width),
            height=Dimension.parse(height)
        )
    
    def area(self) -> float:
        return self.width.to_mm() * self.height.to_mm()
    
    def can_contain(self, other: 'Size', with_rotation: bool = True) -> bool:
        if self.width >= other.width and self.height >= other.height:
            return True
        if with_rotation and self.width >= other.height and self.height >= other.width:
            return True
        return False
    
    def rotate(self) -> 'Size':
        return Size(width=self.height, height=self.width)
    
    def get_max_dimension(self) -> Dimension:
        return self.width if self.width >= self.height else self.height
    
    def get_min_dimension(self) -> Dimension:
        return self.height if self.width >= self.height else self.width
    
    def __repr__(self) -> str:
        return f"Size({self.width.to_mm()}mm x {self.height.to_mm()}mm)"


def parse_size_with_bleed(
    width: Union[str, int, float],
    height: Union[str, int, float],
    bleed: Union[str, int, float]
) -> Size:
    base_width = Dimension.parse(width)
    base_height = Dimension.parse(height)
    bleed_dim = Dimension.parse(bleed)
    
    return Size(
        width=base_width + bleed_dim * 2,
        height=base_height + bleed_dim * 2
    )


def format_imposition_count(count: int) -> str:
    if count == 1:
        return "自翻版"
    elif count == 2:
        return "对开"
    elif count == 4:
        return "4开"
    elif count == 8:
        return "8开"
    elif count == 16:
        return "16开"
    elif count == 32:
        return "32开"
    elif count == 64:
        return "64开"
    else:
        return f"{count}拼"
