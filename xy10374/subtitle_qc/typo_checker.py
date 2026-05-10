from typing import List, Dict, Set
from .subtitle_parser import SubtitleItem
import re


class TypoChecker:
    def __init__(self):
        self.common_mistakes = {
            '的地得': {
                '的': ['地', '得'],
                '地': ['的', '得'],
                '得': ['的', '地']
            },
            '形近字': {
                '已': ['己', '巳'],
                '己': ['已', '巳'],
                '辩': ['辨', '辫'],
                '辨': ['辩', '辫'],
                '辫': ['辩', '辨'],
                '籍': ['藉'],
                '藉': ['籍'],
                '采': ['彩'],
                '彩': ['采'],
                '度': ['渡'],
                '渡': ['度'],
                '坐': ['座'],
                '座': ['坐'],
                '做': ['作'],
                '作': ['做'],
                '戴': ['带'],
                '带': ['戴']
            },
            '同音词': {
                '登录': ['登陆'],
                '登陆': ['登录'],
                '账号': ['帐号'],
                '帐号': ['账号'],
                '订金': ['定金'],
                '定金': ['订金'],
                '必须': ['必需'],
                '必需': ['必须'],
                '反应': ['反映'],
                '反映': ['反应']
            }
        }
        
        self.suspicious_patterns = [
            r'[a-zA-Z]{2,}\s+[a-zA-Z]{2,}',
            r'[\u4e00-\u9fff]{1}[a-zA-Z]{1,}',
            r'[a-zA-Z]{1,}[\u4e00-\u9fff]{1}',
            r'\d+\s*[年月日时分秒]\s*\d+',
        ]

    def check_common_mistakes(self, text: str) -> List[Dict]:
        issues = []
        
        for category, mistakes in self.common_mistakes.items():
            for correct, wrong_list in mistakes.items():
                for wrong in wrong_list:
                    if wrong in text:
                        issues.append({
                            'type': 'typo_suspicious',
                            'original': wrong,
                            'expected': correct,
                            'category': category,
                            'needs_review': True,
                            'description': f'发现疑似错误："{wrong}"，可能应为 "{correct}"（{category}）',
                            'suggestion': f'请人工确认是否需要将 "{wrong}" 改为 "{correct}"'
                        })
        
        return issues

    def check_suspicious_patterns(self, text: str) -> List[Dict]:
        issues = []
        
        for pattern in self.suspicious_patterns:
            matches = re.findall(pattern, text)
            for match in matches:
                issues.append({
                    'type': 'typo_suspicious',
                    'original': match,
                    'expected': None,
                    'category': '格式异常',
                    'needs_review': True,
                    'description': f'发现可疑格式："{match}"',
                    'suggestion': '请人工检查此部分是否存在错误'
                })
        
        return issues

    def check(self, subtitles: List[SubtitleItem]) -> List[Dict]:
        issues = []
        
        for subtitle in subtitles:
            text = subtitle.text
            
            common_issues = self.check_common_mistakes(text)
            for ci in common_issues:
                issues.append({
                    **ci,
                    'subtitle_index': subtitle.index,
                    'start_time': subtitle.start_time,
                    'end_time': subtitle.end_time,
                    'original_text': subtitle.text
                })
            
            pattern_issues = self.check_suspicious_patterns(text)
            for pi in pattern_issues:
                issues.append({
                    **pi,
                    'subtitle_index': subtitle.index,
                    'start_time': subtitle.start_time,
                    'end_time': subtitle.end_time,
                    'original_text': subtitle.text
                })
        
        return issues
