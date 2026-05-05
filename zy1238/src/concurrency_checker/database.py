"""SQLite 数据库模块，用于存储分析记录"""

import sqlite3
from datetime import datetime
from typing import Optional, List, Dict, Any
from pathlib import Path
import json


class AnalysisDB:
    """分析记录数据库管理类"""

    def __init__(self, db_path: Optional[str] = None):
        if db_path is None:
            db_path = str(Path.home() / ".concurrency_checker" / "analysis.db")
        self.db_path = db_path
        self._ensure_db_path()
        self._init_db()

    def _ensure_db_path(self):
        """确保数据库目录存在"""
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)

    def _init_db(self):
        """初始化数据库表"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS analyses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            plan_file TEXT,
            run_count INTEGER,
            snippet_count INTEGER,
            concurrency_type TEXT,
            cpu_percent REAL,
            io_percent REAL,
            risk_score INTEGER,
            summary TEXT,
            raw_json TEXT
        )
        ''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS risks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            analysis_id INTEGER,
            category TEXT,
            level TEXT,
            message TEXT,
            suggestion TEXT,
            FOREIGN KEY (analysis_id) REFERENCES analyses (id)
        )
        ''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            analysis_id INTEGER,
            name TEXT,
            value REAL,
            unit TEXT,
            FOREIGN KEY (analysis_id) REFERENCES analyses (id)
        )
        ''')

        conn.commit()
        conn.close()

    def save_analysis(self, analysis_result: Dict[str, Any]) -> int:
        """保存分析结果，返回分析记录 ID"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        timestamp = datetime.now().isoformat()
        plan_file = analysis_result.get("plan_file")
        run_count = analysis_result.get("run_count", 0)
        snippet_count = analysis_result.get("snippet_count", 0)
        concurrency_type = analysis_result.get("concurrency_type", "unknown")
        
        cpu_percent = analysis_result.get("cpu_percent", 0.0)
        io_percent = analysis_result.get("io_percent", 0.0)
        risk_score = analysis_result.get("risk_score", 0)
        summary = analysis_result.get("summary", "")
        raw_json = json.dumps(analysis_result, ensure_ascii=False, default=str)

        cursor.execute('''
        INSERT INTO analyses (timestamp, plan_file, run_count, snippet_count, 
                              concurrency_type, cpu_percent, io_percent, risk_score, summary, raw_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (timestamp, plan_file, run_count, snippet_count, 
              concurrency_type, cpu_percent, io_percent, risk_score, summary, raw_json))

        analysis_id = cursor.lastrowid

        # 保存风险
        risks = analysis_result.get("risks", [])
        for risk in risks:
            # 处理 Risk dataclass 或字典
            if hasattr(risk, 'category'):
                category = risk.category
                level = risk.level.value if hasattr(risk.level, 'value') else str(risk.level)
                message = risk.message
                suggestion = risk.suggestion
            else:
                category = risk.get("category", "unknown")
                level = risk.get("level", "low")
                message = risk.get("message", "")
                suggestion = risk.get("suggestion", "")
            
            cursor.execute('''
            INSERT INTO risks (analysis_id, category, level, message, suggestion)
            VALUES (?, ?, ?, ?, ?)
            ''', (analysis_id, category, level, message, suggestion))

        # 保存指标
        metrics = analysis_result.get("metrics", [])
        for metric in metrics:
            cursor.execute('''
            INSERT INTO metrics (analysis_id, name, value, unit)
            VALUES (?, ?, ?, ?)
            ''', (analysis_id, metric.get("name"), metric.get("value"), metric.get("unit")))

        conn.commit()
        conn.close()

        return analysis_id

    def get_analysis(self, analysis_id: int) -> Optional[Dict[str, Any]]:
        """获取指定分析记录"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute('SELECT * FROM analyses WHERE id = ?', (analysis_id,))
        row = cursor.fetchone()

        if row is None:
            conn.close()
            return None

        result = dict(row)
        result["raw_data"] = json.loads(result["raw_json"])

        # 获取关联的风险
        cursor.execute('SELECT * FROM risks WHERE analysis_id = ?', (analysis_id,))
        result["risks"] = [dict(r) for r in cursor.fetchall()]

        # 获取关联的指标
        cursor.execute('SELECT * FROM metrics WHERE analysis_id = ?', (analysis_id,))
        result["metrics"] = [dict(m) for m in cursor.fetchall()]

        conn.close()
        return result

    def list_analyses(self, limit: int = 10) -> List[Dict[str, Any]]:
        """列出最近的分析记录"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute('''
        SELECT id, timestamp, plan_file, concurrency_type, risk_score, run_count, snippet_count
        FROM analyses
        ORDER BY id DESC
        LIMIT ?
        ''', (limit,))

        rows = cursor.fetchall()
        conn.close()

        return [dict(row) for row in rows]

    def get_comparison(self, id1: int, id2: int) -> Dict[str, Any]:
        """获取两次分析的对比数据"""
        analysis1 = self.get_analysis(id1)
        analysis2 = self.get_analysis(id2)

        if analysis1 is None or analysis2 is None:
            return {"error": "Analysis not found"}

        return {
            "analysis1": analysis1,
            "analysis2": analysis2,
            "comparison": self._compare_metrics(analysis1, analysis2)
        }

    def _compare_metrics(self, a1: Dict, a2: Dict) -> Dict:
        """比较两次分析的指标差异"""
        comparison = {
            "cpu_percent": {
                "value1": a1.get("cpu_percent"),
                "value2": a2.get("cpu_percent"),
                "diff": a2.get("cpu_percent", 0) - a1.get("cpu_percent", 0)
            },
            "io_percent": {
                "value1": a1.get("io_percent"),
                "value2": a2.get("io_percent"),
                "diff": a2.get("io_percent", 0) - a1.get("io_percent", 0)
            },
            "risk_score": {
                "value1": a1.get("risk_score"),
                "value2": a2.get("risk_score"),
                "diff": a2.get("risk_score", 0) - a1.get("risk_score", 0)
            },
            "run_count": {
                "value1": a1.get("run_count"),
                "value2": a2.get("run_count"),
                "diff": a2.get("run_count", 0) - a1.get("run_count", 0)
            },
            "snippet_count": {
                "value1": a1.get("snippet_count"),
                "value2": a2.get("snippet_count"),
                "diff": a2.get("snippet_count", 0) - a1.get("snippet_count", 0)
            }
        }
        return comparison

    def delete_analysis(self, analysis_id: int) -> bool:
        """删除指定分析记录"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # 先删除关联数据
        cursor.execute('DELETE FROM risks WHERE analysis_id = ?', (analysis_id,))
        cursor.execute('DELETE FROM metrics WHERE analysis_id = ?', (analysis_id,))
        cursor.execute('DELETE FROM analyses WHERE id = ?', (analysis_id,))

        affected = cursor.rowcount
        conn.commit()
        conn.close()

        return affected > 0