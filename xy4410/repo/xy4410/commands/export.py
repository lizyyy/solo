#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
export命令 - 导出报告
"""

import json
from pathlib import Path
from datetime import date, datetime, timedelta
from typing import List, Dict, Any, Optional

from core.storage import DataStore
from core.models import (
    Issue, IssueType, IssueSeverity,
    BOM, PickPlaceData, OvenProfile, 
    SolderPasteBatch, StencilBatch, AOI_Report,
    ReworkRecord, ProductionBatch
)


def generate_markdown_report(store: DataStore, report_date: date, 
                             issues: List[Issue],
                             board_number: Optional[str] = None,
                             batch_id: Optional[str] = None) -> str:
    lines = []
    
    lines.append(f"# 贴片回流生产放行报告 - {report_date.isoformat()}")
    lines.append("")
    lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("")
    
    if board_number:
        lines.append(f"**目标板号**: {board_number}")
    if batch_id:
        lines.append(f"**目标批次**: {batch_id}")
    lines.append("")
    
    critical_issues = [i for i in issues if i.severity == IssueSeverity.CRITICAL and not i.confirmed]
    warning_issues = [i for i in issues if i.severity == IssueSeverity.WARNING and not i.confirmed]
    confirmed_issues = [i for i in issues if i.confirmed]
    
    lines.append("## 状态概览")
    lines.append("")
    
    if critical_issues:
        lines.append(f"- **未解决严重问题**: {len(critical_issues)} 个 ⚠️")
    else:
        lines.append(f"- **未解决严重问题**: 0 个 ✅")
    
    if warning_issues:
        lines.append(f"- **未解决警告问题**: {len(warning_issues)} 个")
    else:
        lines.append(f"- **未解决警告问题**: 0 个 ✅")
    
    lines.append(f"- **已确认问题**: {len(confirmed_issues)} 个")
    lines.append("")
    
    boms = store.get_all_boms()
    pick_places = store.get_all_pick_places()
    profiles = store.get_all_oven_profiles()
    pastes = store.get_active_solder_pastes()
    stencils = store.get_all_stencils()
    aoi_reports = store.get_all_aoi_reports()
    reworks = store.get_all_reworks()
    
    lines.append("## 数据概览")
    lines.append("")
    lines.append(f"- **BOM记录数**: {len(boms)} 个")
    lines.append(f"- **贴片坐标记录数**: {len(pick_places)} 个")
    lines.append(f"- **炉温曲线记录数**: {len(profiles)} 个")
    lines.append(f"- **有效锡膏批次**: {len(pastes)} 个")
    lines.append(f"- **钢网批次**: {len(stencils)} 个")
    lines.append(f"- **AOI报告数**: {len(aoi_reports)} 个")
    lines.append(f"- **返修记录数**: {len(reworks)} 个")
    lines.append("")
    
    if critical_issues:
        lines.append("## ⚠️ 未解决严重问题")
        lines.append("")
        for i, issue in enumerate(critical_issues, 1):
            lines.append(f"### 问题 {i}: {issue.issue_type.value}")
            lines.append(f"- **问题ID**: {issue.issue_id}")
            lines.append(f"- **描述**: {issue.message}")
            if issue.board_number:
                lines.append(f"- **涉及板号**: {issue.board_number}")
            if issue.reference:
                lines.append(f"- **涉及位号**: {issue.reference}")
            lines.append("")
    else:
        lines.append("## ✅ 无未解决严重问题")
        lines.append("")
    
    if warning_issues:
        lines.append("## ⚡ 未解决警告问题")
        lines.append("")
        for i, issue in enumerate(warning_issues, 1):
            lines.append(f"### 问题 {i}: {issue.issue_type.value}")
            lines.append(f"- **问题ID**: {issue.issue_id}")
            lines.append(f"- **描述**: {issue.message}")
            if issue.board_number:
                lines.append(f"- **涉及板号**: {issue.board_number}")
            if issue.reference:
                lines.append(f"- **涉及位号**: {issue.reference}")
            lines.append("")
    
    if confirmed_issues:
        lines.append("## 📝 已确认问题")
        lines.append("")
        for i, issue in enumerate(confirmed_issues, 1):
            lines.append(f"### 问题 {i}: {issue.issue_type.value}")
            lines.append(f"- **问题ID**: {issue.issue_id}")
            lines.append(f"- **严重程度**: {issue.severity.value}")
            lines.append(f"- **原始描述**: {issue.message}")
            lines.append(f"- **确认备注**: {issue.confirm_remark or '无备注'}")
            lines.append(f"- **确认人员**: {issue.confirmed_by or '未知'}")
            if issue.confirmed_at:
                lines.append(f"- **确认时间**: {issue.confirmed_at.strftime('%Y-%m-%d %H:%M:%S')}")
            lines.append("")
    
    if boms:
        lines.append("## 📋 BOM详情")
        lines.append("")
        
        for bom in boms:
            if board_number and bom.board_number != board_number:
                continue
            
            lines.append(f"### 板号: {bom.board_number} (版本: {bom.board_revision or '-'})")
            lines.append(f"- **BOM ID**: {bom.bom_id}")
            lines.append(f"- **描述**: {bom.description or '-'}")
            lines.append(f"- **元件总数**: {len(bom.parts)} 个")
            
            pp = store.get_pick_place_by_board(bom.board_number, bom.board_revision)
            if pp:
                bom_refs = bom.get_all_references()
                pp_refs = pp.get_all_references()
                missing_in_pp = bom_refs - pp_refs
                missing_in_bom = pp_refs - bom_refs
                
                lines.append(f"- **对应贴片坐标**: 存在 ({len(pp.items)} 个坐标)")
                if missing_in_pp:
                    lines.append(f"- **BOM中存在但贴片坐标中缺失的位号**: {', '.join(sorted(missing_in_pp))}")
                if missing_in_bom:
                    lines.append(f"- **贴片坐标中存在但BOM中缺失的位号**: {', '.join(sorted(missing_in_bom))}")
            else:
                lines.append(f"- **对应贴片坐标**: 不存在")
            
            lines.append("")
    
    if profiles:
        lines.append("## 🌡️ 炉温曲线详情")
        lines.append("")
        
        for profile in profiles:
            if len(profile.points) == 0:
                continue
            
            peak_temp = profile.get_peak_temperature()
            soak_time = profile.get_soak_time()
            
            lines.append(f"### 曲线名称: {profile.name}")
            lines.append(f"- **曲线ID**: {profile.profile_id}")
            lines.append(f"- **描述**: {profile.description or '-'}")
            lines.append(f"- **锡膏类型**: {profile.solder_paste_type or '-'}")
            lines.append(f"- **数据点数**: {len(profile.points)}")
            lines.append(f"- **峰值温度**: {peak_temp:.1f}°C")
            lines.append(f"- **浸泡区时间**: {soak_time:.0f}秒 (150-180°C)")
            
            if profile.target_peak_min > 0 and profile.target_peak_max > 0:
                lines.append(f"- **目标峰值范围**: {profile.target_peak_min}°C ~ {profile.target_peak_max}°C")
            
            lines.append("")
    
    if pastes:
        lines.append("## 🧪 锡膏批次状态")
        lines.append("")
        
        for paste in pastes:
            lines.append(f"### 锡膏批次: {paste.lot_number}")
            lines.append(f"- **批次ID**: {paste.batch_id}")
            lines.append(f"- **锡膏类型**: {paste.solder_paste_type}")
            lines.append(f"- **制造商**: {paste.manufacturer or '-'}")
            lines.append(f"- **合金类型**: {paste.alloy_type or '-'}")
            lines.append(f"- **生产日期**: {paste.manufacture_date.isoformat()}")
            lines.append(f"- **有效期至**: {paste.expiry_date.isoformat()}")
            lines.append(f"- **状态**: {paste.status}")
            
            if paste.is_expired():
                lines.append(f"- **⚠️ 状态**: 已过期!")
            
            if paste.thaw_complete_time:
                remaining = paste.get_thaw_remaining_hours()
                lines.append(f"- **回温完成时间**: {paste.thaw_complete_time.strftime('%Y-%m-%d %H:%M:%S')}")
                lines.append(f"- **剩余可用时间**: {remaining:.1f}小时")
                if remaining <= 0:
                    lines.append(f"- **⚠️ 回温后已超时!**")
            
            lines.append("")
    
    if aoi_reports:
        lines.append("## 🔍 AOI检查报告")
        lines.append("")
        
        for aoi in aoi_reports:
            if board_number and aoi.board_number != board_number:
                continue
            
            rework_needed = [d for d in aoi.defects if d.rework_needed and not d.false_alarm]
            false_alarms = [d for d in aoi.defects if d.false_alarm]
            
            lines.append(f"### AOI报告: {aoi.aoi_id}")
            lines.append(f"- **板号**: {aoi.board_number} (版本: {aoi.board_revision or '-'})")
            lines.append(f"- **序列号**: {aoi.serial_number or '-'}")
            lines.append(f"- **检查时间**: {aoi.inspection_time.strftime('%Y-%m-%d %H:%M:%S')}")
            lines.append(f"- **整体结果**: {aoi.overall_result}")
            lines.append(f"- **缺陷总数**: {len(aoi.defects)} 个")
            lines.append(f"- **需要返修**: {len(rework_needed)} 个")
            lines.append(f"- **误报**: {len(false_alarms)} 个")
            
            if rework_needed:
                lines.append(f"- **需要返修的位号**: {', '.join([d.reference for d in rework_needed])}")
            
            lines.append("")
    
    if reworks:
        lines.append("## 🔧 返修记录")
        lines.append("")
        
        serial_counts: Dict[str, int] = {}
        for rework in reworks:
            if rework.serial_number:
                serial_counts[rework.serial_number] = serial_counts.get(rework.serial_number, 0) + 1
        
        for serial, count in serial_counts.items():
            if count > 0:
                serial_reworks = [r for r in reworks if r.serial_number == serial]
                board_num = serial_reworks[0].board_number if serial_reworks else '-'
                
                lines.append(f"### 序列号: {serial}")
                lines.append(f"- **板号**: {board_num}")
                lines.append(f"- **返修次数**: {count} 次")
                
                for i, rw in enumerate(serial_reworks, 1):
                    lines.append(f"  - 返修 {i}: {rw.rework_type or '通用返修'}")
                    lines.append(f"    - 时间: {rw.rework_time.strftime('%Y-%m-%d %H:%M:%S')}")
                    lines.append(f"    - 结果: {rw.rework_result}")
                    lines.append(f"    - 涉及位号: {', '.join(rw.references) if rw.references else '-'}")
                
                lines.append("")
    
    lines.append("---")
    lines.append("")
    
    if not critical_issues:
        lines.append("## ✅ 放行结论")
        lines.append("")
        lines.append("所有严重问题已解决或确认，可以安全放行。")
        lines.append("")
        lines.append("**操作员确认签字**: _______________")
        lines.append("")
        lines.append(f"**日期**: {report_date.isoformat()}")
    else:
        lines.append("## ⚠️ 放行结论")
        lines.append("")
        lines.append(f"存在 {len(critical_issues)} 个未解决的严重问题，**不可放行**。")
        lines.append("")
        lines.append("请先解决上述问题后再确认放行。")
    
    return "\n".join(lines)


def generate_audit_json(store: DataStore, report_date: date, 
                        issues: List[Issue],
                        board_number: Optional[str] = None,
                        batch_id: Optional[str] = None) -> Dict[str, Any]:
    config = store.get_config()
    boms = store.get_all_boms()
    pick_places = store.get_all_pick_places()
    profiles = store.get_all_oven_profiles()
    pastes = store.get_active_solder_pastes()
    stencils = store.get_all_stencils()
    aoi_reports = store.get_all_aoi_reports()
    reworks = store.get_all_reworks()
    
    critical_issues = [i for i in issues if i.severity == IssueSeverity.CRITICAL]
    warning_issues = [i for i in issues if i.severity == IssueSeverity.WARNING]
    confirmed_issues = [i for i in issues if i.confirmed]
    unresolved_critical = [i for i in issues if i.severity == IssueSeverity.CRITICAL and not i.confirmed]
    
    audit_data = {
        "report_date": report_date.isoformat(),
        "generated_at": datetime.now().isoformat(),
        "target_board_number": board_number,
        "target_batch_id": batch_id,
        "configuration": config,
        "summary": {
            "total_issues": len(issues),
            "critical_issues": len(critical_issues),
            "warning_issues": len(warning_issues),
            "confirmed_issues": len(confirmed_issues),
            "unresolved_critical": len(unresolved_critical),
            "can_release": len(unresolved_critical) == 0
        },
        "data_summary": {
            "boms_count": len(boms),
            "pick_places_count": len(pick_places),
            "oven_profiles_count": len(profiles),
            "solder_pastes_count": len(pastes),
            "stencils_count": len(stencils),
            "aoi_reports_count": len(aoi_reports),
            "reworks_count": len(reworks)
        },
        "boms": [],
        "pick_places": [],
        "oven_profiles": [],
        "solder_pastes": [],
        "stencils": [],
        "aoi_reports": [],
        "reworks": [],
        "issues": []
    }
    
    for bom in boms:
        if board_number and bom.board_number != board_number:
            continue
        
        bom_data = bom.to_dict()
        pp = store.get_pick_place_by_board(bom.board_number, bom.board_revision)
        if pp:
            bom_refs = bom.get_all_references()
            pp_refs = pp.get_all_references()
            bom_data["pick_place_analysis"] = {
                "total_parts_in_bom": len(bom.parts),
                "missing_in_pick_place": list(bom_refs - pp_refs),
                "missing_in_bom": list(pp_refs - bom_refs),
                "mismatched_packages": []
            }
        
        audit_data["boms"].append(bom_data)
    
    for pp in pick_places:
        if board_number and pp.board_number != board_number:
            continue
        audit_data["pick_places"].append(pp.to_dict())
    
    for profile in profiles:
        profile_data = profile.to_dict()
        profile_data["analysis"] = {
            "peak_temperature": profile.get_peak_temperature(),
            "soak_time_150_180": profile.get_soak_time()
        }
        audit_data["oven_profiles"].append(profile_data)
    
    for paste in pastes:
        paste_data = paste.to_dict()
        paste_data["analysis"] = {
            "is_expired": paste.is_expired(),
            "thaw_remaining_hours": paste.get_thaw_remaining_hours(),
            "is_thaw_expired": paste.is_thaw_expired()
        }
        audit_data["solder_pastes"].append(paste_data)
    
    for stencil in stencils:
        stencil_data = stencil.to_dict()
        stencil_data["analysis"] = {
            "is_near_end_of_life": stencil.is_near_end_of_life(),
            "remaining_uses": stencil.max_uses - stencil.use_count
        }
        audit_data["stencils"].append(stencil_data)
    
    for aoi in aoi_reports:
        if board_number and aoi.board_number != board_number:
            continue
        audit_data["aoi_reports"].append(aoi.to_dict())
    
    for rework in reworks:
        audit_data["reworks"].append(rework.to_dict())
    
    for issue in issues:
        audit_data["issues"].append(issue.to_dict())
    
    return audit_data


def export_command(work_dir: Path, date_str: Optional[str] = None,
                   export_markdown: bool = False, export_json: bool = False,
                   export_all: bool = False,
                   board_number: Optional[str] = None,
                   batch_id: Optional[str] = None):
    store = DataStore(work_dir)
    
    if date_str:
        try:
            from commands.import_ import parse_date
            report_date = parse_date(date_str)
        except:
            raise ValueError(f"无效的日期格式: {date_str}")
    else:
        report_date = date.today()
    
    if export_all:
        export_markdown = True
        export_json = True
    
    if not export_markdown and not export_json:
        export_markdown = True
        export_json = True
    
    issues = store.get_all_issues()
    
    export_dir = store.get_export_dir()
    export_dir.mkdir(parents=True, exist_ok=True)
    
    date_str_safe = report_date.strftime('%Y-%m-%d')
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    if export_markdown:
        md_content = generate_markdown_report(store, report_date, issues, board_number, batch_id)
        md_file = export_dir / f"release_report_{date_str_safe}_{timestamp}.md"
        
        with open(md_file, 'w', encoding='utf-8') as f:
            f.write(md_content)
        
        print(f"Markdown放行报告已导出: {md_file}")
    
    if export_json:
        audit_data = generate_audit_json(store, report_date, issues, board_number, batch_id)
        json_file = export_dir / f"audit_report_{date_str_safe}_{timestamp}.json"
        
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(audit_data, f, ensure_ascii=False, indent=2)
        
        print(f"审计JSON已导出: {json_file}")
    
    print()
    print("导出完成！")
