import csv
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional


@dataclass
class ImageEntry:
    image_id: str
    file_path: str
    width: int
    height: int
    file_hash: Optional[str] = None


def parse_images_manifest(csv_path: str) -> Dict[str, ImageEntry]:
    entries = {}
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            entries[row["image_id"]] = ImageEntry(
                image_id=row["image_id"],
                file_path=row["file_path"],
                width=int(row["width"]),
                height=int(row["height"])
            )
    return entries


def validate_manifest_exists(manifest_path: str) -> bool:
    return Path(manifest_path).exists()