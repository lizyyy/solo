import json
import csv
from datetime import datetime
from typing import List, Dict, Any

from .anomaly_detector import (
    scan_all_anomalies, get_affected_batch_details, anomaly_to_dict,
    ANOMALY_TYPE_TEMPERATURE_ABNORMAL, ANOMALY_TYPE_TEMPERATURE_MISSING,
    ANOMALY_TYPE_BATCH_TIME_CONFLICT, ANOMALY_TYPE_VACCINATION_AFTER_ANOMALY,
    ANOMALY_TYPE_LONG_DOOR_OPEN,
    SEVERITY_CRITICAL, SEVERITY_HIGH, SEVERITY_MEDIUM, SEVERITY_LOW
)
from .database import get_manual_reviews, get_stats


ANOMALY_TYPE_NAMES = {
    ANOMALY_TYPE_TEMPERATURE_ABNORMAL: "温度异常",
    ANOMALY_TYPE_TEMPERATURE_MISSING: "温度缺测",
    ANOMALY_TYPE_BATCH_TIME_CONFLICT: "批号时间冲突",
    ANOMALY_TYPE_VACCINATION_AFTER_ANOMALY: "异常后仍接种",
    ANOMALY_TYPE_LONG_DOOR_OPEN: "长时间开门"
}


REVIEW_RESULT_NAMES = {
    "CONFIRMED_ABNORMAL": "确认异常",
    "CONFIRMED_SAFE": "确认安全",
    "NEED_MORE_INFO": "需进一步确认"
}


def generate_report_content() -> Dict[str, Any]:
    scan_result = scan_all_anomalies()
    batch_details = get_affected_batch_details()
    stats = get_stats()
    all_reviews = get_manual_reviews()
    
    all_affected_patients = []
    seen_vaccination_ids = set()
    
    for anomaly in scan_result["anomalies"]:
        for vac in anomaly.affected_vaccinations:
            vac_id = vac.get("vaccination_id", "")
            if vac_id and vac_id not in seen_vaccination_ids:
                seen_vaccination_ids.add(vac_id)
                all_affected_patients.append({
                    "patient_name": vac.get("patient_name", ""),
                    "patient_phone": vac.get("patient_phone", ""),
                    "vaccination_time": vac.get("vaccination_time", ""),
                    "batch_number": vac.get("batch_number", ""),
                    "vaccination_id": vac_id
                })
    
    review_details = []
    for review in all_reviews:
        review_details.append({
            "anomaly_id": review.anomaly_id,
            "reviewer": review.reviewer,
            "review_time": review.review_time,
            "original_result": review.original_result,
            "review_reason": review.review_reason,
            "final_result": REVIEW_RESULT_NAMES.get(review.final_result, review.final_result),
            "impact_change": review.impact_change
        })
    
    anomalies_by_type = {}
    for anomaly in scan_result["anomalies"]:
        type_name = ANOMALY_TYPE_NAMES.get(anomaly.anomaly_type, anomaly.anomaly_type)
        if type_name not in anomalies_by_type:
            anomalies_by_type[type_name] = []
        anomalies_by_type[type_name].append({
            "anomaly_id": anomaly.anomaly_id,
            "severity": anomaly.severity,
            "device_id": anomaly.device_id,
            "batch_number": anomaly.batch_number,
            "start_time": anomaly.start_time,
            "end_time": anomaly.end_time,
            "description": anomaly.description,
            "affected_vaccinations": anomaly.affected_vaccinations,
            "has_been_reviewed": anomaly.has_been_reviewed,
            "review_result": REVIEW_RESULT_NAMES.get(anomaly.review_result, anomaly.review_result) if anomaly.review_result else None
        })
    
    return {
        "report_generated_at": datetime.now().isoformat(),
        "summary": {
            "total_records": {
                "temperature_logs": stats['temperature_logs'],
                "door_events": stats['door_events'],
                "vaccine_batches": stats['vaccine_batches'],
                "vaccination_records": stats['vaccination_records'],
                "manual_reviews": stats['manual_reviews']
            },
            "anomaly_summary": {
                "total_anomalies": scan_result["total_anomalies"],
                "by_type": {
                    ANOMALY_TYPE_NAMES.get(k, k): v 
                    for k, v in scan_result["by_type"].items()
                },
                "by_severity": scan_result["by_severity"],
                "affected_batches": scan_result["affected_batches"],
                "total_affected_patients": len(all_affected_patients)
            }
        },
        "anomalies_by_type": anomalies_by_type,
        "affected_batches": batch_details,
        "patients_to_trace": all_affected_patients,
        "manual_reviews": review_details
    }


