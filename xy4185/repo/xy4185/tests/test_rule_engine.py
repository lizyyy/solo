import tempfile
from datetime import timedelta
from pathlib import Path

import pytest

from subtitle_inspector.models import (
    SubtitleFile, SubtitleEntry, ProgramList, ProgramItem,
    IssueCategory, IssueSeverity
)
from subtitle_inspector.rule_engine import (
    TimelineOverlapRule,
    TimelineGapRule,
    TimecodeBoundsRule,
    BilingualAlignmentRule,
    RuleEngine,
)


class TestTimelineOverlapRule:
    def test_no_overlap(self):
        entries = [
            SubtitleEntry(
                index=1,
                start_time=timedelta(seconds=0),
                end_time=timedelta(seconds=2),
                text="Test 1",
                raw_text="Test 1"
            ),
            SubtitleEntry(
                index=2,
                start_time=timedelta(seconds=3),
                end_time=timedelta(seconds=5),
                text="Test 2",
                raw_text="Test 2"
            ),
        ]
        
        sf = SubtitleFile(
            path=Path("test.srt"),
            format="srt",
            encoding="utf-8",
            language="zh-CN",
            entries=entries
        )
        
        rule = TimelineOverlapRule()
        issues = rule.check(sf)
        
        assert len(issues) == 0
    
    def test_with_overlap(self):
        entries = [
            SubtitleEntry(
                index=1,
                start_time=timedelta(seconds=0),
                end_time=timedelta(seconds=4),
                text="Test 1",
                raw_text="Test 1"
            ),
            SubtitleEntry(
                index=2,
                start_time=timedelta(seconds=3),
                end_time=timedelta(seconds=5),
                text="Test 2",
                raw_text="Test 2"
            ),
        ]
        
        sf = SubtitleFile(
            path=Path("test.srt"),
            format="srt",
            encoding="utf-8",
            language="zh-CN",
            entries=entries
        )
        
        rule = TimelineOverlapRule()
        issues = rule.check(sf)
        
        assert len(issues) == 1
        assert issues[0].category == IssueCategory.TIMELINE
        assert "重叠" in issues[0].title


class TestTimelineGapRule:
    def test_normal_gap(self):
        entries = [
            SubtitleEntry(
                index=1,
                start_time=timedelta(seconds=0),
                end_time=timedelta(seconds=2),
                text="Test 1",
                raw_text="Test 1"
            ),
            SubtitleEntry(
                index=2,
                start_time=timedelta(seconds=4),
                end_time=timedelta(seconds=6),
                text="Test 2",
                raw_text="Test 2"
            ),
        ]
        
        sf = SubtitleFile(
            path=Path("test.srt"),
            format="srt",
            encoding="utf-8",
            language="zh-CN",
            entries=entries
        )
        
        rule = TimelineGapRule(max_gap_ms=3000)
        issues = rule.check(sf)
        
        assert len(issues) == 0
    
    def test_large_gap(self):
        entries = [
            SubtitleEntry(
                index=1,
                start_time=timedelta(seconds=0),
                end_time=timedelta(seconds=2),
                text="Test 1",
                raw_text="Test 1"
            ),
            SubtitleEntry(
                index=2,
                start_time=timedelta(seconds=10),
                end_time=timedelta(seconds=12),
                text="Test 2",
                raw_text="Test 2"
            ),
        ]
        
        sf = SubtitleFile(
            path=Path("test.srt"),
            format="srt",
            encoding="utf-8",
            language="zh-CN",
            entries=entries
        )
        
        rule = TimelineGapRule(max_gap_ms=5000)
        issues = rule.check(sf)
        
        assert len(issues) == 1
        assert "空洞" in issues[0].title


