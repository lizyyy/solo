import csv
import json
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict, List, Optional

from freeze_gate.models import LanguageEntry, TranslationResource


class BaseParser(ABC):
    @abstractmethod
    def parse(self, file_path: Path, source_language: str) -> TranslationResource:
        pass
    
    def _flatten_json(self, data: Any, prefix: str = "") -> Dict[str, Any]:
        result: Dict[str, Any] = {}
        
        if isinstance(data, dict):
            for key, value in data.items():
                new_key = f"{prefix}.{key}" if prefix else key
                if isinstance(value, (dict, list)):
                    result.update(self._flatten_json(value, new_key))
                else:
                    result[new_key] = value
        elif isinstance(data, list):
            for i, value in enumerate(data):
                new_key = f"{prefix}[{i}]" if prefix else f"[{i}]"
                if isinstance(value, (dict, list)):
                    result.update(self._flatten_json(value, new_key))
                else:
                    result[new_key] = value
        else:
            if prefix:
                result[prefix] = data
        
        return result


class JsonParser(BaseParser):
    def parse(self, file_path: Path, source_language: str) -> TranslationResource:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return self._parse_structure(data, source_language, file_path)
    
    def _parse_structure(self, data: Any, source_language: str, file_path: Path) -> TranslationResource:
        if self._is_language_keyed(data):
            return self._parse_language_keyed(data, file_path)
        elif self._is_key_value_format(data):
            return self._parse_key_value(data, source_language, file_path)
        else:
            return self._parse_flat(data, source_language, file_path)
    
    def _is_language_keyed(self, data: Any) -> bool:
        if not isinstance(data, dict):
            return False
        
        common_languages = {'zh-CN', 'zh-TW', 'en-US', 'en-GB', 'ja-JP', 'ko-KR', 
                           'fr-FR', 'de-DE', 'es-ES', 'pt-BR', 'it-IT', 'ru-RU'}
        
        return any(key in common_languages or 
                   (len(key) == 2 and key.isalpha()) or 
                   (len(key) == 5 and key[2] == '-') 
                   for key in data.keys())
    
    def _is_key_value_format(self, data: Any) -> bool:
        if not isinstance(data, dict):
            return False
        
        for key, value in data.items():
            if isinstance(value, dict) and len(value) > 0:
                first_val = next(iter(value.values()))
                if isinstance(first_val, (str, int, float, type(None))):
                    return True
        return False
    
    def _parse_language_keyed(self, data: Dict[str, Any], file_path: Path) -> TranslationResource:
        languages = list(data.keys())
        source_language = languages[0] if languages else "unknown"
        
        all_keys: set = set()
        for lang in languages:
            flat = self._flatten_json(data[lang])
            all_keys.update(flat.keys())
        
        resource = TranslationResource(
            name=file_path.stem,
            source_language=source_language,
            target_languages=[l for l in languages if l != source_language],
            source_file=str(file_path),
            format="json",
        )
        
        for key in all_keys:
            for lang in languages:
                flat = self._flatten_json(data[lang])
                if key in flat:
                    text = str(flat[key]) if flat[key] is not None else ""
                    entry = LanguageEntry(
                        key=key,
                        language=lang,
                        text=text,
                    )
                    resource.add_entry(entry)
        
        return resource
    
    def _parse_key_value(self, data: Dict[str, Any], source_language: str, file_path: Path) -> TranslationResource:
        first_key = next(iter(data.keys()))
        first_value = data[first_key]
        
        if not isinstance(first_value, dict):
            return self._parse_flat(data, source_language, file_path)
        
        languages = list(first_value.keys())
        
        resource = TranslationResource(
            name=file_path.stem,
            source_language=source_language if source_language in languages else (languages[0] if languages else "unknown"),
            target_languages=[l for l in languages if l != source_language],
            source_file=str(file_path),
            format="json",
        )
        
        for key, translations in data.items():
            if isinstance(translations, dict):
                for lang, text in translations.items():
                    if text is not None:
                        entry = LanguageEntry(
                            key=key,
                            language=lang,
                            text=str(text),
                        )
                        resource.add_entry(entry)
        
        return resource
    
    def _parse_flat(self, data: Any, source_language: str, file_path: Path) -> TranslationResource:
        flat = self._flatten_json(data)
        
        resource = TranslationResource(
            name=file_path.stem,
            source_language=source_language,
            target_languages=[],
            source_file=str(file_path),
            format="json",
        )
        
        for key, value in flat.items():
            if value is not None:
                entry = LanguageEntry(
                    key=key,
                    language=source_language,
                    text=str(value),
                )
                resource.add_entry(entry)
        
        return resource


