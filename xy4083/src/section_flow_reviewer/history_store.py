"""历史存储模块 - 断面数据存储、历史对比功能"""

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from .models import (
    FlowResult,
    HistoricalComparison,
    MeasuringPoint,
    SectionData,
)


class HistoryStore:
    """历史数据存储器"""

    def __init__(self, store_path: Optional[Path] = None):
        """
        初始化历史数据存储器

        Args:
            store_path: 存储目录路径，默认为当前目录下的 .flow_history
        """
        if store_path is None:
            store_path = Path.cwd() / ".flow_history"
        
        self.store_path = store_path
        self.sections_dir = store_path / "sections"
        self.results_dir = store_path / "results"
        self.index_file = store_path / "index.json"
        
        self._ensure_directories()
        self._index: Dict[str, Any] = self._load_index()

    def _ensure_directories(self) -> None:
        """确保存储目录存在"""
        self.sections_dir.mkdir(parents=True, exist_ok=True)
        self.results_dir.mkdir(parents=True, exist_ok=True)

    def _load_index(self) -> Dict[str, Any]:
        """加载索引文件"""
        if self.index_file.exists():
            try:
                with open(self.index_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                return self._get_default_index()
        return self._get_default_index()

    def _get_default_index(self) -> Dict[str, Any]:
        """获取默认索引结构"""
        return {
            "sections": [],
            "results": [],
            "last_updated": None,
        }

    def _save_index(self) -> None:
        """保存索引文件"""
        self._index["last_updated"] = datetime.now().isoformat()
        with open(self.index_file, "w", encoding="utf-8") as f:
            json.dump(self._index, f, ensure_ascii=False, indent=2)

    def _section_to_dict(self, section: SectionData) -> Dict[str, Any]:
        """将断面数据转换为可序列化的字典"""
        points_dict = []
        for p in section.measuring_points:
            points_dict.append({
                "id": p.id,
                "distance_from_left": p.distance_from_left,
                "water_depth": p.water_depth,
                "velocity": p.velocity,
                "velocity_depth_ratio": p.velocity_depth_ratio,
                "is_edge": p.is_edge,
                "notes": p.notes,
            })

        return {
            "section_id": section.section_id,
            "section_name": section.section_name,
            "measurement_date": section.measurement_date.isoformat(),
            "measuring_points": points_dict,
            "river_width": section.river_width,
            "max_depth": section.max_depth,
            "temperature": section.temperature,
            "weather": section.weather,
            "operator": section.operator,
            "instrument_id": section.instrument_id,
            "notes": section.notes,
            "unit": section.unit.value,
        }

    def _result_to_dict(self, result: FlowResult) -> Dict[str, Any]:
        """将计算结果转换为可序列化的字典"""
        segments_dict = []
        for s in result.segment_results:
            segments_dict.append({
                "segment_id": s.segment_id,
                "start_distance": s.start_distance,
                "end_distance": s.end_distance,
                "width": s.width,
                "average_depth": s.average_depth,
                "average_velocity": s.average_velocity,
                "area": s.area,
                "discharge": s.discharge,
                "left_point_id": s.left_point_id,
                "right_point_id": s.right_point_id,
            })

        uncertainty_dict = None
        if result.uncertainty:
            sources_dict = []
            for su in result.uncertainty.source_uncertainties:
                sources_dict.append({
                    "source": su.source,
                    "standard_uncertainty": su.standard_uncertainty,
                    "sensitivity_coefficient": su.sensitivity_coefficient,
                    "contribution": su.contribution,
                    "relative_contribution": su.relative_contribution,
                })
            
            uncertainty_dict = {
                "combined_uncertainty": result.uncertainty.combined_uncertainty,
                "relative_uncertainty": result.uncertainty.relative_uncertainty,
                "expanded_uncertainty": result.uncertainty.expanded_uncertainty,
                "coverage_factor": result.uncertainty.coverage_factor,
                "source_uncertainties": sources_dict,
            }

        return {
            "section_id": result.section_id,
            "calculation_date": result.calculation_date.isoformat(),
            "method": result.method.value,
            "total_discharge": result.total_discharge,
            "total_area": result.total_area,
            "average_velocity": result.average_velocity,
            "max_velocity": result.max_velocity,
            "river_width": result.river_width,
            "max_depth": result.max_depth,
            "segment_results": segments_dict,
            "uncertainty": uncertainty_dict,
        }

    def save_section(self, section: SectionData) -> Path:
        """
        保存断面数据到历史存储

        Args:
            section: 断面数据

        Returns:
            Path: 保存的文件路径
        """
        filename = f"{section.section_id}_{section.measurement_date.strftime('%Y%m%d_%H%M%S')}.json"
        file_path = self.sections_dir / filename

        data = self._section_to_dict(section)

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        # 更新索引
        section_info = {
            "section_id": section.section_id,
            "measurement_date": section.measurement_date.isoformat(),
            "file_path": str(file_path),
            "point_count": len(section.measuring_points),
            "river_width": section.river_width,
            "max_depth": section.max_depth,
        }

        # 检查是否已存在相同ID和日期的记录
        existing_idx = None
        for i, info in enumerate(self._index["sections"]):
            if (
                info["section_id"] == section.section_id
                and info["measurement_date"] == section_info["measurement_date"]
            ):
                existing_idx = i
                break

        if existing_idx is not None:
            self._index["sections"][existing_idx] = section_info
        else:
            self._index["sections"].append(section_info)

        # 按测量日期排序
        self._index["sections"].sort(key=lambda x: x["measurement_date"], reverse=True)

        self._save_index()

        return file_path

    def save_result(self, result: FlowResult, section_id: Optional[str] = None) -> Path:
        """
        保存计算结果到历史存储

        Args:
            result: 计算结果
            section_id: 关联的断面ID（可选，默认使用result中的section_id）

        Returns:
            Path: 保存的文件路径
        """
        actual_section_id = section_id or result.section_id
        filename = f"{actual_section_id}_{result.calculation_date.strftime('%Y%m%d_%H%M%S')}_result.json"
        file_path = self.results_dir / filename

        data = self._result_to_dict(result)

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        # 更新索引
        result_info = {
            "section_id": actual_section_id,
            "calculation_date": result.calculation_date.isoformat(),
            "file_path": str(file_path),
            "method": result.method.value,
            "total_discharge": result.total_discharge,
            "total_area": result.total_area,
            "average_velocity": result.average_velocity,
        }

        self._index["results"].append(result_info)
        self._index["results"].sort(key=lambda x: x["calculation_date"], reverse=True)

        self._save_index()

        return file_path

    def get_section_history(self, section_id: str) -> List[Dict[str, Any]]:
        """
        获取指定断面的历史记录

        Args:
            section_id: 断面编号

        Returns:
            List[Dict]: 该断面的历史记录列表，按时间降序排列
        """
        return [
            info for info in self._index["sections"]
            if info["section_id"] == section_id
        ]

    def get_all_sections(self) -> List[Dict[str, Any]]:
        """
        获取所有断面的索引信息

        Returns:
            List[Dict]: 所有断面索引列表
        """
        return self._index["sections"].copy()

    def get_all_results(self) -> List[Dict[str, Any]]:
        """
        获取所有计算结果的索引信息

        Returns:
            List[Dict]: 所有结果索引列表
        """
        return self._index["results"].copy()

    def load_section(self, file_path: str) -> Optional[SectionData]:
        """
        从文件加载断面数据

        Args:
            file_path: 文件路径

        Returns:
            Optional[SectionData]: 断面数据，加载失败返回None
        """
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            points = []
            for pd in data.get("measuring_points", []):
                points.append(MeasuringPoint(
                    id=pd["id"],
                    distance_from_left=pd["distance_from_left"],
                    water_depth=pd["water_depth"],
                    velocity=pd["velocity"],
                    velocity_depth_ratio=pd.get("velocity_depth_ratio", 0.6),
                    is_edge=pd.get("is_edge", False),
                    notes=pd.get("notes"),
                ))

            section = SectionData(
                section_id=data["section_id"],
                section_name=data.get("section_name"),
                measurement_date=datetime.fromisoformat(data["measurement_date"]),
                measuring_points=points,
                river_width=data.get("river_width"),
                max_depth=data.get("max_depth"),
                temperature=data.get("temperature"),
                weather=data.get("weather"),
                operator=data.get("operator"),
                instrument_id=data.get("instrument_id"),
                notes=data.get("notes"),
                unit=data.get("unit", "metric"),
            )

            return section

        except (json.JSONDecodeError, IOError, KeyError, ValueError) as e:
            return None


class HistoricalComparer:
    """历史断面对比器"""

    @staticmethod
    def compare(
        current: SectionData,
        historical: SectionData,
        current_result: Optional[FlowResult] = None,
        historical_result: Optional[FlowResult] = None,
    ) -> HistoricalComparison:
        """
        对比两个断面

        Args:
            current: 当前断面数据
            historical: 历史断面数据
            current_result: 当前断面计算结果（可选）
            historical_result: 历史断面计算结果（可选）

        Returns:
            HistoricalComparison: 对比结果
        """
        discharge_diff = 0.0
        discharge_diff_pct = 0.0
        area_diff = None
        area_diff_pct = None
        velocity_diff = None
        velocity_diff_pct = None

        # 如果有计算结果，使用结果进行对比
        if current_result and historical_result:
            discharge_diff = current_result.total_discharge - historical_result.total_discharge
            if historical_result.total_discharge > 0:
                discharge_diff_pct = (discharge_diff / historical_result.total_discharge) * 100

            area_diff = current_result.total_area - historical_result.total_area
            if historical_result.total_area > 0:
                area_diff_pct = (area_diff / historical_result.total_area) * 100

            velocity_diff = current_result.average_velocity - historical_result.average_velocity
            if historical_result.average_velocity > 0:
                velocity_diff_pct = (velocity_diff / historical_result.average_velocity) * 100

        # 计算断面形态差异指数
        profile_diff = HistoricalComparer._calculate_profile_difference(current, historical)

        return HistoricalComparison(
            current_section_id=current.section_id,
            historical_section_id=historical.section_id,
            discharge_difference=round(discharge_diff, 4),
            discharge_difference_percent=round(discharge_diff_pct, 2),
            area_difference=round(area_diff, 4) if area_diff is not None else None,
            area_difference_percent=round(area_diff_pct, 2) if area_diff_pct is not None else None,
            velocity_difference=round(velocity_diff, 4) if velocity_diff is not None else None,
            velocity_difference_percent=round(velocity_diff_pct, 2) if velocity_diff_pct is not None else None,
            depth_profile_difference=round(profile_diff, 4) if profile_diff is not None else None,
        )

    @staticmethod
    def _calculate_profile_difference(
        section1: SectionData,
        section2: SectionData,
    ) -> Optional[float]:
        """
        计算两个断面的形态差异指数

        方法：
        1. 将两个断面标准化到相同的宽度
        2. 在相同的相对位置插值水深
        3. 计算水深差异的平方和或平均绝对差异

        Args:
            section1: 第一个断面
            section2: 第二个断面

        Returns:
            Optional[float]: 形态差异指数，值越大差异越大
        """
        points1 = section1.measuring_points
        points2 = section2.measuring_points

        if len(points1) < 2 or len(points2) < 2:
            return None

        # 获取两个断面的河宽
        width1 = max(p.distance_from_left for p in points1)
        width2 = max(p.distance_from_left for p in points2)

        if width1 <= 0 or width2 <= 0:
            return None

        # 提取两个断面的水深剖面
        x1 = np.array([p.distance_from_left / width1 for p in points1])  # 相对位置
        h1 = np.array([p.water_depth for p in points1])

        x2 = np.array([p.distance_from_left / width2 for p in points2])
        h2 = np.array([p.water_depth for p in points2])

        # 生成共同的相对位置点
        common_x = np.linspace(0, 1, max(len(points1), len(points2), 50))

        # 插值
        try:
            from scipy import interpolate
            f1 = interpolate.interp1d(x1, h1, kind="linear", fill_value="extrapolate")
            f2 = interpolate.interp1d(x2, h2, kind="linear", fill_value="extrapolate")

            h1_interp = f1(common_x)
            h2_interp = f2(common_x)

        except ImportError:
            # 如果没有 scipy，使用简单的最近邻插值
            h1_interp = HistoricalComparer._simple_interpolate(x1, h1, common_x)
            h2_interp = HistoricalComparer._simple_interpolate(x2, h2, common_x)

        # 计算差异
        # 归一化水深，使最大水深为1
        max_h1 = np.max(h1_interp) if np.max(h1_interp) > 0 else 1
        max_h2 = np.max(h2_interp) if np.max(h2_interp) > 0 else 1

        h1_norm = h1_interp / max_h1
        h2_norm = h2_interp / max_h2

        # 计算平均绝对差异
        mae = np.mean(np.abs(h1_norm - h2_norm))

        return float(mae)

    @staticmethod
    def _simple_interpolate(x: np.ndarray, y: np.ndarray, xi: np.ndarray) -> np.ndarray:
        """简单的线性插值（当scipy不可用时）"""
        yi = np.zeros_like(xi)

        for i, target_x in enumerate(xi):
            # 找到最接近的点
            idx = np.searchsorted(x, target_x)
            if idx == 0:
                yi[i] = y[0]
            elif idx >= len(x):
                yi[i] = y[-1]
            else:
                # 线性插值
                x0, x1 = x[idx - 1], x[idx]
                y0, y1 = y[idx - 1], y[idx]
                if x1 - x0 > 0:
                    yi[i] = y0 + (y1 - y0) * (target_x - x0) / (x1 - x0)
                else:
                    yi[i] = y0

        return yi

    @staticmethod
    def compare_multiple(
        current: SectionData,
        historical_list: List[SectionData],
        current_result: Optional[FlowResult] = None,
        historical_results: Optional[List[FlowResult]] = None,
    ) -> List[HistoricalComparison]:
        """
        比较当前断面与多个历史断面

        Args:
            current: 当前断面
            historical_list: 历史断面列表
            current_result: 当前断面计算结果
            historical_results: 历史断面计算结果列表（顺序应与historical_list对应）

        Returns:
            List[HistoricalComparison]: 对比结果列表
        """
        comparisons = []

        for i, historical in enumerate(historical_list):
            hist_result = historical_results[i] if historical_results and i < len(historical_results) else None
            comparison = HistoricalComparer.compare(
                current, historical, current_result, hist_result
            )
            comparisons.append(comparison)

        return comparisons