class TestTimecodeBoundsRule:
    def test_normal_timecode(self):
        entries = [
            SubtitleEntry(
                index=1,
                start_time=timedelta(seconds=0),
                end_time=timedelta(seconds=2),
                text="Test 1",
                raw_text="Test 1"
            ),
        ]
        
        sf = SubtitleFile(
            path=Path("test.srt"),
            format="srt",
            encoding="utf-8",
            language="zh-CN",
            entries=entries
        )
        
        rule = TimecodeBoundsRule()
        issues = rule.check(sf)
        
        assert len(issues) == 0
    
    def test_inverted_timecode(self):
        entries = [
            SubtitleEntry(
                index=1,
                start_time=timedelta(seconds=5),
                end_time=timedelta(seconds=2),
                text="Test 1",
                raw_text="Test 1"
            ),
        ]
        
        sf = SubtitleFile(
            path=Path("test.srt"),
            format="srt",
            encoding="utf-8",
            language="zh-CN",
            entries=entries
        )
        
        rule = TimecodeBoundsRule()
        issues = rule.check(sf)
        
        assert len(issues) == 1
        assert "方向错误" in issues[0].title
    
    def test_too_short_duration(self):
        entries = [
            SubtitleEntry(
                index=1,
                start_time=timedelta(seconds=0),
                end_time=timedelta(milliseconds=100),
                text="Test",
                raw_text="Test"
            ),
        ]
        
        sf = SubtitleFile(
            path=Path("test.srt"),
            format="srt",
            encoding="utf-8",
            language="zh-CN",
            entries=entries
        )
        
        rule = TimecodeBoundsRule()
        issues = rule.check(sf)
        
        short_issues = [i for i in issues if "过短" in i.title]
        assert len(short_issues) == 1


class TestBilingualAlignmentRule:
    def test_aligned_subtitles(self):
        zh_entries = [
            SubtitleEntry(
                index=1,
                start_time=timedelta(seconds=0),
                end_time=timedelta(seconds=2),
                text="中文",
                raw_text="中文"
            ),
        ]
        
        en_entries = [
            SubtitleEntry(
                index=1,
                start_time=timedelta(seconds=0),
                end_time=timedelta(seconds=2),
                text="English",
                raw_text="English"
            ),
        ]
        
        zh_sf = SubtitleFile(
            path=Path("zh.srt"),
            format="srt",
            encoding="utf-8",
            language="zh-CN",
            entries=zh_entries
        )
        
        en_sf = SubtitleFile(
            path=Path("en.srt"),
            format="srt",
            encoding="utf-8",
            language="en-US",
            entries=en_entries
        )
        
        rule = BilingualAlignmentRule()
        issues = rule.check([zh_sf, en_sf])
        
        assert len(issues) == 0
    
    def test_count_mismatch(self):
        zh_entries = [
            SubtitleEntry(
                index=i,
                start_time=timedelta(seconds=i*3),
                end_time=timedelta(seconds=i*3+2),
                text=f"中文{i}",
                raw_text=f"中文{i}"
            )
            for i in range(3)
        ]
        
        en_entries = [
            SubtitleEntry(
                index=i,
                start_time=timedelta(seconds=i*3),
                end_time=timedelta(seconds=i*3+2),
                text=f"English{i}",
                raw_text=f"English{i}"
            )
            for i in range(2)
        ]
        
        zh_sf = SubtitleFile(
            path=Path("zh.srt"),
            format="srt",
            encoding="utf-8",
            language="zh-CN",
            entries=zh_entries
        )
        
        en_sf = SubtitleFile(
            path=Path("en.srt"),
            format="srt",
            encoding="utf-8",
            language="en-US",
            entries=en_entries
        )
        
        rule = BilingualAlignmentRule()
        issues = rule.check([zh_sf, en_sf])
        
        count_issues = [i for i in issues if "数量不一致" in i.title]
        assert len(count_issues) == 1


class TestRuleEngine:
    def test_run_checks(self):
        entries = [
            SubtitleEntry(
                index=1,
                start_time=timedelta(seconds=0),
                end_time=timedelta(seconds=5),
                text="Test 1",
                raw_text="Test 1"
            ),
            SubtitleEntry(
                index=2,
                start_time=timedelta(seconds=3),
                end_time=timedelta(seconds=6),
                text="Test 2",
                raw_text="Test 2"
            ),
        ]
        
        sf = SubtitleFile(
            path=Path("test.srt"),
            format="srt",
            encoding="utf-8",
            language="zh-CN",
            entries=entries
        )
        
        engine = RuleEngine()
        result = engine.run_checks([sf])
        
        assert result.stats["total"] > 0
        assert result.stats["by_category"]["timeline"] > 0
