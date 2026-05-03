import csv
from typing import List, Dict, Optional
from dataclasses import dataclass


@dataclass
class TeamMember:
    name: str
    role: str
    body_weight: float
    pack_weight: float
    max_recommended_weight: float
    gear_list: List[str] = None

    @property
    def total_weight(self) -> float:
        return self.body_weight + self.pack_weight

    @property
    def weight_ratio(self) -> float:
        if self.body_weight <= 0:
            return 0.0
        return self.pack_weight / self.body_weight * 100


class WeightParser:
    def __init__(self):
        self.team_members: List[TeamMember] = []
        self.metadata: Dict = {}

    def parse(self, file_path: str) -> None:
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                gear_list = []
                if 'gear_list' in row and row['gear_list']:
                    gear_list = [g.strip() for g in row['gear_list'].split(';') if g.strip()]

                member = TeamMember(
                    name=row['name'],
                    role=row.get('role', '队员'),
                    body_weight=float(row['body_weight']),
                    pack_weight=float(row['pack_weight']),
                    max_recommended_weight=float(row.get('max_recommended_weight', '0')) or 25.0,
                    gear_list=gear_list
                )
                self.team_members.append(member)

        if self.team_members:
            self.metadata = {
                'member_count': len(self.team_members),
                'total_pack_weight': sum(m.pack_weight for m in self.team_members),
                'avg_weight_ratio': sum(m.weight_ratio for m in self.team_members) / len(self.team_members)
            }

    def get_members_over_limit(self) -> List[TeamMember]:
        return [
            member for member in self.team_members
            if member.pack_weight > member.max_recommended_weight
        ]

    def get_members_high_ratio(self, threshold: float = 30.0) -> List[TeamMember]:
        return [
            member for member in self.team_members
            if member.weight_ratio > threshold
        ]

    def validate(self) -> List[str]:
        errors = []

        if not self.team_members:
            errors.append("负重表中未找到任何队员数据")
            return errors

        seen_names = set()
        for i, member in enumerate(self.team_members):
            if not member.name or member.name.strip() == "":
                errors.append(f"第 {i+1} 个队员缺少姓名")

            if member.name in seen_names:
                errors.append(f"队员姓名重复: {member.name}")
            seen_names.add(member.name)

            if member.body_weight <= 0:
                errors.append(f"队员 {member.name} 体重值异常: {member.body_weight}kg")

            if member.pack_weight < 0:
                errors.append(f"队员 {member.name} 负重值异常: {member.pack_weight}kg")

            if member.max_recommended_weight <= 0:
                errors.append(f"队员 {member.name} 建议最大负重值异常: {member.max_recommended_weight}kg")

        return errors
