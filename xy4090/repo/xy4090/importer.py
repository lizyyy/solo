import csv
import re
from datetime import time, datetime
from typing import List, Tuple, Optional
from uuid import uuid4

from models import (
    Term, AgendaItem, MarkType,
    ValidationError, ImportResult
)


class TermImporter:
    REQUIRED_COLUMNS = ["chinese", "english"]
    OPTIONAL_COLUMNS = ["category", "notes", "difficulty"]
    
    @classmethod
    def import_from_csv(cls, file_path: str, encoding: str = "utf-8") -> ImportResult:
        errors: List[ValidationError] = []
        warnings: List[ValidationError] = []
        terms: List[Term] = []
        
        try:
            with open(file_path, "r", encoding=encoding, newline="") as f:
                reader = csv.DictReader(f)
                headers = [h.strip().lower() for h in reader.fieldnames] if reader.fieldnames else []
                
                missing_columns = [col for col in cls.REQUIRED_COLUMNS if col not in headers]
                if missing_columns:
                    errors.append(ValidationError(
                        field="headers",
                        message=f"缺少必需列: {', '.join(missing_columns)}。必需列: {', '.join(cls.REQUIRED_COLUMNS)}",
                        severity="error"
                    ))
                    return ImportResult(
                        success=False,
                        data=[],
                        errors=errors,
                        warnings=warnings,
                        count=0
                    )
                
                for row_num, row in enumerate(reader, start=2):
                    row_errors, term = cls._validate_row(row, row_num)
                    errors.extend(row_errors)
                    
                    if term:
                        terms.append(term)
                    else:
                        warnings.append(ValidationError(
                            field="row",
                            message=f"第 {row_num} 行数据无效，已跳过",
                            row_number=row_num,
                            severity="warning"
                        ))
        
        except UnicodeDecodeError:
            try:
                return cls.import_from_csv(file_path, encoding="gbk")
            except Exception as e:
                errors.append(ValidationError(
                    field="encoding",
                    message=f"文件编码错误，请使用 UTF-8 或 GBK 编码。错误: {str(e)}",
                    severity="error"
                ))
                return ImportResult(
                    success=False,
                    data=[],
                    errors=errors,
                    warnings=warnings,
                    count=0
                )
        except FileNotFoundError:
            errors.append(ValidationError(
                field="file",
                message=f"文件不存在: {file_path}",
                severity="error"
            ))
            return ImportResult(
                success=False,
                data=[],
                errors=errors,
                warnings=warnings,
                count=0
            )
        except Exception as e:
            errors.append(ValidationError(
                field="file",
                message=f"读取文件时发生错误: {str(e)}",
                severity="error"
            ))
            return ImportResult(
                success=False,
                data=[],
                errors=errors,
                warnings=warnings,
                count=0
            )
        
        return ImportResult(
            success=len(errors) == 0 or all(e.severity == "warning" for e in errors),
            data=terms,
            errors=errors,
            warnings=warnings,
            count=len(terms)
        )
    
    @classmethod
    def _validate_row(cls, row: dict, row_num: int) -> Tuple[List[ValidationError], Optional[Term]]:
        errors: List[ValidationError] = []
        row_lower = {k.strip().lower(): v for k, v in row.items()}
        
        chinese = row_lower.get("chinese", "").strip()
        english = row_lower.get("english", "").strip()
        
        if not chinese and not english:
            errors.append(ValidationError(
                field="chinese,english",
                message="中文和英文术语不能同时为空",
                row_number=row_num,
                severity="error"
            ))
            return errors, None
        
        if chinese and cls._is_english_text(chinese):
            errors.append(ValidationError(
                field="chinese",
                message=f"疑似中英文列颠倒: '{chinese}' 看起来像英文",
                row_number=row_num,
                severity="warning"
            ))
        
        if english and cls._is_chinese_text(english):
            errors.append(ValidationError(
                field="english",
                message=f"疑似中英文列颠倒: '{english}' 看起来像中文",
                row_number=row_num,
                severity="warning"
            ))
        
        category = row_lower.get("category", "").strip()
        notes = row_lower.get("notes", "").strip()
        
        difficulty = 1
        difficulty_str = row_lower.get("difficulty", "").strip()
        if difficulty_str:
            try:
                difficulty = int(difficulty_str)
                if difficulty < 1 or difficulty > 5:
                    errors.append(ValidationError(
                        field="difficulty",
                        message="难度值应在 1-5 之间，已使用默认值 1",
                        row_number=row_num,
                        severity="warning"
                    ))
                    difficulty = 1
            except ValueError:
                errors.append(ValidationError(
                    field="difficulty",
                    message=f"难度值格式无效: '{difficulty_str}'，已使用默认值 1",
                    row_number=row_num,
                    severity="warning"
                ))
                difficulty = 1
        
        term = Term(
            id=str(uuid4()),
            chinese=chinese,
            english=english,
            category=category,
            notes=notes,
            difficulty=difficulty
        )
        
        return errors, term
    
    @staticmethod
    def _is_chinese_text(text: str) -> bool:
        chinese_char_count = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
        total_char_count = len([c for c in text if c.isalpha()])
        if total_char_count == 0:
            return False
        return chinese_char_count / total_char_count > 0.5
    
    @staticmethod
    def _is_english_text(text: str) -> bool:
        english_char_count = sum(1 for c in text if ('a' <= c.lower() <= 'z'))
        total_char_count = len([c for c in text if c.isalpha()])
        if total_char_count == 0:
            return False
        return english_char_count / total_char_count > 0.5


