from typing import Dict, List, Optional
from models import AlertLevel, RecordStatus


FRIENDLY_ERRORS: Dict[str, Dict[str, str]] = {
    "threshold_cross": {
        "title": "⚠️ 阈值跨档提醒",
        "template": "{device_name} 的 {metric_name} 从 {old_level} 变到了 {new_level}，"
                    "数值从 {old_value}{unit} 变成 {new_value}{unit}。"
                    "这中间差了 {cross_count} 个档位，请仔细核对是不是真的变化这么大。",
        "suggestion": "建议：去现场看看设备实际状态，或者查一下这期间有没有人动过设置。"
    },
    "duplicate_alert": {
        "title": "🔄 重复报警确认",
        "template": "{device_name} 的 {metric_name} 报警已经被确认过 {count} 次了。"
                    "最早那次是 {first_time} 由 {operator} 处理的，这次就不重复记录了。",
        "suggestion": "建议：如果确实还在报警，说明之前的处理可能没到位，需要复查一下。"
    },
    "late_arrival": {
        "title": "⏰ 数据到晚了",
        "template": "{device_name} 在 {collect_time} 采集的数据，{receive_time} 才送到系统，"
                    "晚了 {delay_hours} 个小时。超过了 {threshold_hours} 小时的正常时效。",
        "suggestion": "建议：检查一下通信链路是不是不稳定，或者采集设备有没有死机。"
    },
    "sequence_error": {
        "title": "❓ 时序有点乱",
        "template": "{device_name} 的故障记录顺序不对劲：{earlier_time} 还显示 {higher_level}，"
                    "到 {later_time} 反而变成 {lower_level} 了。正常应该是先轻后重，或者一直严重。",
        "suggestion": "建议：核对一下这两条记录的采集时间对不对，是不是时钟同步出问题了。"
    },
    "fluctuation": {
        "title": "📈 波动太剧烈",
        "template": "{device_name} 的 {metric_name} 变化太快了：现在是 {current_value}{unit}，"
                    "之前平均还在 {avg_value}{unit}，一下变了 {change_percent}%。",
        "suggestion": "建议：观察一会儿，如果持续波动可能是传感器或者设备本身出问题了。"
    },
    "manual_correction": {
        "title": "✏️ 有人改过数据",
        "template": "{device_name} 的 {metric_name} 数据被 {operator} 在 {correct_time} 修改过，"
                    "原来的值是 {old_value}{unit}，改成了 {new_value}{unit}。备注：{remarks}",
        "suggestion_template": "建议：如果对修改有疑问，可以找 {operator} 确认一下当时的情况。"
    },
    "value_out_of_range": {
        "title": "❗ 数值不太对",
        "template": "{device_name} 的 {metric_name} 读到 {value}{unit}，正常范围应该是 {min_value}-{max_value}{unit}。",
        "suggestion": "建议：先确认是不是传感器坏了，再去现场看看实际情况。"
    },
    "missing_data": {
        "title": "📭 数据缺了",
        "template": "{device_name} 应该在 {expected_time} 上报 {metric_name}，但没收到。",
        "suggestion": "建议：检查设备是不是在线，通信有没有断。"
    }
}


LEVEL_EMOJIS = {
    AlertLevel.NORMAL: "✅",
    AlertLevel.NOTICE: "ℹ️",
    AlertLevel.WARNING: "⚠️",
    AlertLevel.ALARM: "🚨",
    AlertLevel.CRITICAL: "💥"
}


STATUS_DESCRIPTIONS = {
    RecordStatus.NORMAL: "数据正常，已确认",
    RecordStatus.PENDING: "有待确认的问题",
    RecordStatus.DUPLICATE: "重复记录，已跳过",
    RecordStatus.LATE_ARRIVAL: "数据迟到，时效存疑",
    RecordStatus.SEQUENCE_ERROR: "时序异常，需核对",
    RecordStatus.THRESHOLD_CROSS: "跨档位变化，需复核"
}


def generate_user_friendly_message(
    error_type: str,
    **kwargs
) -> tuple[str, List[str]]:
    if error_type not in FRIENDLY_ERRORS:
        return "遇到了一个暂时说不清楚的问题，麻烦联系系统管理员。", ["建议：把当前页面截图发过去。"]
    
    error_config = FRIENDLY_ERRORS[error_type]
    try:
        message = error_config["title"] + "\n" + error_config["template"].format(**kwargs)
        suggestion_key = "suggestion_template" if "suggestion_template" in error_config else "suggestion"
        suggestion = error_config[suggestion_key].format(**kwargs)
        suggestions = [suggestion]
        return message, suggestions
    except KeyError as e:
        return f"提示信息生成失败，缺少必要信息：{e}", []


def format_audit_reason(reason: str, evidence: dict) -> str:
    readable = [reason]
    
    if "previous_value" in evidence:
        readable.append(f"  · 之前的值：{evidence['previous_value']}")
    if "current_value" in evidence:
        readable.append(f"  · 现在的值：{evidence['current_value']}")
    if "threshold" in evidence:
        readable.append(f"  · 判定阈值：{evidence['threshold']}")
    if "collect_time" in evidence:
        readable.append(f"  · 采集时间：{evidence['collect_time']}")
    if "operator" in evidence:
        readable.append(f"  · 操作人：{evidence['operator']}")
    
    return "\n".join(readable)


def get_level_description(level: AlertLevel, value: float, unit: str) -> str:
    emoji = LEVEL_EMOJIS.get(level, "")
    return f"{emoji} {level.value}（{value}{unit}）"
