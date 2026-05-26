from datetime import datetime, timedelta
from typing import Dict, List, Any, Tuple, Optional
from .models import (
    Waybill,
    TrackEvent,
    PenaltyRule,
    FailedRecord,
    ResultStatus,
    ProcessResult,
)
import json
import hashlib


class ReconciliationService:
    def __init__(self):
        self.processed_batches: Dict[str, Dict[str, Any]] = {}

    def is_batch_processed(self, batch_id: str) -> bool:
        return batch_id in self.processed_batches

    def get_batch_status(self, batch_id: str) -> Optional[Dict[str, Any]]:
        return self.processed_batches.get(batch_id)

    def _check_weather_exemption(self, waybill: Waybill, tracks: List[TrackEvent]) -> bool:
        if waybill.is_weather_issue and waybill.is_weather_issue.lower() in ["yes", "y", "true", "1"]:
            return True
        for track in tracks:
            if track.waybill_no == waybill.waybill_no:
                if track.remark and "天气" in track.remark:
                    return True
                if "天气原因" in (track.event_type or ""):
                    return True
        return False

    def _check_cross_transit_timeout(
        self, waybill: Waybill, tracks: List[TrackEvent]
    ) -> Tuple[bool, Optional[str], Optional[str]]:
        nodes = waybill.transit_nodes
        if len(nodes) < 2:
            return False, None, None

        for i in range(len(nodes) - 1):
            current_node = nodes[i]
            next_node = nodes[i + 1]

            if current_node.departure_time and next_node.arrival_time:
                transit_time = next_node.arrival_time - current_node.departure_time
                if transit_time > timedelta(hours=24):
                    return (
                        True,
                        f"跨中转超时: {current_node.node_name} -> {next_node.node_name}, 用时 {transit_time.total_seconds() / 3600:.1f}小时",
                        f"RULE_CROSS_TRANSIT_{current_node.node_code}_{next_node.node_code}",
                    )

        return False, None, None

    def _check_transit_status_anomaly(
        self, waybill: Waybill
    ) -> Tuple[bool, Optional[str], Optional[str]]:
        nodes = waybill.transit_nodes
        for node in nodes:
            if node.status != "正常":
                return (
                    True,
                    f"中转节点状态异常: {node.node_name}({node.status})",
                    f"RULE_TRANSIT_STATUS_{node.node_code}",
                )
        return False, None, None

    def _check_damage_responsibility(
        self, waybill: Waybill, tracks: List[TrackEvent]
    ) -> Tuple[bool, Optional[str], Optional[str]]:
        if waybill.damage_count > 0:
            damage_track = None
            for track in tracks:
                if track.waybill_no == waybill.waybill_no and "破损" in track.event_type:
                    damage_track = track
                    break

            if damage_track:
                for node in waybill.transit_nodes:
                    if node.node_name == damage_track.location or node.node_code == damage_track.location:
                        return (
                            True,
                            f"中转破损: {waybill.damage_count}件货物在 {node.node_name} 节点发生破损",
                            f"RULE_DAMAGE_{node.node_code}",
                        )

            return (
                True,
                f"运单破损: {waybill.damage_count}件货物破损, {waybill.damage_description or '详情未知'}",
                "RULE_DAMAGE_UNKNOWN",
            )

        return False, None, None

    def _check_delay(self, waybill: Waybill) -> Tuple[bool, Optional[str], Optional[str]]:
        if waybill.actual_delivery and waybill.estimated_delivery:
            if waybill.actual_delivery > waybill.estimated_delivery:
                delay_hours = (waybill.actual_delivery - waybill.estimated_delivery).total_seconds() / 3600
                if delay_hours > 2:
                    return (
                        True,
                        f"干线晚点: 预计 {waybill.estimated_delivery.strftime('%Y-%m-%d %H:%M')}, 实际 {waybill.actual_delivery.strftime('%Y-%m-%d %H:%M')}, 晚点 {delay_hours:.1f}小时",
                        "RULE_DELAY_MAINLINE",
                    )
        return False, None, None

    def _check_duplicate_penalty(
        self, waybill: Waybill, existing_failed: List[FailedRecord]
    ) -> bool:
        for record in existing_failed:
            if record.waybill_no == waybill.waybill_no:
                return True
        return False

    def _get_penalty_amount(self, rule_id: str, rules: List[PenaltyRule]) -> float:
        for rule in rules:
            if rule.rule_id == rule_id or rule_id.startswith(rule.rule_id):
                return rule.penalty_amount
        return 0.0

    def _get_suggested_action(self, rule_id: str, reason: str) -> str:
        if "跨中转" in reason:
            return "请核对中转节点的装卸时间和运输记录，确认责任方后进行费用分摊"
        elif "破损" in reason:
            return "请核查货物破损照片和交接单，联系保险公司定损并更新运单信息"
        elif "晚点" in reason:
            return "请检查干线运输轨迹，核实晚点原因，如需申请豁免请提供天气/路况证明"
        elif "状态异常" in reason:
            return "请人工核对中转节点状态记录，补全缺失的签收/发运信息"
        else:
            return "请人工复核该运单的完整信息后再处理"

    def _waybill_to_dict(self, waybill: Waybill) -> Dict[str, Any]:
        return {
            "waybill_no": waybill.waybill_no,
            "sender": waybill.sender,
            "receiver": waybill.receiver,
            "origin": waybill.origin,
            "destination": waybill.destination,
            "estimated_delivery": waybill.estimated_delivery.isoformat() if waybill.estimated_delivery else None,
            "actual_delivery": waybill.actual_delivery.isoformat() if waybill.actual_delivery else None,
            "transit_nodes": [
                {
                    "node_code": n.node_code,
                    "node_name": n.node_name,
                    "arrival_time": n.arrival_time.isoformat() if n.arrival_time else None,
                    "departure_time": n.departure_time.isoformat() if n.departure_time else None,
                    "status": n.status,
                }
                for n in waybill.transit_nodes
            ],
            "weight": waybill.weight,
            "cargo_type": waybill.cargo_type,
            "damage_count": waybill.damage_count,
            "damage_description": waybill.damage_description,
            "is_weather_issue": waybill.is_weather_issue,
        }

    def process_batch(
        self,
        batch_id: str,
        waybills: List[Waybill],
        tracks: List[TrackEvent],
        rules: List[PenaltyRule],
    ) -> ProcessResult:
        if self.is_batch_processed(batch_id):
            cached = self.processed_batches[batch_id]
            return ProcessResult(
                batch_id=batch_id,
                status="duplicate",
                normal_count=cached["normal_count"],
                pending_count=cached["pending_count"],
                failed_count=cached["failed_count"],
                normal_items=cached["normal_items"],
                pending_items=cached["pending_items"],
                failed_items=cached["failed_items"],
                processing_time=cached["processing_time"],
                message=f"批次 {batch_id} 已在 {cached['processing_time']} 处理完成，重复提交无效",
            )

        normal_items: List[Dict[str, Any]] = []
        pending_items: List[Dict[str, Any]] = []
        failed_items: List[FailedRecord] = []

        for waybill in waybills:
            waybill_dict = self._waybill_to_dict(waybill)

            if self._check_weather_exemption(waybill, tracks):
                normal_items.append(
                    {
                        **waybill_dict,
                        "remark": "天气原因豁免",
                        "exemption_type": "weather",
                    }
                )
                continue

            is_delay, delay_reason, delay_rule = self._check_delay(waybill)
            is_cross_timeout, cross_reason, cross_rule = self._check_cross_transit_timeout(waybill, tracks)
            is_damage, damage_reason, damage_rule = self._check_damage_responsibility(waybill, tracks)
            is_status_anomaly, status_reason, status_rule = self._check_transit_status_anomaly(waybill)
            is_duplicate = self._check_duplicate_penalty(waybill, failed_items)

            if is_duplicate:
                pending_items.append(
                    {
                        **waybill_dict,
                        "remark": "该运单已存在扣罚记录，待确认是否重复处理",
                        "pending_reason": "duplicate_penalty_check",
                    }
                )
                continue

            has_hard_failures = is_delay or is_cross_timeout or is_damage

            if has_hard_failures:
                failures = []
                if is_delay:
                    failures.append((delay_reason, delay_rule))
                if is_cross_timeout:
                    failures.append((cross_reason, cross_rule))
                if is_damage:
                    failures.append((damage_reason, damage_rule))

                combined_reason = "；".join([r for r, _ in failures])
                applied_rules = [rule for _, rule in failures if rule]
                total_penalty = sum([self._get_penalty_amount(rule, rules) for rule in applied_rules])

                failed_items.append(
                    FailedRecord(
                        waybill_no=waybill.waybill_no,
                        original_data=waybill_dict,
                        failure_reason=combined_reason,
                        suggested_action=self._get_suggested_action(applied_rules[0] if applied_rules else "", combined_reason),
                        rule_applied=",".join(applied_rules) if applied_rules else None,
                        penalty_amount=total_penalty if total_penalty > 0 else None,
                    )
                )
            elif is_status_anomaly:
                pending_items.append(
                    {
                        **waybill_dict,
                        "remark": f"中转节点状态异常，需人工确认: {status_reason}",
                        "pending_reason": "transit_status_anomaly",
                        "anomaly_detail": status_reason,
                        "suggested_action": "请人工核对中转节点状态记录，补全缺失的签收/发运信息",
                    }
                )
            elif waybill.damage_count == 0 and not is_delay:
                normal_items.append(
                    {
                        **waybill_dict,
                        "remark": "正常完成，无异常",
                    }
                )
            else:
                pending_items.append(
                    {
                        **waybill_dict,
                        "remark": "信息不完整，需人工确认",
                        "pending_reason": "missing_info",
                    }
                )

        processing_time = datetime.now()
        result = ProcessResult(
            batch_id=batch_id,
            status="success",
            normal_count=len(normal_items),
            pending_count=len(pending_items),
            failed_count=len(failed_items),
            normal_items=normal_items,
            pending_items=pending_items,
            failed_items=failed_items,
            processing_time=processing_time,
            message=f"批次处理完成: 正常 {len(normal_items)} 条, 待确认 {len(pending_items)} 条, 失败 {len(failed_items)} 条",
        )

        self.processed_batches[batch_id] = {
            "normal_count": len(normal_items),
            "pending_count": len(pending_items),
            "failed_count": len(failed_items),
            "normal_items": normal_items,
            "pending_items": pending_items,
            "failed_items": failed_items,
            "processing_time": processing_time,
        }

        return result

    def generate_batch_id(self) -> str:
        return f"BATCH_{datetime.now().strftime('%Y%m%d%H%M%S')}_{hashlib.md5(str(datetime.now().timestamp()).encode()).hexdigest()[:8]}"
