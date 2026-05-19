import json
import os
from datetime import datetime
from typing import Dict, List, Optional
from pathlib import Path
from hashlib import sha256

from .parser import ProtoFile, ProtoMessage, ProtoField


class Snapshot:
    def __init__(
        self,
        version: str = "1.0",
        created_at: Optional[str] = None,
        proto_files: Optional[Dict[str, Dict]] = None,
        metadata: Optional[Dict] = None,
    ):
        self.version = version
        self.created_at = created_at or datetime.utcnow().isoformat() + "Z"
        self.proto_files = proto_files or {}
        self.metadata = metadata or {}

    def to_dict(self) -> Dict:
        return {
            "version": self.version,
            "created_at": self.created_at,
            "proto_files": dict(sorted(self.proto_files.items())),
            "metadata": dict(sorted(self.metadata.items())),
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "Snapshot":
        return cls(
            version=data.get("version", "1.0"),
            created_at=data.get("created_at"),
            proto_files=data.get("proto_files", {}),
            metadata=data.get("metadata", {}),
        )

    def calculate_hash(self) -> str:
        sorted_data = json.dumps(self.to_dict(), sort_keys=True, ensure_ascii=False)
        return sha256(sorted_data.encode("utf-8")).hexdigest()


class SnapshotManager:
    DEFAULT_SNAPSHOT_DIR = ".proto-snapshots"

    def __init__(self, snapshot_dir: Optional[str] = None):
        self.snapshot_dir = Path(snapshot_dir or self.DEFAULT_SNAPSHOT_DIR)
        self.snapshot_dir.mkdir(parents=True, exist_ok=True)

    def generate_snapshot(
        self,
        proto_files: List[ProtoFile],
        metadata: Optional[Dict] = None,
    ) -> Snapshot:
        proto_files_dict = {}
        for pf in sorted(proto_files, key=lambda x: x.file_path):
            proto_files_dict[pf.file_path] = pf.to_dict()

        return Snapshot(
            proto_files=proto_files_dict,
            metadata=metadata or {},
        )

    def save_snapshot(
        self,
        snapshot: Snapshot,
        name: Optional[str] = None,
    ) -> str:
        if name is None:
            name = f"snapshot_{snapshot.created_at.replace(':', '-')}"
        if not name.endswith(".json"):
            name += ".json"

        file_path = self.snapshot_dir / name
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(snapshot.to_dict(), f, indent=2, ensure_ascii=False, sort_keys=True)

        return str(file_path)

    def load_snapshot(self, name: str) -> Snapshot:
        if not name.endswith(".json"):
            name += ".json"

        file_path = self.snapshot_dir / name
        if not file_path.exists():
            raise FileNotFoundError(f"Snapshot not found: {name}")

        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        return Snapshot.from_dict(data)

    def list_snapshots(self) -> List[str]:
        snapshots = list(self.snapshot_dir.glob("*.json"))
        return sorted([s.name for s in snapshots])

    def get_latest_snapshot(self) -> Optional[Snapshot]:
        snapshots = self.list_snapshots()
        if not snapshots:
            return None
        return self.load_snapshot(snapshots[-1])

    def delete_snapshot(self, name: str) -> bool:
        if not name.endswith(".json"):
            name += ".json"

        file_path = self.snapshot_dir / name
        if file_path.exists():
            file_path.unlink()
            return True
        return False


def collect_all_fields_from_snapshot(
    snapshot: Snapshot,
) -> Dict[str, Dict[int, Dict]]:
    result = {}

    for file_path, proto_file_data in snapshot.proto_files.items():
        proto_file = ProtoFile.from_dict(proto_file_data)
        _collect_message_fields(proto_file.messages, result)

    return result


def _collect_message_fields(
    messages: Dict[str, ProtoMessage],
    result: Dict[str, Dict[int, Dict]],
    prefix: str = "",
):
    for msg_name, msg in sorted(messages.items()):
        full_name = f"{prefix}.{msg_name}" if prefix else msg_name
        full_name = msg.full_name

        field_map = {}
        for field_num, field in sorted(msg.fields.items()):
            field_map[field_num] = {
                "name": field.name,
                "type": field.type,
                "label": field.label,
                "location": field.location.to_dict(),
            }

        if field_map:
            result[full_name] = field_map

        if msg.nested_messages:
            _collect_message_fields(msg.nested_messages, result, full_name)
