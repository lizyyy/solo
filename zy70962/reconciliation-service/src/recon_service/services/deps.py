"""应用层依赖：单例仓储实例。"""
from __future__ import annotations

from .repository import BatchRepository


repo = BatchRepository()
