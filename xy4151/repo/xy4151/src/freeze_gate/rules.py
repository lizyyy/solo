from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Set, Tuple

from .models import (
    CheckIssue,
    CheckResult,
    CheckSeverity,
    CheckType,
    ProjectConfig,
    TranslationResource,
)


class RuleEngine:
    ICU_PLURAL_PATTERN = re.compile(r'\{(\w+),\s*plural,\s*(.*?)\}', re.DOTALL)
    ICU_SELECT_PATTERN = re.compile(r'\{(\w+),\s*select,\s*(.*?)\}', re.DOTALL)
    
    def __init__(self, config: ProjectConfig):
        self.config = config
        self.source_lang = config.source_language
        self.target_langs = config.target_languages
    
    def check(
        self,
        resource: TranslationResource,
        languages: Optional[List[str]] = None,
        enabled_checks: Optional[Set[CheckType]] = None,
    ) -> CheckResult:
        issues: List[CheckIssue] = []
        
        if languages is None:
            languages = [self.source_lang] + self.target_langs
        
        check_all = enabled_checks is None
        
        if check_all or CheckType.KEY_MISSING in enabled_checks or CheckType.KEY_EXTRA in enabled_checks:
            key_issues = self._check_key_integrity(resource, languages)
            issues.extend(key_issues)
        
        if check_all or CheckType.EMPTY_TRANSLATION in enabled_checks:
            empty_issues = self._check_empty_translations(resource, languages)
            issues.extend(empty_issues)
        
        if check_all or CheckType.PLACEHOLDER_MISMATCH in enabled_checks or CheckType.PLACEHOLDER_ORDER in enabled_checks:
            placeholder_issues = self._check_placeholders(resource, languages)
            issues.extend(placeholder_issues)
        
        if check_all or CheckType.ICU_PLURAL_MISMATCH in enabled_checks:
            icu_issues = self._check_icu_plurals(resource, languages)
            issues.extend(icu_issues)
        
        if check_all or CheckType.LENGTH_EXCEEDED in enabled_checks:
            length_issues = self._check_length_budgets(resource, languages)
            issues.extend(length_issues)
        
        if check_all or CheckType.FORBIDDEN_WORD in enabled_checks:
            forbidden_issues = self._check_forbidden_words(resource, languages)
            issues.extend(forbidden_issues)
        
        languages_checked = [l for l in languages if l != self.source_lang] or self.target_langs
        
        return CheckResult(
            resource_name=resource.name,
            total_keys=len(resource.get_keys()),
            languages_checked=languages_checked,
            issues=issues,
        )
    
    def _check_key_integrity(
        self,
        resource: TranslationResource,
        languages: List[str],
    ) -> List[CheckIssue]:
        issues: List[CheckIssue] = []
        
        source_keys = resource.get_language_entries(self.source_lang).keys()
        target_langs = [l for l in languages if l != self.source_lang]
        
        for target_lang in target_langs:
            target_entries = resource.get_language_entries(target_lang)
            target_keys = target_entries.keys()
            
            for key in source_keys:
                if key not in target_keys:
                    source_entry = resource.get_entry(key, self.source_lang)
                    issues.append(CheckIssue(
                        check_type=CheckType.KEY_MISSING,
                        severity=CheckSeverity.CRITICAL,
                        key=key,
                        language=target_lang,
                        message=f"目标语言缺少翻译: {key}",
                        source_text=source_entry.text if source_entry else "",
                        context=source_entry.context if source_entry else "",
                    ))
            
            for key in target_keys:
                if key not in source_keys:
                    target_entry = target_entries[key]
                    issues.append(CheckIssue(
                        check_type=CheckType.KEY_EXTRA,
                        severity=CheckSeverity.WARNING,
                        key=key,
                        language=target_lang,
                        message=f"目标语言有多余的翻译: {key}",
                        translated_text=target_entry.text,
                        context=target_entry.context,
                    ))
        
        return issues
    
    def _check_empty_translations(
        self,
        resource: TranslationResource,
        languages: List[str],
    ) -> List[CheckIssue]:
        issues: List[CheckIssue] = []
        
        target_langs = [l for l in languages if l != self.source_lang]
        
        for target_lang in target_langs:
            target_entries = resource.get_language_entries(target_lang)
            for key, entry in target_entries.items():
                if not entry.text or entry.text.strip() == "":
                    source_entry = resource.get_entry(key, self.source_lang)
                    issues.append(CheckIssue(
                        check_type=CheckType.EMPTY_TRANSLATION,
                        severity=CheckSeverity.ERROR,
                        key=key,
                        language=target_lang,
                        message=f"翻译为空字符串",
                        source_text=source_entry.text if source_entry else "",
                        context=entry.context,
                    ))
        
        return issues
    
    def _check_placeholders(
        self,
        resource: TranslationResource,
        languages: List[str],
    ) -> List[CheckIssue]:
        issues: List[CheckIssue] = []
        
        target_langs = [l for l in languages if l != self.source_lang]
        
        for target_lang in target_langs:
            target_entries = resource.get_language_entries(target_lang)
            for key, target_entry in target_entries.items():
                source_entry = resource.get_entry(key, self.source_lang)
                if not source_entry:
                    continue
                
                for rule in self.config.placeholder_rules:
                    source_placeholders = rule.extract(source_entry.text)
                    target_placeholders = rule.extract(target_entry.text)
                    
                    result = rule.validate(source_placeholders, target_placeholders)
                    
                    if not result["valid"]:
                        check_type = CheckType.PLACEHOLDER_ORDER if "order" in str(result["issues"]).lower() else CheckType.PLACEHOLDER_MISMATCH
                        
                        issues.append(CheckIssue(
                            check_type=check_type,
                            severity=CheckSeverity.ERROR,
                            key=key,
                            language=target_lang,
                            message=f"占位符规则不匹配: {'; '.join(result['issues'])}",
                            source_text=source_entry.text,
                            translated_text=target_entry.text,
                            context=target_entry.context,
                            metadata={
                                "rule_pattern": rule.pattern,
                                "source_placeholders": source_placeholders,
                                "target_placeholders": target_placeholders,
                            },
                        ))
        
        return issues
    
    def _check_icu_plurals(
        self,
        resource: TranslationResource,
        languages: List[str],
    ) -> List[CheckIssue]:
        issues: List[CheckIssue] = []
        
        plural_forms: Dict[str, Set[str]] = {
            'en-US': {'zero', 'one', 'two', 'few', 'many', 'other'},
            'zh-CN': {'other'},
            'ja-JP': {'other'},
            'ko-KR': {'other'},
            'de-DE': {'one', 'other'},
            'fr-FR': {'one', 'other'},
            'es-ES': {'one', 'other'},
            'pt-BR': {'one', 'other'},
            'ru-RU': {'one', 'few', 'many', 'other'},
            'ar-SA': {'zero', 'one', 'two', 'few', 'many', 'other'},
        }
        
        target_langs = [l for l in languages if l != self.source_lang]
        
        for target_lang in target_langs:
            target_entries = resource.get_language_entries(target_lang)
            for key, target_entry in target_entries.items():
                source_entry = resource.get_entry(key, self.source_lang)
                if not source_entry:
                    continue
                
                source_plurals = self._extract_icu_plural_forms(source_entry.text)
                target_plurals = self._extract_icu_plural_forms(target_entry.text)
                
                for var_name, source_forms in source_plurals.items():
                    if var_name not in target_plurals:
                        issues.append(CheckIssue(
                            check_type=CheckType.ICU_PLURAL_MISMATCH,
                            severity=CheckSeverity.ERROR,
                            key=key,
                            language=target_lang,
                            message=f"ICU 复数变量 '{var_name}' 在译文中缺失",
                            source_text=source_entry.text,
                            translated_text=target_entry.text,
                            context=target_entry.context,
                        ))
                        continue
                    
                    target_forms = target_plurals[var_name]
                    
                    valid_forms = plural_forms.get(target_lang, {'other'})
                    
                    for form in target_forms:
                        if form not in valid_forms and form != 'other':
                            issues.append(CheckIssue(
                                check_type=CheckType.ICU_PLURAL_MISMATCH,
                                severity=CheckSeverity.WARNING,
                                key=key,
                                language=target_lang,
                                message=f"ICU 复数形式 '{form}' 对语言 {target_lang} 可能无效",
                                source_text=source_entry.text,
                                translated_text=target_entry.text,
                                context=target_entry.context,
                                suggestion=f"该语言有效的复数形式: {', '.join(valid_forms)}",
                            ))
                    
                    if 'other' not in target_forms:
                        issues.append(CheckIssue(
                            check_type=CheckType.ICU_PLURAL_MISMATCH,
                            severity=CheckSeverity.ERROR,
                            key=key,
                            language=target_lang,
                            message=f"ICU 复数缺少必需的 'other' 形式",
                            source_text=source_entry.text,
                            translated_text=target_entry.text,
                            context=target_entry.context,
                        ))
        
        return issues
    
    def _extract_icu_plural_forms(self, text: str) -> Dict[str, Set[str]]:
        result: Dict[str, Set[str]] = {}
        
        for match in self.ICU_PLURAL_PATTERN.finditer(text):
            var_name = match.group(1)
            content = match.group(2)
            
            forms = set()
            form_pattern = re.compile(r'(\w+)\s*\{([^}]*)\}')
            
            for form_match in form_pattern.finditer(content):
                forms.add(form_match.group(1))
            
            result[var_name] = forms
        
        for match in self.ICU_SELECT_PATTERN.finditer(text):
            var_name = match.group(1)
            content = match.group(2)
            
            forms = set()
            form_pattern = re.compile(r'(\w+)\s*\{([^}]*)\}')
            
            for form_match in form_pattern.finditer(content):
                forms.add(form_match.group(1))
            
            result[var_name] = forms
        
        return result
    
    def _check_length_budgets(
        self,
        resource: TranslationResource,
        languages: List[str],
    ) -> List[CheckIssue]:
        issues: List[CheckIssue] = []
        
        target_langs = [l for l in languages if l != self.source_lang]
        
        for target_lang in target_langs:
            target_entries = resource.get_language_entries(target_lang)
            budget = self.config.length_budgets.get(target_lang)
            
            for key, target_entry in target_entries.items():
                source_entry = resource.get_entry(key, self.source_lang)
                
                text = target_entry.text
                char_count = len(text)
                
                max_length = None
                ratio_to_source = 1.0
                
                if budget:
                    max_length = budget.max_length
                    ratio_to_source = budget.ratio_to_source
                
                if source_entry:
                    source_length = len(source_entry.text)
                    max_from_ratio = int(source_length * ratio_to_source)
                    
                    if max_length is None or max_from_ratio < max_length:
                        effective_max = max_from_ratio
                    else:
                        effective_max = max_length
                    
                    if char_count > effective_max:
                        issues.append(CheckIssue(
                            check_type=CheckType.LENGTH_EXCEEDED,
                            severity=CheckSeverity.WARNING,
                            key=key,
                            language=target_lang,
                            message=f"文本长度超出预算: {char_count} 字符 (限制: {effective_max})",
                            source_text=source_entry.text,
                            translated_text=target_entry.text,
                            context=target_entry.context,
                            metadata={
                                "source_length": source_length,
                                "target_length": char_count,
                                "max_length": effective_max,
                                "ratio_used": ratio_to_source,
                            },
                        ))
                elif max_length and char_count > max_length:
                    issues.append(CheckIssue(
                        check_type=CheckType.LENGTH_EXCEEDED,
                        severity=CheckSeverity.WARNING,
                        key=key,
                        language=target_lang,
                        message=f"文本长度超出预算: {char_count} 字符 (限制: {max_length})",
                        translated_text=target_entry.text,
                        context=target_entry.context,
                        metadata={
                            "target_length": char_count,
                            "max_length": max_length,
                        },
                    ))
        
        return issues
    
    def _check_forbidden_words(
        self,
        resource: TranslationResource,
        languages: List[str],
    ) -> List[CheckIssue]:
        issues: List[CheckIssue] = []
        
        for rule in self.config.forbidden_words:
            affected_langs = [l for l in languages if l in rule.languages]
            
            for target_lang in affected_langs:
                target_entries = resource.get_language_entries(target_lang)
                for key, target_entry in target_entries.items():
                    if rule.word.lower() in target_entry.text.lower():
                        issues.append(CheckIssue(
                            check_type=CheckType.FORBIDDEN_WORD,
                            severity=rule.severity,
                            key=key,
                            language=target_lang,
                            message=f"发现禁用词 '{rule.word}': {rule.reason}",
                            translated_text=target_entry.text,
                            context=target_entry.context,
                        ))
        
        return issues
