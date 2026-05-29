import json
import os
from typing import Dict, List, Optional

from .models import TeacherComment, load_json, save_json, _gen_id, _now_iso


class CommentManager:
    def __init__(self, output_dir: str):
        self.comments_dir = os.path.join(output_dir, "comments")
        os.makedirs(self.comments_dir, exist_ok=True)

    def _comment_path(self, comment_id: str) -> str:
        return os.path.join(self.comments_dir, f"{comment_id}.json")

    def add(
        self,
        student_id: str,
        session_id: str,
        teacher_name: str,
        content: str,
    ) -> TeacherComment:
        comment_id = _gen_id()
        comment = TeacherComment(
            comment_id=comment_id,
            student_id=student_id,
            session_id=session_id,
            teacher_name=teacher_name,
            content=content,
        )
        save_json(comment.to_dict(masked=False), self._comment_path(comment_id))
        return comment

    def get(self, comment_id: str) -> Optional[TeacherComment]:
        path = self._comment_path(comment_id)
        if not os.path.exists(path):
            return None
        data = load_json(path)
        return TeacherComment.from_dict(data)

    def list_by_session(self, session_id: str) -> List[Dict]:
        results = []
        if not os.path.exists(self.comments_dir):
            return results
        for fname in sorted(os.listdir(self.comments_dir)):
            if not fname.endswith(".json"):
                continue
            data = load_json(os.path.join(self.comments_dir, fname))
            if data.get("session_id") == session_id:
                results.append(data)
        return results

    def list_by_student(self, student_id: str) -> List[Dict]:
        results = []
        if not os.path.exists(self.comments_dir):
            return results
        for fname in sorted(os.listdir(self.comments_dir)):
            if not fname.endswith(".json"):
                continue
            data = load_json(os.path.join(self.comments_dir, fname))
            if data.get("student_id") == student_id:
                results.append(data)
        return results
