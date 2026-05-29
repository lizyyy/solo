import re
from typing import List, Dict, Tuple, Optional
from pypinyin import pinyin, Style, lazy_pinyin
from dataclasses import dataclass, asdict
from datetime import datetime

@dataclass
class ReviewScenario:
    scenario_id: str
    scenario_type: str
    title: str
    description: str
    original_context: str
    detected_issue: str
    resolution_options: List[Dict]
    selected_resolution: Optional[str] = None
    resolved: bool = False
    notes: str = ""
    created_at: str = ""

class PolyphoneHandler:
    def __init__(self):
        self.common_polyphones = {
            '了': ['le', 'liǎo'],
            '着': ['zhe', 'zháo', 'zhuó'],
            '得': ['de', 'dé', 'děi'],
            '地': ['de', 'dì'],
            '的': ['de', 'dí', 'dì'],
            '和': ['hé', 'hè', 'huó', 'huò', 'hú'],
            '重': ['zhòng', 'chóng'],
            '行': ['xíng', 'háng'],
            '长': ['cháng', 'zhǎng'],
            '乐': ['lè', 'yuè'],
            '觉': ['jué', 'jiào'],
            '好': ['hǎo', 'hào'],
            '要': ['yào', 'yāo'],
            '会': ['huì', 'kuài'],
            '都': ['dōu', 'dū'],
            '还': ['hái', 'huán'],
            '为': ['wèi', 'wéi'],
            '发': ['fā', 'fà'],
            '当': ['dāng', 'dàng'],
            '什': ['shén', 'shí'],
            '只': ['zhǐ', 'zhī'],
            '结': ['jié', 'jiē'],
            '种': ['zhǒng', 'zhòng'],
            '相': ['xiāng', 'xiàng'],
            '过': ['guò', 'guō'],
        }
        
        self.review_scenarios = []
        self.scenario_counter = 0
    
    def find_polyphones(self, text: str) -> Dict:
        polyphone_positions = []
        
        lines = text.split('\n')
        for line_idx, line in enumerate(lines):
            for char_idx, char in enumerate(line):
                if char in self.common_polyphones:
                    readings = self.common_polyphones[char]
                    if len(readings) > 1:
                        context = self._get_context(line, char_idx)
                        polyphone_positions.append({
                            'char': char,
                            'line_index': line_idx,
                            'char_index': char_idx,
                            'context': context,
                            'possible_readings': readings,
                            'primary_reading': readings[0],
                            'reason': f"「{char}」为多音字，可能读音：{'/'.join(readings)}，影响韵脚判断",
                        })
        
        return {
            'polyphones': polyphone_positions,
            'total_count': len(polyphone_positions),
            'unique_chars': list(set(p['char'] for p in polyphone_positions)),
        }
    
    def analyze_mixed_language(self, text: str) -> Dict:
        chinese_pattern = re.compile(r'[\u4e00-\u9fff]')
        english_pattern = re.compile(r'[a-zA-Z]+')
        
        mixed_lines = []
        lines = text.split('\n')
        
        for line_idx, line in enumerate(lines):
            has_chinese = bool(chinese_pattern.search(line))
            has_english = bool(english_pattern.search(line))
            
            if has_chinese and has_english:
                english_words = english_pattern.findall(line)
                chinese_chars = chinese_pattern.findall(line)
                
                ratio = len(english_words) / max(1, len(chinese_chars))
                
                mixed_lines.append({
                    'line_index': line_idx,
                    'line': line.strip(),
                    'english_words': english_words,
                    'chinese_char_count': len(chinese_chars),
                    'english_word_count': len(english_words),
                    'mix_ratio': round(ratio, 2),
                    'impact_level': 'high' if ratio > 0.5 else 'medium' if ratio > 0.2 else 'low',
                    'reason': f"中英文混合，英文词{len(english_words)}个，汉字{len(chinese_chars)}个",
                })
        
        return {
            'mixed_lines': mixed_lines,
            'total_mixed_lines': len(mixed_lines),
            'summary': {
                'high_impact': sum(1 for m in mixed_lines if m['impact_level'] == 'high'),
                'medium_impact': sum(1 for m in mixed_lines if m['impact_level'] == 'medium'),
                'low_impact': sum(1 for m in mixed_lines if m['impact_level'] == 'low'),
            },
        }
    
    def create_chorus_review_scenario(self, 
                                       line_indices: List[int],
                                       original_lines: List[str],
                                       is_false_positive: bool = False,
                                       notes: str = "") -> ReviewScenario:
        self.scenario_counter += 1
        
        scenario = ReviewScenario(
            scenario_id=f"CHORUS-{self.scenario_counter:04d}",
            scenario_type="chorus_detection",
            title="副歌重复检测复核",
            description="检测到重复的行，可能是副歌（刻意重复）或误判",
            original_context="\n".join([f"L{i+1}: {line}" for i, line in zip(line_indices, original_lines)]),
            detected_issue=f"检测到{len(line_indices)}处重复的行",
            resolution_options=[
                {
                    'id': 'confirm_chorus',
                    'label': '确认是副歌',
                    'action': '标记为刻意重复，后续检测忽略',
                },
                {
                    'id': 'false_positive',
                    'label': '是误判',
                    'action': '标记为误判，调整检测算法',
                },
                {
                    'id': 'needs_edit',
                    'label': '需要修改',
                    'action': '建议作者调整，避免无意重复',
                },
            ],
            created_at=datetime.now().isoformat(),
        )
        
        if is_false_positive:
            scenario.selected_resolution = 'false_positive'
            scenario.resolved = True
        
        scenario.notes = notes
        self.review_scenarios.append(scenario)
        return scenario
    
    def create_polyphone_scenario(self,
                                   char: str,
                                   line: str,
                                   line_index: int,
                                   possible_readings: List[str],
                                   context: str = "") -> ReviewScenario:
        self.scenario_counter += 1
        
        scenario = ReviewScenario(
            scenario_id=f"POLY-{self.scenario_counter:04d}",
            scenario_type="polyphone",
            title=f"多音字「{char}」读音确认",
            description=f"多音字可能影响韵脚检测，需确认实际演唱发音",
            original_context=f"第{line_index+1}行: {line}\n上下文: {context}",
            detected_issue=f"「{char}」有{len(possible_readings)}种读音: {'/'.join(possible_readings)}",
            resolution_options=[
                {
                    'id': f'use_{reading}',
                    'label': f'使用读音: {reading}',
                    'action': f'韵脚检测将使用「{reading}」的韵母',
                }
                for reading in possible_readings
            ] + [
                {
                    'id': 'keep_default',
                    'label': '保持默认',
                    'action': '使用系统默认读音',
                },
            ],
            created_at=datetime.now().isoformat(),
        )
        
        self.review_scenarios.append(scenario)
        return scenario
    
    def create_mixed_language_scenario(self,
                                        line_index: int,
                                        line: str,
                                        english_words: List[str]) -> ReviewScenario:
        self.scenario_counter += 1
        
        scenario = ReviewScenario(
            scenario_id=f"MIXED-{self.scenario_counter:04d}",
            scenario_type="mixed_language",
            title="中英文混合处理",
            description="英文词可能影响字数统计和韵脚检测",
            original_context=f"第{line_index+1}行: {line}",
            detected_issue=f"包含英文词: {', '.join(english_words)}",
            resolution_options=[
                {
                    'id': 'count_as_syllable',
                    'label': '按音节计数',
                    'action': '英文词按音节数计入字数',
                },
                {
                    'id': 'count_as_word',
                    'label': '按单词计数',
                    'action': '每个英文词算1个字',
                },
                {
                    'id': 'ignore',
                    'label': '忽略英文',
                    'action': '统计时忽略英文词',
                },
            ],
            created_at=datetime.now().isoformat(),
        )
        
        self.review_scenarios.append(scenario)
        return scenario
    
    def generate_review_report(self) -> Dict:
        unresolved = [s for s in self.review_scenarios if not s.resolved]
        by_type = {}
        
        for s in self.review_scenarios:
            if s.scenario_type not in by_type:
                by_type[s.scenario_type] = []
            by_type[s.scenario_type].append(asdict(s))
        
        return {
            'total_scenarios': len(self.review_scenarios),
            'unresolved_count': len(unresolved),
            'resolved_count': len(self.review_scenarios) - len(unresolved),
            'by_type': {k: len(v) for k, v in by_type.items()},
            'scenarios': [asdict(s) for s in self.review_scenarios],
            'unresolved_scenarios': [asdict(s) for s in unresolved],
        }
    
    def resolve_scenario(self, scenario_id: str, resolution_id: str, notes: str = "") -> bool:
        for scenario in self.review_scenarios:
            if scenario.scenario_id == scenario_id:
                scenario.selected_resolution = resolution_id
                scenario.resolved = True
                scenario.notes = notes
                return True
        return False
    
    def _get_context(self, line: str, char_idx: int, window: int = 5) -> str:
        start = max(0, char_idx - window)
        end = min(len(line), char_idx + window + 1)
        return line[start:end]
    
    def analyze_all_scenarios(self, text: str) -> Dict:
        self.review_scenarios = []
        self.scenario_counter = 0
        
        polyphone_result = self.find_polyphones(text)
        for p in polyphone_result['polyphones']:
            self.create_polyphone_scenario(
                char=p['char'],
                line=p['context'],
                line_index=p['line_index'],
                possible_readings=p['possible_readings'],
            )
        
        mixed_result = self.analyze_mixed_language(text)
        for m in mixed_result['mixed_lines']:
            if m['impact_level'] in ['high', 'medium']:
                self.create_mixed_language_scenario(
                    line_index=m['line_index'],
                    line=m['line'],
                    english_words=m['english_words'],
                )
        
        return {
            'polyphones': polyphone_result,
            'mixed_language': mixed_result,
            'review_report': self.generate_review_report(),
        }
