"""脱敏引擎模块 - 一致化假值生成、敏感字段识别"""

from .engine import MaskingEngine, MaskingResult, SensitiveMatch
from .fake_generator import FakeValueGenerator

__all__ = [
    "FakeValueGenerator",
    "MaskingEngine",
    "MaskingResult",
    "SensitiveMatch",
]
