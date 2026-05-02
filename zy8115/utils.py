import json
import csv
from typing import Dict, List, Any, Optional
from pathlib import Path
from datetime import datetime

from models import (
    ReviewProject,
    Risk,
    RiskType,
    RiskLevel,
    LightingCue,
    TrackMarker,
    DeviceChannel
)


class ProjectPersistence:
    """项目持久化管理器"""
    
    @staticmethod
    def save_project(project: ReviewProject, file_path: str) -> bool:
        """保存项目到JSON文件"""
        try:
            file_path = Path(file_path)
            file_path.parent.mkdir(parents=True, exist_ok=True)
            
            project.updated_at = datetime.now()
            
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(project.to_dict(), f, ensure_ascii=False, indent=2)
            
            print(f"项目已保存到: {file_path}")
            return True
            
        except Exception as e:
            print(f"保存项目失败: {e}")
            return False
    
    @staticmethod
    def load_project(file_path: str) -> Optional[ReviewProject]:
        """从JSON文件加载项目"""
        try:
            file_path = Path(file_path)
            
            if not file_path.exists():
                print(f"项目文件不存在: {file_path}")
                return None
            
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            project = ReviewProject.from_dict(data)
            print(f"项目已从 {file_path} 加载")
            return project
            
        except Exception as e:
            print(f"加载项目失败: {e}")
            return None


class RiskConfirmationManager:
    """风险确认管理器"""
    
    def __init__(self, project: ReviewProject):
        self.project = project
    
    def confirm_risk(self, risk_id: str, user: str = "System", notes: str = "") -> bool:
        """确认一个风险"""
        for risk in self.project.risks:
            if risk.id == risk_id:
                risk.confirm(user)
                if notes:
                    risk.notes = notes
                self.project.updated_at = datetime.now()
                print(f"风险 {risk_id} 已由 {user} 确认")
                return True
        print(f"未找到风险: {risk_id}")
        return False
    
    def unconfirm_risk(self, risk_id: str) -> bool:
        """取消确认一个风险"""
        for risk in self.project.risks:
            if risk.id == risk_id:
                risk.is_confirmed = False
                risk.confirmed_by = None
                risk.confirmed_at = None
                self.project.updated_at = datetime.now()
                print(f"风险 {risk_id} 已取消确认")
                return True
        print(f"未找到风险: {risk_id}")
        return False
    
    def confirm_all_risks(self, user: str = "System") -> int:
        """确认所有风险"""
        count = 0
        for risk in self.project.risks:
            if not risk.is_confirmed:
                risk.confirm(user)
                count += 1
        self.project.updated_at = datetime.now()
        print(f"已确认 {count} 个风险")
        return count
    
    def get_risk_by_id(self, risk_id: str) -> Optional[Risk]:
        """根据ID获取风险"""
        for risk in self.project.risks:
            if risk.id == risk_id:
                return risk
        return None


