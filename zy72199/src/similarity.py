import re
from typing import List, Tuple
from difflib import SequenceMatcher
import logging

logger = logging.getLogger(__name__)


class TextSimilarityCalculator:
    def __init__(self):
        self.stopwords = {"的", "了", "和", "与", "或", "是", "在", "对", "为", "以", "及", "等", "也", "都", "就", "一个"}
        self.alias_map = {
            "深度优先搜索": "dfs",
            "dfs": "dfs",
            "广度优先搜索": "bfs",
            "bfs": "bfs",
            "动态规划": "dp",
            "dp": "dp",
            "时间复杂度": "time",
            "空间复杂度": "space",
        }

    def _normalize(self, text: str) -> str:
        text = text.lower()

        sorted_aliases = sorted(self.alias_map.keys(), key=len, reverse=True)
        for alias in sorted_aliases:
            if alias in text:
                text = text.replace(alias, f" {self.alias_map[alias]} ")

        text = re.sub(r"[，。、；：""''（）()【】\[\]\s+]", " ", text)
        text = re.sub(r"[^\w\u4e00-\u9fff\s]", " ", text)
        words = text.split()
        normalized = []
        for word in words:
            if word in self.alias_map:
                word = self.alias_map[word]
            if word not in self.stopwords and len(word) > 0:
                normalized.append(word)
        return " ".join(normalized)

    def _jaccard_similarity(self, tokens1: List[str], tokens2: List[str]) -> float:
        set1 = set(tokens1)
        set2 = set(tokens2)
        if not set1 or not set2:
            return 0.0
        intersection = len(set1 & set2)
        union = len(set1 | set2)
        return intersection / union if union > 0 else 0.0

    def _sequence_similarity(self, text1: str, text2: str) -> float:
        return SequenceMatcher(None, text1, text2).ratio()

    def calculate(self, text1: str, text2: str) -> float:
        if not text1.strip() or not text2.strip():
            return 0.0

        if text1 == text2:
            return 1.0

        norm1 = self._normalize(text1)
        norm2 = self._normalize(text2)

        if norm1 == norm2:
            return 0.98

        tokens1 = norm1.split()
        tokens2 = norm2.split()

        jaccard = self._jaccard_similarity(tokens1, tokens2)
        sequence = self._sequence_similarity(norm1, norm2)

        final_score = 0.4 * jaccard + 0.6 * sequence

        return round(final_score, 4)


class RecordComparator:
    def __init__(self, similarity_calculator: TextSimilarityCalculator = None):
        self.similarity = similarity_calculator or TextSimilarityCalculator()

    def compare(
        self,
        rec1: "EvaluationRecord",
        rec2: "EvaluationRecord",
        consider_version: bool = True,
        consider_problem: bool = True,
    ) -> Tuple[float, dict]:
        details = {}

        if consider_problem and rec1.problem_id != rec2.problem_id:
            return 0.0, {"reason": "problem_id不同", "problem_match": False}

        details["problem_match"] = True

        if consider_version and rec1.model_version != rec2.model_version:
            details["version_diff"] = f"{rec1.model_version} vs {rec2.model_version}"
            version_penalty = 0.1
        else:
            version_penalty = 0.0

        text_sim = self.similarity.calculate(rec1.model_output, rec2.model_output)
        details["text_similarity"] = text_sim

        score_diff = abs(rec1.score - rec2.score)
        details["score_diff"] = score_diff

        time_diff = abs((rec1.timestamp - rec2.timestamp).total_seconds())
        details["time_diff_seconds"] = time_diff

        final_score = text_sim - version_penalty
        final_score = max(0.0, min(1.0, final_score))

        details["final_score"] = round(final_score, 4)

        return final_score, details
