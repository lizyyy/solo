import os
import re
import subprocess
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Protocol


@dataclass
class MediaMetadata:
    file_path: str
    file_category: str = "unknown"

    duration_seconds: float | None = None
    start_timecode: str | None = None
    end_timecode: str | None = None
    frame_rate: float | None = None

    shoot_date: str | None = None
    shoot_time: str | None = None
    creation_time: datetime | None = None
    modification_time: datetime | None = None

    camera_model: str | None = None
    camera_serial: str | None = None
    lens_model: str | None = None

    resolution_width: int | None = None
    resolution_height: int | None = None
    codec: str | None = None
    bit_rate: int | None = None
    sample_rate: int | None = None
    channels: int | None = None

    raw_metadata: dict[str, Any] = field(default_factory=dict)
    metadata_source: str = "fallback"

    @property
    def timecode_start_seconds(self) -> float | None:
        if self.start_timecode:
            return timecode_to_seconds(self.start_timecode, self.frame_rate)
        return None

    @property
    def timecode_end_seconds(self) -> float | None:
        if self.end_timecode:
            return timecode_to_seconds(self.end_timecode, self.frame_rate)
        if self.start_timecode and self.duration_seconds:
            return timecode_to_seconds(self.start_timecode, self.frame_rate) + self.duration_seconds
        return None


