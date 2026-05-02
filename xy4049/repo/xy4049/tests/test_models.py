"""Tests for models module"""

import pytest
from subtitle_checker.models import (
    IssueType,
    IssueSeverity,
    Language,
    Timecode,
    SubtitleEntry,
    ProjectConfig,
)


class TestTimecode:
    def test_to_seconds(self):
        tc = Timecode(hours=0, minutes=1, seconds=30, milliseconds=500)
        assert tc.to_seconds() == 90.5

    def test_from_seconds(self):
        tc = Timecode.from_seconds(90.5)
        assert tc.hours == 0
        assert tc.minutes == 1
        assert tc.seconds == 30
        assert tc.milliseconds == 500

    def test_to_srt_format(self):
        tc = Timecode(hours=1, minutes=2, seconds=3, milliseconds=456)
        assert tc.to_srt_format() == "01:02:03,456"

    def test_to_vtt_format(self):
        tc = Timecode(hours=1, minutes=2, seconds=3, milliseconds=456)
        assert tc.to_vtt_format() == "01:02:03.456"


class TestSubtitleEntry:
    def test_duration_seconds(self):
        entry = SubtitleEntry(
            index=1,
            start=Timecode(hours=0, minutes=0, seconds=1, milliseconds=0),
            end=Timecode(hours=0, minutes=0, seconds=4, milliseconds=500),
            text="Test subtitle",
        )
        assert entry.duration_seconds() == 3.5

    def test_reading_speed(self):
        entry = SubtitleEntry(
            index=1,
            start=Timecode(hours=0, minutes=0, seconds=0, milliseconds=0),
            end=Timecode(hours=0, minutes=0, seconds=2, milliseconds=0),
            text="Hello World",
        )
        speed = entry.reading_speed()
        assert speed == 5.5  # 11 chars / 2 seconds


class TestProjectConfig:
    def test_defaults(self):
        config = ProjectConfig()
        assert Language.ZH in config.languages
        assert Language.EN in config.languages
        assert config.frame_rate == 25.0
        assert config.max_reading_speed_zh == 6.0
        assert config.max_reading_speed_en == 12.0
        assert config.min_subtitle_gap_ms == 40
        assert config.output_directory == "dist"
