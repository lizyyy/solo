import pandas as pd
import json
import os
from datetime import datetime
from typing import Dict, List, Optional
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config
from .utils import format_datetime


class DataExporter:
    def __init__(self, output_dir: str = None):
        self.output_dir = output_dir or config.OUTPUT_DIR
        os.makedirs(self.output_dir, exist_ok=True)
    
    def export_markdown_report(self, risks: List[Dict], summary: Dict = None,
                                session_info: Dict = None, filename: str = None) -> str:
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"cleaning_review_report_{timestamp}.md"
        
        filepath = os.path.join(self.output_dir, filename)
        
        report_lines = []
        
        report_lines.append("# 咖啡机清洁断点追踪台 - 复盘报告")
        report_lines.append("")
        
        if session_info:
            report_lines.append(f"## 会话信息")
            report_lines.append(f"- **会话ID**: {session_info.get('session_id', 'N/A')}")
            report_lines.append(f"- **会话名称**: {session_info.get('session_name', 'N/A')}")
            report_lines.append(f"- **创建时间**: {session_info.get('created_time', 'N/A')}")
            report_lines.append("")
        
        if summary:
            report_lines.append("## 风险概览")
            report_lines.append(f"- **总风险数**: {summary.get('total_risks', 0)}")
            report_lines.append("")
            
            report_lines.append("### 按风险类型分布")
            by_type = summary.get('by_type', {})
            if by_type:
                for risk_type, count in by_type.items():
                    type_name = self._get_risk_type_name(risk_type)
                    report_lines.append(f"- **{type_name}**: {count} 条")
            else:
                report_lines.append("- 无数据")
            report_lines.append("")
            
            report_lines.append("### 按风险等级分布")
            by_level = summary.get('by_level', {})
            if by_level:
                for level, count in by_level.items():
                    level_name = config.RISK_LEVELS.get(level, level)
                    report_lines.append(f"- **{level_name}**: {count} 条")
            else:
                report_lines.append("- 无数据")
            report_lines.append("")
            
            report_lines.append("### 按门店分布")
            by_store = summary.get('by_store', {})
            if by_store:
                for store, count in by_store.items():
                    report_lines.append(f"- **{store}**: {count} 条")
            else:
                report_lines.append("- 无数据")
            report_lines.append("")
        
        report_lines.append("## 风险详情")
        report_lines.append("")
        
        if not risks:
            report_lines.append("> 暂无风险记录")
        else:
            risk_types = set([r.get('risk_type') for r in risks])
            
            for risk_type in sorted(risk_types):
                type_risks = [r for r in risks if r.get('risk_type') == risk_type]
                type_name = self._get_risk_type_name(risk_type)
                
                report_lines.append(f"### {type_name} ({len(type_risks)}条)")
                report_lines.append("")
                
                for i, risk in enumerate(type_risks, 1):
                    level_name = config.RISK_LEVELS.get(risk.get('risk_level', 'medium'), '中')
                    review_status = config.REVIEW_STATUS.get(risk.get('review_status', 'pending'), '待复核')
                    
                    report_lines.append(f"#### 风险 #{i}")
                    report_lines.append(f"- **风险ID**: {risk.get('risk_id', 'N/A')}")
                    report_lines.append(f"- **门店**: {risk.get('store_name', 'N/A')}")
                    report_lines.append(f"- **机器**: {risk.get('machine_id', 'N/A')}")
                    report_lines.append(f"- **风险等级**: {level_name}")
                    report_lines.append(f"- **复核状态**: {review_status}")
                    report_lines.append(f"- **描述**: {risk.get('description', 'N/A')}")
                    
                    if risk.get('review_comment'):
                        report_lines.append(f"- **复核意见**: {risk.get('review_comment')}")
                    
                    report_lines.append("")
        
        report_lines.append("---")
        report_lines.append(f"*报告生成时间: {format_datetime(datetime.now())}*")
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write('\n'.join(report_lines))
        
        return filepath
    
    def export_risk_csv(self, risks: List[Dict], filename: str = None) -> str:
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"risk_list_{timestamp}.csv"
        
        filepath = os.path.join(self.output_dir, filename)
        
        if not risks:
            empty_df = pd.DataFrame(columns=[
                "risk_id", "risk_type", "risk_type_name", "store_name", 
                "machine_id", "risk_level", "description", "review_status",
                "review_comment", "review_time"
            ])
            empty_df.to_csv(filepath, index=False, encoding='utf-8-sig')
            return filepath
        
        df = pd.DataFrame(risks)
        
        for col in ["risk_level"]:
            if col in df.columns:
                df[col + "_name"] = df[col].map(config.RISK_LEVELS)
        
        if "review_status" in df.columns:
            df["review_status_name"] = df["review_status"].map(config.REVIEW_STATUS)
        
        df.to_csv(filepath, index=False, encoding='utf-8-sig')
        
        return filepath
    
    def export_audit_json(self, risks: List[Dict], cleaning_records: pd.DataFrame = None,
                          work_orders: pd.DataFrame = None, volume_records: pd.DataFrame = None,
                          reviews: List[Dict] = None, session_info: Dict = None,
                          filename: str = None) -> str:
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"audit_package_{timestamp}.json"
        
        filepath = os.path.join(self.output_dir, filename)
        
        audit_package = {
            "audit_id": str(uuid.uuid4()),
            "generated_time": format_datetime(datetime.now()),
            "version": "1.0",
            "session_info": session_info or {},
            "risks": risks,
            "reviews": reviews or [],
            "source_data": {
                "cleaning_records_count": len(cleaning_records) if cleaning_records is not None else 0,
                "work_orders_count": len(work_orders) if work_orders is not None else 0,
                "volume_records_count": len(volume_records) if volume_records is not None else 0
            },
            "statistics": self._calculate_statistics(risks)
        }
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(audit_package, f, ensure_ascii=False, indent=2, default=str)
        
        return filepath
    
    def export_all(self, risks: List[Dict], cleaning_records: pd.DataFrame = None,
                   work_orders: pd.DataFrame = None, volume_records: pd.DataFrame = None,
                   reviews: List[Dict] = None, session_info: Dict = None) -> Dict[str, str]:
        summary = self._calculate_statistics(risks)
        
        markdown_path = self.export_markdown_report(
            risks=risks,
            summary=summary,
            session_info=session_info
        )
        
        csv_path = self.export_risk_csv(risks=risks)
        
        json_path = self.export_audit_json(
            risks=risks,
            cleaning_records=cleaning_records,
            work_orders=work_orders,
            volume_records=volume_records,
            reviews=reviews,
            session_info=session_info
        )
        
        return {
            "markdown": markdown_path,
            "csv": csv_path,
            "json": json_path
        }
    
    def _get_risk_type_name(self, risk_type: str) -> str:
        type_map = {
            "late_cleaning": "超时未清洁",
            "unclosed_workorder": "工单未闭环",
            "abnormal_volume": "出杯异常",
            "backfill_suspect": "补填嫌疑"
        }
        return type_map.get(risk_type, risk_type)
    
    def _calculate_statistics(self, risks: List[Dict]) -> Dict:
        stats = {
            "total_risks": len(risks),
            "by_type": {},
            "by_level": {},
            "by_store": {},
            "by_review_status": {}
        }
        
        if not risks:
            return stats
        
        for risk in risks:
            risk_type = risk.get("risk_type", "unknown")
            stats["by_type"][risk_type] = stats["by_type"].get(risk_type, 0) + 1
            
            risk_level = risk.get("risk_level", "medium")
            stats["by_level"][risk_level] = stats["by_level"].get(risk_level, 0) + 1
            
            store_name = risk.get("store_name", "unknown")
            stats["by_store"][store_name] = stats["by_store"].get(store_name, 0) + 1
            
            review_status = risk.get("review_status", "pending")
            stats["by_review_status"][review_status] = stats["by_review_status"].get(review_status, 0) + 1
        
        return stats