def timecode_to_seconds(timecode: str, fps: float | None = None) -> float:
    if fps is None:
        fps = 25.0

    match = re.match(r"(\d+):(\d+):(\d+)([:;])(\d+)", timecode.strip())
    if not match:
        return 0.0

    hours = int(match.group(1))
    minutes = int(match.group(2))
    seconds = int(match.group(3))
    separator = match.group(4)
    frames = int(match.group(5))

    if separator == ";":
        is_drop_frame = True
    else:
        is_drop_frame = False

    total_seconds = hours * 3600 + minutes * 60 + seconds

    if is_drop_frame and fps in (29.97, 30.0):
        frame_count = (hours * 3600 + minutes * 60 + seconds) * 30 + frames
        minutes_total = hours * 60 + minutes
        drop_count = (minutes_total // 10) * 18 + (minutes_total % 10) * 2
        actual_frame_count = max(0, frame_count - drop_count)
        return actual_frame_count / 30.0
    else:
        return total_seconds + frames / fps


def seconds_to_timecode(seconds: float, fps: float | None = None, drop_frame: bool = False) -> str:
    if fps is None:
        fps = 25.0

    if drop_frame and fps in (29.97, 30.0):
        fps_int = 30
        total_frames = int(round(seconds * 30.0))

        minutes = total_frames // (30 * 60)
        ten_minutes = minutes // 10
        remainder = minutes % 10

        drop_frames = ten_minutes * 18 + remainder * 2
        total_frames += drop_frames

        hours = total_frames // (30 * 60 * 60)
        remaining = total_frames % (30 * 60 * 60)
        mins = remaining // (30 * 60)
        remaining %= 30 * 60
        secs = remaining // 30
        frames = remaining % 30

        return f"{hours:02d}:{mins:02d}:{secs:02d};{frames:02d}"
    else:
        hours = int(seconds // 3600)
        remaining = seconds % 3600
        minutes = int(remaining // 60)
        seconds_float = remaining % 60
        whole_seconds = int(seconds_float)
        frames = int(round((seconds_float - whole_seconds) * fps))

        return f"{hours:02d}:{minutes:02d}:{whole_seconds:02d}:{frames:02d}"


class MetadataAdapter(Protocol):
    def can_handle(self, path: Path) -> bool: ...

    def extract(self, path: Path) -> MediaMetadata | None: ...


class FallbackAdapter:
    def can_handle(self, path: Path) -> bool:
        return True

    def extract(self, path: Path) -> MediaMetadata:
        stat = path.stat()
        mtime = datetime.fromtimestamp(stat.st_mtime)

        metadata = MediaMetadata(
            file_path=str(path),
            modification_time=mtime,
            raw_metadata={
                "file_size": stat.st_size,
                "mtime": stat.st_mtime,
            },
            metadata_source="fallback",
        )

        date_str = mtime.strftime("%Y-%m-%d")
        time_str = mtime.strftime("%H:%M:%S")
        metadata.shoot_date = date_str
        metadata.shoot_time = time_str
        metadata.creation_time = mtime

        filename = path.stem
        date_patterns = [
            r"(\d{4})[-_](\d{2})[-_](\d{2})",
            r"(\d{4})(\d{2})(\d{2})",
        ]

        for pattern in date_patterns:
            match = re.search(pattern, filename)
            if match:
                try:
                    year = int(match.group(1))
                    month = int(match.group(2))
                    day = int(match.group(3))
                    if 2000 <= year <= 2100 and 1 <= month <= 12 and 1 <= day <= 31:
                        metadata.shoot_date = f"{year:04d}-{month:02d}-{day:02d}"
                        break
                except ValueError:
                    continue

        time_patterns = [
            r"(\d{2})[-_:](\d{2})[-_:](\d{2})",
            r"(\d{2})(\d{2})(\d{2})",
        ]

        for pattern in time_patterns:
            match = re.search(pattern, filename)
            if match:
                try:
                    hour = int(match.group(1))
                    minute = int(match.group(2))
                    second = int(match.group(3))
                    if 0 <= hour <= 23 and 0 <= minute <= 59 and 0 <= second <= 59:
                        metadata.shoot_time = f"{hour:02d}:{minute:02d}:{second:02d}"
                        break
                except ValueError:
                    continue

        return metadata


class FFmpegAdapter:
    def __init__(self) -> None:
        self._available: bool | None = None

    def _check_available(self) -> bool:
        if self._available is not None:
            return self._available

        try:
            result = subprocess.run(
                ["ffprobe", "-version"],
                capture_output=True,
                text=True,
                check=False,
            )
            self._available = result.returncode == 0
        except FileNotFoundError:
            self._available = False

        return self._available

    def can_handle(self, path: Path) -> bool:
        if not self._check_available():
            return False

        video_exts = {".mp4", ".mov", ".mxf", ".avi", ".mkv", ".m4v"}
        audio_exts = {".wav", ".aiff", ".mp3", ".flac", ".m4a", ".bwf"}

        return path.suffix.lower() in video_exts | audio_exts

    def extract(self, path: Path) -> MediaMetadata | None:
        if not self._check_available():
            return None

        try:
            cmd = [
                "ffprobe",
                "-v", "quiet",
                "-print_format", "json",
                "-show_format",
                "-show_streams",
                str(path),
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True,
            )

            import json
            data = json.loads(result.stdout)

            stat = path.stat()
            mtime = datetime.fromtimestamp(stat.st_mtime)

            metadata = MediaMetadata(
                file_path=str(path),
                modification_time=mtime,
                raw_metadata=data,
                metadata_source="ffmpeg",
            )

            format_info = data.get("format", {})
            streams = data.get("strereams", []) or data.get("streams", [])

            duration_str = format_info.get("duration")
            if duration_str:
                try:
                    metadata.duration_seconds = float(duration_str)
                except (ValueError, TypeError):
                    pass

            video_stream = None
            audio_stream = None

            for stream in streams:
                if stream.get("codec_type") == "video" and video_stream is None:
                    video_stream = stream
                elif stream.get("codec_type") == "audio" and audio_stream is None:
                    audio_stream = stream

            if video_stream:
                metadata.codec = video_stream.get("codec_name")
                metadata.resolution_width = video_stream.get("width")
                metadata.resolution_height = video_stream.get("height")

                r_frame_rate = video_stream.get("r_frame_rate")
                if r_frame_rate and "/" in r_frame_rate:
                    try:
                        num, den = map(int, r_frame_rate.split("/"))
                        if den > 0:
                            metadata.frame_rate = num / den
                    except (ValueError, ZeroDivisionError):
                        pass
                elif r_frame_rate:
                    try:
                        metadata.frame_rate = float(r_frame_rate)
                    except ValueError:
                        pass

                timecode = video_stream.get("tags", {}).get("timecode")
                if timecode:
                    metadata.start_timecode = timecode

            if audio_stream:
                metadata.sample_rate = audio_stream.get("sample_rate")
                metadata.channels = audio_stream.get("channels")
                if not metadata.codec:
                    metadata.codec = audio_stream.get("codec_name")

            tags = format_info.get("tags", {}) or {}

            creation_time = tags.get("creation_time")
            if creation_time:
                try:
                    if creation_time.endswith("Z"):
                        creation_time = creation_time[:-1] + "+00:00"
                    from dateutil.parser import parse as dateutil_parse
                    parsed = dateutil_parse(creation_time)
                    metadata.creation_time = parsed
                    metadata.shoot_date = parsed.strftime("%Y-%m-%d")
                    metadata.shoot_time = parsed.strftime("%H:%M:%S")
                except Exception:
                    pass

            for key in ["com.android.manufacturer", "com.android.model", "make", "artist", "encoder"]:
                value = tags.get(key)
                if value:
                    metadata.camera_model = str(value)
                    break

            return metadata

        except Exception:
            return None


class ExifToolAdapter:
    def __init__(self) -> None:
        self._available: bool | None = None

    def _check_available(self) -> bool:
        if self._available is not None:
            return self._available

        try:
            result = subprocess.run(
                ["exiftool", "-ver"],
                capture_output=True,
                text=True,
                check=False,
            )
            self._available = result.returncode == 0
        except FileNotFoundError:
            self._available = False

        return self._available

    def can_handle(self, path: Path) -> bool:
        if not self._check_available():
            return False
        return True

    def extract(self, path: Path) -> MediaMetadata | None:
        if not self._check_available():
            return None

        try:
            cmd = [
                "exiftool",
                "-json",
                "-n",
                str(path),
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True,
            )

            import json
            data_list = json.loads(result.stdout)
            if not data_list:
                return None

            data = data_list[0]

            stat = path.stat()
            mtime = datetime.fromtimestamp(stat.st_mtime)

            metadata = MediaMetadata(
                file_path=str(path),
                modification_time=mtime,
                raw_metadata=data,
                metadata_source="exiftool",
            )

            duration = data.get("Duration")
            if duration is not None:
                try:
                    metadata.duration_seconds = float(duration)
                except (ValueError, TypeError):
                    pass

            timecode = data.get("TimeCode") or data.get("StartTimecode")
            if timecode:
                metadata.start_timecode = str(timecode)

            video_frame_rate = data.get("VideoFrameRate") or data.get("FrameRate")
            if video_frame_rate:
                try:
                    metadata.frame_rate = float(video_frame_rate)
                except (ValueError, TypeError):
                    pass

            image_width = data.get("ImageWidth") or data.get("ExifImageWidth")
            image_height = data.get("ImageHeight") or data.get("ExifImageHeight")
            if image_width:
                metadata.resolution_width = int(image_width)
            if image_height:
                metadata.resolution_height = int(image_height)

            create_date = data.get("CreateDate") or data.get("DateTimeOriginal") or data.get("MediaCreateDate")
            if create_date:
                try:
                    if isinstance(create_date, str):
                        create_date = create_date.replace(":", "-", 2)
                        from dateutil.parser import parse as dateutil_parse
                        parsed = dateutil_parse(create_date)
                        metadata.creation_time = parsed
                        metadata.shoot_date = parsed.strftime("%Y-%m-%d")
                        metadata.shoot_time = parsed.strftime("%H:%M:%S")
                except Exception:
                    pass

            camera_make = data.get("Make") or data.get("Manufacturer")
            camera_model = data.get("Model") or data.get("CameraModelName")
            if camera_make and camera_model:
                metadata.camera_model = f"{camera_make} {camera_model}"
            elif camera_model:
                metadata.camera_model = str(camera_model)

            lens = data.get("Lens") or data.get("LensModel")
            if lens:
                metadata.lens_model = str(lens)

            audio_sample_rate = data.get("SampleRate") or data.get("AudioSampleRate")
            if audio_sample_rate:
                try:
                    metadata.sample_rate = int(audio_sample_rate)
                except (ValueError, TypeError):
                    pass

            channels = data.get("NumChannels") or data.get("Channels")
            if channels:
                try:
                    metadata.channels = int(channels)
                except (ValueError, TypeError):
                    pass

            codec = data.get("CompressorName") or data.get("CodecID") or data.get("VideoCodec")
            if codec:
                metadata.codec = str(codec)

            return metadata

        except Exception:
            return None


class MetadataExtractor:
    def __init__(self) -> None:
        self.adapters: list[MetadataAdapter] = [
            FFmpegAdapter(),
            ExifToolAdapter(),
            FallbackAdapter(),
        ]

    def extract(self, path: Path, file_category: str = "unknown") -> MediaMetadata:
        for adapter in self.adapters:
            if adapter.can_handle(path):
                metadata = adapter.extract(path)
                if metadata:
                    metadata.file_category = file_category
                    return metadata

        fallback = FallbackAdapter()
        metadata = fallback.extract(path)
        metadata.file_category = file_category
        return metadata


def create_extractor() -> MetadataExtractor:
    return MetadataExtractor()
