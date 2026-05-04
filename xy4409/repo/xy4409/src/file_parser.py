import os
import re
import csv
import json
import hashlib
from datetime import datetime, date
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field


@dataclass
class ParsedMedication:
    pet_name: str
    medication_name: str
    dosage: str
    scheduled_time: datetime
    is_administered: bool
    administered_time: Optional[datetime] = None
    administered_by: Optional[str] = None
    notes: Optional[str] = None


@dataclass
class ParsedNote:
    pet_name: str
    note_type: str
    content: str
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
    is_confirmed: bool = False


@dataclass
class ParsedCameraImage:
    pet_name: str
    file_name: str
    file_path: str
    capture_time: datetime
    camera_location: Optional[str] = None
    detected_pets: List[str] = field(default_factory=list)


@dataclass
class ParsedAbnormalCall:
    pet_name: str
    file_name: str
    file_path: str
    call_time: datetime
    call_type: Optional[str] = None
    transcription: Optional[str] = None
    duration_seconds: float = 0.0


@dataclass
class ParseResult:
    file_type: str
    success: bool
    data: List[Any] = field(default_factory=list)
    error_message: Optional[str] = None


class FileParser:
    PET_NAME_PATTERNS = [
        re.compile(r'^([a-zA-Z0-9_\u4e00-\u9fa5]+)_', re.UNICODE),
        re.compile(r'_([a-zA-Z0-9_\u4e00-\u9fa5]+)_', re.UNICODE),
        re.compile(r'_([a-zA-Z0-9_\u4e00-\u9fa5]+)\.', re.UNICODE),
        re.compile(r'^([a-zA-Z0-9_\u4e00-\u9fa5]+)\.', re.UNICODE),
    ]

    DATETIME_PATTERNS = [
        re.compile(r'(\d{4})[_\-]?(\d{2})[_\-]?(\d{2})[_\sT]?(\d{2})[_\-:]?(\d{2})[_\-:]?(\d{2})'),
        re.compile(r'(\d{4})[_\-]?(\d{2})[_\-]?(\d{2})[_\sT]?(\d{2})[_\-:]?(\d{2})'),
        re.compile(r'(\d{4})[_\-]?(\d{2})[_\-]?(\d{2})'),
    ]

    def __init__(self):
        pass

    @staticmethod
    def calculate_file_hash(file_path: Path) -> str:
        hasher = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                hasher.update(chunk)
        return hasher.hexdigest()

    @staticmethod
    def extract_pet_name_from_filename(filename: str) -> Optional[str]:
        for pattern in FileParser.PET_NAME_PATTERNS:
            match = pattern.search(filename)
            if match:
                return match.group(1)
        return None

    @staticmethod
    def extract_datetime_from_filename(filename: str) -> Optional[datetime]:
        for pattern in FileParser.DATETIME_PATTERNS:
            match = pattern.search(filename)
            if match:
                groups = match.groups()
                year = int(groups[0])
                month = int(groups[1])
                day = int(groups[2])
                hour = int(groups[3]) if len(groups) > 3 and groups[3] else 0
                minute = int(groups[4]) if len(groups) > 4 and groups[4] else 0
                second = int(groups[5]) if len(groups) > 5 and groups[5] else 0

                try:
                    return datetime(year, month, day, hour, minute, second)
                except ValueError:
                    continue
        return None

    @staticmethod
    def is_medication_csv(file_path: Path) -> bool:
        if file_path.suffix.lower() != '.csv':
            return False
        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                first_line = f.readline().lower()
                medication_keywords = ['medication', '喂药', '用药', 'drug', 'medicine', 'administer']
                return any(keyword in first_line for keyword in medication_keywords)
        except Exception:
            return False

    @staticmethod
    def is_note_json(file_path: Path) -> bool:
        if file_path.suffix.lower() != '.json':
            return False
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, dict):
                    note_keywords = ['note', 'remark', '备注', 'owner', '主人', 'instruction']
                    for key in data.keys():
                        if any(kw in key.lower() for kw in note_keywords):
                            return True
                    if 'notes' in data or 'note' in data or 'content' in data:
                        return True
                elif isinstance(data, list) and len(data) > 0:
                    first = data[0]
                    if isinstance(first, dict):
                        note_keywords = ['note', 'remark', '备注', 'owner', '主人', 'pet_name']
                        for key in first.keys():
                            if any(kw in key.lower() for kw in note_keywords):
                                return True
        except Exception:
            pass
        return False

    @staticmethod
    def is_abnormal_call_txt(file_path: Path) -> bool:
        if file_path.suffix.lower() != '.txt':
            return False
        filename = file_path.name.lower()
        call_keywords = ['call', '叫声', '异常', 'abnormal', 'bark', 'howl', 'meow', 'cry']
        return any(kw in filename for kw in call_keywords)

    @staticmethod
    def is_camera_image(file_path: Path) -> bool:
        image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}
        if file_path.suffix.lower() not in image_extensions:
            return False
        filename = file_path.name.lower()
        camera_keywords = ['camera', '摄像头', '抓拍', 'capture', 'snapshot', 'photo', 'image']
        return any(kw in filename for kw in camera_keywords)

    def detect_file_type(self, file_path: Path) -> str:
        if self.is_medication_csv(file_path):
            return 'medication_csv'
        elif self.is_note_json(file_path):
            return 'note_json'
        elif self.is_abnormal_call_txt(file_path):
            return 'abnormal_call_txt'
        elif self.is_camera_image(file_path):
            return 'camera_image'
        else:
            return 'unknown'

    def parse_medication_csv(self, file_path: Path) -> ParseResult:
        try:
            medications = []
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                
                for row in reader:
                    row_lower = {k.lower(): v for k, v in row.items()}
                    
                    pet_name = row_lower.get('pet_name') or row_lower.get('宠物名') or row_lower.get('pet') or row_lower.get('宠物')
                    if not pet_name:
                        pet_name = self.extract_pet_name_from_filename(file_path.name)
                    if not pet_name:
                        continue
                    
                    medication_name = row_lower.get('medication') or row_lower.get('medicine') or row_lower.get('药物') or row_lower.get('药品') or 'Unknown'
                    dosage = row_lower.get('dosage') or row_lower.get('剂量') or row_lower.get('用量') or ''
                    
                    scheduled_time_str = row_lower.get('scheduled_time') or row_lower.get('预定时间') or row_lower.get('time') or row_lower.get('时间') or ''
                    scheduled_time = self._parse_datetime(scheduled_time_str)
                    if not scheduled_time:
                        scheduled_time = self.extract_datetime_from_filename(file_path.name)
                    if not scheduled_time:
                        scheduled_time = datetime.now()
                    
                    is_administered = False
                    administered_time = None
                    administered_by = None
                    
                    admin_status = row_lower.get('administered') or row_lower.get('已喂药') or row_lower.get('status') or row_lower.get('状态') or ''
                    if admin_status and admin_status.lower() in ['yes', '是', 'true', '1', '已喂', '已给药']:
                        is_administered = True
                    
                    administered_time_str = row_lower.get('administered_time') or row_lower.get('实际喂药时间') or ''
                    if administered_time_str:
                        administered_time = self._parse_datetime(administered_time_str)
                    
                    administered_by = row_lower.get('administered_by') or row_lower.get('喂药人') or row_lower.get('操作员') or ''
                    notes = row_lower.get('notes') or row_lower.get('备注') or ''
                    
                    medications.append(ParsedMedication(
                        pet_name=pet_name.strip(),
                        medication_name=medication_name.strip(),
                        dosage=dosage.strip(),
                        scheduled_time=scheduled_time,
                        is_administered=is_administered,
                        administered_time=administered_time,
                        administered_by=administered_by.strip() if administered_by else None,
                        notes=notes.strip() if notes else None
                    ))
            
            return ParseResult(
                file_type='medication_csv',
                success=True,
                data=medications
            )
            
        except Exception as e:
            return ParseResult(
                file_type='medication_csv',
                success=False,
                error_message=str(e)
            )

    def parse_note_json(self, file_path: Path) -> ParseResult:
        try:
            notes = []
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            items = []
            if isinstance(data, list):
                items = data
            elif isinstance(data, dict):
                if 'notes' in data:
                    items = data['notes']
                elif 'note' in data:
                    items = [data]
                else:
                    items = [data]
            
            for item in items:
                if not isinstance(item, dict):
                    continue
                
                item_lower = {k.lower(): v for k, v in item.items()}
                
                pet_name = item_lower.get('pet_name') or item_lower.get('宠物名') or item_lower.get('pet') or item_lower.get('宠物')
                if not pet_name:
                    pet_name = self.extract_pet_name_from_filename(file_path.name)
                if not pet_name:
                    continue
                
                note_type = item_lower.get('type') or item_lower.get('类型') or 'owner_note'
                content = item_lower.get('content') or item_lower.get('note') or item_lower.get('备注') or item_lower.get('内容') or ''
                if not content:
                    continue
                
                created_by = item_lower.get('created_by') or item_lower.get('创建人') or item_lower.get('owner') or item_lower.get('主人') or None
                
                created_at = None
                created_at_str = item_lower.get('created_at') or item_lower.get('时间') or item_lower.get('date') or item_lower.get('日期') or ''
                if created_at_str:
                    created_at = self._parse_datetime(created_at_str)
                if not created_at:
                    created_at = self.extract_datetime_from_filename(file_path.name)
                if not created_at:
                    created_at = datetime.now()
                
                is_confirmed = False
                confirmed_status = item_lower.get('is_confirmed') or item_lower.get('confirmed') or item_lower.get('已确认') or False
                if isinstance(confirmed_status, bool):
                    is_confirmed = confirmed_status
                elif isinstance(confirmed_status, str):
                    is_confirmed = confirmed_status.lower() in ['yes', '是', 'true', '1', '已确认']
                
                notes.append(ParsedNote(
                    pet_name=pet_name.strip(),
                    note_type=note_type.strip(),
                    content=content.strip(),
                    created_by=created_by.strip() if created_by else None,
                    created_at=created_at,
                    is_confirmed=is_confirmed
                ))
            
            return ParseResult(
                file_type='note_json',
                success=True,
                data=notes
            )
            
        except Exception as e:
            return ParseResult(
                file_type='note_json',
                success=False,
                error_message=str(e)
            )

    def parse_abnormal_call_txt(self, file_path: Path) -> ParseResult:
        try:
            calls = []
            pet_name = self.extract_pet_name_from_filename(file_path.name)
            if not pet_name:
                return ParseResult(
                    file_type='abnormal_call_txt',
                    success=False,
                    error_message="无法从文件名提取宠物名称"
                )
            
            call_time = self.extract_datetime_from_filename(file_path.name)
            if not call_time:
                call_time = datetime.now()
            
            transcription = ''
            call_type = None
            duration_seconds = 0.0
            
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            lines = content.split('\n')
            metadata_lines = []
            transcription_lines = []
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                
                if line.startswith(('类型:', 'Type:', '类型:', '时长:', 'Duration:', '时间:', 'Time:')):
                    metadata_lines.append(line)
                else:
                    transcription_lines.append(line)
            
            for line in metadata_lines:
                if '类型' in line or 'Type' in line:
                    call_type = line.split(':', 1)[1].strip() if ':' in line else line
                elif '时长' in line or 'Duration' in line:
                    duration_str = line.split(':', 1)[1].strip() if ':' in line else line
                    try:
                        duration_seconds = float(re.search(r'\d+(\.\d+)?', duration_str).group())
                    except Exception:
                        pass
            
            transcription = '\n'.join(transcription_lines).strip()
            
            calls.append(ParsedAbnormalCall(
                pet_name=pet_name,
                file_name=file_path.name,
                file_path=str(file_path),
                call_time=call_time,
                call_type=call_type,
                transcription=transcription if transcription else None,
                duration_seconds=duration_seconds
            ))
            
            return ParseResult(
                file_type='abnormal_call_txt',
                success=True,
                data=calls
            )
            
        except Exception as e:
            return ParseResult(
                file_type='abnormal_call_txt',
                success=False,
                error_message=str(e)
            )

    def parse_camera_image(self, file_path: Path) -> ParseResult:
        try:
            images = []
            pet_name = self.extract_pet_name_from_filename(file_path.name)
            if not pet_name:
                return ParseResult(
                    file_type='camera_image',
                    success=False,
                    error_message="无法从文件名提取宠物名称"
                )
            
            capture_time = self.extract_datetime_from_filename(file_path.name)
            if not capture_time:
                capture_time = datetime.now()
            
            camera_location = None
            filename = file_path.name.lower()
            location_keywords = {
                'cage1': 'Cage 1', 'cage2': 'Cage 2', 'cage3': 'Cage 3',
                '笼子1': 'Cage 1', '笼子2': 'Cage 2', '笼子3': 'Cage 3',
                'front': 'Front Area', '前台': 'Front Area',
                'back': 'Back Area', '后场': 'Back Area',
                'play': 'Play Area', '玩耍区': 'Play Area'
            }
            
            for kw, loc in location_keywords.items():
                if kw in filename:
                    camera_location = loc
                    break
            
            detected_pets = []
            if 'and' in filename.lower() or '&' in filename or '和' in filename:
                parts = re.split(r'[_\-&和]', pet_name)
                detected_pets = [p.strip() for p in parts if p.strip()]
            
            images.append(ParsedCameraImage(
                pet_name=pet_name,
                file_name=file_path.name,
                file_path=str(file_path),
                capture_time=capture_time,
                camera_location=camera_location,
                detected_pets=detected_pets if detected_pets else [pet_name]
            ))
            
            return ParseResult(
                file_type='camera_image',
                success=True,
                data=images
            )
            
        except Exception as e:
            return ParseResult(
                file_type='camera_image',
                success=False,
                error_message=str(e)
            )

    def parse_file(self, file_path: Path) -> ParseResult:
        file_type = self.detect_file_type(file_path)
        
        if file_type == 'medication_csv':
            return self.parse_medication_csv(file_path)
        elif file_type == 'note_json':
            return self.parse_note_json(file_path)
        elif file_type == 'abnormal_call_txt':
            return self.parse_abnormal_call_txt(file_path)
        elif file_type == 'camera_image':
            return self.parse_camera_image(file_path)
        else:
            return ParseResult(
                file_type='unknown',
                success=False,
                error_message=f"未知的文件类型: {file_path.name}"
            )

    def _parse_datetime(self, datetime_str: str) -> Optional[datetime]:
        if not datetime_str:
            return None
        
        datetime_str = str(datetime_str).strip()
        
        formats = [
            '%Y-%m-%d %H:%M:%S',
            '%Y/%m/%d %H:%M:%S',
            '%Y-%m-%d %H:%M',
            '%Y/%m/%d %H:%M',
            '%Y-%m-%d',
            '%Y/%m/%d',
            '%Y_%m_%d_%H_%M_%S',
            '%Y%m%d%H%M%S',
            '%Y%m%d',
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(datetime_str, fmt)
            except ValueError:
                continue
        
        for pattern in self.DATETIME_PATTERNS:
            match = pattern.search(datetime_str)
            if match:
                groups = match.groups()
                year = int(groups[0])
                month = int(groups[1])
                day = int(groups[2])
                hour = int(groups[3]) if len(groups) > 3 and groups[3] else 0
                minute = int(groups[4]) if len(groups) > 4 and groups[4] else 0
                second = int(groups[5]) if len(groups) > 5 and groups[5] else 0
                
                try:
                    return datetime(year, month, day, hour, minute, second)
                except ValueError:
                    continue
        
        return None
