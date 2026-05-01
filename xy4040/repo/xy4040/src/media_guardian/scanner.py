import hashlib
import os
import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Iterable

from .config import ConfigManager
from .metadata import MediaMetadata, MetadataExtractor, create_extractor


@dataclass
class FileInfo:
    file_id: str
    source_path: str
    file_name: str
    file_category: str
    file_size: int
    modification_time: datetime
    hash_value: str | None = None
    hash_algorithm: str | None = None

    relative_path: str | None = None
    card_id: str | None = None
    camera_id: str | None = None

    metadata: MediaMetadata | None = None

    sequence_number: int | None = None
    clip_name: str | None = None

    @property
    def shoot_date(self) -> str | None:
        if self.metadata and self.metadata.shoot_date:
            return self.metadata.shoot_date
        return None

    @property
    def duration_seconds(self) -> float | None:
        if self.metadata:
            return self.metadata.duration_seconds
        return None

    @property
    def start_timecode(self) -> str | None:
        if self.metadata:
            return self.metadata.start_timecode
        return None

    def to_dict(self) -> dict[str, Any]:
        data: dict[str, Any] = {
            "file_id": self.file_id,
            "source_path": self.source_path,
            "file_name": self.file_name,
            "file_category": self.file_category,
            "file_size": self.file_size,
            "modification_time": self.modification_time.isoformat() if self.modification_time else None,
            "hash_value": self.hash_value,
            "hash_algorithm": self.hash_algorithm,
            "relative_path": self.relative_path,
            "card_id": self.card_id,
            "camera_id": self.camera_id,
            "sequence_number": self.sequence_number,
            "clip_name": self.clip_name,
        }

        if self.metadata:
            data["metadata"] = {
                "duration_seconds": self.metadata.duration_seconds,
                "start_timecode": self.metadata.start_timecode,
                "end_timecode": self.metadata.end_timecode,
                "frame_rate": self.metadata.frame_rate,
                "shoot_date": self.metadata.shoot_date,
                "shoot_time": self.metadata.shoot_time,
                "creation_time": self.metadata.creation_time.isoformat() if self.metadata.creation_time else None,
                "camera_model": self.metadata.camera_model,
                "resolution_width": self.metadata.resolution_width,
                "resolution_height": self.metadata.resolution_height,
                "codec": self.metadata.codec,
                "sample_rate": self.metadata.sample_rate,
                "channels": self.metadata.channels,
                "metadata_source": self.metadata.metadata_source,
            }

        return data

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "FileInfo":
        mod_time_str = data.get("modification_time")
        modification_time = None
        if mod_time_str:
            try:
                modification_time = datetime.fromisoformat(mod_time_str)
            except ValueError:
                pass

        file_info = cls(
            file_id=data["file_id"],
            source_path=data["source_path"],
            file_name=data["file_name"],
            file_category=data["file_category"],
            file_size=data["file_size"],
            modification_time=modification_time or datetime.now(),
            hash_value=data.get("hash_value"),
            hash_algorithm=data.get("hash_algorithm"),
            relative_path=data.get("relative_path"),
            card_id=data.get("card_id"),
            camera_id=data.get("camera_id"),
            sequence_number=data.get("sequence_number"),
            clip_name=data.get("clip_name"),
        )

        meta_data = data.get("metadata")
        if meta_data:
            file_info.metadata = MediaMetadata(
                file_path=data["source_path"],
                file_category=data["file_category"],
                duration_seconds=meta_data.get("duration_seconds"),
                start_timecode=meta_data.get("start_timecode"),
                end_timecode=meta_data.get("end_timecode"),
                frame_rate=meta_data.get("frame_rate"),
                shoot_date=meta_data.get("shoot_date"),
                shoot_time=meta_data.get("shoot_time"),
                camera_model=meta_data.get("camera_model"),
                resolution_width=meta_data.get("resolution_width"),
                resolution_height=meta_data.get("resolution_height"),
                codec=meta_data.get("codec"),
                sample_rate=meta_data.get("sample_rate"),
                channels=meta_data.get("channels"),
                metadata_source=meta_data.get("metadata_source", "stored"),
            )

        return file_info


