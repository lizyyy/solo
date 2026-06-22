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

    def _parse_single_number(self, token: str) -> Optional[float]:
        """解析单个数值 token，支持分数 1/3、-2/5、小数、整数"""
        if not token:
            return None
        token = token.strip()
        if not token:
            return None
        m = re.fullmatch(r'(-?\d+)\s*/\s*(-?\d+)', token)
        if m:
            num, den = m.group(1), m.group(2)
            try:
                n = float(num)
                d = float(den)
                if abs(d) < 1e-20:
                    return None
                return n / d
            except (ValueError, ZeroDivisionError):
                return None
        try:
            return float(token)
        except (ValueError, TypeError):
            return None

    def _parse_terms(self, terms_str: str) -> List[float]:
        """解析数列项字符串为数值列表，优先提取等号后的数值，支持分数"""
        if not terms_str or pd.isna(terms_str):
            return []

        terms_str = str(terms_str).strip()
        numbers = []

        eq_pattern = r'[=:：]\s*([^,;，；]+)'
        for m in re.finditer(eq_pattern, terms_str):
            val_str = m.group(1).strip()
            if val_str:
                val = self._parse_single_number(val_str)
                if val is not None:
                    numbers.append(val)
        if numbers:
            return numbers

        tokens = re.split(r'[,;，；\s]+', terms_str)
        for tok in tokens:
            if not tok:
                continue
            tok_clean = tok.strip()
            if re.search(r'[=:：]', tok_clean):
                sub_parts = re.split(r'[=:：]', tok_clean, maxsplit=1)
                if len(sub_parts) == 2:
                    val = self._parse_single_number(sub_parts[1].strip())
                    if val is not None:
                        numbers.append(val)
                    continue
            val = self._parse_single_number(tok_clean)
            if val is not None:
                numbers.append(val)

        return numbers

    def _dedupe_preserve_order(self, nums: List[float]) -> List[float]:
        seen = set()
        out = []
        for n in nums:
            key = repr(n)
            if key not in seen:
                seen.add(key)
                out.append(n)
        return out

    def _extract_rhs_expression(self, formula: str) -> str:
        """从完整递推等式中拆出右侧表达式。支持 a(n+1)=... 或 a_{n+1}=... 等格式。如果本身就是右侧表达式则原样返回。"""
        if not formula:
            return ""
        s = formula.strip()
        m = re.search(r'=(.*)', s, re.DOTALL)
        if m:
            return m.group(1).strip()
        return s

    def _normalize_variable_notation(self, expr: str) -> str:
        """把 a(n), a_n, a_{n}, a_{n+1}, a(n+1), an 等统一替换为内部变量 PREV。
        注意匹配必须有闭合括号或花括号，避免误吃表达式后面的常数项。
        """
        if not expr:
            return ""
        s = expr
        s = re.sub(r'a\s*\(\s*n\s*(?:\+\s*\d+)?\s*\)', 'PREV', s)
        s = re.sub(r'a\s*_\s*\{\s*n\s*(?:\+\s*\d+)?\s*\}', 'PREV', s)
        s = re.sub(r'a\s*_\s*n(?![A-Za-z0-9_{])', 'PREV', s)
        s = re.sub(r'\ban\b', 'PREV', s)
        return s

    def _parse_denominator(self, expr: str) -> Optional[str]:
        """从表达式中提取最外层分数的分母表达式（用于除零预检查）。例如 '(a(n)+1)/(a(n)-1)' → 'a(n)-1'。"""
        if not expr:
            return None
        depth = 0
        slash_idx = -1
        for i, ch in enumerate(expr):
            if ch == '(':
                depth += 1
            elif ch == ')':
                depth -= 1
            elif ch == '/' and depth == 0:
                slash_idx = i
                break
        if slash_idx < 0:
            return None
        denom = expr[slash_idx + 1:].strip()
        if denom.startswith('('):
            depth2 = 0
            end = -1
            for i, ch in enumerate(denom):
                if ch == '(':
                    depth2 += 1
                elif ch == ')':
                    depth2 -= 1
                    if depth2 == 0:
                        end = i
                        break
            if end > 0:
                return denom[1:end].strip()
        return denom

    def _parse_formula(self, formula_str: str) -> Tuple[str, Optional[str]]:
        """解析递推公式：保持原始完整公式字符串，仅额外提取分母表达式（用于除零检测）。
        完整公式形如 "a(n+1)=2*a(n)+1"，归因阶段会自行拆出右侧表达式。
        返回: (完整原始公式字符串, 分母表达式或None)
        """
        if not formula_str or pd.isna(formula_str):
            return "", None

        formula_raw = str(formula_str).strip()
        rhs = self._extract_rhs_expression(formula_raw)
        denominator = self._parse_denominator(rhs) if rhs else None
        return formula_raw, denominator

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
