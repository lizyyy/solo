from __future__ import annotations

import os
import struct
import wave
from datetime import datetime
from pathlib import Path


SAMPLE_DIR = Path(__file__).parent / "sample_data"

TRACK_DEFS = [
    ("01_Kick_20250530_200000.wav", "Kick", "Drums", 1, 44100, 1, 10.0),
    ("02_Snare_20250530_200000.wav", "Snare", "Drums", 2, 44100, 1, 10.0),
    ("03_HiHat_20250530_200001.wav", "HiHat", "Drums", 3, 44100, 1, 10.0),
    ("04_OH_L_20250530_200000.wav", "OH_L", "Drums", 4, 44100, 1, 10.0),
    ("05_OH_R_20250530_200000.wav", "OH_R", "Drums", 5, 44100, 1, 10.0),
    ("06_Bass DI_20250530_200003.wav", "Bass_DI", "Bass", 6, 44100, 1, 10.0),
    ("07_Gtr_L_20250530_200000.wav", "Gtr_L", "Guitar", 7, 44100, 1, 10.0),
    ("08_Gtr_R_20250530_200000.wav", "Gtr_R", "Guitar", 8, 44100, 1, 10.0),
    ("09_Keys_L_20250530_200000.wav", "Keys_L", "Keys", 9, 44100, 1, 10.0),
    ("10_Keys_R_20250530_200000.wav", "Keys_R", "Keys", 10, 44100, 1, 10.0),
    ("11_Vox_20250530_200000.wav", "Vox", "Vocals", 11, 44100, 1, 10.0),
    ("12_BGV_L_20250530_200000.wav", "Vox_BG_L", "Vocals", 12, 44100, 1, 10.0),
    ("13_BGV_R_20250530_200000.wav", "Vox_BG_R", "Vocals", 13, 44100, 1, 10.0),
    ("14_Kick_20250530_200000.wav", "Kick", "Drums", 14, 44100, 1, 10.0),
    ("15_20250530_200500.wav", "", "", 15, 44100, 1, 10.0),
    ("16_FX_20250530_201000.wav", "FX", "FX", 16, 44100, 1, 10.0),
]


def _make_bext_chunk(description: str, date_str: str, time_str: str) -> bytes:
    desc_b = description.encode("ascii").ljust(256, b"\x00")[:256]
    orig_b = b"LiveRecorder".ljust(32, b"\x00")[:32]
    orig_ref_b = b"\x00" * 32
    date_b = date_str.encode("ascii").ljust(10, b"\x00")[:10]
    time_b = time_str.encode("ascii").ljust(8, b"\x00")[:8]
    rest = b"\x00" * (602 - 256 - 32 - 32 - 10 - 8)
    data = desc_b + orig_b + orig_ref_b + date_b + time_b + rest
    return b"bext" + struct.pack("<I", len(data)) + data


def _make_ixml_chunk(channel_name: str, track_index: int, timestamp: str) -> bytes:
    ixml = f"""<?xml version="1.0" encoding="utf-8"?>
<IXML>
  <PROJECT>LiveShow</PROJECT>
  <TRACK_INDEX>{track_index}</TRACK_INDEX>
  <CHANNEL>{channel_name}</CHANNEL>
  <TIMESTAMP>{timestamp}</TIMESTAMP>
</IXML>"""
    data = ixml.encode("utf-8")
    padding = (4 - len(data) % 4) % 4
    data += b"\x00" * padding
    return b"iXML" + struct.pack("<I", len(data) - padding) + data


def generate_sample_wav(filepath: str, sample_rate: int, channels: int, duration: float,
                        channel_name: str = "", track_index: int = 0,
                        ts: datetime | None = None) -> None:
    n_frames = int(sample_rate * duration)
    samples = b"\x00\x00" * n_frames * channels

    tmp_path = filepath + ".tmp.wav"
    with wave.open(tmp_path, "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(samples)

    if channel_name and ts:
        bext = _make_bext_chunk(channel_name, ts.strftime("%Y-%m-%d"), ts.strftime("%H:%M:%S"))
        ixml = _make_ixml_chunk(channel_name, track_index, ts.strftime("%Y-%m-%dT%H:%M:%S"))

        with open(tmp_path, "rb") as f:
            data = f.read()

        riff_size = struct.unpack("<I", data[4:8])[0]
        insert_pos = 12
        new_chunks = bext + ixml
        new_data = data[:insert_pos] + new_chunks + data[insert_pos:]
        new_riff_size = struct.unpack("<I", data[4:8])[0] + len(new_chunks)
        new_data = new_data[:4] + struct.pack("<I", new_riff_size) + new_data[8:]

        with open(filepath, "wb") as f:
            f.write(new_data)
        os.remove(tmp_path)
    else:
        os.rename(tmp_path, filepath)


def generate_channel_table(path: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        f.write("# 通道表: 轨道号 通道名\n")
        f.write("1 Kick\n")
        f.write("2 Snare\n")
        f.write("3 HiHat\n")
        f.write("4 OH_L\n")
        f.write("5 OH_R\n")
        f.write("6 Bass_DI\n")
        f.write("7 Gtr_L\n")
        f.write("8 Gtr_R\n")
        f.write("9 Keys_L\n")
        f.write("10 Keys_R\n")
        f.write("11 Vox\n")
        f.write("12 BGV_L\n")
        f.write("13 BGV_R\n")
        f.write("14 Kick_Dup\n")
        f.write("15 Talkback\n")
        f.write("16 FX\n")


def generate_part_assignment(path: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        f.write("# 声部分配: 通道名 声部\n")
        f.write("Kick Drums\n")
        f.write("Snare Drums\n")
        f.write("HiHat Drums\n")
        f.write("OH_L Drums\n")
        f.write("OH_R Drums\n")
        f.write("Bass_DI Bass\n")
        f.write("Gtr_L Guitar\n")
        f.write("Gtr_R Guitar\n")
        f.write("Keys_L Keys\n")
        f.write("Keys_R Keys\n")
        f.write("Vox Vocals\n")
        f.write("Vox_BG_L Vocals\n")
        f.write("Vox_BG_R Vocals\n")
        f.write("FX FX\n")
        f.write("Talkback Utility\n")


def main() -> None:
    SAMPLE_DIR.mkdir(parents=True, exist_ok=True)
    print(f"生成样例数据到: {SAMPLE_DIR}")

    for filename, ch_name, part, idx, sr, ch, dur in TRACK_DEFS:
        filepath = SAMPLE_DIR / filename
        ts_str = filename.split("_")[-1].replace(".wav", "")
        try:
            ts = datetime.strptime(ts_str, "%Y%m%d_%H%M%S")
        except ValueError:
            ts = datetime(2025, 5, 30, 20, 0, 0)

        generate_sample_wav(
            str(filepath), sr, ch, dur,
            channel_name=ch_name,
            track_index=idx,
            ts=ts,
        )
        print(f"  ✓ {filename}")

    ch_table_path = SAMPLE_DIR / "channel_table.txt"
    generate_channel_table(str(ch_table_path))
    print(f"  ✓ channel_table.txt")

    part_path = SAMPLE_DIR / "part_assignment.txt"
    generate_part_assignment(str(part_path))
    print(f"  ✓ part_assignment.txt")

    print("样例数据生成完毕。")


if __name__ == "__main__":
    main()
