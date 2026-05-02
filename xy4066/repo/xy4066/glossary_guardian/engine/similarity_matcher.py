import difflib
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple

from ..parsers.glossary_parser import GlossaryEntry, GuestEntry
from ..parsers.transcript_parser import TranscriptSegment


@dataclass
class NameVariant:
    main_name: str
    variants: List[str]
    english_name: Optional[str] = None
    context: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "main_name": self.main_name,
            "variants": self.variants,
            "english_name": self.english_name,
            "context": self.context,
        }


@dataclass
class TranslationConsistencyIssue:
    chinese_term: str
    translations: List[Tuple[str, str]]
    similarity_score: float
    context_segments: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "chinese_term": self.chinese_term,
            "translations": [{"translation": t[0], "context": t[1]} for t in self.translations],
            "similarity_score": self.similarity_score,
            "context_segments": self.context_segments,
        }


class SimilarityMatcher:
    def __init__(
        self,
        glossary_entries: List[GlossaryEntry],
        guest_entries: List[GuestEntry],
        threshold: float = 0.85,
    ):
        self.glossary_entries = glossary_entries
        self.guest_entries = guest_entries
        self.threshold = threshold

        self._build_indices()

    def _build_indices(self):
        self.chinese_to_english: Dict[str, Set[str]] = {}
        self.english_to_chinese: Dict[str, Set[str]] = {}

        for entry in self.glossary_entries:
            chinese = self._normalize_text(entry.chinese)
            english = self._normalize_text(entry.english)

            if chinese:
                if chinese not in self.chinese_to_english:
                    self.chinese_to_english[chinese] = set()
                self.chinese_to_english[chinese].add(english)

            if english:
                if english not in self.english_to_chinese:
                    self.english_to_chinese[english] = set()
                self.english_to_chinese[english].add(chinese)

        self.all_chinese_terms = list(self.chinese_to_english.keys())
        self.all_english_terms = list(self.english_to_chinese.keys())

    def _normalize_text(self, text: str) -> str:
        if not text:
            return ""
        text = text.strip().lower()
        text = re.sub(r"\s+", " ", text)
        return text

    def _sequence_similarity(self, a: str, b: str) -> float:
        if not a or not b:
            return 0.0
        return difflib.SequenceMatcher(None, a, b).ratio()

    def _find_chinese_name_variants(
        self, segments: List[TranscriptSegment]
    ) -> List[NameVariant]:
        name_variants: Dict[str, NameVariant] = {}

        for guest in self.guest_entries:
            main_name = guest.chinese_name
            normalized_main = self._normalize_text(main_name)

            variant = NameVariant(
                main_name=main_name,
                variants=list(guest.aliases),
                english_name=guest.english_name,
            )
            name_variants[normalized_main] = variant

        all_text = " ".join(s.text for s in segments)

        chinese_names_found: Dict[str, List[Tuple[int, str]]] = {}
        for idx, segment in enumerate(segments):
            seg_text = segment.text

            for chinese in self.all_chinese_terms:
                if len(chinese) >= 2 and chinese in self._normalize_text(seg_text):
                    if chinese not in chinese_names_found:
                        chinese_names_found[chinese] = []
                    chinese_names_found[chinese].append((idx, seg_text[:50]))

            for guest in self.guest_entries:
                guest_name = self._normalize_text(guest.chinese_name)
                if len(guest_name) >= 2 and guest_name in self._normalize_text(seg_text):
                    if guest_name not in chinese_names_found:
                        chinese_names_found[guest_name] = []
                    chinese_names_found[guest_name].append((idx, seg_text[:50]))

                for alias in guest.aliases:
                    alias_normalized = self._normalize_text(alias)
                    if len(alias_normalized) >= 2 and alias_normalized in self._normalize_text(seg_text):
                        if alias_normalized not in chinese_names_found:
                            chinese_names_found[alias_normalized] = []
                        chinese_names_found[alias_normalized].append((idx, seg_text[:50]))

        all_names = list(chinese_names_found.keys())
        grouped_names: Dict[str, List[str]] = {}

        for i, name1 in enumerate(all_names):
            matched = False
            for key in grouped_names:
                if self._sequence_similarity(name1, key) >= self.threshold:
                    if name1 not in grouped_names[key]:
                        grouped_names[key].append(name1)
                    matched = True
                    break
            if not matched:
                grouped_names[name1] = [name1]

        results: List[NameVariant] = []
        for main_name, variants in grouped_names.items():
            if len(variants) > 1:
                context = []
                for var in variants:
                    if var in chinese_names_found:
                        for seg_idx, snippet in chinese_names_found[var][:3]:
                            if seg_idx < len(segments):
                                seg = segments[seg_idx]
                                context.append({
                                    "segment_id": seg.id,
                                    "name_variant": var,
                                    "snippet": snippet,
                                    "speaker": seg.speaker,
                                })

                guest_match = self._find_guest_for_name(main_name)
                if guest_match:
                    english_name = guest_match.english_name
                else:
                    english_name = None

                results.append(
                    NameVariant(
                        main_name=main_name,
                        variants=[v for v in variants if v != main_name],
                        english_name=english_name,
                        context=context,
                    )
                )

        return results

    def _find_guest_for_name(self, name: str) -> Optional[GuestEntry]:
        normalized_name = self._normalize_text(name)
        for guest in self.guest_entries:
            if self._normalize_text(guest.chinese_name) == normalized_name:
                return guest
            for alias in guest.aliases:
                if self._normalize_text(alias) == normalized_name:
                    return guest
        return None

    def _find_inconsistent_translations(
        self, segments: List[TranscriptSegment]
    ) -> List[TranslationConsistencyIssue]:
        issues: List[TranslationConsistencyIssue] = []

        chinese_context_map: Dict[str, List[Tuple[str, str, int]]] = {}

        for idx, segment in enumerate(segments):
            seg_text = segment.text
            normalized_seg = self._normalize_text(seg_text)

            for chinese, english_set in self.chinese_to_english.items():
                if len(chinese) < 2:
                    continue

                if chinese in normalized_seg:
                    found_english = []
                    for english in english_set:
                        if english and english in normalized_seg:
                            found_english.append(english)

                    if found_english:
                        for eng in found_english:
                            if chinese not in chinese_context_map:
                                chinese_context_map[chinese] = []
                            context_snippet = seg_text[:100] if len(seg_text) > 100 else seg_text
                            chinese_context_map[chinese].append(
                                (eng, context_snippet, idx)
                            )

        for chinese, translations in chinese_context_map.items():
            if len(translations) < 2:
                continue

            unique_translations = {}
            for trans, context, idx in translations:
                if trans not in unique_translations:
                    unique_translations[trans] = []
                unique_translations[trans].append((context, idx))

            if len(unique_translations) > 1:
                all_trans = list(unique_translations.keys())
                min_similarity = 1.0
                for i in range(len(all_trans)):
                    for j in range(i + 1, len(all_trans)):
                        sim = self._sequence_similarity(all_trans[i], all_trans[j])
                        if sim < min_similarity:
                            min_similarity = sim

                all_contexts = []
                for trans, contexts in unique_translations.items():
                    for context, idx in contexts:
                        if idx < len(segments):
                            seg = segments[idx]
                            all_contexts.append({
                                "translation": trans,
                                "context": context,
                                "segment_id": seg.id,
                                "speaker": seg.speaker,
                            })

                trans_list = [
                    (trans, str(contexts[0][0]) if contexts else "")
                    for trans, contexts in unique_translations.items()
                ]

                issues.append(
                    TranslationConsistencyIssue(
                        chinese_term=chinese,
                        translations=trans_list,
                        similarity_score=min_similarity,
                        context_segments=all_contexts,
                    )
                )

        return issues

    def _find_similar_context_different_translation(
        self, segments: List[TranscriptSegment]
    ) -> List[Dict[str, Any]]:
        issues: List[Dict[str, Any]] = []

        segment_pairs: List[Tuple[int, int, float]] = []

        for i in range(len(segments)):
            for j in range(i + 1, len(segments)):
                sim = self._sequence_similarity(
                    self._normalize_text(segments[i].text),
                    self._normalize_text(segments[j].text),
                )
                if sim >= self.threshold:
                    segment_pairs.append((i, j, sim))

        for i, j, sim in segment_pairs:
            seg1 = segments[i]
            seg2 = segments[j]

            english_words1 = self._extract_english_words(seg1.text)
            english_words2 = self._extract_english_words(seg2.text)

            chinese_words1 = self._extract_chinese_words(seg1.text)
            chinese_words2 = self._extract_chinese_words(seg2.text)

            common_chinese = chinese_words1 & chinese_words2

            for chinese in common_chinese:
                if len(chinese) >= 2:
                    expected_translations = self.chinese_to_english.get(
                        self._normalize_text(chinese), set()
                    )

                    if expected_translations:
                        found1 = [w for w in english_words1 if any(et in w.lower() for et in expected_translations)]
                        found2 = [w for w in english_words2 if any(et in w.lower() for et in expected_translations)]

                        if found1 and found2 and set(f.lower() for f in found1) != set(f.lower() for f in found2):
                            issues.append({
                                "issue_type": "SIMILAR_CONTEXT_DIFFERENT_TRANSLATION",
                                "chinese_term": chinese,
                                "similarity_score": sim,
                                "segment1": {
                                    "id": seg1.id,
                                    "text": seg1.text[:100],
                                    "translation": found1,
                                    "speaker": seg1.speaker,
                                },
                                "segment2": {
                                    "id": seg2.id,
                                    "text": seg2.text[:100],
                                    "translation": found2,
                                    "speaker": seg2.speaker,
                                },
                                "suggestion": f"上下文相似但译法不同，请确认统一使用: {', '.join(expected_translations)}",
                            })

        return issues

    def _extract_english_words(self, text: str) -> Set[str]:
        words = re.findall(r"[A-Za-z]+(?:[-'’][A-Za-z]+)*", text)
        return set(w for w in words if len(w) >= 2)

    def _extract_chinese_words(self, text: str) -> Set[str]:
        chars = re.findall(r"[\u4e00-\u9fff]+", text)
        words = set()
        for char_seq in chars:
            for i in range(len(char_seq)):
                for j in range(i + 2, min(i + 6, len(char_seq) + 1)):
                    words.add(char_seq[i:j])
        return words

    def check_all(self, segments: List[TranscriptSegment]) -> Dict[str, Any]:
        name_variants = self._find_chinese_name_variants(segments)
        inconsistent_translations = self._find_inconsistent_translations(segments)
        similar_context_issues = self._find_similar_context_different_translation(segments)

        return {
            "name_variants": [nv.to_dict() for nv in name_variants],
            "inconsistent_translations": [it.to_dict() for it in inconsistent_translations],
            "similar_context_issues": similar_context_issues,
            "summary": {
                "total_name_variant_issues": len(name_variants),
                "total_inconsistent_translation_issues": len(inconsistent_translations),
                "total_similar_context_issues": len(similar_context_issues),
                "threshold_used": self.threshold,
            },
        }
