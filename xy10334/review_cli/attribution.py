from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
from dateutil import parser as date_parser

from .database import Database


KITCHEN_KEYWORDS = [
    '等太久', '出餐慢', '厨房慢', '制作时间长', '等了很久', '等餐',
    '准备慢', '备餐慢', '等餐时间', '超时出餐', '出餐超时',
    'waiting', 'kitchen slow', 'preparation', 'took too long'
]

DELIVERY_KEYWORDS = [
    '配送慢', '骑手慢', '送太慢', '超时', '延迟', '晚到', '迟到',
    '配送超时', '骑手超时', '路上', '配送员', '送错', '地址',
    'delivery', 'rider', 'late', 'delayed', 'delivery time'
]

MISSING_KEYWORDS = [
    '漏餐', '少了', '没给', '缺', '少送', '漏送', '没收到', '少的',
    'missing', 'not included', 'forgot', 'absent'
]

TASTE_KEYWORDS = [
    '难吃', '不好吃', '味道', '口味', '咸', '淡', '辣', '油',
    '冷', '凉', '不新鲜', '变质', '异味', '口感', '口味差',
    'taste', 'flavor', 'bad', 'awful', 'cold', 'not fresh', 'stale'
]

SERVICE_KEYWORDS = [
    '客服', '态度', '服务', '投诉', '处理', '不理', '回复',
    '商家态度', '恶劣', '敷衍', 'customer service', 'service', 'attitude'
]

STANDARD_KITCHEN_DURATION = 15 * 60
STANDARD_DELIVERY_DURATION = 30 * 60


