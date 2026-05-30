"""窗口管理模块。

提供靠泊窗口的筛选、排序、冲突检测、时间轴导出和报告生成功能。
支持批量操作，确保筛选、导出、报告生成时的一致性。
"""

from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, List, Optional, Union

import pytz

from .calculator import SafetyCalculator, SafetyThreshold
from .exceptions import TideBerthException
from .models import (
    Berth,
    BerthWindow,
    SafetyCheckResult,
    Ship,
    TideCurve,
    WindForecast,
)


@dataclass
class WindowFilter:
    """窗口筛选条件。

    所有筛选条件都是可选的，未设置的条件不参与筛选。
    """

    ship_imo: Optional[str] = None
    ship_name: Optional[str] = None
    berth_id: Optional[str] = None
    start_after: Optional[datetime] = None
    start_before: Optional[datetime] = None
    min_duration_minutes: Optional[int] = None
    max_duration_minutes: Optional[int] = None
    min_depth_margin: Optional[float] = None
    max_wind_speed: Optional[float] = None
    min_confidence: Optional[float] = None
    exclude_conflicts: bool = False
    exclude_warnings: bool = False

    def matches(self, window: BerthWindow) -> bool:
        """检查窗口是否满足筛选条件。"""
        if self.ship_imo and window.ship.imo != self.ship_imo:
            return False
        if self.ship_name and window.ship.name != self.ship_name:
            return False
        if self.berth_id and window.berth.berth_id != self.berth_id:
            return False
        if self.start_after and window.start_time < self.start_after:
            return False
        if self.start_before and window.start_time > self.start_before:
            return False
        if self.min_duration_minutes and window.duration_minutes < self.min_duration_minutes:
            return False
        if self.max_duration_minutes and window.duration_minutes > self.max_duration_minutes:
            return False
        if self.min_depth_margin and window.min_depth_margin < self.min_depth_margin:
            return False
        if self.max_wind_speed and window.max_wind_speed > self.max_wind_speed:
            return False
        if self.min_confidence and window.confidence < self.min_confidence:
            return False
        if self.exclude_conflicts:
            if any("冲突" in note.content for note in window.notes):
                return False
        if self.exclude_warnings:
            if any(result.warnings for result in window.check_results):
                return False
        return True