class CsvParser(BaseParser):
    DEFAULT_KEY_COLUMN = "key"
    DEFAULT_CONTEXT_COLUMN = "context"
    DEFAULT_NOTE_COLUMN = "note"
    
    def parse(self, file_path: Path, source_language: str) -> TranslationResource:
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
        
        if not rows:
            return TranslationResource(
                name=file_path.stem,
                source_language=source_language,
                target_languages=[],
                source_file=str(file_path),
                format="csv",
            )
        
        columns = list(rows[0].keys())
        
        key_column = self._find_key_column(columns)
        context_column = self._find_context_column(columns)
        note_column = self._find_note_column(columns)
        
        language_columns = self._find_language_columns(columns, key_column, context_column, note_column)
        
        if not language_columns:
            raise ValueError("CSV 中未找到语言列，请确保包含语言代码列（如 zh-CN, en-US 等）")
        
        actual_source = source_language if source_language in language_columns else language_columns[0]
        target_languages = [l for l in language_columns if l != actual_source]
        
        resource = TranslationResource(
            name=file_path.stem,
            source_language=actual_source,
            target_languages=target_languages,
            source_file=str(file_path),
            format="csv",
        )
        
        for row in rows:
            key = row.get(key_column, "").strip()
            if not key:
                continue
            
            context = row.get(context_column, "") if context_column else ""
            note = row.get(note_column, "") if note_column else ""
            
            for lang in language_columns:
                text = row.get(lang, "").strip()
                entry = LanguageEntry(
                    key=key,
                    language=lang,
                    text=text,
                    context=context,
                    note=note,
                )
                resource.add_entry(entry)
        
        return resource
    
    def _find_key_column(self, columns: List[str]) -> str:
        key_candidates = ['key', 'id', 'identifier', 'name', 'code', '键', 'key_name']
        for candidate in key_candidates:
            for col in columns:
                if col.lower() == candidate or col.lower() == f"{candidate}_id":
                    return col
        return columns[0] if columns else self.DEFAULT_KEY_COLUMN
    
    def _find_context_column(self, columns: List[str]) -> Optional[str]:
        context_candidates = ['context', 'description', 'comment', '说明', '上下文', '场景']
        for candidate in context_candidates:
            for col in columns:
                if col.lower() == candidate:
                    return col
        return None
    
    def _find_note_column(self, columns: List[str]) -> Optional[str]:
        note_candidates = ['note', 'notes', 'remark', '备注', '注释']
        for candidate in note_candidates:
            for col in columns:
                if col.lower() == candidate:
                    return col
        return None
    
    def _find_language_columns(self, columns: List[str], 
                                key_column: str, 
                                context_column: Optional[str],
                                note_column: Optional[str]) -> List[str]:
        excluded_columns = {key_column}
        if context_column:
            excluded_columns.add(context_column)
        if note_column:
            excluded_columns.add(note_column)
        
        common_languages = {
            'zh-CN', 'zh-TW', 'zh-HK', 'zh-SG',
            'en', 'en-US', 'en-GB', 'en-CA', 'en-AU',
            'ja', 'ja-JP',
            'ko', 'ko-KR',
            'fr', 'fr-FR', 'fr-CA',
            'de', 'de-DE',
            'es', 'es-ES', 'es-MX', 'es-AR',
            'pt', 'pt-BR', 'pt-PT',
            'it', 'it-IT',
            'ru', 'ru-RU',
            'ar', 'ar-SA',
            'th', 'th-TH',
            'vi', 'vi-VN',
            'id', 'id-ID',
            'tr', 'tr-TR',
            'pl', 'pl-PL',
            'nl', 'nl-NL',
            'sv', 'sv-SE',
            'da', 'da-DK',
            'no', 'no-NO',
            'fi', 'fi-FI',
            'cs', 'cs-CZ',
            'hu', 'hu-HU',
            'ro', 'ro-RO',
            'el', 'el-GR',
            'he', 'he-IL',
        }
        
        language_columns: List[str] = []
        
        for col in columns:
            if col in excluded_columns:
                continue
            
            col_lower = col.lower()
            col_normalized = col.replace('_', '-')
            
            if col in common_languages or col_normalized in common_languages:
                language_columns.append(col)
                continue
            
            if len(col) == 2 and col.isalpha():
                language_columns.append(col)
                continue
            
            if len(col) == 5 and col[2] == '-' and col[:2].isalpha() and col[3:].isalpha():
                language_columns.append(col)
                continue
        
        return language_columns


class ParserFactory:
    _parsers: Dict[str, BaseParser] = {}
    
    @classmethod
    def register(cls, format: str, parser: BaseParser):
        cls._parsers[format.lower()] = parser
    
    @classmethod
    def get_parser(cls, format: str) -> BaseParser:
        format_lower = format.lower()
        if format_lower not in cls._parsers:
            raise ValueError(f"不支持的格式: {format}")
        return cls._parsers[format_lower]


ParserFactory.register('json', JsonParser())
ParserFactory.register('csv', CsvParser())
