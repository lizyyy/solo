import os
import shutil
from datetime import datetime, date
from pathlib import Path
from typing import Dict, List, Any, Optional
import json

from .config import Config
from .database import db_session
from .models import (
    Pet, MedicationRecord, Note, CameraImage, AbnormalCall, 
    ProcessedFile, FileStatus
)
from .file_parser import (
    FileParser, ParseResult, ParsedMedication, ParsedNote,
    ParsedCameraImage, ParsedAbnormalCall
)


class Archiver:
    def __init__(self, config: Config = None):
        self.config = config or Config()
        self.parser = FileParser()
        self.incoming_dir = self.config.incoming_dir
        self.archive_dir = self.config.archive_dir
        
        self._ensure_directories()

    def _ensure_directories(self):
        self.incoming_dir.mkdir(parents=True, exist_ok=True)
        self.archive_dir.mkdir(parents=True, exist_ok=True)

    def _get_or_create_pet(self, session, pet_name: str) -> Pet:
        pet = session.query(Pet).filter(Pet.name == pet_name).first()
        if not pet:
            pet = Pet(
                name=pet_name,
                check_in_date=date.today()
            )
            session.add(pet)
            session.flush()
        return pet

    def _archive_file(self, source_path: Path, pet_name: str, file_type: str) -> str:
        today = date.today()
        pet_archive_dir = self.archive_dir / pet_name / today.strftime('%Y-%m-%d')
        pet_archive_dir.mkdir(parents=True, exist_ok=True)
        
        timestamp = datetime.now().strftime('%H%M%S')
        ext = source_path.suffix
        new_filename = f"{timestamp}_{file_type}{ext}"
        
        dest_path = pet_archive_dir / new_filename
        shutil.copy2(source_path, dest_path)
        
        return str(dest_path)

    def _save_medication_record(self, session, parsed: ParsedMedication, 
                                  source_file: str, archive_path: str) -> MedicationRecord:
        pet = self._get_or_create_pet(session, parsed.pet_name)
        
        record = MedicationRecord(
            pet_id=pet.id,
            medication_name=parsed.medication_name,
            dosage=parsed.dosage,
            scheduled_time=parsed.scheduled_time,
            administered_time=parsed.administered_time,
            administered_by=parsed.administered_by,
            is_administered=parsed.is_administered,
            notes=parsed.notes,
            source_file=source_file
        )
        session.add(record)
        return record

    def _save_note(self, session, parsed: ParsedNote, 
                   source_file: str, archive_path: str) -> Note:
        pet = self._get_or_create_pet(session, parsed.pet_name)
        
        note = Note(
            pet_id=pet.id,
            note_type=parsed.note_type,
            content=parsed.content,
            created_by=parsed.created_by,
            created_at=parsed.created_at,
            is_confirmed=parsed.is_confirmed,
            source_file=source_file
        )
        session.add(note)
        return note

    def _save_camera_image(self, session, parsed: ParsedCameraImage, 
                            source_file: str, archive_path: str) -> CameraImage:
        pet = self._get_or_create_pet(session, parsed.pet_name)
        
        has_other_pets = len(parsed.detected_pets) > 1
        
        image = CameraImage(
            pet_id=pet.id,
            file_name=parsed.file_name,
            original_path=parsed.file_path,
            archive_path=archive_path,
            capture_time=parsed.capture_time,
            camera_location=parsed.camera_location,
            detected_pets=json.dumps(parsed.detected_pets, ensure_ascii=False),
            has_other_pets=has_other_pets,
            is_analyzed=True,
            analysis_notes=f"检测到宠物: {', '.join(parsed.detected_pets)}" if has_other_pets else None
        )
        session.add(image)
        return image

    def _save_abnormal_call(self, session, parsed: ParsedAbnormalCall, 
                              source_file: str, archive_path: str) -> AbnormalCall:
        pet = self._get_or_create_pet(session, parsed.pet_name)
        
        hour = parsed.call_time.hour
        is_night_time = (hour >= self.config.night_start_hour or hour < self.config.night_end_hour)
        
        call = AbnormalCall(
            pet_id=pet.id,
            file_name=parsed.file_name,
            original_path=parsed.file_path,
            archive_path=archive_path,
            call_time=parsed.call_time,
            call_type=parsed.call_type,
            transcription=parsed.transcription,
            duration_seconds=parsed.duration_seconds,
            is_night_time=is_night_time,
            is_analyzed=True,
            analysis_notes=f"夜间异常叫声" if is_night_time else None
        )
        session.add(call)
        return call

    def process_file(self, file_path: Path) -> Dict[str, Any]:
        result = {
            'file_path': str(file_path),
            'file_name': file_path.name,
            'success': False,
            'file_type': 'unknown',
            'records_processed': 0,
            'error': None,
            'pet_names': []
        }
        
        if not file_path.exists():
            result['error'] = f"文件不存在: {file_path}"
            return result
        
        try:
            file_hash = self.parser.calculate_file_hash(file_path)
            
            with db_session() as session:
                existing = session.query(ProcessedFile).filter(
                    ProcessedFile.file_hash == file_hash
                ).first()
                
                if existing:
                    result['success'] = True
                    result['file_type'] = existing.file_type
                    result['error'] = "文件已处理过，跳过"
                    return result
            
            parse_result = self.parser.parse_file(file_path)
            result['file_type'] = parse_result.file_type
            
            if not parse_result.success:
                result['error'] = parse_result.error_message
                
                with db_session() as session:
                    processed_file = ProcessedFile(
                        file_name=file_path.name,
                        file_path=str(file_path),
                        file_type=parse_result.file_type,
                        file_size=file_path.stat().st_size,
                        file_hash=file_hash,
                        status=FileStatus.FAILED,
                        error_message=parse_result.error_message
                    )
                    session.add(processed_file)
                
                return result
            
            pet_names = []
            
            with db_session() as session:
                archive_path = None
                
                for item in parse_result.data:
                    pet_name = None
                    
                    if isinstance(item, ParsedMedication):
                        pet_name = item.pet_name
                        if pet_name not in pet_names:
                            pet_names.append(pet_name)
                        
                        if archive_path is None:
                            archive_path = self._archive_file(
                                file_path, pet_name, 'medication'
                            )
                        
                        self._save_medication_record(session, item, file_path.name, archive_path)
                        result['records_processed'] += 1
                        
                    elif isinstance(item, ParsedNote):
                        pet_name = item.pet_name
                        if pet_name not in pet_names:
                            pet_names.append(pet_name)
                        
                        if archive_path is None:
                            archive_path = self._archive_file(
                                file_path, pet_name, 'note'
                            )
                        
                        self._save_note(session, item, file_path.name, archive_path)
                        result['records_processed'] += 1
                        
                    elif isinstance(item, ParsedCameraImage):
                        pet_name = item.pet_name
                        if pet_name not in pet_names:
                            pet_names.append(pet_name)
                        
                        if archive_path is None:
                            archive_path = self._archive_file(
                                file_path, pet_name, 'camera'
                            )
                        
                        self._save_camera_image(session, item, file_path.name, archive_path)
                        result['records_processed'] += 1
                        
                    elif isinstance(item, ParsedAbnormalCall):
                        pet_name = item.pet_name
                        if pet_name not in pet_names:
                            pet_names.append(pet_name)
                        
                        if archive_path is None:
                            archive_path = self._archive_file(
                                file_path, pet_name, 'call'
                            )
                        
                        self._save_abnormal_call(session, item, file_path.name, archive_path)
                        result['records_processed'] += 1
                
                processed_file = ProcessedFile(
                    file_name=file_path.name,
                    file_path=str(file_path),
                    file_type=parse_result.file_type,
                    file_size=file_path.stat().st_size,
                    file_hash=file_hash,
                    status=FileStatus.ARCHIVED,
                    process_completed_at=datetime.now(),
                    related_pet_ids=json.dumps(pet_names, ensure_ascii=False),
                    archive_path=archive_path
                )
                session.add(processed_file)
                
                result['success'] = True
                result['pet_names'] = pet_names
                
                try:
                    file_path.unlink()
                except Exception:
                    pass
            
        except Exception as e:
            result['error'] = str(e)
        
        return result

    def scan_incoming_directory(self) -> List[Dict[str, Any]]:
        results = []
        
        if not self.incoming_dir.exists():
            return results
        
        files_to_process = []
        for item in self.incoming_dir.iterdir():
            if item.is_file() and not item.name.startswith('.'):
                files_to_process.append(item)
        
        for file_path in sorted(files_to_process, key=lambda x: x.stat().st_mtime):
            result = self.process_file(file_path)
            results.append(result)
        
        return results

    def get_all_pets(self, session) -> List[Pet]:
        return session.query(Pet).filter(
            Pet.check_out_date.is_(None)
        ).all()

    def get_pet_by_name(self, session, name: str) -> Optional[Pet]:
        return session.query(Pet).filter(Pet.name == name).first()
