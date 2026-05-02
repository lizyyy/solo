"""跨语言对齐模块 - 多语言字幕段落对齐"""

import difflib
import re
import uuid
from typing import Optional

from .models import (
    AlignmentPair,
    AlignmentResult,
    Language,
    ScriptFile,
    SubtitleFile,
    SubtitleFormat,
    Timecode,
)


class Aligner:
    def __init__(self):
        self.stopwords_zh = set(
            [
                "的", "了", "是", "在", "有", "和", "就", "不", "人", "都",
                "一", "一个", "上", "也", "很", "到", "说", "要", "去", "你",
                "会", "着", "没有", "看", "好", "自己", "这", "那", "他", "她",
                "它", "们", "这个", "那个", "什么", "怎么", "为什么",
            ]
        )
        self.stopwords_en = set(
            [
                "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
                "have", "has", "had", "do", "does", "did", "will", "would", "could",
                "should", "may", "might", "must", "shall", "can", "need", "dare",
                "and", "or", "but", "so", "if", "because", "when", "while", "where",
                "why", "how", "that", "which", "who", "whom", "whose", "what",
                "this", "these", "those", "such", "same", "different", "other",
                "i", "you", "he", "she", "it", "we", "they", "me", "him", "her",
                "us", "them", "my", "your", "his", "its", "our", "their",
                "in", "on", "at", "to", "for", "with", "by", "from", "about",
            ]
        )

    def align_by_timecode(
        self,
        source_file: SubtitleFile,
        target_file: SubtitleFile,
    ) -> AlignmentResult:
        pairs = []
        language_pair = f"{source_file.language.value}-{target_file.language.value}"

        for source_entry in source_file.entries:
            best_match = None
            best_confidence = 0.0

            source_start = source_entry.start.to_seconds()
            source_end = source_entry.end.to_seconds()
            source_duration = source_end - source_start

            for target_entry in target_file.entries:
                target_start = target_entry.start.to_seconds()
                target_end = target_entry.end.to_seconds()

                overlap_start = max(source_start, target_start)
                overlap_end = min(source_end, target_end)

                if overlap_start < overlap_end:
                    overlap_duration = overlap_end - overlap_start
                    time_confidence = overlap_duration / max(source_duration, target_end - target_start)

                    text_confidence = self._calculate_text_similarity(
                        source_entry.text,
                        target_entry.text,
                        source_file.language,
                        target_file.language,
                    )

                    combined_confidence = time_confidence * 0.7 + text_confidence * 0.3

                    if combined_confidence > best_confidence:
                        best_confidence = combined_confidence
                        best_match = target_entry

            if best_match and best_confidence > 0.3:
                pairs.append(
                    AlignmentPair(
                        source_index=source_entry.index,
                        target_index=best_match.index,
                        source_text=source_entry.text,
                        target_text=best_match.text,
                        confidence=round(best_confidence, 3),
                        language_pair=language_pair,
                    )
                )

        return AlignmentResult(
            source_language=source_file.language,
            target_language=target_file.language,
            episode=source_file.episode,
            pairs=pairs,
        )

    def align_by_index(
        self,
        source_file: SubtitleFile,
        target_file: SubtitleFile,
    ) -> AlignmentResult:
        pairs = []
        language_pair = f"{source_file.language.value}-{target_file.language.value}"

        min_length = min(len(source_file.entries), len(target_file.entries))

        for i in range(min_length):
            source_entry = source_file.entries[i]
            target_entry = target_file.entries[i]

            time_confidence = self._calculate_time_similarity(
                source_entry.start.to_seconds(),
                source_entry.end.to_seconds(),
                target_entry.start.to_seconds(),
                target_entry.end.to_seconds(),
            )

            text_confidence = self._calculate_text_similarity(
                source_entry.text,
                target_entry.text,
                source_file.language,
                target_file.language,
            )

            combined_confidence = time_confidence * 0.3 + text_confidence * 0.7

            pairs.append(
                AlignmentPair(
                    source_index=source_entry.index,
                    target_index=target_entry.index,
                    source_text=source_entry.text,
                    target_text=target_entry.text,
                    confidence=round(combined_confidence, 3),
                    language_pair=language_pair,
                )
            )

        return AlignmentResult(
            source_language=source_file.language,
            target_language=target_file.language,
            episode=source_file.episode,
            pairs=pairs,
        )

    def align_with_script(
        self,
        subtitle_files: list[SubtitleFile],
        script_file: ScriptFile,
    ) -> list[AlignmentResult]:
        results = []

        for sub_file in subtitle_files:
            pairs = []
            language_pair = f"script-{sub_file.language.value}"

            for script_entry in script_file.entries:
                best_match = None
                best_confidence = 0.0

                for sub_entry in sub_file.entries:
                    text_confidence = self._calculate_text_similarity(
                        script_entry.original_text,
                        sub_entry.text,
                        script_file.language,
                        sub_file.language,
                    )

                    if script_entry.start_timecode and script_entry.end_timecode:
                        try:
                            script_start = self._parse_timecode_string(script_entry.start_timecode)
                            script_end = self._parse_timecode_string(script_entry.end_timecode)
                            time_confidence = self._calculate_time_similarity(
                                script_start,
                                script_end,
                                sub_entry.start.to_seconds(),
                                sub_entry.end.to_seconds(),
                            )
                            combined_confidence = time_confidence * 0.5 + text_confidence * 0.5
                        except ValueError:
                            combined_confidence = text_confidence
                    else:
                        combined_confidence = text_confidence

                    if combined_confidence > best_confidence:
                        best_confidence = combined_confidence
                        best_match = sub_entry

                if best_match and best_confidence > 0.2:
                    pairs.append(
                        AlignmentPair(
                            source_index=script_entry.index,
                            target_index=best_match.index,
                            source_text=script_entry.original_text,
                            target_text=best_match.text,
                            confidence=round(best_confidence, 3),
                            language_pair=language_pair,
                        )
                    )

            results.append(
                AlignmentResult(
                    source_language=script_file.language,
                    target_language=sub_file.language,
                    episode=script_file.episode,
                    pairs=pairs,
                )
            )

        return results

    def _calculate_text_similarity(
        self,
        text1: str,
        text2: str,
        lang1: Language,
        lang2: Language,
    ) -> float:
        if not text1 or not text2:
            return 0.0

        tokens1 = self._tokenize(text1, lang1)
        tokens2 = self._tokenize(text2, lang2)

        if not tokens1 or not tokens2:
            return 0.0

        intersection = len(tokens1 & tokens2)
        union = len(tokens1 | tokens2)

        if union == 0:
            return 0.0

        jaccard = intersection / union

        ratio = difflib.SequenceMatcher(None, text1.lower(), text2.lower()).ratio()

        return (jaccard + ratio) / 2

    def _tokenize(self, text: str, language: Language) -> set[str]:
        text = re.sub(r"[^\w\s]", " ", text.lower())
        words = text.split()

        if language == Language.ZH:
            stopwords = self.stopwords_zh
            tokens = set()
            for word in words:
                if word and word not in stopwords:
                    tokens.add(word)
                for i in range(len(word)):
                    for j in range(i + 1, min(i + 4, len(word) + 1)):
                        char_ngram = word[i:j]
                        if char_ngram and char_ngram not in stopwords:
                            tokens.add(char_ngram)
            return tokens
        else:
            stopwords = self.stopwords_en
            return {
                word for word in words
                if word and word not in stopwords and len(word) > 1
            }

    def _calculate_time_similarity(
        self,
        start1: float,
        end1: float,
        start2: float,
        end2: float,
    ) -> float:
        duration1 = end1 - start1
        duration2 = end2 - start2

        if duration1 <= 0 or duration2 <= 0:
            return 0.0

        overlap_start = max(start1, start2)
        overlap_end = min(end1, end2)

        if overlap_start >= overlap_end:
            distance = abs(start1 - start2)
            max_duration = max(duration1, duration2)
            return max(0.0, 1.0 - distance / max_duration)

        overlap = overlap_end - overlap_start
        union = max(end1, end2) - min(start1, start2)

        if union <= 0:
            return 0.0

        return overlap / union

    def _parse_timecode_string(self, timecode: str) -> float:
        timecode = timecode.strip()

        srt_match = re.match(r"(\d{2}):(\d{2}):(\d{2})[,.](\d{3})", timecode)
        if srt_match:
            hours = int(srt_match.group(1))
            minutes = int(srt_match.group(2))
            seconds = int(srt_match.group(3))
            milliseconds = int(srt_match.group(4))
            return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000

        short_match = re.match(r"(\d{2}):(\d{2})[:.](\d{2,3})", timecode)
        if short_match:
            minutes = int(short_match.group(1))
            seconds = int(short_match.group(2))
            ms_str = short_match.group(3)
            if len(ms_str) == 2:
                milliseconds = int(ms_str) * 10
            else:
                milliseconds = int(ms_str)
            return minutes * 60 + seconds + milliseconds / 1000

        colon_match = re.match(r"(\d+):(\d+):(\d+)", timecode)
        if colon_match:
            return (
                int(colon_match.group(1)) * 3600
                + int(colon_match.group(2)) * 60
                + int(colon_match.group(3))
            )

        minute_match = re.match(r"(\d+):(\d+)", timecode)
        if minute_match:
            return int(minute_match.group(1)) * 60 + int(minute_match.group(2))

        raise ValueError(f"无法解析时间码: {timecode}")
