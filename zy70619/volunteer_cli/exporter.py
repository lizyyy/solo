import json
import csv
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any
from collections import defaultdict

from models import ServiceRecord, CertificationStatus


class ReportExporter:
    def __init__(self, output_dir: str):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def export_json(self, data: Dict[str, Any], filename: str) -> str:
        """导出JSON格式（机器可读）"""
        file_path = self.output_dir / filename
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)
        return str(file_path)

    def export_csv(self, rows: List[Dict], filename: str) -> str:
        """导出CSV格式"""
        file_path = self.output_dir / filename
        if not rows:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write('')
            return str(file_path)
            
        fieldnames = list(rows[0].keys())
        with open(file_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        return str(file_path)

    def export_text_report(self, validation_results: Dict, 
                          service_records: List[ServiceRecord],
                          parse_errors: List[Dict],
                          filename: str) -> str:
        """导出文本格式报告（人可读）"""
        file_path = self.output_dir / filename
        lines = []
        
        lines.append("=" * 80)
        lines.append("志愿者替班签到校验时长认证排查报告")
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 80)
        lines.append("")
        
        lines.append("【数据概览】")
        summary = validation_results["summary"]
        lines.append(f"  志愿者总数: {summary['total_volunteers']}")
        lines.append(f"  班次总数: {summary['total_shifts']}")
        lines.append(f"  签到记录: {summary['total_checkins']}")
        lines.append(f"  替班申请: {summary['total_substitutes']}")
        lines.append(f"  时长认证: {summary['total_certifications']}")
        lines.append("")
        
        if parse_errors:
            lines.append("【数据解析错误】")
            for err in parse_errors:
                lines.append(f"  ✗ [{err['type']}] {err.get('error', '未知错误')}")
            lines.append("")
        
        lines.append("【验证结果概要】")
        lines.append(f"  错误总数: {summary['total_errors']}")
        lines.append(f"  警告总数: {summary['total_warnings']}")
        if summary["has_issues"]:
            lines.append("  ⚠ 存在问题需要处理")
        else:
            lines.append("  ✓ 所有验证通过")
        lines.append("")
        
        if validation_results["capacity_violations"]:
            lines.append("【班次容量违规】")
            for v in validation_results["capacity_violations"]:
                lines.append(f"  ✗ 班次 {v['shift_id']} ({v['activity_name']}):")
                lines.append(f"    容量限制: {v['capacity']}, 实际分配: {v['actual']}, 超出: {v['excess']}")
            lines.append("")
        
        if validation_results["location_violations"]:
            lines.append("【签到位置违规】")
            for v in validation_results["location_violations"]:
                if v["type"] == "missing_location":
                    lines.append(f"  ? 签到 {v['checkin_id']}: 志愿者 {v['volunteer_id']} 缺少位置信息")
                else:
                    lines.append(f"  ? 签到 {v['checkin_id']}: 志愿者 {v['volunteer_id']} 位置超出范围")
                    lines.append(f"    距离: {v['distance_meters']}米, 允许范围: {v['allowed_radius']}米")
            lines.append("")
        
        if validation_results["substitute_violations"]:
            lines.append("【替班审批违规】")
            for v in validation_results["substitute_violations"]:
                lines.append(f"  ✗ 申请 {v.get('request_id', 'unknown')}: {v['type']}")
            lines.append("")
        
        if validation_results["duration_recalculations"]:
            lines.append("【时长重算结果】")
            for v in validation_results["duration_recalculations"]:
                if v["type"] == "duration_mismatch":
                    lines.append(f"  ! 认证 {v['certification_id']}: 志愿者 {v['volunteer_id']}")
                    lines.append(f"    申报时长: {v['claimed']}分钟, 实际时长: {v['actual']}分钟, 差异: {v['difference']:+}分钟")
                elif v["type"] == "missing_checkin":
                    lines.append(f"  ✗ 认证 {v['certification_id']}: 找不到对应的签到记录 {v['checkin_id']}")
            lines.append("")
        
        lines.append("【服务记录统计】")
        if service_records:
            total_duration = sum(r.actual_duration_minutes for r in service_records)
            substitute_count = sum(1 for r in service_records if r.is_substitute)
            verified_count = sum(1 for r in service_records if r.certification_status == CertificationStatus.VERIFIED)
            
            lines.append(f"  服务记录总数: {len(service_records)}")
            lines.append(f"  总服务时长: {total_duration} 分钟 ({total_duration // 60}小时 {total_duration % 60}分钟)")
            lines.append(f"  替班服务次数: {substitute_count}")
            lines.append(f"  认证通过次数: {verified_count}")
            lines.append("")
            
            lines.append("  按志愿者统计(前10名):")
            volunteer_stats = defaultdict(lambda: {"duration": 0, "count": 0})
            for r in service_records:
                volunteer_stats[r.volunteer_id]["duration"] += r.actual_duration_minutes
                volunteer_stats[r.volunteer_id]["count"] += 1
            
            sorted_volunteers = sorted(
                volunteer_stats.items(), 
                key=lambda x: x[1]["duration"], 
                reverse=True
            )[:10]
            
            for vid, stats in sorted_volunteers:
                hours, mins = divmod(stats["duration"], 60)
                lines.append(f"    {vid}: {stats['count']}次服务, 共{hours}小时{mins}分钟")
        else:
            lines.append("  (无服务记录)")
        lines.append("")
        
        lines.append("=" * 80)
        lines.append("报告结束")
        lines.append("=" * 80)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        
        return str(file_path)

    def export_service_records_csv(self, records: List[ServiceRecord], filename: str) -> str:
        """导出服务记录CSV"""
        rows = []
        for r in records:
            rows.append({
                "record_id": r.record_id,
                "volunteer_id": r.volunteer_id,
                "shift_id": r.shift_id,
                "date": str(r.date),
                "activity_name": r.activity_name,
                "actual_duration_minutes": r.actual_duration_minutes,
                "is_substitute": "是" if r.is_substitute else "否",
                "original_volunteer_id": r.original_volunteer_id or "",
                "certification_status": r.certification_status.value,
                "location_valid": "是" if r.location_valid else "否"
            })
        return self.export_csv(rows, filename)

    def export_all(self, validation_results: Dict, 
                   service_records: List[ServiceRecord],
                   parse_errors: List[Dict]) -> Dict[str, str]:
        """导出所有报告"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        files = {}
        
        files["validation_json"] = self.export_json(
            validation_results, 
            f"validation_results_{timestamp}.json"
        )
        
        service_data = [r.dict() for r in service_records]
        files["service_records_json"] = self.export_json(
            {"service_records": service_data},
            f"service_records_{timestamp}.json"
        )
        
        files["service_records_csv"] = self.export_service_records_csv(
            service_records,
            f"service_records_{timestamp}.csv"
        )
        
        files["text_report"] = self.export_text_report(
            validation_results,
            service_records,
            parse_errors,
            f"report_{timestamp}.txt"
        )
        
        return files
