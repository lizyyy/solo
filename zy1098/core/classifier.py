import re
from dataclasses import dataclass
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict
from .models import Essay, Feedback, Mistake, LabeledItem
from config.loader import RulesConfig, LabelRule


@dataclass
class MatchEvidence:
    label_id: str
    matched_text: str
    matched_pattern: str
    pattern_type: str
    position: Tuple[int, int]
    confidence_contribution: float


@dataclass
class ClassificationResult:
    labeled_items: List[LabeledItem]
    total_matched: int
    label_distribution: Dict[str, int]


class Classifier:
    def __init__(self, rules_config: RulesConfig):
        self.rules = rules_config
        self._build_pattern_cache()

    def _build_pattern_cache(self):
        self.pattern_cache: Dict[str, List[Tuple[str, str]]] = {}

        for label_id, rule in self.rules.labels.items():
            patterns = []

            for keyword in rule.keywords:
                if keyword:
                    patterns.append((keyword, 'keyword'))

            for synonym in rule.synonyms:
                if synonym:
                    patterns.append((synonym, 'synonym'))

            for pattern in rule.patterns:
                if pattern:
                    patterns.append((pattern, 'regex'))

            self.pattern_cache[label_id] = patterns

    def classify_all(
        self,
        essays: List[Essay],
        feedback_list: List[Feedback],
        mistakes: List[Mistake]
    ) -> ClassificationResult:
        labeled_items: List[LabeledItem] = []
        label_distribution: Dict[str, int] = defaultdict(int)

        for essay in essays:
            text = self._extract_text_from_essay(essay)
            if text:
                labeled = self._classify_single(
                    text=text,
                    item_id=essay.id or f"essay_{hash(essay.student_name + essay.title)}",
                    item_type='essay',
                    student_name=essay.student_name,
                    original_item=essay
                )
                if labeled.labels:
                    labeled_items.append(labeled)
                    for label in labeled.labels:
                        label_distribution[label] += 1

        for feedback in feedback_list:
            text = self._extract_text_from_feedback(feedback)
            if text:
                labeled = self._classify_single(
                    text=text,
                    item_id=feedback.id or f"feedback_{hash(feedback.student_name)}",
                    item_type='feedback',
                    student_name=feedback.student_name,
                    original_item=feedback
                )
                if labeled.labels:
                    labeled_items.append(labeled)
                    for label in labeled.labels:
                        label_distribution[label] += 1

        for mistake in mistakes:
            text = self._extract_text_from_mistake(mistake)
            if text:
                labeled = self._classify_single(
                    text=text,
                    item_id=mistake.id or f"mistake_{hash(mistake.student_name + mistake.description)}",
                    item_type='mistake',
                    student_name=mistake.student_name,
                    original_item=mistake
                )
                if labeled.labels:
                    labeled_items.append(labeled)
                    for label in labeled.labels:
                        label_distribution[label] += 1

        return ClassificationResult(
            labeled_items=labeled_items,
            total_matched=len(labeled_items),
            label_distribution=dict(label_distribution)
        )

    def _extract_text_from_essay(self, essay: Essay) -> str:
        parts = []
        if essay.content:
            parts.append(essay.content)
        return '\n'.join(parts)

    def _extract_text_from_feedback(self, feedback: Feedback) -> str:
        parts = []
        if feedback.teacher_comment:
            parts.append(feedback.teacher_comment)
        if feedback.student_revision:
            parts.append(feedback.student_revision)
        if feedback.cause_description:
            parts.append(feedback.cause_description)
        return '\n'.join(parts)

    def _extract_text_from_mistake(self, mistake: Mistake) -> str:
        parts = []
        if mistake.mistake_type and mistake.mistake_type != '未知':
            parts.append(mistake.mistake_type)
        if mistake.description:
            parts.append(mistake.description)
        if mistake.correction:
            parts.append(mistake.correction)
        return '\n'.join(parts)

    def _classify_single(
        self,
        text: str,
        item_id: str,
        item_type: str,
        student_name: str,
        original_item: Any
    ) -> LabeledItem:
        matched_labels: Dict[str, List[MatchEvidence]] = defaultdict(list)

        for label_id, patterns in self.pattern_cache.items():
            rule = self.rules.labels.get(label_id)
            if not rule:
                continue

            has_exclude = any(
                self._find_pattern(ek, text, 'exclude') for ek in rule.exclude_keywords
            )
            if has_exclude:
                continue

            for pattern, pattern_type in patterns:
                matches = self._find_all_matches(pattern, text, pattern_type)
                for match_text, start, end in matches:
                    confidence = self._calculate_confidence(pattern, pattern_type, rule)
                    evidence = MatchEvidence(
                        label_id=label_id,
                        matched_text=match_text,
                        matched_pattern=pattern,
                        pattern_type=pattern_type,
                        position=(start, end),
                        confidence_contribution=confidence
                    )
                    matched_labels[label_id].append(evidence)

        final_labels: List[str] = []
        final_confidence: Dict[str, float] = {}
        final_evidence: List[Dict[str, Any]] = []
        explanation_parts: List[str] = []

        for label_id, evidences in matched_labels.items():
            if not evidences:
                continue

            rule = self.rules.labels.get(label_id)
            if not rule:
                continue

            total_confidence = min(
                sum(e.confidence_contribution for e in evidences),
                1.0
            )

            if total_confidence >= self.rules.similarity_threshold:
                final_labels.append(label_id)
                final_confidence[label_id] = round(total_confidence, 3)

                for evidence in evidences:
                    final_evidence.append({
                        'label': rule.display_name,
                        'label_id': label_id,
                        'matched_text': evidence.matched_text,
                        'pattern_type': evidence.pattern_type,
                        'confidence': evidence.confidence_contribution,
                        'position': evidence.position
                    })

                matched_keywords = [e.matched_text for e in evidences]
                explanation_parts.append(
                    f"【{rule.display_name}】：发现关键词 {', '.join(repr(k) for k in matched_keywords[:3])}"
                    f"{'...' if len(matched_keywords) > 3 else ''}，置信度 {total_confidence:.1%}"
                )

        if final_labels:
            final_labels.sort(key=lambda lid: final_confidence.get(lid, 0), reverse=True)

        return LabeledItem(
            item_id=item_id,
            item_type=item_type,
            student_name=student_name,
            text=text[:500] + '...' if len(text) > 500 else text,
            labels=final_labels,
            confidence=final_confidence,
            evidence=final_evidence,
            explanation='；'.join(explanation_parts) if explanation_parts else '',
            original_item=original_item
        )

    def _find_all_matches(
        self,
        pattern: str,
        text: str,
        pattern_type: str
    ) -> List[Tuple[str, int, int]]:
        if pattern_type == 'regex':
            return self._find_regex_matches(pattern, text)
        else:
            return self._find_substring_matches(pattern, text)

    def _find_pattern(self, pattern: str, text: str, pattern_type: str) -> bool:
        if pattern_type == 'regex':
            return bool(re.search(pattern, text, re.IGNORECASE))
        else:
            return pattern.lower() in text.lower()

    def _find_substring_matches(self, substring: str, text: str) -> List[Tuple[str, int, int]]:
        matches = []
        lower_text = text.lower()
        lower_sub = substring.lower()
        start = 0

        while True:
            idx = lower_text.find(lower_sub, start)
            if idx == -1:
                break
            end = idx + len(substring)
            matches.append((text[idx:end], idx, end))
            start = end

        return matches

    def _find_regex_matches(self, pattern: str, text: str) -> List[Tuple[str, int, int]]:
        matches = []
        try:
            for m in re.finditer(pattern, text, re.IGNORECASE):
                matches.append((m.group(), m.start(), m.end()))
        except re.error:
            pass
        return matches

    def _calculate_confidence(self, pattern: str, pattern_type: str, rule: LabelRule) -> float:
        base_confidence = {
            'keyword': 0.3,
            'synonym': 0.2,
            'regex': 0.35,
            'exclude': 0.0
        }.get(pattern_type, 0.15)

        priority_factor = rule.priority / 10.0 if rule.priority > 0 else 0

        length_factor = min(len(pattern) / 10.0, 0.15)

        return min(base_confidence + priority_factor + length_factor, 0.6)

    def get_label_display_name(self, label_id: str) -> str:
        rule = self.rules.labels.get(label_id)
        return rule.display_name if rule else label_id

    def get_label_rule(self, label_id: str) -> Optional[LabelRule]:
        return self.rules.labels.get(label_id)