class WindowManager:
    """靠泊窗口管理器。

    提供窗口的筛选、排序、导出、报告等功能。
    所有批量操作使用相同的配置，确保一致性。
    """

    def __init__(self, calculator: Optional[SafetyCalculator] = None) -> None:
        self.calculator = calculator or SafetyCalculator()
        self.windows: List[BerthWindow] = []
        self.processing_errors: List[TideBerthException] = []

    def add_windows(self, windows: List[BerthWindow]) -> None:
        """添加窗口到管理器。"""
        self.windows.extend(windows)
        # 重新检测冲突
        self.calculator._detect_conflicts(self.windows)

    def clear(self) -> None:
        """清空所有窗口。"""
        self.windows.clear()
        self.processing_errors.clear()

    def filter(self, filter_obj: WindowFilter) -> List[BerthWindow]:
        """筛选窗口。

        参数:
            filter_obj: 筛选条件

        返回:
            满足条件的窗口列表（按开始时间排序）
        """
        results = [w for w in self.windows if filter_obj.matches(w)]
        return sorted(results, key=lambda w: w.start_time)

    def sort(self, windows: Optional[List[BerthWindow]] = None,
             key: str = "start_time", reverse: bool = False) -> List[BerthWindow]:
        """排序窗口。

        参数:
            windows: 待排序的窗口，None表示使用所有窗口
            key: 排序键: start_time, end_time, duration, depth_margin, wind_speed, confidence
            reverse: 是否降序
        """
        target = windows if windows is not None else self.windows

        key_map: Dict[str, Callable[[BerthWindow], Any]] = {
            "start_time": lambda w: w.start_time,
            "end_time": lambda w: w.end_time,
            "duration": lambda w: w.duration_minutes,
            "depth_margin": lambda w: w.min_depth_margin,
            "wind_speed": lambda w: w.max_wind_speed,
            "confidence": lambda w: w.confidence,
            "ship_name": lambda w: w.ship.name,
            "berth_id": lambda w: w.berth.berth_id,
        }

        if key not in key_map:
            raise ValueError(f"不支持的排序键: {key}，支持: {list(key_map.keys())}")

        return sorted(target, key=key_map[key], reverse=reverse)

    def batch_process(
        self,
        jobs: List[Dict[str, Any]],
        filter_obj: Optional[WindowFilter] = None,
        sort_key: str = "start_time",
    ) -> List[BerthWindow]:
        """批量处理多个作业。

        参数:
            jobs: 作业列表，每个作业是包含以下键的字典:
                - start_time: datetime
                - end_time: datetime
                - ship: Ship
                - berth: Berth
                - tide_curve: TideCurve
                - wind_forecast: WindForecast
                - notes: Optional[List[ScheduleNote]]
            filter_obj: 可选的筛选条件
            sort_key: 排序键

        返回:
            处理后的窗口列表

        一致性保证:
            - 所有作业使用相同的计算器阈值
            - 冲突检测在所有作业完成后统一进行
            - 筛选和排序使用相同的规则
        """
        self.processing_errors.clear()
        all_windows: List[BerthWindow] = []

        for i, job in enumerate(jobs):
            try:
                windows = self.calculator.find_windows(
                    start_time=job["start_time"],
                    end_time=job["end_time"],
                    ship=job["ship"],
                    berth=job["berth"],
                    tide_curve=job["tide_curve"],
                    wind_forecast=job["wind_forecast"],
                    notes=job.get("notes"),
                )
                all_windows.extend(windows)
            except TideBerthException as e:
                self.processing_errors.append(e)
                continue
            except Exception as e:
                wrapped = TideBerthException(
                    f"批量处理作业 {i+1} 时出错: {str(e)}",
                    source_file=getattr(job["ship"].version, "source_file", "unknown"),
                    object_id=f"job_{i+1}_ship={job['ship'].imo or job['ship'].name}_berth={job['berth'].berth_id}",
                    details={"error_type": type(e).__name__, "job_index": i},
                )
                self.processing_errors.append(wrapped)
                continue

        # 统一检测冲突
        self.calculator._detect_conflicts(all_windows)

        # 筛选
        if filter_obj:
            all_windows = [w for w in all_windows if filter_obj.matches(w)]

        # 排序
        all_windows = self.sort(all_windows, key=sort_key)

        self.windows = all_windows
        return all_windows

    # ========== 时间轴导出 ==========

    def export_timeline_json(self, windows: Optional[List[BerthWindow]] = None,
                             filepath: Optional[str] = None) -> str:
        """导出时间轴数据为JSON格式。

        可用于前端可视化或导入其他系统。
        """
        target = windows if windows is not None else self.windows

        timeline_data = {
            "generated_at": datetime.now(pytz.UTC).isoformat(),
            "threshold": {
                "under_keel_margin": self.calculator.threshold.under_keel_margin,
                "wind_limit_default": self.calculator.threshold.wind_limit_default,
                "min_window_minutes": self.calculator.threshold.min_window_minutes,
            },
            "windows": []
        }

        for window in target:
            window_data = {
                "window_id": window.window_id,
                "ship": {
                    "imo": window.ship.imo,
                    "name": window.ship.name,
                    "draft": window.ship.draft,
                    "length": window.ship.length,
                },
                "berth": {
                    "berth_id": window.berth.berth_id,
                    "name": window.berth.name,
                    "design_depth": window.berth.design_depth,
                },
                "start_time": window.start_time.isoformat(),
                "end_time": window.end_time.isoformat(),
                "duration_minutes": window.duration_minutes,
                "min_depth_margin": round(window.min_depth_margin, 2),
                "max_wind_speed": round(window.max_wind_speed, 1),
                "confidence": window.confidence,
                "notes": [
                    {
                        "content": note.content,
                        "priority": note.priority,
                        "time": note.time.isoformat(),
                    }
                    for note in window.notes
                ],
            }
            timeline_data["windows"].append(window_data)

        json_str = json.dumps(timeline_data, ensure_ascii=False, indent=2)

        if filepath:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(json_str)

        return json_str

    def export_timeline_csv(self, windows: Optional[List[BerthWindow]] = None,
                            filepath: Optional[str] = None) -> str:
        """导出时间轴数据为CSV格式。"""
        target = windows if windows is not None else self.windows

        rows = []
        headers = [
            "window_id", "ship_imo", "ship_name", "ship_draft",
            "berth_id", "berth_name", "berth_depth",
            "start_time", "end_time", "duration_minutes",
            "min_depth_margin", "max_wind_speed", "confidence",
            "has_conflict", "notes",
        ]

        for window in target:
            has_conflict = any("冲突" in note.content for note in window.notes)
            notes_text = "; ".join([note.content for note in window.notes])

            rows.append({
                "window_id": window.window_id,
                "ship_imo": window.ship.imo,
                "ship_name": window.ship.name,
                "ship_draft": round(window.ship.draft, 2),
                "berth_id": window.berth.berth_id,
                "berth_name": window.berth.name,
                "berth_depth": round(window.berth.design_depth, 2),
                "start_time": window.start_time.strftime("%Y-%m-%d %H:%M:%S"),
                "end_time": window.end_time.strftime("%Y-%m-%d %H:%M:%S"),
                "duration_minutes": window.duration_minutes,
                "min_depth_margin": round(window.min_depth_margin, 2),
                "max_wind_speed": round(window.max_wind_speed, 1),
                "confidence": round(window.confidence, 2),
                "has_conflict": "是" if has_conflict else "否",
                "notes": notes_text,
            })

        csv_lines = [",".join(headers)]
        for row in rows:
            csv_lines.append(",".join([str(row[h]) for h in headers]))

        csv_str = "\n".join(csv_lines)

        if filepath:
            with open(filepath, "w", encoding="utf-8-sig") as f:
                f.write(csv_str)

        return csv_str

    def export_detail_checks(self, window: BerthWindow, filepath: Optional[str] = None) -> str:
        """导出窗口的详细校验数据（逐时间点）。"""
        rows = []
        headers = [
            "time", "is_safe",
            "tide_level", "tide_uncertainty",
            "available_depth", "required_depth", "depth_margin",
            "wind_speed", "wind_gust", "wind_limit", "wind_margin",
            "draft_check", "wind_check",
            "errors", "warnings",
        ]

        for result in window.check_results:
            rows.append({
                "time": result.time.strftime("%Y-%m-%d %H:%M:%S"),
                "is_safe": "是" if result.is_safe else "否",
                "tide_level": round(result.tide_level, 2),
                "tide_uncertainty": round(result.tide_uncertainty, 2),
                "available_depth": round(result.available_depth, 2),
                "required_depth": round(result.required_depth, 2),
                "depth_margin": round(result.depth_margin, 2),
                "wind_speed": round(result.wind_speed, 1),
                "wind_gust": round(result.wind_gust, 1) if result.wind_gust else "",
                "wind_limit": round(result.wind_limit, 1),
                "wind_margin": round(result.wind_margin, 1),
                "draft_check": "通过" if result.draft_check else "不通过",
                "wind_check": "通过" if result.wind_check else "不通过",
                "errors": "; ".join(result.errors),
                "warnings": "; ".join(result.warnings),
            })

        csv_lines = [",".join(headers)]
        for row in rows:
            csv_lines.append(",".join([str(row[h]) for h in headers]))

        csv_str = "\n".join(csv_lines)

        if filepath:
            with open(filepath, "w", encoding="utf-8-sig") as f:
                f.write(csv_str)

        return csv_str

    # ========== 报告生成 ==========

    def generate_report(self, windows: Optional[List[BerthWindow]] = None,
                        include_formulas: bool = True,
                        include_thresholds: bool = True,
                        include_details: bool = True) -> str:
        """生成靠泊窗口分析报告。

        参数:
            windows: 要包含的窗口，None表示使用所有窗口
            include_formulas: 是否包含计算公式说明
            include_thresholds: 是否包含阈值配置
            include_details: 是否包含每个窗口的详细信息
        """
        target = windows if windows is not None else self.windows

        lines = []
        lines.append("=" * 70)
        lines.append("潮汐码头靠泊窗口分析报告")
        lines.append("=" * 70)
        lines.append(f"生成时间: {datetime.now(pytz.UTC).strftime('%Y-%m-%d %H:%M:%S UTC')}")
        lines.append(f"窗口总数: {len(target)}")

        if self.processing_errors:
            lines.append(f"处理错误: {len(self.processing_errors)}")

        lines.append("")

        # 计算公式说明
        if include_formulas:
            lines.append("-" * 70)
            lines.append("一、安全校验计算公式")
            lines.append("-" * 70)
            lines.append("")
            lines.append("1. 吃水校验:")
            lines.append("   可用水深 = 泊位设计水深 + 潮位高度")
            lines.append("   要求水深 = 船舶吃水 + 龙骨下富余水深")
            lines.append("   水深余量 = 可用水深 - 要求水深")
            lines.append("   通过条件: 水深余量 >= 0")
            lines.append("")
            lines.append("2. 风速校验:")
            lines.append("   校验风速 = max(持续风速, 阵风)")
            lines.append("   风速余量 = 风速限制 - 校验风速")
            lines.append("   通过条件: 风速余量 >= 0")
            lines.append("")
            lines.append("3. 窗口判定:")
            lines.append("   连续满足所有条件的时间段为一个靠泊窗口")
            lines.append(f"   最小窗口时长: {self.calculator.threshold.min_window_minutes} 分钟")
            lines.append("")

        # 阈值配置
        if include_thresholds:
            lines.append("-" * 70)
            lines.append("二、安全阈值配置")
            lines.append("-" * 70)
            lines.append("")
            lines.append(self.calculator.threshold.explain())
            lines.append("")

        # 窗口概览
        lines.append("-" * 70)
        lines.append("三、靠泊窗口概览")
        lines.append("-" * 70)
        lines.append("")

        if not target:
            lines.append("⚠️  未找到符合条件的靠泊窗口")
            lines.append("")
        else:
            # 汇总统计
            ships = set(w.ship.imo or w.ship.name for w in target)
            berths = set(w.berth.berth_id for w in target)
            conflicts = sum(1 for w in target if any("冲突" in n.content for n in w.notes))

            lines.append(f"涉及船舶: {len(ships)} 艘")
            lines.append(f"涉及泊位: {len(berths)} 个")
            lines.append(f"有冲突窗口: {conflicts} 个")
            lines.append("")

            # 窗口列表
            lines.append(f"{'编号':<6} {'船舶':<15} {'泊位':<10} {'开始时间':<20} {'时长':<8} {'水深余量':<10} {'最大风速':<10} {'置信度':<8}")
            lines.append("-" * 85)

            for i, window in enumerate(target, 1):
                conflict_mark = " ⚠️" if any("冲突" in n.content for n in window.notes) else ""
                lines.append(
                    f"{i:<6} {window.ship.name:<15} {window.berth.berth_id:<10} "
                    f"{window.start_time.strftime('%m-%d %H:%M'):<20} "
                    f"{window.duration_minutes:<8} "
                    f"{window.min_depth_margin:+.2f}m{'':<5} "
                    f"{window.max_wind_speed:.1f}m/s{'':<5} "
                    f"{window.confidence:.0%}{conflict_mark}"
                )

            lines.append("")

        # 详细信息
        if include_details and target:
            lines.append("-" * 70)
            lines.append("四、窗口详细信息")
            lines.append("-" * 70)
            lines.append("")

            for i, window in enumerate(target, 1):
                lines.append(f"【窗口 {i}】{window.window_id}")
                lines.append("=" * 50)
                lines.append(window.explain())
                lines.append("")

                # 显示窗口内的极值点
                if window.check_results:
                    min_depth_point = min(window.check_results, key=lambda r: r.depth_margin)
                    max_wind_point = max(window.check_results, key=lambda r: r.wind_speed)

                    lines.append("窗口极值点:")
                    lines.append(f"  最小水深余量: {min_depth_point.depth_margin:.2f}m "
                                 f"@ {min_depth_point.time.strftime('%Y-%m-%d %H:%M')}")
                    lines.append(f"  最大风速: {max_wind_point.wind_speed:.1f}m/s "
                                 f"@ {max_wind_point.time.strftime('%Y-%m-%d %H:%M')}")
                    lines.append("")

        # 错误信息
        if self.processing_errors:
            lines.append("-" * 70)
            lines.append("五、处理过程中的错误/警告")
            lines.append("-" * 70)
            lines.append("")

            for i, err in enumerate(self.processing_errors, 1):
                lines.append(f"{i}. {type(err).__name__}:")
                lines.append(f"   {str(err).replace(chr(10), chr(10) + '   ')}")
                lines.append("")

        lines.append("=" * 70)
        lines.append("报告结束")
        lines.append("=" * 70)

        return "\n".join(lines)

    def save_report(self, filepath: str, windows: Optional[List[BerthWindow]] = None,
                    **kwargs) -> None:
        """保存报告到文件。"""
        report = self.generate_report(windows, **kwargs)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(report)

    # ========== 统计分析 ==========

    def get_statistics(self, windows: Optional[List[BerthWindow]] = None) -> Dict[str, Any]:
        """获取窗口统计信息。"""
        target = windows if windows is not None else self.windows

        if not target:
            return {
                "total_windows": 0,
                "total_duration_minutes": 0,
                "avg_duration_minutes": 0,
                "avg_depth_margin": 0,
                "avg_max_wind_speed": 0,
                "avg_confidence": 0,
                "conflicts": 0,
                "ships_count": 0,
                "berths_count": 0,
            }

        durations = [w.duration_minutes for w in target]
        depth_margins = [w.min_depth_margin for w in target]
        wind_speeds = [w.max_wind_speed for w in target]
        confidences = [w.confidence for w in target]
        conflicts = sum(1 for w in target if any("冲突" in n.content for n in w.notes))
        ships = set(w.ship.imo or w.ship.name for w in target)
        berths = set(w.berth.berth_id for w in target)

        return {
            "total_windows": len(target),
            "total_duration_minutes": sum(durations),
            "avg_duration_minutes": round(sum(durations) / len(durations), 1),
            "min_duration_minutes": min(durations),
            "max_duration_minutes": max(durations),
            "avg_depth_margin": round(sum(depth_margins) / len(depth_margins), 2),
            "min_depth_margin": round(min(depth_margins), 2),
            "max_depth_margin": round(max(depth_margins), 2),
            "avg_max_wind_speed": round(sum(wind_speeds) / len(wind_speeds), 1),
            "min_max_wind_speed": round(min(wind_speeds), 1),
            "max_max_wind_speed": round(max(wind_speeds), 1),
            "avg_confidence": round(sum(confidences) / len(confidences), 2),
            "conflicts": conflicts,
            "ships_count": len(ships),
            "berths_count": len(berths),
        }