class AttributionEngine:
    def __init__(self, db: Database):
        self.db = db

    def _parse_time(self, value: Any) -> Optional[datetime]:
        if not value:
            return None
        try:
            if isinstance(value, datetime):
                return value
            return date_parser.parse(str(value))
        except:
            return None

    def _calculate_kitchen_duration(self, order: Dict[str, Any]) -> Optional[int]:
        if order.get('kitchen_duration_seconds'):
            return int(order['kitchen_duration_seconds'])
        start = self._parse_time(order.get('kitchen_start_time'))
        finish = self._parse_time(order.get('kitchen_finish_time'))
        if start and finish:
            return int((finish - start).total_seconds())
        return None

    def _calculate_delivery_duration(self, order: Dict[str, Any]) -> Optional[int]:
        if order.get('delivery_duration_seconds'):
            return int(order['delivery_duration_seconds'])
        pickup = self._parse_time(order.get('rider_pickup_time'))
        arrive = self._parse_time(order.get('delivery_arrive_time'))
        if pickup and arrive:
            return int((arrive - pickup).total_seconds())
        return None

    def _has_delivery_nodes(self, order: Dict[str, Any]) -> bool:
        return (order.get('rider_pickup_time') is not None and 
                order.get('delivery_arrive_time') is not None)

    def _is_compensation_abnormal(self, order: Dict[str, Any]) -> bool:
        comp_amount = order.get('compensation_amount') or 0
        if comp_amount <= 0:
            return False
        order_amount = order.get('order_amount') or 0
        if order_amount <= 0:
            return False
        ratio = comp_amount / order_amount
        return ratio > 1.0 or comp_amount > 500

    def _check_keywords(self, content: str, keywords: List[str]) -> bool:
        if not content:
            return False
        content_lower = content.lower()
        return any(kw.lower() in content_lower for kw in keywords)

    def analyze_order(self, order: Dict[str, Any]) -> Tuple[str, str, str]:
        category = 'pending'
        reason = ''
        evidence = ''

        review_content = order.get('review_content', '') or ''
        comp_reason = order.get('compensation_reason', '') or ''
        full_content = f"{review_content} {comp_reason}"

        has_kitchen_time = order.get('kitchen_start_time') or order.get('kitchen_finish_time')
        has_delivery_nodes = self._has_delivery_nodes(order)
        kitchen_duration = self._calculate_kitchen_duration(order)
        delivery_duration = self._calculate_delivery_duration(order)

        if not has_delivery_nodes or self._is_compensation_abnormal(order):
            if not has_delivery_nodes:
                reason = '缺少配送节点数据，需要人工复核'
                evidence = 'rider_pickup_time 或 delivery_arrive_time 缺失'
            else:
                reason = '补偿金额异常，需要人工复核'
                evidence = f"补偿金额异常，订单金额: {order.get('order_amount')}元，补偿金额: {order.get('compensation_amount')}元"
            return ('pending', reason, evidence)

        if kitchen_duration and kitchen_duration > STANDARD_KITCHEN_DURATION:
            category = 'kitchen_slow'
            minutes = kitchen_duration // 60
            reason = f'厨房出餐时长超过标准值（{STANDARD_KITCHEN_DURATION//60}分钟）'
            evidence = f'厨房用时 {minutes} 分钟，超过标准 {STANDARD_KITCHEN_DURATION//60} 分钟阈值'
            return (category, reason, evidence)

        if self._check_keywords(full_content, KITCHEN_KEYWORDS) and has_kitchen_time:
            category = 'kitchen_slow'
            reason = '用户评价中包含出餐慢相关描述'
            evidence = f'评价关键词匹配: "{review_content[:100]}..."'
            return (category, reason, evidence)

        if delivery_duration and delivery_duration > STANDARD_DELIVERY_DURATION:
            category = 'delivery_slow'
            minutes = delivery_duration // 60
            reason = f'配送时长超过标准值（{STANDARD_DELIVERY_DURATION//60}分钟）'
            evidence = f'配送用时 {minutes} 分钟，超过标准 {STANDARD_DELIVERY_DURATION//60} 分钟阈值'
            return (category, reason, evidence)

        if self._check_keywords(full_content, DELIVERY_KEYWORDS):
            category = 'delivery_slow'
            reason = '用户评价中包含配送慢/超时相关描述'
            evidence = f'评价关键词匹配: "{review_content[:100]}..."'
            return (category, reason, evidence)

        if self._check_keywords(full_content, MISSING_KEYWORDS):
            category = 'missing_item'
            reason = '用户评价或补偿记录中包含漏餐相关描述'
            evidence = f'评价/补偿关键词匹配: "{full_content[:100]}..."'
            return (category, reason, evidence)

        if self._check_keywords(full_content, TASTE_KEYWORDS):
            category = 'taste_issue'
            reason = '用户评价中包含口味/食物质量相关描述'
            evidence = f'评价关键词匹配: "{review_content[:100]}..."'
            return (category, reason, evidence)

        if self._check_keywords(full_content, SERVICE_KEYWORDS):
            category = 'service_issue'
            reason = '用户评价中包含服务/客服相关描述'
            evidence = f'评价关键词匹配: "{review_content[:100]}..."'
            return (category, reason, evidence)

        return ('pending', '无法自动判断，需要人工复核', '缺少明确的时间数据和关键词匹配')

    def run_auto_attribution(self, start_date: Optional[str] = None,
                             end_date: Optional[str] = None,
                             force: bool = False) -> Dict[str, int]:
        orders = self.db.get_negative_orders(start_date, end_date)

        results = {
            'kitchen_slow': 0,
            'delivery_slow': 0,
            'missing_item': 0,
            'taste_issue': 0,
            'service_issue': 0,
            'pending': 0,
        }

        for order in orders:
            current_cat = order.get('category')
            current_source = order.get('source')

            if not force and current_source == 'manual' and current_cat:
                results[current_cat] = results.get(current_cat, 0) + 1
                continue

            if not force and current_cat and current_cat != 'pending' and current_source == 'auto':
                results[current_cat] = results.get(current_cat, 0) + 1
                continue

            category, reason, evidence = self.analyze_order(order)
            if self.db.save_attribution(order['order_id'], category, 'auto', reason, evidence):
                results[category] += 1

        return results
