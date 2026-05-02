from datetime import timedelta
from typing import List, Tuple
from collections import defaultdict

from .models import Subtitle, Chapter, ScanIssue, IssueType


def check_overlaps(subtitles: List[Subtitle]) -> List[ScanIssue]:
    issues: List[ScanIssue] = []
    issue_id = 1

    sorted_subs = sorted(subtitles, key=lambda x: x.start_time)

    for i in range(len(sorted_subs)):
        current = sorted_subs[i]
        for j in range(i + 1, len(sorted_subs)):
            other = sorted_subs[j]

            if other.start_time >= current.end_time:
                break

            overlap_start = max(current.start_time, other.start_time)
            overlap_end = min(current.end_time, other.end_time)
            overlap_duration = overlap_end - overlap_start

            if overlap_duration > timedelta(seconds=0):
                issues.append(ScanIssue(
                    id=issue_id,
                    issue_type=IssueType.OVERLAP,
                    subtitle_id=current.id,
                    start_time=overlap_start,
                    end_time=overlap_end,
                    description=f"字幕 #{current.id} 与字幕 #{other.id} 重叠，持续时间: {overlap_duration}",
                    severity="high" if overlap_duration > timedelta(seconds=1) else "medium",
                    related_subtitle_ids=[other.id]
                ))
                issue_id += 1

    return issues


def check_long_sentences(subtitles: List[Subtitle], max_duration: timedelta = timedelta(seconds=8),
                          min_gap: timedelta = timedelta(seconds=0.2)) -> List[ScanIssue]:
    issues: List[ScanIssue] = []
    issue_id = 1

    sorted_subs = sorted(subtitles, key=lambda x: x.start_time)

    for sub in sorted_subs:
        duration = sub.end_time - sub.start_time
        if duration > max_duration:
            word_count = len(sub.text.replace("\n", " ").split())
            issues.append(ScanIssue(
                id=issue_id,
                issue_type=IssueType.LONG_SENTENCE,
                subtitle_id=sub.id,
                start_time=sub.start_time,
                end_time=sub.end_time,
                description=f"字幕 #{sub.id} 断句过长: 持续 {duration}, {word_count} 个字",
                severity="medium" if duration > timedelta(seconds=10) else "low"
            ))
            issue_id += 1

    for i in range(len(sorted_subs) - 1):
        current = sorted_subs[i]
        next_sub = sorted_subs[i + 1]
        gap = next_sub.start_time - current.end_time

        if gap < timedelta(seconds=0) and -gap > min_gap:
            issues.append(ScanIssue(
                id=issue_id,
                issue_type=IssueType.LONG_SENTENCE,
                subtitle_id=current.id,
                start_time=current.start_time,
                end_time=current.end_time,
                description=f"字幕 #{current.id} 与 #{next_sub.id} 时间间隔异常: {gap}",
                severity="low",
                related_subtitle_ids=[next_sub.id]
            ))
            issue_id += 1

    return issues


def check_out_of_chapter(subtitles: List[Subtitle], chapters: List[Chapter]) -> List[ScanIssue]:
    issues: List[ScanIssue] = []
    issue_id = 1

    if not chapters:
        return issues

    sorted_chapters = sorted(chapters, key=lambda x: x.start_time)

    def is_in_chapter(sub: Subtitle) -> Tuple[bool, int]:
        for chapter in sorted_chapters:
            if chapter.end_time:
                if chapter.start_time <= sub.start_time < chapter.end_time:
                    return True, chapter.id
            else:
                if sub.start_time >= chapter.start_time:
                    return True, chapter.id
        return False, -1

    for sub in subtitles:
        in_chapter, chapter_id = is_in_chapter(sub)
        if not in_chapter:
            issues.append(ScanIssue(
                id=issue_id,
                issue_type=IssueType.OUT_OF_CHAPTER,
                subtitle_id=sub.id,
                start_time=sub.start_time,
                end_time=sub.end_time,
                description=f"字幕 #{sub.id} 不在任何章节范围内",
                severity="medium"
            ))
            issue_id += 1

    return issues


def validate_timeline(subtitles: List[Subtitle], chapters: List[Chapter] = None,
                      max_sentence_duration: timedelta = timedelta(seconds=8)) -> List[ScanIssue]:
    all_issues: List[ScanIssue] = []
    current_id = 1

    overlap_issues = check_overlaps(subtitles)
    for issue in overlap_issues:
        issue.id = current_id
        all_issues.append(issue)
        current_id += 1

    long_sentence_issues = check_long_sentences(subtitles, max_sentence_duration)
    for issue in long_sentence_issues:
        issue.id = current_id
        all_issues.append(issue)
        current_id += 1

    if chapters:
        out_of_chapter_issues = check_out_of_chapter(subtitles, chapters)
        for issue in out_of_chapter_issues:
            issue.id = current_id
            all_issues.append(issue)
            current_id += 1

    return all_issues


def group_issues_by_type(issues: List[ScanIssue]) -> dict:
    grouped = defaultdict(list)
    for issue in issues:
        grouped[issue.issue_type].append(issue)
    return dict(grouped)


def get_issue_summary(issues: List[ScanIssue]) -> dict:
    summary = {
        "total": len(issues),
        "by_type": {},
        "by_severity": {
            "high": 0,
            "medium": 0,
            "low": 0
        }
    }

    grouped = group_issues_by_type(issues)
    for issue_type, issue_list in grouped.items():
        summary["by_type"][issue_type.value] = len(issue_list)

    for issue in issues:
        if issue.severity in summary["by_severity"]:
            summary["by_severity"][issue.severity] += 1

    return summary
