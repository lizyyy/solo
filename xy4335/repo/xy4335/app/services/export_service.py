from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
import csv

from app.config import RISK_LEVELS, RISK_FLAGS


class ExportService:
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def export_risk_review_markdown(
        self,
        call_data: Dict[str, Any],
        file_name: str = None
    ) -> Path:
        if not file_name:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            file_name = f"review_{call_data['call_id']}_{timestamp}.md"
        
        file_path = self.output_dir / file_name
        
        current_risk_name = RISK_LEVELS.get(
            call_data.get("current_risk_level", "green"), 
            {"name": "未知"}
        )["name"]
        
        initial_risk_name = RISK_LEVELS.get(
            call_data.get("initial_risk_level", "green"),
            {"name": "未知"}
        )["name"]
        
        flag_names = []
        for flag in call_data.get("assessment_flags", []):
            flag_info = RISK_FLAGS.get(flag, {"name": flag})
            flag_names.append(flag_info["name"])
        
        md_content = f"""# 风险来电复盘报告

## 基本信息

| 项目 | 内容 |
|------|------|
| 来电ID | {call_data.get('call_id', 'N/A')} |
| 来电者ID | {call_data.get('caller_id', 'N/A')} |
| 来电时间 | {call_data.get('call_time', 'N/A')} |
| 通话时长 | {call_data.get('duration_minutes', 0)} 分钟 |
| 接线员 | {call_data.get('operator_name', 'N/A')} ({call_data.get('operator_id', 'N/A')}) |
| 初判风险等级 | {initial_risk_name} |
| 当前风险等级 | **{current_risk_name}** |
| 风险评分 | {call_data.get('risk_score', 0)} 分 |
| 生成时间 | {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} |

## 风险标志

"""
        
        if flag_names:
            for flag in flag_names:
                md_content += f"- ⚠️ {flag}\n"
        else:
            md_content += "无特殊风险标志\n"
        
        md_content += f"""

## 通话摘要

{call_data.get('summary_text', '无摘要记录')}

## 评估原因

{call_data.get('assessment_reasons', '无评估原因记录')}

"""
        
        follow_ups = call_data.get("follow_ups", [])
        if follow_ups:
            md_content += "## 回访记录\n\n"
            md_content += "| 计划时间 | 实际时间 | 状态 | 结果 | 内容 |\n"
            md_content += "|----------|----------|------|------|------|\n"
            for fu in follow_ups:
                status = "已完成" if fu.get("is_completed") else "待执行"
                scheduled = fu.get("scheduled_time", "N/A")
                actual = fu.get("actual_time", "N/A")
                result = fu.get("result", "N/A")
                content = (fu.get("content", "") or "")[:50]
                md_content += f"| {scheduled} | {actual} | {status} | {result} | {content}... |\n"
            md_content += "\n"
        
        supervisor_notes = call_data.get("supervisor_notes", [])
        if supervisor_notes:
            md_content += "## 督导意见\n\n"
            for i, note in enumerate(supervisor_notes, 1):
                supervisor = note.get("supervisor_name", "未知督导")
                created = note.get("created_at", "N/A")
                md_content += f"### 意见 {i}\n\n"
                md_content += f"**督导**: {supervisor}  \n"
                md_content += f"**时间**: {created}  \n\n"
                md_content += f"{note.get('note_text', '')}\n\n"
        
        if call_data.get("has_referral"):
            md_content += "## 转介信息\n\n"
            md_content += f"- 转介至: {call_data.get('referral_to', 'N/A')}\n"
            md_content += f"- 转介时间: {call_data.get('referral_time', 'N/A')}\n\n"
        
        md_content += """---

*本报告由风险来电复盘器自动生成*
"""
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(md_content)
        
        return file_path

    def export_todo_csv(
        self,
        todo_items: List[Dict[str, Any]],
        file_name: str = None
    ) -> Path:
        if not file_name:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            file_name = f"todo_{timestamp}.csv"
        
        file_path = self.output_dir / file_name
        
        fieldnames = [
            "来电ID",
            "来电者ID",
            "来电时间",
            "风险等级",
            "风险评分",
            "风险标志",
            "待办类型",
            "截止时间",
            "接线员",
            "状态",
            "备注"
        ]
        
        with open(file_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for item in todo_items:
                risk_name = RISK_LEVELS.get(
                    item.get("risk_level", "green"),
                    {"name": "未知"}
                )["name"]
                
                flag_names = []
                for flag in item.get("flags", []):
                    flag_info = RISK_FLAGS.get(flag, {"name": flag})
                    flag_names.append(flag_info["name"])
                
                writer.writerow({
                    "来电ID": item.get("call_id", ""),
                    "来电者ID": item.get("caller_id", ""),
                    "来电时间": item.get("call_time", ""),
                    "风险等级": risk_name,
                    "风险评分": item.get("risk_score", 0),
                    "风险标志": "; ".join(flag_names),
                    "待办类型": item.get("todo_type", "回访"),
                    "截止时间": item.get("deadline", ""),
                    "接线员": item.get("operator_name", ""),
                    "状态": item.get("status", "待处理"),
                    "备注": item.get("notes", "")
                })
        
        return file_path

    def export_batch_review_markdown(
        self,
        calls_data: List[Dict[str, Any]],
        title: str = None,
        file_name: str = None
    ) -> Path:
        if not file_name:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            file_name = f"batch_review_{timestamp}.md"
        
        file_path = self.output_dir / file_name
        
        if not title:
            title = f"批量复盘报告 - {datetime.now().strftime('%Y-%m-%d')}"
        
        md_content = f"# {title}\n\n"
        md_content += f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
        md_content += f"---\n\n"
        
        for call_data in calls_data:
            current_risk_name = RISK_LEVELS.get(
                call_data.get("current_risk_level", "green"),
                {"name": "未知"}
            )["name"]
            
            flag_names = []
            for flag in call_data.get("assessment_flags", []):
                flag_info = RISK_FLAGS.get(flag, {"name": flag})
                flag_names.append(flag_info["name"])
            
            md_content += f"## 来电 {call_data.get('call_id', 'N/A')}\n\n"
            md_content += f"- **来电时间**: {call_data.get('call_time', 'N/A')}\n"
            md_content += f"- **当前风险等级**: {current_risk_name}\n"
            md_content += f"- **风险评分**: {call_data.get('risk_score', 0)} 分\n"
            md_content += f"- **风险标志**: {', '.join(flag_names) if flag_names else '无'}\n\n"
            
            md_content += f"### 通话摘要\n\n"
            md_content += f"{call_data.get('summary_text', '无摘要记录')}\n\n"
            
            if call_data.get("supervisor_notes"):
                md_content += f"### 督导意见\n\n"
                for note in call_data["supervisor_notes"]:
                    supervisor = note.get("supervisor_name", "未知督导")
                    md_content += f"**[{supervisor}]**: {note.get('note_text', '')}\n\n"
            
            md_content += f"---\n\n"
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(md_content)
        
        return file_path

    def generate_todo_list_from_queue(
        self,
        risk_queue: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        todo_items = []
        
        for call in risk_queue:
            risk_level = call.get("current_risk_level", "green")
            flags = call.get("assessment_flags", [])
            
            if "missed_followup" in flags:
                todo_items.append({
                    "call_id": call.get("call_id"),
                    "caller_id": call.get("caller_id"),
                    "call_time": call.get("call_time"),
                    "risk_level": risk_level,
                    "risk_score": call.get("risk_score", 0),
                    "flags": flags,
                    "todo_type": "漏回访跟进",
                    "deadline": "立即",
                    "operator_name": call.get("operator_name", ""),
                    "status": "紧急",
                    "notes": "存在漏回访记录，需立即跟进"
                })
            
            if "referral_timeout" in flags:
                todo_items.append({
                    "call_id": call.get("call_id"),
                    "caller_id": call.get("caller_id"),
                    "call_time": call.get("call_time"),
                    "risk_level": risk_level,
                    "risk_score": call.get("risk_score", 0),
                    "flags": flags,
                    "todo_type": "转介超时",
                    "deadline": "立即",
                    "operator_name": call.get("operator_name", ""),
                    "status": "紧急",
                    "notes": "转介已超时，需确认转介状态"
                })
            
            if risk_level in ["red", "orange"]:
                follow_ups = call.get("follow_ups", [])
                has_pending_fu = any(not fu.get("is_completed") for fu in follow_ups)
                
                if not has_pending_fu:
                    todo_items.append({
                        "call_id": call.get("call_id"),
                        "caller_id": call.get("caller_id"),
                        "call_time": call.get("call_time"),
                        "risk_level": risk_level,
                        "risk_score": call.get("risk_score", 0),
                        "flags": flags,
                        "todo_type": "高风险回访",
                        "deadline": "24小时内",
                        "operator_name": call.get("operator_name", ""),
                        "status": "待安排",
                        "notes": f"{RISK_LEVELS[risk_level]['name']}来电，需安排回访"
                    })
        
        return todo_items
