import json
import shutil
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

import yaml

from classroom_cluster.config import (
    ProjectConfig, load_config, save_config, get_data_path,
    DEFAULT_CONFIG_NAME, DEFAULT_DATA_DIR
)
from classroom_cluster.models import (
    QuestionItem, QuestionCluster, Chapter, generate_id
)
from classroom_cluster.review import ReviewSession, ReviewAction


class DataStore:
    def __init__(self, project_root: Path, config: Optional[ProjectConfig] = None):
        self.project_root = project_root
        self.config = config or load_config(project_root)
    
    def save_imported_file(
        self,
        file_path: Path,
        file_type: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Path:
        raw_dir = get_data_path(self.project_root, self.config, "raw")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        ext = file_path.suffix
        new_name = f"{file_type}_{timestamp}{ext}"
        dest_path = raw_dir / new_name
        
        shutil.copy2(file_path, dest_path)
        
        manifest_path = raw_dir / "import_manifest.json"
        manifest: List[Dict[str, Any]] = []
        
        if manifest_path.exists():
            try:
                with open(manifest_path, "r", encoding="utf-8") as f:
                    manifest = json.load(f)
            except (json.JSONDecodeError, IOError):
                    manifest = []
        
        manifest.append({
            "original_name": file_path.name,
            "stored_name": new_name,
            "file_type": file_type,
            "imported_at": datetime.now().isoformat(),
            "metadata": metadata or {},
        })
        
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)
        
        return dest_path
    
    def list_imported_files(self) -> List[Dict[str, Any]]:
        raw_dir = get_data_path(self.project_root, self.config, "raw")
        manifest_path = raw_dir / "import_manifest.json"
        
        if not manifest_path.exists():
            return []
        
        try:
            with open(manifest_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return []
    
    def save_questions(self, questions: List[QuestionItem]) -> Path:
        processed_dir = get_data_path(self.project_root, self.config, "processed")
        file_path = processed_dir / "questions.json"
        
        data = [q.to_dict() for q in questions]
        
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        return file_path
    
    def load_questions(self) -> List[QuestionItem]:
        processed_dir = get_data_path(self.project_root, self.config, "processed")
        file_path = processed_dir / "questions.json"
        
        if not file_path.exists():
            return []
        
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return [QuestionItem.from_dict(q) for q in data]
        except (json.JSONDecodeError, IOError):
            return []
    
    def save_chapters(self, chapters: List[Chapter]) -> Path:
        processed_dir = get_data_path(self.project_root, self.config, "processed")
        file_path = processed_dir / "chapters.json"
        
        data = [c.to_dict() for c in chapters]
        
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        return file_path
    
    def load_chapters(self) -> List[Chapter]:
        processed_dir = get_data_path(self.project_root, self.config, "processed")
        file_path = processed_dir / "chapters.json"
        
        if not file_path.exists():
            return []
        
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return [Chapter.from_dict(c) for c in data]
        except (json.JSONDecodeError, IOError):
            return []
    
    def save_clusters(self, clusters: List[QuestionCluster], metrics: Optional[Dict[str, Any]] = None) -> Path:
        clusters_dir = get_data_path(self.project_root, self.config, "clusters")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_path = clusters_dir / f"clusters_{timestamp}.json"
        
        data = {
            "generated_at": datetime.now().isoformat(),
            "metrics": metrics or {},
            "clusters": [c.to_dict() for c in clusters],
        }
        
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        latest_path = clusters_dir / "clusters_latest.json"
        with open(latest_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        return file_path
    
    def load_clusters(self, latest: bool = True) -> Tuple[List[QuestionCluster], Dict[str, Any]]:
        clusters_dir = get_data_path(self.project_root, self.config, "clusters")
        
        if latest:
            file_path = clusters_dir / "clusters_latest.json"
        else:
            cluster_files = sorted(clusters_dir.glob("clusters_*.json"))
            if not cluster_files:
                return [], {}
            file_path = cluster_files[-1]
        
        if not file_path.exists():
            return [], {}
        
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            clusters = [QuestionCluster.from_dict(c) for c in data.get("clusters", [])]
            metrics = data.get("metrics", {})
            
            return clusters, metrics
        except (json.JSONDecodeError, IOError):
            return [], {}
    
    def list_cluster_files(self) -> List[Dict[str, Any]]:
        clusters_dir = get_data_path(self.project_root, self.config, "clusters")
        cluster_files = sorted(clusters_dir.glob("clusters_*.json"))
        
        result = []
        for file_path in cluster_files:
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                
                result.append({
                    "file_name": file_path.name,
                    "generated_at": data.get("generated_at", ""),
                    "num_clusters": len(data.get("clusters", [])),
                    "metrics": data.get("metrics", {}),
                })
            except (json.JSONDecodeError, IOError):
                continue
        
        return result
    
    def save_review_session(self, session: ReviewSession) -> Path:
        reviews_dir = get_data_path(self.project_root, self.config, "reviews")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_path = reviews_dir / f"review_{timestamp}.json"
        
        data = session.to_dict()
        
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        latest_path = reviews_dir / "review_latest.json"
        with open(latest_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        return file_path
    
    def load_review_session(self, latest: bool = True) -> Optional[ReviewSession]:
        reviews_dir = get_data_path(self.project_root, self.config, "reviews")
        
        if latest:
            file_path = reviews_dir / "review_latest.json"
        else:
            review_files = sorted(reviews_dir.glob("review_*.json"))
            if not review_files:
                return None
            file_path = review_files[-1]
        
        if not file_path.exists():
            return None
        
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return ReviewSession.from_dict(data)
        except (json.JSONDecodeError, IOError):
            return None
    
    def save_report(self, content: str, report_type: str, ext: str = "md") -> Path:
        reports_dir = get_data_path(self.project_root, self.config, "reports")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_name = f"{report_type}_{timestamp}.{ext}"
        file_path = reports_dir / file_name
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        
        return file_path
    
    def list_reports(self) -> List[Dict[str, Any]]:
        reports_dir = get_data_path(self.project_root, self.config, "reports")
        report_files = sorted(reports_dir.glob("*"))
        
        result = []
        for file_path in report_files:
            if file_path.is_file():
                result.append({
                    "file_name": file_path.name,
                    "size_bytes": file_path.stat().st_size,
                    "modified_at": datetime.fromtimestamp(file_path.stat().st_mtime).isoformat(),
                })
        
        return result
    
    def get_project_info(self) -> Dict[str, Any]:
        questions = self.load_questions()
        chapters = self.load_chapters()
        clusters, metrics = self.load_clusters()
        
        return {
            "project_root": str(self.project_root),
            "config": asdict(self.config),
            "questions_count": len(questions),
            "chapters_count": len(chapters),
            "clusters_count": len(clusters),
            "imported_files": self.list_imported_files(),
            "cluster_files": self.list_cluster_files(),
        }
