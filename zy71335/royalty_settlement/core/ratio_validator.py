from typing import List, Tuple, Dict
from ..models import Track, Issue, IssueCategory, IssueSeverity, Warning


class RatioValidator:
    def __init__(self, tolerance: float = 0.001):
        self.tolerance = tolerance
        self.issues: List[Issue] = []
        self.warnings: List[Warning] = []

    def validate(self, tracks: List[Track]) -> Tuple[List[Track], List[Issue], List[Warning]]:
        self.issues = []
        self.warnings = []
        validated_tracks: List[Track] = []

        for track in tracks:
            validated_track, track_issues, track_warnings = self._validate_track_ratios(track)
            validated_tracks.append(validated_track)
            self.issues.extend(track_issues)
            self.warnings.extend(track_warnings)

        return validated_tracks, self.issues, self.warnings

    def _validate_track_ratios(self, track: Track) -> Tuple[Track, List[Issue], List[Warning]]:
        issues: List[Issue] = []
        warnings: List[Warning] = []

        if not track.authors:
            issues.append(Issue(
                category=IssueCategory.RATIO_ISSUE,
                severity=IssueSeverity.ERROR,
                message=f"曲目[{track.name}]未设置任何作者分成",
                reason="曲目作者信息缺失",
                affected_items=[track.name],
                impact="该曲目所有收入将暂时无法分配，需人工处理",
                next_steps=[
                    "补全曲目作者信息",
                    "确认各作者分成比例",
                    "重新计算分账"
                ]
            ))
            return track, issues, warnings

        total_ratio = sum(a.ratio for a in track.authors)
        author_names = [a.author_name for a in track.authors]

        if abs(total_ratio - 1.0) > self.tolerance:
            if total_ratio < 1.0 - self.tolerance:
                deficit = 1.0 - total_ratio
                severity = IssueSeverity.WARNING if deficit < 0.1 else IssueSeverity.ERROR
                issues.append(Issue(
                    category=IssueCategory.RATIO_ISSUE,
                    severity=severity,
                    message=f"曲目[{track.name}]作者分成比例总和为{total_ratio:.4f}，不足100%",
                    reason=f"比例缺口{deficit:.4f}({deficit*100:.2f}%)，可能是遗漏了部分作者",
                    affected_items=author_names,
                    impact=f"缺口部分的收入({deficit*100:.2f}%)将暂时挂账，待确认后分配",
                    next_steps=[
                        "检查是否遗漏了作者",
                        "确认各作者实际分成比例",
                        "调整比例后重新计算"
                    ]
                ))
            elif total_ratio > 1.0 + self.tolerance:
                excess = total_ratio - 1.0
                severity = IssueSeverity.WARNING if excess < 0.1 else IssueSeverity.ERROR
                issues.append(Issue(
                    category=IssueCategory.RATIO_ISSUE,
                    severity=severity,
                    message=f"曲目[{track.name}]作者分成比例总和为{total_ratio:.4f}，超过100%",
                    reason=f"比例超出{excess:.4f}({excess*100:.2f}%)，可能存在重复登记或比例计算错误",
                    affected_items=author_names,
                    impact=f"超出部分将按比例归一化处理，实际分配比例会低于登记值",
                    next_steps=[
                        "核对每位作者的登记比例",
                        "确认是否存在重复登记",
                        "更正比例后重新计算"
                    ]
                ))

            normalized_track = self._normalize_ratios(track, total_ratio)
            warnings.append(Warning(
                category=IssueCategory.RATIO_ISSUE,
                severity=IssueSeverity.INFO,
                message=f"曲目[{track.name}]作者比例已自动归一化处理",
                reason=f"原比例总和{total_ratio:.4f}≠1，已按比例调整",
                affected_items=author_names,
                impact="各作者实际分配比例已按原比例归一化计算",
                next_steps=["确认归一化后的比例是否符合预期"]
            ))
            return normalized_track, issues, warnings

        return track, issues, warnings

    def _normalize_ratios(self, track: Track, total_ratio: float) -> Track:
        normalized_authors = []
        for author in track.authors:
            normalized_ratio = author.ratio / total_ratio if total_ratio > 0 else 0
            new_author = author
            new_author.ratio = normalized_ratio
            new_author.notes = f"{author.notes or ''} 原比例{author.ratio:.4f}，因总和≠1已归一化为{normalized_ratio:.4f}".strip()
            normalized_authors.append(new_author)
        track.authors = normalized_authors
        return track
