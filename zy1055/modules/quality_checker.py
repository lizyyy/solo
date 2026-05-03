# -*- coding: utf-8 -*-
import re
from typing import Dict, List, Any, Optional
from datetime import datetime

class QualityChecker:
    def __init__(self):
        pass
    
    def get_default_rules(self) -> List[Dict[str, Any]]:
        return [
            {
                'id': 'refund_promise',
                'name': '退款时效承诺',
                'description': '用户提到退款时，检查客服是否承诺了处理时效',
                'enabled': True,
                'severity': 'high',
                'category': '退款售后',
                'trigger_keywords': ['退款', '退货', '换货', '售后', '退钱', '申请退款'],
                'check_type': 'response_keywords',
                'required_keywords': ['小时', '天', '工作日', '24小时', '48小时', '72小时', '1-3天', '3-5天', '1个工作日', '3个工作日', '尽快', '马上', '立即'],
                'forbidden_keywords': [],
                'message': '用户咨询退款时，回复中未明确说明处理时效，建议补充"24小时内处理"、"3-5个工作日退款到账"等时效说明'
            },
            {
                'id': 'complaint_response',
                'name': '投诉安抚检查',
                'description': '用户投诉时，检查客服是否先安抚情绪',
                'enabled': True,
                'severity': 'high',
                'category': '投诉处理',
                'trigger_keywords': ['投诉', '差评', '不满意', '很生气', '愤怒', '骗人', '假货', '质量问题', '太差了', '垃圾', '举报'],
                'check_type': 'response_keywords',
                'required_keywords': ['抱歉', '对不起', '不好意思', '非常抱歉', '实在抱歉', '给您添麻烦了', '让您失望了', '理解您的心情', '很理解', '确实', '感谢您的反馈'],
                'forbidden_keywords': [],
                'message': '用户表达不满或投诉时，回复中缺少安抚话术，建议先表达歉意和理解，如"非常抱歉给您带来了不好的体验"'
            },
            {
                'id': 'address_change',
                'name': '改地址确认',
                'description': '用户要求改地址时，检查是否确认新地址信息',
                'enabled': True,
                'severity': 'medium',
                'category': '订单修改',
                'trigger_keywords': ['改地址', '修改地址', '换地址', '地址改', '地址不对', '地址错了', '收货地址', '更改地址'],
                'check_type': 'response_keywords',
                'required_keywords': ['地址是', '地址为', '新地址', '确认一下', '请提供', '告诉我', '省市', '详细地址', '手机号', '电话', '收货人'],
                'forbidden_keywords': [],
                'message': '用户要求修改地址时，建议确认完整的收货信息，包括收货人、手机号、详细地址，避免配送错误'
            },
            {
                'id': 'shipping_urgent',
                'name': '催发货回复',
                'description': '用户催发货时，检查是否告知发货时间或进展',
                'enabled': True,
                'severity': 'high',
                'category': '物流配送',
                'trigger_keywords': ['催发货', '什么时候发货', '怎么还没发货', '赶紧发货', '发货了吗', '物流', '快递', '什么时候到', '查物流'],
                'check_type': 'response_keywords',
                'required_keywords': ['48小时', '24小时', '72小时', '今天', '明天', '后天', '工作日', '已经发出', '快递单号', '帮您查', '尽快安排', '马上安排'],
                'forbidden_keywords': [],
                'message': '用户询问发货或物流时，建议明确告知时间范围或提供快递单号，让用户有预期'
            },
            {
                'id': 'coupon_issue',
                'name': '优惠券问题处理',
                'description': '用户提到优惠券时，检查是否提供解决方案',
                'enabled': True,
                'severity': 'medium',
                'category': '优惠活动',
                'trigger_keywords': ['优惠券', '券', '优惠', '满减', '折扣', '促销', '活动', '用不了', '不能用', '无法使用', '领取', '发券'],
                'check_type': 'response_keywords',
                'required_keywords': ['帮您', '可以', '重新', '补发', '补偿', '优惠码', '兑换码', '使用条件', '有效期', '核实', '查询', '技术'],
                'forbidden_keywords': [],
                'message': '用户咨询优惠券问题时，建议提供具体的解决方案，如补发、核实使用条件或提供替代方案'
            },
            {
                'id': 'negative_escape',
                'name': '负面词汇规避',
                'description': '检查回复中是否有不礼貌或推卸责任的词汇',
                'enabled': True,
                'severity': 'high',
                'category': '服务态度',
                'trigger_keywords': [],
                'check_type': 'forbidden_words',
                'required_keywords': [],
                'forbidden_keywords': ['不知道', '不清楚', '没办法', '不行', '不可以', '不能', '这不是我们的问题', '是你的问题', '你自己', '你应该', '你怎么', '你不会', '你不懂', '随便', '那我不管'],
                'message': '回复中包含负面或推卸责任的词汇，建议使用更积极和帮助性的表达方式，如"我来帮您查询一下"、"让我为您核实"'
            },
            {
                'id': 'response_completeness',
                'name': '回复完整性检查',
                'description': '检查客服回复是否过于简短可能遗漏信息',
                'enabled': True,
                'severity': 'low',
                'category': '回复质量',
                'trigger_keywords': [],
                'check_type': 'min_length',
                'min_length': 5,
                'required_keywords': [],
                'forbidden_keywords': [],
                'message': '回复内容较短，建议确认是否完整回答了用户问题，是否需要补充更多信息'
            },
            {
                'id': 'greeting_check',
                'name': '首次问候检查',
                'description': '会话开始时检查是否有问候语',
                'enabled': True,
                'severity': 'low',
                'category': '服务规范',
                'trigger_keywords': [],
                'check_type': 'greeting',
                'required_keywords': ['您好', '你好', '欢迎', '很高兴为您服务', '请问有什么可以帮您', '请问需要什么帮助'],
                'forbidden_keywords': [],
                'message': '建议在会话开始时使用标准问候语，如"您好，很高兴为您服务，请问有什么可以帮您？"'
            }
        ]
    
    def check_rule(self, rule: Dict[str, Any], user_text: str, agent_text: str) -> Optional[Dict[str, Any]]:
        if not rule.get('enabled', True):
            return None
        
        check_type = rule.get('check_type', 'response_keywords')
        trigger_keywords = rule.get('trigger_keywords', [])
        required_keywords = rule.get('required_keywords', [])
        forbidden_keywords = rule.get('forbidden_keywords', [])
        
        if trigger_keywords:
            has_trigger = any(kw in user_text for kw in trigger_keywords)
            if not has_trigger:
                return None
        
        issue_found = False
        details = {}
        
        if check_type == 'response_keywords':
            if required_keywords:
                has_required = any(kw in agent_text for kw in required_keywords)
                if not has_required:
                    issue_found = True
                    details['missing_keywords'] = [kw for kw in required_keywords if kw not in agent_text]
        
        elif check_type == 'forbidden_words':
            if forbidden_keywords:
                has_forbidden = any(kw in agent_text for kw in forbidden_keywords)
                if has_forbidden:
                    issue_found = True
                    details['found_forbidden'] = [kw for kw in forbidden_keywords if kw in agent_text]
        
        elif check_type == 'min_length':
            min_length = rule.get('min_length', 10)
            if len(agent_text.strip()) < min_length:
                issue_found = True
                details['actual_length'] = len(agent_text.strip())
                details['min_required'] = min_length
        
        elif check_type == 'greeting':
            if required_keywords:
                has_greeting = any(kw in agent_text for kw in required_keywords)
                if not has_greeting:
                    user_has_greeting = any(kw in user_text for kw in ['你好', '您好', '在吗', '有人吗', '客服', '你好吗'])
                    if user_has_greeting:
                        issue_found = True
                        details['suggested_greeting'] = required_keywords[:3]
        
        if issue_found:
            return {
                'rule_id': rule.get('id'),
                'rule_name': rule.get('name'),
                'category': rule.get('category', '未分类'),
                'severity': rule.get('severity', 'medium'),
                'message': rule.get('message', ''),
                'details': details,
                'user_text_preview': user_text[:100] if user_text else '',
                'agent_text_preview': agent_text[:100] if agent_text else '',
                'resolved': False,
                'resolution': ''
            }
        
        return None
    
    def check_session(self, session: Dict[str, Any], rules: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        issues = []
        
        messages = session.get('messages', [])
        if not messages:
            return issues
        
        user_messages = [m['content'] for m in messages if m.get('role') == 'user']
        agent_messages = [m['content'] for m in messages if m.get('role') == 'agent']
        
        combined_user = ' '.join(user_messages)
        combined_agent = ' '.join(agent_messages)
        
        for rule in rules:
            issue = self.check_rule(rule, combined_user, combined_agent)
            if issue:
                issue['session_id'] = session.get('session_id')
                issues.append(issue)
        
        return issues
    
    def calculate_response_diversity(self, sessions: List[Dict[str, Any]]) -> Dict[str, Any]:
        from collections import Counter
        
        all_responses = []
        for session in sessions:
            agent_messages = [m['content'] for m in session.get('messages', []) if m.get('role') == 'agent']
            all_responses.extend(agent_messages)
        
        if not all_responses:
            return {
                'total_responses': 0,
                'unique_responses': 0,
                'diversity_score': 0,
                'top_repeated': []
            }
        
        response_counts = Counter(all_responses)
        total = len(all_responses)
        unique = len(response_counts)
        
        repeated = [(resp, count) for resp, count in response_counts.items() if count > 1]
        repeated.sort(key=lambda x: x[1], reverse=True)
        
        return {
            'total_responses': total,
            'unique_responses': unique,
            'diversity_score': round(unique / total * 100, 2) if total > 0 else 0,
            'top_repeated': repeated[:5]
        }
