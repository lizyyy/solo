import json
from pathlib import Path
from typing import Dict, List, Set, Tuple
from .database import Database


class GlossaryManager:
    def __init__(self, db: Database = None):
        self.db = db or Database()
        self.terms = {}
        self._load_terms()

    def _load_terms(self):
        db_terms = self.db.get_glossary_terms()
        for term in db_terms:
            self._add_term_to_cache(term)

    def _add_term_to_cache(self, term_data: Dict):
        term = term_data['term']
        canonical = term_data['canonical_form']
        case_sensitive = term_data.get('case_sensitive', False)
        synonyms = term_data.get('synonyms', []) or []

        if case_sensitive:
            self.terms[term] = {
                'canonical': canonical,
                'case_sensitive': True
            }
            for syn in synonyms:
                self.terms[syn] = {
                    'canonical': canonical,
                    'case_sensitive': True
                }
        else:
            term_lower = term.lower()
            self.terms[term_lower] = {
                'canonical': canonical,
                'case_sensitive': False
            }
            for syn in synonyms:
                syn_lower = syn.lower()
                self.terms[syn_lower] = {
                    'canonical': canonical,
                    'case_sensitive': False
                }

    def add_term(self, term: str, canonical_form: str, synonyms: List[str] = None, case_sensitive: bool = False):
        self.db.save_glossary_term(term, canonical_form, synonyms, case_sensitive)
        term_data = {
            'term': term,
            'canonical_form': canonical_form,
            'canonical': canonical_form,
            'case_sensitive': case_sensitive,
            'synonyms': synonyms or []
        }
        self._add_term_to_cache(term_data)

    def load_from_file(self, file_path: str):
        path = Path(file_path)
        if path.suffix.lower() == '.json':
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for item in data.get('terms', data):
                    term = item.get('term') or item.get('original')
                    canonical = item.get('canonical_form') or item.get('correct') or item.get('canonical')
                    if not term or not canonical:
                        continue
                    synonyms = item.get('synonyms', []) or []
                    case_sensitive = item.get('case_sensitive', False)
                    self.add_term(term, canonical, synonyms, case_sensitive)

    def check_term(self, text: str) -> List[Dict]:
        issues = []
        for term_key, term_info in self.terms.items():
            if term_info['case_sensitive']:
                if term_key in text:
                    if text.count(term_key) == text.count(term_info['canonical']):
                        continue
                    else:
                        issues.append({
                            'original': term_key,
                            'expected': term_info['canonical'],
                            'case_sensitive': True
                        })
            else:
                term_lower = term_key.lower()
                if term_lower in text.lower():
                    words = text.split()
                    for word in words:
                        if word.lower() == term_lower:
                            if word != term_info['canonical']:
                                issues.append({
                                    'original': word,
                                    'expected': term_info['canonical'],
                                    'case_sensitive': False
                                })
        return issues

    def get_all_terms(self) -> List[Dict]:
        db_terms = self.db.get_glossary_terms()
        return db_terms