def export_report_json(output_path: str) -> None:
    report = generate_report_content()
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)


def export_report_csv(output_path: str) -> None:
    report = generate_report_content()
    
    with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        
        writer.writerow(["诊所疫苗冷链异常报告"])
        writer.writerow(["生成时间", report["report_generated_at"]])
        writer.writerow([])
        
        writer.writerow(["=== 汇总 ==="])
        writer.writerow([])
        
        writer.writerow(["数据记录统计"])
        writer.writerow(["温度日志", report["summary"]["total_records"]["temperature_logs"]])
        writer.writerow(["开门事件", report["summary"]["total_records"]["door_events"]])
        writer.writerow(["疫苗批号", report["summary"]["total_records"]["vaccine_batches"]])
        writer.writerow(["接种记录", report["summary"]["total_records"]["vaccination_records"]])
        writer.writerow(["人工复核", report["summary"]["total_records"]["manual_reviews"]])
        writer.writerow([])
        
        writer.writerow(["异常统计"])
        writer.writerow(["总异常数", report["summary"]["anomaly_summary"]["total_anomalies"]])
        writer.writerow(["受影响批号数", len(report["summary"]["anomaly_summary"]["affected_batches"])])
        writer.writerow(["需追踪接种人数", report["summary"]["anomaly_summary"]["total_affected_patients"]])
        writer.writerow([])
        
        writer.writerow(["按类型统计"])
        for type_name, count in report["summary"]["anomaly_summary"]["by_type"].items():
            writer.writerow([type_name, count])
        writer.writerow([])
        
        writer.writerow(["按严重程度统计"])
        for severity, count in report["summary"]["anomaly_summary"]["by_severity"].items():
            writer.writerow([severity, count])
        writer.writerow([])
        
        writer.writerow(["=== 异常详情 ==="])
        writer.writerow([])
        
        for type_name, anomalies in report["anomalies_by_type"].items():
            writer.writerow([f"【{type_name}】({len(anomalies)}条)"])
            writer.writerow(["异常ID", "严重程度", "设备", "批号", "开始时间", "结束时间", "描述", "已复核", "复核结果", "影响接种数"])
            
            for anomaly in anomalies:
                writer.writerow([
                    anomaly["anomaly_id"],
                    anomaly["severity"],
                    anomaly["device_id"] or "-",
                    anomaly["batch_number"] or "-",
                    anomaly["start_time"],
                    anomaly["end_time"] or "-",
                    anomaly["description"],
                    "是" if anomaly["has_been_reviewed"] else "否",
                    anomaly["review_result"] or "-",
                    len(anomaly["affected_vaccinations"])
                ])
            writer.writerow([])
        
        writer.writerow(["=== 需追踪的接种人 ==="])
        writer.writerow(["接种ID", "患者姓名", "联系电话", "接种时间", "批号"])
        for patient in report["patients_to_trace"]:
            writer.writerow([
                patient["vaccination_id"],
                patient["patient_name"],
                patient["patient_phone"],
                patient["vaccination_time"],
                patient["batch_number"]
            ])
        writer.writerow([])
        
        writer.writerow(["=== 人工复核记录 ==="])
        writer.writerow(["异常ID", "复核人", "复核时间", "原始结果", "复核原因", "最终结果", "影响范围变更"])
        for review in report["manual_reviews"]:
            writer.writerow([
                review["anomaly_id"],
                review["reviewer"],
                review["review_time"],
                review["original_result"],
                review["review_reason"],
                review["final_result"],
                review["impact_change"]
            ])


