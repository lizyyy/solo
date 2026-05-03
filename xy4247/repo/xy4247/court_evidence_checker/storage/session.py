import json
import os
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

from ..models import (
    CheckSession,
    CheckResult,
    EvidenceCatalog,
    Reference,
    Objection,
)


class SessionManager:
    DEFAULT_SESSION_DIR = ".evidence_checker_sessions"

    def __init__(self, session_dir: Optional[Path] = None):
        self.session_dir = session_dir or Path.cwd() / self.DEFAULT_SESSION_DIR
        self.session_dir.mkdir(parents=True, exist_ok=True)
        self.sessions: Dict[str, CheckSession] = {}
        self.current_session_id: Optional[str] = None

    def create_session(
        self,
        case_number: Optional[str] = None,
        case_name: Optional[str] = None,
    ) -> CheckSession:
        session_id = f"session_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        session = CheckSession(
            session_id=session_id,
            created_at=datetime.now(),
        )
        self.sessions[session_id] = session
        self.current_session_id = session_id
        return session

    def get_session(self, session_id: str) -> Optional[CheckSession]:
        return self.sessions.get(session_id)

    def get_current_session(self) -> Optional[CheckSession]:
        if self.current_session_id:
            return self.sessions.get(self.current_session_id)
        return None

    def set_current_session(self, session_id: str) -> bool:
        if session_id in self.sessions:
            self.current_session_id = session_id
            return True
        return False

    def save_session(self, session: CheckSession, file_path: Optional[Path] = None) -> Path:
        if file_path is None:
            file_path = self.session_dir / f"{session.session_id}.json"

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(session.to_dict(), f, ensure_ascii=False, indent=2)

        return file_path

    def load_session(self, file_path: Path) -> Optional[CheckSession]:
        if not file_path.exists():
            return None

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            session = CheckSession.from_dict(data)
            self.sessions[session.session_id] = session
            self.current_session_id = session.session_id
            return session
        except Exception:
            return None

    def list_sessions(self) -> List[Dict]:
        sessions = []

        for file_path in self.session_dir.glob("session_*.json"):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                sessions.append({
                    "session_id": data.get("session_id"),
                    "created_at": data.get("created_at"),
                    "file_path": str(file_path),
                    "issue_count": len(data.get("check_results", {}).get("rule_results", [])),
                })
            except Exception:
                pass

        sessions.sort(key=lambda x: x["created_at"], reverse=True)
        return sessions

    def update_session(
        self,
        session_id: str,
        check_result: Optional[CheckResult] = None,
        evidence_catalog: Optional[EvidenceCatalog] = None,
        references: Optional[List[Reference]] = None,
        objections: Optional[List[Objection]] = None,
        timeline_data: Optional[Dict] = None,
    ) -> Optional[CheckSession]:
        session = self.sessions.get(session_id)
        if not session:
            return None

        if check_result:
            session.check_results[check_result.check_id] = check_result

        if evidence_catalog:
            session.evidence_catalog = evidence_catalog.to_dict()

        if references:
            session.references = [r.to_dict() for r in references]

        if objections:
            session.objections = [o.to_dict() for o in objections]

        if timeline_data:
            session.timeline = timeline_data

        return session


class CheckSessionStorage:
    def __init__(self, base_dir: Optional[Path] = None):
        self.base_dir = base_dir or Path.cwd()
        self.session_manager = SessionManager(self.base_dir / ".evidence_checker")

    def import_files(
        self,
        transcript_path: Optional[Path] = None,
        evidence_list_path: Optional[Path] = None,
        cross_exam_path: Optional[Path] = None,
        judgment_path: Optional[Path] = None,
    ) -> Dict[str, Any]:
        from ..parsers import (
            MarkdownTranscriptParser,
            EvidenceCSVParser,
            CrossExaminationJSONParser,
            JudgmentDraftParser,
        )

        results = {
            "success": True,
            "errors": [],
            "warnings": [],
            "parsed_data": {},
        }

        all_references: List[Reference] = []
        all_objections: List[Objection] = []
        evidence_catalog: Optional[EvidenceCatalog] = None

        if transcript_path:
            parser = MarkdownTranscriptParser()
            parse_result = parser.parse(transcript_path)
            if parse_result.success:
                results["parsed_data"]["transcript"] = parse_result.data
                refs = [
                    Reference.from_dict(r)
                    for r in parse_result.data.get("references", [])
                ]
                all_references.extend(refs)
            else:
                results["success"] = False
                results["errors"].extend(parse_result.errors)
            results["warnings"].extend(parse_result.warnings)

        if evidence_list_path:
            parser = EvidenceCSVParser()
            parse_result = parser.parse(evidence_list_path)
            if parse_result.success:
                results["parsed_data"]["evidence_list"] = parse_result.data
                catalog_dict = parse_result.data.get("evidence_catalog")
                if catalog_dict:
                    from ..models import EvidenceCatalog
                    evidence_catalog = EvidenceCatalog.from_dict(catalog_dict)
                refs = [
                    Reference.from_dict(r)
                    for r in parse_result.data.get("references", [])
                ]
                all_references.extend(refs)
            else:
                results["success"] = False
                results["errors"].extend(parse_result.errors)
            results["warnings"].extend(parse_result.warnings)

        if cross_exam_path:
            parser = CrossExaminationJSONParser()
            parse_result = parser.parse(cross_exam_path)
            if parse_result.success:
                results["parsed_data"]["cross_examination"] = parse_result.data
                refs = [
                    Reference.from_dict(r)
                    for r in parse_result.data.get("references", [])
                ]
                all_references.extend(refs)
                objs = [
                    Objection.from_dict(o)
                    for o in parse_result.data.get("objections", [])
                ]
                all_objections.extend(objs)
            else:
                results["success"] = False
                results["errors"].extend(parse_result.errors)
            results["warnings"].extend(parse_result.warnings)

        if judgment_path:
            parser = JudgmentDraftParser()
            parse_result = parser.parse(judgment_path)
            if parse_result.success:
                results["parsed_data"]["judgment_draft"] = parse_result.data
                refs = [
                    Reference.from_dict(r)
                    for r in parse_result.data.get("references", [])
                ]
                all_references.extend(refs)
            else:
                results["success"] = False
                results["errors"].extend(parse_result.errors)
            results["warnings"].extend(parse_result.warnings)

        results["references"] = all_references
        results["objections"] = all_objections
        results["evidence_catalog"] = evidence_catalog

        return results
