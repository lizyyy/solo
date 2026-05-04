import os
import csv
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
from collections import defaultdict

from db.database import db_manager
from db.models import AudioFile, ValidationIssue, Project, Episode
from utils.audio_utils import format_duration, format_file_size
from core.validator import IssueType


class Exporter:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def export_markdown_delivery_note(self, project_id: int, 
                                        output_path: str,
                                        include_issues: bool = True,
                                        include_statistics: bool = True) -> bool:
        try:
            project = db_manager.get_project_by_id(project_id)
            if not project:
                return False
            
            audio_files = db_manager.get_audio_files_by_project(project_id)
            issues = db_manager.get_issues_by_project(project_id)
            episodes = db_manager.get_episodes_by_project(project_id)
            
            issues_by_file = defaultdict(list)
            for issue in issues:
                issues_by_file[issue.audio_file_id].append(issue)
            
            md_content = self._generate_markdown_delivery_note(
                project, audio_files, episodes, issues_by_file, 
                include_issues, include_statistics
            )
            
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(md_content)
            
            return True
            
        except Exception as e:
            print(f"导出 Markdown 失败: {e}")
            return False
    
    def _generate_markdown_delivery_note(self, project: Project,
                                           audio_files: List[AudioFile],
                                           episodes: List[Episode],
                                           issues_by_file: Dict[int, List[ValidationIssue]],
                                           include_issues: bool,
                                           include_statistics: bool) -> str:
        lines = []
        
        lines.append(f"# 多轨素材交付单")
        lines.append("")
        lines.append(f"**项目名称**: {project.name}")
        lines.append(f"**导出时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**项目路径**: {project.folder_path}")
        lines.append("")
        
        if include_statistics and audio_files:
            lines.append("## 统计概览")
            lines.append("")
            
            total_files = len(audio_files)
            total_duration = sum(af.duration_seconds or 0 for af in audio_files)
            total_size = sum(af.file_size or 0 for af in audio_files)
            
            lines.append(f"- **总文件数**: {total_files} 个")
            lines.append(f"- **总时长**: {format_duration(total_duration)}")
            lines.append(f"- **总大小**: {format_file_size(total_size)}")
            lines.append("")
            
            role_stats = defaultdict(int)
            format_stats = defaultdict(int)
            quality_stats = defaultdict(int)
            
            for af in audio_files:
                if af.role:
                    role_stats[af.role] += 1
                if af.format:
                    format_stats[af.format.upper()] += 1
                if af.recording_quality:
                    quality_stats[af.recording_quality] += 1
            
            if role_stats:
                lines.append(f"- **角色分布**: {', '.join([f'{k}: {v}个' for k, v in role_stats.items()])}")
            if format_stats:
                lines.append(f"- **格式分布**: {', '.join([f'{k}: {v}个' for k, v in format_stats.items()])}")
            lines.append("")
        
        if episodes:
            lines.append("## 集数列表")
            lines.append("")
            lines.append("| 集数 | 标题 | 状态 | 音频数 |")
            lines.append("|------|------|------|--------|")
            
            for ep in episodes:
                ep_files = [af for af in audio_files if af.episode_id == ep.id]
                lines.append(f"| {ep.episode_number} | {ep.title or '-'} | {ep.status} | {len(ep_files)} |")
            lines.append("")
        
        lines.append("## 素材清单")
        lines.append("")
        
        files_by_role = defaultdict(list)
        for af in audio_files:
            role = af.role or "未分类"
            files_by_role[role].append(af)
        
        for role, files in sorted(files_by_role.items()):
            lines.append(f"### {role} ({len(files)} 个)")
            lines.append("")
            lines.append("| 文件名 | 格式 | 采样率 | 声道 | 时长 | 状态 | 问题 |")
            lines.append("|--------|------|--------|------|------|------|------|")
            
            for af in sorted(files, key=lambda x: x.file_name):
                issues = issues_by_file.get(af.id, [])
                issue_count = len([i for i in issues if not i.resolved])
                
                format_str = af.format.upper() if af.format else "-"
                sample_rate_str = f"{af.sample_rate} Hz" if af.sample_rate else "-"
                channels_str = f"{af.channels}ch" if af.channels else "-"
                duration_str = format_duration(af.duration_seconds)
                status_str = af.editing_status or "未剪辑"
                issue_str = f"⚠️ {issue_count}" if issue_count > 0 else "✅"
                
                lines.append(f"| {af.file_name} | {format_str} | {sample_rate_str} | {channels_str} | {duration_str} | {status_str} | {issue_str} |")
            
            lines.append("")
        
        if include_issues and issues:
            unresolved_issues = [i for i in issues if not i.resolved]
            
            if unresolved_issues:
                lines.append("## 问题清单")
                lines.append("")
                lines.append("| 严重程度 | 问题类型 | 文件名 | 描述 |")
                lines.append("|----------|----------|--------|------|")
                
                for issue in sorted(unresolved_issues, key=lambda x: (
                    0 if x.severity == "error" else 1 if x.severity == "warning" else 2,
                    x.issue_type
                )):
                    af = next((af for af in audio_files if af.id == issue.audio_file_id), None)
                    file_name = af.file_name if af else "未知文件"
                    severity_emoji = "🔴" if issue.severity == "error" else "🟡" if issue.severity == "warning" else "🔵"
                    issue_type_name = self._get_issue_type_name(issue.issue_type)
                    
                    lines.append(f"| {severity_emoji} {issue.severity} | {issue_type_name} | {file_name} | {issue.description} |")
                
                lines.append("")
        
        lines.append("---")
        lines.append(f"*此交付单由「多轨素材交付台」生成于 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*")
        
        return "\n".join(lines)
    
    def _get_issue_type_name(self, issue_type: str) -> str:
        type_names = {
            IssueType.SAMPLE_RATE_MISMATCH.value: "采样率不一致",
            IssueType.MISSING_ROLE_TRACK.value: "缺少角色轨",
            IssueType.DUPLICATE_NAME_DIFFERENT_CONTENT.value: "同名不同内容",
            IssueType.LONG_SILENCE.value: "静音过长",
            IssueType.CHANNELS_MISMATCH.value: "声道数不一致",
            IssueType.UNKNOWN_ROLE.value: "未知角色",
            IssueType.FILE_NOT_FOUND.value: "文件不存在",
        }
        return type_names.get(issue_type, issue_type)
    
    def export_csv_issues(self, project_id: int, output_path: str,
                           include_resolved: bool = False) -> bool:
        try:
            issues = db_manager.get_issues_by_project(project_id)
            audio_files = db_manager.get_audio_files_by_project(project_id)
            
            file_map = {af.id: af for af in audio_files}
            
            if not include_resolved:
                issues = [i for i in issues if not i.resolved]
            
            with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
                writer = csv.writer(f)
                writer.writerow([
                    "问题ID", "严重程度", "问题类型", "问题类型描述",
                    "文件名", "文件路径", "描述", "检测时间", "是否已解决"
                ])
                
                for issue in issues:
                    af = file_map.get(issue.audio_file_id)
                    file_name = af.file_name if af else "未知文件"
                    file_path = af.file_path if af else ""
                    issue_type_name = self._get_issue_type_name(issue.issue_type)
                    
                    writer.writerow([
                        issue.id,
                        issue.severity,
                        issue.issue_type,
                        issue_type_name,
                        file_name,
                        file_path,
                        issue.description,
                        issue.detected_at.strftime("%Y-%m-%d %H:%M:%S") if issue.detected_at else "",
                        "是" if issue.resolved else "否"
                    ])
            
            return True
            
        except Exception as e:
            print(f"导出 CSV 失败: {e}")
            return False
    
    def export_csv_material_list(self, project_id: int, output_path: str) -> bool:
        try:
            audio_files = db_manager.get_audio_files_by_project(project_id)
            episodes = db_manager.get_episodes_by_project(project_id)
            
            episode_map = {ep.id: ep for ep in episodes}
            
            with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
                writer = csv.writer(f)
                writer.writerow([
                    "文件名", "文件路径", "格式", "采样率", "声道",
                    "比特率", "时长(秒)", "时长(格式化)", "文件大小(字节)", "文件大小(格式化)",
                    "角色", "集数", "收音质量", "剪辑状态", "交付版本", "哈希值"
                ])
                
                for af in sorted(audio_files, key=lambda x: x.file_name):
                    ep = episode_map.get(af.episode_id)
                    episode_number = ep.episode_number if ep else ""
                    
                    writer.writerow([
                        af.file_name,
                        af.file_path,
                        af.format or "",
                        af.sample_rate or "",
                        af.channels or "",
                        af.bit_rate or "",
                        af.duration_seconds or "",
                        format_duration(af.duration_seconds),
                        af.file_size or "",
                        format_file_size(af.file_size),
                        af.role or "",
                        episode_number,
                        af.recording_quality or "",
                        af.editing_status or "",
                        af.delivery_version or "",
                        af.hash_value or ""
                    ])
            
            return True
            
        except Exception as e:
            print(f"导出素材清单 CSV 失败: {e}")
            return False
    
    def generate_default_output_path(self, project_folder: str, 
                                      file_type: str,
                                      timestamp: bool = True) -> str:
        project_name = Path(project_folder).name
        timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S") if timestamp else ""
        
        if timestamp_str:
            base_name = f"{project_name}_{file_type}_{timestamp_str}"
        else:
            base_name = f"{project_name}_{file_type}"
        
        if file_type == "delivery_note":
            ext = ".md"
        else:
            ext = ".csv"
        
        output_dir = Path(project_folder) / "output"
        output_dir.mkdir(parents=True, exist_ok=True)
        
        return str(output_dir / (base_name + ext))


exporter = Exporter()
