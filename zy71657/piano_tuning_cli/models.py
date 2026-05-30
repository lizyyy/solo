from __future__ import annotations

import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Tuple


A4_FREQ = 440.0
NOTE_NAMES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
NOTE_NAMES_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]

ENHARMONIC_MAP: Dict[str, str] = {}
for i in range(12):
    sharp = NOTE_NAMES_SHARP[i]
    flat = NOTE_NAMES_FLAT[i]
    if sharp != flat:
        ENHARMONIC_MAP[sharp] = flat
        ENHARMONIC_MAP[flat] = sharp

ENHARMONIC_ALIASES: Dict[str, str] = {
    "C#": "C#", "Db": "C#",
    "D#": "D#", "Eb": "D#",
    "F#": "F#", "Gb": "F#",
    "G#": "G#", "Ab": "G#",
    "A#": "A#", "Bb": "A#",
    "B#": "C", "Cb": "B",
    "E#": "F", "Fb": "E",
    "Csharp": "C#", "Dsharp": "D#",
    "Esharp": "F", "Fflat": "E",
    "Fsharp": "F#", "Gsharp": "G#",
    "Asharp": "A#", "Bsharp": "C",
    "Cflat": "B", "Dflat": "C#",
    "Eflat": "D#", "Gflat": "F#",
    "Aflat": "G#", "Bflat": "A#",
}

SEMITONE_INDEX: Dict[str, int] = {
    "C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4,
    "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9,
    "A#": 10, "B": 11,
}


class ToneZone(Enum):
    LOW_BASS = "低音区(A0-E2)"
    BASS = "次低音区(F2-B2)"
    MID_LOW = "中低音区(C3-B3)"
    MID_HIGH = "中高音区(C4-B4)"
    TREBLE = "高音区(C5-B5)"
    HIGH_TREBLE = "最高音区(C6-C8)"
    UNKNOWN = "未知音区"


class TuningPhase(Enum):
    BEFORE = "before"
    AFTER = "after"
    UNKNOWN = "unknown"


class ConflictPolicy(Enum):
    SKIP = "skip"
    UPDATE = "update"
    ERROR = "error"


@dataclass
class ParsedNote:
    name: str
    octave: int
    canonical: str
    semitone: int
    midi_number: int
    standard_freq: float

    @property
    def tone_zone(self) -> ToneZone:
        m = self.midi_number
        if m < 21 or m > 108:
            return ToneZone.UNKNOWN
        if m <= 40:
            return ToneZone.LOW_BASS
        if m <= 47:
            return ToneZone.BASS
        if m <= 59:
            return ToneZone.MID_LOW
        if m <= 71:
            return ToneZone.MID_HIGH
        if m <= 83:
            return ToneZone.TREBLE
        return ToneZone.HIGH_TREBLE


@dataclass
class TuningRecord:
    piano_id: str
    note_raw: str
    note_parsed: Optional[ParsedNote] = None
    measured_freq: Optional[float] = None
    freq_unit: str = "Hz"
    deviation_cents: Optional[float] = None
    deviation_hz: Optional[float] = None
    tuning_date: str = ""
    tuning_phase: TuningPhase = TuningPhase.UNKNOWN
    room_temp: Optional[float] = None
    room_humidity: Optional[float] = None
    customer_note: str = ""
    source_file: str = ""
    row_index: int = -1

    @property
    def primary_key(self) -> str:
        note_key = self.note_parsed.canonical if self.note_parsed else self.note_raw
        return f"{self.piano_id}|{note_key}|{self.tuning_date}|{self.tuning_phase.value}"


@dataclass
class DeviationResult:
    note: str
    octave: int
    canonical: str
    tone_zone: ToneZone
    measured_freq: Optional[float]
    standard_freq: Optional[float]
    deviation_cents: Optional[float]
    deviation_hz: Optional[float]
    is_anomalous: bool = False
    anomaly_reasons: List[str] = field(default_factory=list)


