from typing import Dict, Set, List, Any
from dataclasses import dataclass
from .placeholder_extractor import PlaceholderExtractor

@dataclass
class MismatchIssue:
    key: str
    source_language: str
    target_language: str
    source_placeholders: Set[str]
    target_placeholders: Set[str]
    missing_in_target: Set[str]
    extra_in_target: Set[str]
    source_text: str = ""
    target_text: str = ""
    
    @property
    def severity(self) -> str:
        if self.missing_in_target:
            return "critical"
        if self.extra_in_target:
            return "warning"
        return "info"

class CrossLanguageComparator:
    def __init__(self, extractor: PlaceholderExtractor = None):
        self.extractor = extractor or PlaceholderExtractor()
    
    def compare(
        self,
        source_translations: Dict[str, Any],
        target_translations: Dict[str, Any],
        source_lang: str,
        target_lang: str
    ) -> List[MismatchIssue]:
        issues = []
        source_placeholders = self.extractor.extract_all(source_translations)
        target_placeholders = self.extractor.extract_all(target_translations)
        
        all_keys = set(source_placeholders.keys()) | set(target_placeholders.keys())
        
        for key in all_keys:
            src_ph = source_placeholders.get(key, set())
            tgt_ph = target_placeholders.get(key, set())
            
            if src_ph != tgt_ph:
                missing = src_ph - tgt_ph
                extra = tgt_ph - src_ph
                
                issue = MismatchIssue(
                    key=key,
                    source_language=source_lang,
                    target_language=target_lang,
                    source_placeholders=src_ph,
                    target_placeholders=tgt_ph,
                    missing_in_target=missing,
                    extra_in_target=extra,
                    source_text=self._get_value_by_path(source_translations, key),
                    target_text=self._get_value_by_path(target_translations, key)
                )
                issues.append(issue)
        
        return issues
    
    def compare_multiple(
        self,
        translations_by_lang: Dict[str, Dict[str, Any]],
        reference_lang: str = None
    ) -> Dict[str, List[MismatchIssue]]:
        if reference_lang is None:
            reference_lang = next(iter(translations_by_lang.keys()))
        
        reference_trans = translations_by_lang[reference_lang]
        results = {}
        
        for lang, translations in translations_by_lang.items():
            if lang != reference_lang:
                issues = self.compare(
                    reference_trans,
                    translations,
                    reference_lang,
                    lang
                )
                results[lang] = issues
        
        return results
    
    def _get_value_by_path(self, data: Dict[str, Any], path: str) -> str:
        parts = path.split('.')
        current = data
        try:
            for part in parts:
                if '[' in part:
                    key, idx = part[:-1].split('[')
                    current = current[key][int(idx)]
                else:
                    current = current[part]
            return str(current) if isinstance(current, str) else ""
        except (KeyError, IndexError, TypeError):
            return ""
