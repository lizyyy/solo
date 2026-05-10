import pandas as pd
from pathlib import Path
from typing import Dict, List
from datetime import datetime

from .models import ProjectReport, RecordStatus, MaterialUsage


def export_usage_report(
    reports: Dict[str, ProjectReport],
    output_file: Path,
    duplicates: List[Dict] = None,
    merged_info: List[Dict] = None,
    return_issues: List[Dict] = None
) -> None:
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
        _export_summary_sheet(writer, reports)
        _export_detailed_usage_sheet(writer, reports)
        _export_by_receiver_sheet(writer, reports)
        
        if duplicates:
            _export_duplicates_sheet(writer, duplicates)
        if merged_info:
            _export_offline_merge_sheet(writer, merged_info)
        if return_issues:
            _export_return_issues_sheet(writer, return_issues)
        
        _export_processed_records_sheet(writer, reports)


def _export_summary_sheet(writer: pd.ExcelWriter, reports: Dict[str, ProjectReport]) -> None:
    summary_data = []
    
    for project_name, report in reports.items():
        total_materials = len(report.materials)
        materials_with_deficit = sum(1 for m in report.materials.values() if m.has_deficit)
        total_deficit = report.total_deficit
        
        by_type = {}
        for usage in report.materials.values():
            material_type = usage.material.material_type.value
            if material_type not in by_type:
                by_type[material_type] = {
                    "数量": 0,
                    "领用数量": 0,
                    "归还数量": 0,
                    "差异数量": 0,
                }
            by_type[material_type]["数量"] += 1
            by_type[material_type]["领用数量"] += usage.total_received
            by_type[material_type]["归还数量"] += usage.total_returned
            by_type[material_type]["差异数量"] += usage.deficit
        
        summary_data.append({
            "展会项目": project_name,
            "物料总数": total_materials,
            "有差异物料数": materials_with_deficit,
            "总差异数量": total_deficit,
            "状态": "异常" if report.has_issues else "正常",
        })
    
    df_summary = pd.DataFrame(summary_data)
    df_summary.to_excel(writer, sheet_name="项目汇总", index=False)


def _export_detailed_usage_sheet(writer: pd.ExcelWriter, reports: Dict[str, ProjectReport]) -> None:
    detailed_data = []
    
    for project_name, report in reports.items():
        for usage in report.materials.values():
            detailed_data.append({
                "展会项目": project_name,
                "二维码编号": usage.qr_code,
                "物料名称": usage.material.name,
                "物料类型": usage.material.material_type.value,
                "规格型号": usage.material.specification,
                "初始数量": usage.material.initial_quantity,
                "领用数量": usage.total_received,
                "归还数量": usage.total_returned,
                "差异数量": usage.deficit,
                "状态": "有差异" if usage.has_deficit else "正常",
                "存放位置": usage.material.location,
                "备注": usage.material.remarks,
            })
    
    if detailed_data:
        df = pd.DataFrame(detailed_data)
        df.to_excel(writer, sheet_name="物料明细", index=False)


def _export_by_receiver_sheet(writer: pd.ExcelWriter, reports: Dict[str, ProjectReport]) -> None:
    receiver_data = []
    
    for project_name, report in reports.items():
        receiver_map = {}
        
        for usage in report.materials.values():
            for record in usage.get_active_scan_records():
                receiver_key = (record.receiver, record.receiver_department)
                
                if receiver_key not in receiver_map:
                    receiver_map[receiver_key] = {
                        "领用人": record.receiver,
                        "领用部门": record.receiver_department,
                        "领用物料": [],
                        "领用总数": 0,
                        "归还总数": 0,
                    }
                
                receiver_map[receiver_key]["领用物料"].append({
                    "二维码": usage.qr_code,
                    "物料名称": usage.material.name,
                    "数量": record.quantity,
                })
                receiver_map[receiver_key]["领用总数"] += record.quantity
            
            for record in usage.get_active_return_records():
                receiver_key = (record.returner, record.return_department)
                
                if receiver_key not in receiver_map:
                    receiver_map[receiver_key] = {
                        "领用人": record.returner,
                        "领用部门": record.return_department,
                        "领用物料": [],
                        "领用总数": 0,
                        "归还总数": 0,
                    }
                
                receiver_map[receiver_key]["归还总数"] += record.quantity
        
        for (receiver, dept), data in receiver_map.items():
            materials_str = "; ".join([
                f"{m['物料名称']}({m['二维码']})x{m['数量']}" 
                for m in data["领用物料"]
            ]) if data["领用物料"] else "无"
            
            receiver_data.append({
                "展会项目": project_name,
                "领用人/归还人": receiver,
                "部门": dept,
                "领用物料明细": materials_str,
                "领用总数": data["领用总数"],
                "归还总数": data["归还总数"],
                "未归还数量": data["领用总数"] - data["归还总数"],
            })
    
    if receiver_data:
        df = pd.DataFrame(receiver_data)
        df.to_excel(writer, sheet_name="人员领用汇总", index=False)


def _export_duplicates_sheet(writer: pd.ExcelWriter, duplicates: List[Dict]) -> None:
    data = []
    for i, dup in enumerate(duplicates, 1):
        original = dup["original"]
        duplicate = dup["duplicate"]
        data.append({
            "序号": i,
            "原始记录二维码": original["二维码编号"],
            "原始记录时间": original["扫码时间"],
            "原始记录领用人": original["领用人"],
            "重复记录时间": duplicate["扫码时间"],
            "重复记录领用人": duplicate["领用人"],
        })
    
    df = pd.DataFrame(data)
    df.to_excel(writer, sheet_name="重复扫码记录", index=False)


