import json
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from .models import (
    ProjectState, CallSheetVersion, VersionDiff,
    Conflict, ConflictType, Issue, IssueSeverity
)


class ReportGenerator:
    def generate_summary_report(self, state: ProjectState, output_path: str) -> str:
        report_lines = []
        report_lines.append("=" * 80)
        report_lines.append(f"剧组通告单变更报告")
        report_lines.append(f"项目: {state.project_name}")
        report_lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append("=" * 80)
        report_lines.append("")
        
        report_lines.append("【一、版本概览】")
        report_lines.append("-" * 60)
        report_lines.append(f"总拍摄天数: {len(state.shoot_dates)}")
        report_lines.append(f"总版本数: {len(state.versions)}")
        report_lines.append("")
        
        for shoot_date_str, versions in sorted(state.shoot_dates.items()):
            report_lines.append(f"  {shoot_date_str}: {len(versions)} 个版本 ({', '.join(versions)})")
        report_lines.append("")
        
        all_conflicts = state.all_conflicts
        all_issues = state.all_issues
        
        report_lines.append("【二、问题统计】")
        report_lines.append("-" * 60)
        
        errors = [i for i in all_issues if i.severity == IssueSeverity.ERROR]
        warnings = [i for i in all_issues if i.severity == IssueSeverity.WARNING]
        
        report_lines.append(f"错误: {len(errors)} 个")
        report_lines.append(f"警告: {len(warnings)} 个")
        report_lines.append("")
        
        report_lines.append("【三、冲突统计】")
        report_lines.append("-" * 60)
        
        actor_conflicts = [c for c in all_conflicts if c.conflict_type == ConflictType.ACTOR_TIME_CONFLICT]
        vehicle_conflicts = [c for c in all_conflicts if c.conflict_type == ConflictType.VEHICLE_TIME_CONFLICT]
        location_conflicts = [c for c in all_conflicts if c.conflict_type == ConflictType.SCENE_LOCATION_CONFLICT]
        version_changes = [c for c in all_conflicts if c.conflict_type == ConflictType.VERSION_CHANGE]
        
        report_lines.append(f"演员时间冲突: {len(actor_conflicts)} 个")
        report_lines.append(f"车辆时间冲突: {len(vehicle_conflicts)} 个")
        report_lines.append(f"地点使用冲突: {len(location_conflicts)} 个")
        report_lines.append(f"版本间变更: {len(version_changes)} 个")
        report_lines.append("")
        
        report_lines.append("【四、最近版本详情】")
        report_lines.append("-" * 60)
        
        latest_versions = self._get_latest_versions(state)
        for shoot_date_str, version in sorted(latest_versions.items()):
            report_lines.append(f"\n拍摄日期: {shoot_date_str}")
            report_lines.append(f"最新版本: {version.version}")
            report_lines.append(f"导入时间: {version.imported_at.strftime('%Y-%m-%d %H:%M:%S')}")
            report_lines.append(f"来源文件: {version.source_file}")
            report_lines.append(f"场景数: {len(version.scenes)}")
            report_lines.append(f"演员数: {len(version.actors)}")
            report_lines.append(f"车辆数: {len(version.vehicles)}")
            
            if version.issues:
                report_lines.append(f"  问题: {len(version.issues)} 个")
            if version.conflicts:
                report_lines.append(f"  冲突: {len(version.conflicts)} 个")
        
        report_lines.append("")
        report_lines.append("【五、需要关注的问题】")
        report_lines.append("-" * 60)
        
        if errors:
            report_lines.append(f"\n错误 ({len(errors)} 个):")
            for err in errors[:10]:
                report_lines.append(f"  - [{err.source}] {err.message}")
                if err.line_number:
                    report_lines.append(f"    行号: {err.line_number}, 字段: {err.field or '-'}, 值: {err.value or '-'}")
        
        if actor_conflicts:
            report_lines.append(f"\n演员时间冲突 ({len(actor_conflicts)} 个):")
            for c in actor_conflicts[:5]:
                report_lines.append(f"  - {c.description}")
                d = c.details
                report_lines.append(f"    {d['conflict_1']['source']}: {d['conflict_1']['start']} - {d['conflict_1']['end']}")
                report_lines.append(f"    {d['conflict_2']['source']}: {d['conflict_2']['start']} - {d['conflict_2']['end']}")
        
        if vehicle_conflicts:
            report_lines.append(f"\n车辆时间冲突 ({len(vehicle_conflicts)} 个):")
            for c in vehicle_conflicts[:5]:
                report_lines.append(f"  - {c.description}")
                d = c.details
                report_lines.append(f"    {d['conflict_1']['source']}: {d['conflict_1']['start']} - {d['conflict_1']['end']}")
                report_lines.append(f"    {d['conflict_2']['source']}: {d['conflict_2']['start']} - {d['conflict_2']['end']}")
        
        report_lines.append("")
        report_lines.append("=" * 80)
        report_lines.append("报告结束")
        report_lines.append("=" * 80)
        
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        with open(output_file, "w", encoding="utf-8") as f:
            f.write("\n".join(report_lines))
        
        return str(output_file)

    def generate_issue_report(self, state: ProjectState, output_path: str) -> str:
        report_lines = []
        report_lines.append("=" * 80)
        report_lines.append("问题详情报告")
        report_lines.append(f"项目: {state.project_name}")
        report_lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append("=" * 80)
        report_lines.append("")
        
        errors = [i for i in state.all_issues if i.severity == IssueSeverity.ERROR]
        warnings = [i for i in state.all_issues if i.severity == IssueSeverity.WARNING]
        
        report_lines.append(f"错误 ({len(errors)} 个):")
        report_lines.append("-" * 40)
        for idx, issue in enumerate(errors, 1):
            report_lines.append(f"{idx}. {issue.message}")
            report_lines.append(f"   来源: {issue.source}")
            report_lines.append(f"   类型: {issue.issue_type.value}")
            if issue.field:
                report_lines.append(f"   字段: {issue.field}")
            if issue.value:
                report_lines.append(f"   值: {issue.value}")
            if issue.line_number:
                report_lines.append(f"   行号: {issue.line_number}")
            report_lines.append("")
        
        report_lines.append(f"\n警告 ({len(warnings)} 个):")
        report_lines.append("-" * 40)
        for idx, issue in enumerate(warnings, 1):
            report_lines.append(f"{idx}. {issue.message}")
            report_lines.append(f"   来源: {issue.source}")
            report_lines.append(f"   类型: {issue.issue_type.value}")
            if issue.field:
                report_lines.append(f"   字段: {issue.field}")
            if issue.value:
                report_lines.append(f"   值: {issue.value}")
            if issue.line_number:
                report_lines.append(f"   行号: {issue.line_number}")
            report_lines.append("")
        
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        with open(output_file, "w", encoding="utf-8") as f:
            f.write("\n".join(report_lines))
        
        return str(output_file)

    def generate_conflict_report(self, state: ProjectState, output_path: str) -> str:
        report_lines = []
        report_lines.append("=" * 80)
        report_lines.append("冲突详情报告")
        report_lines.append(f"项目: {state.project_name}")
        report_lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append("=" * 80)
        report_lines.append("")
        
        actor_conflicts = [c for c in state.all_conflicts if c.conflict_type == ConflictType.ACTOR_TIME_CONFLICT]
        vehicle_conflicts = [c for c in state.all_conflicts if c.conflict_type == ConflictType.VEHICLE_TIME_CONFLICT]
        location_conflicts = [c for c in state.all_conflicts if c.conflict_type == ConflictType.SCENE_LOCATION_CONFLICT]
        version_changes = [c for c in state.all_conflicts if c.conflict_type == ConflictType.VERSION_CHANGE]
        
        if actor_conflicts:
            report_lines.append(f"【演员时间冲突】({len(actor_conflicts)} 个)")
            report_lines.append("-" * 40)
            for idx, c in enumerate(actor_conflicts, 1):
                report_lines.append(f"{idx}. {c.description}")
                d = c.details
                report_lines.append(f"   冲突1: {d['conflict_1']['source']} ({d['conflict_1']['start']} - {d['conflict_1']['end']})")
                report_lines.append(f"   冲突2: {d['conflict_2']['source']} ({d['conflict_2']['start']} - {d['conflict_2']['end']})")
                report_lines.append("")
        
        if vehicle_conflicts:
            report_lines.append(f"【车辆时间冲突】({len(vehicle_conflicts)} 个)")
            report_lines.append("-" * 40)
            for idx, c in enumerate(vehicle_conflicts, 1):
                report_lines.append(f"{idx}. {c.description}")
                d = c.details
                report_lines.append(f"   冲突1: {d['conflict_1']['source']} ({d['conflict_1']['start']} - {d['conflict_1']['end']}) [{d['conflict_1'].get('usage', '-')}]")
                report_lines.append(f"   冲突2: {d['conflict_2']['source']} ({d['conflict_2']['start']} - {d['conflict_2']['end']}) [{d['conflict_2'].get('usage', '-')}]")
                report_lines.append("")
        
        if location_conflicts:
            report_lines.append(f"【地点使用冲突】({len(location_conflicts)} 个)")
            report_lines.append("-" * 40)
            for idx, c in enumerate(location_conflicts, 1):
                report_lines.append(f"{idx}. {c.description}")
                d = c.details
                report_lines.append(f"   地点: {d['location']}")
                report_lines.append(f"   场景1: {d['scene_1']['number']} ({d['scene_1']['start']} - {d['scene_1']['end']})")
                report_lines.append(f"   场景2: {d['scene_2']['number']} ({d['scene_2']['start']} - {d['scene_2']['end']})")
                report_lines.append("")
        
        if version_changes:
            report_lines.append(f"【版本间变更】({len(version_changes)} 个)")
            report_lines.append("-" * 40)
            for idx, c in enumerate(version_changes, 1):
                report_lines.append(f"{idx}. {c.description}")
                report_lines.append(f"   版本: {c.version_from} -> {c.version_to}")
                report_lines.append(f"   详情: {json.dumps(c.details, ensure_ascii=False)}")
                report_lines.append("")
        
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        with open(output_file, "w", encoding="utf-8") as f:
            f.write("\n".join(report_lines))
        
        return str(output_file)

    def generate_diff_report(self, diff: VersionDiff, output_path: str) -> str:
        report_lines = []
        report_lines.append("=" * 80)
        report_lines.append("版本差异报告")
        report_lines.append(f"对比: {diff.version_from} -> {diff.version_to}")
        report_lines.append(f"拍摄日期: {diff.shoot_date}")
        report_lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append("=" * 80)
        report_lines.append("")
        
        if not diff.has_changes():
            report_lines.append("两个版本没有差异。")
        else:
            report_lines.append("【场景变更】")
            report_lines.append("-" * 40)
            if diff.scenes_added:
                report_lines.append(f"新增场景 ({len(diff.scenes_added)} 个):")
                for s in diff.scenes_added:
                    report_lines.append(f"  + {s.number}: {s.location}")
            if diff.scenes_removed:
                report_lines.append(f"删除场景 ({len(diff.scenes_removed)} 个):")
                for s in diff.scenes_removed:
                    report_lines.append(f"  - {s.number}: {s.location}")
            if diff.scenes_modified:
                report_lines.append(f"修改场景 ({len(diff.scenes_modified)} 个):")
                for m in diff.scenes_modified:
                    report_lines.append(f"  ~ {m['scene_number']}:")
                    for field, change in m['changes'].items():
                        report_lines.append(f"    {field}: {change.get('from', '-')} -> {change.get('to', '-')}")
            report_lines.append("")
            
            report_lines.append("【演员变更】")
            report_lines.append("-" * 40)
            if diff.actors_added:
                report_lines.append(f"新增演员 ({len(diff.actors_added)} 个):")
                for a in diff.actors_added:
                    report_lines.append(f"  + {a.name} ({a.role})")
            if diff.actors_removed:
                report_lines.append(f"删除演员 ({len(diff.actors_removed)} 个):")
                for a in diff.actors_removed:
                    report_lines.append(f"  - {a.name} ({a.role})")
            if diff.actors_modified:
                report_lines.append(f"修改演员 ({len(diff.actors_modified)} 个):")
                for m in diff.actors_modified:
                    report_lines.append(f"  ~ {m['actor_name']}:")
                    for field, change in m['changes'].items():
                        if field == 'scenes':
                            if change.get('added'):
                                report_lines.append(f"    新增场景: {', '.join(change['added'])}")
                            if change.get('removed'):
                                report_lines.append(f"    删除场景: {', '.join(change['removed'])}")
                        else:
                            report_lines.append(f"    {field}: {change.get('from', '-')} -> {change.get('to', '-')}")
            report_lines.append("")
            
            report_lines.append("【车辆变更】")
            report_lines.append("-" * 40)
            if diff.vehicles_added:
                report_lines.append(f"新增车辆 ({len(diff.vehicles_added)} 个):")
                for v in diff.vehicles_added:
                    report_lines.append(f"  + {v.id} ({v.type})")
            if diff.vehicles_removed:
                report_lines.append(f"删除车辆 ({len(diff.vehicles_removed)} 个):")
                for v in diff.vehicles_removed:
                    report_lines.append(f"  - {v.id} ({v.type})")
            if diff.vehicles_modified:
                report_lines.append(f"修改车辆 ({len(diff.vehicles_modified)} 个):")
                for m in diff.vehicles_modified:
                    report_lines.append(f"  ~ {m['vehicle_id']}:")
                    for field, change in m['changes'].items():
                        report_lines.append(f"    {field}: {change.get('from', '-')} -> {change.get('to', '-')}")
        
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        with open(output_file, "w", encoding="utf-8") as f:
            f.write("\n".join(report_lines))
        
        return str(output_file)

    def generate_field_distribution_report(self, version: CallSheetVersion, output_path: str) -> str:
        report_lines = []
        report_lines.append("=" * 80)
        report_lines.append("现场分发报告")
        report_lines.append(f"拍摄日期: {version.shoot_date}")
        report_lines.append(f"版本: {version.version}")
        report_lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append("=" * 80)
        report_lines.append("")
        
        location_groups: dict = {}
        for scene in version.scenes:
            loc = scene.location or "未指定地点"
            if loc not in location_groups:
                location_groups[loc] = []
            location_groups[loc].append(scene)
        
        report_lines.append("【按地点分发】")
        report_lines.append("-" * 60)
        for location, scenes in sorted(location_groups.items()):
            report_lines.append(f"\n地点: {location}")
            report_lines.append(f"场景数: {len(scenes)}")
            for scene in sorted(scenes, key=lambda s: s.number):
                time_str = ""
                if scene.call_time:
                    time_str = f"{scene.call_time.strftime('%H:%M')}"
                if scene.wrap_time:
                    time_str += f" - {scene.wrap_time.strftime('%H:%M')}"
                
                report_lines.append(f"\n  场景 {scene.number}:")
                if time_str:
                    report_lines.append(f"    时间: {time_str}")
                if scene.actors:
                    report_lines.append(f"    演员: {', '.join(scene.actors)}")
                if scene.vehicles:
                    report_lines.append(f"    车辆: {', '.join(scene.vehicles)}")
                if scene.description:
                    report_lines.append(f"    内容: {scene.description}")
        
        report_lines.append("\n" + "=" * 60)
        report_lines.append("【演员清单】")
        report_lines.append("-" * 60)
        for actor in sorted(version.actors, key=lambda a: a.name):
            time_str = ""
            if actor.call_time:
                time_str = f"到场: {actor.call_time.strftime('%H:%M')}"
            if actor.wrap_time:
                time_str += f", 收工: {actor.wrap_time.strftime('%H:%M')}"
            
            report_lines.append(f"\n{actor.name} ({actor.role}):")
            if time_str:
                report_lines.append(f"  {time_str}")
            if actor.scenes:
                report_lines.append(f"  场景: {', '.join(actor.scenes)}")
            if actor.notes:
                report_lines.append(f"  备注: {actor.notes}")
        
        report_lines.append("\n" + "=" * 60)
        report_lines.append("【车辆调度】")
        report_lines.append("-" * 60)
        for vehicle in sorted(version.vehicles, key=lambda v: v.id):
            time_str = ""
            if vehicle.start_time:
                time_str = f"出发: {vehicle.start_time.strftime('%H:%M')}"
            if vehicle.end_time:
                time_str += f", 返回: {vehicle.end_time.strftime('%H:%M')}"
            
            report_lines.append(f"\n{vehicle.id} ({vehicle.type}):")
            if vehicle.driver:
                report_lines.append(f"  司机: {vehicle.driver}")
            if vehicle.usage:
                report_lines.append(f"  用途: {vehicle.usage}")
            if time_str:
                report_lines.append(f"  {time_str}")
            if vehicle.notes:
                report_lines.append(f"  备注: {vehicle.notes}")
        
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        with open(output_file, "w", encoding="utf-8") as f:
            f.write("\n".join(report_lines))
        
        return str(output_file)

    def _get_latest_versions(self, state: ProjectState) -> dict:
        latest = {}
        for shoot_date_str, version_names in state.shoot_dates.items():
            if version_names:
                latest_version = sorted(version_names)[-1]
                if latest_version in state.versions:
                    latest[shoot_date_str] = state.versions[latest_version]
        return latest
