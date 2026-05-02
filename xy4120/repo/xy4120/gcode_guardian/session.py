import json
import shutil
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional

from .config import MachineConfig, MachineLimits
from .parser import Fixture, Tool, Workpiece
from .rules import RuleCategory, RuleViolation, Severity, ViolationSummary


class SessionStatus(Enum):
    CREATED = "created"
    IMPORTED = "imported"
    SIMULATED = "simulated"
    REVIEWED = "reviewed"
    EXPORTED = "exported"


class ReviewDecision(Enum):
    APPROVE = "approve"
    REJECT = "reject"
    WAIVED = "waived"


@dataclass
class ReviewItem:
    violation_index: int
    decision: ReviewDecision
    reason: str = ""
    reviewer: str = ""
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class SessionMetadata:
    id: str = ""
    name: str = ""
    description: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    status: SessionStatus = SessionStatus.CREATED
    gcode_filename: str = ""
    tools_filename: str = ""
    fixtures_filename: str = ""
    workpiece_filename: str = ""


@dataclass
class SessionStatistics:
    total_blocks: int = 0
    motion_blocks: int = 0
    tool_changes: int = 0
    rapid_motions: int = 0
    cutting_motions: int = 0
    tools_used: List[int] = field(default_factory=list)
    min_x: float = 0.0
    max_x: float = 0.0
    min_y: float = 0.0
    max_y: float = 0.0
    min_z: float = 0.0
    max_z: float = 0.0


@dataclass
class Session:
    metadata: SessionMetadata = field(default_factory=SessionMetadata)
    machine_config: MachineConfig = field(default_factory=MachineConfig)
    tools: List[Tool] = field(default_factory=list)
    fixtures: List[Fixture] = field(default_factory=list)
    workpiece: Optional[Workpiece] = None
    violations: List[RuleViolation] = field(default_factory=list)
    reviews: List[ReviewItem] = field(default_factory=list)
    statistics: SessionStatistics = field(default_factory=SessionStatistics)

    def __post_init__(self):
        if not self.metadata.id:
            self.metadata.id = str(uuid.uuid4())[:8]

    def get_violation_summary(self) -> ViolationSummary:
        return ViolationSummary(self.violations)


