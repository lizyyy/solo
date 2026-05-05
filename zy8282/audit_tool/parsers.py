"""数据解析模块"""

import csv
import json
import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml

from .models import (
    LaborCost,
    MetricRule,
    Order,
    Refund,
    ReportMetric,
)


class CSVParser:
    """CSV 文件解析器"""
    
    @staticmethod
    def parse_orders(file_path: Path) -> List[Order]:
        """解析订单 CSV 文件"""
        orders = []
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                order = Order(
                    order_id=row.get('order_id', row.get('订单ID', '')),
                    store_id=row.get('store_id', row.get('门店ID', '')),
                    store_name=row.get('store_name', row.get('门店名称', '')),
                    order_date=CSVParser._parse_date(row.get('order_date', row.get('订单日期', ''))),
                    order_time=row.get('order_time', row.get('订单时间', '00:00:00')),
                    total_amount=CSVParser._parse_decimal(row.get('total_amount', row.get('订单金额', '0'))),
                    items_count=int(row.get('items_count', row.get('商品数量', '0')) or 0),
                    customer_id=row.get('customer_id', row.get('客户ID')),
                    payment_method=row.get('payment_method', row.get('支付方式')),
                )
                orders.append(order)
        return orders
    
    @staticmethod
    def parse_refunds(file_path: Path) -> List[Refund]:
        """解析退款 CSV 文件"""
        refunds = []
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                refund = Refund(
                    refund_id=row.get('refund_id', row.get('退款ID', '')),
                    order_id=row.get('order_id', row.get('订单ID', '')),
                    store_id=row.get('store_id', row.get('门店ID', '')),
                    refund_date=CSVParser._parse_date(row.get('refund_date', row.get('退款日期', ''))),
                    refund_amount=CSVParser._parse_decimal(row.get('refund_amount', row.get('退款金额', '0'))),
                    refund_reason=row.get('refund_reason', row.get('退款原因')),
                )
                refunds.append(refund)
        return refunds
    
    @staticmethod
    def parse_labor_costs(file_path: Path) -> List[LaborCost]:
        """解析人工成本 CSV 文件"""
        labor_costs = []
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                labor = LaborCost(
                    store_id=row.get('store_id', row.get('门店ID', '')),
                    store_name=row.get('store_name', row.get('门店名称', '')),
                    date=CSVParser._parse_date(row.get('date', row.get('日期', ''))),
                    hours_worked=CSVParser._parse_decimal(row.get('hours_worked', row.get('工作小时数', '0'))),
                    hourly_rate=CSVParser._parse_decimal(row.get('hourly_rate', row.get('时薪', '0'))),
                    total_cost=CSVParser._parse_decimal(row.get('total_cost', row.get('总成本', '0'))),
                    role=row.get('role', row.get('岗位')),
                )
                labor_costs.append(labor)
        return labor_costs
    
    @staticmethod
    def _parse_date(date_str: str) -> date:
        """解析日期字符串"""
        if not date_str:
            return date.today()
        
        formats = [
            '%Y-%m-%d',
            '%Y/%m/%d',
            '%d-%m-%Y',
            '%d/%m/%Y',
            '%Y年%m月%d日',
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(str(date_str).strip(), fmt).date()
            except (ValueError, TypeError):
                continue
        
        return date.today()
    
    @staticmethod
    def _parse_decimal(value: Any) -> Decimal:
        """解析数值为 Decimal"""
        if value is None:
            return Decimal('0')
        
        value_str = str(value).strip()
        value_str = value_str.replace(',', '')
        value_str = value_str.replace('¥', '')
        value_str = value_str.replace('$', '')
        value_str = value_str.replace('%', '')
        
        try:
            return Decimal(value_str)
        except InvalidOperation:
            return Decimal('0')


class YAMLParser:
    """YAML 文件解析器"""
    
    @staticmethod
    def parse_metric_rules(file_path: Path) -> Dict[str, MetricRule]:
        """解析指标规则 YAML 文件"""
        with open(file_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        rules = {}
        rules_data = data.get('metrics', data.get('指标', []))
        
        for item in rules_data:
            rule = MetricRule(
                metric_name=item.get('name', item.get('名称', '')),
                display_name=item.get('display_name', item.get('显示名称', item.get('name', item.get('名称', '')))),
                formula=item.get('formula', item.get('公式', '')),
                description=item.get('description', item.get('描述', '')),
                tolerance=float(item.get('tolerance', item.get('容差', 0.01))),
                rounding_method=item.get('rounding_method', item.get('四舍五入方式', 'ROUND_HALF_UP')),
                decimal_places=int(item.get('decimal_places', item.get('小数位数', 2))),
                store_aggregation=item.get('store_aggregation', item.get('门店汇总方式', 'SUM')),
            )
            rules[rule.metric_name] = rule
        
        return rules


class ReportParser:
    """报告解析器 - 支持 Markdown 和 JSON 格式"""
    
    METRIC_PATTERNS = [
        (re.compile(r'(?:GMV|总销售额|总营收)[：:]\s*([\d,]+\.?\d*)'), 'gmv'),
        (re.compile(r'(?:净销售额|净营收|净收入)[：:]\s*([\d,]+\.?\d*)'), 'net_sales'),
        (re.compile(r'(?:客单价|平均客单价|人均消费)[：:]\s*([\d,]+\.?\d*)'), 'average_order_value'),
        (re.compile(r'(?:退款率|退货率)[：:]\s*([\d,]+\.?\d*)%?'), 'refund_rate'),
        (re.compile(r'(?:人工成本率|人力成本率)[：:]\s*([\d,]+\.?\d*)%?'), 'labor_cost_rate'),
        (re.compile(r'(?:订单数|订单总量)[：:]\s*([\d,]+)'), 'total_orders'),
        (re.compile(r'(?:退款金额|总退款)[：:]\s*([\d,]+\.?\d*)'), 'total_refunds'),
        (re.compile(r'(?:人工成本|总人工成本)[：:]\s*([\d,]+\.?\d*)'), 'total_labor_cost'),
    ]
    
    @classmethod
    def parse_markdown(cls, file_path: Path) -> Dict[str, Any]:
        """解析 Markdown 格式的周报"""
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        metrics = cls._extract_metrics(content)
        store_metrics = cls._extract_store_metrics(content)
        
        return {
            'content': content,
            'metrics': metrics,
            'store_metrics': store_metrics,
            'file_path': str(file_path),
        }
    
    @classmethod
    def parse_json(cls, file_path: Path) -> Dict[str, Any]:
        """解析 JSON 格式的报告"""
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return {
            'content': json.dumps(data, ensure_ascii=False, indent=2),
            'metrics': data.get('metrics', data.get('指标', {})),
            'store_metrics': data.get('store_metrics', data.get('门店指标', {})),
            'file_path': str(file_path),
        }
    
    @classmethod
    def _extract_metrics(cls, content: str) -> List[ReportMetric]:
        """从文本中提取指标"""
        metrics = []
        lines = content.split('\n')
        
        for line_num, line in enumerate(lines, 1):
            for pattern, metric_name in cls.METRIC_PATTERNS:
                match = pattern.search(line)
                if match:
                    value_str = match.group(1).replace(',', '')
                    try:
                        value = Decimal(value_str)
                        metrics.append(ReportMetric(
                            metric_name=metric_name,
                            display_name=cls._get_display_name(metric_name),
                            value=value,
                            source_text=line.strip(),
                            line_number=line_num,
                        ))
                    except InvalidOperation:
                        continue
        
        table_metrics = cls._extract_metrics_from_tables(content)
        for tm in table_metrics:
            exists = False
            for m in metrics:
                if m.metric_name == tm.metric_name:
                    exists = True
                    break
            if not exists:
                metrics.append(tm)
        
        return metrics
    
    @classmethod
    def _extract_metrics_from_tables(cls, content: str) -> List[ReportMetric]:
        """从汇总表格中提取指标（非门店级别的表格）"""
        metrics = []
        
        table_pattern = re.compile(
            r'\|(.+?)\|\n'
            r'\|(?:[-:]+[-| :]+)\|\n'
            r'((?:\|.+?\|\n)+)',
            re.MULTILINE
        )
        
        for match in table_pattern.finditer(content):
            header_row = match.group(1)
            data_rows = match.group(2)
            
            headers = [h.strip() for h in header_row.split('|') if h.strip()]
            
            if len(headers) != 2:
                continue
            
            store_col_idx = cls._find_store_column(headers)
            if store_col_idx is not None:
                continue
            
            metric_col_idx = None
            value_col_idx = None
            
            for idx, header in enumerate(headers):
                header_lower = header.lower()
                if any(k in header_lower for k in ['指标', 'metric', '名称', 'name']):
                    metric_col_idx = idx
                elif any(k in header_lower for k in ['数值', '值', 'value', 'number']):
                    value_col_idx = idx
            
            if metric_col_idx is not None and value_col_idx is not None:
                for line in data_rows.strip().split('\n'):
                    cells = [c.strip() for c in line.split('|') if c.strip()]
                    if len(cells) < 2:
                        continue
                    
                    metric_name = cls._map_header_to_metric(cells[metric_col_idx])
                    if metric_name and value_col_idx < len(cells):
                        try:
                            value_str = cells[value_col_idx].replace(',', '').replace('%', '')
                            value = Decimal(value_str)
                            metrics.append(ReportMetric(
                                metric_name=metric_name,
                                display_name=cells[metric_col_idx],
                                value=value,
                                source_text=line,
                            ))
                        except InvalidOperation:
                            continue
            else:
                for line in data_rows.strip().split('\n'):
                    cells = [c.strip() for c in line.split('|') if c.strip()]
                    if len(cells) < 2:
                        continue
                    
                    metric_name = cls._map_header_to_metric(cells[0])
                    if metric_name:
                        try:
                            value_str = cells[1].replace(',', '').replace('%', '')
                            value = Decimal(value_str)
                            metrics.append(ReportMetric(
                                metric_name=metric_name,
                                display_name=cells[0],
                                value=value,
                                source_text=line,
                            ))
                        except InvalidOperation:
                            continue
        
        return metrics
    
    @classmethod
    def _extract_store_metrics(cls, content: str) -> Dict[str, Dict[str, ReportMetric]]:
        """提取门店级别的指标"""
        store_metrics = {}
        
        table_pattern = re.compile(
            r'\|(.+?)\|\n'
            r'\|(?:[-:]+[-| :]+)\|\n'
            r'((?:\|.+?\|\n)+)',
            re.MULTILINE
        )
        
        for match in table_pattern.finditer(content):
            header_row = match.group(1)
            data_rows = match.group(2)
            
            headers = [h.strip() for h in header_row.split('|') if h.strip()]
            store_col_idx = cls._find_store_column(headers)
            
            if store_col_idx is None:
                continue
            
            for line in data_rows.strip().split('\n'):
                cells = [c.strip() for c in line.split('|') if c.strip()]
                if len(cells) <= store_col_idx:
                    continue
                
                store_id = cells[store_col_idx]
                if store_id not in store_metrics:
                    store_metrics[store_id] = {}
                
                for col_idx, header in enumerate(headers):
                    if col_idx == store_col_idx:
                        continue
                    
                    metric_name = cls._map_header_to_metric(header)
                    if metric_name and col_idx < len(cells):
                        try:
                            value_str = cells[col_idx].replace(',', '').replace('%', '')
                            value = Decimal(value_str)
                            store_metrics[store_id][metric_name] = ReportMetric(
                                metric_name=metric_name,
                                display_name=header,
                                value=value,
                                source_text=line,
                            )
                        except InvalidOperation:
                            continue
        
        return store_metrics
    
    @staticmethod
    def _find_store_column(headers: List[str]) -> Optional[int]:
        """查找门店列的索引"""
        store_keywords = ['门店', 'store', '门店ID', 'store_id', '门店名称', 'store_name']
        for idx, header in enumerate(headers):
            for keyword in store_keywords:
                if keyword.lower() in header.lower():
                    return idx
        return None
    
    @staticmethod
    def _map_header_to_metric(header: str) -> Optional[str]:
        """将表头映射到指标名称"""
        mappings = {
            'gmv': 'gmv',
            '总销售额': 'gmv',
            '净销售额': 'net_sales',
            '净营收': 'net_sales',
            '客单价': 'average_order_value',
            '平均客单价': 'average_order_value',
            '退款率': 'refund_rate',
            '人工成本率': 'labor_cost_rate',
            '订单数': 'total_orders',
            '退款金额': 'total_refunds',
            '人工成本': 'total_labor_cost',
        }
        
        header_lower = header.lower()
        for key, value in mappings.items():
            if key in header_lower:
                return value
        
        return None
    
    @staticmethod
    def _get_display_name(metric_name: str) -> str:
        """获取指标的显示名称"""
        names = {
            'gmv': 'GMV',
            'net_sales': '净销售额',
            'average_order_value': '客单价',
            'refund_rate': '退款率',
            'labor_cost_rate': '人工成本率',
            'total_orders': '订单数',
            'total_refunds': '退款金额',
            'total_labor_cost': '人工成本',
        }
        return names.get(metric_name, metric_name)
