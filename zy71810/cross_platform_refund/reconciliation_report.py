import pandas as pd
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional
from collections import defaultdict

from config import SUPPLEMENT_STATUS, OUTPUT_DIR
from core import SupplementManager
from models import SupplementRecord
from errors import EmptyDataError, ExportError, show_warning


class ReconciliationReportGenerator:
    def __init__(self, manager: SupplementManager):
        self.manager = manager
    
    def _format_amount(self, amount: float) -> str:
        return f"¥{amount:,.2f}"
    
    def _get_processing_criteria(self, record: SupplementRecord) -> str:
        status = record.补单状态
        criteria = []
        
        if status == SUPPLEMENT_STATUS["CONFIRMED"]:
            if record.处理口径.startswith("系统自动匹配"):
                criteria.append("系统自动匹配确认，对账单与退款流水信息一致")
            elif record.处理口径 == "人工修改确认":
                criteria.append("人工复核后确认，已核对相关凭证")
            else:
                criteria.append(f"确认口径：{record.处理口径}")
        
        elif status == SUPPLEMENT_STATUS["MANUAL_MODIFIED"]:
            criteria.append("人工修改后确认")
            if record.修改前内容:
                changes = []
                for k, v in record.修改前内容.items():
                    new_v = getattr(record, k, "")
                    if k == "补单金额":
                        changes.append(f"{k}: {self._format_amount(float(v))} → {self._format_amount(float(new_v))}")
                    else:
                        changes.append(f"{k}: {v} → {new_v}")
                criteria.append(f"修改内容：{'; '.join(changes)}")
        
        elif status == SUPPLEMENT_STATUS["PENDING"]:
            if "金额不匹配" in record.处理口径:
                criteria.append("待处理：对账单金额与退款金额不匹配，需人工核实")
            elif "未匹配到对账单" in record.处理口径:
                criteria.append("待处理：未找到对应对账单，需人工补录交易信息")
            elif "有退款记录无退款流水" in record.处理口径:
                criteria.append("待处理：对账单有退款标记但无退款流水，需核实退款实际到账情况")
            else:
                criteria.append(f"待处理：{record.处理口径}")
        
        return "；".join(criteria)
    
    def generate_summary(self) -> Dict[str, Any]:
        stats = self.manager.get_statistics()
        by_status = self.manager.get_supplements_by_status()
        
        confirmed_records = by_status.get(SUPPLEMENT_STATUS["CONFIRMED"], [])
        pending_records = by_status.get(SUPPLEMENT_STATUS["PENDING"], [])
        modified_records = [r for r in self.manager.supplement_records.values() 
                           if r.补单状态 != SUPPLEMENT_STATUS["REVOKED"] and r.是否人工修改]
        
        confirmed_amount = sum(r.补单金额 for r in confirmed_records)
        pending_amount = sum(r.补单金额 for r in pending_records)
        modified_amount = sum(r.补单金额 for r in modified_records)
        
        by_platform_confirmed = defaultdict(float)
        for r in confirmed_records:
            if r.关联对账单信息:
                platform = r.关联对账单信息.get("支付平台", "未知平台")
                by_platform_confirmed[platform] += r.补单金额
        
        by_platform_pending = defaultdict(float)
        for r in pending_records:
            if r.关联对账单信息:
                platform = r.关联对账单信息.get("支付平台", "未知平台")
                by_platform_pending[platform] += r.补单金额
        
        return {
            "生成时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "统计周期": f"截至 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "总体情况": {
                "总记录数": stats["总记录数（不含已撤回）"],
                "总金额": stats["总补单金额"],
                "已撤回记录数": stats["已撤回记录数"]
            },
            "已确认记录": {
                "数量": len(confirmed_records),
                "金额": self._format_amount(confirmed_amount),
                "占比": f"{len(confirmed_records)/max(stats['总记录数（不含已撤回）'],1)*100:.1f}%",
                "按平台统计": {k: self._format_amount(v) for k, v in by_platform_confirmed.items()}
            },
            "待补录记录": {
                "数量": len(pending_records),
                "金额": self._format_amount(pending_amount),
                "占比": f"{len(pending_records)/max(stats['总记录数（不含已撤回）'],1)*100:.1f}%",
                "按平台统计": {k: self._format_amount(v) for k, v in by_platform_pending.items()}
            },
            "人工修改记录": {
                "数量": len(modified_records),
                "金额": self._format_amount(modified_amount),
                "占比": f"{len(modified_records)/max(stats['总记录数（不含已撤回）'],1)*100:.1f}%"
            }
        }
    
    def generate_detailed_report(self, output_path: Optional[str] = None) -> str:
        if not self.manager.supplement_records:
            raise EmptyDataError("补单")
        
        if output_path is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = OUTPUT_DIR / f"跨平台退款补单对账说明_{timestamp}.xlsx"
        
        output_path = Path(output_path)
        
        try:
            with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
                summary = self.generate_summary()
                
                summary_data = []
                for section, data in summary.items():
                    if isinstance(data, dict):
                        for key, value in data.items():
                            if isinstance(value, dict):
                                for sub_key, sub_value in value.items():
                                    summary_data.append({
                                        "项目": section,
                                        "明细项目": f"{key} - {sub_key}",
                                        "数值": str(sub_value)
                                    })
                            else:
                                summary_data.append({
                                    "项目": section,
                                    "明细项目": key,
                                    "数值": str(value)
                                })
                    else:
                        summary_data.append({
                            "项目": section,
                            "明细项目": "",
                            "数值": str(data)
                        })
                
                pd.DataFrame(summary_data).to_excel(writer, sheet_name="一、汇总概览", index=False)
                
                by_status = self.manager.get_supplements_by_status()
                
                confirmed = by_status.get(SUPPLEMENT_STATUS["CONFIRMED"], [])
                if confirmed:
                    confirmed_data = []
                    for r in confirmed:
                        d = r.to_dict()
                        d["处理口径说明"] = self._get_processing_criteria(r)
                        confirmed_data.append(d)
                    df_confirmed = pd.DataFrame(confirmed_data)
                    df_confirmed.to_excel(writer, sheet_name="二、已确认记录", index=False)
                
                pending = by_status.get(SUPPLEMENT_STATUS["PENDING"], [])
                if pending:
                    pending_data = []
                    for r in pending:
                        d = r.to_dict()
                        d["处理口径说明"] = self._get_processing_criteria(r)
                        d["待办事项"] = self._get_pending_action(r)
                        pending_data.append(d)
                    df_pending = pd.DataFrame(pending_data)
                    df_pending.to_excel(writer, sheet_name="三、待补录记录", index=False)
                
                modified = [r for r in self.manager.supplement_records.values() 
                           if r.补单状态 != SUPPLEMENT_STATUS["REVOKED"] and r.是否人工修改]
                if modified:
                    modified_data = []
                    for r in modified:
                        d = r.to_dict()
                        d["处理口径说明"] = self._get_processing_criteria(r)
                        if r.修改前内容:
                            d["修改前内容"] = str(r.修改前内容)
                        modified_data.append(d)
                    df_modified = pd.DataFrame(modified_data)
                    df_modified.to_excel(writer, sheet_name="四、人工修改记录", index=False)
                
                if self.manager.operation_log:
                    pd.DataFrame(self.manager.operation_log).to_excel(
                        writer, sheet_name="五、操作日志", index=False
                    )
                
                self._generate_sheet_description(writer)
                
                self._generate_review_checklist(writer)
            
        except Exception as e:
            raise ExportError(output_path.name, str(e))
        
        return str(output_path)
    
    def _get_pending_action(self, record: SupplementRecord) -> str:
        if "金额不匹配" in record.处理口径:
            return "1. 核实原交易与退款金额差异原因；2. 根据实际情况调整补单金额；3. 确认后标记为已确认"
        elif "未匹配到对账单" in record.处理口径:
            return "1. 在对账单中查找原交易流水号；2. 如确实遗漏，补充导入对账单；3. 重新匹配后确认"
        elif "有退款记录无退款流水" in record.处理口径:
            return "1. 核实退款是否实际发生；2. 如已退款，补充导入退款流水；3. 核实到账后确认"
        else:
            return "请根据处理口径说明完成相应处理后确认"
    
    def _generate_sheet_description(self, writer: pd.ExcelWriter) -> None:
        descriptions = [
            {"工作表名称": "一、汇总概览", "说明": "本次对账的整体统计数据，包括总记录数、总金额、各状态分布"},
            {"工作表名称": "二、已确认记录", "说明": "系统自动匹配或人工确认无误的补单记录，可直接入账"},
            {"工作表名称": "三、待补录记录", "说明": "需要人工核实处理的记录，请按「待办事项」列的指引完成处理"},
            {"工作表名称": "四、人工修改记录", "说明": "经过人工修改过的记录，保留修改痕迹便于审计"},
            {"工作表名称": "五、操作日志", "说明": "所有操作的时间、人员、内容记录，用于追溯和审计"}
        ]
        pd.DataFrame(descriptions).to_excel(writer, sheet_name="六、工作表说明", index=False)
    
    def _generate_review_checklist(self, writer: pd.ExcelWriter) -> None:
        checklist = [
            {"步骤": "1", "复核内容": "核对对账单导入总数与银行/平台提供的原始文件数量是否一致", "完成标记": "□"},
            {"步骤": "2", "复核内容": "核对退款流水导入总数与银行/平台退款明细数量是否一致", "完成标记": "□"},
            {"步骤": "3", "复核内容": "检查「已确认记录」中是否存在金额异常的情况（单笔金额过大/过小）", "完成标记": "□"},
            {"步骤": "4", "复核内容": "检查「人工修改记录」的修改原因是否充分、修改后金额是否合理", "完成标记": "□"},
            {"步骤": "5", "复核内容": "检查「待补录记录」是否均已安排人员跟进处理", "完成标记": "□"},
            {"步骤": "6", "复核内容": "确认无重复补单（同一原交易流水号仅对应一条有效补单记录）", "完成标记": "□"},
            {"步骤": "7", "复核内容": "确认所有「已确认记录」的处理口径均清晰明确", "完成标记": "□"},
            {"步骤": "8", "复核内容": "核对已确认总金额与财务系统中退款挂账金额是否一致", "完成标记": "□"},
            {"步骤": "9", "复核内容": "操作日志是否完整，关键操作（修改、撤回）均有记录", "完成标记": "□"},
            {"步骤": "10", "复核内容": "本次对账期间内的所有交易是否均已覆盖，无遗漏", "完成标记": "□"}
        ]
        pd.DataFrame(checklist).to_excel(writer, sheet_name="七、复核清单", index=False)
    
    def print_summary(self) -> None:
        from rich.console import Console
        from rich.table import Table
        from rich.panel import Panel
        from rich.text import Text
        
        console = Console()
        summary = self.generate_summary()
        
        title = Text("📊 跨平台退款补单对账说明", style="bold blue", justify="center")
        console.print(Panel(title, border_style="blue"))
        
        console.print(f"\n生成时间：{summary['生成时间']}")
        console.print(f"统计周期：{summary['统计周期']}\n")
        
        overall = summary["总体情况"]
        table = Table(title="一、总体情况", show_header=True, header_style="bold cyan")
        table.add_column("项目", style="cyan")
        table.add_column("数值", justify="right")
        table.add_row("总记录数（不含已撤回）", str(overall["总记录数"]))
        table.add_row("总补单金额", str(overall["总金额"]))
        table.add_row("已撤回记录数", str(overall["已撤回记录数"]))
        console.print(table)
        
        confirmed = summary["已确认记录"]
        table2 = Table(title=f"二、已确认记录 ({confirmed['数量']}条, {confirmed['占比']})", 
                      show_header=True, header_style="bold green")
        table2.add_column("项目", style="green")
        table2.add_column("数值", justify="right")
        table2.add_row("数量", str(confirmed["数量"]))
        table2.add_row("金额", str(confirmed["金额"]))
        for platform, amount in confirmed["按平台统计"].items():
            table2.add_row(f"  - {platform}", amount)
        console.print(table2)
        
        pending = summary["待补录记录"]
        table3 = Table(title=f"三、待补录记录 ({pending['数量']}条, {pending['占比']})", 
                      show_header=True, header_style="bold yellow")
        table3.add_column("项目", style="yellow")
        table3.add_column("数值", justify="right")
        table3.add_row("数量", str(pending["数量"]))
        table3.add_row("金额", str(pending["金额"]))
        for platform, amount in pending["按平台统计"].items():
            table3.add_row(f"  - {platform}", amount)
        console.print(table3)
        
        modified = summary["人工修改记录"]
        table4 = Table(title=f"四、人工修改记录 ({modified['数量']}条, {modified['占比']})", 
                      show_header=True, header_style="bold magenta")
        table4.add_column("项目", style="magenta")
        table4.add_column("数值", justify="right")
        table4.add_row("数量", str(modified["数量"]))
        table4.add_row("金额", str(modified["金额"]))
        console.print(table4)
        
        if int(pending["数量"]) > 0:
            show_warning(
                f"还有 {pending['数量']} 条记录待处理，金额 {pending['金额']}。",
                "请及时安排人员处理「待补录记录」，避免影响结账进度。"
            )
    
    def generate_hanging_account_report(self, output_path: Optional[str] = None) -> str:
        pending = [r for r in self.manager.supplement_records.values() 
                  if r.补单状态 == SUPPLEMENT_STATUS["PENDING"]]
        
        if not pending:
            show_warning("当前没有待处理的退款挂账记录，所有补单均已确认。")
            return ""
        
        if output_path is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = OUTPUT_DIR / f"退款挂账明细_{timestamp}.xlsx"
        
        output_path = Path(output_path)
        
        try:
            data = []
            for r in pending:
                d = r.to_dict()
                d["挂账原因"] = self._get_processing_criteria(r)
                d["建议处理时限"] = self._get_suggested_deadline(r)
                d["责任人"] = "待分配"
                data.append(d)
            
            df = pd.DataFrame(data)
            
            with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
                df.to_excel(writer, sheet_name="退款挂账明细", index=False)
                
                by_reason = defaultdict(lambda: {"数量": 0, "金额": 0.0})
                for r in pending:
                    reason = r.处理口径.split("，")[0] if "，" in r.处理口径 else r.处理口径
                    by_reason[reason]["数量"] += 1
                    by_reason[reason]["金额"] += r.补单金额
                
                summary_data = []
                for reason, info in by_reason.items():
                    summary_data.append({
                        "挂账原因分类": reason,
                        "数量": info["数量"],
                        "金额": self._format_amount(info["金额"])
                    })
                pd.DataFrame(summary_data).to_excel(writer, sheet_name="挂账原因汇总", index=False)
                
        except Exception as e:
            raise ExportError(output_path.name, str(e))
        
        return str(output_path)
    
    def _get_suggested_deadline(self, record: SupplementRecord) -> str:
        from datetime import timedelta
        if "金额不匹配" in record.处理口径:
            return (record.创建时间 + timedelta(days=3)).strftime("%Y-%m-%d")
        elif "未匹配到对账单" in record.处理口径:
            return (record.创建时间 + timedelta(days=5)).strftime("%Y-%m-%d")
        elif "有退款记录无退款流水" in record.处理口径:
            return (record.创建时间 + timedelta(days=7)).strftime("%Y-%m-%d")
        else:
            return (record.创建时间 + timedelta(days=3)).strftime("%Y-%m-%d")