def _export_offline_merge_sheet(writer: pd.ExcelWriter, merged_info: List[Dict]) -> None:
    data = []
    for i, info in enumerate(merged_info, 1):
        record = info["record"]
        data.append({
            "序号": i,
            "动作": info["action"],
            "原因": info["reason"],
            "二维码编号": record["二维码编号"],
            "领用人": record["领用人"],
            "时间": record["扫码时间"],
            "数量": record["领用数量"],
        })
    
    df = pd.DataFrame(data)
    df.to_excel(writer, sheet_name="离线记录合并情况", index=False)


def _export_return_issues_sheet(writer: pd.ExcelWriter, issues: List[Dict]) -> None:
    data = []
    for i, issue in enumerate(issues, 1):
        data.append({
            "序号": i,
            "问题类型": issue["type"],
            "二维码编号": issue["qr_code"],
            "领用总数": issue["total_received"],
            "归还总数": issue["total_returned"],
            "超额数量": issue["excess"],
        })
    
    df = pd.DataFrame(data)
    df.to_excel(writer, sheet_name="归还异常", index=False)


def _export_processed_records_sheet(writer: pd.ExcelWriter, reports: Dict[str, ProjectReport]) -> None:
    scan_data = []
    return_data = []
    
    for project_name, report in reports.items():
        for usage in report.materials.values():
            for record in usage.scan_records:
                scan_data.append({
                    "展会项目": project_name,
                    "二维码编号": record.qr_code,
                    "物料名称": usage.material.name,
                    "扫码时间": record.scan_time.strftime("%Y-%m-%d %H:%M:%S"),
                    "领用人": record.receiver,
                    "领用部门": record.receiver_department,
                    "来源": record.source.value,
                    "领用数量": record.quantity,
                    "状态": record.status.value,
                    "跳过原因": record.skip_reason,
                })
            
            for record in usage.return_records:
                return_data.append({
                    "展会项目": project_name,
                    "二维码编号": record.qr_code,
                    "物料名称": usage.material.name,
                    "归还时间": record.return_time.strftime("%Y-%m-%d %H:%M:%S"),
                    "归还人": record.returner,
                    "归还部门": record.return_department,
                    "归还数量": record.quantity,
                    "状态": record.status.value,
                    "跳过原因": record.skip_reason,
                })
    
    if scan_data:
        pd.DataFrame(scan_data).to_excel(writer, sheet_name="领用记录处理结果", index=False)
    if return_data:
        pd.DataFrame(return_data).to_excel(writer, sheet_name="归还记录处理结果", index=False)


def generate_text_summary(
    reports: Dict[str, ProjectReport],
    duplicates: List[Dict] = None,
    merged_info: List[Dict] = None,
    return_issues: List[Dict] = None
) -> str:
    lines = []
    lines.append("=" * 60)
    lines.append("二维码物料领用报告")
    lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("=" * 60)
    lines.append("")
    
    total_projects = len(reports)
    total_deficit = sum(r.total_deficit for r in reports.values())
    projects_with_issues = sum(1 for r in reports.values() if r.has_issues)
    
    lines.append(f"【项目汇总】")
    lines.append(f"  总项目数: {total_projects}")
    lines.append(f"  有异常项目数: {projects_with_issues}")
    lines.append(f"  总差异数量: {total_deficit}")
    lines.append("")
    
    for project_name, report in reports.items():
        lines.append(f"【项目: {project_name}】")
        lines.append(f"  物料总数: {len(report.materials)}")
        lines.append(f"  有差异物料数: {sum(1 for m in report.materials.values() if m.has_deficit)}")
        lines.append(f"  总差异数量: {report.total_deficit}")
        
        if report.issues:
            lines.append(f"  其他问题: {'; '.join(report.issues)}")
        
        lines.append("")
        
        deficit_materials = [m for m in report.materials.values() if m.has_deficit]
        if deficit_materials:
            lines.append(f"  📋 未归还明细:")
            for usage in deficit_materials:
                lines.append(f"    - {usage.material.name} ({usage.qr_code}): 领用{usage.total_received}, 归还{usage.total_returned}, 差{usage.deficit}")
                
                receivers = set()
                for record in usage.get_active_scan_records():
                    receivers.add(f"{record.receiver}({record.receiver_department})")
                lines.append(f"      领用人: {', '.join(receivers)}")
            lines.append("")
    
    if duplicates:
        lines.append(f"【重复扫码】共发现 {len(duplicates)} 条重复记录")
        for i, dup in enumerate(duplicates, 1):
            original = dup["original"]
            lines.append(f"  {i}. {original['二维码编号']} - {original['领用人']} 在 {original['扫码时间']} 已扫码")
        lines.append("")
    
    if merged_info:
        merged = [m for m in merged_info if m["action"] == "合并"]
        skipped = [m for m in merged_info if m["action"] == "跳过"]
        
        lines.append(f"【离线补录合并】")
        lines.append(f"  成功合并: {len(merged)} 条")
        lines.append(f"  被跳过: {len(skipped)} 条 (已存在扫码记录)")
        lines.append("")
    
    if return_issues:
        lines.append(f"【归还异常】共发现 {len(return_issues)} 个问题")
        for i, issue in enumerate(return_issues, 1):
            lines.append(f"  {i}. {issue['qr_code']}: 领用{issue['total_received']}, 归还{issue['total_returned']}, 超额{issue['excess']}")
        lines.append("")
    
    lines.append("=" * 60)
    return "\n".join(lines)
