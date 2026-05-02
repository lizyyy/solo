"""
Minimal tests for nvr_audit validator module.
"""
import json
import tempfile
from pathlib import Path

import pytest

from nvr_audit.parser import ParsedData, Clip, ClockEvent, FFProbeSummary
from nvr_audit.validator import (
    build_timelines,
    validate,
    _split_crossmidnight,
    _check_overlapping_filenames,
)


def test_split_crossmidnight_no_split():
    clip = Clip(
        camera_id="CAM_A",
        filename="test.mp4",
        start_time="2025-05-01T10:00:00Z",
        end_time="2025-05-01T12:00:00Z",
        duration=7200.0,
        file_size=100000,
    )
    result = _split_crossmidnight(clip)
    assert len(result) == 1


def test_split_crossmidnight_splits():
    clip = Clip(
        camera_id="CAM_A",
        filename="test.mp4",
        start_time="2025-05-01T22:00:00Z",
        end_time="2025-05-02T02:00:00Z",
        duration=14400.0,
        file_size=200000,
    )
    result = _split_crossmidnight(clip)
    assert len(result) == 2
    assert result[0].end_time.startswith("2025-05-01T23:59:59")
    assert result[1].start_time.startswith("2025-05-02T00:00:00")


def test_duplicate_filename_different_camera():
    clips = [
        Clip("CAM_A", "shared.mp4", "2025-05-01T08:00:00Z", "2025-05-01T09:00:00Z", 3600, 50000),
        Clip("CAM_B", "shared.mp4", "2025-05-01T09:00:00Z", "2025-05-01T10:00:00Z", 3600, 50000),
    ]
    issues = _check_overlapping_filenames(clips)
    assert len(issues) == 1
    assert issues[0].issue_type == "duplicate_filename_different_camera"


def test_gap_detection():
    clips = [
        Clip("CAM_A", "clip1.mp4", "2025-05-01T08:00:00Z", "2025-05-01T08:30:00Z", 1800, 50000),
        Clip("CAM_A", "clip2.mp4", "2025-05-01T08:35:00Z", "2025-05-01T09:00:00Z", 1500, 50000),
    ]
    data = ParsedData(clips=clips, clock_events=[], ffprobe_summaries={}, rules={})
    timelines = build_timelines(data)
    result = validate(timelines, data, {})
    gap_issues = [i for i in result.all_issues if i.issue_type == "gap"]
    assert len(gap_issues) == 1
    assert "300.0s" in gap_issues[0].detail


def test_overlap_detection():
    clips = [
        Clip("CAM_A", "clip1.mp4", "2025-05-01T08:00:00Z", "2025-05-01T09:00:00Z", 3600, 50000),
        Clip("CAM_A", "clip2.mp4", "2025-05-01T08:50:00Z", "2025-05-01T09:30:00Z", 2400, 50000),
    ]
    data = ParsedData(clips=clips, clock_events=[], ffprobe_summaries={}, rules={})
    timelines = build_timelines(data)
    result = validate(timelines, data, {})
    overlap_issues = [i for i in result.all_issues if i.issue_type == "overlap"]
    assert len(overlap_issues) == 1
    assert overlap_issues[0].severity == "error"


def test_clock_rewind_detection():
    clips = [
        Clip("CAM_A", "clip1.mp4", "2025-05-01T08:00:00Z", "2025-05-01T09:00:00Z", 3600, 50000),
    ]
    clock_events = [
        ClockEvent("CAM_A", "clock_rewind", "2025-05-01T08:30:00Z", "08:30:00", "08:15:00"),
    ]
    data = ParsedData(clips=clips, clock_events=clock_events, ffprobe_summaries={}, rules={})
    timelines = build_timelines(data)
    result = validate(timelines, data, {})
    rewind_issues = [i for i in result.all_issues if i.issue_type == "clock_rewind"]
    assert len(rewind_issues) == 1


def test_low_bitrate_detection():
    clips = [
        Clip("CAM_A", "clip1.mp4", "2025-05-01T08:00:00Z", "2025-05-01T09:00:00Z", 3600, 50000),
    ]
    ffprobe = {
        "clip1.mp4": FFProbeSummary("clip1.mp4", 3600.0, 150, 1920, 1080, 25.0),
    }
    rules = {"thresholds": {"low_bitrate_kbps": 256}}
    data = ParsedData(clips=clips, clock_events=[], ffprobe_summaries=ffprobe, rules=rules)
    timelines = build_timelines(data)
    result = validate(timelines, data, rules)
    lb_issues = [i for i in result.all_issues if i.issue_type == "low_bitrate"]
    assert len(lb_issues) == 1
