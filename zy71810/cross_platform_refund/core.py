import pandas as pd
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict

from config import (
    RECONCILIATION_COLS,
    REFUND_FLOW_COLS,
    SUPPLEMENT_STATUS,
    EXPORT_FORMATS,
    OUTPUT_DIR
)
from models import (
    ReconciliationRecord,
    RefundFlowRecord,
    SupplementRecord
)
from errors import (
    FileFormatError,
    MissingColumnError,
    DuplicateRecordError,
    RecordNotFoundError,
    AmountMismatchError,
    EmptyDataError,
    ExportError,
    FilterError,
    show_warning
)


class SupplementManager:
    def __init__(self):
        self.reconciliation_records: Dict[str, ReconciliationRecord] = {}
        self.refund_flow_records: Dict[str, RefundFlowRecord] = {}
        self.supplement_records: Dict[str, SupplementRecord] = {}
        self.operation_log: List[Dict[str, Any]] = []
    
    def _parse_datetime(self, value: Any) -> datetime:
        if isinstance(value, datetime):
            return value
        if pd.isna(value) or value == "":
            return datetime.now()
        try:
            return pd.to_datetime(value).to_pydatetime()
        except (ValueError, TypeError):
            return datetime.now()
    
    def _parse_float(self, value: Any) -> float:
        if pd.isna(value) or value == "":
            return 0.0
        try:
            return float(value)
        except (ValueError, TypeError):
            return 0.0
    
    def _read_file(self, filepath: Path, expected_cols: Dict[str, List[str]]) -> pd.DataFrame:
        if not filepath.exists():
            raise FileFormatError(filepath.name, "xlsx/csv", "文件不存在")
        
        suffix = filepath.suffix.lower()
        if suffix not in [".xlsx", ".xls", ".csv"]:
            raise FileFormatError(filepath.name, "Excel(.xlsx/.xls)或CSV(.csv)", suffix)
        
        try:
            if suffix in [".xlsx", ".xls"]:
                df = pd.read_excel(filepath, dtype=str)
            else:
                df = pd.read_csv(filepath, dtype=str)
        except Exception as e:
            raise FileFormatError(filepath.name, "xlsx/csv", str(e))
        
        df.columns = df.columns.str.strip()
        missing_cols = [col for col in expected_cols["required"] if col not in df.columns]
        if missing_cols:
            raise MissingColumnError(filepath.name, missing_cols, expected_cols["required"])
        
        return df
    
    def _log_operation(self, operation: str, details: Dict[str, Any]) -> None:
        self.operation_log.append({
            "操作时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "操作类型": operation,
            **details
        })
    
    def import_reconciliation(self, filepath: str) -> Tuple[int, int]:
        path = Path(filepath)
        df = self._read_file(path, RECONCILIATION_COLS)
        
        new_count = 0
        duplicate_count = 0
        duplicates = []
        
        for _, row in df.iterrows():
            trade_no = str(row["交易流水号"]).strip()
            if not trade_no or trade_no == "nan":
                continue
            
            if trade_no in self.reconciliation_records:
                duplicate_count += 1
                duplicates.append(trade_no)
                continue
            
            record = ReconciliationRecord(
                交易流水号=trade_no,
                交易时间=self._parse_datetime(row.get("交易时间")),
                交易金额=self._parse_float(row.get("交易金额")),
                支付平台=str(row.get("支付平台", "")).strip(),
                商户订单号=str(row.get("商户订单号", "")).strip(),
                用户账号=str(row.get("用户账号", "")).strip(),
                商品名称=str(row.get("商品名称", "")).strip(),
                备注=str(row.get("备注", "")).strip(),
                原始备注=str(row.get("备注", "")).strip(),
                来源文件=path.name
            )
            self.reconciliation_records[trade_no] = record
            new_count += 1
        
        if duplicates:
            show_warning(
                f"导入时发现 {duplicate_count} 条重复记录（交易流水号已存在），已自动跳过。",
                "如果需要更新这些记录，请先使用「撤回」功能撤回原有记录后再重新导入。"
            )
        
        self._log_operation("导入对账单", {
            "文件名": path.name,
            "新增记录数": new_count,
            "跳过重复数": duplicate_count
        })
        
        return new_count, duplicate_count
    
    def import_refund_flow(self, filepath: str) -> Tuple[int, int]:
        path = Path(filepath)
        df = self._read_file(path, REFUND_FLOW_COLS)
        
        new_count = 0
        duplicate_count = 0
        duplicates = []
        
        for _, row in df.iterrows():
            refund_no = str(row["退款流水号"]).strip()
            if not refund_no or refund_no == "nan":
                continue
            
            if refund_no in self.refund_flow_records:
                duplicate_count += 1
                duplicates.append(refund_no)
                continue
            
            record = RefundFlowRecord(
                退款流水号=refund_no,
                原交易流水号=str(row.get("原交易流水号", "")).strip(),
                退款金额=self._parse_float(row.get("退款金额")),
                退款时间=self._parse_datetime(row.get("退款时间")),
                退款状态=str(row.get("退款状态", "")).strip(),
                退款原因=str(row.get("退款原因", "")).strip(),
                操作人=str(row.get("操作人", "")).strip(),
                备注=str(row.get("备注", "")).strip(),
                来源文件=path.name
            )
            self.refund_flow_records[refund_no] = record
            new_count += 1
        
        if duplicates:
            show_warning(
                f"导入时发现 {duplicate_count} 条重复记录（退款流水号已存在），已自动跳过。",
                "如果需要更新这些记录，请先使用「撤回」功能撤回原有记录后再重新导入。"
            )
        
        self._log_operation("导入退款流水", {
            "文件名": path.name,
            "新增记录数": new_count,
            "跳过重复数": duplicate_count
        })
        
        return new_count, duplicate_count
    
    def match_supplements(self, strict_match: bool = True) -> Tuple[int, int, List[str]]:
        if not self.reconciliation_records:
            raise EmptyDataError("对账单")
        if not self.refund_flow_records:
            raise EmptyDataError("退款流水")
        
        matched_count = 0
        amount_mismatch_count = 0
        mismatches = []
        
        for refund_no, refund_record in self.refund_flow_records.items():
            trade_no = refund_record.原交易流水号
            reconciled = self.reconciliation_records.get(trade_no)
            
            existing = [s for s in self.supplement_records.values() 
                       if s.退款流水号 == refund_no and s.补单状态 != SUPPLEMENT_STATUS["REVOKED"]]
            if existing:
                continue
            
            supplement = SupplementRecord(
                补单编号="",
                原交易流水号=trade_no,
                退款流水号=refund_no,
                补单金额=refund_record.退款金额,
                补单说明=refund_record.退款原因 or reconciled.备注 if reconciled else "",
                关联对账单信息=reconciled.to_dict() if reconciled else None,
                关联退款流水信息=refund_record.to_dict()
            )
            
            if reconciled:
                if strict_match and abs(reconciled.交易金额 - refund_record.退款金额) > 0.01:
                    amount_mismatch_count += 1
                    mismatches.append(refund_no)
                    supplement.补单说明 = f"[金额不匹配] 原交易¥{reconciled.交易金额:.2f}，退款¥{refund_record.退款金额:.2f}。" + (supplement.补单说明 or "")
                    supplement.处理口径 = "金额不匹配待确认"
                else:
                    supplement.处理口径 = "系统自动匹配，金额一致"
                    matched_count += 1
            else:
                supplement.补单说明 = f"[未找到对账单] " + (supplement.补单说明 or "")
                supplement.处理口径 = "未匹配到对账单，待人工核实"
            
            self.supplement_records[supplement.补单编号] = supplement
        
        unmatched_trades = set(self.reconciliation_records.keys()) - \
                         set(r.原交易流水号 for r in self.refund_flow_records.values())
        
        for trade_no in unmatched_trades:
            existing = [s for s in self.supplement_records.values() 
                       if s.原交易流水号 == trade_no and s.补单状态 != SUPPLEMENT_STATUS["REVOKED"]]
            if existing:
                continue
            
            reconciled = self.reconciliation_records[trade_no]
            supplement = SupplementRecord(
                补单编号="",
                原交易流水号=trade_no,
                退款流水号=None,
                补单金额=reconciled.交易金额,
                补单说明=f"[有退款无流水] {reconciled.备注 or ''}",
                处理口径="有退款记录无退款流水，待人工补录",
                关联对账单信息=reconciled.to_dict()
            )
            self.supplement_records[supplement.补单编号] = supplement
        
        self._log_operation("自动匹配补单", {
            "匹配成功数": matched_count,
            "金额不匹配数": amount_mismatch_count,
            "待人工处理数": len(unmatched_trades) + amount_mismatch_count
        })
        
        return matched_count, amount_mismatch_count, mismatches
    
    def confirm_supplement(self, supplement_id: str, operator: Optional[str] = None) -> SupplementRecord:
        supplement = self.supplement_records.get(supplement_id)
        if not supplement:
            raise RecordNotFoundError(supplement_id, "确认")
        
        if supplement.补单状态 == SUPPLEMENT_STATUS["CONFIRMED"]:
            show_warning(f"补单「{supplement_id}」已经是「已确认」状态，无需重复确认。")
            return supplement
        
        supplement.confirm(operator)
        self._log_operation("确认补单", {
            "补单编号": supplement_id,
            "操作人": operator or "系统"
        })
        return supplement
    
    def batch_confirm(self, supplement_ids: List[str], operator: Optional[str] = None) -> Tuple[int, List[str]]:
        success_count = 0
        failed_ids = []
        
        for sid in supplement_ids:
            try:
                self.confirm_supplement(sid, operator)
                success_count += 1
            except Exception:
                failed_ids.append(sid)
        
        return success_count, failed_ids
    
    def modify_supplement(self, supplement_id: str, modifications: Dict[str, Any], 
                         operator: Optional[str] = None) -> SupplementRecord:
        supplement = self.supplement_records.get(supplement_id)
        if not supplement:
            raise RecordNotFoundError(supplement_id, "修改")
        
        if supplement.补单状态 == SUPPLEMENT_STATUS["REVOKED"]:
            from errors import InvalidStatusTransitionError
            raise InvalidStatusTransitionError(supplement_id, supplement.补单状态, "人工修改")
        
        allowed_fields = ["补单金额", "补单说明", "处理口径"]
        valid_mods = {k: v for k, v in modifications.items() if k in allowed_fields}
        
        if "补单金额" in valid_mods:
            valid_mods["补单金额"] = self._parse_float(valid_mods["补单金额"])
        
        supplement.mark_manual_modified(valid_mods, operator)
        self._log_operation("人工修改补单", {
            "补单编号": supplement_id,
            "修改字段": list(valid_mods.keys()),
            "操作人": operator or "系统"
        })
        return supplement
    
    def revoke_supplement(self, supplement_id: str, operator: Optional[str] = None) -> SupplementRecord:
        supplement = self.supplement_records.get(supplement_id)
        if not supplement:
            raise RecordNotFoundError(supplement_id, "撤回")
        
        supplement.revoke(operator)
        self._log_operation("撤回补单", {
            "补单编号": supplement_id,
            "操作人": operator or "系统"
        })
        return supplement
    
    def batch_revoke(self, supplement_ids: List[str], operator: Optional[str] = None) -> Tuple[int, List[str]]:
        success_count = 0
        failed_ids = []
        
        for sid in supplement_ids:
            try:
                self.revoke_supplement(sid, operator)
                success_count += 1
            except Exception:
                failed_ids.append(sid)
        
        return success_count, failed_ids
    
    def _parse_filter(self, filter_str: str) -> List[Tuple[str, str, str]]:
        conditions = []
        if not filter_str:
            return conditions
        
        for part in filter_str.split(","):
            part = part.strip()
            if "=" in part:
                col, val = part.split("=", 1)
                conditions.append((col.strip(), "=", val.strip()))
            elif "!=" in part:
                col, val = part.split("!=", 1)
                conditions.append((col.strip(), "!=", val.strip()))
            elif ">" in part:
                col, val = part.split(">", 1)
                conditions.append((col.strip(), ">", val.strip()))
            elif "<" in part:
                col, val = part.split("<", 1)
                conditions.append((col.strip(), "<", val.strip()))
            else:
                raise FilterError(filter_str, f"条件「{part}」格式不正确，缺少比较符（=、!=、>、<）")
        
        return conditions
    
    def filter_supplements(self, filter_str: str, 
                          include_revoked: bool = False) -> List[SupplementRecord]:
        conditions = self._parse_filter(filter_str)
        results = []
        
        for record in self.supplement_records.values():
            if not include_revoked and record.补单状态 == SUPPLEMENT_STATUS["REVOKED"]:
                continue
            
            record_dict = record.to_dict()
            match = True
            
            for col, op, val in conditions:
                cell_value = str(record_dict.get(col, "")).strip()
                val = val.strip()
                
                if op == "=":
                    if cell_value != val:
                        match = False
                        break
                elif op == "!=":
                    if cell_value == val:
                        match = False
                        break
                elif op == ">":
                    try:
                        if float(cell_value) <= float(val):
                            match = False
                            break
                    except ValueError:
                        if cell_value <= val:
                            match = False
                            break
                elif op == "<":
                    try:
                        if float(cell_value) >= float(val):
                            match = False
                            break
                    except ValueError:
                        if cell_value >= val:
                            match = False
                            break
            
            if match:
                results.append(record)
        
        return results
    
    def get_supplements_by_status(self) -> Dict[str, List[SupplementRecord]]:
        result = defaultdict(list)
        for record in self.supplement_records.values():
            if record.补单状态 != SUPPLEMENT_STATUS["REVOKED"]:
                result[record.补单状态].append(record)
        return dict(result)
    
    def get_supplements_dataframe(self, records: Optional[List[SupplementRecord]] = None,
                                 include_revoked: bool = False) -> pd.DataFrame:
        if records is None:
            records = list(self.supplement_records.values())
        
        if not include_revoked:
            records = [r for r in records if r.补单状态 != SUPPLEMENT_STATUS["REVOKED"]]
        
        if not records:
            return pd.DataFrame()
        
        data = [r.to_dict() for r in records]
        df = pd.DataFrame(data)
        
        preferred_order = [
            "补单编号", "补单状态", "原交易流水号", "退款流水号", "补单金额",
            "对账单_交易时间", "对账单_交易金额", "对账单_支付平台", "对账单_商户订单号",
            "退款_退款时间", "退款_退款状态", "退款_退款原因",
            "处理口径", "补单说明", "是否人工修改",
            "修改人", "修改时间", "创建时间", "确认时间", "撤回时间"
        ]
        
        existing_cols = [col for col in preferred_order if col in df.columns]
        other_cols = [col for col in df.columns if col not in preferred_order]
        df = df[existing_cols + other_cols]
        
        return df
    
    def export_supplements(self, output_path: str, 
                          records: Optional[List[SupplementRecord]] = None,
                          include_revoked: bool = False,
                          format: str = "xlsx") -> str:
        if format not in EXPORT_FORMATS:
            raise ExportError(output_path, f"不支持的导出格式：{format}，仅支持 {EXPORT_FORMATS}")
        
        if not self.supplement_records:
            raise EmptyDataError("补单")
        
        df = self.get_supplements_dataframe(records, include_revoked)
        if df.empty:
            raise ExportError(output_path, "筛选后没有可导出的数据")
        
        path = Path(output_path)
        if path.suffix.lower() == ".csv" and format == "xlsx":
            path = path.with_suffix(".xlsx")
        
        try:
            if format == "xlsx":
                with pd.ExcelWriter(path, engine="openpyxl") as writer:
                    df.to_excel(writer, sheet_name="补单记录", index=False)
                    
                    status_summary = df["补单状态"].value_counts().reset_index()
                    status_summary.columns = ["补单状态", "数量"]
                    status_summary.to_excel(writer, sheet_name="汇总统计", index=False)
                    
                    pd.DataFrame(self.operation_log).to_excel(writer, sheet_name="操作日志", index=False)
            else:
                df.to_csv(path, index=False, encoding="utf-8-sig")
        except Exception as e:
            raise ExportError(path.name, str(e))
        
        self._log_operation("导出补单", {
            "文件名": path.name,
            "导出记录数": len(df),
            "导出格式": format
        })
        
        return str(path)
    
    def get_statistics(self) -> Dict[str, Any]:
        total = len(self.supplement_records)
        by_status = defaultdict(int)
        by_platform = defaultdict(int)
        total_amount = 0.0
        manual_modified_count = 0
        
        for record in self.supplement_records.values():
            if record.补单状态 != SUPPLEMENT_STATUS["REVOKED"]:
                by_status[record.补单状态] += 1
                total_amount += record.补单金额
                if record.是否人工修改:
                    manual_modified_count += 1
                if record.关联对账单信息:
                    platform = record.关联对账单信息.get("支付平台", "未知平台")
                    by_platform[platform] += 1
        
        return {
            "总记录数（不含已撤回）": sum(by_status.values()),
            "总补单金额": f"¥{total_amount:.2f}",
            "按状态统计": dict(by_status),
            "按支付平台统计": dict(by_platform),
            "人工修改记录数": manual_modified_count,
            "已撤回记录数": total - sum(by_status.values()),
            "对账单记录数": len(self.reconciliation_records),
            "退款流水记录数": len(self.refund_flow_records)
        }
