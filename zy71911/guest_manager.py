import os
import json
from typing import List, Dict, Optional, Tuple
from datetime import datetime
from models import Guest, GuestDiff
from utils import Config, save_json, load_json


class GuestListManager:
    def __init__(self):
        Config.ensure_dirs()
        self.guest_dir = Config.GUEST_LISTS_DIR

    def _get_guest_list_path(self, episode_id: str, version: int) -> str:
        return os.path.join(self.guest_dir, f"{episode_id}_guests_v{version:03d}.json")

    def _get_index_path(self, episode_id: str) -> str:
        return os.path.join(self.guest_dir, f"{episode_id}_index.json")

    def get_next_version(self, episode_id: str) -> int:
        index_path = self._get_index_path(episode_id)
        index = load_json(index_path)
        if not index or "versions" not in index:
            return 1
        return len(index["versions"]) + 1

    def parse_guest_list(self, content: str) -> List[Guest]:
        guests = []
        lines = content.strip().split("\n")

        for line in lines:
            line = line.strip()
            if not line or line.startswith("#"):
                continue

            parts = [p.strip() for p in line.split(",")]
            if len(parts) >= 1:
                name = parts[0]
                role = parts[1] if len(parts) >= 2 else None
                notes = parts[2] if len(parts) >= 3 else None
                guests.append(Guest(name=name, role=role, segment_notes=notes))

        return guests

    def save_guest_list(
        self, episode_id: str, guests: List[Guest], note: str = None
    ) -> Tuple[int, List[GuestDiff]]:
        version = self.get_next_version(episode_id)
        guest_path = self._get_guest_list_path(episode_id, version)

        guest_data = {
            "episode_id": episode_id,
            "version": version,
            "saved_at": datetime.now().isoformat(),
            "note": note,
            "guests": [
                {"name": g.name, "role": g.role, "segment_notes": g.segment_notes}
                for g in guests
            ],
        }
        save_json(guest_data, guest_path)

        self._update_index(episode_id, version, note)

        diffs = []
        if version > 1:
            old_guests = self.load_guest_list(episode_id, version - 1)
            diffs = self.compare_guest_lists(old_guests, guests)

        return version, diffs

    def _update_index(self, episode_id: str, version: int, note: str = None):
        index_path = self._get_index_path(episode_id)
        index = load_json(index_path) or {"episode_id": episode_id, "versions": []}

        index["versions"].append(
            {
                "version": version,
                "saved_at": datetime.now().isoformat(),
                "note": note,
                "path": self._get_guest_list_path(episode_id, version),
            }
        )
        save_json(index, index_path)

    def load_guest_list(self, episode_id: str, version: int) -> List[Guest]:
        guest_path = self._get_guest_list_path(episode_id, version)
        data = load_json(guest_path)
        if not data:
            return []

        return [
            Guest(
                name=g["name"],
                role=g.get("role"),
                segment_notes=g.get("segment_notes"),
            )
            for g in data["guests"]
        ]

    def get_latest_version(self, episode_id: str) -> Optional[int]:
        index_path = self._get_index_path(episode_id)
        index = load_json(index_path)
        if not index or not index.get("versions"):
            return None
        return index["versions"][-1]["version"]

    def compare_guest_lists(
        self, old_guests: List[Guest], new_guests: List[Guest]
    ) -> List[GuestDiff]:
        diffs = []

        old_names = {g.name: g for g in old_guests}
        new_names = {g.name: g for g in new_guests}

        for name in new_names:
            if name not in old_names:
                diffs.append(GuestDiff(guest_name=name, change_type="新增嘉宾"))

        for name in old_names:
            if name not in new_names:
                diffs.append(GuestDiff(guest_name=name, change_type="删除嘉宾"))

        for name, new_guest in new_names.items():
            if name in old_names:
                old_guest = old_names[name]

                if old_guest.role != new_guest.role:
                    diffs.append(
                        GuestDiff(
                            guest_name=name,
                            change_type="角色变更",
                            old_value=old_guest.role,
                            new_value=new_guest.role,
                        )
                    )

                if old_guest.segment_notes != new_guest.segment_notes:
                    diffs.append(
                        GuestDiff(
                            guest_name=name,
                            change_type="备注变更",
                            old_value=old_guest.segment_notes,
                            new_value=new_guest.segment_notes,
                        )
                    )

        return diffs

    def format_diff_message(self, diffs: List[GuestDiff]) -> str:
        if not diffs:
            return "嘉宾名单无变更。"

        messages = ["⚠️ 嘉宾名单变更提醒："]

        for diff in diffs:
            if diff.change_type == "新增嘉宾":
                messages.append(f"  • 新增嘉宾：{diff.guest_name}")
            elif diff.change_type == "删除嘉宾":
                messages.append(f"  • 删除嘉宾：{diff.guest_name}")
            elif diff.change_type == "角色变更":
                messages.append(
                    f"  • {diff.guest_name} 角色变更："
                    f"{diff.old_value or '无'} → {diff.new_value or '无'}"
                )
            elif diff.change_type == "备注变更":
                messages.append(
                    f"  • {diff.guest_name} 备注变更："
                    f"{diff.old_value or '无'} → {diff.new_value or '无'}"
                )

        return "\n".join(messages)

    def get_version_history(self, episode_id: str) -> List[dict]:
        index_path = self._get_index_path(episode_id)
        index = load_json(index_path)
        if not index:
            return []
        return index.get("versions", [])
