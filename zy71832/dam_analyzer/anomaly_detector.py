from typing import List, Dict, Set
from collections import defaultdict
from .config import Config
from .models import BattleRecord, Anomaly, AnomalyType


class AnomalyDetector:
    def __init__(self, config: Config):
        self.config = config
        self.anomalies: List[Anomaly] = []

    def detect_all(self, records: List[BattleRecord]) -> List[Anomaly]:
        self.anomalies = []

        self._detect_missing_rounds(records)
        self._detect_duplicate_actions(records)
        self._detect_abnormal_damage(records)
        self._detect_abnormal_healing(records)
        self._detect_invalid_teams(records)
        self._detect_missing_fields(records)
        self._detect_order_errors(records)

        return self.anomalies

    def _detect_missing_rounds(self, records: List[BattleRecord]) -> None:
        if not records:
            return

        round_numbers = {r.round_num for r in records}
        min_round = min(round_numbers)
        max_round = max(round_numbers)

        missing_rounds = []
        for r in range(min_round, max_round + 1):
            if r not in round_numbers:
                missing_rounds.append(r)

        if missing_rounds:
            self.anomalies.append(
                Anomaly(
                    anomaly_type=AnomalyType.MISSING_ROUND,
                    description=f"检测到缺失回合: {', '.join(map(str, missing_rounds))}",
                    affected_records=[],
                    round_num=missing_rounds[0] if missing_rounds else None,
                    severity="high",
                )
            )

    def _detect_duplicate_actions(self, records: List[BattleRecord]) -> None:
        action_counts: Dict[str, List[str]] = defaultdict(list)

        for record in records:
            key = f"{record.round_num}_{record.team}_{record.player_id}_{record.action_type}"
            action_counts[key].append(record.record_id)

        for key, record_ids in action_counts.items():
            if len(record_ids) > 1:
                parts = key.split("_")
                self.anomalies.append(
                    Anomaly(
                        anomaly_type=AnomalyType.DUPLICATE_ACTION,
                        description=f"第{parts[0]}回合 {parts[1]} {parts[2]} 的 {parts[3]} 存在重复记录",
                        affected_records=record_ids,
                        round_num=int(parts[0]),
                        severity="medium",
                    )
                )

    def _detect_abnormal_damage(self, records: List[BattleRecord]) -> None:
        threshold = self.config.damage_threshold

        for record in records:
            if record.damage is not None and record.damage > threshold:
                self.anomalies.append(
                    Anomaly(
                        anomaly_type=AnomalyType.ABNORMAL_DAMAGE,
                        description=f"伤害值 {record.damage} 超过阈值 {threshold}",
                        affected_records=[record.record_id],
                        round_num=record.round_num,
                        severity="medium",
                    )
                )

    def _detect_abnormal_healing(self, records: List[BattleRecord]) -> None:
        threshold = self.config.healing_threshold

        for record in records:
            if record.healing is not None and record.healing > threshold:
                self.anomalies.append(
                    Anomaly(
                        anomaly_type=AnomalyType.ABNORMAL_HEALING,
                        description=f"治疗值 {record.healing} 超过阈值 {threshold}",
                        affected_records=[record.record_id],
                        round_num=record.round_num,
                        severity="medium",
                    )
                )

    def _detect_invalid_teams(self, records: List[BattleRecord]) -> None:
        expected_teams = set(self.config.expected_teams)
        invalid_records = []

        for record in records:
            if record.team not in expected_teams:
                invalid_records.append(record.record_id)

        if invalid_records:
            self.anomalies.append(
                Anomaly(
                    anomaly_type=AnomalyType.INVALID_TEAM,
                    description=f"存在 {len(invalid_records)} 条记录阵营不在预期列表中",
                    affected_records=invalid_records,
                    severity="low",
                )
            )

    def _detect_missing_fields(self, records: List[BattleRecord]) -> None:
        missing_records = []

        for record in records:
            if not record.player_id or record.player_id == "未知玩家":
                missing_records.append(record.record_id)
            elif not record.action_type or record.action_type == "未知行动":
                missing_records.append(record.record_id)

        if missing_records:
            self.anomalies.append(
                Anomaly(
                    anomaly_type=AnomalyType.MISSING_FIELD,
                    description=f"存在 {len(missing_records)} 条记录缺少必要字段",
                    affected_records=missing_records,
                    severity="low",
                )
            )

    def _detect_order_errors(self, records: List[BattleRecord]) -> None:
        round_records: Dict[int, Dict[str, List[BattleRecord]]] = defaultdict(
            lambda: defaultdict(list)
        )

        for record in records:
            round_records[record.round_num][record.team].append(record)

        expected_teams = self.config.expected_teams
        order_errors = []

        for round_num in sorted(round_records.keys()):
            teams_in_round = round_records[round_num].keys()

            for i, team in enumerate(expected_teams):
                if team not in teams_in_round:
                    continue

                team_records = round_records[round_num][team]
                for record in team_records:
                    if record.notes and "来源行号" in record.notes:
                        try:
                            line_num = int(record.notes.split(":")[-1].strip())
                        except ValueError:
                            line_num = 0
                    else:
                        line_num = 0

                    for other_team in expected_teams[i + 1 :]:
                        if other_team in teams_in_round:
                            for other_record in round_records[round_num][other_team]:
                                if other_record.notes and "来源行号" in other_record.notes:
                                    try:
                                        other_line = int(other_record.notes.split(":")[-1].strip())
                                    except ValueError:
                                        other_line = 0
                                else:
                                    other_line = 0

                                if other_line < line_num:
                                    order_errors.append(record.record_id)
                                    order_errors.append(other_record.record_id)

        order_errors = list(set(order_errors))
        if order_errors:
            self.anomalies.append(
                Anomaly(
                    anomaly_type=AnomalyType.ORDER_ERROR,
                    description=f"检测到回合顺序可能错误，建议检查战报原文行号",
                    affected_records=order_errors[:10],
                    severity="low",
                )
            )

    def resolve_anomaly(self, anomaly_index: int, resolve_note: str = "") -> bool:
        if 0 <= anomaly_index < len(self.anomalies):
            self.anomalies[anomaly_index].resolved = True
            self.anomalies[anomaly_index].resolve_note = resolve_note
            return True
        return False

    def get_anomalies_by_severity(self, severity: str) -> List[Anomaly]:
        return [a for a in self.anomalies if a.severity == severity]

    def get_unresolved_anomalies(self) -> List[Anomaly]:
        return [a for a in self.anomalies if not a.resolved]

    def get_anomaly_summary(self) -> Dict[str, int]:
        summary = {
            "total": len(self.anomalies),
            "high": len([a for a in self.anomalies if a.severity == "high"]),
            "medium": len([a for a in self.anomalies if a.severity == "medium"]),
            "low": len([a for a in self.anomalies if a.severity == "low"]),
            "resolved": len([a for a in self.anomalies if a.resolved]),
            "unresolved": len([a for a in self.anomalies if not a.resolved]),
        }
        return summary
