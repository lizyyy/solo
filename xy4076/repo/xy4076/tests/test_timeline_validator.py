import unittest
from datetime import timedelta

from podcast_sanitizer.timeline_validator import (
    check_overlaps, check_long_sentences, check_out_of_chapter,
    validate_timeline, get_issue_summary, group_issues_by_type
)
from podcast_sanitizer.models import Subtitle, Chapter, IssueType


class TestOverlapCheck(unittest.TestCase):
    def test_no_overlap(self):
        subtitles = [
            Subtitle(
                id=1,
                start_time=timedelta(seconds=0),
                end_time=timedelta(seconds=5),
                text="第一句"
            ),
            Subtitle(
                id=2,
                start_time=timedelta(seconds=6),
                end_time=timedelta(seconds=10),
                text="第二句"
            )
        ]

        issues = check_overlaps(subtitles)
        self.assertEqual(len(issues), 0)

    def test_simple_overlap(self):
        subtitles = [
            Subtitle(
                id=1,
                start_time=timedelta(seconds=0),
                end_time=timedelta(seconds=7),
                text="第一句"
            ),
            Subtitle(
                id=2,
                start_time=timedelta(seconds=5),
                end_time=timedelta(seconds=10),
                text="第二句"
            )
        ]

        issues = check_overlaps(subtitles)
        self.assertEqual(len(issues), 1)
        self.assertEqual(issues[0].issue_type, IssueType.OVERLAP)
        self.assertEqual(issues[0].subtitle_id, 1)
        self.assertEqual(issues[0].related_subtitle_ids, [2])

    def test_multiple_overlaps(self):
        subtitles = [
            Subtitle(id=1, start_time=timedelta(seconds=0), end_time=timedelta(seconds=10), text="第一句"),
            Subtitle(id=2, start_time=timedelta(seconds=5), end_time=timedelta(seconds=15), text="第二句"),
            Subtitle(id=3, start_time=timedelta(seconds=12), end_time=timedelta(seconds=20), text="第三句")
        ]

        issues = check_overlaps(subtitles)
        self.assertGreater(len(issues), 0)


class TestLongSentenceCheck(unittest.TestCase):
    def test_short_sentence(self):
        subtitles = [
            Subtitle(
                id=1,
                start_time=timedelta(seconds=0),
                end_time=timedelta(seconds=5),
                text="短句"
            )
        ]

        issues = check_long_sentences(subtitles, max_duration=timedelta(seconds=8))
        self.assertEqual(len(issues), 0)

    def test_long_sentence(self):
        subtitles = [
            Subtitle(
                id=1,
                start_time=timedelta(seconds=0),
                end_time=timedelta(seconds=12),
                text="这是一个很长的句子，持续了12秒，超过了默认的8秒阈值"
            )
        ]

        issues = check_long_sentences(subtitles, max_duration=timedelta(seconds=8))
        self.assertEqual(len(issues), 1)
        self.assertEqual(issues[0].issue_type, IssueType.LONG_SENTENCE)
        self.assertEqual(issues[0].subtitle_id, 1)


class TestOutOfChapterCheck(unittest.TestCase):
    def setUp(self):
        self.chapters = [
            Chapter(
                id=1,
                title="第一章",
                start_time=timedelta(seconds=0),
                end_time=timedelta(seconds=30)
            ),
            Chapter(
                id=2,
                title="第二章",
                start_time=timedelta(seconds=30),
                end_time=timedelta(seconds=60)
            )
        ]

    def test_in_chapter(self):
        subtitles = [
            Subtitle(id=1, start_time=timedelta(seconds=5), end_time=timedelta(seconds=10), text="在第一章"),
            Subtitle(id=2, start_time=timedelta(seconds=35), end_time=timedelta(seconds=40), text="在第二章")
        ]

        issues = check_out_of_chapter(subtitles, self.chapters)
        self.assertEqual(len(issues), 0)

    def test_out_of_chapter(self):
        subtitles = [
            Subtitle(id=1, start_time=timedelta(seconds=5), end_time=timedelta(seconds=10), text="在第一章"),
            Subtitle(id=2, start_time=timedelta(seconds=65), end_time=timedelta(seconds=70), text="在章节外")
        ]

        issues = check_out_of_chapter(subtitles, self.chapters)
        self.assertEqual(len(issues), 1)
        self.assertEqual(issues[0].issue_type, IssueType.OUT_OF_CHAPTER)
        self.assertEqual(issues[0].subtitle_id, 2)


class TestValidateTimeline(unittest.TestCase):
    def test_full_validation(self):
        subtitles = [
            Subtitle(id=1, start_time=timedelta(seconds=0), end_time=timedelta(seconds=5), text="正常"),
            Subtitle(id=2, start_time=timedelta(seconds=3), end_time=timedelta(seconds=8), text="重叠"),
            Subtitle(id=3, start_time=timedelta(seconds=9), end_time=timedelta(seconds=20), text="长句子")
        ]

        chapters = [
            Chapter(id=1, title="第一章", start_time=timedelta(seconds=0), end_time=timedelta(seconds=15))
        ]

        issues = validate_timeline(subtitles, chapters, max_sentence_duration=timedelta(seconds=8))

        overlap_issues = [i for i in issues if i.issue_type == IssueType.OVERLAP]
        long_issues = [i for i in issues if i.issue_type == IssueType.LONG_SENTENCE]

        self.assertGreater(len(overlap_issues), 0)
        self.assertGreater(len(long_issues), 0)


class TestIssueSummary(unittest.TestCase):
    def test_get_summary(self):
        from podcast_sanitizer.models import ScanIssue

        issues = [
            ScanIssue(id=1, issue_type=IssueType.OVERLAP, subtitle_id=1,
                      start_time=timedelta(0), end_time=timedelta(seconds=5),
                      description="重叠"),
            ScanIssue(id=2, issue_type=IssueType.SENSITIVE_WORD, subtitle_id=2,
                      start_time=timedelta(0), end_time=timedelta(seconds=5),
                      description="敏感词", severity="high"),
        ]

        summary = get_issue_summary(issues)
        self.assertEqual(summary["total"], 2)
        self.assertIn("overlap", summary["by_type"])
        self.assertIn("sensitive_word", summary["by_type"])


if __name__ == "__main__":
    unittest.main()
