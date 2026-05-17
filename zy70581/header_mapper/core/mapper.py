import pandas as pd
from fuzzywuzzy import fuzz
from typing import Dict, List, Optional, Tuple, Set
from .models import HeaderMatch, MatchType, BadRow, MappingResult
import logging

logger = logging.getLogger(__name__)


class HeaderMapper:
    def __init__(
        self,
        standard_fields: List[str],
        synonyms: Optional[Dict[str, List[str]]] = None,
        fuzzy_threshold: int = 80,
        case_sensitive: bool = False
    ):
        self.standard_fields = standard_fields
        self.synonyms = synonyms or {}
        self.fuzzy_threshold = fuzzy_threshold
        self.case_sensitive = case_sensitive
        
        self._build_synonym_lookup()
        
    def _build_synonym_lookup(self) -> None:
        self.synonym_lookup: Dict[str, str] = {}
        for standard_field, synonyms in self.synonyms.items():
            for syn in synonyms:
                key = syn if self.case_sensitive else syn.lower()
                self.synonym_lookup[key] = standard_field
    
    def _normalize(self, text: str) -> str:
        if self.case_sensitive:
            return text.strip()
        return text.strip().lower()
    
    def _match_exact(self, header: str) -> Tuple[Optional[str], float]:
        normalized = self._normalize(header)
        for field in self.standard_fields:
            if self._normalize(field) == normalized:
                return field, 1.0
        return None, 0.0
    
    def _match_synonym(self, header: str) -> Tuple[Optional[str], float]:
        normalized = self._normalize(header)
        if normalized in self.synonym_lookup:
            return self.synonym_lookup[normalized], 0.95
        return None, 0.0
    
    def _match_fuzzy(self, header: str) -> Tuple[Optional[str], float]:
        normalized = self._normalize(header)
        best_match = None
        best_score = 0
        
        for field in self.standard_fields:
            score = fuzz.ratio(normalized, self._normalize(field))
            if score >= self.fuzzy_threshold and score > best_score:
                best_score = score
                best_match = field
        
        return best_match, best_score / 100.0 if best_match else 0.0
    
    def match_header(self, header: str, index: int) -> HeaderMatch:
        match = HeaderMatch(original_header=header, original_index=index)
        
        standard_field, confidence = self._match_exact(header)
        if standard_field:
            match.standard_field = standard_field
            match.match_type = MatchType.EXACT
            match.confidence = confidence
            return match
        
        standard_field, confidence = self._match_synonym(header)
        if standard_field:
            match.standard_field = standard_field
            match.match_type = MatchType.SYNONYM
            match.confidence = confidence
            return match
        
        standard_field, confidence = self._match_fuzzy(header)
        if standard_field:
            match.standard_field = standard_field
            match.match_type = MatchType.FUZZY
            match.confidence = confidence
            return match
        
        return match
    
    def _detect_conflicts(self, matches: List[HeaderMatch]) -> None:
        field_to_headers: Dict[str, List[str]] = {}
        
        for match in matches:
            if match.standard_field:
                field_to_headers.setdefault(match.standard_field, []).append(match.original_header)
        
        for match in matches:
            if match.standard_field:
                mapped_headers = field_to_headers[match.standard_field]
                if len(mapped_headers) > 1:
                    match.conflict = True
                    match.conflict_with = [h for h in mapped_headers if h != match.original_header]
    
    def _find_bad_rows(self, df: pd.DataFrame, header_matches: List[HeaderMatch]) -> List[BadRow]:
        bad_rows: List[BadRow] = []
        
        for idx, row in df.iterrows():
            row_number = idx + 2
            
            null_count = row.isnull().sum()
            if null_count == len(row):
                bad_rows.append(BadRow(
                    row_index=row_number,
                    reason="整行为空",
                    sample_data={}
                ))
                continue
            
            if null_count > len(row) * 0.8:
                bad_rows.append(BadRow(
                    row_index=row_number,
                    reason=f"大部分列为空 ({null_count}/{len(row)})",
                    sample_data=row.dropna().head(3).to_dict()
                ))
        
        return bad_rows
    
    def map_excel(
        self,
        file_path: str,
        sheet_name: str = "Sheet1",
        header_row: int = 0
    ) -> MappingResult:
        try:
            df = pd.read_excel(
                file_path,
                sheet_name=sheet_name,
                header=header_row,
                dtype=str,
                engine="openpyxl"
            )
        except Exception as e:
            logger.error(f"读取Excel文件失败: {e}")
            raise RuntimeError(f"无法读取Excel文件: {str(e)}") from e
        
        original_headers = list(df.columns)
        header_matches = [
            self.match_header(header, idx)
            for idx, header in enumerate(original_headers)
        ]
        
        self._detect_conflicts(header_matches)
        
        bad_rows = self._find_bad_rows(df, header_matches)
        
        return MappingResult(
            file_path=file_path,
            sheet_name=sheet_name,
            total_columns=len(original_headers),
            total_rows=len(df),
            header_matches=header_matches,
            bad_rows=bad_rows
        )
