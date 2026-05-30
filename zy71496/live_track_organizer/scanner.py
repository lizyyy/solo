from __future__ import annotations

import os
import re
import struct
import wave
from datetime import datetime
from pathlib import Path

from .models import TrackInfo, InfoSource


AUDIO_EXTENSIONS = {".wav", ".aif", ".aiff", ".flac", ".mp3"}

TS_PATTERN = re.compile(r"(\d{4})(\d{2})(\d{2})[_T]?(\d{2})(\d{2})(\d{2})")

CHANNEL_TABLE = {
    "kick": "Kick",
    "bd": "Kick",
    "bass drum": "Kick",
    "snare": "Snare",
    "sd": "Snare",
    "hihat": "HiHat",
    "hh": "HiHat",
    "hi-hat": "HiHat",
    "oh l": "OH_L",
    "oh r": "OH_R",
    "overhead l": "OH_L",
    "overhead r": "OH_R",
    "oh left": "OH_L",
    "oh right": "OH_R",
    "bass": "Bass",
    "di": "Bass_DI",
    "bass di": "Bass_DI",
    "gtr l": "Gtr_L",
    "gtr r": "Gtr_R",
    "guitar l": "Gtr_L",
    "guitar r": "Gtr_R",
    "keys l": "Keys_L",
    "keys r": "Keys_R",
    "keyboard l": "Keys_L",
    "keyboard r": "Keys_R",
    "synth l": "Keys_L",
    "synth r": "Keys_R",
    "vox": "Vox",
    "vocal": "Vox",
    "lead vocal": "Vox_Lead",
    "bgv": "Vox_BG",
    "bgv l": "Vox_BG_L",
    "bgv r": "Vox_BG_R",
    "backing vocal": "Vox_BG",
    "acoustic": "AcGtr",
    "ac gtr": "AcGtr",
    "acoustic gtr": "AcGtr",
    "piano": "Piano",
    "strings": "Strings",
    "fx": "FX",
    "talkback": "Talkback",
    "room l": "Room_L",
    "room r": "Room_R",
    "audience l": "Audience_L",
    "audience r": "Audience_R",
}

PART_TABLE = {
    "Kick": "Drums",
    "Snare": "Drums",
    "HiHat": "Drums",
    "OH_L": "Drums",
    "OH_R": "Drums",
    "Room_L": "Drums",
    "Room_R": "Drums",
    "Bass": "Bass",
    "Bass_DI": "Bass",
    "Gtr_L": "Guitar",
    "Gtr_R": "Guitar",
    "AcGtr": "Guitar",
    "Keys_L": "Keys",
    "Keys_R": "Keys",
    "Piano": "Keys",
    "Vox": "Vocals",
    "Vox_Lead": "Vocals",
    "Vox_BG": "Vocals",
    "Vox_BG_L": "Vocals",
    "Vox_BG_R": "Vocals",
    "Strings": "Strings",
    "FX": "FX",
    "Talkback": "Utility",
    "Audience_L": "Ambience",
    "Audience_R": "Ambience",
}


def _parse_timestamp(ts_str: str) -> datetime | None:
    m = TS_PATTERN.match(ts_str)
    if not m:
        return None
    try:
        return datetime(
            int(m.group(1)), int(m.group(2)), int(m.group(3)),
            int(m.group(4)), int(m.group(5)), int(m.group(6)),
        )
    except ValueError:
        return None


def _normalize_channel_name(raw: str) -> str:
    cleaned = raw.strip().lower()
    if cleaned in CHANNEL_TABLE:
        return CHANNEL_TABLE[cleaned]
    upper_candidates = {
        "oh_l": "OH_L",
        "oh_r": "OH_R",
        "room_l": "Room_L",
        "room_r": "Room_R",
        "gtr_l": "Gtr_L",
        "gtr_r": "Gtr_R",
        "keys_l": "Keys_L",
        "keys_r": "Keys_R",
        "bgv_l": "Vox_BG_L",
        "bgv_r": "Vox_BG_R",
        "bass_di": "Bass_DI",
        "ac_gtr": "AcGtr",
    }
    if cleaned in upper_candidates:
        return upper_candidates[cleaned]
    return raw.strip()


