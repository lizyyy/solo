import json
import os
from typing import List, Dict, Any, Optional
from pathlib import Path

from kbcheck.models import (
    Document, Link, CheckResult, Owner, DuplicatePage, HistoryRecord, Correction
)


class Storage:
    def __init__(self, root_dir: str):
        self.root_dir = Path(root_dir)
        self.data_dir = self.root_dir / ".kbcheck"
        self.files = {
            "documents": self.data_dir / "documents.json",
            "links": self.data_dir / "links.json",
            "check_results": self.data_dir / "check_results.json",
            "owners": self.data_dir / "owners.json",
            "duplicates": self.data_dir / "duplicates.json",
            "history": self.data_dir / "history.json",
            "corrections": self.data_dir / "corrections.json",
            "meta": self.data_dir / "meta.json",
        }

    def initialize(self) -> bool:
        if self.data_dir.exists():
            return False
        self.data_dir.mkdir(parents=True)
        for f in self.files.values():
            f.write_text("[]")
        self._write_meta({
            "initialized_at": str(self._now()),
            "version": "1.0.0",
        })
        return True

    def exists(self) -> bool:
        return self.data_dir.exists()

    def _now(self):
        from datetime import datetime
        return datetime.now()

    def _read(self, key: str) -> List[dict]:
        if not self.files[key].exists():
            return []
        try:
            return json.loads(self.files[key].read_text())
        except json.JSONDecodeError:
            return []

    def _write(self, key: str, data: List[dict]):
        self.files[key].write_text(json.dumps(data, ensure_ascii=False, indent=2))

    def _read_meta(self) -> dict:
        meta_file = self.files["meta"]
        if not meta_file.exists():
            return {}
        try:
            return json.loads(meta_file.read_text())
        except json.JSONDecodeError:
            return {}

    def _write_meta(self, data: dict):
        self.files["meta"].write_text(json.dumps(data, ensure_ascii=False, indent=2))

    def get_meta(self, key: str = None, default=None):
        meta = self._read_meta()
        if key is None:
            return meta
        return meta.get(key, default)

    def set_meta(self, key: str, value: Any):
        meta = self._read_meta()
        meta[key] = value
        self._write_meta(meta)

    def save_documents(self, docs: List[Document]):
        existing = {d["doc_id"]: d for d in self._read("documents")}
        for doc in docs:
            existing[doc.doc_id] = doc.to_dict()
        self._write("documents", list(existing.values()))

    def get_documents(self) -> List[Document]:
        return [Document.from_dict(d) for d in self._read("documents")]

    def get_document(self, doc_id: str) -> Optional[Document]:
        for d in self._read("documents"):
            if d["doc_id"] == doc_id:
                return Document.from_dict(d)
        return None

    def save_links(self, links: List[Link]):
        existing = {l["link_id"]: l for l in self._read("links")}
        for link in links:
            existing[link.link_id] = link.to_dict()
        self._write("links", list(existing.values()))

    def get_links(self) -> List[Link]:
        return [Link.from_dict(l) for l in self._read("links")]

    def get_link(self, link_id: str) -> Optional[Link]:
        for l in self._read("links"):
            if l["link_id"] == link_id:
                return Link.from_dict(l)
        return None

    def get_links_by_url(self, url: str) -> List[Link]:
        return [Link.from_dict(l) for l in self._read("links") if l["target_url"] == url]

    def save_check_results(self, results: List[CheckResult]):
        existing = {r["check_id"]: r for r in self._read("check_results")}
        for result in results:
            existing[result.check_id] = result.to_dict()
        self._write("check_results", list(existing.values()))

    def get_check_results(self) -> List[CheckResult]:
        return [CheckResult.from_dict(r) for r in self._read("check_results")]

    def get_check_result(self, check_id: str) -> Optional[CheckResult]:
        for r in self._read("check_results"):
            if r["check_id"] == check_id:
                return CheckResult.from_dict(r)
        return None

    def get_check_results_by_doc(self, doc_id: str) -> List[CheckResult]:
        return [CheckResult.from_dict(r) for r in self._read("check_results") if r["source_doc_id"] == doc_id]

    def save_owners(self, owners: List[Owner]):
        existing = {o["owner_id"]: o for o in self._read("owners")}
        for owner in owners:
            existing[owner.owner_id] = owner.to_dict()
        self._write("owners", list(existing.values()))

    def get_owners(self) -> List[Owner]:
        return [Owner.from_dict(o) for o in self._read("owners")]

    def get_owner(self, owner_id: str) -> Optional[Owner]:
        for o in self._read("owners"):
            if o["owner_id"] == owner_id:
                return Owner.from_dict(o)
        return None

    def save_duplicates(self, dups: List[DuplicatePage]):
        existing = {d["duplicate_id"]: d for d in self._read("duplicates")}
        for dup in dups:
            existing[dup.duplicate_id] = dup.to_dict()
        self._write("duplicates", list(existing.values()))

    def get_duplicates(self) -> List[DuplicatePage]:
        return [DuplicatePage.from_dict(d) for d in self._read("duplicates")]

    def save_history(self, records: List[HistoryRecord]):
        existing = self._read("history")
        for record in records:
            existing.append(record.to_dict())
        self._write("history", existing)

    def get_history(self, limit: int = None) -> List[HistoryRecord]:
        records = [HistoryRecord.from_dict(r) for r in self._read("history")]
        if limit:
            return records[-limit:]
        return records

    def save_corrections(self, corrections: List[Correction]):
        existing = {c["correction_id"]: c for c in self._read("corrections")}
        for corr in corrections:
            existing[corr.correction_id] = corr.to_dict()
        self._write("corrections", list(existing.values()))

    def get_corrections(self) -> List[Correction]:
        return [Correction.from_dict(c) for c in self._read("corrections")]
