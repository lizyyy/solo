from datetime import datetime, date
from typing import List, Dict, Set
from collections import defaultdict

from ..models import (
    Player,
    Group,
    Material,
    Substitute,
    CheckinEvent,
    ValidationIssue,
    ValidationStatus,
    IssueSeverity,
    RuleType,
    PlayerQualification,
    QualificationReport,
)


class CheckResult:
    def __init__(self):
        self.issues: List[ValidationIssue] = []

    def add_issue(self, issue: ValidationIssue):
        self.issues.append(issue)

    def has_errors(self) -> bool:
        return any(i.severity == IssueSeverity.ERROR for i in self.issues)


class ValidationEngine:
    def __init__(
        self,
        players: List[Player],
        groups: List[Group],
        materials: List[Material],
        substitutes: List[Substitute],
        checkins: List[CheckinEvent],
    ):
        self.players = sorted(players, key=lambda p: p.player_id)
        self.groups = {g.group_id: g for g in groups}
        self.materials: Dict[str, List[Material]] = defaultdict(list)
        for m in sorted(materials, key=lambda x: (x.player_id, x.material_type)):
            self.materials[m.player_id].append(m)
        self.substitutes = sorted(substitutes, key=lambda s: (s.target_group_id, s.priority))
        self.checkins = checkins
        self._group_player_count: Dict[str, int] = defaultdict(int)

    def calculate_age(self, birth_date: date) -> int:
        today = date.today()
        age = today.year - birth_date.year
        if (today.month, today.day) < (birth_date.month, birth_date.day):
            age -= 1
        return age

    def validate_materials(self, player: Player, group: Group) -> CheckResult:
        result = CheckResult()

        for required_material in group.require_materials:
            player_materials = [
                m for m in self.materials.get(player.player_id, [])
                if m.material_type == required_material
            ]

            if not player_materials:
                result.add_issue(ValidationIssue(
                    rule_type=RuleType.MATERIAL_CHECK,
                    severity=IssueSeverity.ERROR,
                    message=f"缺少必需材料: {required_material}",
                    source=player.source,
                    details={"player_id": player.player_id, "material": required_material},
                ))
            else:
                material = player_materials[0]
                if material.material_status in ["未上传", "已过期"]:
                    result.add_issue(ValidationIssue(
                        rule_type=RuleType.MATERIAL_CHECK,
                        severity=IssueSeverity.ERROR,
                        message=f"材料状态无效: {required_material} ({material.material_status})",
                        source=player.source,
                        details={"player_id": player.player_id, "material": required_material, "status": material.material_status},
                    ))

        return result

    def validate_group_restrictions(self, player: Player, group: Group) -> CheckResult:
        result = CheckResult()

        if group.allowed_gender and player.gender:
            if player.gender not in [group.allowed_gender, group.allowed_gender[0]]:
                result.add_issue(ValidationIssue(
                    rule_type=RuleType.GROUP_RESTRICTION,
                    severity=IssueSeverity.ERROR,
                    message=f"性别不符合组别要求: 需要{group.allowed_gender}",
                    source=player.source,
                    details={"player_id": player.player_id, "gender": player.gender, "required": group.allowed_gender},
                ))

        if player.birth_date:
            age = self.calculate_age(player.birth_date)
            if group.min_age is not None and age < group.min_age:
                result.add_issue(ValidationIssue(
                    rule_type=RuleType.GROUP_RESTRICTION,
                    severity=IssueSeverity.ERROR,
                    message=f"年龄低于组别下限: {age} < {group.min_age}",
                    source=player.source,
                    details={"player_id": player.player_id, "age": age, "min_age": group.min_age},
                ))
            if group.max_age is not None and age > group.max_age:
                result.add_issue(ValidationIssue(
                    rule_type=RuleType.GROUP_RESTRICTION,
                    severity=IssueSeverity.ERROR,
                    message=f"年龄超过组别上限: {age} > {group.max_age}",
                    source=player.source,
                    details={"player_id": player.player_id, "age": age, "max_age": group.max_age},
                ))

        return result

    def validate_duplicate_checkin(self, player: Player) -> CheckResult:
        result = CheckResult()

        player_checkins = [c for c in self.checkins if c.player_id == player.player_id]
        if len(player_checkins) > 1:
            result.add_issue(ValidationIssue(
                rule_type=RuleType.DUPLICATE_CHECKIN,
                severity=IssueSeverity.WARNING,
                message=f"重复检录: 已检录 {len(player_checkins)} 次",
                source=player.source,
                details={"player_id": player.player_id, "checkin_count": len(player_checkins)},
            ))

        return result

    def validate_substitute_eligibility(self, player: Player, target_group_id: str) -> CheckResult:
        result = CheckResult()

        group = self.groups.get(target_group_id)
        if not group:
            result.add_issue(ValidationIssue(
                rule_type=RuleType.SUBSTITUTE_ELIGIBILITY,
                severity=IssueSeverity.ERROR,
                message=f"替补目标组别不存在: {target_group_id}",
                source=player.source,
                details={"player_id": player.player_id, "target_group": target_group_id},
            ))
            return result

        material_result = self.validate_materials(player, group)
        result.issues.extend(material_result.issues)

        group_result = self.validate_group_restrictions(player, group)
        result.issues.extend(group_result.issues)

        return result

    def process_substitute_promotion(self, player_qualifications: Dict[str, PlayerQualification]):
        group_players: Dict[str, List[str]] = defaultdict(list)

        for pq in player_qualifications.values():
            if pq.is_qualified and not pq.is_substitute:
                group_players[pq.player.group_id].append(pq.player.player_id)

        for group_id, group in self.groups.items():
            if group.max_players:
                current_count = len(group_players.get(group_id, []))
                if current_count < group.max_players:
                    needed = group.max_players - current_count
                    group_substitutes = [
                        s for s in self.substitutes
                        if s.target_group_id == group_id
                    ]

                    promoted = 0
                    for sub in sorted(group_substitutes, key=lambda x: x.priority):
                        if promoted >= needed:
                            break

                        pq = player_qualifications.get(sub.player_id)
                        if pq and pq.is_qualified:
                            old_group = pq.player.group_id
                            if old_group in group_players:
                                group_players[old_group] = [
                                    pid for pid in group_players[old_group]
                                    if pid != sub.player_id
                                ]

                            pq.player.group_id = group_id
                            pq.is_substitute = True
                            pq.substitute_priority = sub.priority
                            group_players[group_id].append(sub.player_id)
                            promoted += 1

    def run_validation(self) -> QualificationReport:
        player_qualifications: Dict[str, PlayerQualification] = {}
        all_issues: List[ValidationIssue] = []

        for player in self.players:
            group = self.groups.get(player.group_id)
            issues: List[ValidationIssue] = []

            if not group:
                issues.append(ValidationIssue(
                    rule_type=RuleType.GROUP_RESTRICTION,
                    severity=IssueSeverity.ERROR,
                    message=f"所属组别不存在: {player.group_id}",
                    source=player.source,
                ))
            else:
                material_result = self.validate_materials(player, group)
                issues.extend(material_result.issues)

                group_result = self.validate_group_restrictions(player, group)
                issues.extend(group_result.issues)

            checkin_result = self.validate_duplicate_checkin(player)
            issues.extend(checkin_result.issues)

            has_errors = any(i.severity == IssueSeverity.ERROR for i in issues)
            has_warnings = any(i.severity == IssueSeverity.WARNING for i in issues)

            if has_errors:
                overall_status = ValidationStatus.FAIL
            elif has_warnings:
                overall_status = ValidationStatus.WARNING
            else:
                overall_status = ValidationStatus.PASS

            checkin_count = sum(1 for c in self.checkins if c.player_id == player.player_id)

            player_qualifications[player.player_id] = PlayerQualification(
                player=player,
                overall_status=overall_status,
                issues=issues,
                is_qualified=not has_errors,
                checkin_count=checkin_count,
            )
            all_issues.extend(issues)

        self.process_substitute_promotion(player_qualifications)

        qualified_count = sum(1 for pq in player_qualifications.values() if pq.is_qualified)
        disqualified_count = sum(1 for pq in player_qualifications.values() if not pq.is_qualified)
        warning_count = sum(1 for pq in player_qualifications.values() if pq.overall_status == ValidationStatus.WARNING)
        pending_count = sum(1 for pq in player_qualifications.values() if pq.overall_status == ValidationStatus.PENDING)

        return QualificationReport(
            report_id=f"RPT-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            generated_at=datetime.now(),
            total_players=len(self.players),
            qualified_count=qualified_count,
            disqualified_count=disqualified_count,
            warning_count=warning_count,
            pending_count=pending_count,
            player_qualifications=list(player_qualifications.values()),
            all_issues=sorted(all_issues, key=lambda x: (x.severity, x.rule_type)),
        )


def run_full_validation(
    players: List[Player],
    groups: List[Group],
    materials: List[Material],
    substitutes: List[Substitute],
    checkins: List[CheckinEvent],
) -> QualificationReport:
    engine = ValidationEngine(players, groups, materials, substitutes, checkins)
    return engine.run_validation()