def export_report_text(output_path: str) -> None:
    report = generate_report_content()
    
    lines = []
    lines.append("=" * 80)
    lines.append("诊所疫苗冷链异常报告")
    lines.append(f"生成时间: {report['report_generated_at']}")
    lines.append("=" * 80)
    lines.append("")
    
    lines.append("【汇总】")
    lines.append("-" * 40)
    
    lines.append("")
    lines.append("数据记录统计:")
    lines.append(f"  温度日志: {report['summary']['total_records']['temperature_logs']}")
    lines.append(f"  开门事件: {report['summary']['total_records']['door_events']}")
    lines.append(f"  疫苗批号: {report['summary']['total_records']['vaccine_batches']}")
    lines.append(f"  接种记录: {report['summary']['total_records']['vaccination_records']}")
    lines.append(f"  人工复核: {report['summary']['total_records']['manual_reviews']}")
    
    lines.append("")
    lines.append("异常统计:")
    lines.append(f"  总异常数: {report['summary']['anomaly_summary']['total_anomalies']}")
    lines.append(f"  受影响批号数: {len(report['summary']['anomaly_summary']['affected_batches'])}")
    lines.append(f"  需追踪接种人数: {report['summary']['anomaly_summary']['total_affected_patients']}")
    
    lines.append("")
    lines.append("  按类型统计:")
    for type_name, count in report["summary"]["anomaly_summary"]["by_type"].items():
        lines.append(f"    {type_name}: {count}")
    
    lines.append("")
    lines.append("  按严重程度统计:")
    for severity, count in report["summary"]["anomaly_summary"]["by_severity"].items():
        lines.append(f"    {severity}: {count}")
    
    lines.append("")
    lines.append("=" * 80)
    lines.append("【异常详情】")
    lines.append("=" * 80)
    
    for type_name, anomalies in report["anomalies_by_type"].items():
        lines.append("")
        lines.append(f"--- {type_name} ({len(anomalies)}条) ---")
        
        for i, anomaly in enumerate(anomalies, 1):
            lines.append("")
            lines.append(f"{i}. 异常ID: {anomaly['anomaly_id']}")
            lines.append(f"   严重程度: {anomaly['severity']}")
            lines.append(f"   设备: {anomaly['device_id'] or '-'}")
            lines.append(f"   批号: {anomaly['batch_number'] or '-'}")
            lines.append(f"   时间段: {anomaly['start_time']} ~ {anomaly['end_time'] or '-'}")
            lines.append(f"   描述: {anomaly['description']}")
            lines.append(f"   已复核: {'是' if anomaly['has_been_reviewed'] else '否'}")
            if anomaly['review_result']:
                lines.append(f"   复核结果: {anomaly['review_result']}")
            if anomaly['affected_vaccinations']:
                lines.append(f"   影响接种: {len(anomaly['affected_vaccinations'])}人")
                for vac in anomaly['affected_vaccinations']:
                    lines.append(f"     - {vac['patient_name']} ({vac['patient_phone']}) @ {vac['vaccination_time']}")
    
    lines.append("")
    lines.append("=" * 80)
    lines.append("【需追踪的接种人】")
    lines.append("=" * 80)
    
    if report["patients_to_trace"]:
        for i, patient in enumerate(report["patients_to_trace"], 1):
            lines.append("")
            lines.append(f"{i}. {patient['patient_name']}")
            lines.append(f"   电话: {patient['patient_phone']}")
            lines.append(f"   接种时间: {patient['vaccination_time']}")
            lines.append(f"   批号: {patient['batch_number']}")
            lines.append(f"   接种ID: {patient['vaccination_id']}")
    else:
        lines.append("")
        lines.append("暂无需要追踪的接种人。")
    
    lines.append("")
    lines.append("=" * 80)
    lines.append("【人工复核记录】")
    lines.append("=" * 80)
    
    if report["manual_reviews"]:
        for i, review in enumerate(report["manual_reviews"], 1):
            lines.append("")
            lines.append(f"{i}. 异常ID: {review['anomaly_id']}")
            lines.append(f"   复核人: {review['reviewer']}")
            lines.append(f"   复核时间: {review['review_time']}")
            lines.append(f"   原始结果: {review['original_result']}")
            lines.append(f"   复核原因: {review['review_reason']}")
            lines.append(f"   最终结果: {review['final_result']}")
            lines.append(f"   影响范围变更: {review['impact_change']}")
    else:
        lines.append("")
        lines.append("暂无人工复核记录。")
    
    lines.append("")
    lines.append("=" * 80)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