class SessionStore:
    SESSION_DIR = ".gcode-guardian"
    SESSIONS_SUBDIR = "sessions"
    CONFIG_FILE = "machine_config.json"
    CURRENT_FILE = "current"

    def __init__(self, base_path: Optional[Path] = None):
        if base_path is None:
            base_path = Path.cwd()
        self.base_path = base_path
        self.root_dir = base_path / self.SESSION_DIR
        self.sessions_dir = self.root_dir / self.SESSIONS_SUBDIR

    def is_initialized(self) -> bool:
        return self.root_dir.exists() and self.sessions_dir.exists()

    def initialize(self, machine_config: Optional[MachineConfig] = None) -> Path:
        if machine_config is None:
            machine_config = MachineConfig()

        self.root_dir.mkdir(parents=True, exist_ok=True)
        self.sessions_dir.mkdir(parents=True, exist_ok=True)

        config_path = self.root_dir / self.CONFIG_FILE
        machine_config.to_file(config_path)

        return self.root_dir

    def get_default_config(self) -> MachineConfig:
        config_path = self.root_dir / self.CONFIG_FILE
        if config_path.exists():
            return MachineConfig.from_file(config_path)
        return MachineConfig()

    def create_session(self, name: str = "", description: str = "") -> Session:
        metadata = SessionMetadata(
            name=name or f"Session_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            description=description,
        )
        session = Session(
            metadata=metadata,
            machine_config=self.get_default_config(),
        )
        return session

    def save_session(self, session: Session) -> Path:
        session.metadata.updated_at = datetime.now()

        session_dir = self.sessions_dir / session.metadata.id
        session_dir.mkdir(parents=True, exist_ok=True)

        metadata_json = self._metadata_to_dict(session.metadata)
        with open(session_dir / "metadata.json", "w", encoding="utf-8") as f:
            json.dump(metadata_json, f, indent=2, ensure_ascii=False, default=str)

        machine_config_dict = asdict(session.machine_config)
        with open(session_dir / "machine_config.json", "w", encoding="utf-8") as f:
            json.dump(machine_config_dict, f, indent=2, ensure_ascii=False)

        tools_json = [asdict(t) for t in session.tools]
        with open(session_dir / "tools.json", "w", encoding="utf-8") as f:
            json.dump(tools_json, f, indent=2, ensure_ascii=False)

        fixtures_json = [asdict(f) for f in session.fixtures]
        with open(session_dir / "fixtures.json", "w", encoding="utf-8") as f:
            json.dump(fixtures_json, f, indent=2, ensure_ascii=False)

        if session.workpiece:
            workpiece_json = asdict(session.workpiece)
            with open(session_dir / "workpiece.json", "w", encoding="utf-8") as f:
                json.dump(workpiece_json, f, indent=2, ensure_ascii=False)

        violations_json = [self._violation_to_dict(v) for v in session.violations]
        with open(session_dir / "violations.json", "w", encoding="utf-8") as f:
            json.dump(violations_json, f, indent=2, ensure_ascii=False, default=str)

        reviews_json = [self._review_to_dict(r) for r in session.reviews]
        with open(session_dir / "reviews.json", "w", encoding="utf-8") as f:
            json.dump(reviews_json, f, indent=2, ensure_ascii=False, default=str)

        stats_json = asdict(session.statistics)
        with open(session_dir / "statistics.json", "w", encoding="utf-8") as f:
            json.dump(stats_json, f, indent=2, ensure_ascii=False)

        self._set_current_session(session.metadata.id)

        return session_dir

    def load_session(self, session_id: str) -> Optional[Session]:
        session_dir = self.sessions_dir / session_id
        if not session_dir.exists():
            return None

        with open(session_dir / "metadata.json", "r", encoding="utf-8") as f:
            metadata_dict = json.load(f)
            metadata = self._dict_to_metadata(metadata_dict)

        machine_config = MachineConfig()
        machine_config_path = session_dir / "machine_config.json"
        if machine_config_path.exists():
            machine_config = MachineConfig.from_file(machine_config_path)

        tools: List[Tool] = []
        tools_path = session_dir / "tools.json"
        if tools_path.exists():
            with open(tools_path, "r", encoding="utf-8") as f:
                tools_dict = json.load(f)
                tools = [Tool(**t) for t in tools_dict]

        fixtures: List[Fixture] = []
        fixtures_path = session_dir / "fixtures.json"
        if fixtures_path.exists():
            with open(fixtures_path, "r", encoding="utf-8") as f:
                fixtures_dict = json.load(f)
                fixtures = [Fixture(**f) for f in fixtures_dict]

        workpiece: Optional[Workpiece] = None
        workpiece_path = session_dir / "workpiece.json"
        if workpiece_path.exists():
            with open(workpiece_path, "r", encoding="utf-8") as f:
                workpiece_dict = json.load(f)
                workpiece = Workpiece(**workpiece_dict)

        violations: List[RuleViolation] = []
        violations_path = session_dir / "violations.json"
        if violations_path.exists():
            with open(violations_path, "r", encoding="utf-8") as f:
                violations_dict = json.load(f)
                violations = [self._dict_to_violation(v) for v in violations_dict]

        reviews: List[ReviewItem] = []
        reviews_path = session_dir / "reviews.json"
        if reviews_path.exists():
            with open(reviews_path, "r", encoding="utf-8") as f:
                reviews_dict = json.load(f)
                reviews = [self._dict_to_review(r) for r in reviews_dict]

        statistics = SessionStatistics()
        stats_path = session_dir / "statistics.json"
        if stats_path.exists():
            with open(stats_path, "r", encoding="utf-8") as f:
                stats_dict = json.load(f)
                statistics = SessionStatistics(**stats_dict)

        return Session(
            metadata=metadata,
            machine_config=machine_config,
            tools=tools,
            fixtures=fixtures,
            workpiece=workpiece,
            violations=violations,
            reviews=reviews,
            statistics=statistics,
        )

    def get_current_session(self) -> Optional[Session]:
        current_file = self.root_dir / self.CURRENT_FILE
        if not current_file.exists():
            return None
        with open(current_file, "r", encoding="utf-8") as f:
            session_id = f.read().strip()
        return self.load_session(session_id)

    def _set_current_session(self, session_id: str):
        current_file = self.root_dir / self.CURRENT_FILE
        with open(current_file, "w", encoding="utf-8") as f:
            f.write(session_id)

    def list_sessions(self) -> List[Dict[str, Any]]:
        if not self.sessions_dir.exists():
            return []

        sessions = []
        for session_dir in sorted(self.sessions_dir.iterdir(), reverse=True):
            if not session_dir.is_dir():
                continue

            metadata_path = session_dir / "metadata.json"
            if not metadata_path.exists():
                continue

            try:
                with open(metadata_path, "r", encoding="utf-8") as f:
                    metadata = json.load(f)
                sessions.append(
                    {
                        "id": session_dir.name,
                        "name": metadata.get("name", ""),
                        "description": metadata.get("description", ""),
                        "status": metadata.get("status", "unknown"),
                        "created_at": metadata.get("created_at", ""),
                        "updated_at": metadata.get("updated_at", ""),
                    }
                )
            except (json.JSONDecodeError, IOError):
                continue

        return sessions

    def delete_session(self, session_id: str) -> bool:
        session_dir = self.sessions_dir / session_id
        if not session_dir.exists():
            return False
        shutil.rmtree(session_dir)
        return True

    def _metadata_to_dict(self, metadata: SessionMetadata) -> Dict[str, Any]:
        return {
            "id": metadata.id,
            "name": metadata.name,
            "description": metadata.description,
            "created_at": metadata.created_at.isoformat(),
            "updated_at": metadata.updated_at.isoformat(),
            "status": metadata.status.value,
            "gcode_filename": metadata.gcode_filename,
            "tools_filename": metadata.tools_filename,
            "fixtures_filename": metadata.fixtures_filename,
            "workpiece_filename": metadata.workpiece_filename,
        }

    def _dict_to_metadata(self, data: Dict[str, Any]) -> SessionMetadata:
        created_at = datetime.now()
        if "created_at" in data:
            try:
                created_at = datetime.fromisoformat(data["created_at"])
            except (ValueError, TypeError):
                pass

        updated_at = datetime.now()
        if "updated_at" in data:
            try:
                updated_at = datetime.fromisoformat(data["updated_at"])
            except (ValueError, TypeError):
                pass

        status = SessionStatus.CREATED
        if "status" in data:
            try:
                status = SessionStatus(data["status"])
            except (ValueError, TypeError):
                pass

        return SessionMetadata(
            id=data.get("id", ""),
            name=data.get("name", ""),
            description=data.get("description", ""),
            created_at=created_at,
            updated_at=updated_at,
            status=status,
            gcode_filename=data.get("gcode_filename", ""),
            tools_filename=data.get("tools_filename", ""),
            fixtures_filename=data.get("fixtures_filename", ""),
            workpiece_filename=data.get("workpiece_filename", ""),
        )

    def _violation_to_dict(self, violation: RuleViolation) -> Dict[str, Any]:
        return {
            "severity": violation.severity.value,
            "category": violation.category.value,
            "message": violation.message,
            "line_number": violation.line_number,
            "raw_code": violation.raw_code,
            "position": violation.position,
            "details": violation.details,
            "timestamp": violation.timestamp.isoformat(),
        }

    def _dict_to_violation(self, data: Dict[str, Any]) -> RuleViolation:
        severity = Severity.ERROR
        if "severity" in data:
            try:
                severity = Severity(data["severity"])
            except (ValueError, TypeError):
                pass

        category = RuleCategory.FEED_SPEED
        if "category" in data:
            try:
                category = RuleCategory(data["category"])
            except (ValueError, TypeError):
                pass

        timestamp = datetime.now()
        if "timestamp" in data:
            try:
                timestamp = datetime.fromisoformat(data["timestamp"])
            except (ValueError, TypeError):
                pass

        return RuleViolation(
            severity=severity,
            category=category,
            message=data.get("message", ""),
            line_number=data.get("line_number", 0),
            raw_code=data.get("raw_code", ""),
            position=data.get("position"),
            details=data.get("details", {}),
            timestamp=timestamp,
        )

    def _review_to_dict(self, review: ReviewItem) -> Dict[str, Any]:
        return {
            "violation_index": review.violation_index,
            "decision": review.decision.value,
            "reason": review.reason,
            "reviewer": review.reviewer,
            "timestamp": review.timestamp.isoformat(),
        }

    def _dict_to_review(self, data: Dict[str, Any]) -> ReviewItem:
        decision = ReviewDecision.REJECT
        if "decision" in data:
            try:
                decision = ReviewDecision(data["decision"])
            except (ValueError, TypeError):
                pass

        timestamp = datetime.now()
        if "timestamp" in data:
            try:
                timestamp = datetime.fromisoformat(data["timestamp"])
            except (ValueError, TypeError):
                pass

        return ReviewItem(
            violation_index=data.get("violation_index", 0),
            decision=decision,
            reason=data.get("reason", ""),
            reviewer=data.get("reviewer", ""),
            timestamp=timestamp,
        )
