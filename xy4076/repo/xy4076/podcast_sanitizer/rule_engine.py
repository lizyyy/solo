import re
from typing import List, Tuple, Dict, Optional
from datetime import timedelta
from collections import defaultdict

from .models import Subtitle, SensitiveRule, ScanIssue, IssueType, MaskMapping


class RuleEngine:
    def __init__(self, rules: List[SensitiveRule] = None):
        self.rules: List[SensitiveRule] = rules or []
        self._compiled_patterns: Dict[int, re.Pattern] = {}
        self._compile_patterns()

    def _compile_patterns(self):
        self._compiled_patterns = {}
        for rule in self.rules:
            try:
                self._compiled_patterns[rule.id] = re.compile(rule.pattern, re.UNICODE)
            except re.error:
                continue

    def update_rules(self, rules: List[SensitiveRule]):
        self.rules = rules
        self._compile_patterns()

    def match_subtitle(self, subtitle: Subtitle) -> List[Tuple[SensitiveRule, str, Tuple[int, int]]]:
        matches: List[Tuple[SensitiveRule, str, Tuple[int, int]]] = []
        text = subtitle.text

        for rule in self.rules:
            pattern = self._compiled_patterns.get(rule.id)
            if not pattern:
                continue

            for match in pattern.finditer(text):
                matched_text = match.group()
                start_pos, end_pos = match.span()
                matches.append((rule, matched_text, (start_pos, end_pos)))

        return matches

    def scan_for_sensitive_words(self, subtitles: List[Subtitle],
                                  starting_issue_id: int = 1) -> List[ScanIssue]:
        issues: List[ScanIssue] = []
        issue_id = starting_issue_id

        for subtitle in subtitles:
            matches = self.match_subtitle(subtitle)

            seen_positions = set()
            for rule, matched_text, (start_pos, end_pos) in matches:
                position_key = (start_pos, end_pos)
                if position_key in seen_positions:
                    continue
                seen_positions.add(position_key)

                issues.append(ScanIssue(
                    id=issue_id,
                    issue_type=IssueType.SENSITIVE_WORD,
                    subtitle_id=subtitle.id,
                    start_time=subtitle.start_time,
                    end_time=subtitle.end_time,
                    description=f"检测到敏感词 [{matched_text}]，类别: {rule.category} - {rule.description}",
                    severity="high",
                    sensitive_match=matched_text
                ))
                issue_id += 1

        return issues

    def get_sensitive_statistics(self, subtitles: List[Subtitle]) -> Dict:
        stats = {
            "total_matches": 0,
            "by_category": defaultdict(int),
            "by_rule": defaultdict(int),
            "by_subtitle": defaultdict(int)
        }

        for subtitle in subtitles:
            matches = self.match_subtitle(subtitle)
            for rule, matched_text, _ in matches:
                stats["total_matches"] += 1
                stats["by_category"][rule.category] += 1
                stats["by_rule"][rule.pattern] += 1
                stats["by_subtitle"][subtitle.id] += 1

        return {
            "total_matches": stats["total_matches"],
            "by_category": dict(stats["by_category"]),
            "by_rule": dict(stats["by_rule"]),
            "by_subtitle": dict(stats["by_subtitle"])
        }


def create_default_rules() -> List[SensitiveRule]:
    return [
        SensitiveRule(
            id=1,
            pattern=r"1[3-9]\d{9}",
            category="phone",
            description="手机号码",
            mask_template="[PHONE_{index}]"
        ),
        SensitiveRule(
            id=2,
            pattern=r"[\u4e00-\u9fa5]{2,5}(?:省|市|自治区|特别行政区)[\u4e00-\u9fa5]{2,8}(?:区|县|街道|镇)?[\u4e00-\u9fa5]{2,10}(?:路|街|大道|巷|弄)?(?:\d+号?|栋|单元|楼)?",
            category="address",
            description="住址信息",
            mask_template="[ADDRESS_{index}]"
        ),
        SensitiveRule(
            id=3,
            pattern=r"客户[的:：\s]*[\u4e00-\u9fa5]{2,10}|客户名[称:：\s]*[\u4e00-\u9fa5]{2,10}|(?:李|王|张|刘|陈|杨|赵|黄|周|吴)[\u4e00-\u9fa5]{1,3}(?:客户|先生|女士|总|经理|总监|老板)",
            category="client",
            description="客户名称",
            mask_template="[CLIENT_{index}]"
        ),
        SensitiveRule(
            id=4,
            pattern=r"(?:项目|产品|版本|迭代|研发)[编号码:：_\s]*[A-Za-z_]+[\d_-]+|(?:PROJ|PRJ|PROJECT|DEV|REL|VER|SPRINT)[_-]?\d+|(?:内部|保密|机密|绝密)[_\s]*(?:项目|版本|功能|模块)",
            category="project",
            description="内部项目代号",
            mask_template="[PROJECT_{index}]"
        ),
        SensitiveRule(
            id=5,
            pattern=r"\d{3,4}[-\s]?\d{7,8}|\d{4}[-\s]?\d{4}",
            category="phone",
            description="固定电话",
            mask_template="[PHONE_{index}]"
        ),
        SensitiveRule(
            id=6,
            pattern=r"[\w.-]+@[\w.-]+\.\w+",
            category="email",
            description="电子邮箱",
            mask_template="[EMAIL_{index}]"
        ),
        SensitiveRule(
            id=7,
            pattern=r"[A-Za-z]\d{17}[\dXx]|\d{15}",
            category="idcard",
            description="身份证号",
            mask_template="[IDCARD_{index}]"
        ),
    ]