@dataclass
class ZoneAggregate:
    zone: ToneZone
    note_count: int
    avg_deviation_cents: Optional[float]
    max_deviation_cents: Optional[float]
    min_deviation_cents: Optional[float]
    std_deviation_cents: Optional[float]
    unstable_notes: List[str] = field(default_factory=list)

    @property
    def instability_rank_label(self) -> str:
        if self.avg_deviation_cents is None:
            return "无数据"
        abs_avg = abs(self.avg_deviation_cents)
        if abs_avg < 2:
            return "稳定"
        if abs_avg < 5:
            return "轻微偏移"
        if abs_avg < 10:
            return "不稳定"
        return "严重偏移"


@dataclass
class TrendComparison:
    zone: ToneZone
    before_avg_cents: Optional[float]
    after_avg_cents: Optional[float]
    improvement_cents: Optional[float]
    before_max_cents: Optional[float]
    after_max_cents: Optional[float]
    notes: List[str] = field(default_factory=list)


@dataclass
class AnomalyExplanation:
    record_key: str
    anomaly_type: str
    detail: str
    suggestion: str


@dataclass
class ImportConflict:
    existing: TuningRecord
    incoming: TuningRecord
    field_differences: List[Tuple[str, str, str]] = field(default_factory=list)


ENHARMONIC_OCTAVE_ADJUST: Dict[str, int] = {
    "B#": 1, "Bsharp": 1,
    "Cb": -1, "Cflat": -1,
}


def parse_note(raw: str) -> Optional[ParsedNote]:
    if not raw or not isinstance(raw, str):
        return None
    s = raw.strip()
    if not s:
        return None

    s = s.replace("♯", "#").replace("♭", "b")
    s = s.replace("＃", "#")

    note_part = ""
    octave_part = ""
    for i, ch in enumerate(s):
        if ch.isdigit() or (ch == "-" and i > 0):
            note_part = s[:i]
            octave_part = s[i:]
            break
    if not note_part:
        note_part = s

    if not octave_part and note_part:
        for suffix in ["0", "1", "2", "3", "4", "5", "6", "7", "8"]:
            if note_part.endswith(suffix) and len(note_part) > 1 and not note_part[-2].isdigit():
                note_part = note_part[:-1]
                octave_part = suffix
                break

    canonical = ENHARMONIC_ALIASES.get(note_part, note_part)

    if canonical not in SEMITONE_INDEX:
        return None

    try:
        octave = int(octave_part)
    except (ValueError, TypeError):
        return None

    octave_adjust = ENHARMONIC_OCTAVE_ADJUST.get(note_part, 0)
    effective_octave = octave + octave_adjust

    if effective_octave < 0 or effective_octave > 8:
        return None

    semitone = SEMITONE_INDEX[canonical]
    midi_number = (effective_octave + 1) * 12 + semitone

    if midi_number < 21 or midi_number > 108:
        return None

    semitones_from_a4 = midi_number - 69
    standard_freq = A4_FREQ * (2 ** (semitones_from_a4 / 12.0))

    return ParsedNote(
        name=note_part,
        octave=effective_octave,
        canonical=f"{canonical}{effective_octave}",
        semitone=semitone,
        midi_number=midi_number,
        standard_freq=standard_freq,
    )


def freq_to_cents(measured: float, standard: float) -> float:
    if measured <= 0 or standard <= 0:
        return 0.0
    return 1200.0 * math.log2(measured / standard)


def cents_to_hz(cents: float, standard: float) -> float:
    return standard * (2 ** (cents / 1200.0))


def detect_freq_unit(value: str) -> str:
    if not isinstance(value, str):
        return "Hz"
    s = value.strip().lower()
    if s.endswith("cent") or s.endswith("cents") or s.endswith("¢"):
        return "cents"
    if s.endswith("khz") or s.endswith("千赫"):
        return "kHz"
    return "Hz"
