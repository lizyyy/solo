import pandas as pd
import numpy as np
import json
from typing import Dict, List, Optional, Any
from datetime import datetime
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DataExporter:
    def __init__(self, exports_dir: Path):
        self.exports_dir = exports_dir
        self.exports_dir.mkdir(parents=True, exist_ok=True)
    
    def export_markdown_report(
        self,
        engine_result: Any,
        merged_data: pd.DataFrame,
        workflow_state: Optional[Any] = None,
        session_id: str = "",
        filename: Optional[str] = None
    ) -> Path:
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"雨后井盖异响复盘报告_{timestamp}.md"
        
        file_path = self.exports_dir / filename
        
        report_content = self._generate_markdown_content(
            engine_result, merged_data, workflow_state, session_id
        )
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(report_content)
        
        logger.info(f"Markdown 复盘报告已导出: {file_path}")
        return file_path
    
    def _generate_markdown_content(
        self,
        engine_result: Any,
        merged_data: pd.DataFrame,
        workflow_state: Optional[Any] = None,
        session_id: str = ""
    ) -> str:
        lines = []
        
        lines.append("# 雨后井盖异响排查复盘报告")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**会话ID**: {session_id if session_id else 'N/A'}")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        lines.append("## 一、风险概览")
        lines.append("")
        
        if engine_result and hasattr(engine_result, 'risk_summary'):
            risk_summary = engine_result.risk_summary
            lines.append("| 风险等级 | 数量 | 颜色标识 |")
            lines.append("|----------|------|----------|")
            lines.append(f"| 极高风险 | {risk_summary.get('critical', 0)} | 🔴 #DC2626 |")
            lines.append(f"| 高风险 | {risk_summary.get('high', 0)} | 🟠 #EA580C |")
            lines.append(f"| 中风险 | {risk_summary.get('medium', 0)} | 🟡 #CA8A04 |")
            lines.append(f"| 低风险 | {risk_summary.get('low', 0)} | 🟢 #16A34A |")
            lines.append("")
        else:
            lines.append("*暂无风险数据*")
            lines.append("")
        
        lines.append("## 二、规则触发统计")
        lines.append("")
        
        if engine_result and hasattr(engine_result, 'rules_statistics'):
            stats = engine_result.rules_statistics
            for rule_key, rule_info in stats.items():
                lines.append(f"### {rule_info['rule_name']}")
                lines.append(f"- **触发次数**: {rule_info['triggered_count']}")
                lines.append(f"- **说明**: {rule_info['description']}")
                lines.append("")
        else:
            lines.append("*暂无规则统计数据*")
            lines.append("")
        
        lines.append("## 三、高风险记录详情")
        lines.append("")
        
        high_risk_df = pd.DataFrame()
        if engine_result and hasattr(engine_result, 'high_risk_records'):
            high_risk_df = engine_result.high_risk_records
        
        if not high_risk_df.empty:
            display_cols = ["井盖编号", "街区", "风险评分", "风险等级", "触发规则数", "触发规则列表"]
            available_cols = [col for col in display_cols if col in high_risk_df.columns]
            
            for _, row in high_risk_df.iterrows():
                manhole_id = row.get("井盖编号", "未知")
                risk_level = row.get("风险等级", "unknown")
                risk_score = row.get("风险评分", 0)
                block = row.get("街区", "未知")
                rules = row.get("触发规则列表", "")
                
                level_emoji = "🔴" if risk_level == "critical" else \
                             "🟠" if risk_level == "high" else \
                             "🟡" if risk_level == "medium" else "🟢"
                
                lines.append(f"### {level_emoji} 井盖: {manhole_id}")
                lines.append(f"- **街区**: {block}")
                lines.append(f"- **风险评分**: {risk_score}")
                lines.append(f"- **触发规则**: {rules}")
                
                if "经度" in row.index and "纬度" in row.index:
                    lines.append(f"- **坐标**: ({row['纬度']}, {row['经度']})")
                
                if "异响次数" in row.index and pd.notna(row["异响次数"]):
                    lines.append(f"- **异响次数**: {int(row['异响次数'])}")
                
                if "积水深度" in row.index and pd.notna(row["积水深度"]):
                    lines.append(f"- **积水深度**: {row['积水深度']} cm")
                
                lines.append("")
        else:
            lines.append("*暂无高风险记录*")
            lines.append("")
        
        lines.append("## 四、工作流状态")
        lines.append("")
        
        if workflow_state:
            lines.append(f"- **已复核记录数**: {len(workflow_state.reviewed_ids)}")
            lines.append(f"- **已合并重复组数**: {len(workflow_state.merged_groups)}")
            lines.append(f"- **已分配任务数**: {len(workflow_state.assigned_tasks)}")
            lines.append("")
            
            if workflow_state.assigned_tasks:
                lines.append("### 待处理任务")
                lines.append("")
                lines.append("| 任务ID | 井盖编号 | 责任人 | 优先级 | 截止时间 |")
                lines.append("|--------|----------|--------|--------|----------|")
                
                for task in workflow_state.assigned_tasks:
                    lines.append(f"| {task.get('task_id', '')} | {task.get('manhole_id', '')} | {task.get('assignee', '')} | {task.get('priority', '')} | {task.get('due_at', '')} |")
                lines.append("")
        else:
            lines.append("*暂无工作流状态*")
            lines.append("")
        
        lines.append("## 五、数据统计")
        lines.append("")
        
        if not merged_data.empty:
            lines.append(f"- **合并记录总数**: {len(merged_data)}")
            
            if "街区" in merged_data.columns:
                block_counts = merged_data["街区"].value_counts()
                lines.append(f"- **按街区分布**:")
                for block, count in block_counts.items():
                    lines.append(f"  - {block}: {count} 条")
            
            lines.append("")
        else:
            lines.append("*暂无数据统计*")
            lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*本报告由「雨后井盖异响排查台」自动生成*")
        
        return "\n".join(lines)
    
    def export_dispatch_csv(
        self,
        high_risk_records: pd.DataFrame,
        assigned_tasks: List[Dict],
        filename: Optional[str] = None
    ) -> Path:
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"井盖异响派单表_{timestamp}.csv"
        
        file_path = self.exports_dir / filename
        
        dispatch_data = []
        
        if not high_risk_records.empty:
            for _, row in high_risk_records.iterrows():
                assigned_task = None
                for task in assigned_tasks:
                    if task.get("manhole_id") == row.get("井盖编号"):
                        assigned_task = task
                        break
                
                record = {
                    "派单状态": "已派单" if assigned_task else "待派单",
                    "井盖编号": row.get("井盖编号", ""),
                    "街区": row.get("街区", "未知"),
                    "纬度": row.get("纬度", 0),
                    "经度": row.get("经度", 0),
                    "风险评分": row.get("风险评分", 0),
                    "风险等级": row.get("风险等级", "low"),
                    "触发规则数": row.get("触发规则数", 0),
                    "触发规则列表": row.get("触发规则列表", ""),
                    "异响次数": row.get("异响次数", 0),
                    "积水深度": row.get("积水深度", 0),
                    "责任人": assigned_task.get("assignee", "") if assigned_task else "",
                    "优先级": assigned_task.get("priority", "medium") if assigned_task else "medium",
                    "截止时间": assigned_task.get("due_at", "") if assigned_task else "",
                    "任务ID": assigned_task.get("task_id", "") if assigned_task else ""
                }
                dispatch_data.append(record)
        
        dispatch_df = pd.DataFrame(dispatch_data)
        
        if not dispatch_df.empty:
            priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
            dispatch_df = dispatch_df.sort_values(
                by=["风险等级", "风险评分"],
                key=lambda x: x.map(priority_order) if x.name == "风险等级" else x,
                ascending=[True, False]
            )
        
        dispatch_df.to_csv(file_path, index=False, encoding='utf-8-sig')
        
        logger.info(f"CSV 派单表已导出: {file_path}")
        return file_path
    
    def export_audit_json(
        self,
        audit_package: Dict[str, Any],
        merged_data: Optional[pd.DataFrame] = None,
        filename: Optional[str] = None
    ) -> Path:
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"井盖异响审计包_{timestamp}.json"
        
        file_path = self.exports_dir / filename
        
        export_package = audit_package.copy()
        
        if merged_data is not None and not merged_data.empty:
            data_records = []
            for _, row in merged_data.iterrows():
                record = {}
                for col in merged_data.columns:
                    val = row[col]
                    if isinstance(val, datetime):
                        record[col] = val.isoformat()
                    elif pd.isna(val):
                        record[col] = None
                    elif isinstance(val, (np.int64, np.int32)):
                        record[col] = int(val)
                    elif isinstance(val, (np.float64, np.float32)):
                        record[col] = float(val)
                    else:
                        record[col] = val
                data_records.append(record)
            
            export_package["merged_records"] = data_records
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(export_package, f, ensure_ascii=False, indent=2, default=str)
        
        logger.info(f"JSON 审计包已导出: {file_path}")
        return file_path
    
    def export_all(
        self,
        engine_result: Any,
        merged_data: pd.DataFrame,
        workflow_state: Optional[Any] = None,
        audit_package: Optional[Dict[str, Any]] = None,
        session_id: str = ""
    ) -> Dict[str, Path]:
        results = {}
        
        results["markdown"] = self.export_markdown_report(
            engine_result, merged_data, workflow_state, session_id
        )
        
        high_risk_df = pd.DataFrame()
        if engine_result and hasattr(engine_result, 'high_risk_records'):
            high_risk_df = engine_result.high_risk_records
        
        assigned_tasks = workflow_state.assigned_tasks if workflow_state else []
        results["dispatch_csv"] = self.export_dispatch_csv(
            high_risk_df, assigned_tasks
        )
        
        if audit_package:
            results["audit_json"] = self.export_audit_json(
                audit_package, merged_data
            )
        
        return results
    
    def list_exports(self) -> List[Dict]:
        exports = []
        
        for file_path in self.exports_dir.glob("*"):
            if file_path.is_file():
                exports.append({
                    "filename": file_path.name,
                    "size_bytes": file_path.stat().st_size,
                    "modified_time": datetime.fromtimestamp(file_path.stat().st_mtime).isoformat(),
                    "file_type": self._detect_file_type(file_path.name),
                    "full_path": str(file_path)
                })
        
        exports.sort(key=lambda x: x["modified_time"], reverse=True)
        return exports
    
    def _detect_file_type(self, filename: str) -> str:
        if filename.endswith(".md"):
            return "复盘报告"
        elif "派单表" in filename or filename.endswith(".csv"):
            return "派单表"
        elif "审计包" in filename or filename.endswith(".json"):
            return "审计包"
        else:
            return "其他"
    
    def cleanup_old_exports(self, days: int = 30) -> int:
        cutoff = datetime.now() - pd.Timedelta(days=days)
        deleted_count = 0
        
        for file_path in self.exports_dir.glob("*"):
            if file_path.is_file():
                mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
                if mtime < cutoff:
                    file_path.unlink()
                    deleted_count += 1
                    logger.info(f"已删除旧导出文件: {file_path.name}")
        
        return deleted_count
