import json
import os
import hashlib
from typing import Dict, List, Optional
from datetime import datetime

from models import Room, CalculationResult, HistoryEntry, Material, STANDARD_FREQUENCIES


class StorageManager:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        self.rooms_file = os.path.join(data_dir, "rooms.json")
        self.results_file = os.path.join(data_dir, "results.json")
        self.history_file = os.path.join(data_dir, "history.json")
        self.checksum_file = os.path.join(data_dir, "checksums.json")
        self._ensure_data_dir()

    def _ensure_data_dir(self):
        if not os.path.exists(self.data_dir):
            os.makedirs(self.data_dir)
        for f in [self.rooms_file, self.results_file, self.history_file, self.checksum_file]:
            if not os.path.exists(f):
                self._write_json(f, {})

    def _read_json(self, filepath: str) -> Dict:
        if not os.path.exists(filepath):
            return {}
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)

    def _write_json(self, filepath: str, data: Dict):
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _calculate_checksum(self, data: Dict) -> str:
        data_str = json.dumps(data, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(data_str.encode('utf-8')).hexdigest()

    def _verify_checksums(self) -> Dict[str, bool]:
        stored_checksums = self._read_json(self.checksum_file)
        results = {}

        for name, filepath in [("rooms", self.rooms_file), ("results", self.results_file), ("history", self.history_file)]:
            data = self._read_json(filepath)
            current_checksum = self._calculate_checksum(data)
            stored = stored_checksums.get(name)
            results[name] = stored is None or stored == current_checksum

        return results

    def _update_checksums(self):
        checksums = {}
        for name, filepath in [("rooms", self.rooms_file), ("results", self.results_file), ("history", self.history_file)]:
            data = self._read_json(filepath)
            checksums[name] = self._calculate_checksum(data)
        self._write_json(self.checksum_file, checksums)

    def save_room(self, room: Room) -> bool:
        rooms = self._read_json(self.rooms_file)
        rooms[room.id] = room.to_dict()
        self._write_json(self.rooms_file, rooms)
        self._update_checksums()
        return True

    def get_room(self, room_id: str) -> Optional[Room]:
        rooms = self._read_json(self.rooms_file)
        if room_id in rooms:
            return Room.from_dict(rooms[room_id])
        return None

    def get_room_by_name(self, name: str) -> Optional[Room]:
        rooms = self._read_json(self.rooms_file)
        for room_data in rooms.values():
            if room_data["name"] == name:
                return Room.from_dict(room_data)
        return None

    def get_all_rooms(self) -> List[Room]:
        rooms = self._read_json(self.rooms_file)
        return [Room.from_dict(r) for r in rooms.values()]

    def delete_room(self, room_id: str) -> bool:
        rooms = self._read_json(self.rooms_file)
        if room_id in rooms:
            del rooms[room_id]
            self._write_json(self.rooms_file, rooms)
            self._update_checksums()
            return True
        return False

    def save_result(self, result: CalculationResult) -> bool:
        results = self._read_json(self.results_file)
        results[result.room_id] = result.to_dict()
        self._write_json(self.results_file, results)
        self._update_checksums()
        return True

    def get_result(self, room_id: str) -> Optional[CalculationResult]:
        results = self._read_json(self.results_file)
        if room_id in results:
            return CalculationResult.from_dict(results[room_id])
        return None

    def get_all_results(self) -> List[CalculationResult]:
        results = self._read_json(self.results_file)
        return [CalculationResult.from_dict(r) for r in results.values()]

    def delete_result(self, room_id: str) -> bool:
        results = self._read_json(self.results_file)
        if room_id in results:
            del results[room_id]
            self._write_json(self.results_file, results)
            self._update_checksums()
            return True
        return False

    def add_history_entry(self, entry: HistoryEntry) -> bool:
        history = self._read_json(self.history_file)
        if entry.room_id not in history:
            history[entry.room_id] = []
        history[entry.room_id].append(entry.to_dict())
        self._write_json(self.history_file, history)
        self._update_checksums()
        return True

    def get_room_history(self, room_id: str) -> List[HistoryEntry]:
        history = self._read_json(self.history_file)
        if room_id in history:
            entries = [HistoryEntry.from_dict(e) for e in history[room_id]]
            entries.sort(key=lambda x: x.timestamp)
            return entries
        return []

    def get_all_history(self) -> Dict[str, List[HistoryEntry]]:
        history = self._read_json(self.history_file)
        return {
            rid: [HistoryEntry.from_dict(e) for e in entries]
            for rid, entries in history.items()
        }

    def verify_data_integrity(self) -> Dict:
        checksum_results = self._verify_checksums()
        all_valid = all(checksum_results.values())

        if not all_valid:
            return {
                "checksums_valid": False,
                "checksum_details": checksum_results,
                "total_rooms": 0,
                "total_results": 0,
                "rooms_without_results": [],
                "results_without_rooms": [],
                "error": "数据校验和不匹配，可能已被篡改"
            }

        try:
            rooms = self.get_all_rooms()
            results = self.get_all_results()
        except Exception as e:
            return {
                "checksums_valid": False,
                "checksum_details": checksum_results,
                "total_rooms": 0,
                "total_results": 0,
                "rooms_without_results": [],
                "results_without_rooms": [],
                "error": f"数据解析失败: {str(e)}"
            }

        room_ids = {r.id for r in rooms}
        result_ids = {r.room_id for r in results}

        rooms_without_results = room_ids - result_ids
        results_without_rooms = result_ids - room_ids

        return {
            "checksums_valid": all_valid,
            "checksum_details": checksum_results,
            "total_rooms": len(rooms),
            "total_results": len(results),
            "rooms_without_results": list(rooms_without_results),
            "results_without_rooms": list(results_without_rooms)
        }

    def export_all_data(self) -> Dict:
        history_data = self.get_all_history()
        serializable_history = {
            rid: [entry.to_dict() for entry in entries]
            for rid, entries in history_data.items()
        }
        return {
            "export_timestamp": datetime.now().isoformat(),
            "rooms": {r.id: r.to_dict() for r in self.get_all_rooms()},
            "results": {r.room_id: r.to_dict() for r in self.get_all_results()},
            "history": serializable_history,
            "checksums": self._read_json(self.checksum_file)
        }

    def import_data(self, data: Dict, overwrite: bool = False) -> Dict:
        report = {"rooms_imported": 0, "results_imported": 0, "history_imported": 0, "skipped": []}

        if overwrite:
            self._write_json(self.rooms_file, data.get("rooms", {}))
            self._write_json(self.results_file, data.get("results", {}))
            self._write_json(self.history_file, data.get("history", {}))
            report["rooms_imported"] = len(data.get("rooms", {}))
            report["results_imported"] = len(data.get("results", {}))
            report["history_imported"] = sum(len(v) for v in data.get("history", {}).values())
        else:
            existing_rooms = self._read_json(self.rooms_file)
            existing_results = self._read_json(self.results_file)
            existing_history = self._read_json(self.history_file)

            for rid, room_data in data.get("rooms", {}).items():
                if rid not in existing_rooms:
                    existing_rooms[rid] = room_data
                    report["rooms_imported"] += 1
                else:
                    report["skipped"].append(f"Room {rid} already exists")

            for rid, result_data in data.get("results", {}).items():
                if rid not in existing_results:
                    existing_results[rid] = result_data
                    report["results_imported"] += 1

            for rid, history_entries in data.get("history", {}).items():
                if rid not in existing_history:
                    existing_history[rid] = history_entries
                    report["history_imported"] += len(history_entries)
                else:
                    existing_ids = {e["id"] for e in existing_history[rid]}
                    for entry in history_entries:
                        if entry["id"] not in existing_ids:
                            existing_history[rid].append(entry)
                            report["history_imported"] += 1

            self._write_json(self.rooms_file, existing_rooms)
            self._write_json(self.results_file, existing_results)
            self._write_json(self.history_file, existing_history)

        self._update_checksums()
        return report
