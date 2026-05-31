import re
import math
from typing import Tuple, Dict, List, Set
from Levenshtein import ratio
from .config import THRESHOLD, EMPTY_SET_THRESHOLD

class EquivalentScorer:
    def __init__(self, threshold: float = None, empty_set_threshold: float = None):
        self.threshold = threshold or THRESHOLD
        self.empty_set_threshold = empty_set_threshold or EMPTY_SET_THRESHOLD
        
    def _tokenize(self, text: str) -> Set[str]:
        text = text.lower().strip()
        text = re.sub(r'[^\w\s\u4e00-\u9fff]', ' ', text)
        tokens = set(re.split(r'\s+', text))
        tokens.discard('')
        return tokens
    
    def _extract_math_expressions(self, text: str) -> List[str]:
        patterns = [
            r'\d+\.?\d*',
            r'[a-zA-Z_][a-zA-Z0-9_]*',
            r'[+\-*/=<>≤≥≠≈]',
            r'[\[\]\{\}\(\)]',
        ]
        expressions = []
        for pattern in patterns:
            expressions.extend(re.findall(pattern, text))
        return expressions
    
    def _jaccard_similarity(self, set1: Set[str], set2: Set[str]) -> float:
        if not set1 and not set2:
            return 1.0
        if not set1 or not set2:
            return 0.0
        intersection = len(set1 & set2)
        union = len(set1 | set2)
        return intersection / union if union > 0 else 0.0
    
    def _calculate_structural_score(self, standard: str, student: str) -> float:
        std_tokens = self._tokenize(standard)
        stu_tokens = self._tokenize(student)
        
        std_math = set(self._extract_math_expressions(standard))
        stu_math = set(self._extract_math_expressions(student))
        
        key_numbers_std = {t for t in std_math if re.match(r'^\d+\.?\d*$', t)}
        key_numbers_stu = {t for t in stu_math if re.match(r'^\d+\.?\d*$', t)}
        
        number_score = self._jaccard_similarity(key_numbers_std, key_numbers_stu)
        math_score = self._jaccard_similarity(std_math, stu_math)
        token_score = self._jaccard_similarity(std_tokens, stu_tokens)
        
        weights = [0.4, 0.35, 0.25]
        scores = [number_score, math_score, token_score]
        structural_score = sum(w * s for w, s in zip(weights, scores))
        
        return structural_score
    
    def _is_empty_answer(self, answer: str) -> bool:
        if not answer:
            return True
        cleaned = re.sub(r'[\s\W_]', '', answer)
        return len(cleaned) == 0
    
    def _check_controversial(self, similarity: float, standard: str, student: str) -> Tuple[bool, str]:
        is_empty_std = self._is_empty_answer(standard)
        is_empty_stu = self._is_empty_answer(student)
        
        if is_empty_std and is_empty_stu:
            return True, "【空集边界】标准答案和学生答案均为空，需人工确认题意理解"
        if is_empty_std or is_empty_stu:
            return True, "【空集边界】一方为空答案，需确认是空白还是特殊表示"
        
        gray_zone_lower = self.threshold - 0.1
        gray_zone_upper = self.threshold + 0.05
        
        if gray_zone_lower <= similarity <= gray_zone_upper:
            return True, f"【灰色区域】相似度{similarity:.2f}在阈值附近({self.threshold})，需人工复核"
        
        std_tokens = self._tokenize(standard)
        stu_tokens = self._tokenize(student)
        
        if len(std_tokens) >= 5 and len(stu_tokens) >= 5:
            key_overlap = self._jaccard_similarity(std_tokens, stu_tokens)
            if key_overlap < 0.3 and similarity > self.threshold:
                return True, "【关键词冲突】整体相似度达标但关键词重合度低，需检查是否偷换概念"
        
        return False, ""
    
    def _generate_scoring_reason(self, similarity: float, standard: str, 
                                  student: str, is_equivalent: bool) -> str:
        reasons = []
        
        std_len = len(standard.strip())
        stu_len = len(student.strip())
        
        if std_len == 0 or stu_len == 0:
            len_ratio = 0.0
        else:
            len_ratio = min(std_len, stu_len) / max(std_len, stu_len)
        
        if len_ratio > 0.7:
            reasons.append(f"长度匹配度{len_ratio:.0%}")
        else:
            reasons.append(f"长度差异较大({std_len} vs {stu_len})")
        
        std_math = set(self._extract_math_expressions(standard))
        stu_math = set(self._extract_math_expressions(student))
        
        if std_math and stu_math:
            math_overlap = self._jaccard_similarity(std_math, stu_math)
            if math_overlap > 0.8:
                reasons.append(f"数学表达式高度一致({math_overlap:.0%})")
            elif math_overlap > 0.5:
                reasons.append(f"数学表达式部分一致({math_overlap:.0%})")
            else:
                reasons.append(f"数学表达式差异较大({math_overlap:.0%})")
        
        edit_ratio = ratio(standard.lower(), student.lower())
        reasons.append(f"编辑相似度{edit_ratio:.0%}")
        
        if is_equivalent:
            conclusion = "判定为等价答案"
        else:
            conclusion = "判定为非等价答案"
        
        return f"综合相似度{similarity:.2f}（阈值{self.threshold}）| " + " | ".join(reasons) + " | " + conclusion
    
    def score(self, standard_answer: str, student_answer: str, 
              question_id: str = "", student_id: str = "") -> Dict:
        standard = standard_answer.strip()
        student = student_answer.strip()
        
        is_empty_std = self._is_empty_answer(standard)
        is_empty_stu = self._is_empty_answer(student)
        
        if is_empty_std and is_empty_stu:
            similarity = 1.0
            is_equivalent = similarity >= self.empty_set_threshold
        elif is_empty_std or is_empty_stu:
            similarity = 0.0
            is_equivalent = False
        else:
            structural_score = self._calculate_structural_score(standard, student)
            edit_score = ratio(standard.lower(), student.lower())
            token_score = self._jaccard_similarity(
                self._tokenize(standard), 
                self._tokenize(student)
            )
            
            weights = [0.5, 0.3, 0.2]
            similarity = (
                weights[0] * structural_score + 
                weights[1] * edit_score + 
                weights[2] * token_score
            )
            
            is_equivalent = similarity >= self.threshold
        
        is_controversial, controversial_reason = self._check_controversial(
            similarity, standard, student
        )
        
        scoring_reason = self._generate_scoring_reason(
            similarity, standard, student, is_equivalent
        )
        
        return {
            "question_id": question_id,
            "student_id": student_id,
            "standard_answer": standard,
            "student_answer": student,
            "similarity_score": round(similarity, 4),
            "is_equivalent": is_equivalent,
            "threshold": self.threshold,
            "scoring_reason": scoring_reason,
            "is_controversial": is_controversial,
            "controversial_reason": controversial_reason,
            "is_empty_std": is_empty_std,
            "is_empty_stu": is_empty_stu
        }
    
    def batch_score(self, records: List[Dict]) -> List[Dict]:
        results = []
        for record in records:
            result = self.score(
                standard_answer=record.get("standard_answer", ""),
                student_answer=record.get("student_answer", ""),
                question_id=record.get("question_id", ""),
                student_id=record.get("student_id", "")
            )
            results.append(result)
        return results
