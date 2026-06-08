import re
import uuid
from datetime import datetime, date
from typing import List, Optional, Tuple, Dict
import pandas as pd
from .models import (
    CounterFlow,
    MarginRecord,
    ImportResult,
    RecordSource,
    SettlementType,
    ApprovalStatus
)


class DataImporter:
    def __init__(self):
        self.imported_flow_ids = set()
        self.imported_record_ids = set()
        self.email_remark_patterns = [
            r'流水号[：:]\s*(\S+)',
            r'尾号[：:]\s*(\d+)',
            r'金额[：:]\s*([\d,.]+)',
            r'保证金[：:]\s*(\S+)',
        ]

    def import_counter_flows(
        self,
        file_path: str,
        source_type: RecordSource = RecordSource.NORMAL,
        sheet_name: Optional[str] = None
    ) -> Tuple[List[CounterFlow], List[str]]:
        flows = []
        warnings = []
        
        try:
            if file_path.endswith('.xlsx') or file_path.endswith('.xls'):
                df = pd.read_excel(file_path, sheet_name=sheet_name)
            elif file_path.endswith('.csv'):
                df = pd.read_csv(file_path)
            else:
                raise ValueError(f"不支持的文件格式: {file_path}")
            
            df = df.fillna('')
            
            for idx, row in df.iterrows():
                try:
                    flow = self._parse_counter_flow_row(row, source_type, idx)
                    if flow.flow_id in self.imported_flow_ids:
                        warnings.append(f"第{idx+2}行: 流水号 {flow.flow_id} 已存在，将跳过")
                        continue
                    flows.append(flow)
                    self.imported_flow_ids.add(flow.flow_id)
                except Exception as e:
                    warnings.append(f"第{idx+2}行解析失败: {str(e)}")
                    
        except Exception as e:
            raise RuntimeError(f"读取文件失败: {str(e)}")
        
        return flows, warnings

    def _parse_counter_flow_row(
        self,
        row: pd.Series,
        source_type: RecordSource,
        row_idx: int
    ) -> CounterFlow:
        flow_id = self._get_value(row, ['流水号', 'flow_id', 'FlowID'])
        if not flow_id:
            raise ValueError("缺少流水号")
        
        flow_tail = self._get_value(row, ['流水尾号', '尾号', 'flow_tail'])
        if not flow_tail:
            flow_tail = str(flow_id)[-4:] if len(str(flow_id)) >= 4 else str(flow_id)
        
        trade_date_str = self._get_value(row, ['交易日期', '日期', 'trade_date', 'TradeDate'])
        if not trade_date_str:
            raise ValueError("缺少交易日期")
        trade_date = self._parse_date(trade_date_str)
        
        amount_str = self._get_value(row, ['金额', 'amount', 'Amount'])
        if not amount_str:
            raise ValueError("缺少金额")
        amount = self._parse_amount(amount_str)
        
        counterparty = self._get_value(row, ['对手方', '交易对手', 'counterparty', 'Counterparty']) or '未知'
        
        settlement_str = self._get_value(row, ['到账类型', '结算类型', 'settlement_type'])
        settlement_type = SettlementType.T2 if 'T+2' in str(settlement_str) else SettlementType.T1
        
        remark = self._get_value(row, ['备注', 'remark', 'Remark']) or ''
        
        is_manual = source_type == RecordSource.MANUAL
        
        return CounterFlow(
            flow_id=str(flow_id).strip(),
            flow_tail=str(flow_tail).strip(),
            trade_date=trade_date,
            amount=amount,
            currency='CNY',
            counterparty=str(counterparty).strip(),
            settlement_type=settlement_type,
            remark=remark,
            source=source_type,
            is_manual_modified=is_manual,
            modified_by='林姐' if is_manual else None,
            modified_time=datetime.now() if is_manual else None
        )

    def import_margin_records(
        self,
        file_path: str,
        source_type: RecordSource = RecordSource.NORMAL,
        sheet_name: Optional[str] = None,
        email_remark: str = '',
        email_attachment: str = ''
    ) -> ImportResult:
        result = ImportResult(source_type=source_type)
        
        try:
            if file_path.endswith('.xlsx') or file_path.endswith('.xls'):
                df = pd.read_excel(file_path, sheet_name=sheet_name)
            elif file_path.endswith('.csv'):
                df = pd.read_csv(file_path)
            else:
                raise ValueError(f"不支持的文件格式: {file_path}")
            
            df = df.fillna('')
            
            for idx, row in df.iterrows():
                try:
                    record = self._parse_margin_record_row(
                        row, source_type, idx,
                        email_remark, email_attachment
                    )
                    if record.record_id in self.imported_record_ids:
                        result.warnings.append(f"第{idx+2}行: 记录已存在，跳过")
                        continue
                    result.imported_records.append(record)
                    self.imported_record_ids.add(record.record_id)
                    result.success_count += 1
                except Exception as e:
                    result.warnings.append(f"第{idx+2}行解析失败: {str(e)}")
                    result.failed_count += 1
                    
        except Exception as e:
            result.errors.append(f"读取文件失败: {str(e)}")
        
        return result

    def _parse_margin_record_row(
        self,
        row: pd.Series,
        source_type: RecordSource,
        row_idx: int,
        email_remark: str = '',
        email_attachment: str = ''
    ) -> MarginRecord:
        trade_date_str = self._get_value(row, ['交易日期', '日期', 'trade_date'])
        if not trade_date_str:
            raise ValueError("缺少交易日期")
        trade_date = self._parse_date(trade_date_str)
        
        margin_type = self._get_value(row, ['保证金类型', '类型', 'margin_type']) or '大宗保证金'
        
        amount_str = self._get_value(row, ['金额', 'amount', 'Amount'])
        if not amount_str:
            raise ValueError("缺少金额")
        amount = self._parse_amount(amount_str)
        
        direction = self._get_value(row, ['方向', '缴退', 'direction']) or '缴'
        
        linked_flow_id = self._get_value(row, ['关联流水号', '流水号', 'flow_id'])
        
        row_email_remark = self._get_value(row, ['邮件备注', '客户经理备注', 'email_remark']) or ''
        combined_remark = self._merge_email_remarks(email_remark, row_email_remark)
        
        row_attachment = self._get_value(row, ['附件信息', 'attachment']) or ''
        combined_attachment = self._merge_email_remarks(email_attachment, row_attachment)
        
        record_id = self._generate_record_id(trade_date, amount, direction)
        
        return MarginRecord(
            record_id=record_id,
            trade_date=trade_date,
            margin_type=str(margin_type).strip(),
            amount=amount,
            direction=str(direction).strip(),
            linked_flow_id=str(linked_flow_id).strip() if linked_flow_id else None,
            email_remark=combined_remark,
            email_attachment_info=combined_attachment,
            source=source_type,
            approval_status=ApprovalStatus.PENDING
        )

    def _merge_email_remarks(self, global_remark: str, row_remark: str) -> str:
        remarks = []
        if global_remark and global_remark.strip():
            remarks.append(global_remark.strip())
        if row_remark and row_remark.strip():
            remarks.append(row_remark.strip())
        return '\n'.join(remarks)

    def import_email_remark_only(
        self,
        trade_date: date,
        linked_flow_id: str,
        email_remark: str,
        email_attachment: str = ''
    ) -> MarginRecord:
        record_id = self._generate_record_id(trade_date, 0, '补录')
        return MarginRecord(
            record_id=record_id,
            trade_date=trade_date,
            margin_type='邮件补录',
            amount=0,
            direction='补录',
            linked_flow_id=linked_flow_id,
            email_remark=email_remark,
            email_attachment_info=email_attachment,
            source=RecordSource.SUPPLEMENT,
            approval_status=ApprovalStatus.PENDING
        )

    def _get_value(self, row: pd.Series, possible_names: List[str]) -> Optional[str]:
        for name in possible_names:
            if name in row.index and pd.notna(row[name]) and str(row[name]).strip():
                return str(row[name]).strip()
        return None

    def _parse_date(self, date_str: str) -> date:
        date_str = str(date_str).strip()
        formats = ['%Y-%m-%d', '%Y/%m/%d', '%m/%d/%Y', '%d-%m-%Y', '%Y%m%d']
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue
        raise ValueError(f"无法解析日期: {date_str}")

    def _parse_amount(self, amount_str: str) -> float:
        if isinstance(amount_str, (int, float)):
            return float(amount_str)
        cleaned = str(amount_str).replace(',', '').replace('，', '').strip()
        multiplier = 1
        if '万' in cleaned:
            multiplier = 10000
            cleaned = cleaned.replace('万', '')
        match = re.search(r'([-+]?\d+\.?\d*)', cleaned)
        if match:
            return float(match.group(1)) * multiplier
        raise ValueError(f"无法解析金额: {amount_str}")

    def _generate_record_id(self, trade_date: date, amount: float, direction: str) -> str:
        timestamp = datetime.now().strftime('%H%M%S')
        date_str = trade_date.strftime('%Y%m%d')
        amount_str = str(int(abs(amount)))
        return f"MR{date_str}{timestamp}{amount_str[:4]}"

    def parse_tail_from_email(self, email_remark: str) -> List[str]:
        tails = []
        patterns = [
            r'尾号[：:\s]*(\d{3,8})',
            r'流水.*?(\d{3,8})',
            r'编号[：:\s]*(\d{3,8})'
        ]
        for pattern in patterns:
            matches = re.findall(pattern, email_remark)
            tails.extend(matches)
        return list(set(tails))

    def parse_amount_from_email(self, email_remark: str) -> List[float]:
        amounts = []
        patterns = [
            r'金额[：:\s]*([\d,.]+)\s*万',
            r'金额[：:\s]*([\d,.]+)',
        ]
        for pattern in patterns:
            matches = re.findall(pattern, email_remark)
            for match in matches:
                try:
                    val = self._parse_amount(match)
                    if '万' in pattern:
                        val *= 10000
                    amounts.append(val)
                except ValueError:
                    continue
            if amounts:
                break
        return amounts

    def reset_import_state(self):
        self.imported_flow_ids.clear()
        self.imported_record_ids.clear()
