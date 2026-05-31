from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Optional

from .models import DirectorySnapshot, FileSnapshot


class SnapshotManager:
    def __init__(self, store_dir: str):
        self.store_dir = os.path.join(store_dir, "snapshots")
        os.makedirs(self.store_dir, exist_ok=True)

    def take_snapshot(
        self,
        base_path: str,
        file_patterns: Optional[list[str]] = None,
        label: str = "",
    ) -> DirectorySnapshot:
        if file_patterns is None:
            file_patterns = [
                "package.json",
                "requirements.txt",
                "pom.xml",
                "go.mod",
                "go.sum",
                "*.lock",
                "*.toml",
                "*.yaml",
                "*.yml",
            ]

        file_snapshots: list[FileSnapshot] = []
        base = Path(base_path)

        for pattern in file_patterns:
            for file_path in base.glob(pattern):
                if file_path.is_file():
                    try:
                        content = file_path.read_text(encoding="utf-8", errors="replace")
                    except Exception:
                        continue
                    content_hash = hashlib.sha256(content.encode()).hexdigest()[:16]
                    rel_path = str(file_path.relative_to(base))
                    file_snapshots.append(
                        FileSnapshot(
                            path=rel_path,
                            content_hash=content_hash,
                            content=content,
                        )
                    )

            nested_pattern = f"**/{pattern}"
            for file_path in base.glob(nested_pattern):
                if file_path.is_file():
                    try:
                        content = file_path.read_text(encoding="utf-8", errors="replace")
                    except Exception:
                        continue
                    content_hash = hashlib.sha256(content.encode()).hexdigest()[:16]
                    try:
                        rel_path = str(file_path.relative_to(base))
                    except ValueError:
                        continue
                    if any(fs.path == rel_path for fs in file_snapshots):
                        continue
                    file_snapshots.append(
                        FileSnapshot(
                            path=rel_path,
                            content_hash=content_hash,
                            content=content,
                        )
                    )

        snapshot = DirectorySnapshot(
            base_path=base_path,
            files=file_snapshots,
            label=label,
        )
        self._save_snapshot(snapshot)
        return snapshot

    def get_snapshot(self, snapshot_id: str) -> Optional[DirectorySnapshot]:
        path = os.path.join(self.store_dir, f"{snapshot_id}.json")
        if not os.path.isfile(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return DirectorySnapshot.from_dict(data)

    def list_snapshots(self) -> list[DirectorySnapshot]:
        snapshots = []
        if not os.path.isdir(self.store_dir):
            return snapshots
        for fname in os.listdir(self.store_dir):
            if fname.endswith(".json"):
                path = os.path.join(self.store_dir, fname)
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                snapshots.append(DirectorySnapshot.from_dict(data))
        return sorted(snapshots, key=lambda s: s.timestamp)

    def compare_snapshots(
        self, snapshot_id_a: str, snapshot_id_b: str
    ) -> dict[str, dict]:
        snap_a = self.get_snapshot(snapshot_id_a)
        snap_b = self.get_snapshot(snapshot_id_b)
        if not snap_a or not snap_b:
            return {"error": "One or both snapshots not found"}

        files_a = {f.path: f for f in snap_a.files}
        files_b = {f.path: f for f in snap_b.files}

        result: dict[str, dict] = {
            "added": {},
            "removed": {},
            "modified": {},
            "unchanged": {},
        }

        for path, file_b in files_b.items():
            if path not in files_a:
                result["added"][path] = {"hash": file_b.content_hash}
            elif files_a[path].content_hash != file_b.content_hash:
                result["modified"][path] = {
                    "before_hash": files_a[path].content_hash,
                    "after_hash": file_b.content_hash,
                }
            else:
                result["unchanged"][path] = {"hash": file_b.content_hash}

        for path, file_a in files_a.items():
            if path not in files_b:
                result["removed"][path] = {"hash": file_a.content_hash}

        return result

    def _save_snapshot(self, snapshot: DirectorySnapshot) -> None:
        path = os.path.join(self.store_dir, f"{snapshot.snapshot_id}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(snapshot.to_dict(), f, ensure_ascii=False, indent=2)