class ReportExporter:
    """报告导出器"""
    
    @staticmethod
    def export_markdown(
        project: ReviewProject,
        file_path: str,
        include_confirmed: bool = True
    ) -> bool:
        """导出Markdown格式的复核报告"""
        try:
            file_path = Path(file_path)
            file_path.parent.mkdir(parents=True, exist_ok=True)
            
            # 统计信息
            total_risks = len(project.risks)
            unconfirmed_risks = len([r for r in project.risks if not r.is_confirmed])
            confirmed_risks = total_risks - unconfirmed_risks
            
            # 按类型统计
            risk_type_stats: Dict[str, int] = {}
            for risk in project.risks:
                risk_type = risk.risk_type.value
                risk_type_stats[risk_type] = risk_type_stats.get(risk_type, 0) + 1
            
            # 按级别统计
            risk_level_stats: Dict[str, int] = {}
            for risk in project.risks:
                level = risk.level.value
                risk_level_stats[level] = risk_level_stats.get(level, 0) + 1
            
            # 生成Markdown内容
            md_lines = []
            
            # 标题
            md_lines.append(f"# {project.name} - 灯光时间线复核报告")
            md_lines.append("")
            md_lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            md_lines.append(f"**项目创建时间**: {project.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
            if project.updated_at:
                md_lines.append(f"**最后更新时间**: {project.updated_at.strftime('%Y-%m-%d %H:%M:%S')}")
            md_lines.append("")
            
            # 统计摘要
            md_lines.append("## 统计摘要")
            md_lines.append("")
            md_lines.append(f"- **总风险数**: {total_risks}")
            md_lines.append(f"- **未确认风险**: {unconfirmed_risks}")
            md_lines.append(f"- **已确认风险**: {confirmed_risks}")
            md_lines.append("")
            
            # 风险级别分布
            md_lines.append("### 风险级别分布")
            md_lines.append("")
            md_lines.append("| 级别 | 数量 |")
            md_lines.append("|------|------|")
            for level in ["严重", "高", "中", "低"]:
                count = risk_level_stats.get(level, 0)
                md_lines.append(f"| {level} | {count} |")
            md_lines.append("")
            
            # 风险类型分布
            md_lines.append("### 风险类型分布")
            md_lines.append("")
            md_lines.append("| 类型 | 数量 |")
            md_lines.append("|------|------|")
            for risk_type, count in sorted(risk_type_stats.items(), key=lambda x: x[1], reverse=True):
                md_lines.append(f"| {risk_type} | {count} |")
            md_lines.append("")
            
            # 项目数据概览
            md_lines.append("## 项目数据概览")
            md_lines.append("")
            md_lines.append(f"- **灯光CUE数量**: {len(project.lighting_cues)}")
            md_lines.append(f"- **曲目标记数量**: {len(project.track_markers)}")
            md_lines.append(f"- **设备通道配置数量**: {len(project.device_channels)}")
            md_lines.append("")
            
            # 场景列表
            scenes = project.get_scenes()
            if scenes:
                md_lines.append("### 场景列表")
                md_lines.append("")
                for scene in sorted(scenes):
                    # 统计该场景的CUE数量
                    scene_cues = [c for c in project.lighting_cues if c.scene == scene]
                    md_lines.append(f"- **{scene}**: {len(scene_cues)} 个CUE")
                md_lines.append("")
            
            # 风险详情
            md_lines.append("## 风险详情")
            md_lines.append("")
            
            # 未确认风险
            if unconfirmed_risks > 0:
                md_lines.append("### 未确认风险")
                md_lines.append("")
                
                for risk in sorted(project.risks, key=lambda x: (
                    0 if x.level == RiskLevel.CRITICAL else
                    1 if x.level == RiskLevel.HIGH else
                    2 if x.level == RiskLevel.MEDIUM else 3,
                    x.time_reference or 0
                )):
                    if not risk.is_confirmed:
                        md_lines.append(f"#### [{risk.level.value}] {risk.title}")
                        md_lines.append("")
                        md_lines.append(f"- **风险ID**: {risk.id}")
                        md_lines.append(f"- **风险类型**: {risk.risk_type.value}")
                        if risk.time_reference is not None:
                            md_lines.append(f"- **参考时间**: {risk.time_reference:.2f}s")
                        if risk.affected_cues:
                            md_lines.append(f"- **影响CUE**: {', '.join(risk.affected_cues)}")
                        if risk.affected_channels:
                            md_lines.append(f"- **影响通道**: {', '.join(map(str, risk.affected_channels))}")
                        if risk.affected_tracks:
                            md_lines.append(f"- **影响曲目**: {', '.join(risk.affected_tracks)}")
                        md_lines.append("")
                        md_lines.append("**详细描述**:")
                        md_lines.append("")
                        for line in risk.description.split('\n'):
                            md_lines.append(f"> {line}")
                        md_lines.append("")
                        md_lines.append("---")
                        md_lines.append("")
            
            # 已确认风险
            if include_confirmed and confirmed_risks > 0:
                md_lines.append("### 已确认风险")
                md_lines.append("")
                
                for risk in sorted(project.risks, key=lambda x: (
                    0 if x.level == RiskLevel.CRITICAL else
                    1 if x.level == RiskLevel.HIGH else
                    2 if x.level == RiskLevel.MEDIUM else 3,
                    x.time_reference or 0
                )):
                    if risk.is_confirmed:
                        md_lines.append(f"#### [{risk.level.value}] {risk.title} (已确认)")
                        md_lines.append("")
                        md_lines.append(f"- **风险ID**: {risk.id}")
                        md_lines.append(f"- **风险类型**: {risk.risk_type.value}")
                        md_lines.append(f"- **确认人**: {risk.confirmed_by or '未知'}")
                        if risk.confirmed_at:
                            md_lines.append(f"- **确认时间**: {risk.confirmed_at.strftime('%Y-%m-%d %H:%M:%S')}")
                        if risk.notes:
                            md_lines.append(f"- **确认备注**: {risk.notes}")
                        md_lines.append("")
                        md_lines.append("**详细描述**:")
                        md_lines.append("")
                        for line in risk.description.split('\n'):
                            md_lines.append(f"> {line}")
                        md_lines.append("")
                        md_lines.append("---")
                        md_lines.append("")
            
            # CUE列表
            md_lines.append("## 灯光CUE列表")
            md_lines.append("")
            md_lines.append("| CUE编号 | 场景 | 描述 | 触发时间 | 关联曲目 | 通道数 |")
            md_lines.append("|---------|------|------|----------|----------|--------|")
            
            for cue in sorted(project.lighting_cues, key=lambda x: x.time):
                track_name = cue.track_name or "-"
                channel_count = len(cue.channels)
                md_lines.append(
                    f"| {cue.cue_number} | {cue.scene} | {cue.description} | "
                    f"{cue.time:.2f}s | {track_name} | {channel_count} |"
                )
            md_lines.append("")
            
            # 曲目时间轴
            if project.track_markers:
                md_lines.append("## 曲目时间轴")
                md_lines.append("")
                md_lines.append("| 曲目名称 | 开始时间 | 结束时间 | 时长 | CUE点数量 |")
                md_lines.append("|----------|----------|----------|------|-----------|")
                
                for track in sorted(project.track_markers, key=lambda x: x.start_time):
                    md_lines.append(
                        f"| {track.name} | {track.start_time:.2f}s | {track.end_time:.2f}s | "
                        f"{track.duration:.2f}s | {len(track.cue_points)} |"
                    )
                md_lines.append("")
            
            # 设备通道配置
            if project.device_channels:
                md_lines.append("## 设备通道配置")
                md_lines.append("")
                md_lines.append("| 通道号 | 设备名称 | 设备类型 | 场景 | 描述 |")
                md_lines.append("|--------|----------|----------|------|------|")
                
                for channel in sorted(project.device_channels, key=lambda x: x.channel_number):
                    desc = channel.description[:30] + "..." if len(channel.description) > 30 else channel.description
                    md_lines.append(
                        f"| {channel.channel_number} | {channel.device_name} | "
                        f"{channel.device_type} | {channel.scene} | {desc or '-'} |"
                    )
                md_lines.append("")
            
            # 写入文件
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write('\n'.join(md_lines))
            
            print(f"Markdown报告已导出到: {file_path}")
            return True
            
        except Exception as e:
            print(f"导出Markdown报告失败: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    @staticmethod
    def export_csv(
        project: ReviewProject,
        file_path: str,
        include_confirmed: bool = True
    ) -> bool:
        """导出CSV格式的复核报告"""
        try:
            file_path = Path(file_path)
            file_path.parent.mkdir(parents=True, exist_ok=True)
            
            # 准备风险数据
            risk_rows = []
            
            for risk in project.risks:
                if not include_confirmed and risk.is_confirmed:
                    continue
                
                row = {
                    '风险ID': risk.id,
                    '风险类型': risk.risk_type.value,
                    '风险级别': risk.level.value,
                    '标题': risk.title,
                    '详细描述': risk.description.replace('\n', '; '),
                    '影响CUE': ', '.join(risk.affected_cues) if risk.affected_cues else '',
                    '影响通道': ', '.join(map(str, risk.affected_channels)) if risk.affected_channels else '',
                    '影响曲目': ', '.join(risk.affected_tracks) if risk.affected_tracks else '',
                    '参考时间': f"{risk.time_reference:.2f}" if risk.time_reference is not None else '',
                    '是否已确认': '是' if risk.is_confirmed else '否',
                    '确认人': risk.confirmed_by or '',
                    '确认时间': risk.confirmed_at.strftime('%Y-%m-%d %H:%M:%S') if risk.confirmed_at else '',
                    '确认备注': risk.notes
                }
                risk_rows.append(row)
            
            # 写入CSV
            if risk_rows:
                fieldnames = list(risk_rows[0].keys())
                with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
                    writer = csv.DictWriter(f, fieldnames=fieldnames)
                    writer.writeheader()
                    writer.writerows(risk_rows)
                
                print(f"CSV报告已导出到: {file_path}")
                return True
            else:
                print("没有风险数据可导出")
                return False
                
        except Exception as e:
            print(f"导出CSV报告失败: {e}")
            return False
    
    @staticmethod
    def export_cue_list_csv(project: ReviewProject, file_path: str) -> bool:
        """导出CUE列表CSV"""
        try:
            file_path = Path(file_path)
            file_path.parent.mkdir(parents=True, exist_ok=True)
            
            rows = []
            for cue in sorted(project.lighting_cues, key=lambda x: x.time):
                row = {
                    'CUE编号': cue.cue_number,
                    '场景': cue.scene,
                    '描述': cue.description,
                    '触发时间': cue.time,
                    '关联曲目': cue.track_name or '',
                    '曲目相对时间': cue.track_time if cue.track_time is not None else '',
                    '通道数量': len(cue.channels),
                    '通道配置': str(cue.channels),
                    '淡入时间': cue.fade_in if cue.fade_in is not None else '',
                    '淡出时间': cue.fade_out if cue.fade_out is not None else '',
                    '备注': cue.notes
                }
                rows.append(row)
            
            if rows:
                fieldnames = list(rows[0].keys())
                with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
                    writer = csv.DictWriter(f, fieldnames=fieldnames)
                    writer.writeheader()
                    writer.writerows(rows)
                
                print(f"CUE列表已导出到: {file_path}")
                return True
            else:
                print("没有CUE数据可导出")
                return False
                
        except Exception as e:
            print(f"导出CUE列表失败: {e}")
            return False