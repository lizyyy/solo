"""
Minimal tests for nvr_audit parser module.
"""
import json
import tempfile
from pathlib import Path

import pytest

from nvr_audit.parser import (
    parse_clips_manifest,
    parse_device_clock_events,
    parse_ffprobe_summaries,
    parse_rules,
)


def test_parse_clips_manifest():
    with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, newline="") as f:
        f.write("camera_id,filename,start_time,end_time,duration,file_size\n")
        f.write("CAM_A,test.mp4,2025-05-01T08:00:00Z,2025-05-01T08:30:00Z,1800,52428800\n")
        f.write("CAM_B,test2.mp4,2025-05-01T09:00:00Z,2025-05-01T09:30:00Z,1800,52428800\n")
        path = f.name

    clips = parse_clips_manifest(path)
    assert len(clips) == 2
    assert clips[0].camera_id == "CAM_A"
    assert clips[1].filename == "test2.mp4"
    Path(path).unlink()


def test_parse_device_clock_events():
    with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False, encoding="utf-8") as f:
        f.write('{"camera_id":"CAM_A","event_type":"clock_rewind","timestamp":"2025-05-01T08:00:00Z","old_value":"08:00:00","new_value":"07:55:00"}\n')
        f.write('{"camera_id":"CAM_B","event_type":"ntp_sync","timestamp":"2025-05-01T09:00:00Z"}\n')
        path = f.name

    events = parse_device_clock_events(path)
    assert len(events) == 2
    assert events[0].event_type == "clock_rewind"
    assert events[0].old_value == "08:00:00"
    Path(path).unlink()


def test_parse_ffprobe_summaries():
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8") as f:
        json.dump([
            {"filename": "clip1.mp4", "duration": 1800.0, "bitrate": 512, "width": 1920, "height": 1080, "fps": 25.0},
            {"filename": "clip2.mp4", "duration": 900.0, "bitrate": 200, "width": 1280, "height": 720, "fps": 20.0},
        ], f)
        path = f.name

    summaries = parse_ffprobe_summaries(path)
    assert len(summaries) == 2
    assert summaries["clip1.mp4"].bitrate == 512
    assert summaries["clip2.mp4"].fps == 20.0
    Path(path).unlink()


def test_parse_rules():
    with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False, encoding="utf-8") as f:
        f.write("thresholds:\n  low_bitrate_kbps: 300\n  frame_drop_gap_sec: 1.5\ncheck_gaps: true\n")
        path = f.name

    rules = parse_rules(path)
    assert rules["thresholds"]["low_bitrate_kbps"] == 300
    assert rules["check_gaps"] is True
    Path(path).unlink()