@dataclass
class CardScanResult:
    card_id: str
    source_directory: str
    scan_time: datetime
    files: list[FileInfo] = field(default_factory=list)

    @property
    def total_files(self) -> int:
        return len(self.files)

    @property
    def total_size(self) -> int:
        return sum(f.file_size for f in self.files)

    @property
    def video_files(self) -> list[FileInfo]:
        return [f for f in self.files if f.file_category == "video"]

    @property
    def audio_files(self) -> list[FileInfo]:
        return [f for f in self.files if f.file_category == "audio"]

    @property
    def proxy_files(self) -> list[FileInfo]:
        return [f for f in self.files if f.file_category == "proxy"]

    @property
    def sidecar_files(self) -> list[FileInfo]:
        return [f for f in self.files if f.file_category == "sidecar"]

    def to_dict(self) -> dict[str, Any]:
        return {
            "card_id": self.card_id,
            "source_directory": self.source_directory,
            "scan_time": self.scan_time.isoformat(),
            "total_files": self.total_files,
            "total_size": self.total_size,
            "files": [f.to_dict() for f in self.files],
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "CardScanResult":
        scan_time_str = data.get("scan_time")
        scan_time = datetime.now()
        if scan_time_str:
            try:
                scan_time = datetime.fromisoformat(scan_time_str)
            except ValueError:
                pass

        result = cls(
            card_id=data["card_id"],
            source_directory=data["source_directory"],
            scan_time=scan_time,
        )

        files_data = data.get("files", [])
        for fd in files_data:
            result.files.append(FileInfo.from_dict(fd))

        return result


@dataclass
class ScanResult:
    project_name: str
    scan_time: datetime
    cards: list[CardScanResult] = field(default_factory=list)

    @property
    def total_files(self) -> int:
        return sum(c.total_files for c in self.cards)

    @property
    def total_size(self) -> int:
        return sum(c.total_size for c in self.cards)

    @property
    def all_files(self) -> list[FileInfo]:
        files: list[FileInfo] = []
        for card in self.cards:
            files.extend(card.files)
        return files

    def to_dict(self) -> dict[str, Any]:
        return {
            "project_name": self.project_name,
            "scan_time": self.scan_time.isoformat(),
            "total_files": self.total_files,
            "total_size": self.total_size,
            "cards": [c.to_dict() for c in self.cards],
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ScanResult":
        scan_time_str = data.get("scan_time")
        scan_time = datetime.now()
        if scan_time_str:
            try:
                scan_time = datetime.fromisoformat(scan_time_str)
            except ValueError:
                pass

        result = cls(
            project_name=data["project_name"],
            scan_time=scan_time,
        )

        cards_data = data.get("cards", [])
        for cd in cards_data:
            result.cards.append(CardScanResult.from_dict(cd))

        return result


class FileScanner:
    def __init__(
        self,
        config: ConfigManager,
        extract_metadata: bool = True,
        compute_hash: bool = True,
        progress_callback: Callable[[str, int, int], None] | None = None,
    ) -> None:
        self.config = config
        self.extract_metadata = extract_metadata
        self.compute_hash = compute_hash
        self.progress_callback = progress_callback
        self._metadata_extractor: MetadataExtractor | None = None

    @property
    def metadata_extractor(self) -> MetadataExtractor:
        if self._metadata_extractor is None:
            self._metadata_extractor = create_extractor()
        return self._metadata_extractor

    def compute_file_hash(self, path: Path, algorithm: str = "sha256", chunk_size: int = 8192) -> str:
        hash_obj = hashlib.new(algorithm)

        with open(path, "rb") as f:
            while chunk := f.read(chunk_size):
                hash_obj.update(chunk)

        return hash_obj.hexdigest()

    def generate_file_id(self, path: Path, card_id: str) -> str:
        name_hash = hashlib.md5(f"{card_id}:{path.name}".encode()).hexdigest()[:12]
        return f"{card_id}_{name_hash}"

    def extract_sequence_number(self, filename: str) -> int | None:
        patterns = [
            r"[_-](\d{3,8})[_.-]",
            r"(\d{3,8})\.",
            r"[_-](\d+)$",
            r"[_-]Clip(\d+)",
            r"[_-]clip(\d+)",
            r"[_-]C(\d+)",
            r"[_-]c(\d+)",
        ]

        for pattern in patterns:
            match = re.search(pattern, filename)
            if match:
                try:
                    return int(match.group(1))
                except ValueError:
                    continue

        return None

    def extract_clip_name(self, filename: str) -> str | None:
        patterns = [
            r"([A-Za-z]+_\d{4,})",
            r"([A-Z]{2,}\d{4,})",
        ]

        for pattern in patterns:
            match = re.search(pattern, filename)
            if match:
                return match.group(1)

        stem = Path(filename).stem
        if len(stem) > 3:
            return stem

        return None

    def scan_file(
        self,
        path: Path,
        base_path: Path,
        card_id: str,
        camera_id: str | None = None,
    ) -> FileInfo:
        stat = path.stat()
        mtime = datetime.fromtimestamp(stat.st_mtime)

        category = self.config.get_file_category(path)
        file_id = self.generate_file_id(path, card_id)

        relative_path = str(path.relative_to(base_path)) if base_path in path.parents else path.name

        file_info = FileInfo(
            file_id=file_id,
            source_path=str(path),
            file_name=path.name,
            file_category=category,
            file_size=stat.st_size,
            modification_time=mtime,
            relative_path=relative_path,
            card_id=card_id,
            camera_id=camera_id,
            sequence_number=self.extract_sequence_number(path.name),
            clip_name=self.extract_clip_name(path.name),
        )

        if self.compute_hash:
            hash_algo = self.config.config.hash.algorithm
            chunk_size = self.config.config.hash.chunk_size
            file_info.hash_value = self.compute_file_hash(path, hash_algo, chunk_size)
            file_info.hash_algorithm = hash_algo

        if self.extract_metadata:
            file_info.metadata = self.metadata_extractor.extract(path, category)

        return file_info

    def scan_directory(
        self,
        directory: Path,
        card_id: str,
        camera_id: str | None = None,
    ) -> CardScanResult:
        if not directory.exists() or not directory.is_dir():
            raise ValueError(f"目录不存在或不是目录: {directory}")

        result = CardScanResult(
            card_id=card_id,
            source_directory=str(directory),
            scan_time=datetime.now(),
        )

        all_files: list[Path] = []
        for root, dirs, files in os.walk(directory):
            for filename in files:
                filepath = Path(root) / filename
                if not filename.startswith(".") and filepath.is_file():
                    all_files.append(filepath)

        total_files = len(all_files)
        for idx, filepath in enumerate(all_files):
            if self.progress_callback:
                self.progress_callback(filepath.name, idx + 1, total_files)

            file_info = self.scan_file(filepath, directory, card_id, camera_id)
            result.files.append(file_info)

        return result

    def scan_multiple_directories(
        self,
        directories: list[Path],
        card_ids: list[str] | None = None,
        camera_ids: list[str] | None = None,
        project_name: str | None = None,
    ) -> ScanResult:
        if card_ids and len(card_ids) != len(directories):
            raise ValueError("card_ids 数量必须与 directories 数量一致")

        if camera_ids and len(camera_ids) != len(directories):
            raise ValueError("camera_ids 数量必须与 directories 数量一致")

        project = project_name or self.config.config.project_name
        result = ScanResult(
            project_name=project,
            scan_time=datetime.now(),
        )

        for idx, directory in enumerate(directories):
            card_id = card_ids[idx] if card_ids else f"CARD_{idx + 1:03d}"
            camera_id = camera_ids[idx] if camera_ids else None

            card_result = self.scan_directory(directory, card_id, camera_id)
            result.cards.append(card_result)

        return result


def scan_cards(
    config: ConfigManager,
    directories: list[Path],
    card_ids: list[str] | None = None,
    camera_ids: list[str] | None = None,
    extract_metadata: bool = True,
    compute_hash: bool = True,
    progress_callback: Callable[[str, int, int], None] | None = None,
    project_name: str | None = None,
) -> ScanResult:
    scanner = FileScanner(
        config=config,
        extract_metadata=extract_metadata,
        compute_hash=compute_hash,
        progress_callback=progress_callback,
    )

    return scanner.scan_multiple_directories(
        directories=directories,
        card_ids=card_ids,
        camera_ids=camera_ids,
        project_name=project_name,
    )
