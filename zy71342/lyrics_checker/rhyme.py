import re
from typing import List, Dict, Tuple, Optional
from pypinyin import pinyin, Style, lazy_pinyin

class RhymeChecker:
    def __init__(self):
        self.final_groups = {
            'a': ['a', 'ia', 'ua'],
            'o': ['o', 'uo', 'io'],
            'e': ['e', 'ie', 'üe', 'ue'],
            'ai': ['ai', 'uai'],
            'ei': ['ei', 'ui', 'uei'],
            'ao': ['ao', 'iao'],
            'ou': ['ou', 'iu', 'iou'],
            'an': ['an', 'ian', 'uan', 'üan'],
            'en': ['en', 'in', 'un', 'ün', 'uen'],
            'ang': ['ang', 'iang', 'uang'],
            'eng': ['eng', 'ing', 'ong', 'iong', 'ueng'],
            'er': ['er'],
            'i': ['i'],
            'u': ['u'],
            'v': ['ü', 'v'],
        }
        
        self._build_final_lookup()
    
    def _build_final_lookup(self):
        self.final_lookup = {}
        for group, finals in self.final_groups.items():
            for final in finals:
                self.final_lookup[final] = group
    
    def extract_final(self, pinyin_str: str) -> str:
        pinyin_str = pinyin_str.lower().strip()
        
        if not pinyin_str:
            return ''
        
        pinyin_str = re.sub(r'[1-5]', '', pinyin_str)
        
        if pinyin_str in self.final_lookup:
            return self.final_lookup[pinyin_str]
        
        for final in sorted(self.final_lookup.keys(), key=len, reverse=True):
            if pinyin_str.endswith(final):
                return self.final_lookup[final]
        
        vowels = 'aeiouüv'
        vowel_part = ''.join([c for c in pinyin_str if c in vowels])
        if vowel_part:
            return vowel_part
        
        return pinyin_str
    
    def get_pinyin_and_final(self, char: str) -> Tuple[List[str], List[str]]:
        try:
            pinyin_results = pinyin(char, style=Style.NORMAL, heteronym=True)
            all_pinyins = []
            all_finals = []
            
            for py_list in pinyin_results:
                for py in py_list:
                    if py not in all_pinyins:
                        all_pinyins.append(py)
                        final = self.extract_final(py)
                        if final not in all_finals:
                            all_finals.append(final)
            
            return all_pinyins, all_finals
        except Exception:
            return [char], [char]
    
    def get_line_final(self, line: str) -> Dict:
        line = line.strip()
        if not line:
            return {
                'line': line,
                'primary_final': None,
                'possible_finals': [],
                'pinyin_details': [],
                'reason': '空行，无韵脚',
            }
        
        chinese_chars = re.findall(r'[\u4e00-\u9fff]', line)
        if not chinese_chars:
            return {
                'line': line,
                'primary_final': None,
                'possible_finals': [],
                'pinyin_details': [],
                'reason': '无中文字符，无法检测韵脚',
            }
        
        last_char = chinese_chars[-1]
        pinyins, finals = self.get_pinyin_and_final(last_char)
        
        details = []
        for i, (py, final) in enumerate(zip(pinyins, finals)):
            details.append({
                'char': last_char,
                'pinyin': py,
                'final': final,
                'is_heteronym': len(pinyins) > 1,
            })
        
        primary_final = finals[0] if finals else None
        
        reason = f"以「{last_char}」结尾"
        if len(pinyins) > 1:
            reason += f"，该字为多音字（{'/'.join(pinyins)}）"
        reason += f"，主韵脚「{primary_final}」"
        
        return {
            'line': line,
            'primary_final': primary_final,
            'possible_finals': finals,
            'pinyin_details': details,
            'last_char': last_char,
            'reason': reason,
        }
    
    def check_rhyme_scheme(self, lines: List[str], scheme_type: str = 'aabb') -> Dict:
        line_finals = [self.get_line_final(line) for line in lines]
        
        rhyme_pairs = []
        issues = []
        
        if scheme_type == 'aabb':
            for i in range(0, len(line_finals) - 1, 2):
                if i + 1 >= len(line_finals):
                    break
                line1 = line_finals[i]
                line2 = line_finals[i + 1]
                
                is_rhyming, match_type, reason = self._compare_finals(line1, line2)
                rhyme_pairs.append({
                    'pair_index': (i, i + 1),
                    'lines': [line1['line'], line2['line']],
                    'is_rhyming': is_rhyming,
                    'match_type': match_type,
                    'finals': [line1['primary_final'], line2['primary_final']],
                    'reason': reason,
                })
                if not is_rhyming:
                    issues.append({
                        'type': 'rhyme_mismatch',
                        'lines': (i, i + 1),
                        'details': reason,
                    })
        
        elif scheme_type == 'abab':
            for i in range(0, len(line_finals) - 3, 4):
                for offset in [0, 1]:
                    if i + offset + 2 >= len(line_finals):
                        continue
                    line1 = line_finals[i + offset]
                    line2 = line_finals[i + offset + 2]
                    
                    is_rhyming, match_type, reason = self._compare_finals(line1, line2)
                    rhyme_pairs.append({
                        'pair_index': (i + offset, i + offset + 2),
                        'lines': [line1['line'], line2['line']],
                        'is_rhyming': is_rhyming,
                        'match_type': match_type,
                        'finals': [line1['primary_final'], line2['primary_final']],
                        'reason': reason,
                    })
                    if not is_rhyming:
                        issues.append({
                            'type': 'rhyme_mismatch',
                            'lines': (i + offset, i + offset + 2),
                            'details': reason,
                        })
        
        return {
            'scheme_type': scheme_type,
            'line_finals': line_finals,
            'rhyme_pairs': rhyme_pairs,
            'issues': issues,
            'summary': {
                'total_pairs': len(rhyme_pairs),
                'rhyming_pairs': sum(1 for p in rhyme_pairs if p['is_rhyming']),
                'issues_count': len(issues),
            },
        }
    
    def _compare_finals(self, line1: Dict, line2: Dict) -> Tuple[bool, str, str]:
        f1 = line1.get('primary_final')
        f2 = line2.get('primary_final')
        possible1 = line1.get('possible_finals', [])
        possible2 = line2.get('possible_finals', [])
        
        if not f1 or not f2:
            return False, 'no_final', '缺少可比较的韵脚'
        
        if f1 == f2:
            return True, 'exact', f"韵脚完全匹配（{f1}）"
        
        for pf1 in possible1:
            for pf2 in possible2:
                if pf1 == pf2:
                    return True, 'heteronym_match', f"通过多音字匹配韵脚（{pf1}），需注意演唱发音"
        
        return False, 'mismatch', f"韵脚不匹配（{f1} vs {f2}）"
    
    def find_rhyme_groups(self, lines: List[str]) -> Dict:
        line_finals = [self.get_line_final(line) for line in lines]
        
        groups = {}
        for i, lf in enumerate(line_finals):
            final = lf['primary_final']
            if final:
                if final not in groups:
                    groups[final] = []
                groups[final].append({
                    'line_index': i,
                    'line': lf['line'],
                    'last_char': lf.get('last_char', ''),
                })
        
        sorted_groups = sorted(
            [{'final': k, 'lines': v} for k, v in groups.items()],
            key=lambda x: len(x['lines']),
            reverse=True
        )
        
        return {
            'groups': sorted_groups,
            'most_common': sorted_groups[0] if sorted_groups else None,
            'total_unique_finals': len(groups),
        }
