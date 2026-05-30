import csv
import json
from typing import List, Tuple
from pathlib import Path

from models import (
    TradeRecord, CustomerGroup, CommissionRule, CommissionTier,
    RefundResult, ProblemRecord, SourceRef, RecordStatus, ErrorType
)


class DataIO:
    @staticmethod
    def read_trades(file_path: str) -> Tuple[List[TradeRecord], List[ProblemRecord]]:
        trades = []
        problems = []
        path = Path(file_path)
        with open(path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for line_num, row in enumerate(reader, start=2):
                try:
                    source = SourceRef(
                        file_name=path.name,
                        line_number=line_num,
                        raw_content=json.dumps(row, ensure_ascii=False)
                    )
                    trade = TradeRecord(
                        trade_id=row.get('trade_id', '').strip(),
                        trade_date=row.get('trade_date', '').strip(),
                        customer_id=row.get('customer_id', '').strip(),
                        product_type=row.get('product_type', '').strip(),
                        trade_amount=float(row.get('trade_amount', 0) or 0),
                        commission_fee=float(row.get('commission_fee', 0) or 0),
                        source=source
                    )
                    trades.append(trade)
                except Exception as e:
                    problem = ProblemRecord(
                        record_id=f"import_error_{line_num}",
                        status=RecordStatus.ERROR,
                        error_type=ErrorType.INVALID_AMOUNT,
                        description=f"导入失败: {str(e)}",
                        sources=[SourceRef(
                            file_name=path.name,
                            line_number=line_num,
                            raw_content=json.dumps(row, ensure_ascii=False)
                        )],
                        related_ids=[],
                        raw_data=row,
                        rule_version=""
                    )
                    problems.append(problem)
        return trades, problems

    @staticmethod
    def read_customer_groups(file_path: str) -> Tuple[List[CustomerGroup], List[ProblemRecord]]:
        groups = []
        problems = []
        path = Path(file_path)
        with open(path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for line_num, row in enumerate(reader, start=2):
                try:
                    source = SourceRef(
                        file_name=path.name,
                        line_number=line_num,
                        raw_content=json.dumps(row, ensure_ascii=False)
                    )
                    group = CustomerGroup(
                        customer_id=row.get('customer_id', '').strip(),
                        customer_name=row.get('customer_name', '').strip(),
                        group_id=row.get('group_id', '').strip(),
                        valid_from=row.get('valid_from', '').strip(),
                        valid_to=row.get('valid_to', '').strip() or None,
                        source=source
                    )
                    groups.append(group)
                except Exception as e:
                    problem = ProblemRecord(
                        record_id=f"import_group_error_{line_num}",
                        status=RecordStatus.ERROR,
                        error_type=ErrorType.MISSING_GROUP,
                        description=f"分组导入失败: {str(e)}",
                        sources=[SourceRef(
                            file_name=path.name,
                            line_number=line_num,
                            raw_content=json.dumps(row, ensure_ascii=False)
                        )],
                        related_ids=[],
                        raw_data=row,
                        rule_version=""
                    )
                    problems.append(problem)
        return groups, problems

    @staticmethod
    def read_commission_rules(file_path: str) -> Tuple[List[CommissionRule], List[ProblemRecord]]:
        rules = []
        problems = []
        path = Path(file_path)
        with open(path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for line_num, row in enumerate(reader, start=2):
                try:
                    source = SourceRef(
                        file_name=path.name,
                        line_number=line_num,
                        raw_content=json.dumps(row, ensure_ascii=False)
                    )
                    tiers_str = row.get('tiers', '[]').strip()
                    tiers_data = json.loads(tiers_str) if tiers_str else []
                    tiers = [
                        CommissionTier(
                            min_amount=float(t.get('min_amount', 0)),
                            max_amount=float(t.get('max_amount')) if t.get('max_amount') not in (None, '') else None,
                            refund_rate=float(t.get('refund_rate', 0))
                        )
                        for t in tiers_data
                    ]
                    rule = CommissionRule(
                        rule_id=row.get('rule_id', '').strip(),
                        rule_version=row.get('rule_version', '').strip(),
                        group_id=row.get('group_id', '').strip(),
                        product_type=row.get('product_type', '').strip(),
                        effective_date=row.get('effective_date', '').strip(),
                        tiers=tiers,
                        source=source
                    )
                    rules.append(rule)
                except Exception as e:
                    problem = ProblemRecord(
                        record_id=f"import_rule_error_{line_num}",
                        status=RecordStatus.ERROR,
                        error_type=ErrorType.MISSING_RULE,
                        description=f"规则导入失败: {str(e)}",
                        sources=[SourceRef(
                            file_name=path.name,
                            line_number=line_num,
                            raw_content=json.dumps(row, ensure_ascii=False)
                        )],
                        related_ids=[],
                        raw_data=row,
                        rule_version=""
                    )
                    problems.append(problem)
        return rules, problems

    @staticmethod
    def export_refund_results(results: List[RefundResult], file_path: str):
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                'refund_id', 'trade_id', 'customer_id', 'customer_name', 'group_id',
                'product_type', 'trade_amount', 'refund_amount', 'refund_rate',
                'rule_id', 'rule_version', 'refund_date',
                'trade_source_file', 'trade_source_line',
                'rule_source_file', 'rule_source_line'
            ])
            for r in results:
                writer.writerow([
                    r.refund_id, r.trade_id, r.customer_id, r.customer_name, r.group_id,
                    r.product_type, r.trade_amount, r.refund_amount, r.refund_rate,
                    r.rule_id, r.rule_version, r.refund_date,
                    r.trade_source.file_name if r.trade_source else '',
                    r.trade_source.line_number if r.trade_source else '',
                    r.rule_source.file_name if r.rule_source else '',
                    r.rule_source.line_number if r.rule_source else ''
                ])

    @staticmethod
    def export_problem_records(problems: List[ProblemRecord], file_path: str):
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                'record_id', 'status', 'error_type', 'description',
                'rule_version', 'related_ids', 'source_files', 'source_lines', 'raw_data'
            ])
            for p in problems:
                source_files = ';'.join([s.file_name for s in p.sources])
                source_lines = ';'.join([str(s.line_number) for s in p.sources])
                writer.writerow([
                    p.record_id, p.status.value, p.error_type.value, p.description,
                    p.rule_version, ','.join(p.related_ids),
                    source_files, source_lines,
                    json.dumps(p.raw_data, ensure_ascii=False)
                ])

    @staticmethod
    def export_review(results: List[RefundResult], problems: List[ProblemRecord], file_path: str):
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['=== 返还结果概览 ==='])
            writer.writerow(['总计', len(results)])
            writer.writerow(['返还总金额', sum(r.refund_amount for r in results)])
            writer.writerow([])
            writer.writerow(['=== 问题记录概览 ==='])
            writer.writerow(['问题总数', len(problems)])
            for et in ErrorType:
                count = len([p for p in problems if p.error_type == et])
                if count > 0:
                    writer.writerow([et.value, count])
            writer.writerow([])
            writer.writerow(['=== 问题明细 ==='])
            writer.writerow(['类型', '描述', '来源文件', '行号'])
            for p in problems:
                for s in p.sources:
                    writer.writerow([p.error_type.value, p.description, s.file_name, s.line_number])
