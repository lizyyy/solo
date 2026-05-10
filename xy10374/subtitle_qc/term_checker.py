from typing import List, Dict
from .subtitle_parser import SubtitleItem
from .glossary_manager import GlossaryManager
from pathlib import Path


class TermChecker:
    def __init__(self, glossary_manager: GlossaryManager = None):
        self.glossary = glossary_manager or GlossaryManager()
        self.doc_terms = set()

    def load_document_terms(self, doc_path: str):
        path = Path(doc_path)
        content = ""
        if path.suffix.lower() == '.txt' or path.suffix.lower() == '.md':
            content = path.read_text(encoding='utf-8')
        elif path.suffix.lower() == '.json':
            import json
            data = json.loads(path.read_text(encoding='utf-8'))
            content = str(data)
        
        words = content.split()
        for word in words:
            word_clean = word.strip().strip('.,!?;:()[]{}""''')
            if word_clean:
                self.doc_terms.add(word_clean.lower())

    def check_terms(self, subtitles: List[SubtitleItem]) -> List[Dict]:
        issues = []
        for subtitle in subtitles:
            text = subtitle.text
            term_issues = self.glossary.check_term(text)
            for ti in term_issues:
                issues.append({
                    'type': 'term_inconsistency',
                    'subtitle_index': subtitle.index,
                    'start_time': subtitle.start_time,
                    'end_time': subtitle.end_time,
                    'original_text': subtitle.text,
                    'original_term': ti['original'],
                    'expected_term': ti['expected'],
                    'description': f'术语 "{ti["original"]}" 与标准术语 "{ti["expected"]}" 不一致',
                    'suggestion': f'将 "{ti["original"]}" 改为 "{ti["expected"]}"',
                    'case_sensitive': ti.get('case_sensitive', False)
                })
        return issues
