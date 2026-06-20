import os
import re
from typing import List, Dict, Optional, Tuple
import pandas as pd
import numpy as np

from .config import DEFAULT_CONFIG, STABLE_MESSAGES, AttributionConfig
from .models import QuestionRecord


class DataLoader:
    """数据加载器，处理字段映射和来源追踪"""

    def __init__(self, config: AttributionConfig = DEFAULT_CONFIG):
        self.config = config
        self.field_mapping = config.field_mapping

    def _find_column(self, df_columns: List[str], possible_names: List[str]) -> Optional[str]:
        """在DataFrame列中查找匹配的字段名"""
        for name in possible_names:
            for col in df_columns:
                if str(col).strip().lower() == name.strip().lower():
                    return col
                if str(col).strip() == name.strip():
                    return col
        return None

    def _build_column_map(self, df: pd.DataFrame) -> Dict[str, Optional[str]]:
        """构建字段映射表"""
        col_map = {}
        for field_name, possible_names in self.field_mapping.model_dump().items():
            col_map[field_name] = self._find_column(df.columns.tolist(), possible_names)
        return col_map

    def _parse_terms(self, terms_str: str) -> List[float]:
        """解析数列项字符串为数值列表，优先提取等号后的数值"""
        if not terms_str or pd.isna(terms_str):
            return []

        terms_str = str(terms_str).strip()

        patterns = [
            r'=\s*(-?\d+\.?\d*)',
            r':\s*(-?\d+\.?\d*)',
            r'(-?\d+\.?\d*)\s*[,;，；\s]+(-?\d+\.?\d*)',
        ]

        numbers = []

        for pattern in patterns:
            matches = re.findall(pattern, terms_str)
            for match in matches:
                if isinstance(match, tuple):
                    for m in match:
                        if m:
                            try:
                                numbers.append(float(m))
                            except (ValueError, TypeError):
                                continue
                else:
                    try:
                        numbers.append(float(match))
                    except (ValueError, TypeError):
                        continue
            if numbers:
                break

        if not numbers:
            simple_matches = re.findall(r'-?\d+\.?\d*', terms_str)
            for m in simple_matches:
                try:
                    num = float(m)
                    if num >= 0 or terms_str.count('-') > 0:
                        numbers.append(num)
                except (ValueError, TypeError):
                    continue

        unique_numbers = []
        seen = set()
        for n in numbers:
            key = str(n)
            if key not in seen:
                seen.add(key)
                unique_numbers.append(n)

        return unique_numbers

    def _parse_formula(self, formula_str: str) -> Tuple[str, Optional[str]]:
        """解析递推公式，返回标准化公式和分母表达式（用于除零检测）"""
        if not formula_str or pd.isna(formula_str):
            return "", None

        formula = str(formula_str).strip()

        denominator = None
        if '/' in formula:
            parts = formula.split('/', 1)
            if len(parts) == 2:
                denominator = parts[1].strip()
                if denominator.startswith('(') and denominator.endswith(')'):
                    denominator = denominator[1:-1].strip()

        return formula, denominator

    def load_file(self, file_path: str) -> List[QuestionRecord]:
        """加载题目清单文件，支持CSV和Excel格式"""
        if not os.path.exists(file_path):
            raise FileNotFoundError(
                STABLE_MESSAGES.ERROR_FILE_NOT_FOUND.format(file_path=file_path)
            )

        ext = os.path.splitext(file_path)[1].lower()
        if ext == '.csv':
            df = pd.read_csv(file_path, dtype=str)
        elif ext in ['.xlsx', '.xls']:
            df = pd.read_excel(file_path, dtype=str)
        else:
            raise ValueError(
                STABLE_MESSAGES.ERROR_INVALID_FILE_FORMAT.format(file_path=file_path)
            )

        if df.empty:
            raise ValueError(STABLE_MESSAGES.ERROR_EMPTY_DATA)

        col_map = self._build_column_map(df)
        file_name = os.path.basename(file_path)

        records = []
        for row_idx, (idx, row) in enumerate(df.iterrows()):
            record = QuestionRecord(
                source_row=row_idx + 2,
                source_file=file_name,
            )

            if col_map.get('question_id') and col_map['question_id'] in df.columns:
                record.question_id = str(row[col_map['question_id']] or "").strip()

            if col_map.get('question_source') and col_map['question_source'] in df.columns:
                record.question_source = str(row[col_map['question_source']] or "").strip()

            if col_map.get('question_content') and col_map['question_content'] in df.columns:
                record.question_content = str(row[col_map['question_content']] or "").strip()

            if col_map.get('sequence_type') and col_map['sequence_type'] in df.columns:
                record.sequence_type = str(row[col_map['sequence_type']] or "").strip()

            if col_map.get('given_terms') and col_map['given_terms'] in df.columns:
                record.given_terms = str(row[col_map['given_terms']] or "").strip()
                record.original_terms = self._parse_terms(record.given_terms)

            if col_map.get('recurrence_formula') and col_map['recurrence_formula'] in df.columns:
                formula_raw = str(row[col_map['recurrence_formula']] or "").strip()
                record.recurrence_formula, _ = self._parse_formula(formula_raw)

            if col_map.get('student_answer') and col_map['student_answer'] in df.columns:
                record.student_answer = str(row[col_map['student_answer']] or "").strip()

            if col_map.get('correct_answer') and col_map['correct_answer'] in df.columns:
                record.correct_answer = str(row[col_map['correct_answer']] or "").strip()

            if col_map.get('error_type') and col_map['error_type'] in df.columns:
                record.error_type = str(row[col_map['error_type']] or "").strip()

            record.add_log(f"数据加载完成，原始行号: {row_idx + 2}")

            if not record.question_source:
                record.question_source = "未标记来源"
                record.add_log("来源字段未找到，标记为'未标记来源'")

            records.append(record)

        return records

    def validate_records(self, records: List[QuestionRecord]) -> Tuple[List[QuestionRecord], List[str]]:
        """验证记录完整性，返回有效记录和警告信息"""
        warnings = []
        valid_records = []

        for rec in records:
            rec_warnings = []

            if not rec.question_id:
                rec.question_id = f"AUTO_{rec.source_row}"
                rec_warnings.append("题目ID自动生成")

            if not rec.given_terms and not rec.recurrence_formula:
                rec_warnings.append("缺少已知项和递推公式，归因结果可能不准确")
                rec.mark_for_review("样本不足: 缺少关键计算数据")

            if rec_warnings:
                for w in rec_warnings:
                    rec.add_log(f"警告: {w}")
                warnings.extend([f"[{rec.source_location}] {w}" for w in rec_warnings])

            valid_records.append(rec)

        return valid_records, warnings
