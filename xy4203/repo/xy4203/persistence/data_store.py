#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
持久化模块 - 数据保存和加载
"""

import json
import os
import shutil
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict, field
from pathlib import Path


@dataclass
class ManualAnnotation:
    """人工圈选标注数据结构"""
    id: str = ""
    page_number: int = 0
    annotation_type: str = ""  # "rectangle", "ellipse", "polygon", "freehand"
    coordinates: List[Dict] = field(default_factory=list)  # [{"x": 0, "y": 0}, ...]
    width: float = 0.0
    height: float = 0.0
    area: float = 0.0
    label: str = ""
    description: str = ""
    created_at: str = ""
    updated_at: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ReviewRecord:
    """复核记录数据结构"""
    id: str = ""
    page_number: int = 0
    review_status: str = ""  # "pending", "reviewing", "approved", "flagged", "rejected"
    reviewer_name: str = ""
    review_date: str = ""
    review_notes: str = ""
    issues_found: List[Dict] = field(default_factory=list)
    manual_annotations: List[ManualAnnotation] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ProjectData:
    """项目数据结构"""
    project_id: str = ""
    project_name: str = ""
    created_at: str = ""
    updated_at: str = ""
    description: str = ""
    
    # 源文件路径
    before_image_paths: Dict[int, str] = field(default_factory=dict)  # {page_number: path}
    after_image_paths: Dict[int, str] = field(default_factory=dict)
    defect_csv_path: str = ""
    material_csv_path: str = ""
    
    # 解析后的数据
    page_numbers: List[int] = field(default_factory=list)
    
    # 分析结果
    analysis_results: Dict[str, Any] = field(default_factory=dict)
    
    # 复核记录
    review_records: Dict[int, ReviewRecord] = field(default_factory=dict)  # {page_number: record}
    
    # 人工标注
    manual_annotations: Dict[int, List[ManualAnnotation]] = field(default_factory=dict)  # {page_number: [annotations]}
    
    # 问题列表
    issues: List[Dict] = field(default_factory=list)
    
    # 元数据
    metadata: Dict[str, Any] = field(default_factory=dict)


class DataStore:
    """
    数据存储管理器
    负责项目数据的保存、加载和管理
    """
    
    def __init__(self, data_dir: str = None):
        """
        初始化数据存储
        
        Args:
            data_dir: 数据存储目录（默认为当前目录下的data文件夹）
        """
        if data_dir is None:
            data_dir = os.path.join(os.getcwd(), "data")
        
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        self.projects_dir = self.data_dir / "projects"
        self.projects_dir.mkdir(parents=True, exist_ok=True)
        
        self.current_project: Optional[ProjectData] = None
    
    def create_project(self, project_name: str, description: str = "") -> ProjectData:
        """
        创建新项目
        
        Args:
            project_name: 项目名称
            description: 项目描述
            
        Returns:
            创建的项目数据
        """
        project_id = self._generate_project_id()
        
        project = ProjectData(
            project_id=project_id,
            project_name=project_name,
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat(),
            description=description
        )
        
        self.current_project = project
        
        # 创建项目目录
        project_dir = self.projects_dir / project_id
        project_dir.mkdir(parents=True, exist_ok=True)
        
        # 保存项目
        self.save_project()
        
        return project
    
    def load_project(self, project_id: str) -> Optional[ProjectData]:
        """
        加载项目
        
        Args:
            project_id: 项目ID
            
        Returns:
            项目数据（加载失败返回None）
        """
        project_file = self.projects_dir / project_id / "project.json"
        
        if not project_file.exists():
            return None
        
        try:
            with open(project_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # 转换为ProjectData对象
            project = self._dict_to_project(data)
            self.current_project = project
            
            return project
            
        except Exception as e:
            print(f"加载项目失败: {e}")
            return None
    
    def save_project(self) -> bool:
        """
        保存当前项目
        
        Returns:
            是否保存成功
        """
        if self.current_project is None:
            return False
        
        try:
            # 更新时间戳
            self.current_project.updated_at = datetime.now().isoformat()
            
            # 转换为字典
            data = self._project_to_dict(self.current_project)
            
            # 保存到文件
            project_dir = self.projects_dir / self.current_project.project_id
            project_dir.mkdir(parents=True, exist_ok=True)
            
            project_file = project_dir / "project.json"
            with open(project_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            
            return True
            
        except Exception as e:
            print(f"保存项目失败: {e}")
            return False
    
    def delete_project(self, project_id: str) -> bool:
        """
        删除项目
        
        Args:
            project_id: 项目ID
            
        Returns:
            是否删除成功
        """
        project_dir = self.projects_dir / project_id
        
        if not project_dir.exists():
            return False
        
        try:
            shutil.rmtree(project_dir)
            
            # 如果是当前项目，清除
            if self.current_project and self.current_project.project_id == project_id:
                self.current_project = None
            
            return True
            
        except Exception as e:
            print(f"删除项目失败: {e}")
            return False
    
    def list_projects(self) -> List[Dict]:
        """
        列出所有项目
        
        Returns:
            项目列表（包含基本信息）
        """
        projects = []
        
        if not self.projects_dir.exists():
            return projects
        
        for project_dir in self.projects_dir.iterdir():
            if project_dir.is_dir():
                project_file = project_dir / "project.json"
                if project_file.exists():
                    try:
                        with open(project_file, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                        
                        projects.append({
                            "project_id": data.get("project_id", ""),
                            "project_name": data.get("project_name", ""),
                            "created_at": data.get("created_at", ""),
                            "updated_at": data.get("updated_at", ""),
                            "description": data.get("description", ""),
                            "page_count": len(data.get("page_numbers", [])),
                            "issue_count": len(data.get("issues", []))
                        })
                    except Exception:
                        continue
        
        # 按更新时间排序（最新在前）
        projects.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
        
        return projects
    
    def add_image_paths(self, page_number: int, before_path: str, after_path: str) -> bool:
        """
        添加图像路径
        
        Args:
            page_number: 页码
            before_path: 修复前图像路径
            after_path: 修复后图像路径
            
        Returns:
            是否添加成功
        """
        if self.current_project is None:
            return False
        
        self.current_project.before_image_paths[page_number] = before_path
        self.current_project.after_image_paths[page_number] = after_path
        
        if page_number not in self.current_project.page_numbers:
            self.current_project.page_numbers.append(page_number)
            self.current_project.page_numbers.sort()
        
        return True
    
    def add_manual_annotation(self, page_number: int, annotation: ManualAnnotation) -> bool:
        """
        添加人工圈选标注
        
        Args:
            page_number: 页码
            annotation: 标注数据
            
        Returns:
            是否添加成功
        """
        if self.current_project is None:
            return False
        
        # 生成ID
        if not annotation.id:
            annotation.id = f"manual_{page_number}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        # 设置时间戳
        if not annotation.created_at:
            annotation.created_at = datetime.now().isoformat()
        annotation.updated_at = datetime.now().isoformat()
        
        # 添加到项目
        if page_number not in self.current_project.manual_annotations:
            self.current_project.manual_annotations[page_number] = []
        
        self.current_project.manual_annotations[page_number].append(annotation)
        
        return True
    
    def get_manual_annotations(self, page_number: int) -> List[ManualAnnotation]:
        """
        获取指定页码的人工标注
        
        Args:
            page_number: 页码
            
        Returns:
            标注列表
        """
        if self.current_project is None:
            return []
        
        return self.current_project.manual_annotations.get(page_number, [])
    
    def update_review_record(self, page_number: int, record: ReviewRecord) -> bool:
        """
        更新复核记录
        
        Args:
            page_number: 页码
            record: 复核记录
            
        Returns:
            是否更新成功
        """
        if self.current_project is None:
            return False
        
        # 生成ID
        if not record.id:
            record.id = f"review_{page_number}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        # 设置时间戳
        if not record.review_date:
            record.review_date = datetime.now().isoformat()
        
        self.current_project.review_records[page_number] = record
        
        return True
    
    def get_review_record(self, page_number: int) -> Optional[ReviewRecord]:
        """
        获取指定页码的复核记录
        
        Args:
            page_number: 页码
            
        Returns:
            复核记录（不存在返回None）
        """
        if self.current_project is None:
            return None
        
        return self.current_project.review_records.get(page_number)
    
    def add_issue(self, issue: Dict) -> bool:
        """
        添加问题到问题列表
        
        Args:
            issue: 问题数据
            
        Returns:
            是否添加成功
        """
        if self.current_project is None:
            return False
        
        # 添加时间戳
        if "timestamp" not in issue:
            issue["timestamp"] = datetime.now().isoformat()
        
        # 添加ID
        if "id" not in issue:
            issue["id"] = f"issue_{len(self.current_project.issues) + 1}"
        
        self.current_project.issues.append(issue)
        
        return True
    
    def update_analysis_results(self, results: Dict[str, Any]) -> bool:
        """
        更新分析结果
        
        Args:
            results: 分析结果字典
            
        Returns:
            是否更新成功
        """
        if self.current_project is None:
            return False
        
        self.current_project.analysis_results.update(results)
        
        return True
    
    def export_project_data(self, export_path: str) -> bool:
        """
        导出项目数据（用于审计包）
        
        Args:
            export_path: 导出路径
            
        Returns:
            是否导出成功
        """
        if self.current_project is None:
            return False
        
        try:
            # 转换为字典
            data = self._project_to_dict(self.current_project)
            
            # 保存到导出路径
            with open(export_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            
            return True
            
        except Exception as e:
            print(f"导出项目数据失败: {e}")
            return False
    
    def _generate_project_id(self) -> str:
        """
        生成项目ID
        
        Returns:
            项目ID字符串
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return f"proj_{timestamp}"
    
    def _project_to_dict(self, project: ProjectData) -> Dict:
        """
        将ProjectData对象转换为字典
        
        Args:
            project: ProjectData对象
            
        Returns:
            字典表示
        """
        # 基础转换
        data = asdict(project)
        
        # 处理特殊字段
        # 复核记录
        if "review_records" in data:
            review_records = {}
            for page_num, record in project.review_records.items():
                # 转换ManualAnnotation列表
                record_dict = asdict(record)
                if "manual_annotations" in record_dict:
                    record_dict["manual_annotations"] = [
                        asdict(ann) for ann in record.manual_annotations
                    ]
                review_records[str(page_num)] = record_dict
            data["review_records"] = review_records
        
        # 人工标注
        if "manual_annotations" in data:
            manual_annotations = {}
            for page_num, annotations in project.manual_annotations.items():
                manual_annotations[str(page_num)] = [
                    asdict(ann) for ann in annotations
                ]
            data["manual_annotations"] = manual_annotations
        
        # 图像路径（键转换为字符串）
        if "before_image_paths" in data:
            data["before_image_paths"] = {
                str(k): v for k, v in project.before_image_paths.items()
            }
        if "after_image_paths" in data:
            data["after_image_paths"] = {
                str(k): v for k, v in project.after_image_paths.items()
            }
        
        return data
    
    def _dict_to_project(self, data: Dict) -> ProjectData:
        """
        将字典转换为ProjectData对象
        
        Args:
            data: 字典数据
            
        Returns:
            ProjectData对象
        """
        # 基础转换
        project = ProjectData()
        
        # 设置基础字段
        project.project_id = data.get("project_id", "")
        project.project_name = data.get("project_name", "")
        project.created_at = data.get("created_at", "")
        project.updated_at = data.get("updated_at", "")
        project.description = data.get("description", "")
        project.page_numbers = data.get("page_numbers", [])
        project.analysis_results = data.get("analysis_results", {})
        project.issues = data.get("issues", [])
        project.metadata = data.get("metadata", {})
        
        # 图像路径（键转换为整数）
        before_paths = data.get("before_image_paths", {})
        project.before_image_paths = {
            int(k): v for k, v in before_paths.items()
        }
        
        after_paths = data.get("after_image_paths", {})
        project.after_image_paths = {
            int(k): v for k, v in after_paths.items()
        }
        
        # 复核记录
        review_records_data = data.get("review_records", {})
        for page_num_str, record_data in review_records_data.items():
            try:
                page_num = int(page_num_str)
                record = ReviewRecord(
                    id=record_data.get("id", ""),
                    page_number=record_data.get("page_number", 0),
                    review_status=record_data.get("review_status", ""),
                    reviewer_name=record_data.get("reviewer_name", ""),
                    review_date=record_data.get("review_date", ""),
                    review_notes=record_data.get("review_notes", ""),
                    issues_found=record_data.get("issues_found", []),
                    metadata=record_data.get("metadata", {})
                )
                
                # 转换人工标注
                annotations_data = record_data.get("manual_annotations", [])
                record.manual_annotations = []
                for ann_data in annotations_data:
                    annotation = ManualAnnotation(
                        id=ann_data.get("id", ""),
                        page_number=ann_data.get("page_number", 0),
                        annotation_type=ann_data.get("annotation_type", ""),
                        coordinates=ann_data.get("coordinates", []),
                        width=ann_data.get("width", 0.0),
                        height=ann_data.get("height", 0.0),
                        area=ann_data.get("area", 0.0),
                        label=ann_data.get("label", ""),
                        description=ann_data.get("description", ""),
                        created_at=ann_data.get("created_at", ""),
                        updated_at=ann_data.get("updated_at", ""),
                        metadata=ann_data.get("metadata", {})
                    )
                    record.manual_annotations.append(annotation)
                
                project.review_records[page_num] = record
                
            except (ValueError, TypeError):
                continue
        
        # 人工标注
        annotations_data = data.get("manual_annotations", {})
        for page_num_str, ann_list_data in annotations_data.items():
            try:
                page_num = int(page_num_str)
                project.manual_annotations[page_num] = []
                
                for ann_data in ann_list_data:
                    annotation = ManualAnnotation(
                        id=ann_data.get("id", ""),
                        page_number=ann_data.get("page_number", 0),
                        annotation_type=ann_data.get("annotation_type", ""),
                        coordinates=ann_data.get("coordinates", []),
                        width=ann_data.get("width", 0.0),
                        height=ann_data.get("height", 0.0),
                        area=ann_data.get("area", 0.0),
                        label=ann_data.get("label", ""),
                        description=ann_data.get("description", ""),
                        created_at=ann_data.get("created_at", ""),
                        updated_at=ann_data.get("updated_at", ""),
                        metadata=ann_data.get("metadata", {})
                    )
                    project.manual_annotations[page_num].append(annotation)
                    
            except (ValueError, TypeError):
                continue
        
        return project
