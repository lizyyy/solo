import re
import jieba
from typing import List, Dict, Tuple, Optional
from collections import defaultdict, Counter

class RepetitionDetector:
    def __init__(self):
        self.chinese_pattern = re.compile(r'[\u4e00-\u9fff]+')
        self.english_pattern = re.compile(r'[a-zA-Z]+')
        
        self.chorus_markers = ['副歌', '合唱', 'chorus', 'Chorus', 'CHORUS', 'REFRAIN']
        self.verse_markers = ['主歌', 'verse', 'Verse', 'VERSE']
        self.intentional_tags = ['[repeat]', '[R]', '[重复]', '[刻意重复]']
        
        self.min_word_length = 2
        self.min_phrase_length = 4
    
    def detect_repeated_words(self, text: str, 
                               ignore_intentional: bool = True,
                               min_count: int = 3) -> Dict:
        all_words = []
        word_positions = defaultdict(list)
        intentional_repeats = set()
        
        lines = text.split('\n')
        for line_idx, line in enumerate(lines):
            for tag in self.intentional_tags:
                if tag in line:
                    clean_line = line.replace(tag, '')
                    words = list(jieba.cut(clean_line))
                    for w in words:
                        if len(w) >= self.min_word_length and self.chinese_pattern.match(w):
                            intentional_repeats.add(w)
                    break
            
            words = list(jieba.cut(line))
            for pos, word in enumerate(words):
                if len(word) >= self.min_word_length and self.chinese_pattern.match(word):
                    all_words.append(word)
                    word_positions[word].append({
                        'line': line_idx,
                        'position': pos,
                        'context': line.strip(),
                    })
        
        word_counts = Counter(all_words)
        
        repeated_words = []
        for word, count in word_counts.items():
            if count >= min_count:
                is_intentional = word in intentional_repeats
                if ignore_intentional and is_intentional:
                    continue
                
                repeated_words.append({
                    'word': word,
                    'count': count,
                    'positions': word_positions[word],
                    'is_intentional': is_intentional,
                    'reason': f"「{word}」出现{count}次" + 
                              ("（标记为刻意重复）" if is_intentional else ""),
                })
        
        repeated_words.sort(key=lambda x: x['count'], reverse=True)
        
        return {
            'repeated_words': repeated_words,
            'total_unique_words': len(word_counts),
            'total_repeated_words': len(repeated_words),
            'intentional_repeats': list(intentional_repeats),
        }
    
    def detect_repeated_phrases(self, lines: List[str], 
                                 min_phrase_len: int = 4,
                                 min_count: int = 2) -> Dict:
        phrase_positions = defaultdict(list)
        
        for line_idx, line in enumerate(lines):
            clean_line = self._clean_line(line)
            if len(clean_line) < min_phrase_len:
                continue
            
            for i in range(len(clean_line) - min_phrase_len + 1):
                for j in range(i + min_phrase_len, min(len(clean_line) + 1, i + 10)):
                    phrase = clean_line[i:j]
                    if self.chinese_pattern.search(phrase):
                        phrase_positions[phrase].append({
                            'line': line_idx,
                            'start_char': i,
                            'end_char': j,
                            'original_line': line.strip(),
                        })
        
        repeated_phrases = []
        for phrase, positions in phrase_positions.items():
            if len(positions) >= min_count:
                repeated_phrases.append({
                    'phrase': phrase,
                    'length': len(phrase),
                    'count': len(positions),
                    'positions': positions,
                    'reason': f"短语「{phrase}」在{len(positions)}处重复出现",
                })
        
        repeated_phrases.sort(key=lambda x: (x['length'], x['count']), reverse=True)
        
        return {
            'repeated_phrases': repeated_phrases[:20],
            'total_detected': len(repeated_phrases),
            'most_common': repeated_phrases[0] if repeated_phrases else None,
        }
    
    def detect_repeated_lines(self, lines: List[str], 
                               similarity_threshold: float = 0.8) -> Dict:
        line_groups = defaultdict(list)
        similarity_groups = []
        
        for line_idx, line in enumerate(lines):
            clean_line = self._clean_line(line)
            if not clean_line:
                continue
            
            line_groups[clean_line].append({
                'line_index': line_idx,
                'original_line': line.strip(),
            })
        
        exact_repeats = []
        for clean_line, positions in line_groups.items():
            if len(positions) > 1:
                exact_repeats.append({
                    'clean_line': clean_line,
                    'count': len(positions),
                    'positions': positions,
                    'is_chorus': self._is_likely_chorus(positions, lines),
                    'reason': f"完全相同的行出现{len(positions)}次" + 
                              ("（疑似副歌）" if self._is_likely_chorus(positions, lines) else ""),
                })
        
        for i, line1 in enumerate(lines):
            clean1 = self._clean_line(line1)
            if not clean1:
                continue
            for j in range(i + 1, len(lines)):
                clean2 = self._clean_line(lines[j])
                if not clean2:
                    continue
                
                similarity = self._calculate_similarity(clean1, clean2)
                if similarity >= similarity_threshold and clean1 != clean2:
                    similarity_groups.append({
                        'lines': [i, j],
                        'original_lines': [line1.strip(), lines[j].strip()],
                        'similarity': round(similarity, 2),
                        'reason': f"第{i+1}行与第{j+1}行相似度{round(similarity*100)}%，可能是刻意变化的重复",
                    })
        
        exact_repeats.sort(key=lambda x: x['count'], reverse=True)
        similarity_groups.sort(key=lambda x: x['similarity'], reverse=True)
        
        chorus_candidates = [r for r in exact_repeats if r['is_chorus']]
        
        return {
            'exact_repeats': exact_repeats,
            'similarity_repeats': similarity_groups[:10],
            'chorus_candidates': chorus_candidates,
            'summary': {
                'exact_repeat_groups': len(exact_repeats),
                'similarity_groups': len(similarity_groups),
                'chorus_candidates': len(chorus_candidates),
            },
        }
    
    def check_forbidden_words(self, text: str, forbidden_words: List[str]) -> Dict:
        found_forbidden = []
        for word in forbidden_words:
            positions = []
            lines = text.split('\n')
            for line_idx, line in enumerate(lines):
                if word in line:
                    positions.append({
                        'line': line_idx,
                        'context': line.strip(),
                    })
            if positions:
                found_forbidden.append({
                    'word': word,
                    'count': len(positions),
                    'positions': positions,
                    'reason': f"禁用词「{word}」出现在{len(positions)}行",
                })
        
        return {
            'found_forbidden': found_forbidden,
            'total_found': len(found_forbidden),
            'total_occurrences': sum(f['count'] for f in found_forbidden),
        }
    
    def _clean_line(self, line: str) -> str:
        line = re.sub(r'[^\w\u4e00-\u9fff]', '', line)
        for tag in self.intentional_tags:
            line = line.replace(tag, '')
        return line.strip()
    
    def _is_likely_chorus(self, positions: List[Dict], all_lines: List[str]) -> bool:
        if len(positions) < 2:
            return False
        
        line_indices = [p['line_index'] for p in positions]
        line_indices.sort()
        
        for i in range(len(line_indices) - 1):
            gap = line_indices[i + 1] - line_indices[i]
            if 4 <= gap <= 16:
                return True
        
        for idx in line_indices:
            for offset in range(max(0, idx - 3), min(len(all_lines), idx + 1)):
                for marker in self.chorus_markers:
                    if marker in all_lines[offset]:
                        return True
        
        return False
    
    def _calculate_similarity(self, s1: str, s2: str) -> float:
        if not s1 or not s2:
            return 0.0
        
        set1 = set(s1)
        set2 = set(s2)
        
        intersection = len(set1 & set2)
        union = len(set1 | set2)
        
        if union == 0:
            return 0.0
        
        return intersection / union
    
    def generate_repetition_report(self, text: str, 
                                    forbidden_words: Optional[List[str]] = None,
                                    check_chorus: bool = True) -> Dict:
        lines = text.split('\n')
        
        word_result = self.detect_repeated_words(text)
        phrase_result = self.detect_repeated_phrases(lines)
        line_result = self.detect_repeated_lines(lines)
        
        forbidden_result = None
        if forbidden_words:
            forbidden_result = self.check_forbidden_words(text, forbidden_words)
        
        issues = []
        
        for rw in word_result['repeated_words']:
            if not rw['is_intentional'] and rw['count'] >= 4:
                issues.append({
                    'type': 'word_repetition',
                    'severity': 'warning' if rw['count'] >= 5 else 'info',
                    'details': rw['reason'],
                    'word': rw['word'],
                    'suggestion': f"考虑替换「{rw['word']}」的部分用法，增加词汇多样性",
                })
        
        if line_result['chorus_candidates']:
            chorus_count = len(line_result['chorus_candidates'])
            issues.append({
                'type': 'chorus_detected',
                'severity': 'info',
                'details': f"检测到{chorus_count}组疑似副歌重复，请确认是否为创作意图",
            })
        
        if forbidden_result and forbidden_result['found_forbidden']:
            for fw in forbidden_result['found_forbidden']:
                issues.append({
                    'type': 'forbidden_word',
                    'severity': 'error',
                    'details': fw['reason'],
                    'word': fw['word'],
                    'suggestion': "建议替换该禁用词",
                })
        
        return {
            'word_repetition': word_result,
            'phrase_repetition': phrase_result,
            'line_repetition': line_result,
            'forbidden_words': forbidden_result,
            'issues': issues,
            'summary': {
                'repeated_words_count': len(word_result['repeated_words']),
                'repeated_phrases_count': phrase_result['total_detected'],
                'repeated_line_groups': line_result['summary']['exact_repeat_groups'],
                'issues_count': len(issues),
            },
        }
