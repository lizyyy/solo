import os
from pathlib import Path
from typing import List, Dict, Tuple, Optional
from datetime import datetime
import csv

from database import (
    init_db, Record, RecordRepository,
    ImportBatchRepository
)

AUDIO_EXTENSIONS = {'.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg'}


class ImportResult:
    def __init__(self):
        self.success_records: List[Record] = []
        self.failed_files: List[Dict[str, str]] = []

    @property
    def success_count(self) -> int:
        return len(self.success_records)

    @property
    def failed_count(self) -> int:
        return len(self.failed_files)


class AudioFileImporter:
    def __init__(self, source_detail: str = "批量导入"):
        self.source_detail = source_detail

    def _is_audio_file(self, file_path: Path) -> bool:
        return file_path.suffix.lower() in AUDIO_EXTENSIONS

    def _validate_audio_file(self, file_path: Path) -> Tuple[bool, Optional[str]]:
        try:
            if not file_path.exists():
                return False, "文件不存在"

            if not file_path.is_file():
                return False, "不是有效文件"

            file_size = file_path.stat().st_size
            if file_size == 0:
                return False, "文件大小为0字节（空文件）"

            min_size = 1024
            if file_size < min_size:
                return False, f"文件过小（{file_size}字节），疑似损坏"

            return True, None

        except Exception as e:
            return False, f"文件校验失败: {str(e)}"

    def _extract_track_name(self, file_path: Path) -> str:
        name = file_path.stem
        name = name.replace('_', ' ').replace('-', ' ')
        name = ' '.join(name.split())
        return name

    def _extract_contract_deadline(self, file_path: Path) -> Optional[str]:
        name = file_path.name.lower()
        import re
        patterns = [
            r'截止(\d{4}\d{2}\d{2})',
            r'deadline[_\-]?(\d{4}\d{2}\d{2})',
            r'_(\d{8})_',
            r'_(\d{8})\.'
        ]
        for pattern in patterns:
            match = re.search(pattern, name)
            if match:
                date_str = match.group(1)
                try:
                    parsed = datetime.strptime(date_str, '%Y%m%d')
                    return parsed.strftime('%Y-%m-%d')
                except ValueError:
                    pass
        return None

    def import_directory(self, directory_path: str, batch_name: str = None) -> ImportResult:
        dir_path = Path(directory_path)
        if not dir_path.exists() or not dir_path.is_dir():
            raise ValueError(f"目录不存在: {directory_path}")

        if not batch_name:
            batch_name = f"批量导入_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        audio_files = []
        for root, _, files in os.walk(dir_path):
            for file in files:
                file_path = Path(root) / file
                if self._is_audio_file(file_path):
                    audio_files.append(file_path)

        total_files = len(audio_files)
        if total_files == 0:
            raise ValueError("目录中没有找到音频文件")

        batch_id = ImportBatchRepository.create(batch_name, total_files)
        result = ImportResult()

        for file_path in audio_files:
            try:
                is_valid, error_msg = self._validate_audio_file(file_path)

                if is_valid:
                    record = Record(
                        file_name=file_path.name,
                        file_path=str(file_path.resolve()),
                        track_name=self._extract_track_name(file_path),
                        source_type="音频文件",
                        source_detail=f"{self.source_detail} - {batch_name}",
                        status="正常",
                        contract_deadline=self._extract_contract_deadline(file_path)
                    )
                    saved_record = RecordRepository.create(record)
                    result.success_records.append(saved_record)
                else:
                    record = Record(
                        file_name=file_path.name,
                        file_path=str(file_path.resolve()),
                        track_name=self._extract_track_name(file_path),
                        source_type="音频文件",
                        source_detail=f"{self.source_detail} - {batch_name}",
                        status="待确认",
                        exception_reason=error_msg,
                        contract_deadline=self._extract_contract_deadline(file_path)
                    )
                    saved_record = RecordRepository.create(record)
                    result.success_records.append(saved_record)
                    result.failed_files.append({
                        'file_name': file_path.name,
                        'file_path': str(file_path.resolve()),
                        'reason': error_msg
                    })

            except Exception as e:
                result.failed_files.append({
                    'file_name': file_path.name,
                    'file_path': str(file_path.resolve()),
                    'reason': f"导入异常: {str(e)}"
                })

        ImportBatchRepository.update_counts(
            batch_id, result.success_count, result.failed_count
        )

        return result


class ExcelImporter:
    def import_from_csv(self, csv_path: str, source_detail: str = "曲目Excel导入") -> ImportResult:
        file_path = Path(csv_path)
        if not file_path.exists():
            raise ValueError(f"文件不存在: {csv_path}")

        result = ImportResult()

        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    file_name = row.get('文件名', row.get('file_name', ''))
                    track_name = row.get('曲目名称', row.get('track_name', file_name))
                    status = row.get('状态', row.get('status', '正常'))
                    notes = row.get('备注', row.get('notes', ''))
                    exception_reason = row.get('异常原因', row.get('exception_reason', ''))
                    contract_deadline = row.get('授权截止', row.get('contract_deadline', ''))

                    if exception_reason and status == '正常':
                        status = '待确认'

                    record = Record(
                        file_name=file_name or f"{track_name}_from_excel",
                        file_path=row.get('文件路径', row.get('file_path', '')),
                        track_name=track_name,
                        source_type="曲目Excel",
                        source_detail=f"{source_detail} - {file_path.name}",
                        status=status,
                        notes=notes,
                        exception_reason=exception_reason,
                        contract_deadline=contract_deadline if contract_deadline else None
                    )
                    saved_record = RecordRepository.create(record)
                    result.success_records.append(saved_record)

                except Exception as e:
                    result.failed_files.append({
                        'file_name': row.get('文件名', '未知'),
                        'file_path': '',
                        'reason': f"导入失败: {str(e)}"
                    })

        return result
