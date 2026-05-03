"""RIS 文件解析器

RIS (Research Information Systems) 格式是 EndNote 等文献管理软件常用的格式。
每个条目以 TY 开始，以 ER 结束。
"""

import re
import os
from typing import List, Optional, Dict
from ..models import ReferenceEntry, ReferenceType


RIS_TYPE_MAP: Dict[str, ReferenceType] = {
    'JOUR': ReferenceType.ARTICLE,
    'JFULL': ReferenceType.ARTICLE,
    'ABST': ReferenceType.ARTICLE,
    'BOOK': ReferenceType.BOOK,
    'CHAP': ReferenceType.INCOLLECTION,
    'CONF': ReferenceType.INPROCEEDINGS,
    'CPAPER': ReferenceType.INPROCEEDINGS,
    'THES': ReferenceType.PHDTHESIS,
    'RPRT': ReferenceType.TECHREPORT,
    'UNPB': ReferenceType.UNPUBLISHED,
    'ELEC': ReferenceType.MISC,
    'GEN': ReferenceType.MISC,
    'DATA': ReferenceType.MISC,
}


class RisParseError(Exception):
    """RIS 解析错误"""
    pass


class RisParser:
    """RIS 文件解析器"""
    
    TAG_PATTERN = re.compile(r'^([A-Z][A-Z0-9])\s*-\s*(.*)$', re.MULTILINE)
    
    def _parse_ris_type(self, ris_type: str) -> ReferenceType:
        ris_type_upper = ris_type.upper()
        return RIS_TYPE_MAP.get(ris_type_upper, ReferenceType.MISC)
    
    def _extract_entries(self, content: str) -> List[List[tuple]]:
        raw_entries = []
        current_tags = []
        
        lines = content.split('\n')
        for line in lines:
            line = line.rstrip()
            if not line:
                continue
            
            match = self.TAG_PATTERN.match(line)
            if match:
                tag = match.group(1)
                value = match.group(2).strip()
                
                if tag == 'TY':
                    if current_tags:
                        raw_entries.append(current_tags)
                    current_tags = [(tag, value)]
                elif tag == 'ER':
                    if current_tags:
                        raw_entries.append(current_tags)
                    current_tags = []
                else:
                    if current_tags:
                        current_tags.append((tag, value))
            else:
                if current_tags:
                    last_tag, last_value = current_tags[-1]
                    current_tags[-1] = (last_tag, last_value + ' ' + line.strip())
        
        if current_tags:
            raw_entries.append(current_tags)
        
        return raw_entries
    
    def _tags_to_dict(self, tags: List[tuple]) -> Dict:
        result = {}
        for tag, value in tags:
            if tag in result:
                if isinstance(result[tag], list):
                    result[tag].append(value)
                else:
                    result[tag] = [result[tag], value]
            else:
                result[tag] = value
        return result
    
    def _create_entry(self, tags_dict: Dict, source_file: str) -> ReferenceEntry:
        ris_type = tags_dict.get('TY', 'GEN')
        entry_type = self._parse_ris_type(ris_type)
        
        authors = []
        au_values = tags_dict.get('AU', [])
        if not isinstance(au_values, list):
            au_values = [au_values]
        for au in au_values:
            if au:
                authors.append(au)
        
        author_str = ' and '.join(authors) if authors else None
        
        key_parts = []
        if authors:
            first_author = authors[0]
            if ',' in first_author:
                lastname = first_author.split(',')[0].strip()
            else:
                parts = first_author.split()
                lastname = parts[-1] if parts else first_author
            key_parts.append(lastname.lower())
        
        year = tags_dict.get('PY', '').strip()
        if year:
            year_match = re.match(r'(\d{4})', year)
            if year_match:
                year = year_match.group(1)
                key_parts.append(year)
        
        if not key_parts:
            key_parts.append('ref')
        
        base_key = ''.join(key_parts)
        key = base_key
        
        title = tags_dict.get('TI', tags_dict.get('T1', ''))
        if isinstance(title, list):
            title = title[0] if title else ''
        title = title.strip() if title else None
        
        doi = tags_dict.get('DO', tags_dict.get('DOI', ''))
        if isinstance(doi, list):
            doi = doi[0] if doi else ''
        doi = doi.strip() if doi else None
        
        journal = tags_dict.get('JO', tags_dict.get('JF', tags_dict.get('JA', '')))
        if isinstance(journal, list):
            journal = journal[0] if journal else ''
        journal = journal.strip() if journal else None
        
        booktitle = tags_dict.get('BT', tags_dict.get('T2', ''))
        if isinstance(booktitle, list):
            booktitle = booktitle[0] if booktitle else ''
        booktitle = booktitle.strip() if booktitle else None
        
        publisher = tags_dict.get('PB', '')
        if isinstance(publisher, list):
            publisher = publisher[0] if publisher else ''
        publisher = publisher.strip() if publisher else None
        
        volume = tags_dict.get('VL', '')
        if isinstance(volume, list):
            volume = volume[0] if volume else ''
        volume = volume.strip() if volume else None
        
        pages = tags_dict.get('SP', '')
        ep = tags_dict.get('EP', '')
        if pages and ep:
            pages = f"{pages}-{ep}"
        if isinstance(pages, list):
            pages = pages[0] if pages else ''
        pages = pages.strip() if pages else None
        
        url = tags_dict.get('UR', tags_dict.get('URL', ''))
        if isinstance(url, list):
            url = url[0] if url else ''
        url = url.strip() if url else None
        
        abstract = tags_dict.get('AB', tags_dict.get('N2', ''))
        if isinstance(abstract, list):
            abstract = abstract[0] if abstract else ''
        abstract = abstract.strip() if abstract else None
        
        entry = ReferenceEntry(
            key=key,
            entry_type=entry_type,
            source_file=source_file,
            source_format='ris',
            title=title,
            author=author_str,
            year=year if year else None,
            doi=doi,
            journal=journal,
            booktitle=booktitle,
            publisher=publisher,
            volume=volume,
            pages=pages,
            url=url,
            abstract=abstract,
            raw_fields=tags_dict.copy()
        )
        
        return entry
    
    def parse(self, content: str, source_file: str = "<ris>") -> List[ReferenceEntry]:
        entries = []
        
        if not content or not content.strip():
            return entries
        
        try:
            raw_entries = self._extract_entries(content)
            
            for raw_tags in raw_entries:
                tags_dict = self._tags_to_dict(raw_tags)
                
                try:
                    entry = self._create_entry(tags_dict, source_file)
                    entries.append(entry)
                except Exception as e:
                    raise RisParseError(f"创建条目失败: {str(e)}")
        
        except Exception as e:
            if isinstance(e, RisParseError):
                raise
            raise RisParseError(f"解析 RIS 失败: {str(e)}")
        
        return entries
    
    def parse_file(self, filepath: str) -> List[ReferenceEntry]:
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"RIS 文件不存在: {filepath}")
        
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
