import re
from typing import Dict, List, Tuple, Set

HIGH_RISK_KEYWORDS = {
    'dangerous_signs': [
        '胸痛', '胸闷', '呼吸困难', '气短', '喘憋',
        '剧烈头痛', '突发头痛', '喷射性呕吐',
        '意识障碍', '昏迷', '嗜睡', '抽搐', '惊厥',
        '大量出血', '大出血', '呕血', '咯血', '便血', '黑便',
        '高热', '体温39', '体温40', '寒战',
        '严重腹痛', '剧烈腹痛', '急腹症',
        '低血压', '休克', '晕厥', '猝死',
        '心肌梗死', '心梗', '脑梗死', '脑梗', '脑出血',
        '肺栓塞', '主动脉夹层',
        '过敏反应', '过敏性休克', '喉头水肿',
        '自杀倾向', '自伤', '自杀意念',
        '呼吸衰竭', '心力衰竭', '肾衰竭', '肝衰竭',
        '多器官功能衰竭', 'MODS',
        '紧急转诊', '急诊', '急救', '120',
        '病危', '病重', '抢救',
        '血小板低', '血小板减少',
        '白细胞低', '粒细胞缺乏'
    ],
    'medication_risk': [
        '药物过敏', '过敏反应', '严重过敏',
        '药物不良反应', '严重不良反应',
        '中毒', '药物过量', '误服',
        '抗凝出血', '华法林出血', '肝素出血',
        '化疗反应严重', '严重骨髓抑制'
    ]
}

MEDIUM_RISK_KEYWORDS = {
    'follow_up_concerns': [
        '需尽快复诊', '尽快就诊', '门诊复查', '随访异常',
        '指标异常', '检验异常', '检查异常',
        '血糖高', '高血压高', '血压高', '血脂高',
        '控制不佳', '疗效不佳', '效果不好',
        '症状加重', '病情加重', '进展',
        '新增症状', '新出现', '新发'
    ],
    'medication_adjustment': [
        '调整用药', '调整剂量', '换药', '更改方案',
        '加药', '减药', '停药',
        '出现耐药', '耐药',
        '副作用', '药物副作用', '不良反应'
    ],
    'lifestyle_concerns': [
        '依从性差', '不配合', '不规律服药',
        '漏服', '忘记服药', '自行停药',
        '吸烟', '饮酒', '熬夜',
        '饮食不控制', '缺乏运动'
    ]
}

LOW_RISK_KEYWORDS = {
    'stable': [
        '稳定', '平稳', '良好', '正常',
        '恢复良好', '康复良好', '恢复中',
        '继续观察', '定期复查', '常规随访',
        '无不适', '无症状', '好转', '改善'
    ],
    'routine': [
        '一般情况可', '情况尚可', '状态不错',
        '规律服药', '依从性好',
        '指标正常', '检验正常', '检查正常'
    ]
}

NEGATION_KEYWORDS = ['无', '没有', '未', '不', '否认', '未见', '排除']


