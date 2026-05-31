from typing import List, Dict, Tuple
from collections import defaultdict
import math

from models import (
    BattleRecord, BattleAction, SettlementData, Unit, Position,
    AnomalyMark, AnomalyType, ConfirmationStatus, BoundaryCrossingAnalysis
)


class CanyonMap:
    def __init__(self):
        self.width = 20
        self.height = 15
        self.boundary_zones = {
            'left_edge': set((x, y) for x in range(0, 2) for y in range(self.height)),
            'right_edge': set((x, y) for x in range(self.width - 2, self.width) for y in range(self.height)),
            'top_edge': set((x, y) for x in range(self.width) for y in range(0, 2)),
            'bottom_edge': set((x, y) for x in range(self.width) for y in range(self.height - 2, self.height)),
            'canyon_pass': set((x, y) for x in range(8, 12) for y in range(5, 10)),
            'wind_zone_a': set((x, y) for x in range(0, 10) for y in range(0, 8)),
            'wind_zone_b': set((x, y) for x in range(10, 20) for y in range(8, 15)),
        }
        self.impassable = set((x, 7) for x in range(5, 8)) | set((x, 7) for x in range(12, 15))

    def get_zone(self, pos: Position) -> List[str]:
        zones = []
        for zone_name, coords in self.boundary_zones.items():
            if (pos.x, pos.y) in coords:
                zones.append(zone_name)
        return zones

    def is_boundary_crossing(self, start: Position, end: Position) -> Tuple[bool, List[str], List[str]]:
        start_zones = self.get_zone(start)
        end_zones = self.get_zone(end)
        crossed = []
        for zone in start_zones:
            if zone not in end_zones:
                crossed.append(zone)
        for zone in end_zones:
            if zone not in start_zones and zone not in crossed:
                crossed.append(zone)
        return (len(crossed) > 0), start_zones + end_zones, crossed

    def is_impassable(self, pos: Position) -> bool:
        return (pos.x, pos.y) in self.impassable

    def calculate_distance(self, start: Position, end: Position) -> float:
        return math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2)


