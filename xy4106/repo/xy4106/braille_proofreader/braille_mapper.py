import re
from typing import Dict, List, Tuple, Optional


class BrailleMapper:
    """汉字拼音转盲文点位映射器 - 现行盲文6点制
    
    盲文点位编号（6点制）：
      1  4
      2  5
      3  6
    """
    
    INITIALS_MAP = {
        'b': '12',
        'p': '1234',
        'm': '134',
        'f': '124',
        'd': '145',
        't': '2345',
        'n': '1345',
        'l': '123',
        'g': '12345',
        'k': '13',
        'h': '125',
        'j': '1245',
        'q': '13',
        'x': '1345',
        'zh': '123456',
        'ch': '1234',
        'sh': '156',
        'r': '245',
        'z': '1356',
        'c': '14',
        's': '234',
        'y': '13456',
        'w': '1236',
        '': ''
    }
    
    FINALS_MAP = {
        'a': '356',
        'o': '136',
        'e': '26',
        'i': '24',
        'u': '136',
        'ü': '346',
        'ai': '246',
        'ei': '2346',
        'ui': '245',
        'ao': '235',
        'ou': '1235',
        'iu': '1256',
        'ie': '15',
        'üe': '146',
        'er': '12456',
        'an': '12356',
        'en': '356',
        'in': '126',
        'un': '25',
        'ün': '456',
        'ang': '236',
        'eng': '1246',
        'ing': '1456',
        'ong': '256',
        'ia': '136',
        'ie': '15',
        'iao': '345',
        'iou': '1256',
        'ian': '146',
        'in': '126',
        'iang': '1346',
        'ing': '1456',
        'ua': '136',
        'uo': '136',
        'uai': '246',
        'uei': '245',
        'uan': '1256',
        'uen': '25',
        'uang': '236',
        'ueng': '256',
        'ong': '256',
        'iong': '1256',
        '': ''
    }
    
    TONE_MAP = {
        1: '',
        2: '23',
        3: '2',
        4: '3',
        0: ''
    }
    
    PUNCTUATION_MAP = {
        '，': '2',
        '。': '3',
        '、': '4',
        '：': '36',
        '；': '56',
        '？': '236',
        '！': '235',
        '“': '236',
        '”': '356',
        '‘': '6',
        '’': '3',
        '（': '126',
        '）': '345',
        '【': '12356',
        '】': '23456',
        '《': '126',
        '》': '345',
        '—': '6',
        '…': '25',
        '·': '5',
    }
    
    NUMBER_PREFIX = '3456'
    
    NUMBERS_MAP = {
        '0': '3456',
        '1': '1',
        '2': '12',
        '3': '14',
        '4': '145',
        '5': '15',
        '6': '124',
        '7': '1245',
        '8': '125',
        '9': '24',
    }
    
    LETTER_PREFIX = '456'
    
    def __init__(self):
        self._cache = {}
    
    def _is_chinese_char(self, char: str) -> bool:
        """判断是否是中文字符"""
        if not char:
            return False
        code = ord(char)
        return '\u4e00' <= char <= '\u9fff' or \
               '\u3400' <= char <= '\u4dbf' or \
               '\uf900' <= char <= '\ufaff'
    
    def map_text(self, text: str, pinyin: str = '') -> str:
        """将文本转换为盲文点位
        
        Args:
            text: 中文文本
            pinyin: 对应拼音（可选）
        
        Returns:
            盲文点位字符串，用空格分隔
        """
        if not text:
            return ''
        
        if text in self._cache:
            return self._cache[text]
        
        braille_parts = []
        pinyin_list = self._split_pinyin(pinyin) if pinyin else []
        
        i = 0
        char_index = 0
        
        while i < len(text):
            char = text[i]
            
            if char in self.PUNCTUATION_MAP:
                braille_parts.append(self.PUNCTUATION_MAP[char])
                i += 1
                continue
            
            if char.isdigit():
                braille_parts.append(self.NUMBER_PREFIX)
                while i < len(text) and text[i].isdigit():
                    if text[i] in self.NUMBERS_MAP:
                        braille_parts.append(self.NUMBERS_MAP[text[i]])
                    i += 1
                continue
            
            if char.isalpha():
                braille_parts.append(self.LETTER_PREFIX)
                while i < len(text) and text[i].isalpha():
                    letter = text[i].lower()
                    letter_dot = self._letter_to_dot(letter)
                    braille_parts.append(letter_dot)
                    i += 1
                continue
            
            if self._is_chinese_char(char):
                current_pinyin = ''
                if char_index < len(pinyin_list):
                    current_pinyin = pinyin_list[char_index]
                
                char_braille = self._char_to_braille(char, current_pinyin)
                braille_parts.append(char_braille)
                
                i += 1
                char_index += 1
                continue
            
            if char.isspace():
                braille_parts.append('0')
                i += 1
                continue
            
            braille_parts.append('0')
            i += 1
        
        result = ' '.join(braille_parts)
        self._cache[text] = result
        return result
    
    def _split_pinyin(self, pinyin_text: str) -> List[str]:
        """将拼音字符串分割为单个拼音"""
        if not pinyin_text:
            return []
        
        pinyin_text = pinyin_text.replace('，', ' ').replace('。', ' ')
        parts = re.split(r'[\s\u3000]+', pinyin_text.strip())
        
        result = []
        for part in parts:
            if part:
                cleaned = self._remove_tone_marks(part)
                if cleaned:
                    result.append(cleaned)
        
        return result
    
    def _remove_tone_marks(self, pinyin: str) -> str:
        """移除拼音中的声调标记"""
        tone_map = {
            'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a',
            'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e',
            'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i',
            'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o',
            'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u',
            'ǖ': 'ü', 'ǘ': 'ü', 'ǚ': 'ü', 'ǜ': 'ü',
        }
        
        result = pinyin
        for marked, replaced in tone_map.items():
            result = result.replace(marked, replaced)
        
        if result and result[-1].isdigit():
            return result[:-1]
        return result
    
    def _char_to_braille(self, char: str, pinyin: str) -> str:
        """将单个汉字转换为盲文点位"""
        if not pinyin:
            return self._char_to_default_braille(char)
        
        initial, final = self._split_initial_final(pinyin)
        
        initial_dot = self.INITIALS_MAP.get(initial, '')
        final_dot = self.FINALS_MAP.get(final, '')
        
        if initial_dot and final_dot:
            if initial == final:
                return initial_dot
            return f'{initial_dot} {final_dot}'
        elif initial_dot:
            return initial_dot
        elif final_dot:
            return final_dot
        else:
            return self._char_to_default_braille(char)
    
    def _split_initial_final(self, pinyin: str) -> Tuple[str, str]:
        """拆分声母和韵母"""
        if not pinyin:
            return '', ''
        
        initials = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l',
                   'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w']
        
        for initial in sorted(initials, key=len, reverse=True):
            if pinyin.startswith(initial):
                final = pinyin[len(initial):]
                if not final:
                    return initial, ''
                return initial, final
        
        if pinyin in self.FINALS_MAP:
            return '', pinyin
        
        if len(pinyin) == 1:
            return '', pinyin
        
        return '', pinyin
    
    def _char_to_default_braille(self, char: str) -> str:
        """无拼音时的默认盲文映射"""
        if not char:
            return '0'
        
        code = ord(char)
        dot_numbers = []
        
        temp = code
        for i in range(6):
            if temp & (1 << i):
                dot_numbers.append(str(i + 1))
        
        if not dot_numbers:
            return '0'
        
        return ''.join(sorted(dot_numbers, key=lambda x: int(x)))
    
    def _letter_to_dot(self, letter: str) -> str:
        """英文字母转盲文点位"""
        letter_map = {
            'a': '1', 'b': '12', 'c': '14', 'd': '145', 'e': '15',
            'f': '124', 'g': '1245', 'h': '125', 'i': '24', 'j': '245',
            'k': '13', 'l': '123', 'm': '134', 'n': '1345', 'o': '135',
            'p': '1234', 'q': '12345', 'r': '1235', 's': '234', 't': '2345',
            'u': '136', 'v': '1236', 'w': '2456', 'x': '1346', 'y': '13456', 'z': '1356'
        }
        return letter_map.get(letter.lower(), '0')
    
    def get_braille_character_count(self, braille_text: str) -> int:
        """计算盲文点位的字符数（每部分为一个盲文方）"""
        if not braille_text:
            return 0
        parts = braille_text.split()
        return len(parts)
    
    def pinyin_to_braille(self, pinyin: str) -> str:
        """直接将拼音转换为盲文点位"""
        initial, final = self._split_initial_final(pinyin)
        
        initial_dot = self.INITIALS_MAP.get(initial, '')
        final_dot = self.FINALS_MAP.get(final, '')
        
        if initial_dot and final_dot:
            return f'{initial_dot} {final_dot}'
        elif initial_dot:
            return initial_dot
        elif final_dot:
            return final_dot
        return '0'
