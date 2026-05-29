import json
import os
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from .masking import mask_dict


def _now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _gen_id() -> str:
    return uuid.uuid4().hex[:12]


class Provenance:
    def __init__(self, source: str, created_at: Optional[str] = None, run_id: Optional[str] = None):
        self.source = source
        self.created_at = created_at or _now_iso()
        self.run_id = run_id or _gen_id()

    def to_dict(self) -> Dict[str, str]:
        return {
            "source": self.source,
            "created_at": self.created_at,
            "run_id": self.run_id,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, str]) -> "Provenance":
        return cls(d["source"], d.get("created_at"), d.get("run_id"))


class TargetPitch:
    def __init__(
        self,
        label: str,
        midi_note: int,
        frequency: float,
        start_beat: float,
        end_beat: float,
        provenance: Optional[Provenance] = None,
    ):
        self.label = label
        self.midi_note = midi_note
        self.frequency = frequency
        self.start_beat = start_beat
        self.end_beat = end_beat
        self.provenance = provenance or Provenance(source="exercise_definition")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": "target_pitch",
            "label": self.label,
            "midi_note": self.midi_note,
            "frequency": round(self.frequency, 2),
            "start_beat": self.start_beat,
            "end_beat": self.end_beat,
            "provenance": self.provenance.to_dict(),
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "TargetPitch":
        return cls(
            label=d["label"],
            midi_note=d["midi_note"],
            frequency=d["frequency"],
            start_beat=d["start_beat"],
            end_beat=d["end_beat"],
            provenance=Provenance.from_dict(d.get("provenance", {})),
        )


class RhythmSegment:
    def __init__(
        self,
        label: str,
        start_time: float,
        end_time: float,
        beat_start: float,
        beat_end: float,
        provenance: Optional[Provenance] = None,
    ):
        self.label = label
        self.start_time = start_time
        self.end_time = end_time
        self.beat_start = beat_start
        self.beat_end = beat_end
        self.provenance = provenance or Provenance(source="exercise_definition")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": "rhythm_segment",
            "label": self.label,
            "start_time": round(self.start_time, 4),
            "end_time": round(self.end_time, 4),
            "beat_start": self.beat_start,
            "beat_end": self.beat_end,
            "provenance": self.provenance.to_dict(),
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "RhythmSegment":
        return cls(
            label=d["label"],
            start_time=d["start_time"],
            end_time=d["end_time"],
            beat_start=d["beat_start"],
            beat_end=d["beat_end"],
            provenance=Provenance.from_dict(d.get("provenance", {})),
        )


class Recording:
    def __init__(
        self,
        file_path: str,
        duration: float,
        sample_rate: int,
        student_id: Optional[str] = None,
        provenance: Optional[Provenance] = None,
    ):
        self.file_path = file_path
        self.duration = duration
        self.sample_rate = sample_rate
        self.student_id = student_id
        self.provenance = provenance or Provenance(source="audio_file")

    def to_dict(self, masked: bool = False) -> Dict[str, Any]:
        d = {
            "type": "recording",
            "file_path": self.file_path,
            "duration": round(self.duration, 3),
            "sample_rate": self.sample_rate,
            "student_id": self.student_id,
            "provenance": self.provenance.to_dict(),
        }
        if masked:
            d = mask_dict(d)
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "Recording":
        return cls(
            file_path=d["file_path"],
            duration=d["duration"],
            sample_rate=d["sample_rate"],
            student_id=d.get("student_id"),
            provenance=Provenance.from_dict(d.get("provenance", {})),
        )


class StudentProfile:
    def __init__(
        self,
        student_id: str,
        student_name: str,
        age: Optional[int] = None,
        level: Optional[str] = None,
        created_at: Optional[str] = None,
        session_ids: Optional[List[str]] = None,
        provenance: Optional[Provenance] = None,
    ):
        self.student_id = student_id
        self.student_name = student_name
        self.age = age
        self.level = level
        self.created_at = created_at or _now_iso()
        self.session_ids = session_ids or []
        self.provenance = provenance or Provenance(source="student_registration")

    def to_dict(self, masked: bool = False) -> Dict[str, Any]:
        d = {
            "type": "student_profile",
            "student_id": self.student_id,
            "student_name": self.student_name,
            "age": self.age,
            "level": self.level,
            "created_at": self.created_at,
            "session_ids": self.session_ids,
            "provenance": self.provenance.to_dict(),
        }
        if masked:
            d = mask_dict(d)
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "StudentProfile":
        return cls(
            student_id=d["student_id"],
            student_name=d.get("student_name", ""),
            age=d.get("age"),
            level=d.get("level"),
            created_at=d.get("created_at"),
            session_ids=d.get("session_ids", []),
            provenance=Provenance.from_dict(d.get("provenance", {})),
        )


