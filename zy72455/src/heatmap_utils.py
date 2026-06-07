from typing import Dict, Any, List, Tuple
import math


def generate_heatmap_grid(
    hourly_samples: Dict[str, int],
    grid_width: int = 24,
    grid_height: int = 7,
) -> List[List[int]]:
    grid = []
    hours = sorted([int(h) for h in hourly_samples.keys()])
    
    max_val = max(hourly_samples.values()) if hourly_samples else 1
    
    for day_row in range(grid_height):
        row = []
        for hour in hours[:grid_width]:
            val = hourly_samples.get(str(hour), 0)
            normalized = min(9, int(math.floor(val / max_val * 9))) if max_val > 0 else 0
            row.append(normalized)
        grid.append(row)
    
    return grid


def heatmap_grid_to_html(grid: List[List[int]], title: str = "") -> str:
    colors = [
        "#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39",
        "#1a5f32", "#145228", "#0f4220", "#0a3318", "#052410"
    ]
    
    html_parts = []
    if title:
        html_parts.append(f'<div style="margin-bottom: 10px; font-weight: bold;">{title}</div>')
    
    html_parts.append('<div style="display: flex; flex-direction: column; gap: 2px;">')
    for row in grid:
        html_parts.append('<div style="display: flex; gap: 2px;">')
        for val in row:
            color = colors[min(val, len(colors) - 1)]
            html_parts.append(
                f'<div style="width: 20px; height: 20px; background-color: {color}; '
                f'border-radius: 2px;" title="强度: {val}"></div>'
            )
        html_parts.append('</div>')
    html_parts.append('</div>')
    
    hour_labels = ""
    for h in range(0, 24, 3):
        hour_labels += f'<div style="width: 20px; text-align: center; font-size: 10px;">{h}</div>'
    
    legend_html = (
        '<div style="margin-top: 10px; display: flex; align-items: center; gap: 4px; font-size: 12px;">'
        '<span>低</span>'
    )
    for color in colors:
        legend_html += f'<div style="width: 12px; height: 12px; background-color: {color}; border-radius: 2px;"></div>'
    legend_html += '<span>高</span></div>'
    
    return "".join(html_parts) + legend_html


def detect_anomaly_from_grid(grid: List[List[int]]) -> Tuple[bool, str]:
    if not grid or not grid[0]:
        return False, "无数据"
    
    night_hours = list(range(22, 24)) + list(range(0, 7))
    day_hours = list(range(7, 22))
    
    night_vals = []
    day_vals = []
    
    for row in grid:
        for hour_idx, val in enumerate(row):
            if hour_idx in night_hours:
                night_vals.append(val)
            elif hour_idx in day_hours:
                day_vals.append(val)
    
    if not day_vals:
        return False, "无日间数据"
    if not night_vals:
        return True, "完全无夜间数据"
    
    day_avg = sum(day_vals) / len(day_vals)
    night_avg = sum(night_vals) / len(night_vals)
    
    if day_avg == 0:
        return False, "日间强度为0"
    
    ratio = night_avg / day_avg
    
    if ratio < 0.3:
        return True, f"夜间强度仅为日间的 {ratio:.1%}，疑似夜间缺采样"
    
    return False, f"夜间/日间强度比: {ratio:.1%}，正常"


def get_next_steps_for_low_sampling() -> List[str]:
    return [
        "1. 查看路口照片原始行号和导入记录（溯源）",
        "2. 确认公交刷卡时段是否完整补录",
        "3. 联系市政巡检员补充夜间时段采样数据",
        "4. 街道规划员复核后标记最终状态",
        "5. 如需重新计算，可执行回滚操作后再次生成热力图",
    ]
