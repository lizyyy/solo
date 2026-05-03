import pandas as pd
import json
import yaml
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class PageInfo:
    archive_id: str
    page_num: int
    file_path: str
    width: int
    height: int
    rotation: int
    scan_date: str
    status: str
    tokens: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class OCRToken:
    token_id: str
    text: str
    x1: int
    y1: int
    x2: int
    y2: int
    confidence: float
    line_num: int
    archive_id: str
    page_num: int


@dataclass
class TemplateRule:
    template_name: str
    template_version: str
    page_size: Dict[str, int]
    key_fields: List[Dict[str, Any]]
    layout_checks: List[Dict[str, Any]]
    quality_settings: Dict[str, Any]


class DataLoader:
    def __init__(self):
        self.pages_df: Optional[pd.DataFrame] = None
        self.tokens_df: Optional[pd.DataFrame] = None
        self.template_rule: Optional[TemplateRule] = None
        self.pages_by_archive: Dict[str, List[PageInfo]] = {}
        self.tokens_by_page: Dict[Tuple[str, int], List[OCRToken]] = {}

    def load_batch_pages(self, file_path: str) -> pd.DataFrame:
        df = pd.read_csv(file_path)
        self.pages_df = df
        self._process_pages_data()
        return df

    def load_ocr_tokens(self, file_path: str) -> pd.DataFrame:
        tokens = []
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line:
                    tokens.append(json.loads(line))
        
        df = pd.DataFrame(tokens)
        self.tokens_df = df
        self._process_tokens_data()
        return df

    def load_template_rules(self, file_path: str) -> TemplateRule:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        rule = TemplateRule(
            template_name=data.get('template_name', 'Unknown'),
            template_version=data.get('template_version', '0.0.0'),
            page_size=data.get('page_size', {'width': 2480, 'height': 3508}),
            key_fields=data.get('key_fields', []),
            layout_checks=data.get('layout_checks', []),
            quality_settings=data.get('quality_settings', {})
        )
        
        self.template_rule = rule
        return rule

    def _process_pages_data(self):
        if self.pages_df is None:
            return
        
        self.pages_by_archive = {}
        
        for _, row in self.pages_df.iterrows():
            page_info = PageInfo(
                archive_id=row['archive_id'],
                page_num=row['page_num'],
                file_path=row['file_path'],
                width=row['width'],
                height=row['height'],
                rotation=row['rotation'],
                scan_date=row['scan_date'],
                status=row['status']
            )
            
            archive_id = row['archive_id']
            if archive_id not in self.pages_by_archive:
                self.pages_by_archive[archive_id] = []
            self.pages_by_archive[archive_id].append(page_info)
        
        for archive_id in self.pages_by_archive:
            self.pages_by_archive[archive_id].sort(key=lambda x: x.page_num)

    def _process_tokens_data(self):
        if self.tokens_df is None:
            return
        
        self.tokens_by_page = {}
        
        for _, row in self.tokens_df.iterrows():
            token = OCRToken(
                token_id=row.get('token_id', f"t_{row.name}"),
                text=str(row.get('text', '')),
                x1=int(row.get('x1', 0)),
                y1=int(row.get('y1', 0)),
                x2=int(row.get('x2', 0)),
                y2=int(row.get('y2', 0)),
                confidence=float(row.get('confidence', 0.0)),
                line_num=int(row.get('line_num', 0)),
                archive_id=row.get('archive_id', ''),
                page_num=int(row.get('page_num', 0))
            )
            
            key = (token.archive_id, token.page_num)
            if key not in self.tokens_by_page:
                self.tokens_by_page[key] = []
            self.tokens_by_page[key].append(token)
        
        for key in self.tokens_by_page:
            self.tokens_by_page[key].sort(key=lambda x: (x.line_num, x.x1))

    def get_page_info(self, archive_id: str, page_num: int) -> Optional[PageInfo]:
        if archive_id not in self.pages_by_archive:
            return None
        
        for page in self.pages_by_archive[archive_id]:
            if page.page_num == page_num:
                return page
        return None

    def get_page_tokens(self, archive_id: str, page_num: int) -> List[OCRToken]:
        key = (archive_id, page_num)
        return self.tokens_by_page.get(key, [])

    def get_all_archive_ids(self) -> List[str]:
        return list(self.pages_by_archive.keys())

    def get_archive_pages(self, archive_id: str) -> List[PageInfo]:
        return self.pages_by_archive.get(archive_id, [])

    def get_archive_page_numbers(self, archive_id: str) -> List[int]:
        pages = self.get_archive_pages(archive_id)
        return [p.page_num for p in pages]

    def is_data_loaded(self) -> bool:
        return (
            self.pages_df is not None and 
            self.tokens_df is not None and 
            self.template_rule is not None
        )

    def get_summary(self) -> Dict[str, Any]:
        summary = {
            'total_archives': len(self.pages_by_archive),
            'total_pages': len(self.pages_df) if self.pages_df is not None else 0,
            'total_tokens': len(self.tokens_df) if self.tokens_df is not None else 0,
            'template_name': self.template_rule.template_name if self.template_rule else 'N/A',
            'template_version': self.template_rule.template_version if self.template_rule else 'N/A',
            'key_fields_count': len(self.template_rule.key_fields) if self.template_rule else 0,
            'archives': {}
        }
        
        for archive_id, pages in self.pages_by_archive.items():
            summary['archives'][archive_id] = {
                'page_count': len(pages),
                'page_numbers': [p.page_num for p in pages],
                'token_count': sum(
                    len(self.get_page_tokens(archive_id, p.page_num)) for p in pages
                )
            }
        
        return summary