class TeacherComment:
    def __init__(
        self,
        comment_id: str,
        student_id: str,
        session_id: str,
        teacher_name: str,
        content: str,
        created_at: Optional[str] = None,
        provenance: Optional[Provenance] = None,
    ):
        self.comment_id = comment_id
        self.student_id = student_id
        self.session_id = session_id
        self.teacher_name = teacher_name
        self.content = content
        self.created_at = created_at or _now_iso()
        self.provenance = provenance or Provenance(source="teacher_input")

    def to_dict(self, masked: bool = False) -> Dict[str, Any]:
        d = {
            "type": "teacher_comment",
            "comment_id": self.comment_id,
            "student_id": self.student_id,
            "session_id": self.session_id,
            "teacher_name": self.teacher_name,
            "content": self.content,
            "created_at": self.created_at,
            "provenance": self.provenance.to_dict(),
        }
        if masked:
            d = mask_dict(d)
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "TeacherComment":
        return cls(
            comment_id=d["comment_id"],
            student_id=d["student_id"],
            session_id=d["session_id"],
            teacher_name=d.get("teacher_name", ""),
            content=d["content"],
            created_at=d.get("created_at"),
            provenance=Provenance.from_dict(d.get("provenance", {})),
        )


class PitchFrame:
    def __init__(self, time_offset: float, frequency: float, midi_note: float, confidence: float):
        self.time_offset = time_offset
        self.frequency = frequency
        self.midi_note = midi_note
        self.confidence = confidence

    def to_dict(self) -> Dict[str, Any]:
        return {
            "time_offset": round(self.time_offset, 4),
            "frequency": round(self.frequency, 2),
            "midi_note": round(self.midi_note, 2),
            "confidence": round(self.confidence, 3),
        }


class PracticeSession:
    def __init__(
        self,
        session_id: str,
        student_id: str,
        recording: Recording,
        targets: List[TargetPitch],
        segments: List[RhythmSegment],
        pitch_frames: List[PitchFrame],
        provenance: Optional[Provenance] = None,
    ):
        self.session_id = session_id
        self.student_id = student_id
        self.recording = recording
        self.targets = targets
        self.segments = segments
        self.pitch_frames = pitch_frames
        self.provenance = provenance or Provenance(source="practice_analysis")

    def to_dict(self, masked: bool = False) -> Dict[str, Any]:
        d = {
            "type": "practice_session",
            "session_id": self.session_id,
            "student_id": self.student_id,
            "recording": self.recording.to_dict(masked=masked),
            "targets": [t.to_dict() for t in self.targets],
            "segments": [s.to_dict() for s in self.segments],
            "pitch_frames": [f.to_dict() for f in self.pitch_frames],
            "provenance": self.provenance.to_dict(),
        }
        if masked:
            d = mask_dict(d)
        return d


class PracticeReport:
    def __init__(
        self,
        report_id: str,
        session_id: str,
        student_id: str,
        overall_score: float,
        segment_scores: List[Dict[str, Any]],
        error_stats: Dict[str, float],
        edge_case_warnings: List[Dict[str, str]],
        comment_ids: List[str],
        provenance: Optional[Provenance] = None,
    ):
        self.report_id = report_id
        self.session_id = session_id
        self.student_id = student_id
        self.overall_score = overall_score
        self.segment_scores = segment_scores
        self.error_stats = error_stats
        self.edge_case_warnings = edge_case_warnings
        self.comment_ids = comment_ids
        self.provenance = provenance or Provenance(source="report_generation")

    def to_dict(self, masked: bool = False) -> Dict[str, Any]:
        d = {
            "type": "practice_report",
            "report_id": self.report_id,
            "session_id": self.session_id,
            "student_id": self.student_id,
            "overall_score": round(self.overall_score, 2),
            "segment_scores": self.segment_scores,
            "error_stats": {k: round(v, 2) for k, v in self.error_stats.items()},
            "edge_case_warnings": self.edge_case_warnings,
            "comment_ids": self.comment_ids,
            "provenance": self.provenance.to_dict(),
        }
        if masked:
            d = mask_dict(d)
        return d


def save_json(data: Dict[str, Any], path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)
