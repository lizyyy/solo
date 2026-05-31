from datetime import datetime
from typing import List, Dict, Any, Optional
from collections import defaultdict

from models import DispatchRecord, RecordStatus, Anomaly, AnomalyType
from dispatcher import UndergroundDispatcher


class StateViewer:
    def __init__(self, dispatcher: UndergroundDispatcher):
        self.dispatcher = dispatcher

    def get_record_timeline(self, record_id: str) -> List[Dict[str, Any]]:
        record = self.dispatcher.get_record(record_id)
        if not record:
            return []

        timeline = []

        for transition in record.status_history:
            timeline.append({
                "timestamp": transition.timestamp,
                "type": "status_change",
                "from_status": transition.from_status.value if transition.from_status else None,
                "to_status": transition.to_status.value,
                "operator": transition.operator,
                "reason": transition.reason,
                "details": transition.details
            })

        for anomaly in record.anomalies:
            timeline.append({
                "timestamp": anomaly.detected_at,
                "type": "anomaly_detected",
                "anomaly_id": anomaly.anomaly_id,
                "anomaly_type": anomaly.anomaly_type.value,
                "severity": anomaly.severity,
                "description": anomaly.description,
                "resolved": anomaly.resolved,
                "resolved_at": anomaly.resolved_at,
                "resolution": anomaly.resolution
            })

        for correction in record.manual_corrections:
            timeline.append({
                "timestamp": correction.timestamp,
                "type": "manual_correction",
                "correction_id": correction.correction_id,
                "operator": correction.operator,
                "corrected_fields": correction.corrected_fields,
                "original_values": correction.original_values,
                "reason": correction.reason
            })

        timeline.sort(key=lambda x: x["timestamp"])

        for idx, item in enumerate(timeline, 1):
            item["sequence"] = idx
            item["timestamp_str"] = item["timestamp"].strftime("%Y-%m-%d %H:%M:%S")

        return timeline

    def format_timeline(self, record_id: str) -> str:
        timeline = self.get_record_timeline(record_id)
        if not timeline:
            return f"未找到记录 {record_id}"

        record = self.dispatcher.get_record(record_id)
        pr = record.player_record

        lines = []
        lines.append(f"══════════════ 记录状态回看 ══════════════")
        lines.append(f"记录ID: {record_id}")
        lines.append(f"玩家ID: {pr.player_id}")
        lines.append(f"活动ID: {pr.activity_id}")
        lines.append(f"任务ID: {pr.task_id}")
        lines.append(f"完成时间: {pr.completion_time.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"奖励金额: {pr.reward_amount}")
        lines.append(f"当前状态: {record.current_status.value}")
        lines.append(f"来源: {pr.source}")
        lines.append(f"")
        lines.append(f"────────── 处理时间线 ──────────")

        for item in timeline:
            seq = item["sequence"]
            ts = item["timestamp_str"]

            if item["type"] == "status_change":
                from_s = item["from_status"] or "(初始)"
                to_s = item["to_status"]
                lines.append(f"[{seq}] {ts}  状态变更")
                lines.append(f"       {from_s} → {to_s}")
                lines.append(f"       操作人: {item['operator']}")
                lines.append(f"       原因: {item['reason']}")
                if item.get("details"):
                    lines.append(f"       详情: {item['details']}")

            elif item["type"] == "anomaly_detected":
                status = "已解决" if item["resolved"] else "未解决"
                lines.append(f"[{seq}] {ts}  异常发现 [{item['severity']}] [{status}]")
                lines.append(f"       类型: {item['anomaly_type']}")
                lines.append(f"       描述: {item['description']}")
                if item["resolution"]:
                    lines.append(f"       处理: {item['resolution']}")

            elif item["type"] == "manual_correction":
                lines.append(f"[{seq}] {ts}  人工更正")
                lines.append(f"       操作人: {item['operator']}")
                lines.append(f"       原因: {item['reason']}")
                lines.append(f"       修改字段:")
                for field, new_val in item["corrected_fields"].items():
                    old_val = item["original_values"].get(field, "?")
                    lines.append(f"         - {field}: {old_val} → {new_val}")

            lines.append(f"")

        lines.append(f"═══════════════════════════════════════")
        return "\n".join(lines)

    def get_player_activity_timeline(self, player_id: str) -> List[Dict[str, Any]]:
        records = self.dispatcher.get_records_by_player(player_id)
        all_events = []

        for record in records:
            timeline = self.get_record_timeline(record.record_id)
            for event in timeline:
                event["record_id"] = record.record_id
                event["activity_id"] = record.player_record.activity_id
                event["task_id"] = record.player_record.task_id
                all_events.append(event)

        all_events.sort(key=lambda x: x["timestamp"])
        return all_events


class AnomalyExplainer:
    def __init__(self, dispatcher: UndergroundDispatcher):
        self.dispatcher = dispatcher

    EXPLANATIONS = {
        AnomalyType.DUPLICATE_RECORD: {
            "cause": "系统检测到两条或多条记录的核心字段（玩家ID、活动ID、任务ID、完成时间、奖励金额）完全一致。",
            "possible_reasons": [
                "同一记录被重复上传",
                "不同来源的同步数据产生冲突",
                "人工补录时未查询已有记录"
            ],
            "impact": "如果不处理，可能导致同一玩家重复领奖；当前系统已自动标记为重复，不会进入发奖队列。",
            "suggestion": "确认哪条是最早的有效记录，保留一条；其余记录可标记为已解决并归档。"
        },
        AnomalyType.LATE_ARRIVAL: {
            "cause": "记录或其附件的到达时间晚于活动截止时间，或附件上传时间比完成时间晚24小时以上。",
            "possible_reasons": [
                "玩家截图上传延迟",
                "第三方渠道数据同步延迟",
                "活动结束后才提交的申诉材料"
            ],
            "impact": "系统不会自动发奖，需人工确认是否符合补发条件。",
            "suggestion": "核查活动规则，如确实符合补发条件，人工更正后重新进入发奖队列。"
        },
        AnomalyType.DATA_INCONSISTENCY: {
            "cause": "同一条记录在不同来源的数据存在矛盾（如完成时间不一致、奖励金额不符等）。",
            "possible_reasons": [
                "不同数据源的统计口径不同",
                "数据传输过程中发生错误",
                "人工录入错误"
            ],
            "impact": "无法确定哪个数据是正确的，影响奖励发放的准确性。",
            "suggestion": "核对原始数据，以最权威的数据源为准进行人工更正。"
        },
        AnomalyType.MISSING_REQUIRED_FIELD: {
            "cause": "记录缺少必填字段，无法进行完整的校验和处理。",
            "possible_reasons": [
                "数据导入时字段映射错误",
                "原始数据本身不完整",
                "API接口调用时参数缺失"
            ],
            "impact": "记录无法正常流转，会卡在待处理状态。",
            "suggestion": "补充缺失的字段信息后重新处理。"
        },
        AnomalyType.MANUAL_OVERRIDE: {
            "cause": "运营人员对记录进行了人工修改，覆盖了原始数据。",
            "possible_reasons": [
                "玩家申诉成功，需要调整奖励",
                "发现原始数据有误，进行修正",
                "特殊情况的人工处理"
            ],
            "impact": "记录的处理结果由人工决定，系统会记录所有修改痕迹。",
            "suggestion": "确保人工更正有充分的理由和审批记录，便于后续审计。"
        },
        AnomalyType.REWARD_DISCREPANCY: {
            "cause": "实际发放的奖励与应发奖励存在差异，或标记为漏发。",
            "possible_reasons": [
                "发奖系统故障导致发放失败",
                "玩家账号异常无法到账",
                "统计遗漏导致未进入发奖队列"
            ],
            "impact": "玩家体验受损，可能引发投诉。",
            "suggestion": "尽快核实原因，符合条件的予以补发，并记录补发详情。"
        }
    }

    def explain_anomaly(self, anomaly: Anomaly) -> Dict[str, Any]:
        base = self.EXPLANATIONS.get(anomaly.anomaly_type, {
            "cause": "未知异常类型",
            "possible_reasons": ["需要进一步排查"],
            "impact": "影响未知",
            "suggestion": "联系技术支持"
        })

        return {
            "anomaly_id": anomaly.anomaly_id,
            "type": anomaly.anomaly_type.value,
            "severity": anomaly.severity,
            "description": anomaly.description,
            "record_id": anomaly.record_id,
            "detected_at": anomaly.detected_at,
            "resolved": anomaly.resolved,
            "resolved_at": anomaly.resolved_at,
            "resolution": anomaly.resolution,
            "related_record_ids": anomaly.related_record_ids,
            "cause": base["cause"],
            "possible_reasons": base["possible_reasons"],
            "impact": base["impact"],
            "suggestion": base["suggestion"]
        }

    def format_explanation(self, anomaly: Anomaly) -> str:
        exp = self.explain_anomaly(anomaly)
        status = "已解决" if exp["resolved"] else "未解决"

        lines = []
        lines.append(f"══════════════ 异常解释 ══════════════")
        lines.append(f"异常ID: {exp['anomaly_id']}")
        lines.append(f"关联记录: {exp['record_id']}")
        lines.append(f"类型: {exp['type']}")
        lines.append(f"严重程度: {exp['severity']}")
        lines.append(f"状态: {status}")
        lines.append(f"发现时间: {exp['detected_at'].strftime('%Y-%m-%d %H:%M:%S')}")
        if exp["resolved_at"]:
            lines.append(f"解决时间: {exp['resolved_at'].strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"")
        lines.append(f"异常描述: {exp['description']}")
        lines.append(f"")
        lines.append(f"────────── 异常分析 ──────────")
        lines.append(f"产生原因: {exp['cause']}")
        lines.append(f"")
        lines.append(f"可能原因:")
        for i, reason in enumerate(exp["possible_reasons"], 1):
            lines.append(f"  {i}. {reason}")
        lines.append(f"")
        lines.append(f"影响范围: {exp['impact']}")
        lines.append(f"")
        lines.append(f"处理建议: {exp['suggestion']}")
        lines.append(f"")
        if exp["resolution"]:
            lines.append(f"────────── 当前处理 ──────────")
            lines.append(f"{exp['resolution']}")
        if exp["related_record_ids"]:
            lines.append(f"")
            lines.append(f"关联记录: {', '.join(exp['related_record_ids'])}")
        lines.append(f"═══════════════════════════════════════")
        return "\n".join(lines)

    def get_all_anomalies_summary(self, unresolved_only: bool = True) -> List[Dict[str, Any]]:
        anomalies = self.dispatcher.get_unresolved_anomalies() if unresolved_only else \
            [a for r in self.dispatcher.records.values() for a in r.anomalies]

        summary = defaultdict(lambda: {"count": 0, "severity_dist": defaultdict(int), "records": []})

        for anomaly in anomalies:
            t = anomaly.anomaly_type.value
            summary[t]["count"] += 1
            summary[t]["severity_dist"][anomaly.severity] += 1
            summary[t]["records"].append(anomaly.record_id)

        result = []
        for anomaly_type, data in summary.items():
            result.append({
                "anomaly_type": anomaly_type,
                "count": data["count"],
                "severity_distribution": dict(data["severity_dist"]),
                "affected_records": data["records"][:10],
                "affected_count": len(data["records"])
            })

        return sorted(result, key=lambda x: x["count"], reverse=True)

    def format_anomalies_report(self, unresolved_only: bool = True) -> str:
        summary = self.get_all_anomalies_summary(unresolved_only)
        title = "未解决异常汇总" if unresolved_only else "全部异常汇总"

        lines = []
        lines.append(f"══════════════ {title} ══════════════")
        lines.append(f"统计时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"")

        if not summary:
            lines.append(f"太棒了！没有发现{'未解决的' if unresolved_only else ''}异常。")
        else:
            for item in summary:
                lines.append(f"【{item['anomaly_type']}】 共 {item['count']} 条")
                lines.append(f"  严重程度分布: {item['severity_distribution']}")
                lines.append(f"  影响记录数: {item['affected_count']}")
                if item['affected_records']:
                    lines.append(f"  示例记录: {', '.join(item['affected_records'])}")
                lines.append(f"")

        lines.append(f"═══════════════════════════════════════")
        return "\n".join(lines)
