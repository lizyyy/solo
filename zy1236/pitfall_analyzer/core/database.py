"""SQLite 数据库操作模块。

存储和检索分析结果。
"""

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from .models import (
    AnalysisResult,
    CodeSnippet,
    ComparisonResult,
    Event,
    Finding,
    Location,
    Pipeline,
    PipelineRisk,
    PitfallType,
    Severity,
)


class Database:
    """SQLite 数据库管理器。"""

    SCHEMA_VERSION = 1

    def __init__(self, db_path: Union[str, Path]):
        self.db_path = Path(db_path)
        self._init_database()

    def _init_database(self):
        """初始化数据库表结构。"""
        with self._get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS schema_version (
                    version INTEGER PRIMARY KEY
                )
            """)

            cursor.execute("SELECT version FROM schema_version")
            if not cursor.fetchone():
                cursor.execute("INSERT INTO schema_version (version) VALUES (?)", (self.SCHEMA_VERSION,))

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS analyses (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT,
                    created_at TEXT NOT NULL,
                    summary TEXT
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS code_snippets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    analysis_id INTEGER NOT NULL,
                    file_path TEXT NOT NULL,
                    content TEXT NOT NULL,
                    FOREIGN KEY (analysis_id) REFERENCES analyses (id)
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS findings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    code_snippet_id INTEGER,
                    analysis_id INTEGER NOT NULL,
                    pitfall_type TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT,
                    file_path TEXT,
                    line_number INTEGER,
                    function_name TEXT,
                    class_name TEXT,
                    context TEXT,
                    suggestion TEXT,
                    code_snippet_text TEXT,
                    FOREIGN KEY (code_snippet_id) REFERENCES code_snippets (id),
                    FOREIGN KEY (analysis_id) REFERENCES analyses (id)
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS pipelines (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    analysis_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT,
                    stages TEXT,
                    FOREIGN KEY (analysis_id) REFERENCES analyses (id)
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS pipeline_risks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    pipeline_id INTEGER NOT NULL,
                    analysis_id INTEGER NOT NULL,
                    risk_type TEXT NOT NULL,
                    stage TEXT,
                    description TEXT,
                    severity TEXT NOT NULL,
                    FOREIGN KEY (pipeline_id) REFERENCES pipelines (id),
                    FOREIGN KEY (analysis_id) REFERENCES analyses (id)
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    analysis_id INTEGER NOT NULL,
                    timestamp TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    level TEXT,
                    message TEXT,
                    context TEXT,
                    FOREIGN KEY (analysis_id) REFERENCES analyses (id)
                )
            """)

            cursor.execute("CREATE INDEX IF NOT EXISTS idx_findings_analysis ON findings (analysis_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_analysis ON events (analysis_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_pipelines_analysis ON pipelines (analysis_id)")

            conn.commit()

    @contextmanager
    def _get_connection(self):
        """获取数据库连接的上下文管理器。"""
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def save_analysis(self, result: AnalysisResult) -> int:
        """保存分析结果到数据库。"""
        with self._get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute(
                "INSERT INTO analyses (name, created_at, summary) VALUES (?, ?, ?)",
                (
                    result.name,
                    result.created_at.isoformat(),
                    json.dumps(result.summary, ensure_ascii=False) if result.summary else None,
                ),
            )
            analysis_id = cursor.lastrowid

            for snippet in result.code_snippets:
                cursor.execute(
                    "INSERT INTO code_snippets (analysis_id, file_path, content) VALUES (?, ?, ?)",
                    (analysis_id, snippet.file_path, snippet.content),
                )
                snippet_id = cursor.lastrowid

                for finding in snippet.findings:
                    self._save_finding(cursor, finding, analysis_id, snippet_id)

            for pipeline in result.pipelines:
                cursor.execute(
                    "INSERT INTO pipelines (analysis_id, name, description, stages) VALUES (?, ?, ?, ?)",
                    (
                        analysis_id,
                        pipeline.name,
                        pipeline.description,
                        json.dumps(pipeline.stages, ensure_ascii=False) if pipeline.stages else None,
                    ),
                )
                pipeline_id = cursor.lastrowid

                for risk in pipeline.risks:
                    cursor.execute(
                        """INSERT INTO pipeline_risks
                           (pipeline_id, analysis_id, risk_type, stage, description, severity)
                           VALUES (?, ?, ?, ?, ?, ?)""",
                        (
                            pipeline_id,
                            analysis_id,
                            risk.risk_type,
                            risk.stage,
                            risk.description,
                            risk.severity.value,
                        ),
                    )

                    finding = Finding(
                        pitfall_type=self._risk_type_to_pitfall(risk.risk_type),
                        severity=risk.severity,
                        title=f"流水线风险: {risk.risk_type}",
                        description=f"流水线 '{pipeline.name}' 的阶段 '{risk.stage}': {risk.description}",
                        location=Location(file_path="pipelines.yaml"),
                        suggestion=None,
                    )
                    self._save_finding(cursor, finding, analysis_id, None)

            for event in result.events:
                cursor.execute(
                    """INSERT INTO events
                       (analysis_id, timestamp, event_type, level, message, context)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (
                        analysis_id,
                        event.timestamp.isoformat(),
                        event.event_type,
                        event.level,
                        event.message,
                        json.dumps(event.context, ensure_ascii=False) if event.context else None,
                    ),
                )

            conn.commit()
            return analysis_id

    def _save_finding(
        self,
        cursor: sqlite3.Cursor,
        finding: Finding,
        analysis_id: int,
        code_snippet_id: Optional[int],
    ):
        """保存单个发现。"""
        cursor.execute(
            """INSERT INTO findings
               (code_snippet_id, analysis_id, pitfall_type, severity, title, description,
                file_path, line_number, function_name, class_name, context, suggestion, code_snippet_text)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                code_snippet_id,
                analysis_id,
                finding.pitfall_type.value,
                finding.severity.value,
                finding.title,
                finding.description,
                finding.location.file_path if finding.location else None,
                finding.location.line_number if finding.location else None,
                finding.location.function_name if finding.location else None,
                finding.location.class_name if finding.location else None,
                json.dumps(finding.context, ensure_ascii=False) if finding.context else None,
                finding.suggestion,
                finding.code_snippet,
            ),
        )

    def get_analysis(self, analysis_id: int) -> Optional[AnalysisResult]:
        """获取指定 ID 的分析结果。"""
        with self._get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("SELECT * FROM analyses WHERE id = ?", (analysis_id,))
            row = cursor.fetchone()
            if not row:
                return None

            result = AnalysisResult(
                id=row["id"],
                name=row["name"],
                created_at=datetime.fromisoformat(row["created_at"]),
                summary=json.loads(row["summary"]) if row["summary"] else {},
            )

            cursor.execute("SELECT * FROM code_snippets WHERE analysis_id = ?", (analysis_id,))
            for snippet_row in cursor.fetchall():
                snippet = CodeSnippet(
                    file_path=snippet_row["file_path"],
                    content=snippet_row["content"],
                    findings=[],
                )

                cursor.execute(
                    "SELECT * FROM findings WHERE code_snippet_id = ?",
                    (snippet_row["id"],),
                )
                for finding_row in cursor.fetchall():
                    snippet.findings.append(self._row_to_finding(finding_row))

                result.code_snippets.append(snippet)

            cursor.execute("""
                SELECT f.* FROM findings f
                WHERE f.analysis_id = ? AND f.code_snippet_id IS NULL
            """, (analysis_id,))
            for finding_row in cursor.fetchall():
                pass

            cursor.execute("SELECT * FROM pipelines WHERE analysis_id = ?", (analysis_id,))
            for pipeline_row in cursor.fetchall():
                pipeline = Pipeline(
                    name=pipeline_row["name"],
                    description=pipeline_row["description"] or "",
                    stages=json.loads(pipeline_row["stages"]) if pipeline_row["stages"] else [],
                    risks=[],
                )

                cursor.execute(
                    "SELECT * FROM pipeline_risks WHERE pipeline_id = ?",
                    (pipeline_row["id"],),
                )
                for risk_row in cursor.fetchall():
                    pipeline.risks.append(PipelineRisk(
                        risk_type=risk_row["risk_type"],
                        stage=risk_row["stage"] or "",
                        description=risk_row["description"] or "",
                        severity=Severity(risk_row["severity"]),
                    ))

                result.pipelines.append(pipeline)

            cursor.execute("SELECT * FROM events WHERE analysis_id = ?", (analysis_id,))
            for event_row in cursor.fetchall():
                result.events.append(Event(
                    timestamp=datetime.fromisoformat(event_row["timestamp"]),
                    event_type=event_row["event_type"],
                    level=event_row["level"] or "info",
                    message=event_row["message"] or "",
                    context=json.loads(event_row["context"]) if event_row["context"] else {},
                ))

            return result

    def get_latest_analysis(self) -> Optional[AnalysisResult]:
        """获取最新的分析结果。"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM analyses ORDER BY id DESC LIMIT 1")
            row = cursor.fetchone()
            if row:
                return self.get_analysis(row["id"])
            return None

    def list_analyses(self, limit: int = 10) -> List[Dict[str, Any]]:
        """列出最近的分析记录。"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT a.id, a.name, a.created_at, a.summary,
                       (SELECT COUNT(*) FROM findings f WHERE f.analysis_id = a.id) as finding_count
                FROM analyses a
                ORDER BY a.id DESC
                LIMIT ?
            """, (limit,))

            results = []
            for row in cursor.fetchall():
                summary = json.loads(row["summary"]) if row["summary"] else {}
                results.append({
                    "id": row["id"],
                    "name": row["name"],
                    "created_at": row["created_at"],
                    "finding_count": row["finding_count"],
                    "summary": summary,
                })
            return results

    def compare_analyses(self, analysis_id_1: int, analysis_id_2: int) -> Optional[ComparisonResult]:
        """对比两次分析结果。"""
        analysis1 = self.get_analysis(analysis_id_1)
        analysis2 = self.get_analysis(analysis_id_2)

        if not analysis1 or not analysis2:
            return None

        result = ComparisonResult(
            analysis_id_1=analysis_id_1,
            analysis_id_2=analysis_id_2,
            analysis_name_1=analysis1.name,
            analysis_name_2=analysis2.name,
        )

        findings1 = self._get_all_findings(analysis1)
        findings2 = self._get_all_findings(analysis2)

        keys1 = set(self._finding_key(f) for f in findings1)
        keys2 = set(self._finding_key(f) for f in findings2)

        key_to_finding1 = {self._finding_key(f): f for f in findings1}
        key_to_finding2 = {self._finding_key(f): f for f in findings2}

        for key in keys2 - keys1:
            result.new_findings.append(key_to_finding2[key])

        for key in keys1 - keys2:
            result.resolved_findings.append(key_to_finding1[key])

        for key in keys1 & keys2:
            f1 = key_to_finding1[key]
            f2 = key_to_finding2[key]

            severity_order = [
                Severity.INFO, Severity.LOW, Severity.MEDIUM, Severity.HIGH, Severity.CRITICAL
            ]
            idx1 = severity_order.index(f1.severity)
            idx2 = severity_order.index(f2.severity)

            if idx2 < idx1:
                result.improved_findings.append({
                    "before": f1,
                    "after": f2,
                    "change": "severity_improved",
                })
            elif idx2 > idx1:
                result.worsened_findings.append({
                    "before": f1,
                    "after": f2,
                    "change": "severity_worsened",
                })

        result.compute_summary()
        return result

    @staticmethod
    def _get_all_findings(analysis: AnalysisResult) -> List[Finding]:
        """获取分析中的所有发现。"""
        findings = []
        for snippet in analysis.code_snippets:
            findings.extend(snippet.findings)
        return findings

    @staticmethod
    def _finding_key(finding: Finding) -> str:
        """生成发现的唯一键用于比较。"""
        parts = [
            finding.pitfall_type.value,
            finding.location.file_path if finding.location else "unknown",
            str(finding.location.line_number) if finding.location and finding.location.line_number else "0",
        ]
        return "|".join(parts)

    @staticmethod
    def _row_to_finding(row: sqlite3.Row) -> Finding:
        """将数据库行转换为 Finding 对象。"""
        return Finding(
            pitfall_type=PitfallType(row["pitfall_type"]),
            severity=Severity(row["severity"]),
            title=row["title"],
            description=row["description"] or "",
            location=Location(
                file_path=row["file_path"] or "<unknown>",
                line_number=row["line_number"],
                function_name=row["function_name"],
                class_name=row["class_name"],
            ),
            context=json.loads(row["context"]) if row["context"] else {},
            suggestion=row["suggestion"],
            code_snippet=row["code_snippet_text"],
        )

    @staticmethod
    def _risk_type_to_pitfall(risk_type: str) -> PitfallType:
        """将风险类型转换为坑点类型。"""
        mapping = {
            "single_use_iterator": PitfallType.SINGLE_USE,
            "lazy_evaluation": PitfallType.LAZY_EVALUATION,
            "stopiteration": PitfallType.STOP_ITERATION,
            "tee_cache": PitfallType.TEE_CACHE,
            "iterator_protocol": PitfallType.ITERATOR_PROTOCOL,
        }
        for key, value in mapping.items():
            if key in risk_type.lower():
                return value
        return PitfallType.LAZY_EVALUATION