class AgendaImporter:
    TIME_PATTERN = re.compile(
        r'(\d{1,2})[:：](\d{2})(?:[:：](\d{2}))?\s*[-–~]\s*(\d{1,2})[:：](\d{2})(?:[:：](\d{2}))?'
    )
    SPEAKER_PATTERN = re.compile(
        r'(?:讲者|嘉宾|演讲人|speaker|presenter|panelist)[:：\s]+([^\n\r]+)',
        re.IGNORECASE
    )
    TOPIC_PATTERN = re.compile(
        r'(?:主题|题目|topic|subject)[:：\s]+([^\n\r]+)',
        re.IGNORECASE
    )
    
    @classmethod
    def import_from_text(cls, file_path: str, encoding: str = "utf-8") -> ImportResult:
        errors: List[ValidationError] = []
        warnings: List[ValidationError] = []
        agenda_items: List[AgendaItem] = []
        
        try:
            with open(file_path, "r", encoding=encoding) as f:
                content = f.read()
        except UnicodeDecodeError:
            try:
                with open(file_path, "r", encoding="gbk") as f:
                    content = f.read()
            except Exception as e:
                errors.append(ValidationError(
                    field="encoding",
                    message=f"文件编码错误，请使用 UTF-8 或 GBK 编码。错误: {str(e)}",
                    severity="error"
                ))
                return ImportResult(
                    success=False,
                    data=[],
                    errors=errors,
                    warnings=warnings,
                    count=0
                )
        except FileNotFoundError:
            errors.append(ValidationError(
                field="file",
                message=f"文件不存在: {file_path}",
                severity="error"
            ))
            return ImportResult(
                success=False,
                data=[],
                errors=errors,
                warnings=warnings,
                count=0
            )
        
        lines = content.split('\n')
        current_block: List[str] = []
        line_num = 0
        
        for line in lines:
            line_num += 1
            stripped = line.strip()
            
            time_match = cls.TIME_PATTERN.search(stripped)
            
            if time_match and current_block:
                item, block_errors, block_warnings = cls._parse_agenda_block(
                    current_block, line_num - len(current_block)
                )
                errors.extend(block_errors)
                warnings.extend(block_warnings)
                if item:
                    agenda_items.append(item)
                current_block = [stripped]
            else:
                if stripped or current_block:
                    current_block.append(stripped)
        
        if current_block:
            item, block_errors, block_warnings = cls._parse_agenda_block(
                current_block, line_num - len(current_block) + 1
            )
            errors.extend(block_errors)
            warnings.extend(block_warnings)
            if item:
                agenda_items.append(item)
        
        if not agenda_items:
            warnings.append(ValidationError(
                field="agenda",
                message="未能解析出有效的议程项。请确保议程中包含时间格式如 '9:00 - 10:00'",
                severity="warning"
            ))
        
        agenda_items.sort(key=lambda x: x.start_time)
        
        overlap_errors = cls._check_time_overlaps(agenda_items)
        errors.extend(overlap_errors)
        
        return ImportResult(
            success=len(errors) == 0 or all(e.severity == "warning" for e in errors),
            data=agenda_items,
            errors=errors,
            warnings=warnings,
            count=len(agenda_items)
        )
    
    @classmethod
    def _parse_agenda_block(
        cls,
        lines: List[str],
        start_line_num: int
    ) -> Tuple[Optional[AgendaItem], List[ValidationError], List[ValidationError]]:
        errors: List[ValidationError] = []
        warnings: List[ValidationError] = []
        
        full_text = ' '.join(lines)
        
        time_match = cls.TIME_PATTERN.search(full_text)
        if not time_match:
            warnings.append(ValidationError(
                field="time",
                message=f"第 {start_line_num} 行附近未找到时间格式",
                row_number=start_line_num,
                severity="warning"
            ))
            return None, errors, warnings
        
        start_hour = int(time_match.group(1))
        start_min = int(time_match.group(2))
        start_sec = int(time_match.group(3)) if time_match.group(3) else 0
        
        end_hour = int(time_match.group(4))
        end_min = int(time_match.group(5))
        end_sec = int(time_match.group(6)) if time_match.group(6) else 0
        
        start_time = time(start_hour, start_min, start_sec)
        end_time = time(end_hour, end_min, end_sec)
        
        if start_time >= end_time:
            warnings.append(ValidationError(
                field="time",
                message=f"第 {start_line_num} 行: 开始时间 ({start_time}) 晚于或等于结束时间 ({end_time})",
                row_number=start_line_num,
                severity="warning"
            ))
        
        speaker = ""
        speaker_match = cls.SPEAKER_PATTERN.search(full_text)
        if speaker_match:
            speaker = speaker_match.group(1).strip()
        
        topic = ""
        topic_match = cls.TOPIC_PATTERN.search(full_text)
        if topic_match:
            topic = topic_match.group(1).strip()
        
        title_parts = []
        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue
            if cls.TIME_PATTERN.search(stripped):
                time_part = cls.TIME_PATTERN.search(stripped).group()
                rest = stripped.replace(time_part, '').strip(' -–~:：\t')
                if rest:
                    title_parts.append(rest)
            elif not (cls.SPEAKER_PATTERN.match(stripped) or cls.TOPIC_PATTERN.match(stripped)):
                title_parts.append(stripped)
        
        title = ' '.join(title_parts).strip()
        if not title:
            title = f"议程项 ({start_time.strftime('%H:%M')} - {end_time.strftime('%H:%M')})"
            warnings.append(ValidationError(
                field="title",
                message=f"第 {start_line_num} 行: 未找到议程标题，已使用自动生成的标题",
                row_number=start_line_num,
                severity="warning"
            ))
        
        item = AgendaItem(
            id=str(uuid4()),
            start_time=start_time,
            end_time=end_time,
            title=title,
            speaker=speaker,
            topic=topic,
            related_terms=[],
            notes=""
        )
        
        return item, errors, warnings
    
    @classmethod
    def _check_time_overlaps(cls, items: List[AgendaItem]) -> List[ValidationError]:
        errors: List[ValidationError] = []
        
        for i in range(len(items)):
            for j in range(i + 1, len(items)):
                item1 = items[i]
                item2 = items[j]
                
                if item1.start_time <= item2.start_time < item1.end_time:
                    errors.append(ValidationError(
                        field="time",
                        message=f"时间重叠: '{item1.title}' ({item1.start_time.strftime('%H:%M')}-{item1.end_time.strftime('%H:%M')}) "
                               f"与 '{item2.title}' ({item2.start_time.strftime('%H:%M')}-{item2.end_time.strftime('%H:%M')})",
                        severity="warning"
                    ))
        
        return errors


