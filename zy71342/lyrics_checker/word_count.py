import re
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass

@dataclass
class LineCount:
    line_index: int
    line: str
    total_chars: int
    chinese_chars: int
    english_words: int
    english_chars: int
    punctuation: int
    spaces: int
    char_breakdown: Dict[str, int]
    reason: str

class WordCounter:
    def __init__(self):
        self.chinese_pattern = re.compile(r'[\u4e00-\u9fff]')
        self.english_pattern = re.compile(r'[a-zA-Z]+')
        self.punctuation_pattern = re.compile(r'[^\w\s\u4e00-\u9fff]')
        self.space_pattern = re.compile(r'\s')
    
    def analyze_line(self, line: str, line_index: int = 0) -> LineCount:
        chinese_chars = len(self.chinese_pattern.findall(line))
        english_matches = self.english_pattern.findall(line)
        english_words = len(english_matches)
        english_chars = sum(len(word) for word in english_matches)
        punctuation = len(self.punctuation_pattern.findall(line))
        spaces = len(self.space_pattern.findall(line))
        total_chars = len(line)
        
        char_breakdown = {
            'chinese': chinese_chars,
            'english_letters': english_chars,
            'punctuation': punctuation,
            'spaces': spaces,
            'other': total_chars - (chinese_chars + english_chars + punctuation + spaces),
        }
        
        reason_parts = []
        if chinese_chars > 0:
            reason_parts.append(f"{chinese_chars}个汉字")
        if english_words > 0:
            reason_parts.append(f"{english_words}个英文词（共{english_chars}字母）")
        if punctuation > 0:
            reason_parts.append(f"{punctuation}个标点")
        
        reason = "该行包含" + "、".join(reason_parts) if reason_parts else "该行无有效字符"
        
        return LineCount(
            line_index=line_index,
            line=line,
            total_chars=total_chars,
            chinese_chars=chinese_chars,
            english_words=english_words,
            english_chars=english_chars,
            punctuation=punctuation,
            spaces=spaces,
            char_breakdown=char_breakdown,
            reason=reason,
        )
    
    def analyze_lines(self, lines: List[str]) -> Dict:
        line_counts = []
        for i, line in enumerate(lines):
            line_counts.append(self.analyze_line(line, i))
        
        total_chinese = sum(lc.chinese_chars for lc in line_counts)
        total_english_words = sum(lc.english_words for lc in line_counts)
        total_english_chars = sum(lc.english_chars for lc in line_counts)
        total_punctuation = sum(lc.punctuation for lc in line_counts)
        
        non_empty_lines = [lc for lc in line_counts if lc.total_chars > 0]
        avg_chinese_per_line = (total_chinese / len(non_empty_lines)) if non_empty_lines else 0
        
        line_lengths = [lc.chinese_chars for lc in line_counts if lc.chinese_chars > 0]
        length_variance = self._calculate_variance(line_lengths) if line_lengths else 0
        
        issues = []
        if length_variance > 50:
            issues.append({
                'type': 'line_length_inconsistent',
                'severity': 'warning',
                'details': f"各行字数差异较大（方差{length_variance:.1f}），可能影响演唱节奏",
            })
        
        for lc in line_counts:
            if lc.english_words > 0 and lc.chinese_chars > 0:
                ratio = lc.english_words / max(1, lc.chinese_chars)
                if ratio > 0.3:
                    issues.append({
                        'type': 'mixed_language',
                        'severity': 'info',
                        'line_index': lc.line_index,
                        'line': lc.line,
                        'details': f"第{lc.line_index + 1}行中英文混合比例较高（{lc.english_words}英文词/{lc.chinese_chars}汉字）",
                    })
        
        return {
            'line_counts': [self._linecount_to_dict(lc) for lc in line_counts],
            'summary': {
                'total_lines': len(lines),
                'non_empty_lines': len(non_empty_lines),
                'total_chinese_chars': total_chinese,
                'total_english_words': total_english_words,
                'total_english_chars': total_english_chars,
                'total_punctuation': total_punctuation,
                'avg_chinese_per_line': round(avg_chinese_per_line, 1),
                'line_length_variance': round(length_variance, 1),
                'max_chars_per_line': max((lc.chinese_chars for lc in line_counts), default=0),
                'min_chars_per_line': min((lc.chinese_chars for lc in line_counts if lc.chinese_chars > 0), default=0),
            },
            'issues': issues,
        }
    
    def analyze_paragraphs(self, paragraphs: List[List[str]]) -> Dict:
        paragraph_stats = []
        for p_idx, para in enumerate(paragraphs):
            para_result = self.analyze_lines(para)
            paragraph_stats.append({
                'paragraph_index': p_idx,
                'line_count': len(para),
                'stats': para_result['summary'],
                'issues': para_result['issues'],
            })
        
        return {
            'paragraphs': paragraph_stats,
            'total_paragraphs': len(paragraphs),
            'overall': self._get_overall_stats(paragraph_stats),
        }
    
    def check_line_length_consistency(self, lines: List[str], 
                                       target_length: Optional[int] = None,
                                       tolerance: int = 2) -> Dict:
        line_counts = [self.analyze_line(line, i) for i, line in enumerate(lines)]
        valid_lines = [lc for lc in line_counts if lc.chinese_chars > 0]
        
        if not valid_lines:
            return {'consistent': True, 'issues': [], 'reason': '无有效内容行'}
        
        if target_length is None:
            target_length = round(sum(lc.chinese_chars for lc in valid_lines) / len(valid_lines))
        
        issues = []
        for lc in valid_lines:
            diff = abs(lc.chinese_chars - target_length)
            if diff > tolerance:
                issues.append({
                    'line_index': lc.line_index,
                    'line': lc.line,
                    'actual': lc.chinese_chars,
                    'target': target_length,
                    'diff': diff,
                    'details': f"第{lc.line_index + 1}行{lc.chinese_chars}字，与目标{target_length}字相差{diff}字",
                })
        
        consistent = len(issues) == 0
        reason = f"以{target_length}字为基准，容差±{tolerance}字，"
        reason += "所有行数符合要求" if consistent else f"发现{len(issues)}处不一致"
        
        return {
            'target_length': target_length,
            'tolerance': tolerance,
            'consistent': consistent,
            'issues': issues,
            'reason': reason,
        }
    
    def _calculate_variance(self, numbers: List[int]) -> float:
        if not numbers:
            return 0.0
        mean = sum(numbers) / len(numbers)
        variance = sum((x - mean) ** 2 for x in numbers) / len(numbers)
        return variance
    
    def _linecount_to_dict(self, lc: LineCount) -> Dict:
        return {
            'line_index': lc.line_index,
            'line': lc.line,
            'total_chars': lc.total_chars,
            'chinese_chars': lc.chinese_chars,
            'english_words': lc.english_words,
            'english_chars': lc.english_chars,
            'punctuation': lc.punctuation,
            'spaces': lc.spaces,
            'char_breakdown': lc.char_breakdown,
            'reason': lc.reason,
        }
    
    def _get_overall_stats(self, paragraph_stats: List[Dict]) -> Dict:
        if not paragraph_stats:
            return {}
        return {
            'total_lines': sum(p['stats']['total_lines'] for p in paragraph_stats),
            'total_chinese_chars': sum(p['stats']['total_chinese_chars'] for p in paragraph_stats),
            'total_english_words': sum(p['stats']['total_english_words'] for p in paragraph_stats),
        }
