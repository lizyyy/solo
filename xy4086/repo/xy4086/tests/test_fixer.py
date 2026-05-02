import pytest
from datetime import timedelta
from src.subtitle_fixer.fixer import Fixer, FixStrategy
from src.subtitle_fixer.models import SubtitleItem, Speaker


class TestFixer:
    def test_fix_time_overlap(self):
        subtitles = [
            SubtitleItem(
                index=1,
                start_time=timedelta(seconds=0),
                end_time=timedelta(seconds=5),
                text="第一条"
            ),
            SubtitleItem(
                index=2,
                start_time=timedelta(seconds=4),
                end_time=timedelta(seconds=8),
                text="第二条"
            )
        ]
        
        fixer = Fixer(strategy=FixStrategy.MODERATE)
        result = fixer.fix(subtitles)
        
        fixed_subs = result.fixed_subtitles
        assert fixed_subs[0].end_time < fixed_subs[1].start_time
        
        overlap_actions = [a for a in result.actions if a.action_type == "adjust_overlap"]
        assert len(overlap_actions) >= 1
    
    def test_fix_invalid_timecode(self):
        subtitles = [
            SubtitleItem(
                index=1,
                start_time=timedelta(seconds=5),
                end_time=timedelta(seconds=3),
                text="时间码错误"
            )
        ]
        
        fixer = Fixer(strategy=FixStrategy.MODERATE)
        result = fixer.fix(subtitles)
        
        fixed_sub = result.fixed_subtitles[0]
        assert fixed_sub.start_time < fixed_sub.end_time
        
        fix_actions = [a for a in result.actions if a.action_type == "fix_timecode"]
        assert len(fix_actions) >= 1
    
    def test_fix_negative_time(self):
        subtitles = [
            SubtitleItem(
                index=1,
                start_time=timedelta(seconds=-5),
                end_time=timedelta(seconds=3),
                text="负时间"
            )
        ]
        
        fixer = Fixer(strategy=FixStrategy.MODERATE)
        result = fixer.fix(subtitles)
        
        fixed_sub = result.fixed_subtitles[0]
        assert fixed_sub.start_time >= timedelta(0)
    
    def test_renumber_indices(self):
        subtitles = [
            SubtitleItem(
                index=3,
                start_time=timedelta(seconds=0),
                end_time=timedelta(seconds=3),
                text="第一条"
            ),
            SubtitleItem(
                index=1,
                start_time=timedelta(seconds=3),
                end_time=timedelta(seconds=6),
                text="第二条"
            )
        ]
        
        fixer = Fixer(strategy=FixStrategy.MODERATE)
        result = fixer.fix(subtitles)
        
        fixed_subs = result.fixed_subtitles
        assert fixed_subs[0].index == 1
        assert fixed_subs[1].index == 2
        
        renumber_actions = [a for a in result.actions if a.action_type == "renumber_index"]
        assert len(renumber_actions) >= 1
    
    def test_normalize_speaker_names(self):
        subtitles = [
            SubtitleItem(
                index=1,
                start_time=timedelta(seconds=0),
                end_time=timedelta(seconds=3),
                text="内容",
                speaker="张老师"
            ),
            SubtitleItem(
                index=2,
                start_time=timedelta(seconds=3),
                end_time=timedelta(seconds=6),
                text="内容",
                speaker="张三"
            )
        ]
        
        speakers = [
            Speaker(name="张三", alias=["张老师", "张先生"], role="嘉宾")
        ]
        
        fixer = Fixer(strategy=FixStrategy.MODERATE)
        fixer.set_speakers(speakers)
        result = fixer.fix(subtitles)
        
        fixed_subs = result.fixed_subtitles
        assert fixed_subs[0].speaker == "张三"
        assert fixed_subs[1].speaker == "张三"
        
        normalize_actions = [a for a in result.actions if a.action_type == "normalize_speaker"]
        assert len(normalize_actions) >= 1
    
    def test_aggressive_strategy_infer_speaker(self):
        subtitles = [
            SubtitleItem(
                index=1,
                start_time=timedelta(seconds=0),
                end_time=timedelta(seconds=3),
                text="内容",
                speaker="张三"
            ),
            SubtitleItem(
                index=2,
                start_time=timedelta(seconds=3),
                end_time=timedelta(seconds=6),
                text="继续说",
                speaker=None
            ),
            SubtitleItem(
                index=3,
                start_time=timedelta(seconds=6),
                end_time=timedelta(seconds=9),
                text="还是他",
                speaker=None
            )
        ]
        
        fixer = Fixer(strategy=FixStrategy.AGGRESSIVE)
        result = fixer.fix(subtitles)
        
        fixed_subs = result.fixed_subtitles
        assert fixed_subs[1].speaker == "张三"
        assert fixed_subs[2].speaker == "张三"
        
        infer_actions = [a for a in result.actions if a.action_type == "infer_speaker"]
        assert len(infer_actions) == 2
    
    def test_conservative_strategy_no_overlap_fix(self):
        subtitles = [
            SubtitleItem(
                index=1,
                start_time=timedelta(seconds=0),
                end_time=timedelta(seconds=5),
                text="第一条"
            ),
            SubtitleItem(
                index=2,
                start_time=timedelta(seconds=4),
                end_time=timedelta(seconds=8),
                text="第二条"
            )
        ]
        
        fixer = Fixer(strategy=FixStrategy.CONSERVATIVE)
        result = fixer.fix(subtitles)
        
        fixed_subs = result.fixed_subtitles
        assert fixed_subs[0].end_time == timedelta(seconds=5)
        
        overlap_actions = [a for a in result.actions if a.action_type == "adjust_overlap"]
        assert len(overlap_actions) == 0
