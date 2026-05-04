import csv
import json
from decimal import Decimal
from datetime import datetime
from typing import List, Optional, Dict, Any
from pathlib import Path

from .models import (
    PaymentRecord,
    EditRecord,
    RulesConfig,
    ValidationIssue,
)


class FileReader:
    def __init__(self, input_dir: Path):
        self.input_dir = input_dir
        self.issues: List[ValidationIssue] = []

    def _read_file_content(self, filename: str) -> Optional[str]:
        filepath = self.input_dir / filename
        if not filepath.exists():
            self.issues.append(ValidationIssue(
                severity="warning",
                category="file_missing",
                message=f"文件不存在: {filename}",
                suggestion=f"请确认 {filename} 是否放在输入目录 {self.input_dir}",
            ))
            return None
        try:
            return filepath.read_text(encoding='utf-8')
        except UnicodeDecodeError:
            try:
                return filepath.read_text(encoding='gbk')
            except:
                self.issues.append(ValidationIssue(
                    severity="error",
                    category="file_encoding",
                    message=f"无法读取文件编码: {filename}",
                    suggestion="请将文件另存为 UTF-8 或 GBK 编码",
                ))
                return None

    def read_chat_file(self, filename: str = "chat.txt") -> Optional[str]:
        return self._read_file_content(filename)

    def read_payments_csv(self, filename: str = "payments.csv") -> List[PaymentRecord]:
        filepath = self.input_dir / filename
        if not filepath.exists():
            self.issues.append(ValidationIssue(
                severity="info",
                category="file_missing",
                message=f"付款文件不存在: {filename}，将按未付款处理",
            ))
            return []
        
        records = []
        
        try:
            content = filepath.read_text(encoding='utf-8')
        except UnicodeDecodeError:
            content = filepath.read_text(encoding='gbk')
        
        lines = content.splitlines()
        if not lines:
            return records
        
        header_line = lines[0]
        headers = self._parse_csv_line(header_line)
        
        name_col = self._find_column(headers, ['付款人', '姓名', '名字', 'payer', 'name', '付款人姓名'])
        amount_col = self._find_column(headers, ['金额', '付款金额', '转账金额', 'amount', 'payment', 'money'])
        time_col = self._find_column(headers, ['时间', '付款时间', '转账时间', 'time', 'date', 'payment_time'])
        id_col = self._find_column(headers, ['交易号', '订单号', '流水号', 'transaction_id', 'id', '订单编号'])
        notes_col = self._find_column(headers, ['备注', '说明', '附言', 'notes', 'comment', 'remark'])
        
        for line_num, line in enumerate(lines[1:], 2):
            if not line.strip():
                continue
            
            values = self._parse_csv_line(line)
            
            record = PaymentRecord(
                payer_name="",
                amount=Decimal('0'),
                line_number=line_num,
                source_file=filename,
            )
            
            if name_col is not None and name_col < len(values):
                record.payer_name = values[name_col].strip()
            else:
                self.issues.append(ValidationIssue(
                    severity="warning",
                    category="payment_format",
                    message=f"第 {line_num} 行无法识别付款人姓名",
                    line_number=line_num,
                ))
                if len(values) >= 1:
                    record.payer_name = values[0].strip()
            
            if amount_col is not None and amount_col < len(values):
                amount_str = values[amount_col].strip()
                amount_str = amount_str.replace('￥', '').replace('¥', '').replace(',', '').strip()
                try:
                    record.amount = Decimal(amount_str)
                except:
                    self.issues.append(ValidationIssue(
                        severity="error",
                        category="payment_amount",
                        message=f"第 {line_num} 行付款金额格式错误: {amount_str}",
                        line_number=line_num,
                        suggestion="金额应为数字，可包含小数点，如 100 或 100.00",
                    ))
            else:
                if len(values) >= 2:
                    amount_str = values[1].strip()
                    amount_str = amount_str.replace('￥', '').replace('¥', '').replace(',', '').strip()
                    try:
                        record.amount = Decimal(amount_str)
                    except:
                        pass
            
            if time_col is not None and time_col < len(values):
                time_str = values[time_col].strip()
                record.payment_time = self._parse_datetime(time_str)
            
            if id_col is not None and id_col < len(values):
                record.transaction_id = values[id_col].strip()
            
            if notes_col is not None and notes_col < len(values):
                record.notes = values[notes_col].strip()
            
            if record.payer_name and record.amount > 0:
                records.append(record)
            else:
                self.issues.append(ValidationIssue(
                    severity="warning",
                    category="payment_skipped",
                    message=f"第 {line_num} 行付款记录被跳过，缺少姓名或有效金额",
                    line_number=line_num,
                ))
        
        return records

    def read_edits_csv(self, filename: str = "optional_edits.csv") -> List[EditRecord]:
        filepath = self.input_dir / filename
        if not filepath.exists():
            return []
        
        records = []
        
        try:
            content = filepath.read_text(encoding='utf-8')
        except UnicodeDecodeError:
            content = filepath.read_text(encoding='gbk')
        
        lines = content.splitlines()
        if not lines:
            return records
        
        header_line = lines[0]
        headers = self._parse_csv_line(header_line)
        
        original_name_col = self._find_column(headers, ['原姓名', '原昵称', '要修改的姓名', 'original_name', '姓名', 'name'])
        new_name_col = self._find_column(headers, ['新姓名', '修改为', 'new_name', '正确姓名'])
        new_phone_col = self._find_column(headers, ['新手机号', '正确电话', 'phone', '手机号', '电话'])
        new_people_col = self._find_column(headers, ['总人数', '人数', 'total_people', '人数修改', '报名人数'])
        new_child_col = self._find_column(headers, ['儿童数', '小孩数', 'child_count', '孩子数'])
        new_time_col = self._find_column(headers, ['时段', '时间', 'time_slot', '参加时段', '可参加时段'])
        notes_col = self._find_column(headers, ['备注', '说明', 'notes', '修改原因'])
        
        for line_num, line in enumerate(lines[1:], 2):
            if not line.strip():
                continue
            
            values = self._parse_csv_line(line)
            
            record = EditRecord(
                original_name="",
                line_number=line_num,
                source_file=filename,
            )
            
            if original_name_col is not None and original_name_col < len(values):
                record.original_name = values[original_name_col].strip()
            else:
                if len(values) >= 1:
                    record.original_name = values[0].strip()
            
            if not record.original_name:
                self.issues.append(ValidationIssue(
                    severity="warning",
                    category="edit_format",
                    message=f"第 {line_num} 行缺少要修改的原姓名，跳过",
                    line_number=line_num,
                ))
                continue
            
            if new_name_col is not None and new_name_col < len(values):
                val = values[new_name_col].strip()
                if val:
                    record.new_name = val
            
            if new_phone_col is not None and new_phone_col < len(values):
                val = values[new_phone_col].strip()
                if val:
                    val = ''.join(c for c in val if c.isdigit())
                    if len(val) == 11:
                        record.new_phone = val
                    else:
                        self.issues.append(ValidationIssue(
                            severity="warning",
                            category="edit_phone",
                            message=f"第 {line_num} 行手机号格式异常: {val}",
                            line_number=line_num,
                            suggestion="手机号应为11位数字",
                        ))
            
            if new_people_col is not None and new_people_col < len(values):
                val = values[new_people_col].strip()
                if val and val.isdigit():
                    record.new_total_people = int(val)
            
            if new_child_col is not None and new_child_col < len(values):
                val = values[new_child_col].strip()
                if val and val.isdigit():
                    record.new_child_count = int(val)
            
            if new_time_col is not None and new_time_col < len(values):
                val = values[new_time_col].strip()
                if val:
                    slots = []
                    if '周六上午' in val:
                        slots.append('周六上午')
                    if '周六下午' in val:
                        slots.append('周六下午')
                    if '周日上午' in val:
                        slots.append('周日上午')
                    if '周日下午' in val:
                        slots.append('周日下午')
                    if not slots:
                        if '周六' in val:
                            slots.append('周六上午')
                        if '周日' in val:
                            slots.append('周日上午')
                    if slots:
                        record.new_time_slots = slots
            
            if notes_col is not None and notes_col < len(values):
                val = values[notes_col].strip()
                if val:
                    record.notes = val
            
            records.append(record)
        
        return records

    def read_rules_json(self, filename: str = "rules.json") -> RulesConfig:
        filepath = self.input_dir / filename
        
        default_rules = RulesConfig(
            total_max_capacity=100,
            price_per_adult=Decimal('100'),
            price_per_child=Decimal('50'),
            time_slots=[],
        )
        
        if not filepath.exists():
            self.issues.append(ValidationIssue(
                severity="warning",
                category="rules_missing",
                message=f"规则配置文件不存在: {filename}，将使用默认规则",
                suggestion="建议创建 rules.json 配置活动规则",
            ))
            return default_rules
        
        try:
            content = filepath.read_text(encoding='utf-8')
            data = json.loads(content)
            return RulesConfig.from_dict(data)
        except json.JSONDecodeError as e:
            self.issues.append(ValidationIssue(
                severity="error",
                category="rules_format",
                message=f"rules.json 格式错误: {e}",
                suggestion="请检查 JSON 格式是否正确",
            ))
            return default_rules
        except Exception as e:
            self.issues.append(ValidationIssue(
                severity="error",
                category="rules_error",
                message=f"读取规则配置失败: {e}",
            ))
            return default_rules

    def _parse_csv_line(self, line: str) -> List[str]:
        if ',' not in line and '\t' in line:
            return [v.strip() for v in line.split('\t')]
        return [v.strip() for v in line.split(',')]

    def _find_column(self, headers: List[str], possible_names: List[str]) -> Optional[int]:
        headers_lower = [h.strip().lower() for h in headers]
        for name in possible_names:
            name_lower = name.lower()
            for i, h in enumerate(headers_lower):
                if name_lower in h or h in name_lower:
                    return i
        return None

    def _parse_datetime(self, time_str: str) -> Optional[datetime]:
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
            "%m/%d/%Y %H:%M:%S",
            "%m/%d/%Y %H:%M",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(time_str, fmt)
            except:
                continue
        
        return None
