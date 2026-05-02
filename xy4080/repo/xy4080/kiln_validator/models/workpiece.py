"""作品清单和釉料数据模型"""

from typing import List, Optional

from pydantic import BaseModel, Field


class GlazeInfo(BaseModel):
    """釉料信息"""

    name: str = Field(description="釉料名称")
    maturing_temp_min_c: float = Field(description="最低成熟温度 (°C)", ge=500.0)
    maturing_temp_max_c: float = Field(description="最高成熟温度 (°C)", ge=500.0)
    notes: str = Field(default="", description="备注")

    @property
    def maturing_range_c(self) -> float:
        """成熟温区范围"""
        return self.maturing_temp_max_c - self.maturing_temp_min_c

    @property
    def optimal_maturing_temp_c(self) -> float:
        """最佳成熟温度"""
        return (self.maturing_temp_min_c + self.maturing_temp_max_c) / 2

    def is_compatible_with_peak(self, peak_temp_c: float, tolerance_c: float = 0.0) -> bool:
        """检查是否与烧成峰值温度兼容"""
        return (
            self.maturing_temp_min_c - tolerance_c
            <= peak_temp_c
            <= self.maturing_temp_max_c + tolerance_c
        )


class Workpiece(BaseModel):
    """单个作品信息"""

    id: str = Field(description="作品编号")
    name: Optional[str] = Field(default=None, description="作品名称")
    thickness_cm: float = Field(description="坯体厚度 (厘米)", gt=0.0)
    clay_type: str = Field(default="unknown", description="粘土类型")
    body_water_content_pct: float = Field(
        default=5.0,
        description="坯体含水率 (%)",
        ge=0.0,
        le=50.0,
    )

    glaze_outer: Optional[GlazeInfo] = Field(
        default=None,
        description="外层釉料",
    )
    glaze_inner: Optional[GlazeInfo] = Field(
        default=None,
        description="内层釉料",
    )

    notes: str = Field(default="", description="备注")

    @property
    def has_glaze(self) -> bool:
        return self.glaze_outer is not None or self.glaze_inner is not None

    @property
    def max_glaze_temp_c(self) -> Optional[float]:
        """釉料要求的最高温度"""
        temps = []
        if self.glaze_outer:
            temps.append(self.glaze_outer.maturing_temp_max_c)
        if self.glaze_inner:
            temps.append(self.glaze_inner.maturing_temp_max_c)
        return max(temps) if temps else None

    @property
    def min_glaze_temp_c(self) -> Optional[float]:
        """釉料要求的最低温度"""
        temps = []
        if self.glaze_outer:
            temps.append(self.glaze_outer.maturing_temp_min_c)
        if self.glaze_inner:
            temps.append(self.glaze_inner.maturing_temp_min_c)
        return min(temps) if temps else None

    def get_all_glazes(self) -> List[GlazeInfo]:
        """获取所有釉料"""
        glazes = []
        if self.glaze_outer:
            glazes.append(self.glaze_outer)
        if self.glaze_inner:
            glazes.append(self.glaze_inner)
        return glazes


class WorkpieceList(BaseModel):
    """作品清单"""

    workpieces: List[Workpiece] = Field(description="作品列表")

    @property
    def count(self) -> int:
        return len(self.workpieces)

    @property
    def max_thickness_cm(self) -> float:
        """最大坯体厚度"""
        if not self.workpieces:
            return 0.0
        return max(w.thickness_cm for w in self.workpieces)

    @property
    def min_thickness_cm(self) -> float:
        """最小坯体厚度"""
        if not self.workpieces:
            return 0.0
        return min(w.thickness_cm for w in self.workpieces)

    def get_by_thickness_range(self, min_cm: float, max_cm: float) -> List[Workpiece]:
        """按厚度范围筛选作品"""
        return [
            w for w in self.workpieces if min_cm <= w.thickness_cm <= max_cm
        ]

    def get_glazed_workpieces(self) -> List[Workpiece]:
        """获取所有带釉作品"""
        return [w for w in self.workpieces if w.has_glaze]

    def get_glaze_temp_range(self) -> Optional[tuple[float, float]]:
        """
        获取所有釉料要求的温度范围
        
        Returns:
            (最低要求温度, 最高要求温度)，如果无釉料返回None
        """
        glazed = self.get_glazed_workpieces()
        if not glazed:
            return None

        all_mins = []
        all_maxes = []
        for w in glazed:
            if w.min_glaze_temp_c is not None:
                all_mins.append(w.min_glaze_temp_c)
            if w.max_glaze_temp_c is not None:
                all_maxes.append(w.max_glaze_temp_c)

        if not all_mins or not all_maxes:
            return None

        return (min(all_mins), max(all_maxes))
