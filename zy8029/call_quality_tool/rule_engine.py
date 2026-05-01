import re
from typing import List, Dict, Any, Set, Tuple
from dataclasses import dataclass, field


@dataclass
class Issue:
    call_id: str
    agent_id: str
    issue_type: str
    rule_name: str
    severity: str
    description: str
    utterance_index: int = -1
    timestamp: float = 0.0
    details: Dict[str, Any] = field(default_factory=dict)


class RuleEngine:
    def __init__(self, rules: List[Dict[str, Any]], sensitive_words: List[str]):
        self.rules = rules
        self.sensitive_words = set(sensitive_words)
        self.issues: List[Issue] = []

    def check_opening_missing(self, call: Dict[str, Any]) -> List[Issue]:
        issues = []
        agent_id = call.get('agent_id', 'unknown')
        utterances = call.get('utterances', [])

        if not utterances:
            return issues

        opening_keywords = ['您好', '早上好', '下午好', '晚上好', 'hello', 'hi']
        has_opening = False
        agent_first_utterance_idx = -1

        for i, utt in enumerate(utterances):
            if utt.get('speaker') == 'agent':
                agent_first_utterance_idx = i
                text = utt.get('text', '').lower()
                for keyword in opening_keywords:
                    if keyword.lower() in text:
                        has_opening = True
                        break
                break

        first_speaker = utterances[0].get('speaker') if utterances else None
        if (first_speaker == 'customer' and not has_opening) or (agent_first_utterance_idx > 0 and not has_opening):
            for rule in self.rules:
                if rule.get('type') == 'opening_missing':
                    issues.append(Issue(
                        call_id=call.get('call_id', ''),
                        agent_id=agent_id,
                        issue_type='opening_missing',
                        rule_name=rule.get('name', '开场白缺失'),
                        severity=rule.get('severity', 'medium'),
                        description=rule.get('description', '坐席未说开场白'),
                        utterance_index=agent_first_utterance_idx if agent_first_utterance_idx >= 0 else 0,
                        timestamp=utterances[agent_first_utterance_idx].get('start_time', 0) if agent_first_utterance_idx >= 0 and agent_first_utterance_idx < len(utterances) else 0,
                        details=rule
                    ))
                    break
        return issues

    def check_promise_timing_conflict(self, call: Dict[str, Any]) -> List[Issue]:
        issues = []
        agent_id = call.get('agent_id', 'unknown')
        utterances = call.get('utterances', [])

        promise_patterns = [
            (r'(\d+)\s*(分钟|小时|天|周)', 'time'),
            (r'马上|立刻|立即|很快', 'soon'),
            (r'稍后|一会儿|之后|后来', 'later'),
        ]

        promises: List[Tuple[str, int, float]] = []

        for i, utt in enumerate(utterances):
            if utt.get('speaker') == 'agent':
                text = utt.get('text', '')
                for pattern, ptype in promise_patterns:
                    match = re.search(pattern, text)
                    if match:
                        promises.append((ptype, i, utt.get('start_time', 0)))

        for rule in self.rules:
            if rule.get('type') == 'promise_timing_conflict':
                conflict_pairs = rule.get('conflict_pairs', [])
                for i, (ptype1, idx1, ts1) in enumerate(promises):
                    for ptype2, idx2, ts2 in promises[i+1:]:
                        pair = tuple(sorted([ptype1, ptype2]))
                        if any(sorted(cp) == list(pair) for cp in conflict_pairs):
                            issues.append(Issue(
                                call_id=call.get('call_id', ''),
                                agent_id=agent_id,
                                issue_type='promise_timing_conflict',
                                rule_name=rule.get('name', '承诺时效矛盾'),
                                severity=rule.get('severity', 'high'),
                                description=f'承诺时效矛盾: {ptype1} vs {ptype2}',
                                utterance_index=idx1,
                                timestamp=ts1,
                                details={'promise1': ptype1, 'promise2': ptype2, 'utterance_indices': [idx1, idx2]}
                            ))
                break
        return issues

    def check_sensitive_words(self, call: Dict[str, Any]) -> List[Issue]:
        issues = []
        agent_id = call.get('agent_id', 'unknown')
        utterances = call.get('utterances', [])

        found_rules = set()
        for i, utt in enumerate(utterances):
            if utt.get('speaker') == 'agent':
                text = utt.get('text', '')
                for word in self.sensitive_words:
                    if word in text:
                        for rule in self.rules:
                            if rule.get('type') == 'sensitive_word':
                                issue_key = (i, word)
                                if issue_key not in found_rules:
                                    found_rules.add(issue_key)
                                    issues.append(Issue(
                                        call_id=call.get('call_id', ''),
                                        agent_id=agent_id,
                                        issue_type='sensitive_word',
                                        rule_name=rule.get('name', '敏感词命中'),
                                        severity=rule.get('severity', 'critical'),
                                        description=f'命中敏感词: {word}',
                                        utterance_index=i,
                                        timestamp=utt.get('start_time', 0),
                                        details={'word': word, 'full_text': text}
                                    ))
                                break
        return issues

    def check_long_silence(self, call: Dict[str, Any]) -> List[Issue]:
        issues = []
        agent_id = call.get('agent_id', 'unknown')
        utterances = call.get('utterances', [])

        silence_threshold = 30
        for rule in self.rules:
            if rule.get('type') == 'long_silence':
                silence_threshold = rule.get('threshold', 30)
                break

        for i in range(len(utterances) - 1):
            curr_end = utterances[i].get('end_time', 0)
            next_start = utterances[i + 1].get('start_time', 0)
            silence_duration = next_start - curr_end

            if silence_duration >= silence_threshold:
                for rule in self.rules:
                    if rule.get('type') == 'long_silence':
                        issues.append(Issue(
                            call_id=call.get('call_id', ''),
                            agent_id=agent_id,
                            issue_type='long_silence',
                            rule_name=rule.get('name', '长时间静默'),
                            severity=rule.get('severity', 'medium'),
                            description=f'静默时长: {silence_duration:.1f}秒',
                            utterance_index=i,
                            timestamp=curr_end,
                            details={'silence_duration': silence_duration, 'between_utterances': [i, i+1]}
                        ))
                        break
        return issues

    def analyze_call(self, call: Dict[str, Any]) -> List[Issue]:
        issues = []
        issues.extend(self.check_opening_missing(call))
        issues.extend(self.check_promise_timing_conflict(call))
        issues.extend(self.check_sensitive_words(call))
        issues.extend(self.check_long_silence(call))
        return issues

    def analyze_calls(self, calls: List[Dict[str, Any]]) -> List[Issue]:
        self.issues = []
        for call in calls:
            call_issues = self.analyze_call(call)
            self.issues.extend(call_issues)
        return self.issues

    def get_issues_by_call(self, call_id: str) -> List[Issue]:
        return [issue for issue in self.issues if issue.call_id == call_id]

    def get_issues_by_agent(self, agent_id: str) -> List[Issue]:
        return [issue for issue in self.issues if issue.agent_id == agent_id]

    def get_issues_by_type(self, issue_type: str) -> List[Issue]:
        return [issue for issue in self.issues if issue.issue_type == issue_type]
