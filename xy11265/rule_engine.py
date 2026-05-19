
import re
import hashlib
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime
from models import (
    Transcript, Utterance, QualityRule, ScanResult,
    RuleType, RuleAction
)


class RuleMatch:
    def __init__(
        self,
        rule_code: str,
        rule_type: str,
        action: str,
        reason: str,
        matched_text: Optional[str] = None,
        utterance_id: Optional[int] = None,
        severity: int = 1,
        position_start: Optional[int] = None,
        position_end: Optional[int] = None
    ):
        self.rule_code = rule_code
        self.rule_type = rule_type
        self.action = action
        self.reason = reason
        self.matched_text = matched_text
        self.utterance_id = utterance_id
        self.severity = severity
        self.position_start = position_start
        self.position_end = position_end


class RuleEngine:
    def __init__(self):
        self._rules: List[QualityRule] = []
        self._apology_patterns = [
            r"对不起", r"抱歉", r"不好意思", r"给您添麻烦了",
            r"深表歉意", r"赔礼道歉", r"道歉", r"sorry",
            r"apologize", r"my bad", r"我错了"
        ]
        self._refund_patterns = [
            r"退款", r"退费", r"退钱", r"全额退款", r"部分退款",
            r"给您退", r"退还", r"refund", r"money back",
            r"给您退回", r"帮您退款", r"可以退款"
        ]

    def load_rules(self, rules: List[QualityRule]) -> None:
        self._rules = [r for r in rules if r.is_enabled]

    def get_rules_version(self) -> str:
        if not self._rules:
            return "0"
        sorted_rules = sorted(self._rules, key=lambda r: r.rule_code)
        version_str = "|".join([f"{r.rule_code}:v{r.version}" for r in sorted_rules])
        return hashlib.md5(version_str.encode()).hexdigest()[:8]

    def scan_transcript(
        self,
        transcript: Transcript,
        utterances: List[Utterance]
    ) -> List[RuleMatch]:
        matches = []
        utterance_map = {u.id: u for u in utterances}

        for rule in self._rules:
            rule_matches = self._apply_rule(rule, transcript, utterances)
            matches.extend(rule_matches)

        return matches

    def _apply_rule(
        self,
        rule: QualityRule,
        transcript: Transcript,
        utterances: List[Utterance]
    ) -> List[RuleMatch]:
        rule_type = rule.rule_type
        matches = []

        if rule_type == RuleType.SPEAKER_MISSING.value:
            matches.extend(self._check_speaker_missing(rule, utterances))
        elif rule_type == RuleType.TIMESTAMP_OVERLAP.value:
            matches.extend(self._check_timestamp_overlap(rule, utterances))
        elif rule_type == RuleType.APOLOGY_MISSING.value:
            matches.extend(self._check_apology_missing(rule, transcript, utterances))
        elif rule_type == RuleType.REFUND_PROMISE_MISSING.value:
            matches.extend(self._check_refund_promise_missing(rule, transcript, utterances))
        elif rule_type == RuleType.SENSITIVE_WORD.value:
            matches.extend(self._check_sensitive_words(rule, utterances))
        elif rule_type == RuleType.CUSTOM.value:
            matches.extend(self._check_custom_rule(rule, utterances))

        return matches

    def _check_speaker_missing(
        self,
        rule: QualityRule,
        utterances: List[Utterance]
    ) -> List[RuleMatch]:
        matches = []
        config = rule.rule_config or {}
        min_speakers = config.get("min_speakers", 2)

        speakers = set()
        missing_speaker_utts = []

        for utt in utterances:
            if utt.speaker:
                speakers.add(utt.speaker)
            else:
                missing_speaker_utts.append(utt)

        if len(speakers) < min_speakers:
            matches.append(RuleMatch(
                rule_code=rule.rule_code,
                rule_type=rule.rule_type,
                action=rule.action,
                reason=f"说话人数量不足，仅识别到{len(speakers)}个说话人，最少需要{min_speakers}个",
                severity=rule.severity
            ))

        for utt in missing_speaker_utts:
            matches.append(RuleMatch(
                rule_code=rule.rule_code,
                rule_type=rule.rule_type,
                action=rule.action,
                reason=f"第{utt.utterance_index}条说话人信息缺失",
                matched_text=utt.text[:50],
                utterance_id=utt.id,
                severity=rule.severity
            ))

        return matches

    def _check_timestamp_overlap(
        self,
        rule: QualityRule,
        utterances: List[Utterance]
    ) -> List[RuleMatch]:
        matches = []
        config = rule.rule_config or {}
        max_overlap_seconds = config.get("max_overlap_seconds", 0.5)

        sorted_utts = sorted(utterances, key=lambda u: u.start_time if u.start_time else 0)

        for i in range(len(sorted_utts) - 1):
            curr = sorted_utts[i]
            next_utt = sorted_utts[i + 1]

            if curr.end_time is None or next_utt.start_time is None:
                continue

            overlap = curr.end_time - next_utt.start_time
            if overlap > max_overlap_seconds:
                matches.append(RuleMatch(
                    rule_code=rule.rule_code,
                    rule_type=rule.rule_type,
                    action=rule.action,
                    reason=f"时间戳重叠: 第{curr.utterance_index}条与第{next_utt.utterance_index}条重叠{overlap:.2f}秒，超过允许值{max_overlap_seconds}秒",
                    matched_text=f"{curr.text[:30]}... | {next_utt.text[:30]}...",
                    utterance_id=curr.id,
                    severity=rule.severity
                ))

        return matches

    def _check_apology_missing(
        self,
        rule: QualityRule,
        transcript: Transcript,
        utterances: List[Utterance]
    ) -> List[RuleMatch]:
        matches = []
        config = rule.rule_config or {}
        target_roles = config.get("target_roles", ["agent", "客服"])
        require_apology = config.get("require_apology", True)

        if not require_apology:
            return matches

        all_text = " ".join([utt.text for utt in utterances])
        has_apology = self._match_patterns(all_text, self._apology_patterns)

        if not has_apology:
            matches.append(RuleMatch(
                rule_code=rule.rule_code,
                rule_type=rule.rule_type,
                action=rule.action,
                reason="对话中未检测到道歉用语，外包转写可能遗漏了客服的道歉内容",
                severity=rule.severity
            ))

        return matches

    def _check_refund_promise_missing(
        self,
        rule: QualityRule,
        transcript: Transcript,
        utterances: List[Utterance]
    ) -> List[RuleMatch]:
        matches = []
        config = rule.rule_config or {}

        all_text = " ".join([utt.text for utt in utterances])
        has_complaint = self._match_patterns(all_text, [r"投诉", r"不满", r"问题", r"错误", r"故障"])
        has_refund = self._match_patterns(all_text, self._refund_patterns)

        if has_complaint and not has_refund:
            matches.append(RuleMatch(
                rule_code=rule.rule_code,
                rule_type=rule.rule_type,
                action=rule.action,
                reason="对话中检测到客户投诉/不满，但未检测到退款承诺相关内容，外包转写可能遗漏",
                severity=rule.severity
            ))

        return matches

    def _check_sensitive_words(
        self,
        rule: QualityRule,
        utterances: List[Utterance]
    ) -> List[RuleMatch]:
        matches = []
        config = rule.rule_config or {}
        sensitive_words = config.get("words", [])

        if not sensitive_words:
            return matches

        for utt in utterances:
            for word in sensitive_words:
                if word in utt.text:
                    start_pos = utt.text.find(word)
                    matches.append(RuleMatch(
                        rule_code=rule.rule_code,
                        rule_type=rule.rule_type,
                        action=rule.action,
                        reason=f"检测到敏感词: '{word}'",
                        matched_text=word,
                        utterance_id=utt.id,
                        severity=rule.severity,
                        position_start=start_pos,
                        position_end=start_pos + len(word)
                    ))

        return matches

    def _check_custom_rule(
        self,
        rule: QualityRule,
        utterances: List[Utterance]
    ) -> List[RuleMatch]:
        matches = []
        config = rule.rule_config or {}
        pattern = config.get("regex_pattern")

        if not pattern:
            return matches

        try:
            regex = re.compile(pattern, re.IGNORECASE)
            for utt in utterances:
                for match in regex.finditer(utt.text):
                    matches.append(RuleMatch(
                        rule_code=rule.rule_code,
                        rule_type=rule.rule_type,
                        action=rule.action,
                        reason=f"匹配自定义规则: {rule.rule_name}",
                        matched_text=match.group(),
                        utterance_id=utt.id,
                        severity=rule.severity,
                        position_start=match.start(),
                        position_end=match.end()
                    ))
        except re.error:
            pass

        return matches

    def _match_patterns(self, text: str, patterns: List[str]) -> bool:
        for pattern in patterns:
            if re.search(pattern, text, re.IGNORECASE):
                return True
        return False


