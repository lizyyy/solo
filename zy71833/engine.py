from typing import Dict, List, Optional, Tuple, Any
from models import (
    UnitConfig,
    BattleMaterial,
    TurnResult,
    BattleResult,
    BattleRecord,
    ChangeLogEntry,
    RECORD_STATUS,
)
from datetime import datetime
import uuid
import json
import os


class BattleEngine:
    TERRAIN_MODIFIERS = {
        "plain": {"attack": 1.0, "defense": 1.0},
        "forest": {"attack": 0.9, "defense": 1.2},
        "mountain": {"attack": 0.8, "defense": 1.4},
        "desert": {"attack": 1.1, "defense": 0.9},
        "ruins": {"attack": 1.05, "defense": 1.05},
    }

    WEATHER_MODIFIERS = {
        "clear": {"attack": 1.0, "defense": 1.0},
        "rain": {"attack": 0.95, "defense": 1.05},
        "fog": {"attack": 0.9, "defense": 1.1},
        "wind": {"attack": 1.05, "defense": 0.95},
        "storm": {"attack": 0.85, "defense": 0.85},
    }

    def __init__(self):
        self.max_turns = 50

    def simulate_battle(self, material: BattleMaterial) -> BattleResult:
        units = {u.unit_id: u for u in material.units}
        current_hp = {u.unit_id: u.hp for u in material.units}
        turn_results = []
        issues = []

        self._validate_turn_order(material, units, issues)

        turn = 1
        while turn <= self.max_turns:
            for actor_id in material.turn_order:
                if actor_id not in units or current_hp[actor_id] <= 0:
                    continue

                alive_enemies = [
                    uid for uid, u in units.items()
                    if uid != actor_id and current_hp[uid] > 0
                ]

                if not alive_enemies:
                    winner = self._determine_winner(current_hp, units)
                    return self._build_result(
                        winner, turn, turn_results, current_hp, issues
                    )

                target_id = alive_enemies[0]
                damage = self._calculate_damage(
                    units[actor_id], units[target_id], material, current_hp
                )
                current_hp[target_id] = max(0, current_hp[target_id] - damage)

                turn_results.append(TurnResult(
                    turn_number=turn,
                    acting_unit=actor_id,
                    target_unit=target_id,
                    action="attack",
                    damage=damage,
                    remaining_hp=dict(current_hp),
                ))

                self._check_balance_issues(current_hp, units, turn, issues)

                if current_hp[target_id] <= 0 and len([
                    uid for uid in current_hp if current_hp[uid] > 0
                ]) <= 1:
                    winner = self._determine_winner(current_hp, units)
                    return self._build_result(
                        winner, turn, turn_results, current_hp, issues
                    )

            turn += 1

        winner = self._determine_winner(current_hp, units)
        issues.append(f"战斗超过{self.max_turns}回合，强制结束")
        return self._build_result(
            winner, self.max_turns, turn_results, current_hp, issues
        )

    def _validate_turn_order(
        self,
        material: BattleMaterial,
        units: Dict[str, UnitConfig],
        issues: List[str]
    ) -> None:
        for uid in material.turn_order:
            if uid not in units:
                issues.append(f"回合顺序中的单位 {uid} 不存在于单位列表")

        for uid in units:
            if uid not in material.turn_order:
                issues.append(f"单位 {uid} 未包含在回合顺序中")

    def _calculate_damage(
        self,
        attacker: UnitConfig,
        defender: UnitConfig,
        material: BattleMaterial,
        current_hp: Dict[str, int]
    ) -> int:
        terrain_mod = self.TERRAIN_MODIFIERS.get(
            material.terrain, {"attack": 1.0}
        )["attack"]
        weather_mod = self.WEATHER_MODIFIERS.get(
            material.weather, {"attack": 1.0}
        )["attack"]
        terrain_def_mod = self.TERRAIN_MODIFIERS.get(
            material.terrain, {"defense": 1.0}
        )["defense"]
        weather_def_mod = self.WEATHER_MODIFIERS.get(
            material.weather, {"defense": 1.0}
        )["defense"]

        effective_attack = attacker.attack * terrain_mod * weather_mod
        effective_defense = defender.defense * terrain_def_mod * weather_def_mod

        base_damage = max(1, effective_attack - effective_defense * 0.5)

        for skill in attacker.skills:
            if skill == "暴击":
                base_damage *= 1.5
            elif skill == "穿透":
                effective_defense *= 0.7
                base_damage = max(1, effective_attack - effective_defense * 0.5)

        return int(base_damage)

    def _determine_winner(
        self, current_hp: Dict[str, int], units: Dict[str, UnitConfig]
    ) -> str:
        alive = [uid for uid, hp in current_hp.items() if hp > 0]
        if len(alive) == 1:
            return alive[0]
        alive.sort(key=lambda uid: (-current_hp[uid], -units[uid].speed))
        return alive[0] if alive else "draw"

    def _build_result(
        self,
        winner: str,
        total_turns: int,
        turn_results: List[TurnResult],
        final_hp: Dict[str, int],
        issues: List[str]
    ) -> BattleResult:
        balance_score = self._calculate_balance_score(final_hp, total_turns, turn_results)
        return BattleResult(
            winner=winner,
            total_turns=total_turns,
            turn_results=turn_results,
            final_hp=final_hp,
            balance_score=balance_score,
            issues=issues,
        )

    def _calculate_balance_score(
        self,
        final_hp: Dict[str, int],
        total_turns: int,
        turn_results: List[TurnResult]
    ) -> float:
        if len(final_hp) < 2:
            return 0.0

        max_hp_ratio = min(final_hp.values()) / max(final_hp.values()) if max(final_hp.values()) > 0 else 0

        turn_factor = max(0, 1 - abs(total_turns - 15) / 20)

        damage_distribution = []
        if turn_results:
            damage_by_unit = {}
            for tr in turn_results:
                if tr.acting_unit not in damage_by_unit:
                    damage_by_unit[tr.acting_unit] = 0
                damage_by_unit[tr.acting_unit] += tr.damage
            if damage_by_unit:
                damages = list(damage_by_unit.values())
                avg_damage = sum(damages) / len(damages)
                if avg_damage > 0:
                    variance = sum((d - avg_damage) ** 2 for d in damages) / len(damages)
                    damage_factor = max(0, 1 - (variance ** 0.5) / avg_damage)
                else:
                    damage_factor = 1.0
            else:
                damage_factor = 0.5
        else:
            damage_factor = 0.5

        score = (max_hp_ratio * 0.4 + turn_factor * 0.3 + damage_factor * 0.3) * 100
        return round(score, 2)

    def _check_balance_issues(
        self,
        current_hp: Dict[str, int],
        units: Dict[str, UnitConfig],
        turn: int,
        issues: List[str]
    ) -> None:
        for uid, hp in current_hp.items():
            if hp <= 0 and turn <= 3:
                issues.append(f"单位 {units[uid].name}({uid}) 在第{turn}回合过早阵亡，可能存在平衡性问题")

        if turn <= 5 and len([hp for hp in current_hp.values() if hp > 0]) <= 1:
            issues.append("战斗在5回合内结束，可能存在碾压性优势")


