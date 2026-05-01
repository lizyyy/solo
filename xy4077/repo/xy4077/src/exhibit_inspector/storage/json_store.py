"""JSON会话存储"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from pydantic import BaseModel

from ..models import (
    AuditPackage,
    SessionMetadata,
    TransportConfig,
    RouteBook,
    BoxInfo,
    PhotoRecord,
    Issue,
    ReviewRecord,
)


class SessionNotFoundError(Exception):
    """会话未找到错误"""
    pass


class JsonSessionStore:
    """JSON格式会话存储"""
    
    METADATA_FILE = "metadata.json"
    CONFIG_FILE = "config.json"
    ROUTE_FILE = "route.json"
    BOXES_FILE = "boxes.json"
    PHOTOS_FILE = "photos.json"
    ISSUES_FILE = "issues.json"
    REVIEWS_FILE = "reviews.json"
    AUDIT_FILE = "audit.json"
    SENSOR_STATS_FILE = "sensor_stats.json"
    IMPORT_SUMMARY_FILE = "import_summary.json"
    
    def __init__(self, base_dir: str | Path):
        self.base_dir = Path(base_dir)
    
    def create_session(
        self,
        shipment_id: str,
        tool_version: str,
        operator: Optional[str] = None,
    ) -> Path:
        """
        创建新会话目录
        
        Args:
            shipment_id: 运输批次编号
            tool_version: 工具版本
            operator: 操作人员
            
        Returns:
            会话目录路径
        """
        now = datetime.now()
        session_id = f"{shipment_id}_{now.strftime('%Y%m%d_%H%M%S')}"
        
        session_dir = self.base_dir / session_id
        session_dir.mkdir(parents=True, exist_ok=True)
        
        metadata = SessionMetadata(
            session_id=session_id,
            shipment_id=shipment_id,
            created_at=now.isoformat(),
            updated_at=now.isoformat(),
            tool_version=tool_version,
            operator=operator,
        )
        
        self._save_json(session_dir / self.METADATA_FILE, metadata.model_dump())
        
        return session_dir
    
    def get_session_dir(self, shipment_id: str, session_id: Optional[str] = None) -> Path:
        """
        获取会话目录
        
        Args:
            shipment_id: 运输批次编号
            session_id: 可选的会话ID，如果不指定则使用最新的
            
        Returns:
            会话目录路径
        """
        if session_id:
            session_dir = self.base_dir / session_id
            if session_dir.exists():
                return session_dir
            raise SessionNotFoundError(f"会话不存在: {session_id}")
        
        sessions = []
        if self.base_dir.exists():
            for d in self.base_dir.iterdir():
                if d.is_dir() and d.name.startswith(shipment_id):
                    sessions.append(d)
        
        if not sessions:
            raise SessionNotFoundError(f"未找到运输批次 {shipment_id} 的会话")
        
        sessions.sort(key=lambda d: d.name, reverse=True)
        return sessions[0]
    
    def load_metadata(self, session_dir: Path) -> SessionMetadata:
        """加载会话元数据"""
        data = self._load_json(session_dir / self.METADATA_FILE)
        return SessionMetadata(**data)
    
    def save_metadata(self, session_dir: Path, metadata: SessionMetadata) -> None:
        """保存会话元数据"""
        metadata.updated_at = datetime.now().isoformat()
        self._save_json(session_dir / self.METADATA_FILE, metadata.model_dump())
    
    def load_config(self, session_dir: Path) -> Optional[TransportConfig]:
        """加载运输配置"""
        config_file = session_dir / self.CONFIG_FILE
        if not config_file.exists():
            return None
        data = self._load_json(config_file)
        return TransportConfig(**data)
    
    def save_config(self, session_dir: Path, config: TransportConfig) -> None:
        """保存运输配置"""
        config.updated_at = datetime.now().isoformat()
        self._save_json(session_dir / self.CONFIG_FILE, config.model_dump())
        self._touch_metadata(session_dir)
    
    def load_route(self, session_dir: Path) -> Optional[RouteBook]:
        """加载路书"""
        route_file = session_dir / self.ROUTE_FILE
        if not route_file.exists():
            return None
        data = self._load_json(route_file)
        return RouteBook(**data)
    
    def save_route(self, session_dir: Path, route_book: RouteBook) -> None:
        """保存路书"""
        self._save_json(session_dir / self.ROUTE_FILE, route_book.model_dump())
        self._touch_metadata(session_dir)
    
    def load_boxes(self, session_dir: Path) -> list[BoxInfo]:
        """加载展箱列表"""
        boxes_file = session_dir / self.BOXES_FILE
        if not boxes_file.exists():
            return []
        data = self._load_json(boxes_file)
        return [BoxInfo(**item) for item in data]
    
    def save_boxes(self, session_dir: Path, boxes: list[BoxInfo]) -> None:
        """保存展箱列表"""
        self._save_json(
            session_dir / self.BOXES_FILE,
            [box.model_dump() for box in boxes],
        )
        self._touch_metadata(session_dir)
    
    def load_photos(self, session_dir: Path) -> list[PhotoRecord]:
        """加载照片记录"""
        photos_file = session_dir / self.PHOTOS_FILE
        if not photos_file.exists():
            return []
        data = self._load_json(photos_file)
        return [PhotoRecord(**item) for item in data]
    
    def save_photos(self, session_dir: Path, photos: list[PhotoRecord]) -> None:
        """保存照片记录"""
        self._save_json(
            session_dir / self.PHOTOS_FILE,
            [photo.model_dump() for photo in photos],
        )
        self._touch_metadata(session_dir)
    
    def load_issues(self, session_dir: Path) -> list[Issue]:
        """加载问题列表"""
        issues_file = session_dir / self.ISSUES_FILE
        if not issues_file.exists():
            return []
        data = self._load_json(issues_file)
        return [self._parse_issue(item) for item in data]
    
    def save_issues(self, session_dir: Path, issues: list[Issue]) -> None:
        """保存问题列表"""
        self._save_json(
            session_dir / self.ISSUES_FILE,
            [issue.model_dump() for issue in issues],
        )
        self._touch_metadata(session_dir, "processed_at")
    
    def load_reviews(self, session_dir: Path) -> list[ReviewRecord]:
        """加载复核记录"""
        reviews_file = session_dir / self.REVIEWS_FILE
        if not reviews_file.exists():
            return []
        data = self._load_json(reviews_file)
        return [ReviewRecord(**item) for item in data]
    
    def save_reviews(self, session_dir: Path, reviews: list[ReviewRecord]) -> None:
        """保存复核记录"""
        self._save_json(
            session_dir / self.REVIEWS_FILE,
            [review.model_dump() for review in reviews],
        )
        self._touch_metadata(session_dir, "reviewed_at")
    
    def load_audit_package(self, session_dir: Path) -> Optional[AuditPackage]:
        """加载审计包"""
        audit_file = session_dir / self.AUDIT_FILE
        if not audit_file.exists():
            return None
        data = self._load_json(audit_file)
        return self._parse_audit_package(data)
    
    def save_audit_package(self, session_dir: Path, audit: AuditPackage) -> None:
        """保存审计包"""
        self._save_json(session_dir / self.AUDIT_FILE, audit.model_dump())
        self._touch_metadata(session_dir, "exported_at")
    
    def load_sensor_stats(self, session_dir: Path) -> Optional[dict]:
        """加载传感器统计"""
        stats_file = session_dir / self.SENSOR_STATS_FILE
        if not stats_file.exists():
            return None
        return self._load_json(stats_file)
    
    def save_sensor_stats(self, session_dir: Path, stats: dict) -> None:
        """保存传感器统计"""
        self._save_json(session_dir / self.SENSOR_STATS_FILE, stats)
        self._touch_metadata(session_dir)
    
    def load_import_summary(self, session_dir: Path) -> Optional[dict]:
        """加载导入摘要"""
        summary_file = session_dir / self.IMPORT_SUMMARY_FILE
        if not summary_file.exists():
            return None
        return self._load_json(summary_file)
    
    def save_import_summary(self, session_dir: Path, summary: dict) -> None:
        """保存导入摘要"""
        self._save_json(session_dir / self.IMPORT_SUMMARY_FILE, summary)
        self._touch_metadata(session_dir)
    
    def _parse_issue(self, data: dict) -> Issue:
        """解析问题数据"""
        from ..models import (
            IssueType,
            ShockPeakIssue,
            TemperatureIssue,
            HumidityIssue,
            OpenBoxMismatchIssue,
            MissingPhotoIssue,
            MissingEvidenceIssue,
            MissingSampleIssue,
        )
        
        issue_type = data.get("issue_type")
        
        if issue_type == IssueType.SHOCK_PEAK:
            return ShockPeakIssue(**data)
        elif issue_type in [IssueType.TEMPERATURE_OVER, IssueType.TEMPERATURE_UNDER]:
            return TemperatureIssue(**data)
        elif issue_type in [IssueType.HUMIDITY_OVER, IssueType.HUMIDITY_UNDER]:
            return HumidityIssue(**data)
        elif issue_type == IssueType.OPENBOX_MISMATCH:
            return OpenBoxMismatchIssue(**data)
        elif issue_type == IssueType.MISSING_PHOTO:
            return MissingPhotoIssue(**data)
        elif issue_type == IssueType.MISSING_EVIDENCE:
            return MissingEvidenceIssue(**data)
        elif issue_type == IssueType.MISSING_SAMPLE:
            return MissingSampleIssue(**data)
        
        return Issue(**data)
    
    def _parse_audit_package(self, data: dict) -> AuditPackage:
        """解析审计包数据"""
        metadata_data = data.get("metadata", {})
        metadata = SessionMetadata(**metadata_data)
        
        config_data = data.get("config")
        config = TransportConfig(**config_data) if config_data else None
        
        route_data = data.get("route_book")
        route_book = RouteBook(**route_data) if route_data else None
        
        boxes_data = data.get("boxes", [])
        boxes = [BoxInfo(**item) for item in boxes_data]
        
        photos_data = data.get("photos", [])
        photos = [PhotoRecord(**item) for item in photos_data]
        
        issues_data = data.get("issues", [])
        issues = [self._parse_issue(item) for item in issues_data]
        
        reviews_data = data.get("reviews", [])
        reviews = [ReviewRecord(**item) for item in reviews_data]
        
        return AuditPackage(
            metadata=metadata,
            config=config,
            route_book=route_book,
            boxes=boxes,
            photos=photos,
            sensor_record_count=data.get("sensor_record_count", 0),
            sensor_stats=data.get("sensor_stats"),
            issues=issues,
            reviews=reviews,
            import_files=data.get("import_files", {}),
            import_summary=data.get("import_summary"),
            analysis_summary=data.get("analysis_summary"),
        )
    
    def _save_json(self, path: Path, data: Any) -> None:
        """保存JSON文件"""
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)
    
    def _load_json(self, path: Path) -> Any:
        """加载JSON文件"""
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    
    def _touch_metadata(self, session_dir: Path, field: Optional[str] = None) -> None:
        """更新元数据时间戳"""
        try:
            metadata = self.load_metadata(session_dir)
            metadata.updated_at = datetime.now().isoformat()
            
            if field == "processed_at":
                metadata.processed_at = metadata.updated_at
            elif field == "reviewed_at":
                metadata.reviewed_at = metadata.updated_at
            elif field == "exported_at":
                metadata.exported_at = metadata.updated_at
            
            self._save_json(session_dir / self.METADATA_FILE, metadata.model_dump())
        except Exception:
            pass