class SpeakerImporter:
    @classmethod
    def import_from_text(cls, file_path: str, encoding: str = "utf-8") -> ImportResult:
        errors: List[ValidationError] = []
        warnings: List[ValidationError] = []
        speakers: List[str] = []
        
        try:
            with open(file_path, "r", encoding=encoding) as f:
                content = f.read()
        except UnicodeDecodeError:
            try:
                with open(file_path, "r", encoding="gbk") as f:
                    content = f.read()
            except Exception as e:
                errors.append(ValidationError(
                    field="encoding",
                    message=f"文件编码错误，请使用 UTF-8 或 GBK 编码。错误: {str(e)}",
                    severity="error"
                ))
                return ImportResult(
                    success=False,
                    data=[],
                    errors=errors,
                    warnings=warnings,
                    count=0
                )
        except FileNotFoundError:
            errors.append(ValidationError(
                field="file",
                message=f"文件不存在: {file_path}",
                severity="error"
            ))
            return ImportResult(
                success=False,
                data=[],
                errors=errors,
                warnings=warnings,
                count=0
            )
        
        lines = content.split('\n')
        seen = set()
        
        for line_num, line in enumerate(lines, start=1):
            stripped = line.strip()
            if not stripped:
                continue
            
            if stripped.startswith('#') or stripped.startswith('//'):
                continue
            
            name_parts = stripped.split()
            for part in name_parts:
                name = part.strip()
                if name and name not in seen:
                    seen.add(name)
                    speakers.append(name)
        
        if not speakers:
            warnings.append(ValidationError(
                field="speakers",
                message="未找到嘉宾名单，请确保每行一个嘉宾姓名",
                severity="warning"
            ))
        
        return ImportResult(
            success=True,
            data=speakers,
            errors=errors,
            warnings=warnings,
            count=len(speakers)
        )
