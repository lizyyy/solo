"""BibTeX 文件解析器

使用 bibtexparser 库解析 BibTeX 文件。
"""

from typing import List, Optional, Dict
import os

try:
    import bibtexparser
    from bibtexparser.bparser import BibTexParser
    from bibtexparser.customization import convert_to_unicode
    HAS_BIBTEXPARSER = True
except ImportError:
    HAS_BIBTEXPARSER = False

from ..models import ReferenceEntry, ReferenceType


ENTRY_TYPE_MAP: Dict[str, ReferenceType] = {
    'article': ReferenceType.ARTICLE,
    'inproceedings': ReferenceType.INPROCEEDINGS,
    'conference': ReferenceType.INPROCEEDINGS,
    'book': ReferenceType.BOOK,
    'incollection': ReferenceType.INCOLLECTION,
    'inbook': ReferenceType.INCOLLECTION,
    'phdthesis': ReferenceType.PHDTHESIS,
    'mastersthesis': ReferenceType.MASTERSTHESIS,
    'techreport': ReferenceType.TECHREPORT,
    'unpublished': ReferenceType.UNPUBLISHED,
    'misc': ReferenceType.MISC,
    'manual': ReferenceType.MISC,
    'online': ReferenceType.MISC,
    'electronic': ReferenceType.MISC,
}


class BibtexParseError(Exception):
    """BibTeX 解析错误"""
    pass


class BibtexParser:
    """BibTeX 文件解析器"""
    
    def _parse_entry_type(self, bib_type: str) -> ReferenceType:
        bib_type_lower = bib_type.lower()
        return ENTRY_TYPE_MAP.get(bib_type_lower, ReferenceType.MISC)
    
    def _create_entry(self, bib_entry: Dict, source_file: str) -> ReferenceEntry:
        entry_type = bib_entry.get('ENTRYTYPE', 'misc')
        key = bib_entry.get('ID', '')
        
        entry = ReferenceEntry(
            key=key,
            entry_type=self._parse_entry_type(entry_type),
            source_file=source_file,
            source_format='bibtex',
            raw_fields=bib_entry.copy()
        )
        
        field_mapping = {
            'title': 'title',
            'author': 'author',
            'year': 'year',
            'doi': 'doi',
            'journal': 'journal',
            'journaltitle': 'journal',
            'booktitle': 'booktitle',
            'publisher': 'publisher',
            'volume': 'volume',
            'pages': 'pages',
            'url': 'url',
            'abstract': 'abstract',
        }
        
        for bib_field, attr_name in field_mapping.items():
            if bib_field in bib_entry:
                value = bib_entry[bib_field]
                if isinstance(value, str):
                    value = value.strip()
                    value = value.replace('{', '').replace('}', '')
                setattr(entry, attr_name, value)
        
        return entry
    
    def parse(self, content: str, source_file: str = "<bibtex>") -> List[ReferenceEntry]:
        if not HAS_BIBTEXPARSER:
            raise ImportError(
                "bibtexparser 库未安装，请运行: pip install bibtexparser"
            )
        
        entries = []
        
        if not content or not content.strip():
            return entries
        
        try:
            parser = BibTexParser()
            parser.customization = convert_to_unicode
            parser.ignore_nonstandard_types = False
            
            bib_database = bibtexparser.loads(content, parser=parser)
            
            for bib_entry in bib_database.entries:
                try:
                    entry = self._create_entry(bib_entry, source_file)
                    if entry.key:
                        entries.append(entry)
                except Exception as e:
                    raise BibtexParseError(
                        f"解析条目失败: {str(e)}"
                    )
        
        except Exception as e:
            if "syntax error" in str(e).lower() or "unexpected" in str(e).lower():
                raise BibtexParseError(
                    f"BibTeX 语法错误: {str(e)}. "
                    f"请检查文件是否有未闭合的大括号或语法问题。"
                )
            raise BibtexParseError(f"解析 BibTeX 失败: {str(e)}")
        
        return entries
    
    def parse_file(self, filepath: str) -> List[ReferenceEntry]:
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"BibTeX 文件不存在: {filepath}")
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
        except UnicodeDecodeError:
            try:
                with open(filepath, 'r', encoding='latin-1') as f:
                    content = f.read()
            except Exception:
                raise ValueError(f"无法读取文件编码: {filepath}")
        
        return self.parse(content, filepath)
