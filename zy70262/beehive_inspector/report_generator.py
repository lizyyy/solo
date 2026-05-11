"""分析报告生成模块"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from collections import defaultdict
from beehive_inspector.storage import FileStorage
from beehive_inspector.swap_manager import SwapManager


class ReportGenerator:
    def __init__(self, storage: FileStorage, swap_manager: SwapManager):
        self.storage = storage
        self.swap_manager = swap_manager

    def generate_queen_status_report(self) -> Dict[str, Any]:
        beehives = self.storage.load_beehives()
        inspections = self.storage.load_inspections()
        
        hive_inspections = defaultdict(list)
        for insp in inspections:
            hive_id = insp.get("beehive_id")
            if hive_id:
                hive_inspections[hive_id].append(insp)
        
        report = {
            "generated_at": datetime.now().isoformat(),
            "total_beehives": len(beehives),
            "queen_status_distribution": {},
            "at_risk_beehives": [],
            "recent_status_changes": [],
        }

        status_count = defaultdict(int)
        for hive in beehives:
            status = hive.get("queen_status", "未知")
            status_count[status] += 1
            
            if status in ["待观察", "失踪", "更换"]:
                report["at_risk_beehives"].append({
                    "beehive_id": hive["beehive_id"],
                    "location": hive.get("location"),
                    "queen_status": status,
                    "last_inspection": hive.get("last_inspection_date"),
                })
        
        report["queen_status_distribution"] = dict(status_count)

        for hive_id, insp_list in hive_inspections.items():
            if len(insp_list) < 2:
                continue
            
            sorted_insp = sorted(insp_list, key=lambda x: x.get("inspection_date", ""))
            for i in range(1, len(sorted_insp)):
                prev = sorted_insp[i-1].get("queen_status")
                curr = sorted_insp[i].get("queen_status")
                if prev and curr and prev != curr:
                    report["recent_status_changes"].append({
                        "beehive_id": hive_id,
                        "previous_status": prev,
                        "current_status": curr,
                        "change_date": sorted_insp[i].get("inspection_date"),
                    })

        return report

    def generate_honey_risk_report(self, threshold_low: str = "低", 
                                    threshold_days: int = 14) -> Dict[str, Any]:
        inspections = self.storage.load_inspections()
        swaps = self.storage.load_swaps()

        report = {
            "generated_at": datetime.now().isoformat(),
            "total_inspections": len(inspections),
            "low_honey_beehives": [],
            "consistently_low_beehives": [],
            "honey_level_distribution": {},
            "swap_correlations": [],
        }

        hive_honey_history = defaultdict(list)
        honey_count = defaultdict(int)
        
        for insp in inspections:
            hive_id = insp.get("beehive_id")
            honey_level = str(insp.get("honey_level", ""))
            insp_date = insp.get("inspection_date")
            
            if hive_id:
                hive_honey_history[hive_id].append({
                    "date": insp_date,
                    "level": honey_level,
                    "diseases": insp.get("diseases", ""),
                })
            
            if honey_level:
                honey_count[honey_level] += 1

        report["honey_level_distribution"] = dict(honey_count)

        for hive_id, history in hive_honey_history.items():
            sorted_history = sorted(history, key=lambda x: x["date"])
            
            low_records = [h for h in sorted_history if h["level"] == threshold_low]
            
            if low_records:
                latest = sorted_history[-1]
                report["low_honey_beehives"].append({
                    "beehive_id": hive_id,
                    "latest_level": latest["level"],
                    "latest_date": latest["date"],
                    "latest_diseases": latest["diseases"],
                    "low_record_count": len(low_records),
                })
            
            recent_low = [h for h in sorted_history if h["level"] == threshold_low]
            if len(recent_low) >= 2:
                latest_low_dates = [h["date"] for h in recent_low[-2:]]
                try:
                    date1 = datetime.strptime(str(latest_low_dates[0]), "%Y-%m-%d")
                    date2 = datetime.strptime(str(latest_low_dates[1]), "%Y-%m-%d")
                    days_diff = abs((date2 - date1).days)
                    
                    if days_diff <= threshold_days:
                        report["consistently_low_beehives"].append({
                            "beehive_id": hive_id,
                            "consecutive_low_count": len(recent_low),
                            "last_low_date": latest_low_dates[-1],
                        })
                except (ValueError, TypeError):
                    pass

        for hive_id in hive_honey_history.keys():
            hive_swaps = self.swap_manager.get_swaps_for_beehive(hive_id)
            if hive_swaps:
                report["swap_correlations"].append({
                    "beehive_id": hive_id,
                    "swap_count": len(hive_swaps),
                    "latest_swap_date": hive_swaps[-1]["swap_date"] if hive_swaps else None,
                    "honey_history": [{"date": h["date"], "level": h["level"]} 
                                     for h in sorted(hive_honey_history[hive_id], key=lambda x: x["date"])],
                })

        return report

    def generate_disease_report(self) -> Dict[str, Any]:
        inspections = self.storage.load_inspections()
        swaps = self.storage.load_swaps()

        report = {
            "generated_at": datetime.now().isoformat(),
            "total_inspections": len(inspections),
            "disease_summary": {},
            "active_disease_beehives": [],
            "disease_spread_risk": [],
        }

        disease_count = defaultdict(int)
        hive_diseases = defaultdict(list)

        for insp in inspections:
            diseases_str = str(insp.get("diseases", "无"))
            hive_id = insp.get("beehive_id")
            insp_date = insp.get("inspection_date")
            
            if diseases_str and diseases_str != "无" and diseases_str != "":
                diseases = [d.strip() for d in diseases_str.split(";")]
                for disease in diseases:
                    disease_count[disease] += 1
                    if hive_id:
                        hive_diseases[hive_id].append({
                            "date": insp_date,
                            "disease": disease,
                        })

        report["disease_summary"] = dict(disease_count)

        today = datetime.now()
        for hive_id, history in hive_diseases.items():
            sorted_history = sorted(history, key=lambda x: x["date"])
            latest = sorted_history[-1]
            
            try:
                latest_date = datetime.strptime(str(latest["date"]), "%Y-%m-%d")
                days_since = (today - latest_date).days
            except (ValueError, TypeError):
                days_since = -1
            
            report["active_disease_beehives"].append({
                "beehive_id": hive_id,
                "latest_disease": latest["disease"],
                "latest_date": latest["date"],
                "days_since_detection": days_since,
                "total_disease_records": len(sorted_history),
            })

        for hive_id, history in hive_diseases.items():
            hive_swaps = self.swap_manager.get_swaps_for_beehive(hive_id)
            if hive_swaps:
                latest_swap = sorted(hive_swaps, key=lambda x: x["swap_date"])[-1]
                for disease_record in history:
                    try:
                        swap_date = datetime.strptime(str(latest_swap["swap_date"]), "%Y-%m-%d")
                        disease_date = datetime.strptime(str(disease_record["date"]), "%Y-%m-%d")
                        
                        if disease_date >= swap_date:
                            report["disease_spread_risk"].append({
                                "source_hive": hive_id,
                                "swap_partner": latest_swap["from_beehive_id"] if latest_swap["to_beehive_id"] == hive_id else latest_swap["to_beehive_id"],
                                "swap_date": latest_swap["swap_date"],
                                "disease_detected": disease_record["disease"],
                                "detection_date": disease_record["date"],
                            })
                            break
                    except (ValueError, TypeError):
                        pass

        return report

    def generate_full_report(self) -> Dict[str, Any]:
        return {
            "queen_status": self.generate_queen_status_report(),
            "honey_risk": self.generate_honey_risk_report(),
            "disease": self.generate_disease_report(),
        }

    def format_report_text(self, report: Dict[str, Any], title: str = "蜂箱分析报告") -> str:
        lines = []
        lines.append(f"{'=' * 60}")
        lines.append(f"  {title}")
        lines.append(f"{'=' * 60}")
        lines.append(f"生成时间: {report.get('generated_at', datetime.now().isoformat())}")
        lines.append("")
        
        return "\n".join(lines)

    def format_queen_report_text(self, report: Dict[str, Any]) -> str:
        lines = []
        lines.append(self.format_report_text(report, "蜂王状态报告"))
        lines.append(f"蜂箱总数: {report['total_beehives']}")
        lines.append("")
        lines.append("蜂王状态分布:")
        for status, count in report["queen_status_distribution"].items():
            lines.append(f"  - {status}: {count} 箱")
        lines.append("")
        
        if report["at_risk_beehives"]:
            lines.append("⚠️  高风险蜂箱 (蜂王异常):")
            for hive in report["at_risk_beehives"]:
                lines.append(f"  - {hive['beehive_id']} ({hive['location']}): 蜂王状态={hive['queen_status']}, 最后巡检={hive['last_inspection']}")
        else:
            lines.append("✅ 无高风险蜂箱")
        lines.append("")
        
        if report["recent_status_changes"]:
            lines.append("📝 近期蜂王状态变化:")
            for change in report["recent_status_changes"]:
                lines.append(f"  - {change['beehive_id']}: {change['previous_status']} → {change['current_status']} ({change['change_date']})")
        
        return "\n".join(lines)

    def format_honey_report_text(self, report: Dict[str, Any]) -> str:
        lines = []
        lines.append(self.format_report_text(report, "产蜜风险报告"))
        lines.append(f"巡检记录总数: {report['total_inspections']}")
        lines.append("")
        lines.append("蜜量分布:")
        for level, count in report["honey_level_distribution"].items():
            lines.append(f"  - {level}: {count} 次")
        lines.append("")
        
        if report["low_honey_beehives"]:
            lines.append("⚠️  低蜜量蜂箱:")
            for hive in report["low_honey_beehives"]:
                lines.append(f"  - {hive['beehive_id']}: 最新蜜量={hive['latest_level']} ({hive['latest_date']}), 低记录数={hive['low_record_count']}")
                if hive["latest_diseases"] and hive["latest_diseases"] != "无":
                    lines.append(f"    病虫害: {hive['latest_diseases']}")
        lines.append("")
        
        if report["consistently_low_beehives"]:
            lines.append("🚨 持续低蜜量蜂箱 (需关注):")
            for hive in report["consistently_low_beehives"]:
                lines.append(f"  - {hive['beehive_id']}: 连续低记录={hive['consecutive_low_count']}次, 上次={hive['last_low_date']}")
        lines.append("")
        
        if report["swap_correlations"]:
            lines.append("🔗 换箱与蜜量关联分析:")
            for corr in report["swap_correlations"]:
                lines.append(f"  - {corr['beehive_id']}: 换箱次数={corr['swap_count']}")
                history_parts = [f"{h['date']}({h['level']})" for h in corr['honey_history']]
                lines.append(f"    蜜量历史: {', '.join(history_parts)}")
        
        return "\n".join(lines)

    def format_disease_report_text(self, report: Dict[str, Any]) -> str:
        lines = []
        lines.append(self.format_report_text(report, "病虫害分析报告"))
        lines.append(f"巡检记录总数: {report['total_inspections']}")
        lines.append("")
        
        if report["disease_summary"]:
            lines.append("病虫害统计:")
            for disease, count in report["disease_summary"].items():
                lines.append(f"  - {disease}: {count} 次")
        else:
            lines.append("✅ 无病虫害记录")
        lines.append("")
        
        if report["active_disease_beehives"]:
            lines.append("⚠️  有病虫害的蜂箱:")
            for hive in report["active_disease_beehives"]:
                days_str = f"{hive['days_since_detection']}天前" if hive['days_since_detection'] >= 0 else "未知"
                lines.append(f"  - {hive['beehive_id']}: {hive['latest_disease']} ({hive['latest_date']}, {days_str}), 累计{hive['total_disease_records']}次")
        lines.append("")
        
        if report["disease_spread_risk"]:
            lines.append("🚨 病虫害传播风险 (换箱后发现):")
            for risk in report["disease_spread_risk"]:
                lines.append(f"  - {risk['source_hive']} ↔ {risk['swap_partner']}: 换箱={risk['swap_date']}, 发病={risk['disease_detected']}({risk['detection_date']})")
        
        return "\n".join(lines)