class AnomalyDetector:
    def __init__(self, units: Dict[str, Unit]):
        self.units = units
        self.canyon_map = CanyonMap()
        self.boundary_analyses: List[BoundaryCrossingAnalysis] = []

    def detect_all(self, records: List[BattleRecord], settlements: List[SettlementData]):
        for record in records:
            if record.confirmation_status == ConfirmationStatus.REJECTED:
                continue
            self._detect_turn_order_errors(record)
            self._detect_boundary_crossings(record)
        self._detect_report_settlement_mismatches(records, settlements)

    def _detect_turn_order_errors(self, record: BattleRecord):
        actions = sorted(record.actions, key=lambda a: a.timestamp)
        expected_turn = 1
        last_turn = 0
        last_unit_id = None

        for i, action in enumerate(actions):
            if action.turn < last_turn:
                anomaly = AnomalyMark(
                    anomaly_type=AnomalyType.TURN_ORDER_ERROR,
                    description=f"回合顺序错误：第{i+1}个行动回合{action.turn}小于前一行动回合{last_turn}",
                    confidence=0.9,
                    review_reason=f"时间戳顺序显示应在 {actions[i-1].timestamp} 之后，但回合号倒退",
                    evidence_refs=[
                        f"action:{action.action_id}",
                        f"prev_action:{actions[i-1].action_id}",
                        f"file://{record.source_file}#L{record.line_number}"
                    ]
                )
                record.anomalies.append(anomaly)
                record.confirmation_status = ConfirmationStatus.PENDING

            if action.unit_id == last_unit_id and action.turn == last_turn:
                anomaly = AnomalyMark(
                    anomaly_type=AnomalyType.TURN_ORDER_ERROR,
                    description=f"连续行动异常：单位{action.unit_id}在回合{action.turn}连续行动两次",
                    confidence=0.85,
                    review_reason="同一单位在同一回合内不应连续执行两次行动",
                    evidence_refs=[
                        f"action:{action.action_id}",
                        f"prev_action:{actions[i-1].action_id}"
                    ]
                )
                record.anomalies.append(anomaly)
                record.confirmation_status = ConfirmationStatus.PENDING

            last_turn = action.turn
            last_unit_id = action.unit_id

    def _detect_boundary_crossings(self, record: BattleRecord):
        for action in record.actions:
            if action.action_type != 'move':
                continue

            unit = self.units.get(action.unit_id)
            if not unit:
                continue

            crossing, zones, crossed_zones = self.canyon_map.is_boundary_crossing(
                action.start_pos, action.end_pos
            )

            distance = self.canyon_map.calculate_distance(action.start_pos, action.end_pos)
            exceeds_move_range = distance > unit.move_range

            crosses_impassable = self._check_impassable_crossing(action.start_pos, action.end_pos)

            if crossing or exceeds_move_range or crosses_impassable:
                reasons = []
                if crossing:
                    reasons.append(f"穿越边界区域: {', '.join(crossed_zones)}")
                if exceeds_move_range:
                    reasons.append(f"移动距离{distance:.1f}超过单位移动力{unit.move_range}")
                if crosses_impassable:
                    reasons.append("穿越不可通行地形")

                review_reason = "；".join(reasons)
                evidence = [
                    f"map_zone_check: 起点{action.start_pos.x},{action.start_pos.y}→终点{action.end_pos.x},{action.end_pos.y}",
                    f"unit_move_ref: {unit.unit_id} move_range={unit.move_range}",
                    f"file://{unit.source_file}#L{unit.line_number}"
                ]

                analysis = BoundaryCrossingAnalysis(
                    record_id=record.record_id,
                    action_id=action.action_id,
                    unit_id=action.unit_id,
                    start_pos=action.start_pos,
                    end_pos=action.end_pos,
                    boundary_zones=zones,
                    crossing_detected=crossing,
                    review_reason=review_reason,
                    evidence=evidence,
                    map_data_ref="canyon_map_v2",
                    unit_move_ref=f"{unit.source_file}#L{unit.line_number}",
                    confirmation_status=ConfirmationStatus.PENDING
                )
                self.boundary_analyses.append(analysis)

                anomaly = AnomalyMark(
                    anomaly_type=AnomalyType.BOUNDARY_CROSSING,
                    description=f"单位{unit.name}({action.unit_id})边界穿越可疑：{review_reason}",
                    confidence=0.8 if crossing else 0.7,
                    review_reason=review_reason,
                    evidence_refs=evidence + [f"boundary_analysis:{analysis.record_id}:{analysis.action_id}"]
                )
                record.anomalies.append(anomaly)
                record.confirmation_status = ConfirmationStatus.PENDING

    def _check_impassable_crossing(self, start: Position, end: Position) -> bool:
        min_x = min(start.x, end.x)
        max_x = max(start.x, end.x)
        min_y = min(start.y, end.y)
        max_y = max(start.y, end.y)

        for x in range(min_x, max_x + 1):
            for y in range(min_y, max_y + 1):
                if self.canyon_map.is_impassable(Position(x=x, y=y)):
                    return True
        return False

    def _detect_report_settlement_mismatches(self, records: List[BattleRecord],
                                              settlements: List[SettlementData]):
        battle_round_groups = defaultdict(list)
        for record in records:
            if record.confirmation_status == ConfirmationStatus.REJECTED:
                continue
            key = (record.battle_id, record.round_number)
            battle_round_groups[key].append(record)

        settlement_map = {}
        for s in settlements:
            key = (s.battle_id, s.round_number)
            settlement_map[key] = s

        for (battle_id, round_num), recs in battle_round_groups.items():
            settlement = settlement_map.get((battle_id, round_num))
            if not settlement:
                continue

            reported_casualties = self._calculate_report_casualties(recs)
            reported_survivors = self._calculate_report_survivors(recs)

            for unit_id, expected_count in settlement.surviving_units.items():
                reported = reported_survivors.get(unit_id, 0)
                if reported != expected_count:
                    for record in recs:
                        anomaly = AnomalyMark(
                            anomaly_type=AnomalyType.REPORT_SETTLEMENT_MISMATCH,
                            description=f"战报结算不一致：单位{unit_id}战报存活{reported}人，结算存活{expected_count}人",
                            confidence=0.95,
                            review_reason=f"战斗{battle_id}回合{round_num}，单位存活数统计不符，需核对战报行动记录",
                            evidence_refs=[
                                f"battle_report:{record.record_id}",
                                f"settlement:{settlement.settlement_id}",
                                f"file://{settlement.source_file}#L{settlement.line_number}"
                            ]
                        )
                        record.anomalies.append(anomaly)
                        record.confirmation_status = ConfirmationStatus.PENDING

            for unit_id, expected_casualties in settlement.casualties.items():
                reported = reported_casualties.get(unit_id, 0)
                if reported != expected_casualties:
                    for record in recs:
                        anomaly = AnomalyMark(
                            anomaly_type=AnomalyType.REPORT_SETTLEMENT_MISMATCH,
                            description=f"战报结算不一致：单位{unit_id}战报伤亡{reported}人，结算伤亡{expected_casualties}人",
                            confidence=0.95,
                            review_reason=f"战斗{battle_id}回合{round_num}，单位伤亡数统计不符，需核对战报行动记录",
                            evidence_refs=[
                                f"battle_report:{record.record_id}",
                                f"settlement:{settlement.settlement_id}",
                                f"file://{settlement.source_file}#L{settlement.line_number}"
                            ]
                        )
                        record.anomalies.append(anomaly)
                        record.confirmation_status = ConfirmationStatus.PENDING

    def _calculate_report_casualties(self, records: List[BattleRecord]) -> Dict[str, int]:
        casualties = defaultdict(int)
        for record in records:
            for action in record.actions:
                if action.action_type == 'attack' and action.result == 'killed':
                    if action.target_unit_id:
                        casualties[action.target_unit_id] += 1
        return dict(casualties)

    def _calculate_report_survivors(self, records: List[BattleRecord]) -> Dict[str, int]:
        survivors = defaultdict(lambda: 100)
        for record in records:
            for action in record.actions:
                if action.action_type == 'attack' and action.damage_dealt and action.target_unit_id:
                    survivors[action.target_unit_id] -= action.damage_dealt
        return {k: max(0, v) for k, v in survivors.items()}
