import csv
import json
import re
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple, Union
from .models import Essay, Feedback, Mistake


@dataclass
class ParseResult:
    success: bool
    items: List[Any]
    errors: List[str]
    warnings: List[str]
    source_file: str = ""


class Parser:
    DATE_FORMATS = [
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%Y.%m.%d",
        "%y-%m-%d",
        "%y/%m/%d",
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%m-%d-%Y",
        "%m/%d/%Y",
    ]

    @classmethod
    def parse_date(cls, date_str: str) -> Optional[date]:
        if not date_str or not date_str.strip():
            return None

        date_str = date_str.strip()

        for fmt in cls.DATE_FORMATS:
            try:
                return datetime.strptime(date_str, fmt).date()
            except (ValueError, TypeError):
                continue

        match = re.search(r'(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})', date_str)
        if match:
            try:
                return date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
            except (ValueError, TypeError):
                pass

        return None

    @classmethod
    def parse_float(cls, value: Any) -> Optional[float]:
        if value is None or value == "":
            return None
        if isinstance(value, (int, float)):
            return float(value)
        try:
            cleaned = str(value).strip().replace(',', '')
            match = re.search(r'(\d+\.?\d*)', cleaned)
            if match:
                return float(match.group(1))
            return None
        except (ValueError, TypeError):
            return None

    @classmethod
    def parse_csv_essays(cls, file_path: Union[str, Path]) -> ParseResult:
        file_path = Path(file_path)
        items: List[Essay] = []
        errors: List[str] = []
        warnings: List[str] = []

        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                content = f.read()
                if '\t' in content[:1000] and ',' not in content[:1000]:
                    delimiter = '\t'
                else:
                    delimiter = ','

            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f, delimiter=delimiter)

                required_fields = ['student_name', 'title', 'essay_type', 'score', 'max_score', 'date']
                field_mapping = cls._build_field_mapping(reader.fieldnames or [])

                for row_num, row in enumerate(reader, start=2):
                    try:
                        essay = cls._parse_essay_row(row, field_mapping, row_num)
                        if essay:
                            essay.source_file = str(file_path)
                            essay.id = f"essay_{file_path.stem}_{row_num-1}"
                            items.append(essay)
                    except Exception as e:
                        errors.append(f"第 {row_num} 行解析失败: {str(e)}")

        except FileNotFoundError:
            errors.append(f"文件不存在: {file_path}")
        except UnicodeDecodeError:
            errors.append(f"文件编码错误，请使用 UTF-8 编码: {file_path}")
        except Exception as e:
            errors.append(f"解析 CSV 文件时出错: {str(e)}")

        return ParseResult(
            success=len(errors) == 0,
            items=items,
            errors=errors,
            warnings=warnings,
            source_file=str(file_path)
        )

    @classmethod
    def _build_field_mapping(cls, fieldnames: List[str]) -> Dict[str, str]:
        mapping = {}
        fieldnames_lower = {f.lower(): f for f in fieldnames}

        aliases = {
            'student_name': ['student_name', 'student', 'name', '学生', '姓名', '学生姓名'],
            'title': ['title', 'essay_title', '作文题目', '题目', '标题'],
            'essay_type': ['essay_type', 'type', '文体', '类型', '作文类型'],
            'score': ['score', '分数', '得分', '成绩'],
            'max_score': ['max_score', '满分', '总分', '最高分'],
            'date': ['date', '日期', '时间', '考试日期'],
            'content': ['content', '内容', '正文', '作文内容'],
        }

        for standard_name, alias_list in aliases.items():
            for alias in alias_list:
                if alias.lower() in fieldnames_lower:
                    mapping[standard_name] = fieldnames_lower[alias.lower()]
                    break

        return mapping

    @classmethod
    def _parse_essay_row(cls, row: Dict[str, Any], mapping: Dict[str, str], row_num: int) -> Optional[Essay]:
        def get_value(key: str, default: Any = None) -> Any:
            actual_key = mapping.get(key, key)
            return row.get(actual_key, default)

        student_name = get_value('student_name', '')
        title = get_value('title', '')
        essay_type = get_value('essay_type', '')

        if not student_name or not student_name.strip():
            return None

        score = cls.parse_float(get_value('score'))
        max_score = cls.parse_float(get_value('max_score'))
        date_val = cls.parse_date(str(get_value('date', '')))
        content = str(get_value('content', '')) if get_value('content') else None

        return Essay(
            student_name=student_name.strip(),
            title=title.strip() if title else "未命名作文",
            essay_type=essay_type.strip() if essay_type else "未知",
            score=score if score is not None else 0.0,
            max_score=max_score if max_score is not None else 100.0,
            date=date_val if date_val else date.today(),
            content=content
        )

    @classmethod
    def parse_markdown_feedback(cls, file_path: Union[str, Path]) -> ParseResult:
        file_path = Path(file_path)
        items: List[Feedback] = []
        errors: List[str] = []
        warnings: List[str] = []

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            sections = cls._split_markdown_sections(content)

            for idx, section in enumerate(sections):
                try:
                    feedback = cls._parse_feedback_section(section)
                    if feedback:
                        feedback.source_file = str(file_path)
                        feedback.id = f"feedback_{file_path.stem}_{idx}"
                        items.append(feedback)
                except Exception as e:
                    errors.append(f"解析第 {idx+1} 个反馈块失败: {str(e)}")

        except FileNotFoundError:
            errors.append(f"文件不存在: {file_path}")
        except UnicodeDecodeError:
            errors.append(f"文件编码错误，请使用 UTF-8 编码: {file_path}")
        except Exception as e:
            errors.append(f"解析 Markdown 文件时出错: {str(e)}")

        return ParseResult(
            success=len(errors) == 0,
            items=items,
            errors=errors,
            warnings=warnings,
            source_file=str(file_path)
        )

    @classmethod
    def _split_markdown_sections(cls, content: str) -> List[str]:
        h1_pattern = r'^# .+$'
        h2_pattern = r'^## .+$'
        hr_pattern = r'^[-*_]{3,}$'
        student_pattern = r'^[学生姓名]|^姓名[:：]'

        lines = content.split('\n')
        sections = []
        current_section = []

        for line in lines:
            is_section_boundary = (
                re.match(h1_pattern, line)
                or re.match(h2_pattern, line)
                or re.match(hr_pattern, line)
                or re.search(student_pattern, line, re.IGNORECASE)
            )

            if is_section_boundary and current_section:
                sections.append('\n'.join(current_section))
                current_section = []

            current_section.append(line)

        if current_section:
            sections.append('\n'.join(current_section))

        if len(sections) == 1 and not sections[0].strip():
            return []

        return sections

    @classmethod
    def _parse_feedback_section(cls, section: str) -> Optional[Feedback]:
        section = section.strip()
        if not section:
            return None

        lines = section.split('\n')
        student_name = ""
        essay_title = None
        essay_type = None
        date_val = None
        score = None
        teacher_comment = []
        student_revision = []
        cause_description = []

        in_teacher = False
        in_student = False
        in_cause = False

        for line in lines:
            line = line.rstrip()

            student_match = re.search(r'(?:学生|姓名)[:：\s]+(.+)', line)
            if student_match:
                student_name = student_match.group(1).strip()
                continue

            title_match = re.search(r'(?:题目|标题|作文题目)[:：\s]+(.+)', line)
            if title_match:
                essay_title = title_match.group(1).strip()
                continue

            type_match = re.search(r'(?:类型|文体)[:：\s]+(.+)', line)
            if type_match:
                essay_type = type_match.group(1).strip()
                continue

            date_match = re.search(r'(?:日期|时间)[:：\s]+(.+)', line)
            if date_match:
                date_val = cls.parse_date(date_match.group(1))
                continue

            score_match = re.search(r'(?:得分|分数|成绩)[:：\s]+(\d+\.?\d*)', line)
            if score_match:
                score = cls.parse_float(score_match.group(1))
                continue

            if re.search(r'老师批[注语]|教师评|批[注]', line):
                in_teacher = True
                in_student = False
                in_cause = False
                continue
            elif re.search(r'学生订正|修改|订正|学生修改', line):
                in_teacher = False
                in_student = True
                in_cause = False
                continue
            elif re.search(r'错因|错误原因|问题分析|原因分析', line):
                in_teacher = False
                in_student = False
                in_cause = True
                continue

            clean_line = re.sub(r'^[-*>•\d+\.]\s*', '', line).strip()
            if not clean_line:
                continue

            if in_teacher:
                teacher_comment.append(clean_line)
            elif in_student:
                student_revision.append(clean_line)
            elif in_cause:
                cause_description.append(clean_line)
            else:
                teacher_comment.append(clean_line)

        if not student_name:
            name_match = re.search(r'^[#\s]*([^\s#]{2,10})', section)
            if name_match:
                student_name = name_match.group(1).strip()

        if not student_name:
            return None

        return Feedback(
            student_name=student_name,
            essay_title=essay_title,
            essay_type=essay_type,
            date=date_val,
            teacher_comment='\n'.join(teacher_comment),
            student_revision='\n'.join(student_revision),
            cause_description='\n'.join(cause_description),
            score=score
        )

    @classmethod
    def parse_json_mistakes(cls, file_path: Union[str, Path]) -> ParseResult:
        file_path = Path(file_path)
        items: List[Mistake] = []
        errors: List[str] = []
        warnings: List[str] = []

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            if isinstance(data, dict):
                data_list = data.get('mistakes', data.get('items', [data]))
            elif isinstance(data, list):
                data_list = data
            else:
                errors.append(f"JSON 格式不正确，应为数组或包含 'mistakes' 字段的对象")
                return ParseResult(success=False, items=[], errors=errors, warnings=warnings)

            for idx, item in enumerate(data_list):
                try:
                    mistake = cls._parse_mistake_item(item, idx)
                    if mistake:
                        mistake.source_file = str(file_path)
                        mistake.id = f"mistake_{file_path.stem}_{idx}"
                        items.append(mistake)
                except Exception as e:
                    errors.append(f"解析第 {idx+1} 个错误项失败: {str(e)}")

        except FileNotFoundError:
            errors.append(f"文件不存在: {file_path}")
        except json.JSONDecodeError as e:
            errors.append(f"JSON 解析错误: {str(e)}")
        except UnicodeDecodeError:
            errors.append(f"文件编码错误，请使用 UTF-8 编码: {file_path}")
        except Exception as e:
            errors.append(f"解析 JSON 文件时出错: {str(e)}")

        return ParseResult(
            success=len(errors) == 0,
            items=items,
            errors=errors,
            warnings=warnings,
            source_file=str(file_path)
        )

    @classmethod
    def _parse_mistake_item(cls, item: Dict[str, Any], idx: int) -> Optional[Mistake]:
        if not item:
            return None

        def get_value(key: str, aliases: List[str], default: Any = None) -> Any:
            if key in item:
                return item[key]
            for alias in aliases:
                if alias in item:
                    return item[alias]
            return default

        student_name = get_value('student_name', ['student', '学生', '姓名'], '')
        mistake_type = get_value('mistake_type', ['type', '类型', '错误类型'], '')
        description = get_value('description', ['desc', '描述', '内容', '错误描述'], '')

        if not student_name or not student_name.strip():
            return None

        location = get_value('location', ['位置', '段落', 'location'], None)
        essay_title = get_value('essay_title', ['title', '题目', '作文题目'], None)
        essay_type = get_value('essay_type', ['文体', '作文类型'], None)

        date_str = get_value('date', ['日期', '时间'], None)
        date_val = cls.parse_date(str(date_str)) if date_str else None

        severity = get_value('severity', ['严重程度', '级别', '等级'], 'medium')
        if isinstance(severity, str):
            severity = severity.lower()
            if severity in ['高', '严重', 'high']:
                severity = 'high'
            elif severity in ['低', '轻微', 'low']:
                severity = 'low'
            else:
                severity = 'medium'

        correction = get_value('correction', ['修改', '订正', '纠正', '正确写法'], '')

        return Mistake(
            student_name=student_name.strip(),
            mistake_type=mistake_type.strip() if mistake_type else '未知',
            description=description.strip() if description else '',
            location=location,
            essay_title=essay_title,
            essay_type=essay_type,
            date=date_val,
            severity=severity,
            correction=correction
        )
