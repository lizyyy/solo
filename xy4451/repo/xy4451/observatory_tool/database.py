import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, asdict
from enum import Enum


class ConflictType(Enum):
    MAINTENANCE_CONFLICT = "maintenance_conflict"
    MOON_ANGLE_TOO_SMALL = "moon_angle_too_small"
    CLOUD_COVER_EXCEEDED = "cloud_cover_exceeded"
    MISSING_DARK_FRAME = "missing_dark_frame"


@dataclass
class MaintenanceSchedule:
    id: Optional[int]
    telescope_id: str
    start_time: datetime
    end_time: datetime
    description: str
    created_at: Optional[datetime] = None


@dataclass
class ObservationTarget:
    id: Optional[int]
    target_name: str
    ra: float  # 赤经，小时
    dec: float  # 赤纬，度
    priority: int
    min_moon_angle: float  # 最小月亮角距，度
    max_cloud_cover: float  # 最大云量，0-1
    required_exposure: int  # 所需曝光时间，秒
    required_binning: int  # 所需binning
    required_gain: int  # 所需增益
    created_at: Optional[datetime] = None


@dataclass
class WeatherForecast:
    id: Optional[int]
    time: datetime
    cloud_cover: float  # 云量，0-1
    seeing: Optional[float]  # 视宁度，角秒
    temperature: Optional[float]  # 温度，摄氏度
    wind_speed: Optional[float]  # 风速，m/s
    created_at: Optional[datetime] = None


@dataclass
class DarkFrame:
    id: Optional[int]
    exposure: int  # 曝光时间，秒
    binning: int  # binning
    gain: int  # 增益
    count: int  # 可用数量
    file_path: Optional[str] = None
    created_at: Optional[datetime] = None


@dataclass
class ScanResult:
    id: Optional[int]
    target_id: int
    conflict_type: str
    conflict_details: str
    severity: str  # high, medium, low
    scan_time: Optional[datetime] = None


@dataclass
class ObservationPlan:
    id: Optional[int]
    target_id: int
    scheduled_time: datetime
    status: str  # pending, approved, rejected, completed
    notes: Optional[str] = None
    created_at: Optional[datetime] = None


