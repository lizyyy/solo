from typing import List, Dict, Tuple
from collections import defaultdict
from models import (
    Track, RightsHolder, Contract, RoyaltySplit, PlatformDeduction,
    ValidationIssue, MatrixRow, ValidationResult, RightType, Platform
)


class RoyaltyMatrixValidator:
    def __init__(self):
        self.tracks: Dict[str, Track] = {}
        self.rights_holders: Dict[str, RightsHolder] = {}
        self.contracts: Dict[str, Contract] = {}
        self.splits: List[RoyaltySplit] = []
        self.deductions: List[PlatformDeduction] = []

    def add_track(self, track: Track):
        self.tracks[track.id] = track

    def add_rights_holder(self, rh: RightsHolder):
        self.rights_holders[rh.id] = rh

    def add_contract(self, contract: Contract):
        self.contracts[contract.id] = contract

    def add_split(self, split: RoyaltySplit):
        self.splits.append(split)

    def add_deduction(self, deduction: PlatformDeduction):
        self.deductions.append(deduction)

    def build_matrix(self, filters: Dict = None) -> List[MatrixRow]:
        matrix = []
        filters = filters or {}

        for split in self.splits:
            track = self.tracks.get(split.track_id)
            if not track:
                continue

            if filters.get('track_id') and split.track_id != filters['track_id']:
                continue
            if filters.get('right_type') and split.right_type.value != filters['right_type']:
                continue
            if filters.get('platform'):
                split_platform = split.platform.value if split.platform else '全部平台'
                if split_platform != filters['platform']:
                    continue

            rights_holder = self.rights_holders.get(split.rights_holder_id)
            contract = self.contracts.get(split.contract_id)
            platform = split.platform.value if split.platform else '全部平台'

            row = MatrixRow(
                track_title=track.title,
                track_id=track.id,
                right_type=split.right_type.value,
                rights_holder=rights_holder.name if rights_holder else '未知',
                platform=platform,
                split_ratio=split.split_ratio,
                contract_version=contract.version if contract else '未知',
                source_ref=split.source_ref
            )
            matrix.append(row)

        return matrix

    def validate_ratio_completeness(self) -> List[ValidationIssue]:
        issues = []

        grouped = defaultdict(list)
        for split in self.splits:
            key = (split.track_id, split.right_type, split.platform)
            grouped[key].append(split)

        for (track_id, right_type, platform), splits in grouped.items():
            total = sum(s.split_ratio for s in splits)
            track = self.tracks.get(track_id)
            platform_name = platform.value if platform else '全部平台'

            if abs(total - 1.0) > 0.001:
                evidence = []
                for s in splits:
                    rh = self.rights_holders.get(s.rights_holder_id)
                    evidence.append({
                        '权利人': rh.name if rh else '未知',
                        '比例': f"{s.split_ratio:.2%}",
                        '来源': s.source_ref
                    })

                diff = total - 1.0
                issues.append(ValidationIssue(
                    level='error' if abs(diff) > 0.05 else 'warning',
                    category='比例不闭合',
                    message=f"曲目[{track.title if track else track_id}] {right_type.value}在{platform_name}"
                           f"的分成比例总和为{total:.2%}，与100%相差{diff:+.2%}",
                    evidence=evidence,
                    track_id=track_id,
                    right_type=right_type.value,
                    platform=platform_name
                ))

        return issues

    def validate_contract_versions(self) -> List[ValidationIssue]:
        issues = []

        track_contracts = defaultdict(list)
        for contract in self.contracts.values():
            if contract.is_active:
                track_contracts[contract.track_id].append(contract)

        for track_id, contracts in track_contracts.items():
            if len(contracts) > 1:
                track = self.tracks.get(track_id)
                evidence = []
                for c in contracts:
                    evidence.append({
                        '合同版本': c.version,
                        '生效日期': str(c.effective_date),
                        '失效日期': str(c.expiry_date) if c.expiry_date else '永久'
                    })

                issues.append(ValidationIssue(
                    level='warning',
                    category='合同版本冲突',
                    message=f"曲目[{track.title if track else track_id}]存在{len(contracts)}个生效合同版本",
                    evidence=evidence,
                    track_id=track_id
                ))

        return issues

    def validate_duplicate_deductions(self) -> List[ValidationIssue]:
        issues = []

        grouped = defaultdict(list)
        for ded in self.deductions:
            key = (ded.track_id, ded.platform, ded.deduction_type)
            grouped[key].append(ded)

        for (track_id, platform, ded_type), ded_list in grouped.items():
            if len(ded_list) > 1:
                track = self.tracks.get(track_id)
                evidence = []
                total_ratio = 0
                for d in ded_list:
                    evidence.append({
                        '扣费类型': d.deduction_type,
                        '比例': f"{d.deduction_ratio:.2%}",
                        '来源': d.source_ref
                    })
                    total_ratio += d.deduction_ratio

                issues.append(ValidationIssue(
                    level='error' if total_ratio > 0.5 else 'warning',
                    category='平台扣费重复',
                    message=f"曲目[{track.title if track else track_id}]在{platform.value}的"
                           f"{ded_type}存在{len(ded_list)}次扣费，总计{total_ratio:.2%}",
                    evidence=evidence,
                    track_id=track_id,
                    platform=platform.value
                ))

        return issues

    def validate_all(self, filters: Dict = None) -> ValidationResult:
        issues = []
        issues.extend(self.validate_ratio_completeness())
        issues.extend(self.validate_contract_versions())
        issues.extend(self.validate_duplicate_deductions())

        if filters:
            def match_filter(issue: ValidationIssue) -> bool:
                if filters.get('track_id') and issue.track_id != filters['track_id']:
                    return False
                if filters.get('right_type'):
                    if issue.right_type is None:
                        return False
                    if issue.right_type != filters['right_type']:
                        return False
                if filters.get('platform'):
                    if issue.platform is None:
                        return False
                    if issue.platform != filters['platform']:
                        return False
                return True

            issues = [i for i in issues if match_filter(i)]

        matrix = self.build_matrix(filters)

        is_valid = all(i.level != 'error' for i in issues)

        summary = {
            '总记录数': len(matrix),
            '错误数': sum(1 for i in issues if i.level == 'error'),
            '警告数': sum(1 for i in issues if i.level == 'warning'),
            '涉及曲目数': len(set(r.track_id for r in matrix)),
            '平台数': len(set(r.platform for r in matrix)),
            '权利类型数': len(set(r.right_type for r in matrix))
        }

        return ValidationResult(
            is_valid=is_valid,
            issues=issues,
            matrix=matrix,
            summary=summary
        )
