from typing import List, Dict, Tuple
from collections import defaultdict

from .models import (
    Subtitle, SensitiveRule, SanitizedSubtitle,
    MaskMapping, IssueType
)
from .rule_engine import RuleEngine


class MaskMapper:
    def __init__(self):
        self._global_mappings: Dict[str, str] = {}
        self._category_counters: Dict[str, int] = defaultdict(int)
        self._reverse_mappings: Dict[str, str] = {}

    def reset(self):
        self._global_mappings.clear()
        self._category_counters.clear()
        self._reverse_mappings.clear()

    def _generate_mask_value(self, category: str, template: str) -> str:
        self._category_counters[category] += 1
        index = self._category_counters[category]
        mask_value = template.replace("{category}", category.upper()).replace("{index}", str(index))
        return mask_value

    def get_mask(self, original_text: str, category: str, template: str) -> str:
        if original_text in self._global_mappings:
            return self._global_mappings[original_text]

        mask_value = self._generate_mask_value(category, template)
        self._global_mappings[original_text] = mask_value
        self._reverse_mappings[mask_value] = original_text
        return mask_value

    def get_original(self, mask_value: str) -> str:
        return self._reverse_mappings.get(mask_value, mask_value)

    def mask_subtitle(self, subtitle: Subtitle,
                      rule_engine: RuleEngine) -> Tuple[SanitizedSubtitle, List[MaskMapping]]:
        text = subtitle.text
        mask_mappings: List[MaskMapping] = []
        has_sensitive = False

        matches = rule_engine.match_subtitle(subtitle)

        matches.sort(key=lambda x: x[2][0], reverse=True)

        masked_text = text
        seen_matches = set()

        for rule, matched_text, (start_pos, end_pos) in matches:
            match_key = (start_pos, end_pos)
            if match_key in seen_matches:
                continue
            seen_matches.add(match_key)

            mask_value = self.get_mask(matched_text, rule.category, rule.mask_template)

            if masked_text[start_pos:end_pos] == matched_text:
                masked_text = masked_text[:start_pos] + mask_value + masked_text[end_pos:]

                mask_mappings.append(MaskMapping(
                    original_text=matched_text,
                    masked_text=mask_value,
                    category=rule.category,
                    subtitle_id=subtitle.id,
                    start_time=subtitle.start_time,
                    end_time=subtitle.end_time
                ))
                has_sensitive = True

        sanitized = SanitizedSubtitle(
            id=subtitle.id,
            start_time=subtitle.start_time,
            end_time=subtitle.end_time,
            original_text=subtitle.text,
            masked_text=masked_text,
            has_sensitive=has_sensitive,
            mask_mappings=mask_mappings.copy()
        )

        return sanitized, mask_mappings

    def mask_all_subtitles(self, subtitles: List[Subtitle],
                           rule_engine: RuleEngine) -> Tuple[List[SanitizedSubtitle], List[MaskMapping]]:
        all_sanitized: List[SanitizedSubtitle] = []
        all_mappings: List[MaskMapping] = []

        for subtitle in subtitles:
            sanitized, mappings = self.mask_subtitle(subtitle, rule_engine)
            all_sanitized.append(sanitized)
            all_mappings.extend(mappings)

        return all_sanitized, all_mappings

    def get_statistics(self) -> Dict:
        return {
            "total_masked_items": len(self._global_mappings),
            "by_category": dict(self._category_counters),
            "global_mappings": self._global_mappings.copy()
        }


def get_sensitive_issues_from_mappings(mappings: List[MaskMapping]) -> List[Dict]:
    result = []
    for mapping in mappings:
        result.append({
            "original": mapping.original_text,
            "masked": mapping.masked_text,
            "category": mapping.category,
            "subtitle_id": mapping.subtitle_id,
            "time_range": f"{mapping.start_time} - {mapping.end_time}"
        })
    return result
