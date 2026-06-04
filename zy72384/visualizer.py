from typing import List, Optional, Dict, Any
from models import ShockDataPoint, ProjectState, TempUnit
from temp_detector import explain_mixed_units, build_clickable_links


class Chart3D:
    def __init__(self, state: ProjectState):
        self.state = state
        build_clickable_links(state)

    def _format_point(self, idx: int, point: ShockDataPoint) -> Dict[str, Any]:
        mixed = idx in self.state.clickable_links
        color = "红色" if mixed else "蓝色"
        marker = "⚠️" if mixed else "●"

        temp_info = ""
        if point.temperature_reading:
            temp = point.temperature_reading
            temp_info = f" 温度:{temp.value}{temp.unit.value}"

        return {
            "id": idx,
            "marker": marker,
            "color": color,
            "time_ms": point.time_ms,
            "acceleration_g": point.acceleration_g,
            "altitude_m": point.altitude_m,
            "velocity_m_s": point.velocity_m_s,
            "temp_info": temp_info,
            "has_mixed_units": mixed,
            "clickable": mixed
        }

    def render_text_3d(self) -> str:
        lines = ["\n" + "=" * 80]
        lines.append("【降落伞开伞冲击 3D 可视化】")
        lines.append("X轴: 时间(ms)   Y轴: 加速度(g)   Z轴: 高度(m)")
        lines.append("=" * 80)
        lines.append(f"{'ID':<4} {'标记':<4} {'时间':<8} {'加速度':<8} {'高度':<8} {'速度':<8} {'备注':<20}")
        lines.append("-" * 80)

        for i, point in enumerate(self.state.shock_data):
            info = self._format_point(i, point)
            temp_note = ""
            if info["has_mixed_units"]:
                temp_note = "⚠️ 单位混用"
            lines.append(
                f"{info['id']:<4} {info['marker']:<4} "
                f"{info['time_ms']:<8.1f} {info['acceleration_g']:<8.2f} "
                f"{info['altitude_m']:<8.1f} {info['velocity_m_s']:<8.1f} "
                f"{temp_note:<20}"
            )

        lines.append("\n图例说明:")
        lines.append("  ● 蓝色 - 数据正常")
        lines.append("  ⚠️ 红色 - 摄氏度/开尔文混用，点击可回溯")
        lines.append("-" * 80)

        if self.state.clickable_links:
            lines.append(f"\n⚠️ 共发现 {len(self.state.clickable_links)} 个单位混用点，可点击回溯。")
            for idx in self.state.clickable_links:
                expl = explain_mixed_units(idx, self.state)
                if expl:
                    lines.append(f"\n  → 点 {idx}: {expl}")

        return "\n".join(lines)

    def render_chart(self, mode: str = "3d") -> str:
        if mode == "3d":
            return self.render_text_3d()
        elif mode == "2d":
            return self._render_2d_chart()
        return self.render_text_3d()

    def _render_2d_chart(self) -> str:
        lines = ["\n" + "=" * 80]
        lines.append("【降落伞开伞冲击 2D 曲线】")
        lines.append("横轴: 时间(ms)   纵轴: 加速度(g)")
        lines.append("=" * 80)

        max_g = max(p.acceleration_g for p in self.state.shock_data) if self.state.shock_data else 1
        height = 15

        for row in range(height, 0, -1):
            line = f"{(row / height * max_g):<5.1f}g |"
            for i, point in enumerate(self.state.shock_data):
                if int(point.acceleration_g / max_g * height) >= row:
                    if i in self.state.clickable_links:
                        line += "⚠"
                    else:
                        line += "█"
                else:
                    line += " "
            lines.append(line)

        lines.append("      " + "-" * (len(self.state.shock_data) + 2))
        lines.append(f"      0ms{' ' * (len(self.state.shock_data) - 8)}"
                     f"{max(p.time_ms for p in self.state.shock_data):.0f}ms")

        return "\n".join(lines)

    def click_point(self, point_idx: int) -> Optional[Dict[str, Any]]:
        if point_idx not in self.state.clickable_links:
            return {
                "found": False,
                "message": f"数据点 {point_idx} 无单位混用问题，无需回溯。"
            }

        link = self.state.clickable_links[point_idx]
        reading = link["shock_data"].temperature_reading

        result = {
            "found": True,
            "point_idx": point_idx,
            "warning": "⚠️ 摄氏度/开尔文混用点",
            "explanation": explain_mixed_units(point_idx, self.state),
            "navigate_options": []
        }

        if reading:
            result["navigate_options"].append({
                "type": "采样间隔说明",
                "file": self.state.sampling_spec.file_name if self.state.sampling_spec else "未知",
                "line": reading.source_line,
                "raw_text": reading.raw_text,
                "unit": reading.unit.value
            })

        if link["calibration_record"]:
            cal = link["calibration_record"]
            result["navigate_options"].append({
                "type": "温度校准记录",
                "record_id": cal.record_id,
                "recorded_by": cal.recorded_by,
                "recorded_at": cal.recorded_at.strftime("%Y-%m-%d %H:%M"),
                "remarks": cal.remarks
            })
        else:
            result["navigate_options"].append({
                "type": "温度校准记录",
                "status": "缺失",
                "action": "请林老师补录温度校准记录"
            })

        return result

    def list_clickable_points(self) -> List[int]:
        return sorted(self.state.clickable_links.keys())
