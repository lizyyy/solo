import re
from typing import List, Dict, Any, Tuple, Set
from dataclasses import dataclass


@dataclass
class SemanticMatchResult:
    matched: bool
    match_type: str
    confidence: float
    matched_phrase: str
    original_phrase: str
    trigger_words: List[str]
    context_words: List[str]


class SemanticMatcher:
    
    _semantic_patterns = [
        {
            'category': 'gambling',
            'severity': 'high',
            'trigger_words': ['赌', '博', '下注', '赔率', '赢钱', '输钱', '庄家', '闲家'],
            'context_patterns': [
                r'赌.*博',
                r'下.*注',
                r'赔.*率',
                r'赢.*钱',
                r'庄.*家',
            ],
            'exemption_words': ['打赌', '赌约', '赌注', '赌博罪', '赌博法']
        },
        {
            'category': 'pornographic',
            'severity': 'high',
            'trigger_words': ['色', '情', '黄', '淫', '欲', '嫖', '娼'],
            'context_patterns': [
                r'色.*情',
                r'淫.*秽',
                r'黄.*色',
                r'嫖.*娼',
            ],
            'exemption_words': ['黄色', '黄金', '黄色预警', '色情片', '色情网站']
        },
        {
            'category': 'fraud',
            'severity': 'high',
            'trigger_words': ['骗', '诈', '欺', '谎', '假', '骗钱', '诈骗'],
            'context_patterns': [
                r'诈.*骗',
                r'欺.*骗',
                r'谎.*言',
                r'假.*冒',
            ],
            'exemption_words': ['欺骗', '欺诈', '诈骗罪', '欺骗性']
        },
        {
            'category': 'drug',
            'severity': 'critical',
            'trigger_words': ['毒', '品', '药', '丸', '粉', '冰', 'K', '摇头'],
            'context_patterns': [
                r'毒.*品',
                r'吸.*毒',
                r'贩.*毒',
                r'冰.*毒',
                r'摇.*头.*丸',
            ],
            'exemption_words': ['毒品', '毒药', '消毒', '戒毒', '缉毒']
        },
        {
            'category': 'violent',
            'severity': 'high',
            'trigger_words': ['打', '杀', '砍', '捅', '枪', '刀', '炸弹', '爆炸'],
            'context_patterns': [
                r'打.*架',
                r'杀.*人',
                r'砍.*人',
                r'枪.*支',
                r'爆.*炸',
            ],
            'exemption_words': ['打球', '打游戏', '打电话', '打车', '打折']
        },
    ]
    
    _phrase_clusters = {
        'gambling': [
            ['赌博', '赌搏', '堵博', '睹博'],
            ['下注', '下住', '下驻'],
            ['赔率', '陪率'],
            ['赢钱', '嬴钱'],
            ['庄家', '装家'],
        ],
        'pornographic': [
            ['色情', '涩情', '瑟情'],
            ['黄色', '簧色'],
            ['淫秽', '淫秽'],
        ],
        'fraud': [
            ['诈骗', '诈遍', '炸骗'],
            ['欺骗', '欺遍'],
            ['谎言', '荒言'],
        ],
    }
    
    def __init__(self):
        self._compiled_patterns = {}
        for pattern in self._semantic_patterns:
            category = pattern['category']
            self._compiled_patterns[category] = [
                re.compile(p, re.IGNORECASE) for p in pattern['context_patterns']
            ]
    
    def match_semantic(self, text: str, segments: List[Dict[str, Any]] = None) -> List[SemanticMatchResult]:
        results = []
        
        if segments is None:
            segments = []
        
        words_in_text = set()
        for seg in segments:
            words_in_text.add(seg['word'])
            for char in seg['word']:
                words_in_text.add(char)
        
        for pattern in self._semantic_patterns:
            trigger_found = False
            found_triggers = []
            
            for trigger in pattern['trigger_words']:
                if trigger in text or trigger in words_in_text:
                    trigger_found = True
                    found_triggers.append(trigger)
                    break
            
            if not trigger_found:
                continue
            
            is_exempt = False
            for exemption in pattern['exemption_words']:
                if exemption in text:
                    is_exempt = True
                    break
            
            if is_exempt:
                continue
            
            matched_pattern = None
            for regex in self._compiled_patterns.get(pattern['category'], []):
                match = regex.search(text)
                if match:
                    matched_pattern = match.group()
                    break
            
            if matched_pattern:
                results.append(SemanticMatchResult(
                    matched=True,
                    match_type='semantic_context',
                    confidence=0.85,
                    matched_phrase=matched_pattern,
                    original_phrase=matched_pattern,
                    trigger_words=found_triggers,
                    context_words=[]
                ))
        
        phrase_results = self._match_phrase_clusters(text)
        results.extend(phrase_results)
        
        return results
    
    def _match_phrase_clusters(self, text: str) -> List[SemanticMatchResult]:
        results = []
        
        for category, clusters in self._phrase_clusters.items():
            for cluster in clusters:
                for variant in cluster:
                    if variant in text:
                        standard_form = cluster[0]
                        
                        category_info = next(
                            (p for p in self._semantic_patterns if p['category'] == category),
                            None
                        )
                        
                        results.append(SemanticMatchResult(
                            matched=True,
                            match_type='phrase_variant',
                            confidence=0.9 if variant == standard_form else 0.75,
                            matched_phrase=variant,
                            original_phrase=standard_form,
                            trigger_words=[standard_form],
                            context_words=[]
                        ))
                        break
        
        return results
    
    def calculate_similarity(self, text1: str, text2: str) -> float:
        if not text1 or not text2:
            return 0.0
        
        set1 = set(text1)
        set2 = set(text2)
        
        if not set1 or not set2:
            return 0.0
        
        intersection = len(set1 & set2)
        union = len(set1 | set2)
        
        jaccard = intersection / union if union > 0 else 0.0
        
        if len(text1) > 0 and len(text2) > 0:
            if text1 in text2 or text2 in text1:
                jaccard = max(jaccard, 0.8)
        
        return jaccard
    
    def find_similar_phrases(self, target: str, candidates: List[str], threshold: float = 0.6) -> List[Tuple[str, float]]:
        results = []
        
        for candidate in candidates:
            similarity = self.calculate_similarity(target, candidate)
            if similarity >= threshold:
                results.append((candidate, similarity))
        
        results.sort(key=lambda x: x[1], reverse=True)
        return results
    
    def check_context_enhancement(self, text: str, sensitive_word: str, context_rules: List[Dict] = None) -> Dict[str, Any]:
        result = {
            'should_enhance': False,
            'should_exempt': False,
            'reason': '',
            'matched_rules': []
        }
        
        if context_rules is None:
            context_rules = []
        
        for rule in context_rules:
            trigger_words = rule.get('trigger_words', '').split(',') if rule.get('trigger_words') else []
            context_words = rule.get('context_words', '').split(',') if rule.get('context_words') else []
            exemption_words = rule.get('exemption_words', '').split(',') if rule.get('exemption_words') else []
            rule_type = rule.get('rule_type', 'enhance')
            
            trigger_found = any(t.strip() in text for t in trigger_words if t.strip())
            context_found = any(c.strip() in text for c in context_words if c.strip())
            exemption_found = any(e.strip() in text for e in exemption_words if e.strip())
            
            if trigger_found:
                if exemption_found:
                    result['should_exempt'] = True
                    result['reason'] = f'触发豁免规则: {rule.get("rule_name", "unknown")}'
                    result['matched_rules'].append(rule.get('rule_name'))
                elif rule_type == 'enhance' and context_found:
                    result['should_enhance'] = True
                    result['reason'] = f'触发增强规则: {rule.get("rule_name", "unknown")}'
                    result['matched_rules'].append(rule.get('rule_name'))
                elif rule_type == 'enhance' and not context_words:
                    result['should_enhance'] = True
                    result['reason'] = f'触发增强规则: {rule.get("rule_name", "unknown")}'
                    result['matched_rules'].append(rule.get('rule_name'))
        
        return result