def create_default_rules(session) -> List[QualityRule]:
    default_rules = [
        {
            "rule_code": "SPEAKER_MISSING",
            "rule_name": "说话人缺失检测",
            "rule_type": RuleType.SPEAKER_MISSING.value,
            "description": "检测说话人数量不足或单条说话人缺失",
            "rule_config": {"min_speakers": 2},
            "action": RuleAction.BLOCK.value,
            "severity": 2
        },
        {
            "rule_code": "TIMESTAMP_OVERLAP",
            "rule_name": "时间戳重叠检测",
            "rule_type": RuleType.TIMESTAMP_OVERLAP.value,
            "description": "检测对话时间戳重叠异常",
            "rule_config": {"max_overlap_seconds": 0.5},
            "action": RuleAction.WARN.value,
            "severity": 1
        },
        {
            "rule_code": "APOLOGY_MISSING",
            "rule_name": "道歉用语缺失检测",
            "rule_type": RuleType.APOLOGY_MISSING.value,
            "description": "检测客服对话中是否缺失道歉用语",
            "rule_config": {"require_apology": True, "target_roles": ["agent", "客服"]},
            "action": RuleAction.BLOCK.value,
            "severity": 3
        },
        {
            "rule_code": "REFUND_MISSING",
            "rule_name": "退款承诺缺失检测",
            "rule_type": RuleType.REFUND_PROMISE_MISSING.value,
            "description": "检测有投诉时是否缺失退款承诺",
            "rule_config": {},
            "action": RuleAction.BLOCK.value,
            "severity": 3
        },
        {
            "rule_code": "SENSITIVE_WORDS",
            "rule_name": "敏感词检测",
            "rule_type": RuleType.SENSITIVE_WORD.value,
            "description": "检测对话中的敏感词汇",
            "rule_config": {
                "words": [
                    "傻逼", "操你妈", "去死", "垃圾",
                    "滚蛋", "他妈的", "混蛋", "弱智"
                ]
            },
            "action": RuleAction.BLOCK.value,
            "severity": 3
        }
    ]

    created_rules = []
    for rule_data in default_rules:
        existing = session.query(QualityRule).filter_by(rule_code=rule_data["rule_code"]).first()
        if not existing:
            rule = QualityRule(**rule_data, version=1)
            session.add(rule)
            created_rules.append(rule)

    session.commit()
    return created_rules
