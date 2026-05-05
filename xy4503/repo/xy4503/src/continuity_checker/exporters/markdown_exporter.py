from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Dict, List, Optional
from pathlib import Path

from ..storage.project_storage import ProjectData
from ..models.shot import Shot, ShotList, ShotStatus
from ..models.wardrobe import Wardrobe, Prop, WardrobeAnnotation
from ..models.actor import Actor, ActorNote
from ..models.call_sheet import CallSheet
from ..models.reshoot import ReshootRequirement, ReshootStatus
from ..models.check_result import CheckResult, Issue, IssueType, IssueSeverity, IssueStatus
from ..models.override import OverrideNote, OverrideCollection
from ..query.query_engine import QueryEngine


class MarkdownExporter:
    
    def __init__(self, project_data: ProjectData):
        self.data = project_data
        self.query_engine = QueryEngine(project_data)
    
    def export_continuity_report(
        self,
        output_path: Path,
        scene_number: str = None,
        include_issues: bool = True,
        include_reshoots: bool = True
    ) -> None:
        lines = []
        
        lines.append(f"# 连戏报告 - {self.data.project_name or '未命名项目'}")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        if scene_number:
            lines.append(f"## 场景 {scene_number} 详情")
            lines.append("")
            lines.extend(self._generate_scene_section(scene_number, include_issues, include_reshoots))
        else:
            lines.append("## 项目概览")
            lines.append("")
            lines.extend(self._generate_project_overview())
            lines.append("")
            lines.append("---")
            lines.append("")
            
            scenes = self._get_all_scenes()
            for scene in sorted(scenes):
                lines.append(f"## 场景 {scene}")
                lines.append("")
                lines.extend(self._generate_scene_section(scene, include_issues, include_reshoots))
                lines.append("")
                lines.append("---")
                lines.append("")
        
        if include_issues:
            lines.append("## 所有问题汇总")
            lines.append("")
            lines.extend(self._generate_issues_summary())
        
        content = "\n".join(lines)
        
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)
    
    def _generate_project_overview(self) -> List[str]:
        lines = []
        stats = self.query_engine.get_project_statistics()
        
        lines.append("### 基本信息")
        lines.append("")
        lines.append(f"- **项目ID**: {stats['project_id']}")
        lines.append(f"- **创建时间**: {stats['created_at'] or '未知'}")
        lines.append(f"- **最后更新**: {stats['updated_at'] or '未知'}")
        lines.append("")
        
        lines.append("### 数据统计")
        lines.append("")
        lines.append(f"- **总镜头数**: {stats['total_shots']}")
        lines.append(f"- **演员数**: {stats['total_actors']}")
        lines.append(f"- **服装数**: {stats['total_wardrobe_items']}")
        lines.append(f"- **道具数**: {stats['total_props']}")
        lines.append(f"- **通告单数**: {stats['total_call_sheets']}")
        lines.append(f"- **补拍需求**: {stats['total_reshoots']}")
        lines.append(f"- **问题总数**: {stats['total_issues']}")
        lines.append("")
        
        if stats['shots_by_status']:
            lines.append("### 镜头状态")
            lines.append("")
            for status, count in stats['shots_by_status'].items():
                lines.append(f"- **{status}**: {count}")
            lines.append("")
        
        if stats['issues_by_severity']:
            lines.append("### 问题严重程度")
            lines.append("")
            for severity, count in stats['issues_by_severity'].items():
                lines.append(f"- **{severity}**: {count}")
            lines.append("")
        
        return lines
    
    def _generate_scene_section(
        self, 
        scene_number: str, 
        include_issues: bool, 
        include_reshoots: bool
    ) -> List[str]:
        lines = []
        summary = self.query_engine.get_scene_summary(scene_number)
        
        lines.append(f"### 镜头概览")
        lines.append("")
        lines.append(f"- **总镜头数**: {summary['total_shots']}")
        if summary['shots_by_status']:
            for status, count in summary['shots_by_status'].items():
                lines.append(f"  - {status}: {count}")
        lines.append("")
        
        if summary['actors']:
            lines.append("### 参演演员")
            lines.append("")
            for actor in summary['actors']:
                lines.append(f"- {actor}")
            lines.append("")
        
        if summary['wardrobe_items']:
            lines.append("### 服装清单")
            lines.append("")
            for item in summary['wardrobe_items']:
                lines.append(f"- **{item['name']}** (演员: {item['actor']})")
                if item['description']:
                    lines.append(f"  - 描述: {item['description']}")
                if item['condition'] != 'good':
                    lines.append(f"  - 状态: {item['condition']}")
                lines.append("")
        
        if summary['props']:
            lines.append("### 道具清单")
            lines.append("")
            for item in summary['props']:
                lines.append(f"- **{item['name']}**")
                if item['description']:
                    lines.append(f"  - 描述: {item['description']}")
                if item['location']:
                    lines.append(f"  - 位置: {item['location']}")
                if item['condition'] != 'good':
                    lines.append(f"  - 状态: {item['condition']}")
                lines.append("")
        
        if include_issues and summary['issues']:
            lines.append("### 连戏问题")
            lines.append("")
            
            critical_issues = [i for i in summary['issues'] if i['severity'] == 'critical']
            high_issues = [i for i in summary['issues'] if i['severity'] == 'high']
            medium_issues = [i for i in summary['issues'] if i['severity'] == 'medium']
            low_issues = [i for i in summary['issues'] if i['severity'] == 'low']
            
            if critical_issues:
                lines.append("#### 🔴 严重问题")
                lines.append("")
                for issue in critical_issues:
                    lines.append(f"- **{issue['title']}**")
                    lines.append(f"  - 类型: {issue['issue_type']}")
                    lines.append(f"  - 状态: {issue['status']}")
                    if issue['description']:
                        lines.append(f"  - 描述: {issue['description']}")
                    lines.append("")
            
            if high_issues:
                lines.append("#### 🟠 高优先级问题")
                lines.append("")
                for issue in high_issues:
                    lines.append(f"- **{issue['title']}**")
                    lines.append(f"  - 类型: {issue['issue_type']}")
                    lines.append(f"  - 状态: {issue['status']}")
                    if issue['description']:
                        lines.append(f"  - 描述: {issue['description']}")
                    lines.append("")
            
            if medium_issues:
                lines.append("#### 🟡 中优先级问题")
                lines.append("")
                for issue in medium_issues:
                    lines.append(f"- **{issue['title']}**")
                    lines.append(f"  - 类型: {issue['issue_type']}")
                    lines.append(f"  - 状态: {issue['status']}")
                    if issue['description']:
                        lines.append(f"  - 描述: {issue['description']}")
                    lines.append("")
            
            if low_issues:
                lines.append("#### 🟢 低优先级问题")
                lines.append("")
                for issue in low_issues:
                    lines.append(f"- **{issue['title']}**")
                    lines.append(f"  - 类型: {issue['issue_type']}")
                    lines.append(f"  - 状态: {issue['status']}")
                    if issue['description']:
                        lines.append(f"  - 描述: {issue['description']}")
                    lines.append("")
        
        if include_reshoots and summary['reshoots']:
            lines.append("### 补拍需求")
            lines.append("")
            
            for reshoot in summary['reshoots']:
                lines.append(f"- **{reshoot['reshoot_id']}**")
                lines.append(f"  - 状态: {reshoot['status']}")
                lines.append(f"  - 优先级: {reshoot['priority']}")
                if reshoot['reason']:
                    lines.append(f"  - 原因: {reshoot['reason']}")
                if reshoot['actors_needed']:
                    lines.append(f"  - 需要演员: {', '.join(reshoot['actors_needed'])}")
                if reshoot['scheduled_date']:
                    lines.append(f"  - 计划日期: {reshoot['scheduled_date']}")
                lines.append("")
        
        return lines
    
    def _generate_issues_summary(self) -> List[str]:
        lines = []
        
        issues_result = self.query_engine.query_issues(status=IssueStatus.OPEN)
        open_issues = issues_result.data
        
        if not open_issues:
            lines.append("*暂无未解决的问题*")
            lines.append("")
            return lines
        
        critical_issues = [i for i in open_issues if i.severity == IssueSeverity.CRITICAL]
        high_issues = [i for i in open_issues if i.severity == IssueSeverity.HIGH]
        medium_issues = [i for i in open_issues if i.severity == IssueSeverity.MEDIUM]
        low_issues = [i for i in open_issues if i.severity == IssueSeverity.LOW]
        
        if critical_issues:
            lines.append("### 🔴 严重问题")
            lines.append("")
            for issue in critical_issues:
                scene_info = f" (场景 {issue.scene_number})" if issue.scene_number else ""
                lines.append(f"- **{issue.title}**{scene_info}")
                lines.append(f"  - 类型: {issue.issue_type.value}")
                if issue.description:
                    lines.append(f"  - 描述: {issue.description}")
                lines.append("")
        
        if high_issues:
            lines.append("### 🟠 高优先级问题")
            lines.append("")
            for issue in high_issues:
                scene_info = f" (场景 {issue.scene_number})" if issue.scene_number else ""
                lines.append(f"- **{issue.title}**{scene_info}")
                lines.append(f"  - 类型: {issue.issue_type.value}")
                if issue.description:
                    lines.append(f"  - 描述: {issue.description}")
                lines.append("")
        
        if medium_issues:
            lines.append("### 🟡 中优先级问题")
            lines.append("")
            for issue in medium_issues:
                scene_info = f" (场景 {issue.scene_number})" if issue.scene_number else ""
                lines.append(f"- **{issue.title}**{scene_info}")
                lines.append(f"  - 类型: {issue.issue_type.value}")
                if issue.description:
                    lines.append(f"  - 描述: {issue.description}")
                lines.append("")
        
        if low_issues:
            lines.append("### 🟢 低优先级问题")
            lines.append("")
            for issue in low_issues:
                scene_info = f" (场景 {issue.scene_number})" if issue.scene_number else ""
                lines.append(f"- **{issue.title}**{scene_info}")
                lines.append(f"  - 类型: {issue.issue_type.value}")
                if issue.description:
                    lines.append(f"  - 描述: {issue.description}")
                lines.append("")
        
        return lines
    
    def _get_all_scenes(self) -> List[str]:
        scenes = set()
        
        for shot in self.data.shot_list.shots:
            if shot.scene_number:
                scenes.add(shot.scene_number)
        
        for wardrobe in self.data.wardrobe_items.values():
            if wardrobe.scene_number:
                scenes.add(wardrobe.scene_number)
        
        for prop in self.data.prop_items.values():
            if prop.scene_number:
                scenes.add(prop.scene_number)
        
        return list(scenes)
