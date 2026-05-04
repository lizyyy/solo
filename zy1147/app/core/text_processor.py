import re
import string
from typing import List, Dict, Any, Tuple
import jieba
import pypinyin
from pypinyin import Style


class TextProcessor:
    
    _punctuation_map = {
        '！': '!', '？': '?', '，': ',', '。': '.', '：': ':', '；': ';',
        '＂': '"', '＂': '"', '＂': '"', '＂': '"',
        '＇': "'", '＇': "'", '＇': "'", '＇': "'",
        '（': '(', '）': ')', '［': '[', '］': ']', '｛': '{', '｝': '}',
        '【': '[', '】': ']', '《': '<', '》': '>',
        '＋': '+', '－': '-', '×': '*', '÷': '/',
        '＝': '=', '≠': '!=', '＜': '<', '＞': '>',
        '≤': '<=', '≥': '>=',
        '＠': '@', '＃': '#', '＄': '$', '％': '%',
        '＾': '^', '＆': '&', '＊': '*', '＿': '_',
    }
    
    _homophone_map = {
        '赌': ['堵', '睹', '赌'],
        '博': ['搏', '薄', '伯'],
        '色': ['涩', '瑟'],
        '情': ['晴', '清'],
        '钱': ['前', '乾'],
        '贷': ['代', '袋'],
        '款': ['宽', '髋'],
        '骗': ['片', '偏'],
        '诈': ['炸', '榨'],
        '毒': ['独', '读'],
        '品': ['贫', '频'],
        '枪': ['腔', '呛'],
        '支': ['知', '之', '只'],
        '弹': ['谈', '谭', '潭'],
        '药': ['要', '耀'],
        '丸': ['完', '玩'],
    }
    
    def __init__(self, user_dict_path: str = None):
        if user_dict_path:
            jieba.load_userdict(user_dict_path)
        self._init_jieba()
    
    def _init_jieba(self):
        custom_words = [
            '客服', '运营', '审核', '敏感词', '白名单', '黑名单',
            '赌博', '色情', '诈骗', '毒品', '枪支', '暴力',
            '银行卡', '支付宝', '微信', '转账', '汇款',
        ]
        for word in custom_words:
            jieba.add_word(word)
    
    def normalize(self, text: str) -> str:
        if not text:
            return ''
        
        result = text
        
        result = self._full_to_half(result)
        
        result = result.lower()
        
        result = self._remove_inserted_chars(result)
        
        result = self._normalize_punctuation(result)
        
        result = self._remove_extra_spaces(result)
        
        return result
    
    def _full_to_half(self, text: str) -> str:
        result = []
        for char in text:
            code = ord(char)
            if code == 12288:
                result.append(' ')
            elif 65281 <= code <= 65374:
                result.append(chr(code - 65248))
            else:
                result.append(char)
        return ''.join(result)
    
    def _remove_inserted_chars(self, text: str) -> str:
        patterns = [
            r'([a-zA-Z\u4e00-\u9fff])[_\-\.\*\~\+\|\^\\\/\#\@\%\&\=]{1,3}([a-zA-Z\u4e00-\u9fff])',
            r'([a-zA-Z\u4e00-\u9fff])\s{1,2}([a-zA-Z\u4e00-\u9fff])',
        ]
        
        result = text
        for pattern in patterns:
            result = re.sub(pattern, r'\1\2', result)
        
        return result
    
    def _normalize_punctuation(self, text: str) -> str:
        result = text
        for full, half in self._punctuation_map.items():
            result = result.replace(full, half)
        return result
    
    def _remove_extra_spaces(self, text: str) -> str:
        result = re.sub(r'\s+', ' ', text)
        return result.strip()
    
    def segment(self, text: str, use_search: bool = False) -> List[Dict[str, Any]]:
        if not text:
            return []
        
        segments = []
        
        if use_search:
            words = jieba.lcut_for_search(text)
        else:
            words = jieba.lcut(text)
        
        pos = 0
        for word in words:
            if not word or word.isspace():
                pos += len(word)
                continue
            
            start_pos = text.find(word, pos)
            if start_pos == -1:
                start_pos = pos
            
            end_pos = start_pos + len(word)
            pos = end_pos
            
            segments.append({
                'word': word,
                'start': start_pos,
                'end': end_pos,
                'length': len(word)
            })
        
        return segments
    
    def to_pinyin(self, text: str, style: str = 'normal') -> str:
        if not text:
            return ''
        
        if style == 'tone':
            pinyin_list = pypinyin.lazy_pinyin(text, style=Style.TONE)
        elif style == 'initial':
            pinyin_list = pypinyin.lazy_pinyin(text, style=Style.FIRST_LETTER)
        else:
            pinyin_list = pypinyin.lazy_pinyin(text, style=Style.NORMAL)
        
        return ''.join(pinyin_list)
    
    def generate_variants(self, text: str) -> List[Dict[str, Any]]:
        variants = []
        
        normalized = self.normalize(text)
        if normalized != text:
            variants.append({
                'variant': normalized,
                'type': 'normalized',
                'original': text
            })
        
        pinyin = self.to_pinyin(text)
        variants.append({
            'variant': pinyin,
            'type': 'pinyin',
            'original': text
        })
        
        initials = self.to_pinyin(text, style='initial')
        if initials != pinyin:
            variants.append({
                'variant': initials,
                'type': 'pinyin_initial',
                'original': text
            })
        
        homophone_variants = self._generate_homophone_variants(text)
        for var in homophone_variants:
            variants.append({
                'variant': var,
                'type': 'homophone',
                'original': text
            })
        
        spaced_variant = self._generate_spaced_variant(text)
        if spaced_variant != text:
            variants.append({
                'variant': spaced_variant,
                'type': 'spaced',
                'original': text
            })
        
        return variants
    
    def _generate_homophone_variants(self, text: str) -> List[str]:
        variants = []
        
        for i, char in enumerate(text):
            if char in self._homophone_map:
                for replacement in self._homophone_map[char]:
                    if replacement != char:
                        variant = text[:i] + replacement + text[i+1:]
                        variants.append(variant)
        
        return list(set(variants))
    
    def _generate_spaced_variant(self, text: str) -> str:
        return ' '.join(text)
    
    def extract_context(self, text: str, start: int, end: int, context_length: int = 20) -> Tuple[str, str]:
        before_start = max(0, start - context_length)
        context_before = text[before_start:start]
        
        after_end = min(len(text), end + context_length)
        context_after = text[end:after_end]
        
        return context_before, context_after
    
    def process_for_detection(self, text: str) -> Dict[str, Any]:
        normalized = self.normalize(text)
        segments = self.segment(text)
        pinyin = self.to_pinyin(normalized)
        
        return {
            'original': text,
            'normalized': normalized,
            'segments': segments,
            'pinyin': pinyin,
            'length': len(text)
        }
