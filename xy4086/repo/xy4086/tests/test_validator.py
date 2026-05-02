import pytest
from datetime import timedelta
from src.subtitle_fixer.validator import Validator, ValidatorConfig
from src.subtitle_fixer.models import SubtitleItem, Speaker, Chapter, IssueType, IssueSeverity


class TestValidator:
    def test_detect_time_overlap(self):
        subtitles = [
            SubtitleItem(
                index=1,
                start_time=timedelta(seconds=0),
                end_time=timedelta(seconds=5),
                text="第一条字幕"
            ),
            SubtitleItem(
                index=2,
                start_time=timedelta(seconds=4),
                end_time=timedelta(seconds=8),
                text="第二条字幕"
            )
        ]
        
        validator = Validator()
        result = validator.validate_all(subtitles)
        
        overlap_issues = [i for i in result.issues if i.issue_type == IssueType.TIME_OVERLAP]
        assert len(overlap_issues) == 1
    
    def test_detect_invalid_timecode(self):
        subtitles = [
            SubtitleItem(
                index=1,
                start_time=timedelta(seconds=5),
                end_time=timedelta(seconds=3),
                text="时间码错误"
            )
        ]
        
        validator = Validator()
        result = validator.validate_all(subtitles)
        
        invalid_issues = [i for i in result.issues if i.issue_type == IssueType.INVALID_TIMECODE]
        assert len(invalid_issues) >= 1
    
    def test_detect_negative_time(self):
        subtitles = [
            SubtitleItem(
                index=1,
                start_time=timedelta(seconds=-5),
                end_time=timedelta(seconds=3),
                text="负时间"
            )
        ]
        
        validator = Validator()
        result = validator.validate_all(subtitles)
        
        invalid_issues = [i for i in result.issues if i.issue_type == IssueType.INVALID_TIMECODE]
        assert len(invalid_issues) >= 1
    
    def test_detect_too_long_subtitle(self):
        config = ValidatorConfig(max_subtitle_duration=5.0)
        subtitles = [
            SubtitleItem(
                index=1,
                start_time=timedelta(seconds=0),
                end_time=timedelta(seconds=10),
                text="这条字幕太长了"
            )
        ]
        
        validator = Validator(config)
        result = validator.validate_all(subtitles)
        
        long_issues = [i for i in result.issues if i.issue_type == IssueType.TOO_LONG_SUBTITLE]
        assert len(long_issues) == 1
    
    def test_detect_empty_subtitle(self):
        subtitles = [
            SubtitleItem(
                index=1,
                start_time=timedelta(seconds=0),
                end_time=timedelta(seconds=3),
                text=""
            ),
            SubtitleItem(
                index=2,
                start_time=timedelta(seconds=3),
                end_time=timedelta(seconds=5),
                text="   "
            )
        ]
        
        validator = Validator()
        result = validator.validate_all(subtitles)
        
        empty_issues = [i for i in result.issues if i.issue_type == IssueType.EMPTY_SUBTITLE]
        assert len(empty_issues) == 2
    
    def test_detect_speaker_not_in_list(self):
        subtitles = [
            SubtitleItem(
                index=1,
                start_time=timedelta(seconds=0),
                end_time=timedelta(seconds=3),
                text="内容",
                speaker="未知嘉宾"
            )
        ]
        
        speakers = [
            Speaker(name="张三", alias=[], role="嘉宾"),
            Speaker(name="李四", alias=[], role="嘉宾")
        ]
        
        validator = Validator()
        validator.set_speakers(speakers)
        result = validator.validate_all(subtitles)
        
        speaker_issues = [i for i in result.issues if i.issue_type == IssueType.SPEAKER_NOT_FOUND]
        assert len(speaker_issues) == 1
    
    def test_detect_missing_speaker(self):
        config = ValidatorConfig(require_speaker_label=True)
        subtitles = [
            SubtitleItem(
                index=1,
                start_time=timedelta(seconds=0),
                end_time=timedelta(seconds=3),
                text="内容",
                speaker=None
            )
        ]
        
        validator = Validator(config)
        result = validator.validate_all(subtitles)
        
        missing_issues = [i for i in result.issues if i.issue_type == IssueType.MISSING_SPEAKER]
        assert len(missing_issues) == 1
    
    def test_alias_recognition(self):
        subtitles = [
            SubtitleItem(
                index=1,
                start_time=timedelta(seconds=0),
                end_time=timedelta(seconds=3),
                text="内容",
                speaker="张老师"
            )
        ]
        
        speakers = [
            Speaker(name="张三", alias=["张老师", "张先生"], role="嘉宾")
        ]
        
        validator = Validator()
        validator.set_speakers(speakers)
        result = validator.validate_all(subtitles)
        
        speaker_issues = [i for i in result.issues if i.issue_type == IssueType.SPEAKER_NOT_FOUND]
        assert len(speaker_issues) == 0
    
    def test_valid_subtitles(self):
        subtitles = [
            SubtitleItem(
                index=1,
                start_time=timedelta(seconds=0),
                end_time=timedelta(seconds=3),
                text="第一条字幕"
            ),
            SubtitleItem(
                index=2,
                start_time=timedelta(seconds=3),
                end_time=timedelta(seconds=6),
                text="第二条字幕"
            )
        ]
        
        config = ValidatorConfig(require_speaker_label=False)
        validator = Validator(config)
        result = validator.validate_all(subtitles)
        
        assert result.is_valid == True
        assert result.total_count == 0


class TestChapterValidation:
    def test_chapter_before_first_subtitle(self):
        subtitles = [
            SubtitleItem(
                index=1,
                start_time=timedelta(seconds=10),
                end_time=timedelta(seconds=15),
                text="第一条字幕"
            )
        ]
        
        chapters = [
            Chapter(
                title="开场",
                start_time=timedelta(seconds=0)
            )
        ]
        
        config = ValidatorConfig(max_chapter_drift_seconds=5.0)
        validator = Validator(config)
        result = validator.validate_all(subtitles, chapters)
        
        drift_issues = [i for i in result.issues if i.issue_type == IssueType.CHAPTER_DRIFT]
        assert len(drift_issues) >= 1
