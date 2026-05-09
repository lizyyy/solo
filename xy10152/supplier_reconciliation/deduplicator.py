from typing import List, Dict, Tuple, Set
from collections import defaultdict
from .models import Document, DocumentType


class Deduplicator:
    def __init__(self, tolerance: float = 0.01):
        self.tolerance = tolerance
        self.duplicates: Dict[str, List[Document]] = {}
    
    def _amount_equal(self, a: float, b: float) -> bool:
        return abs(a - b) <= self.tolerance
    
    def find_duplicates(self, documents: List[Document]) -> Tuple[List[Document], Dict[str, List[Document]]]:
        duplicates = defaultdict(list)
        unique_docs: List[Document] = []
        first_occurrence: Dict[str, Document] = {}
        
        for doc in documents:
            if not doc.is_valid:
                unique_docs.append(doc)
                continue
            
            exact_key = f"{doc.doc_type.value}:{doc.doc_number}:{doc.supplier_id}"
            
            if exact_key in first_occurrence:
                duplicates[exact_key].append(doc)
                continue
            
            loose_match_key = None
            for existing_key, existing_doc in first_occurrence.items():
                if existing_doc.doc_type != doc.doc_type:
                    continue
                if existing_doc.supplier_id != doc.supplier_id:
                    continue
                if not self._amount_equal(existing_doc.amount, doc.amount):
                    continue
                
                if existing_doc.doc_number == doc.doc_number:
                    loose_match_key = existing_key
                    break
                elif doc.reference and existing_doc.doc_number == doc.reference:
                    loose_match_key = existing_key
                    break
                elif existing_doc.reference and doc.doc_number == existing_doc.reference:
                    loose_match_key = existing_key
                    break
            
            if loose_match_key:
                duplicates[loose_match_key].append(doc)
            else:
                first_occurrence[exact_key] = doc
                unique_docs.append(doc)
        
        self.duplicates = dict(duplicates)
        return unique_docs, self.duplicates
    
    def get_duplicate_summary(self) -> Dict[str, int]:
        summary = {}
        for key, docs in self.duplicates.items():
            doc_type = docs[0].doc_type.value if docs else "unknown"
            if doc_type not in summary:
                summary[doc_type] = 0
            summary[doc_type] += len(docs)
        return summary
    
    def mark_duplicates(self, documents: List[Document]) -> List[Document]:
        unique_docs, duplicates = self.find_duplicates(documents)
        
        first_occurrence_indices: Dict[str, int] = {}
        duplicate_indices: set = set()
        
        for key, dup_list in duplicates.items():
            for dup_doc in dup_list:
                for i, doc in enumerate(documents):
                    if doc is dup_doc:
                        duplicate_indices.add(i)
                        break
        
        for i, doc in enumerate(documents):
            doc.metadata["is_duplicate"] = i in duplicate_indices
        
        return documents
