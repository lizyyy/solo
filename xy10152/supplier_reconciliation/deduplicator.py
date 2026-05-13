from typing import List, Dict, Tuple, Set
from collections import defaultdict
from .models import Document, DocumentType


class Deduplicator:
    def __init__(self, tolerance: float = 0.01):
        self.tolerance = tolerance
        self.duplicates: Dict[str, List[Document]] = {}
    
    def _amount_equal(self, a: float, b: float) -> bool:
        return abs(a - b) <= self.tolerance
    
    def _get_duplicate_keys(self, doc: Document) -> List[str]:
        keys = []
        
        exact_key = f"{doc.doc_type.value}:{doc.doc_number}:{doc.supplier_id}"
        keys.append(("exact", exact_key))
        
        if doc.reference and doc.reference.strip():
            ref_key = f"{doc.doc_type.value}:ref:{doc.supplier_id}:{doc.amount:.2f}:{doc.reference.strip()}"
            keys.append(("reference", ref_key))
        
        return keys
    
    def find_duplicates(self, documents: List[Document]) -> Tuple[List[Document], Dict[str, List[Document]]]:
        duplicates = defaultdict(list)
        unique_docs: List[Document] = []
        
        seen_keys: Dict[str, Document] = {}
        
        for doc in documents:
            if not doc.is_valid:
                unique_docs.append(doc)
                continue
            
            keys = self._get_duplicate_keys(doc)
            
            is_duplicate = False
            match_key = None
            
            for key_type, key in keys:
                if key in seen_keys:
                    is_duplicate = True
                    match_key = f"{seen_keys[key].doc_type.value}:{seen_keys[key].doc_number}:{seen_keys[key].supplier_id}"
                    break
            
            if is_duplicate and match_key:
                duplicates[match_key].append(doc)
            else:
                for key_type, key in keys:
                    if key not in seen_keys:
                        seen_keys[key] = doc
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