class Database:
    def __init__(self, db_path: str = "observatory.db"):
        self.db_path = db_path
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, detect_types=sqlite3.PARSE_DECLTYPES | sqlite3.PARSE_COLNAMES)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS maintenance_schedule (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telescope_id TEXT NOT NULL,
                start_time TIMESTAMP NOT NULL,
                end_time TIMESTAMP NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS observation_targets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                target_name TEXT NOT NULL UNIQUE,
                ra REAL NOT NULL,
                dec REAL NOT NULL,
                priority INTEGER DEFAULT 1,
                min_moon_angle REAL DEFAULT 30.0,
                max_cloud_cover REAL DEFAULT 0.3,
                required_exposure INTEGER DEFAULT 300,
                required_binning INTEGER DEFAULT 1,
                required_gain INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS weather_forecasts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                time TIMESTAMP NOT NULL UNIQUE,
                cloud_cover REAL NOT NULL,
                seeing REAL,
                temperature REAL,
                wind_speed REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS dark_frames (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                exposure INTEGER NOT NULL,
                binning INTEGER NOT NULL,
                gain INTEGER NOT NULL,
                count INTEGER DEFAULT 0,
                file_path TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(exposure, binning, gain)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS scan_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                target_id INTEGER NOT NULL,
                conflict_type TEXT NOT NULL,
                conflict_details TEXT,
                severity TEXT DEFAULT 'high',
                scan_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (target_id) REFERENCES observation_targets(id)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS observation_plans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                target_id INTEGER NOT NULL,
                scheduled_time TIMESTAMP NOT NULL,
                status TEXT DEFAULT 'pending',
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (target_id) REFERENCES observation_targets(id)
            )
        """)

        cursor.execute("CREATE INDEX IF NOT EXISTS idx_maintenance_time ON maintenance_schedule(start_time, end_time)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_weather_time ON weather_forecasts(time)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_scan_target ON scan_results(target_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_plan_time ON observation_plans(scheduled_time)")

        conn.commit()
        conn.close()

    # Maintenance Schedule methods
    def add_maintenance(self, maintenance: MaintenanceSchedule) -> int:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO maintenance_schedule (telescope_id, start_time, end_time, description)
            VALUES (?, ?, ?, ?)
        """, (maintenance.telescope_id, maintenance.start_time, maintenance.end_time, maintenance.description))
        new_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return new_id

    def get_maintenance_by_time_range(self, start: datetime, end: datetime) -> List[MaintenanceSchedule]:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM maintenance_schedule
            WHERE start_time < ? AND end_time > ?
        """, (end, start))
        rows = cursor.fetchall()
        conn.close()
        return [MaintenanceSchedule(
            id=r['id'],
            telescope_id=r['telescope_id'],
            start_time=r['start_time'],
            end_time=r['end_time'],
            description=r['description'],
            created_at=r['created_at']
        ) for r in rows]

    # Observation Target methods
    def add_target(self, target: ObservationTarget) -> int:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO observation_targets 
            (target_name, ra, dec, priority, min_moon_angle, max_cloud_cover, 
             required_exposure, required_binning, required_gain)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(target_name) DO UPDATE SET
                ra=excluded.ra, dec=excluded.dec, priority=excluded.priority,
                min_moon_angle=excluded.min_moon_angle, max_cloud_cover=excluded.max_cloud_cover,
                required_exposure=excluded.required_exposure, required_binning=excluded.required_binning,
                required_gain=excluded.required_gain
        """, (
            target.target_name, target.ra, target.dec, target.priority,
            target.min_moon_angle, target.max_cloud_cover,
            target.required_exposure, target.required_binning, target.required_gain
        ))
        new_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return new_id

    def get_all_targets(self) -> List[ObservationTarget]:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM observation_targets ORDER BY priority DESC")
        rows = cursor.fetchall()
        conn.close()
        return [ObservationTarget(
            id=r['id'], target_name=r['target_name'], ra=r['ra'], dec=r['dec'],
            priority=r['priority'], min_moon_angle=r['min_moon_angle'],
            max_cloud_cover=r['max_cloud_cover'], required_exposure=r['required_exposure'],
            required_binning=r['required_binning'], required_gain=r['required_gain'],
            created_at=r['created_at']
        ) for r in rows]

    def get_target_by_id(self, target_id: int) -> Optional[ObservationTarget]:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM observation_targets WHERE id = ?", (target_id,))
        row = cursor.fetchone()
        conn.close()
        if row:
            return ObservationTarget(
                id=row['id'], target_name=row['target_name'], ra=row['ra'], dec=row['dec'],
                priority=row['priority'], min_moon_angle=row['min_moon_angle'],
                max_cloud_cover=row['max_cloud_cover'], required_exposure=row['required_exposure'],
                required_binning=row['required_binning'], required_gain=row['required_gain'],
                created_at=row['created_at']
            )
        return None

    # Weather Forecast methods
    def add_weather(self, weather: WeatherForecast) -> int:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO weather_forecasts (time, cloud_cover, seeing, temperature, wind_speed)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(time) DO UPDATE SET
                cloud_cover=excluded.cloud_cover, seeing=excluded.seeing,
                temperature=excluded.temperature, wind_speed=excluded.wind_speed
        """, (weather.time, weather.cloud_cover, weather.seeing, weather.temperature, weather.wind_speed))
        new_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return new_id

    def get_weather_at_time(self, time: datetime) -> Optional[WeatherForecast]:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM weather_forecasts
            ORDER BY ABS(strftime('%s', time) - strftime('%s', ?))
            LIMIT 1
        """, (time,))
        row = cursor.fetchone()
        conn.close()
        if row:
            return WeatherForecast(
                id=row['id'], time=row['time'], cloud_cover=row['cloud_cover'],
                seeing=row['seeing'], temperature=row['temperature'],
                wind_speed=row['wind_speed'], created_at=row['created_at']
            )
        return None

    # Dark Frame methods
    def add_dark_frame(self, dark: DarkFrame) -> int:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO dark_frames (exposure, binning, gain, count, file_path)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(exposure, binning, gain) DO UPDATE SET
                count=excluded.count, file_path=excluded.file_path
        """, (dark.exposure, dark.binning, dark.gain, dark.count, dark.file_path))
        new_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return new_id

    def get_dark_frame(self, exposure: int, binning: int, gain: int) -> Optional[DarkFrame]:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM dark_frames
            WHERE exposure = ? AND binning = ? AND gain = ?
        """, (exposure, binning, gain))
        row = cursor.fetchone()
        conn.close()
        if row:
            return DarkFrame(
                id=row['id'], exposure=row['exposure'], binning=row['binning'],
                gain=row['gain'], count=row['count'], file_path=row['file_path'],
                created_at=row['created_at']
            )
        return None

    def get_all_dark_frames(self) -> List[DarkFrame]:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM dark_frames ORDER BY exposure, binning, gain")
        rows = cursor.fetchall()
        conn.close()
        return [DarkFrame(
            id=r['id'], exposure=r['exposure'], binning=r['binning'],
            gain=r['gain'], count=r['count'], file_path=r['file_path'],
            created_at=r['created_at']
        ) for r in rows]

    # Scan Result methods
    def add_scan_result(self, result: ScanResult) -> int:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO scan_results (target_id, conflict_type, conflict_details, severity)
            VALUES (?, ?, ?, ?)
        """, (result.target_id, result.conflict_type, result.conflict_details, result.severity))
        new_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return new_id

    def get_scan_results_by_target(self, target_id: int) -> List[ScanResult]:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM scan_results WHERE target_id = ?
            ORDER BY scan_time DESC
        """, (target_id,))
        rows = cursor.fetchall()
        conn.close()
        return [ScanResult(
            id=r['id'], target_id=r['target_id'], conflict_type=r['conflict_type'],
            conflict_details=r['conflict_details'], severity=r['severity'],
            scan_time=r['scan_time']
        ) for r in rows]

    def get_all_scan_results(self) -> List[ScanResult]:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT sr.*, ot.target_name FROM scan_results sr
            JOIN observation_targets ot ON sr.target_id = ot.id
            ORDER BY sr.scan_time DESC
        """)
        rows = cursor.fetchall()
        conn.close()
        results = []
        for r in rows:
            results.append({
                'id': r['id'],
                'target_id': r['target_id'],
                'target_name': r['target_name'],
                'conflict_type': r['conflict_type'],
                'conflict_details': r['conflict_details'],
                'severity': r['severity'],
                'scan_time': r['scan_time']
            })
        return results

    def clear_scan_results(self):
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM scan_results")
        conn.commit()
        conn.close()

    # Observation Plan methods
    def add_plan(self, plan: ObservationPlan) -> int:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO observation_plans (target_id, scheduled_time, status, notes)
            VALUES (?, ?, ?, ?)
        """, (plan.target_id, plan.scheduled_time, plan.status, plan.notes))
        new_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return new_id

    def update_plan_notes(self, plan_id: int, notes: str):
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE observation_plans SET notes = ? WHERE id = ?
        """, (notes, plan_id))
        conn.commit()
        conn.close()

    def update_plan_status(self, plan_id: int, status: str):
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE observation_plans SET status = ? WHERE id = ?
        """, (status, plan_id))
        conn.commit()
        conn.close()

    def get_plans_by_date(self, date: datetime) -> List[Dict]:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT op.*, ot.target_name, ot.priority, ot.ra, ot.dec
            FROM observation_plans op
            JOIN observation_targets ot ON op.target_id = ot.id
            WHERE date(op.scheduled_time) = date(?)
            ORDER BY op.scheduled_time
        """, (date,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(r) for r in rows]

    def get_plan_by_id(self, plan_id: int) -> Optional[Dict]:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT op.*, ot.target_name, ot.priority, ot.ra, ot.dec
            FROM observation_plans op
            JOIN observation_targets ot ON op.target_id = ot.id
            WHERE op.id = ?
        """, (plan_id,))
        row = cursor.fetchone()
        conn.close()
        if row:
            return dict(row)
        return None
