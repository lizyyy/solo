import csv
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime

from models import Student


class CSVParseError(Exception):
    pass


class CSVParser:
    def __init__(self):
        self.errors: List[str] = []
    
    def parse_students(self, file_path: Path) -> List[Student]:
        self.errors.clear()
        students: List[Student] = []
        
        if not file_path.exists():
            raise CSVParseError(f"文件不存在: {file_path}")
        
        if file_path.suffix.lower() != ".csv":
            raise CSVParseError(f"不是CSV文件: {file_path}")
        
        try:
            with open(file_path, "r", encoding="utf-8-sig") as f:
                content = f.read()
        except UnicodeDecodeError:
            try:
                with open(file_path, "r", encoding="gbk") as f:
                    content = f.read()
            except UnicodeDecodeError:
                raise CSVParseError(f"无法识别文件编码: {file_path}")
        
        lines = content.splitlines()
        if not lines:
            raise CSVParseError("CSV文件为空")
        
        header_line = lines[0]
        data_lines = lines[1:]
        
        headers = self._parse_header(header_line)
        
        id_fields = ["student_id", "学号", "学生编号", "id", "编号"]
        name_fields = ["name", "姓名", "学生姓名", "学生名"]
        gender_fields = ["gender", "性别", "sex"]
        age_fields = ["age", "年龄", "岁数"]
        grade_fields = ["grade", "年级", "年段"]
        class_fields = ["class", "班级", "班", "class_name"]
        school_fields = ["school", "学校", "学校名称"]
        
        student_id_idx = self._find_field_index(headers, id_fields)
        name_idx = self._find_field_index(headers, name_fields)
        gender_idx = self._find_field_index(headers, gender_fields)
        age_idx = self._find_field_index(headers, age_fields)
        grade_idx = self._find_field_index(headers, grade_fields)
        class_idx = self._find_field_index(headers, class_fields)
        school_idx = self._find_field_index(headers, school_fields)
        
        if student_id_idx is None:
            raise CSVParseError("CSV中未找到学生ID字段（尝试了: student_id, 学号, 学生编号等）")
        
        for line_num, line in enumerate(data_lines, start=2):
            if not line.strip():
                continue
            
            row = self._parse_row(line)
            
            student_id = self._get_field_value(row, student_id_idx)
            if not student_id:
                self.errors.append(f"第{line_num}行: 学生ID为空")
                continue
            
            student = Student(
                student_id=str(student_id).strip(),
                source_file=str(file_path)
            )
            
            if name_idx is not None:
                name = self._get_field_value(row, name_idx)
                if name:
                    student.name = str(name).strip()
            
            if gender_idx is not None:
                gender = self._get_field_value(row, gender_idx)
                if gender:
                    student.gender = str(gender).strip()
            
            if age_idx is not None:
                age = self._get_field_value(row, age_idx)
                if age:
                    try:
                        student.age = int(str(age).strip())
                    except (ValueError, TypeError):
                        pass
            
            if grade_idx is not None:
                grade = self._get_field_value(row, grade_idx)
                if grade:
                    student.grade = str(grade).strip()
            
            if class_idx is not None:
                class_val = self._get_field_value(row, class_idx)
                if class_val:
                    student.class_name = str(class_val).strip()
            
            if school_idx is not None:
                school = self._get_field_value(row, school_idx)
                if school:
                    student.school = str(school).strip()
            
            students.append(student)
        
        return students
    
    def _parse_header(self, header_line: str) -> List[str]:
        if "," in header_line or "\"" in header_line:
            reader = csv.reader([header_line])
            for row in reader:
                return [h.strip() for h in row]
        
        if "\t" in header_line:
            return [h.strip() for h in header_line.split("\t")]
        
        return [h.strip() for h in header_line.split(",")]
    
    def _parse_row(self, row_line: str) -> List[str]:
        if "," in row_line or "\"" in row_line:
            reader = csv.reader([row_line])
            for row in reader:
                return row
        
        if "\t" in row_line:
            return row_line.split("\t")
        
        return row_line.split(",")
    
    def _find_field_index(self, headers: List[str], possible_names: List[str]) -> Optional[int]:
        headers_lower = [h.lower() for h in headers]
        possible_names_lower = [n.lower() for n in possible_names]
        
        for idx, h in enumerate(headers_lower):
            if h in possible_names_lower:
                return idx
        
        for idx, h in enumerate(headers_lower):
            for name in possible_names_lower:
                if name in h or h in name:
                    return idx
        
        return None
    
    def _get_field_value(self, row: List[str], index: int) -> Any:
        if 0 <= index < len(row):
            return row[index]
        return None


def parse_students_csv(file_path: Path) -> tuple[List[Student], List[str]]:
    parser = CSVParser()
    try:
        students = parser.parse_students(file_path)
        return students, parser.errors
    except CSVParseError as e:
        return [], [str(e)]
