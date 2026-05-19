import csv
import uuid
import chardet
from datetime import datetime
from pathlib import Path
from typing import List, Tuple, Optional, Dict, Any

from app.models import (
    InspectionRecord,
    CallMetadata,
    TranscriptionSegment,
    SensitiveWord,
    BadRecord,
    ImportResult,
)
from app.utils import get_storage, generate_content_hash
from app.services.scanner import get_scanner


class FileImporter:
    def __init__(self):
        self._storage = get_storage()
        self._scanner = get_scanner()
    
    def _detect_encoding(self, file_path: str) -> str:
        with open(file_path, 'rb') as f:
            result = chardet.detect(f.read(10000))
        return result.get('encoding', 'utf-8')
    
    def _read_file(self, file_path: str) -> str:
        encoding = self._detect_encoding(file_path)
        try:
            with open(file_path, 'r', encoding=encoding) as f:
                return f.read()
        except UnicodeDecodeError:
            with open(file_path, 'r', encoding='gbk') as f:
                return f.read()
        except Exception:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read()
    
    def _parse_transcription_txt(self, content: str, file_name: str) -> Tuple[List[TranscriptionSegment], List[BadRecord]]:
        segments = []
        bad_records = []
        lines = content.split('\n')
        
        for line_num, line in enumerate(lines, 1):
            line = line.strip()
            if not line:
                continue
            
            try:
                if '\t' in line:
                    parts = line.split('\t')
                elif '|' in line:
                    parts = line.split('|')
                else:
                    parts = line.split(',', 2)
                
                if len(parts) >= 3:
                    speaker = parts[0].strip()
                    try:
                        start_time = float(parts[1].strip())
                        end_time = float(parts[2].strip()) if len(parts) > 3 else start_time + 5.0
                        text = parts[3].strip() if len(parts) > 3 else ' '.join(parts[2:]).strip()
                    except ValueError:
                        if len(parts) >= 2:
                            speaker = parts[0].strip()
                            text = ' '.join(parts[1:]).strip()
                            start_time = line_num * 5.0
                            end_time = start_time + 5.0
                        else:
                            raise ValueError(f"无法解析行格式: {line}")
                elif len(parts) == 2:
                    speaker = parts[0].strip()
                    text = parts[1].strip()
                    start_time = line_num * 5.0
                    end_time = start_time + 5.0
                else:
                    bad_records.append(BadRecord(
                        id=str(uuid.uuid4()),
                        source_file=file_name,
                        original_position=f"line_{line_num}",
                        error_type="format_error",
                        error_message=f"列数不足，需要至少2列，实际{len(parts)}列",
                        raw_content=line,
                        suggested_fix="请使用制表符、|或逗号分隔，格式为：说话人|开始时间|结束时间|文本",
                    ))
                    continue
                
                segments.append(TranscriptionSegment(
                    speaker=speaker,
                    start_time=start_time,
                    end_time=end_time,
                    text=text,
                ))
            except Exception as e:
                bad_records.append(BadRecord(
                    id=str(uuid.uuid4()),
                    source_file=file_name,
                    original_position=f"line_{line_num}",
                    error_type="parse_error",
                    error_message=str(e),
                    raw_content=line,
                    suggested_fix="检查时间格式是否正确（应为数字）",
                ))
        
        return segments, bad_records
    
    def _parse_metadata_csv(self, content: str, file_name: str) -> Tuple[List[CallMetadata], List[BadRecord]]:
        metadata_list = []
        bad_records = []
        lines = content.split('\n')
        
        if not lines:
            return metadata_list, bad_records
        
        reader = csv.DictReader(lines)
        
        for row_num, row in enumerate(reader, 2):
            try:
                required_fields = ['call_id', 'agent_id', 'agent_name', 'customer_phone', 'customer_name']
                missing_fields = [f for f in required_fields if f not in row or not row[f]]
                
                if missing_fields:
                    bad_records.append(BadRecord(
                        id=str(uuid.uuid4()),
                        source_file=file_name,
                        original_position=f"row_{row_num}",
                        error_type="missing_fields",
                        error_message=f"缺少必填字段: {', '.join(missing_fields)}",
                        raw_content=str(row),
                        suggested_fix=f"请确保包含以下字段: {', '.join(required_fields)}",
                    ))
                    continue
                
                call_start_time_str = row.get('call_start_time', datetime.now().isoformat())
                try:
                    if ' ' in call_start_time_str:
                        call_start_time = datetime.strptime(call_start_time_str, '%Y-%m-%d %H:%M:%S')
                    else:
                        call_start_time = datetime.fromisoformat(call_start_time_str)
                except ValueError:
                    call_start_time = datetime.now()
                
                try:
                    call_duration = int(row.get('call_duration', '0'))
                except ValueError:
                    call_duration = 0
                
                satisfaction_score = row.get('satisfaction_score')
                if satisfaction_score:
                    try:
                        satisfaction_score = int(satisfaction_score)
                    except ValueError:
                        satisfaction_score = None
                
                metadata_list.append(CallMetadata(
                    call_id=row['call_id'],
                    agent_id=row['agent_id'],
                    agent_name=row['agent_name'],
                    customer_phone=row['customer_phone'],
                    customer_name=row['customer_name'],
                    call_start_time=call_start_time,
                    call_duration=call_duration,
                    call_type=row.get('call_type', 'general'),
                    satisfaction_score=satisfaction_score,
                ))
            except Exception as e:
                bad_records.append(BadRecord(
                    id=str(uuid.uuid4()),
                    source_file=file_name,
                    original_position=f"row_{row_num}",
                    error_type="parse_error",
                    error_message=str(e),
                    raw_content=str(row),
                    suggested_fix="检查字段格式是否正确",
                ))
        
        return metadata_list, bad_records
    
    def _parse_sensitive_words(self, content: str, file_name: str) -> Tuple[List[SensitiveWord], List[BadRecord]]:
        words = []
        bad_records = []
        lines = content.split('\n')
        
        for line_num, line in enumerate(lines, 1):
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            
            try:
                parts = line.split('\t') if '\t' in line else line.split(',')
                word_text = parts[0].strip()
                
                if not word_text:
                    continue
                
                category = parts[1].strip() if len(parts) > 1 else 'general'
                severity = int(parts[2]) if len(parts) > 2 and parts[2].strip().isdigit() else 3
                
                words.append(SensitiveWord(
                    id=str(uuid.uuid4()),
                    word=word_text,
                    category=category,
                    severity=severity,
                    enabled=True,
                ))
            except Exception as e:
                bad_records.append(BadRecord(
                    id=str(uuid.uuid4()),
                    source_file=file_name,
                    original_position=f"line_{line_num}",
                    error_type="parse_error",
                    error_message=str(e),
                    raw_content=line,
                    suggested_fix="格式：敏感词\t类别\t严重程度(1-5)",
                ))
        
        return words, bad_records
    
    def import_transcription_file(self, file_path: str, metadata: CallMetadata = None) -> ImportResult:
        content = self._read_file(file_path)
        file_name = Path(file_path).name
        
        segments, bad_records = self._parse_transcription_txt(content, file_name)
        
        if not segments and not bad_records:
            return ImportResult(
                success=False,
                message="文件内容为空",
                total_imported=0,
                skipped_duplicates=0,
                bad_records=0,
            )
        
        for br in bad_records:
            self._storage.add_bad_record(br)
        
        if not segments:
            return ImportResult(
                success=False,
                message=f"没有有效的转写记录，发现{len(bad_records)}条坏记录",
                total_imported=0,
                skipped_duplicates=0,
                bad_records=len(bad_records),
            )
        
        if metadata is None:
            call_id = f"call_{uuid.uuid4().hex[:8]}"
            metadata = CallMetadata(
                call_id=call_id,
                agent_id="unknown",
                agent_name="未知",
                customer_phone="13800000000",
                customer_name="未知客户",
                call_start_time=datetime.now(),
                call_duration=int(sum(s.end_time - s.start_time for s in segments)),
                call_type="general",
            )
        
        content_hash = generate_content_hash({
            "call_id": metadata.call_id,
            "segments": [s.dict() for s in segments],
        })
        
        existing_id = self._storage.check_duplicate(content_hash)
        if existing_id:
            return ImportResult(
                success=True,
                message=f"记录已存在（ID: {existing_id}），跳过导入",
                total_imported=0,
                skipped_duplicates=1,
                bad_records=len(bad_records),
                record_ids=[],
            )
        
        record = InspectionRecord(
            id=str(uuid.uuid4()),
            call_id=metadata.call_id,
            metadata=metadata,
            transcription=segments,
            issues=[],
            bad_records=bad_records,
            imported_hash=content_hash,
        )
        
        record = self._scanner.scan_record(record)
        self._storage.add_record(record)
        
        return ImportResult(
            success=True,
            message=f"成功导入并扫描，发现{len(record.issues)}个问题，{len(bad_records)}条坏记录",
            total_imported=1,
            skipped_duplicates=0,
            bad_records=len(bad_records),
            record_ids=[record.id],
        )
    
    def import_metadata_file(self, file_path: str, transcription_dir: str = None) -> ImportResult:
        content = self._read_file(file_path)
        file_name = Path(file_path).name
        
        metadata_list, bad_records = self._parse_metadata_csv(content, file_name)
        
        for br in bad_records:
            self._storage.add_bad_record(br)
        
        imported_count = 0
        skipped_count = 0
        record_ids = []
        
        for metadata in metadata_list:
            transcription_file = None
            if transcription_dir:
                transcription_dir_path = Path(transcription_dir)
                possible_files = [
                    transcription_dir_path / f"{metadata.call_id}.txt",
                    transcription_dir_path / f"{metadata.call_id}.csv",
                ]
                for pf in possible_files:
                    if pf.exists():
                        transcription_file = pf
                        break
            
            if transcription_file:
                result = self.import_transcription_file(str(transcription_file), metadata)
                if result.total_imported > 0:
                    imported_count += 1
                    record_ids.extend(result.record_ids)
                elif result.skipped_duplicates > 0:
                    skipped_count += 1
            else:
                content_hash = generate_content_hash(metadata.dict())
                existing_id = self._storage.check_duplicate(content_hash)
                if existing_id:
                    skipped_count += 1
                    continue
                
                dummy_segments = [TranscriptionSegment(
                    speaker="系统",
                    start_time=0.0,
                    end_time=0.0,
                    text="无转写文本",
                )]
                
                record = InspectionRecord(
                    id=str(uuid.uuid4()),
                    call_id=metadata.call_id,
                    metadata=metadata,
                    transcription=dummy_segments,
                    issues=[],
                    bad_records=[],
                    imported_hash=content_hash,
                )
                
                self._storage.add_record(record)
                imported_count += 1
                record_ids.append(record.id)
        
        return ImportResult(
            success=True,
            message=f"元数据导入完成: 成功{imported_count}条, 跳过{skipped_count}条, 坏记录{len(bad_records)}条",
            total_imported=imported_count,
            skipped_duplicates=skipped_count,
            bad_records=len(bad_records),
            record_ids=record_ids,
        )
    
    def import_sensitive_words_file(self, file_path: str) -> ImportResult:
        content = self._read_file(file_path)
        file_name = Path(file_path).name
        
        words, bad_records = self._parse_sensitive_words(content, file_name)
        
        for br in bad_records:
            self._storage.add_bad_record(br)
        
        imported_count = 0
        skipped_count = 0
        
        for word in words:
            content_hash = generate_content_hash({"word": word.word})
            existing_words = self._storage.get_all_sensitive_words()
            is_duplicate = any(w.word == word.word for w in existing_words)
            
            if is_duplicate:
                skipped_count += 1
                continue
            
            self._storage.add_sensitive_word(word)
            imported_count += 1
        
        return ImportResult(
            success=True,
            message=f"敏感词导入完成: 成功{imported_count}条, 跳过{skipped_count}条, 坏记录{len(bad_records)}条",
            total_imported=imported_count,
            skipped_duplicates=skipped_count,
            bad_records=len(bad_records),
            record_ids=[],
        )


_importer_instance = None


def get_importer() -> FileImporter:
    global _importer_instance
    if _importer_instance is None:
        _importer_instance = FileImporter()
    return _importer_instance