def _read_wav_metadata(filepath: str) -> dict:
    meta = {}
    try:
        with open(filepath, "rb") as f:
            riff = f.read(4)
            if riff != b"RIFF":
                return meta
            f.read(4)
            wave_id = f.read(4)
            if wave_id != b"WAVE":
                return meta

            while True:
                chunk_header = f.read(8)
                if len(chunk_header) < 8:
                    break
                chunk_id = chunk_header[:4]
                chunk_size = struct.unpack("<I", chunk_header[4:8])[0]

                if chunk_id == b"fmt ":
                    fmt_data = f.read(min(chunk_size, 40))
                    if len(fmt_data) >= 14:
                        audio_fmt = struct.unpack("<H", fmt_data[0:2])[0]
                        n_channels = struct.unpack("<H", fmt_data[2:4])[0]
                        sample_rate = struct.unpack("<I", fmt_data[4:8])[0]
                        meta["channels"] = n_channels
                        meta["sample_rate"] = sample_rate
                        meta["audio_format"] = audio_fmt
                    if chunk_size > 40:
                        f.seek(chunk_size - 40, 1)
                elif chunk_id == b"iXML":
                    ixml_data = f.read(min(chunk_size, 4096))
                    meta["ixml_raw"] = ixml_data
                    try:
                        text = ixml_data.decode("utf-8", errors="ignore")
                        meta["ixml_text"] = text
                        tc_match = re.search(
                            r"<TIMESTAMP>(.*?)</TIMESTAMP>", text, re.IGNORECASE
                        )
                        if tc_match:
                            meta["ixml_timestamp"] = tc_match.group(1).strip()
                        ch_match = re.search(
                            r"<CHANNEL>(.*?)</CHANNEL>", text, re.IGNORECASE
                        )
                        if ch_match:
                            meta["ixml_channel"] = ch_match.group(1).strip()
                        track_match = re.search(
                            r"<TRACK_INDEX>(\d+)</TRACK_INDEX>", text, re.IGNORECASE
                        )
                        if track_match:
                            meta["ixml_track_index"] = int(track_match.group(1))
                    except Exception:
                        pass
                    if chunk_size > 4096:
                        f.seek(chunk_size - 4096, 1)
                elif chunk_id == b"bext":
                    bext_data = f.read(min(chunk_size, 602))
                    if len(bext_data) >= 256:
                        try:
                            description = bext_data[:256].decode("ascii", errors="ignore").strip("\x00").strip()
                            if description:
                                meta["bext_description"] = description
                            originator = bext_data[256:288].decode("ascii", errors="ignore").strip("\x00").strip()
                            if originator:
                                meta["bext_originator"] = originator
                            orig_date = bext_data[288:298].decode("ascii", errors="ignore").strip("\x00").strip()
                            if orig_date:
                                meta["bext_date"] = orig_date
                            orig_time = bext_data[298:306].decode("ascii", errors="ignore").strip("\x00").strip()
                            if orig_time:
                                meta["bext_time"] = orig_time
                        except Exception:
                            pass
                    if chunk_size > 602:
                        f.seek(chunk_size - 602, 1)
                else:
                    f.seek(chunk_size, 1)
    except Exception:
        pass
    return meta


def _get_duration(filepath: str) -> float:
    try:
        with wave.open(filepath, "rb") as wf:
            frames = wf.getnframes()
            rate = wf.getframerate()
            return frames / rate if rate > 0 else 0.0
    except Exception:
        return 0.0


