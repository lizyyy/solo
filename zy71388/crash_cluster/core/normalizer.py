import re
from typing import List, Tuple
from difflib import SequenceMatcher


class StackNormalizer:
    OBFUSCATED_PATTERNS = [
        re.compile(r'^[a-z]$'),
        re.compile(r'^[a-z]\d$'),
        re.compile(r'^_[a-z]\d*$'),
        re.compile(r'^[a-z]{1,2}\d{2,}$'),
        re.compile(r'^0x[0-9a-fA-F]+$'),
        re.compile(r'^lt{1,3}$'),
        re.compile(r'^l[a-z]{0,2}\d*$'),
        re.compile(r'^m[a-z]?$'),
    ]

    MEANINGFUL_SEGMENTS = {
        'com', 'org', 'net', 'io', 'app', 'myapp', 'ui', 'api',
        'android', 'java', 'javax', 'kotlin', 'swift', 'objc',
        'view', 'model', 'data', 'util', 'core', 'base', 'main',
    }

    ADDR_PATTERN = re.compile(r'\s+0x[0-9a-fA-F]+\s*')
    LINE_NUM_PATTERN = re.compile(r':\d+(:\d+)?$')
    GENERIC_OFFSET = re.compile(r'\+\d+$')
    SYSTEM_FRAMES = {
        'objc_msgSend', '_main', 'start', '_start',
        'UIApplicationMain', 'NSApplicationMain',
        'CFRunLoopRunSpecific', '__CFRunLoopRun',
        '__pthread_start', '_pthread_start',
        'thread_start', '_thread_start',
        'java.lang.Thread.run', 'dalvik.system.NativeStart.run',
    }

    def __init__(self, top_n: int = 8, similarity_threshold: float = 0.7):
        self.top_n = top_n
        self.similarity_threshold = similarity_threshold

    def normalize_frame(self, frame: str) -> Tuple[str, bool]:
        frame = frame.strip()
        if not frame:
            return "", False

        is_obfuscated = False
        frame = self.ADDR_PATTERN.sub(' ', frame)
        frame = self.GENERIC_OFFSET.sub('', frame)
        frame = self.LINE_NUM_PATTERN.sub('', frame)
        frame = frame.strip()

        symbol = self._extract_symbol(frame)
        is_obfuscated = self._is_obfuscated(symbol)
        if is_obfuscated:
            symbol = '<OBFUSCATED>'

        return symbol, is_obfuscated

    def _is_obfuscated(self, symbol: str) -> bool:
        if not symbol:
            return False
        if '.' in symbol:
            segments = symbol.split('.')
            has_meaningful = any(
                len(s) > 3 or s.lower() in self.MEANINGFUL_SEGMENTS
                for s in segments
            )
            if has_meaningful:
                return False
            short_segments = [s for s in segments if s]
            if all(len(s) <= 2 for s in short_segments):
                return True
            return False
        for pat in self.OBFUSCATED_PATTERNS:
            if pat.match(symbol):
                return True
        if len(symbol) <= 2 and symbol.isalpha() and symbol.islower():
            return True
        return False

    def _extract_symbol(self, frame: str) -> str:
        java_match = re.match(r'at\s+(\S+)', frame)
        if java_match:
            return java_match.group(1).split('(')[0]

        if '(' in frame and ')' in frame:
            before_paren = frame[:frame.index('(')].strip()
            if before_paren and re.search(r'[a-zA-Z]', before_paren):
                return before_paren
            inner = frame[frame.index('(') + 1:frame.index(')')].strip()
            if inner and not inner.startswith('0x'):
                return inner

        parts = frame.split()
        meaningful = [p for p in parts if re.search(r'[a-zA-Z._]', p) and not re.match(r'^0x', p)]
        if meaningful:
            return meaningful[0]

        return frame.strip()

    def normalize_stack(self, stack_trace: str) -> Tuple[str, bool, List[str]]:
        if not stack_trace:
            return "", False, []

        lines = stack_trace.strip().split('\n')
        normalized_frames = []
        is_obfuscated = False
        obfuscated_frames = []

        for line in lines:
            line = line.strip()
            if not line or line.startswith('#') and len(line) < 3:
                continue
            cleaned = re.sub(r'^#\d+\s*', '', line)
            symbol, obf = self.normalize_frame(cleaned)
            if symbol and symbol not in self.SYSTEM_FRAMES:
                normalized_frames.append(symbol)
                if obf:
                    is_obfuscated = True
                    obfuscated_frames.append(symbol)

        deduped = []
        seen = set()
        for f in normalized_frames:
            if f not in seen:
                seen.add(f)
                deduped.append(f)

        normalized = ' <- '.join(deduped[:self.top_n])
        return normalized, is_obfuscated, obfuscated_frames

    def fingerprint(self, normalized_stack: str) -> str:
        if not normalized_stack:
            return ""
        frames = normalized_stack.split(' <- ')
        key_frames = [f for f in frames[:5] if f != '<OBFUSCATED>']
        return '|'.join(key_frames) if key_frames else '|'.join(frames[:3])

    def similarity(self, norm_a: str, norm_b: str) -> float:
        if not norm_a or not norm_b:
            return 0.0
        return SequenceMatcher(None, norm_a, norm_b).ratio()

    def is_similar(self, norm_a: str, norm_b: str) -> bool:
        return self.similarity(norm_a, norm_b) >= self.similarity_threshold
