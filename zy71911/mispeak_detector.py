import re
from typing import List, Tuple
from models import (
    Issue,
    IssueType,
    NextAction,
    IssueStatus,
    SubtitleLine,
    TimeSegment,
    Guest,
    AdScript,
)
from utils import generate_issue_id, format_time


class MispeakDetector:
    def __init__(self, episode_id: str):
        self.episode_id = episode_id
        self.issue_counter = 0

        self.filler_words = [
            "嗯",
            "啊",
            "呃",
            "哦",
            "那个",
            "就是",
            "其实",
            "然后",
            "对吧",
            "你知道",
        ]

        self.repeat_pattern = re.compile(r"(\b\w+\b)(?:\s+\1\b)+")
        self.chinese_repeat_pattern = re.compile(r"(.{1,2})(\1{2,})")

    def _new_issue(
        self,
        issue_type: IssueType,
        time_segment: TimeSegment,
        description: str,
        reason: str,
        next_action: NextAction,
        subtitle_line: SubtitleLine = None,
        confidence: float = 1.0,
    ) -> Issue:
        self.issue_counter += 1
        return Issue(
            issue_id=generate_issue_id(self.episode_id, self.issue_counter),
            issue_type=issue_type,
            time_segment=time_segment,
            description=description,
            reason=reason,
            next_action=next_action,
            subtitle_line=subtitle_line,
            confidence=confidence,
        )

    def detect_filler_words(self, subtitles: List[SubtitleLine]) -> List[Issue]:
        issues = []
        for line in subtitles:
            text = line.text
            for filler in self.filler_words:
                count = text.count(filler)
                if count >= 2:
                    time_str = f"{format_time(line.time_segment.start_time)} - {format_time(line.time_segment.end_time)}"
                    issues.append(
                        self._new_issue(
                            issue_type=IssueType.MISSPEAK,
                            time_segment=line.time_segment,
                            description=f"时间 {time_str}：检测到填充词「{filler}」出现 {count} 次",
                            reason=f"字幕文本中填充词「{filler}」频繁出现（{count}次），可能影响收听体验。原文：「{text}」",
                            next_action=NextAction.CHECK_AUDIO,
                            subtitle_line=line,
                            confidence=0.8,
                        )
                    )
                    break
        return issues

    def detect_repetitions(self, subtitles: List[SubtitleLine]) -> List[Issue]:
        issues = []
        for line in subtitles:
            text = line.text

            chinese_matches = self.chinese_repeat_pattern.findall(text)
            for match in chinese_matches:
                repeated_char = match[0]
                repeat_count = len(match[1]) + 1
                if repeat_count >= 3:
                    time_str = f"{format_time(line.time_segment.start_time)} - {format_time(line.time_segment.end_time)}"
                    issues.append(
                        self._new_issue(
                            issue_type=IssueType.MISSPEAK,
                            time_segment=line.time_segment,
                            description=f"时间 {time_str}：检测到重复「{repeated_char}」x{repeat_count}",
                            reason=f"字幕中「{repeated_char}」连续重复{repeat_count}次，疑似口吃或口误。原文：「{text}」",
                            next_action=NextAction.CHECK_AUDIO,
                            subtitle_line=line,
                            confidence=0.9,
                        )
                    )

        return issues

    def detect_incomplete_sentences(self, subtitles: List[SubtitleLine]) -> List[Issue]:
        issues = []
        end_punctuations = ["。", "！", "？", "!", "?", "."]

        for i, line in enumerate(subtitles):
            text = line.text.strip()
            if not text:
                continue

            if i < len(subtitles) - 1:
                next_line = subtitles[i + 1]
                if next_line.speaker and line.speaker != next_line.speaker:
                    if not any(text.endswith(p) for p in end_punctuations):
                        time_str = f"{format_time(line.time_segment.start_time)} - {format_time(line.time_segment.end_time)}"
                        issues.append(
                            self._new_issue(
                                issue_type=IssueType.MISSPEAK,
                                time_segment=line.time_segment,
                                description=f"时间 {time_str}：句子可能不完整",
                                reason=f"发言人切换前句子未正常结束（无句号/问号/感叹号）。原文：「{text}」，下一位发言人：{next_line.speaker}",
                                next_action=NextAction.CHECK_AUDIO,
                                subtitle_line=line,
                                confidence=0.6,
                            )
                        )

        return issues

    def detect_guest_name_errors(
        self, subtitles: List[SubtitleLine], guest_list: List[Guest]
    ) -> List[Issue]:
        issues = []
        if not guest_list:
            return issues

        guest_names = [g.name for g in guest_list]
        name_variations = {}
        for name in guest_names:
            if len(name) >= 2:
                name_variations[name[1:]] = name
                name_variations[name[:-1]] = name

        for line in subtitles:
            text = line.text
            for variation, correct_name in name_variations.items():
                if variation in text and correct_name not in text:
                    time_str = f"{format_time(line.time_segment.start_time)} - {format_time(line.time_segment.end_time)}"
                    issues.append(
                        self._new_issue(
                            issue_type=IssueType.GUEST_NAME_ERROR,
                            time_segment=line.time_segment,
                            description=f"时间 {time_str}：嘉宾名可能有误「{variation}」",
                            reason=f"检测到「{variation}」，嘉宾名单中有相似名字「{correct_name}」，请确认是否名字输入错误。原文：「{text}」",
                            next_action=NextAction.CONFIRM_WITH_PRODUCER,
                            subtitle_line=line,
                            confidence=0.5,
                        )
                    )

        return issues

    def detect_ad_script_mismatch(
        self, subtitles: List[SubtitleLine], ad_scripts: List[AdScript]
    ) -> List[Issue]:
        issues = []
        if not ad_scripts:
            return issues

        for ad in ad_scripts:
            matched_lines = []
            for line in subtitles:
                if (
                    line.time_segment.start_time >= ad.time_segment.start_time - 2
                    and line.time_segment.end_time <= ad.time_segment.end_time + 2
                ):
                    matched_lines.append(line)

            if not matched_lines:
                time_str = f"{format_time(ad.time_segment.start_time)} - {format_time(ad.time_segment.end_time)}"
                issues.append(
                    self._new_issue(
                        issue_type=IssueType.AD_SCRIPT_MISMATCH,
                        time_segment=ad.time_segment,
                        description=f"时间 {time_str}：未找到对应广告字幕",
                        reason=f"广告口播表指定时段内没有找到字幕内容，请确认是否漏录或时间偏移。",
                        next_action=NextAction.CHECK_AUDIO,
                        confidence=1.0,
                    )
                )
                continue

            actual_text = "".join([l.text for l in matched_lines])
            expected_words = set(ad.expected_text.replace(" ", ""))
            actual_words = set(actual_text.replace(" ", ""))
            missing_words = expected_words - actual_words

            if len(missing_words) > len(expected_words) * 0.2:
                time_str = f"{format_time(ad.time_segment.start_time)} - {format_time(ad.time_segment.end_time)}"
                missing_sample = "".join(list(missing_words)[:10])
                issues.append(
                    self._new_issue(
                        issue_type=IssueType.AD_SCRIPT_MISMATCH,
                        time_segment=ad.time_segment,
                        description=f"时间 {time_str}：广告口播内容不符",
                        reason=f"广告口播与预期稿差异较大。缺失关键词包含：「{missing_sample}...」。预期：「{ad.expected_text[:50]}...」实际：「{actual_text[:50]}...」",
                        next_action=NextAction.CONFIRM_WITH_PRODUCER,
                        confidence=0.8,
                    )
                )

        return issues

    def detect_all(
        self,
        subtitles: List[SubtitleLine],
        guest_list: List[Guest] = None,
        ad_scripts: List[AdScript] = None,
    ) -> List[Issue]:
        issues = []
        issues.extend(self.detect_filler_words(subtitles))
        issues.extend(self.detect_repetitions(subtitles))
        issues.extend(self.detect_incomplete_sentences(subtitles))

        if guest_list:
            issues.extend(self.detect_guest_name_errors(subtitles, guest_list))
        if ad_scripts:
            issues.extend(self.detect_ad_script_mismatch(subtitles, ad_scripts))

        return issues