def scan_directory(input_dir: str) -> list[TrackInfo]:
    input_path = Path(input_dir)
    if not input_path.exists():
        raise FileNotFoundError(f"输入目录不存在: {input_dir}")

    tracks: list[TrackInfo] = []
    idx = 0

    for fp in sorted(input_path.rglob("*")):
        if fp.suffix.lower() not in AUDIO_EXTENSIONS:
            continue

        track = TrackInfo(
            file_path=str(fp),
            original_name=fp.name,
            track_index=idx,
        )
        idx += 1

        _parse_filename(fp.name, track)
        _parse_file_metadata(str(fp), track)

        if track.channels == 0 and fp.suffix.lower() == ".wav":
            try:
                with wave.open(str(fp), "rb") as wf:
                    track.channels = wf.getnchannels()
                    track.sample_rate = wf.getframerate()
            except Exception:
                pass

        if track.duration_seconds == 0.0 and fp.suffix.lower() == ".wav":
            track.duration_seconds = _get_duration(str(fp))

        tracks.append(track)

    return tracks


def _parse_filename(name: str, track: TrackInfo) -> None:
    stem = name[: name.rfind(".")] if "." in name else name

    ts_match = re.search(r"(\d{8}[_T]?\d{6})", stem)
    if ts_match:
        ts = _parse_timestamp(ts_match.group(1))
        if ts:
            track.timestamp_from_filename = ts
            stem = stem.replace(ts_match.group(1), "").strip(" _-")

    parts = re.split(r"[_\-\s]+", stem)
    tracknum_candidates = []
    for i, p in enumerate(parts):
        if p.isdigit() and 1 <= len(p) <= 3:
            tracknum_candidates.append((i, int(p)))

    if tracknum_candidates:
        i, num = tracknum_candidates[0]
        track.track_index = num
        parts.pop(i)

    channel_parts = [p for p in parts if p]
    if channel_parts:
        channel_candidate = "_".join(channel_parts)
        track.channel_name_from_filename = channel_candidate

    if len(channel_parts) >= 2:
        last = channel_parts[-1]
        if not re.match(r"^\d+$", last) and len(last) <= 3:
            track.part_from_filename = last


def _parse_file_metadata(filepath: str, track: TrackInfo) -> None:
    if not filepath.lower().endswith(".wav"):
        return

    meta = _read_wav_metadata(filepath)
    if not meta:
        return

    if "ixml_channel" in meta:
        track.channel_name_from_metadata = meta["ixml_channel"]

    if "ixml_track_index" in meta:
        track.track_index = meta["ixml_track_index"]

    if "ixml_timestamp" in meta:
        ts_str = meta["ixml_timestamp"]
        for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y%m%d%H%M%S", "%Y-%m-%d %H:%M:%S"):
            try:
                track.timestamp_from_metadata = datetime.strptime(ts_str, fmt)
                break
            except ValueError:
                continue

    if "bext_date" in meta and "bext_time" in meta:
        date_str = meta["bext_date"]
        time_str = meta["bext_time"]
        try:
            track.timestamp_from_metadata = datetime.strptime(
                f"{date_str} {time_str}", "%Y-%m-%d %H:%M:%S"
            )
        except ValueError:
            pass

    if "channels" in meta:
        track.channels = meta["channels"]
    if "sample_rate" in meta:
        track.sample_rate = meta["sample_rate"]


def load_channel_table(table_path: str) -> dict[int, str]:
    result = {}
    with open(table_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split(None, 1)
            if len(parts) == 2:
                try:
                    idx = int(parts[0])
                    result[idx] = parts[1].strip()
                except ValueError:
                    continue
    return result


def load_part_assignment(assign_path: str) -> dict[str, str]:
    result = {}
    with open(assign_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split(None, 1)
            if len(parts) == 2:
                result[parts[0].strip()] = parts[1].strip()
    return result


def get_part_for_channel(channel_name: str) -> str:
    canonical = _normalize_channel_name(channel_name)
    return PART_TABLE.get(canonical, "Unknown")
