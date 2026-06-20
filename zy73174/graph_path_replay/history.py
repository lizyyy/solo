from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from .models import HistoryField, QuestionItem, VersionedField


class QuestionHistoryStore:
    def __init__(self, storage_path: str = "./history_store"):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)
        self._index_path = self.storage_path / "index.json"
        self._index: dict = self._load_index()

    def _load_index(self) -> dict:
        if self._index_path.exists():
            with open(self._index_path, "r", encoding="utf-8") as f:
                return json.load(f)
        return {"questions": {}, "last_updated": ""}

    def _save_index(self) -> None:
        self._index["last_updated"] = datetime.now().isoformat(timespec="seconds")
        with open(self._index_path, "w", encoding="utf-8") as f:
            json.dump(self._index, f, ensure_ascii=False, indent=2)

    def _question_path(self, question_id: str) -> Path:
        safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in question_id)
        return self.storage_path / f"q_{safe}.json"

    def ingest(self, question: QuestionItem) -> None:
        path = self._question_path(question.question_id)
        existing: QuestionItem | None = None

        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            existing = QuestionItem.from_dict(data)
            for old_remark in question.remark.history:
                if not any(h.value == old_remark.value for h in existing.remark.history):
                    existing.remark.history.append(old_remark)
            for old_shot in question.screenshots.history:
                if not any(h.value == old_shot.value for h in existing.screenshots.history):
                    existing.screenshots.history.append(old_shot)
            existing.path_params.update(question.path_params)
            existing.tags = list(dict.fromkeys(existing.tags + question.tags))
            existing.title = question.title or existing.title
            existing.sort_key = question.sort_key if question.sort_key is not None else existing.sort_key
            question = existing

        with open(path, "w", encoding="utf-8") as f:
            json.dump(question.to_dict(), f, ensure_ascii=False, indent=2)

        self._index["questions"][question.question_id] = {
            "title": question.title,
            "remark_versions": len(question.remark.history),
            "screenshot_versions": len(question.screenshots.history),
            "last_seen": datetime.now().isoformat(timespec="seconds"),
            "file": str(path.name),
        }
        self._save_index()

    def get(self, question_id: str) -> QuestionItem | None:
        path = self._question_path(question_id)
        if not path.exists():
            return None
        with open(path, "r", encoding="utf-8") as f:
            return QuestionItem.from_dict(json.load(f))

    def add_remark(self, question_id: str, remark: str, author: str = "xiaomeng", note: str = "") -> bool:
        q = self.get(question_id)
        if q is None:
            return False
        q.remark.append(remark, author=author, note=note)
        self.ingest(q)
        return True

    def add_screenshot(self, question_id: str, screenshot_ref: str, author: str = "qa", note: str = "") -> bool:
        q = self.get(question_id)
        if q is None:
            return False
        q.screenshots.append(screenshot_ref, author=author, note=note)
        self.ingest(q)
        return True

    def diff_history(self, question_id: str, field: str = "remark") -> list[dict]:
        q = self.get(question_id)
        if q is None:
            return []
        hist_field: HistoryField = getattr(q, field, None)
        if hist_field is None:
            return []
        result = []
        for i, vf in enumerate(hist_field.history):
            result.append({
                "version": i + 1,
                "value": vf.value,
                "timestamp": vf.timestamp,
                "author": vf.author,
                "note": vf.note,
            })
        return result

    def print_history_report(self, question_id: str, stream=None) -> None:
        import sys
        out = stream or sys.stdout
        q = self.get(question_id)
        if q is None:
            print(f"[!] 题目 {question_id} 未找到历史记录", file=out)
            return
        sep = "-" * 60
        print(f"\n📜 历史记录: 题目 {q.question_id} - {q.title}", file=out)
        print(sep, file=out)
        print(f"  当前路径参数: {json.dumps(q.path_params, ensure_ascii=False)}", file=out)
        print(f"  标签: {', '.join(q.tags) if q.tags else '(无)'}", file=out)
        print(sep, file=out)
        print(f"\n  📝 备注历史 ({len(q.remark.history)} 条):", file=out)
        for i, vf in enumerate(q.remark.history):
            print(f"    [版本 {i + 1}] {vf.timestamp} @{vf.author}", file=out)
            if vf.note:
                print(f"            说明: {vf.note}", file=out)
            print(f"            内容: {vf.value}", file=out)
        if not q.remark.history:
            print(f"    (无备注历史)", file=out)
        print(f"\n  🖼️  截图历史 ({len(q.screenshots.history)} 条):", file=out)
        for i, vf in enumerate(q.screenshots.history):
            print(f"    [版本 {i + 1}] {vf.timestamp} @{vf.author}", file=out)
            if vf.note:
                print(f"            说明: {vf.note}", file=out)
            print(f"            引用: {vf.value}", file=out)
        if not q.screenshots.history:
            print(f"    (无截图历史)", file=out)
        print(sep, file=out)

    def all_ids(self) -> list[str]:
        return list(self._index.get("questions", {}).keys())
