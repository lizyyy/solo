import json
import os
import shutil
from typing import List, Dict, Any, Optional
from datetime import datetime
from pathlib import Path

from .core import FractalRecord, FractalStatus


class StorageError(Exception):
    pass


class RecordStorage:
    MAX_BACKUP_AGE_DAYS = 7

    def __init__(self, storage_dir: str = None):
        if storage_dir is None:
            storage_dir = os.path.join(os.path.expanduser("~"), ".fractal_generator")

        self.storage_dir = Path(storage_dir)
        try:
            self.storage_dir.mkdir(parents=True, exist_ok=True)
        except OSError as e:
            raise StorageError(f"无法创建存储目录 {self.storage_dir}: {e}")

        if not os.access(self.storage_dir, os.W_OK):
            raise StorageError(f"存储目录不可写: {self.storage_dir}")

        self.records_file = self.storage_dir / "records.json"
        self.overrides_file = self.storage_dir / "overrides.json"
        self._ensure_files()

    def _ensure_files(self):
        for filepath in [self.records_file, self.overrides_file]:
            if not filepath.exists():
                try:
                    default = [] if filepath == self.records_file else {}
                    with open(filepath, 'w', encoding='utf-8') as f:
                        json.dump(default, f, ensure_ascii=False, indent=2)
                except OSError as e:
                    raise StorageError(f"无法创建存储文件 {filepath}: {e}")
            else:
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        json.load(f)
                except (json.JSONDecodeError, UnicodeDecodeError):
                    self._backup_and_reset(filepath)

    def _backup_and_reset(self, filepath: Path):
        backup_path = filepath.with_suffix(f".corrupted.{datetime.now().strftime('%Y%m%d%H%M%S')}")
        try:
            shutil.copy2(filepath, backup_path)
        except OSError:
            pass

        default = [] if filepath == self.records_file else {}
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(default, f, ensure_ascii=False, indent=2)
        except OSError as e:
            raise StorageError(f"无法重置损坏文件 {filepath}: {e}")

    def save_record(self, record: FractalRecord) -> str:
        records = self._load_all_records()

        existing_idx = None
        for i, r in enumerate(records):
            if r.get('record_id') == record.record_id:
                existing_idx = i
                break

        record_dict = record.to_dict()
        if existing_idx is not None:
            existing = records[existing_idx]
            if existing.get('manual_override') and not record.manual_override:
                record_dict['manual_override'] = True
                record_dict['override_reason'] = existing.get('override_reason')
                record_dict['override_by'] = existing.get('override_by')
                record_dict['override_at'] = existing.get('override_at')
            records[existing_idx] = record_dict
        else:
            records.append(record_dict)

        self._write_json(self.records_file, records)
        return record.record_id

    def get_record(self, record_id: str) -> Optional[FractalRecord]:
        records = self._load_all_records()
        for r in records:
            if r.get('record_id') == record_id:
                try:
                    return FractalRecord.from_dict(r)
                except Exception:
                    return None
        return None

    def get_all_records(self, status_filter: str = None) -> List[FractalRecord]:
        raw_records = self._load_all_records()
        result = []
        for r in raw_records:
            try:
                record = FractalRecord.from_dict(r)
                if status_filter is None or record.status.value == status_filter:
                    result.append(record)
            except Exception:
                continue
        return result

    def _load_all_records(self) -> List[Dict[str, Any]]:
        try:
            with open(self.records_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if not isinstance(data, list):
                return []
            return data
        except (json.JSONDecodeError, FileNotFoundError, UnicodeDecodeError):
            return []

    def save_override(self, case_key: str, override: Dict[str, Any]) -> None:
        overrides = self._load_overrides()
        overrides[case_key] = override
        self._write_json(self.overrides_file, overrides, default=str)

    def get_override(self, case_key: str) -> Optional[Dict[str, Any]]:
        overrides = self._load_overrides()
        result = overrides.get(case_key)
        if result is not None and not isinstance(result, dict):
            return None
        return result

    def _load_overrides(self) -> Dict[str, Any]:
        try:
            with open(self.overrides_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if not isinstance(data, dict):
                return {}
            return data
        except (json.JSONDecodeError, FileNotFoundError, UnicodeDecodeError):
            return {}

    def get_summary(self) -> Dict[str, Any]:
        records = self.get_all_records()
        by_status: Dict[str, int] = {}
        by_source: Dict[str, int] = {}

        for record in records:
            status = record.status.value
            by_status[status] = by_status.get(status, 0) + 1

            source = record.source
            by_source[source] = by_source.get(source, 0) + 1

        total_exceptions = sum(
            1 for r in records
            if len(r.validation_issues) > 0 or r.status != FractalStatus.SUCCESS
        )

        return {
            'total_records': len(records),
            'by_status': by_status,
            'by_source': by_source,
            'total_exceptions': total_exceptions,
            'manual_overrides': sum(1 for r in records if r.manual_override)
        }

    def export_records(self, filepath: str, status_filter: str = None) -> str:
        records = self.get_all_records(status_filter)
        export_data = {
            'exported_at': datetime.now().isoformat(),
            'filter': status_filter,
            'record_count': len(records),
            'records': [r.to_dict() for r in records]
        }

        target = Path(filepath)
        try:
            target.parent.mkdir(parents=True, exist_ok=True)
        except OSError:
            pass

        try:
            with open(target, 'w', encoding='utf-8') as f:
                json.dump(export_data, f, ensure_ascii=False, indent=2)
        except OSError as e:
            raise StorageError(f"导出文件写入失败 {filepath}: {e}")

        return filepath

    def clear_all(self) -> None:
        self._write_json(self.records_file, [])

    def _write_json(self, filepath: Path, data, default=None):
        tmp_path = filepath.with_suffix('.tmp')
        try:
            with open(tmp_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2, default=default)
            shutil.move(str(tmp_path), str(filepath))
        except OSError as e:
            if tmp_path.exists():
                try:
                    tmp_path.unlink()
                except OSError:
                    pass
            raise StorageError(f"写入存储文件失败 {filepath}: {e}")