class RecordManager:
    def __init__(self, storage_path: str = "data/records.json"):
        self.storage_path = storage_path
        self.records: Dict[str, BattleRecord] = {}
        self.battle_engine = BattleEngine()
        self._load()

    def _load(self) -> None:
        os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
        if os.path.exists(self.storage_path):
            try:
                with open(self.storage_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                for record_id, record_data in data.items():
                    self.records[record_id] = self._deserialize_record(record_data)
            except (json.JSONDecodeError, FileNotFoundError):
                self.records = {}

    def _save(self) -> None:
        data = {
            rid: record.to_dict()
            for rid, record in self.records.items()
        }
        with open(self.storage_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _deserialize_record(self, data: Dict[str, Any]) -> BattleRecord:
        mat_data = data["material"]
        units = [UnitConfig(**u) for u in mat_data["units"]]
        material = BattleMaterial(
            material_id=mat_data["material_id"],
            source=mat_data["source"],
            units=units,
            terrain=mat_data["terrain"],
            weather=mat_data["weather"],
            turn_order=mat_data["turn_order"],
            special_rules=mat_data.get("special_rules", []),
            version=mat_data.get("version", "1.0"),
        )

        result = None
        if data.get("result"):
            res_data = data["result"]
            turn_results = [TurnResult(**t) for t in res_data["turn_results"]]
            result = BattleResult(
                winner=res_data["winner"],
                total_turns=res_data["total_turns"],
                turn_results=turn_results,
                final_hp=res_data["final_hp"],
                balance_score=res_data["balance_score"],
                issues=res_data.get("issues", []),
            )

        change_log = [ChangeLogEntry(**c) for c in data.get("change_log", [])]

        record = BattleRecord(
            record_id=data["record_id"],
            material=material,
            result=result,
            status=data.get("status", "pending"),
            operator=data.get("operator", ""),
            pending_reason=data.get("pending_reason", ""),
            created_at=data.get("created_at", datetime.now().isoformat()),
            updated_at=data.get("updated_at", datetime.now().isoformat()),
            change_log=change_log,
            material_hash_history=data.get("material_hash_history", []),
            notes=data.get("notes", ""),
        )
        return record

    def add_record(
        self,
        material: BattleMaterial,
        operator: str
    ) -> Tuple[BattleRecord, bool]:
        existing = self.find_duplicate(material)
        is_duplicate = existing is not None

        if is_duplicate:
            return existing, True

        record_id = f"REC-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"
        record = BattleRecord(
            record_id=record_id,
            material=material,
            operator=operator,
            status="pending",
            pending_reason="新提交，待处理",
        )
        record.change_log.append(ChangeLogEntry(
            timestamp=record.created_at,
            operator=operator,
            field_changed="created",
            old_value="",
            new_value="record_created",
            reason=f"由 {operator} 创建记录",
        ))
        self.records[record_id] = record
        self._save()
        return record, False

    def find_duplicate(self, material: BattleMaterial) -> Optional[BattleRecord]:
        for record in self.records.values():
            if record.is_duplicate(material):
                return record
        return None

    def get_record(self, record_id: str) -> Optional[BattleRecord]:
        return self.records.get(record_id)

    def list_records(
        self,
        status: Optional[str] = None,
        source: Optional[str] = None
    ) -> List[BattleRecord]:
        records = list(self.records.values())
        if status:
            records = [r for r in records if r.status == status]
        if source:
            records = [r for r in records if r.material.source == source]
        records.sort(key=lambda r: r.updated_at, reverse=True)
        return records

    def run_battle(self, record_id: str, operator: str) -> BattleRecord:
        record = self.get_record(record_id)
        if not record:
            raise ValueError(f"Record {record_id} not found")

        record.set_status("processing", operator, "开始战斗模拟")
        result = self.battle_engine.simulate_battle(record.material)
        record.set_result(result, operator)
        record.set_status("confirmed", operator, "战斗模拟完成，结果已确认")
        self._save()
        return record

    def update_record_material(
        self,
        record_id: str,
        new_material: BattleMaterial,
        operator: str,
        reason: str
    ) -> Tuple[BattleRecord, Dict[str, Any], bool]:
        record = self.get_record(record_id)
        if not record:
            raise ValueError(f"Record {record_id} not found")

        existing = self.find_duplicate(new_material)
        if existing and existing.record_id != record_id:
            return record, {}, True

        old_hash = record.material.compute_hash()
        diff = record.update_material(new_material, operator, reason)
        new_hash = new_material.compute_hash()

        if old_hash != new_hash and record.result:
            record.set_status(
                "pending",
                operator,
                f"材料变更，需要重新运行：{list(diff.keys())}"
            )
            record.result = None

        self._save()
        return record, diff, False

    def set_record_status(
        self,
        record_id: str,
        status: str,
        operator: str,
        reason: str = ""
    ) -> BattleRecord:
        record = self.get_record(record_id)
        if not record:
            raise ValueError(f"Record {record_id} not found")
        record.set_status(status, operator, reason)
        self._save()
        return record

    def delete_record(self, record_id: str) -> bool:
        if record_id in self.records:
            del self.records[record_id]
            self._save()
            return True
        return False
