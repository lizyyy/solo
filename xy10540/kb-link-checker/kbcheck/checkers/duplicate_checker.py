from datetime import datetime
from typing import List, Dict, Tuple
from pathlib import Path

from kbcheck.models import Document, DuplicatePage, Link
from kbcheck.utils import generate_id


class DuplicateChecker:
    def __init__(self):
        pass

    def detect_duplicates(
        self,
        documents: List[Document],
        links: List[Link],
    ) -> List[DuplicatePage]:
        duplicates = []

        title_groups = self._group_by_title(documents)
        for title, docs in title_groups.items():
            if len(docs) >= 2:
                dup = self._create_duplicate_entry(docs, links, "title_match", 0.9)
                if dup:
                    duplicates.append(dup)

        hash_groups = self._group_by_hash(documents)
        for content_hash, docs in hash_groups.items():
            if len(docs) >= 2:
                existing_ids = set()
                for d in duplicates:
                    existing_ids.add(d.primary_doc_id)
                    existing_ids.update(d.duplicate_doc_ids)

                if not any(d.doc_id in existing_ids for d in docs):
                    dup = self._create_duplicate_entry(docs, links, "exact_match", 1.0)
                    if dup:
                        duplicates.append(dup)

        similar_pairs = self._find_similar_by_path(documents)
        for primary, secondary in similar_pairs:
            dup = self._create_duplicate_entry([primary, secondary], links, "path_similarity", 0.8)
            if dup:
                duplicates.append(dup)

        return duplicates

    def _group_by_title(self, docs: List[Document]) -> Dict[str, List[Document]]:
        groups: Dict[str, List[Document]] = {}
        for doc in docs:
            norm_title = doc.title.strip().lower()
            if norm_title not in groups:
                groups[norm_title] = []
            groups[norm_title].append(doc)
        return groups

    def _group_by_hash(self, docs: List[Document]) -> Dict[str, List[Document]]:
        groups: Dict[str, List[Document]] = {}
        for doc in docs:
            if doc.content_hash not in groups:
                groups[doc.content_hash] = []
            groups[doc.content_hash].append(doc)
        return groups

    def _find_similar_by_path(self, docs: List[Document]) -> List[Tuple[Document, Document]]:
        pairs = []
        doc_list = list(docs)

        for i, doc1 in enumerate(doc_list):
            for doc2 in doc_list[i+1:]:
                path1 = Path(doc1.path).stem
                path2 = Path(doc2.path).stem

                if path1.endswith('-v2') and path2 == path1[:-3]:
                    pairs.append((doc2, doc1))
                elif path2.endswith('-v2') and path1 == path2[:-3]:
                    pairs.append((doc1, doc2))
                elif '(copy)' in path1.lower() and path2.lower() == path1.lower().replace('(copy)', '').strip():
                    pairs.append((doc2, doc1))
                elif '(copy)' in path2.lower() and path1.lower() == path2.lower().replace('(copy)', '').strip():
                    pairs.append((doc1, doc2))

        return pairs

    def _create_duplicate_entry(
        self,
        docs: List[Document],
        links: List[Link],
        reason: str,
        score: float,
    ) -> DuplicatePage:
        primary = docs[0]
        duplicates = docs[1:]

        cross_refs = []
        doc_ids = {d.doc_id for d in docs}

        for link in links:
            if link.source_doc_id in doc_ids:
                target_basename = Path(link.target_url).stem
                for doc in docs:
                    if doc.doc_id != link.source_doc_id:
                        doc_basename = Path(doc.path).stem
                        if target_basename == doc_basename or target_basename in doc.title.lower():
                            cross_refs.append({
                                "from_doc": link.source_doc_id,
                                "to_doc": doc.doc_id,
                                "link_text": link.link_text,
                                "link_url": link.target_url,
                            })
                            break

        return DuplicatePage(
            duplicate_id=generate_id("dup", primary.doc_id, reason),
            primary_doc_id=primary.doc_id,
            duplicate_doc_ids=[d.doc_id for d in duplicates],
            similarity_score=score,
            reason=reason,
            cross_references=cross_refs,
            detected_at=datetime.now(),
        )