class RiskStratificationEngine:
    def __init__(self):
        self.high_keywords = self._flatten_keywords(HIGH_RISK_KEYWORDS)
        self.medium_keywords = self._flatten_keywords(MEDIUM_RISK_KEYWORDS)
        self.low_keywords = self._flatten_keywords(LOW_RISK_KEYWORDS)
    
    def _flatten_keywords(self, keyword_dict: Dict[str, List[str]]) -> List[str]:
        keywords = []
        for category, words in keyword_dict.items():
            keywords.extend(words)
        return keywords
    
    def _find_matches(self, text: str, keywords: List[str]) -> Tuple[List[str], Set[str]]:
        found = []
        categories = set()
        
        for keyword in keywords:
            if keyword in text:
                found.append(keyword)
        
        if HIGH_RISK_KEYWORDS:
            for category, words in HIGH_RISK_KEYWORDS.items():
                for word in words:
                    if word in found:
                        categories.add('危险信号' if category == 'dangerous_signs' else '用药风险')
        
        if MEDIUM_RISK_KEYWORDS:
            for category, words in MEDIUM_RISK_KEYWORDS.items():
                for word in words:
                    if word in found and category not in categories:
                        if category == 'follow_up_concerns':
                            categories.add('复诊异常')
                        elif category == 'medication_adjustment':
                            categories.add('用药调整')
                        elif category == 'lifestyle_concerns':
                            categories.add('生活方式')
        
        return list(set(found)), categories
    
    def _check_negation(self, text: str, keyword: str) -> bool:
        window_size = 10
        keyword_pos = text.find(keyword)
        if keyword_pos == -1:
            return False
        
        start = max(0, keyword_pos - window_size)
        end = min(len(text), keyword_pos)
        context = text[start:end]
        
        for neg in NEGATION_KEYWORDS:
            if neg in context:
                return True
        return False
    
    def _calculate_confidence(self, matches: List[str], risk_level: str) -> float:
        if not matches:
            return 0.0
        
        base_confidence = {
            'high': 0.8,
            'medium': 0.6,
            'low': 0.5
        }
        
        match_count = len(matches)
        confidence = base_confidence.get(risk_level, 0.5)
        confidence += min(0.1, match_count * 0.02)
        
        return round(min(confidence, 0.95), 2)
    
    def stratify(self, text: str) -> Dict:
        text = text.strip()
        if not text:
            return {
                'risk_level': 'low',
                'reason': '文本内容为空',
                'keywords': [],
                'categories': [],
                'confidence': 0.0
            }
        
        high_matches, high_categories = self._find_matches(text, self.high_keywords)
        valid_high_matches = [k for k in high_matches if not self._check_negation(text, k)]
        
        if valid_high_matches:
            return {
                'risk_level': 'high',
                'reason': f'检测到危险信号或严重情况：{", ".join(valid_high_matches[:5])}',
                'keywords': valid_high_matches,
                'categories': list(high_categories),
                'confidence': self._calculate_confidence(valid_high_matches, 'high')
            }
        
        medium_matches, medium_categories = self._find_matches(text, self.medium_keywords)
        valid_medium_matches = [k for k in medium_matches if not self._check_negation(text, k)]
        
        if valid_medium_matches:
            return {
                'risk_level': 'medium',
                'reason': f'检测到需要关注的情况：{", ".join(valid_medium_matches[:5])}',
                'keywords': valid_medium_matches,
                'categories': list(medium_categories),
                'confidence': self._calculate_confidence(valid_medium_matches, 'medium')
            }
        
        low_matches, low_categories = self._find_matches(text, self.low_keywords)
        
        if low_matches:
            return {
                'risk_level': 'low',
                'reason': '检测到稳定或常规随访信号',
                'keywords': low_matches,
                'categories': ['稳定状态'],
                'confidence': self._calculate_confidence(low_matches, 'low')
            }
        
        return {
            'risk_level': 'low',
            'reason': '未检测到明确的风险信号，默认归为低风险',
            'keywords': [],
            'categories': [],
            'confidence': 0.3
        }
    
    def get_keyword_rules(self) -> Dict:
        return {
            'high_risk': {
                'name': '高风险',
                'categories': {
                    '危险信号': HIGH_RISK_KEYWORDS['dangerous_signs'],
                    '用药风险': HIGH_RISK_KEYWORDS['medication_risk']
                }
            },
            'medium_risk': {
                'name': '中风险',
                'categories': {
                    '复诊异常': MEDIUM_RISK_KEYWORDS['follow_up_concerns'],
                    '用药调整': MEDIUM_RISK_KEYWORDS['medication_adjustment'],
                    '生活方式': MEDIUM_RISK_KEYWORDS['lifestyle_concerns']
                }
            },
            'low_risk': {
                'name': '低风险',
                'categories': {
                    '稳定状态': LOW_RISK_KEYWORDS['stable'],
                    '常规随访': LOW_RISK_KEYWORDS['routine']
                }
            }
        }


risk_engine = RiskStratificationEngine()
