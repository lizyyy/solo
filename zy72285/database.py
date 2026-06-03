import hashlib
import json
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple
from collections import defaultdict

from models import (
    FloorSectionSketch, PointCloudLog, Obstacle, SprinklerCoverage,
    ChangeHistory, ReviewReport, ThreeDView,
    ReviewStatus, DisplayMode, Role
)


def generate_hash(data: str) -> str:
    return hashlib.sha256(data.encode('utf-8')).hexdigest()


def generate_id() -> str:
    return str(uuid.uuid4())


class Database:
    def __init__(self):
        self.sketches: Dict[str, FloorSectionSketch] = {}
        self.point_cloud_logs: Dict[str, PointCloudLog] = {}
        self.obstacles: Dict[str, Obstacle] = {}
        self.coverages: Dict[str, SprinklerCoverage] = {}
        self.change_histories: List[ChangeHistory] = []
        self.review_reports: Dict[str, ReviewReport] = {}
        self.views_3d: Dict[str, ThreeDView] = {}

        self.sketch_hash_index: Dict[str, str] = {}
        self.log_hash_index: Dict[str, str] = {}
        self.coverage_by_sketch_obstacle: Dict[Tuple[str, str], str] = {}

    def save_sketch(self, sketch: FloorSectionSketch) -> FloorSectionSketch:
        self.sketches[sketch.id] = sketch
        self.sketch_hash_index[sketch.import_hash] = sketch.id
        return sketch

    def get_sketch_by_hash(self, import_hash: str) -> Optional[FloorSectionSketch]:
        sketch_id = self.sketch_hash_index.get(import_hash)
        return self.sketches.get(sketch_id) if sketch_id else None

    def save_log(self, log: PointCloudLog) -> PointCloudLog:
        self.point_cloud_logs[log.id] = log
        self.log_hash_index[log.log_hash] = log.id
        return log

    def get_log_by_hash(self, log_hash: str) -> Optional[PointCloudLog]:
        log_id = self.log_hash_index.get(log_hash)
        return self.point_cloud_logs.get(log_id) if log_id else None

    def save_obstacle(self, obstacle: Obstacle) -> Obstacle:
        self.obstacles[obstacle.id] = obstacle
        return obstacle

    def save_coverage(self, coverage: SprinklerCoverage) -> SprinklerCoverage:
        self.coverages[coverage.id] = coverage
        key = (coverage.sketch_id, coverage.obstacle_id)
        self.coverage_by_sketch_obstacle[key] = coverage.id
        return coverage

    def get_coverage_by_sketch_obstacle(self, sketch_id: str, obstacle_id: str) -> Optional[SprinklerCoverage]:
        key = (sketch_id, obstacle_id)
        coverage_id = self.coverage_by_sketch_obstacle.get(key)
        return self.coverages.get(coverage_id) if coverage_id else None

    def add_change_history(self, history: ChangeHistory) -> ChangeHistory:
        self.change_histories.append(history)
        return history

    def get_change_history(self, entity_type: str, entity_id: str) -> List[ChangeHistory]:
        return [h for h in self.change_histories
                if h.entity_type == entity_type and h.entity_id == entity_id]

    def save_report(self, report: ReviewReport) -> ReviewReport:
        self.review_reports[report.id] = report
        return report

    def save_3d_view(self, view: ThreeDView) -> ThreeDView:
        self.views_3d[view.id] = view
        return view

    def get_obstacles_by_sketch(self, sketch_id: str) -> List[Obstacle]:
        return [o for o in self.obstacles.values() if o.sketch_id == sketch_id]

    def get_coverages_by_sketch(self, sketch_id: str) -> List[SprinklerCoverage]:
        return [c for c in self.coverages.values() if c.sketch_id == sketch_id]

    def get_logs_by_sketch(self, sketch_id: str) -> List[PointCloudLog]:
        return [l for l in self.point_cloud_logs.values() if l.sketch_id == sketch_id]
