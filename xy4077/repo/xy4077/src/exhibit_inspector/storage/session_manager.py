"""会话管理器"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from .. import __version__
from ..models import (
    TransportConfig,
    ThresholdSettings,
    RouteBook,
    BoxInfo,
    PhotoRecord,
    Issue,
    ReviewRecord,
    ReviewStatus,
    ReviewConclusion,
    AuditPackage,
    SessionMetadata,
)
from .json_store import JsonSessionStore, SessionNotFoundError


@dataclass
class ActiveSession:
    """活动会话"""
    session_id: str
    shipment_id: str
    session_dir: Path
    metadata: SessionMetadata
    config: Optional[TransportConfig] = None
    route_book: Optional[RouteBook] = None
    boxes: list[BoxInfo] = field(default_factory=list)
    photos: list[PhotoRecord] = field(default_factory=list)
    sensor_records: list[Any] = field(default_factory=list)
    issues: list[Issue] = field(default_factory=list)
    reviews: list[ReviewRecord] = field(default_factory=list)
    import_summary: Optional[dict] = None
    sensor_stats: Optional[dict] = None


class SessionManager:
    """会话管理器"""
    
    def __init__(self, data_dir: str | Path):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.store = JsonSessionStore(self.data_dir)
        self._active_session: Optional[ActiveSession] = None
    
    @property
    def active_session(self) -> Optional[ActiveSession]:
        """获取当前活动会话"""
        return self._active_session
    
    def init_transport(
        self,
        shipment_id: str,
        shipment_name: str,
        origin: str,
        destination: str,
        carrier: str,
        transport_mode: str = "road",
        thresholds: Optional[ThresholdSettings] = None,
        operator: Optional[str] = None,
    ) -> ActiveSession:
        """
        初始化新运输配置
        
        Args:
            shipment_id: 运输批次编号
            shipment_name: 运输批次名称
            origin: 始发地
            destination: 目的地
            carrier: 承运方
            transport_mode: 运输方式
            thresholds: 阈值设置
            operator: 操作人员
            
        Returns:
            活动会话
        """
        session_dir = self.store.create_session(
            shipment_id=shipment_id,
            tool_version=__version__,
            operator=operator,
        )
        
        if thresholds is None:
            thresholds = ThresholdSettings()
        
        now = datetime.now().isoformat()
        config = TransportConfig(
            shipment_id=shipment_id,
            shipment_name=shipment_name,
            origin=origin,
            destination=destination,
            carrier=carrier,
            transport_mode=transport_mode,
            thresholds=thresholds,
            created_at=now,
            updated_at=now,
        )
        
        self.store.save_config(session_dir, config)
        
        metadata = self.store.load_metadata(session_dir)
        self._active_session = ActiveSession(
            session_id=metadata.session_id,
            shipment_id=metadata.shipment_id,
            session_dir=session_dir,
            metadata=metadata,
            config=config,
        )
        
        return self._active_session
    
    def load_session(
        self,
        shipment_id: str,
        session_id: Optional[str] = None,
    ) -> ActiveSession:
        """
        加载现有会话
        
        Args:
            shipment_id: 运输批次编号
            session_id: 可选的会话ID
            
        Returns:
            活动会话
        """
        try:
            session_dir = self.store.get_session_dir(shipment_id, session_id)
        except SessionNotFoundError:
            raise ValueError(f"未找到运输批次 {shipment_id} 的会话")
        
        metadata = self.store.load_metadata(session_dir)
        config = self.store.load_config(session_dir)
        route_book = self.store.load_route(session_dir)
        boxes = self.store.load_boxes(session_dir)
        photos = self.store.load_photos(session_dir)
        issues = self.store.load_issues(session_dir)
        reviews = self.store.load_reviews(session_dir)
        import_summary = self.store.load_import_summary(session_dir)
        sensor_stats = self.store.load_sensor_stats(session_dir)
        
        self._active_session = ActiveSession(
            session_id=metadata.session_id,
            shipment_id=metadata.shipment_id,
            session_dir=session_dir,
            metadata=metadata,
            config=config,
            route_book=route_book,
            boxes=boxes,
            photos=photos,
            issues=issues,
            reviews=reviews,
            import_summary=import_summary,
            sensor_stats=sensor_stats,
        )
        
        return self._active_session
    
    def save_imported_data(
        self,
        route_book: Optional[RouteBook] = None,
        boxes: Optional[list[BoxInfo]] = None,
        photos: Optional[list[PhotoRecord]] = None,
        sensor_records: Optional[list] = None,
        import_summary: Optional[dict] = None,
        sensor_stats: Optional[dict] = None,
    ) -> None:
        """
        保存导入的数据
        
        Args:
            route_book: 路书
            boxes: 展箱列表
            photos: 照片记录
            sensor_records: 传感器记录
            import_summary: 导入摘要
            sensor_stats: 传感器统计
        """
        if self._active_session is None:
            raise ValueError("没有活动会话")
        
        if route_book is not None:
            self._active_session.route_book = route_book
            self.store.save_route(self._active_session.session_dir, route_book)
        
        if boxes is not None:
            self._active_session.boxes = boxes
            self.store.save_boxes(self._active_session.session_dir, boxes)
        
        if photos is not None:
            self._active_session.photos = photos
            self.store.save_photos(self._active_session.session_dir, photos)
        
        if sensor_records is not None:
            self._active_session.sensor_records = sensor_records
        
        if import_summary is not None:
            self._active_session.import_summary = import_summary
            self.store.save_import_summary(self._active_session.session_dir, import_summary)
        
        if sensor_stats is not None:
            self._active_session.sensor_stats = sensor_stats
            self.store.save_sensor_stats(self._active_session.session_dir, sensor_stats)
    
    def save_issues(self, issues: list[Issue]) -> None:
        """
        保存分析出的问题
        
        Args:
            issues: 问题列表
        """
        if self._active_session is None:
            raise ValueError("没有活动会话")
        
        self._active_session.issues = issues
        self.store.save_issues(self._active_session.session_dir, issues)
    
    def add_review(
        self,
        issue_id: str,
        reviewer: str,
        status: ReviewStatus,
        conclusion: Optional[ReviewConclusion] = None,
        comments: Optional[str] = None,
        actions_required: Optional[list[str]] = None,
    ) -> ReviewRecord:
        """
        添加复核记录
        
        Args:
            issue_id: 关联的问题编号
            reviewer: 复核人
            status: 复核状态
            conclusion: 复核结论
            comments: 复核意见
            actions_required: 需要采取的行动
            
        Returns:
            创建的复核记录
        """
        if self._active_session is None:
            raise ValueError("没有活动会话")
        
        import uuid
        now = datetime.now().isoformat()
        
        review = ReviewRecord(
            review_id=f"REV_{uuid.uuid4().hex[:8].upper()}",
            issue_id=issue_id,
            reviewer=reviewer,
            review_time=now,
            status=status,
            conclusion=conclusion,
            comments=comments,
            actions_required=actions_required,
            created_at=now,
            updated_at=now,
        )
        
        self._active_session.reviews.append(review)
        self.store.save_reviews(self._active_session.session_dir, self._active_session.reviews)
        
        return review
    
    def update_review(
        self,
        review_id: str,
        status: Optional[ReviewStatus] = None,
        conclusion: Optional[ReviewConclusion] = None,
        comments: Optional[str] = None,
        reviewer: Optional[str] = None,
    ) -> Optional[ReviewRecord]:
        """
        更新复核记录
        
        Args:
            review_id: 复核记录编号
            status: 新的状态
            conclusion: 新的结论
            comments: 新的意见
            reviewer: 新的复核人
            
        Returns:
            更新后的复核记录
        """
        if self._active_session is None:
            raise ValueError("没有活动会话")
        
        for review in self._active_session.reviews:
            if review.review_id == review_id:
                if status is not None:
                    review.status = status
                if conclusion is not None:
                    review.conclusion = conclusion
                if comments is not None:
                    review.comments = comments
                if reviewer is not None:
                    review.reviewer = reviewer
                
                review.updated_at = datetime.now().isoformat()
                self.store.save_reviews(self._active_session.session_dir, self._active_session.reviews)
                return review
        
        return None
    
    def build_audit_package(self) -> AuditPackage:
        """
        构建审计包
        
        Returns:
            完整的审计包
        """
        if self._active_session is None:
            raise ValueError("没有活动会话")
        
        return AuditPackage(
            metadata=self._active_session.metadata,
            config=self._active_session.config,
            route_book=self._active_session.route_book,
            boxes=self._active_session.boxes,
            photos=self._active_session.photos,
            sensor_record_count=len(self._active_session.sensor_records),
            sensor_stats=self._active_session.sensor_stats,
            issues=self._active_session.issues,
            reviews=self._active_session.reviews,
            import_summary=self._active_session.import_summary,
        )
    
    def save_audit_package(self) -> Path:
        """
        保存审计包
        
        Returns:
            审计包文件路径
        """
        if self._active_session is None:
            raise ValueError("没有活动会话")
        
        audit = self.build_audit_package()
        self.store.save_audit_package(self._active_session.session_dir, audit)
        
        return self._active_session.session_dir / self.store.AUDIT_FILE
    
    def list_sessions(self, shipment_id: Optional[str] = None) -> list[dict]:
        """
        列出所有会话
        
        Args:
            shipment_id: 可选的运输批次过滤
            
        Returns:
            会话信息列表
        """
        sessions = []
        
        if not self.data_dir.exists():
            return sessions
        
        for d in self.data_dir.iterdir():
            if not d.is_dir():
                continue
            
            metadata_file = d / self.store.METADATA_FILE
            if not metadata_file.exists():
                continue
            
            try:
                metadata = self.store.load_metadata(d)
                
                if shipment_id and metadata.shipment_id != shipment_id:
                    continue
                
                sessions.append({
                    "session_id": metadata.session_id,
                    "shipment_id": metadata.shipment_id,
                    "created_at": metadata.created_at,
                    "updated_at": metadata.updated_at,
                    "operator": metadata.operator,
                    "processed": metadata.processed_at is not None,
                    "reviewed": metadata.reviewed_at is not None,
                    "exported": metadata.exported_at is not None,
                })
            except Exception:
                continue
        
        sessions.sort(key=lambda s: s["created_at"], reverse=True)
        return sessions
