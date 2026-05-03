# 规则引擎模块
# 负责敏感词检测、说话人权限检查、风险标记和风险片段管理

import re
import uuid
from datetime import datetime
from typing import List, Dict, Tuple, Optional, Set, Pattern
from collections import defaultdict

from .models import (
    SubtitleEntry,
    Speaker,
    SensitiveWord,
    RiskMarker,
    RiskFragment,
    RiskLevel,
    RiskType,
    SpeakerPermission,
    ReviewStatus
)


class PatternMatcher:
    """正则表达式模式匹配器"""
    
    # 预定义的正则表达式模式
    PATTERNS = {
        # 身份证号（18位或15位）
        'PERSONAL_ID': re.compile(
            r'\b[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b|'
            r'\b[1-9]\d{5}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}\b'
        ),
        # 手机号（中国大陆）
        'PHONE': re.compile(
            r'\b1[3-9]\d{9}\b|'
            r'\b\+?86[-\s]?1[3-9]\d{9}\b|'
            r'\b\(86\)[-\s]?1[3-9]\d{9}\b'
        ),
        # 邮箱地址
        'EMAIL': re.compile(
            r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        ),
        # 地址模式（简单版）
        'ADDRESS': re.compile(
            r'(?:北京|上海|广州|深圳|杭州|南京|武汉|成都|重庆|天津|西安|苏州|长沙|郑州|东莞|青岛|合肥|佛山|宁波|昆明|无锡|大连|沈阳|厦门|济南|福州|温州|南宁|长春|泉州|石家庄|贵阳|南昌|金华|常州|珠海|惠州|嘉兴|南通|徐州|太原|中山|保定|兰州|台州|乌鲁木齐|绍兴|烟台|潍坊|临沂|淄博|赣州|九江|襄阳|南阳|宜昌|大庆|岳阳|常德|芜湖|沧州|株洲|连云港|赤峰|湖州|柳州|新乡|绵阳|菏泽|商丘|驻马店|邯郸|宝鸡|咸阳|榆林|齐齐哈尔|衡阳|益阳|平顶山|安阳|开封|焦作|许昌|漯河|濮阳|三门峡|南阳|商丘|信阳|周口|驻马店|济源|荆州|黄石|十堰|宜昌|襄阳|鄂州|荆门|孝感|黄冈|咸宁|随州|恩施|仙桃|潜江|天门|神农架|长沙|株洲|湘潭|衡阳|邵阳|岳阳|常德|张家界|益阳|郴州|永州|怀化|娄底|湘西|广州|韶关|深圳|珠海|汕头|佛山|江门|湛江|茂名|肇庆|惠州|梅州|汕尾|河源|阳江|清远|东莞|中山|潮州|揭阳|云浮|南宁|柳州|桂林|梧州|北海|防城港|钦州|贵港|玉林|百色|贺州|河池|来宾|崇左|海口|三亚|三沙|儋州|五指山|琼海|文昌|万宁|东方|定安|屯昌|澄迈|临高|白沙|昌江|乐东|陵水|保亭|琼中|重庆|成都|自贡|攀枝花|泸州|德阳|绵阳|广元|遂宁|内江|乐山|南充|眉山|宜宾|广安|达州|雅安|巴中|资阳|阿坝|甘孜|凉山|贵阳|六盘水|遵义|安顺|毕节|铜仁|黔西南|黔东南|黔南|昆明|曲靖|玉溪|保山|昭通|丽江|普洱|临沧|楚雄|红河|文山|西双版纳|大理|德宏|怒江|迪庆|拉萨|日喀则|昌都|林芝|山南|那曲|阿里|西安|铜川|宝鸡|咸阳|渭南|延安|汉中|榆林|安康|商洛|兰州|嘉峪关|金昌|白银|天水|武威|张掖|平凉|酒泉|庆阳|定西|陇南|临夏|甘南|西宁|海东|海北|黄南|海南|果洛|玉树|海西|银川|石嘴山|吴忠|固原|中卫|乌鲁木齐|克拉玛依|吐鲁番|哈密|昌吉|博尔塔拉|巴音郭楞|阿克苏|克孜勒苏|喀什|和田|伊犁|塔城|阿勒泰|石河子|阿拉尔|图木舒克|五家渠|北屯|铁门关|双河|可克达拉|昆玉|胡杨河|新星)[市区县旗乡镇街道村路巷胡同弄号楼单元层室]{1,5}(?:[0-9]{1,5}[号号楼单元层室]{0,3})?'
        ),
    }
    
    @classmethod
    def get_pattern(cls, pattern_name: str) -> Optional[Pattern]:
        """获取预定义的正则表达式模式"""
        return cls.PATTERNS.get(pattern_name)
    
    @classmethod
    def find_all_matches(cls, text: str, pattern_name: str) -> List[Tuple[int, int, str]]:
        """
        在文本中查找所有匹配项
        
        Returns:
            List[(start_index, end_index, matched_text)]
        """
        pattern = cls.get_pattern(pattern_name)
        if not pattern:
            return []
        
        matches = []
        for match in pattern.finditer(text):
            matches.append((match.start(), match.end(), match.group()))
        
        return matches


class SensitiveWordDetector:
    """敏感词检测器"""
    
    def __init__(self, sensitive_words: List[SensitiveWord]):
        self.sensitive_words = sensitive_words
        self._literal_words: Dict[str, SensitiveWord] = {}
        self._pattern_words: List[SensitiveWord] = []
        self._compiled_patterns: Dict[str, Pattern] = {}
        
        # 初始化索引
        self._build_index()
    
    def _build_index(self):
        """构建敏感词索引"""
        for word in self.sensitive_words:
            if word.is_pattern:
                self._pattern_words.append(word)
                try:
                    self._compiled_patterns[word.word] = re.compile(word.word)
                except re.error:
                    # 无效的正则表达式，跳过
                    pass
            else:
                self._literal_words[word.word] = word
    
    def detect(self, text: str) -> List[Tuple[int, int, SensitiveWord, str]]:
        """
        检测文本中的敏感词
        
        Args:
            text: 要检测的文本
            
        Returns:
            List[(start_index, end_index, sensitive_word, matched_text)]
        """
        detections = []
        detected_ranges: Set[Tuple[int, int]] = set()
        
        # 检测字面敏感词
        for word_text, sensitive_word in self._literal_words.items():
            start = 0
            while True:
                idx = text.find(word_text, start)
                if idx == -1:
                    break
                
                end = idx + len(word_text)
                # 检查是否已被包含在其他检测范围内
                if not self._is_range_overlapping((idx, end), detected_ranges):
                    detections.append((idx, end, sensitive_word, word_text))
                    detected_ranges.add((idx, end))
                
                start = end
        
        # 检测正则表达式敏感词
        for sensitive_word in self._pattern_words:
            pattern = self._compiled_patterns.get(sensitive_word.word)
            if not pattern:
                continue
            
            for match in pattern.finditer(text):
                idx = match.start()
                end = match.end()
                matched_text = match.group()
                
                if not self._is_range_overlapping((idx, end), detected_ranges):
                    detections.append((idx, end, sensitive_word, matched_text))
                    detected_ranges.add((idx, end))
        
        # 按起始位置排序
        detections.sort(key=lambda x: x[0])
        
        return detections
    
    def _is_range_overlapping(self, new_range: Tuple[int, int], 
                                existing_ranges: Set[Tuple[int, int]]) -> bool:
        """检查新范围是否与现有范围重叠"""
        new_start, new_end = new_range
        for (start, end) in existing_ranges:
            if (new_start < end and new_end > start):
                return True
        return False


class SpeakerAuthorityChecker:
    """说话人权限检查器"""
    
    def __init__(self, speakers: List[Speaker]):
        self.speakers = speakers
        self._speaker_index: Dict[str, Speaker] = {}
        self._alias_index: Dict[str, Speaker] = {}
        
        self._build_index()
    
    def _build_index(self):
        """构建说话人索引"""
        for speaker in self.speakers:
            self._speaker_index[speaker.name] = speaker
            # 添加别名索引
            for alias in speaker.alias:
                self._alias_index[alias] = speaker
    
    def get_speaker(self, name: str) -> Optional[Speaker]:
        """根据名称获取说话人信息"""
        # 先查主名
        if name in self._speaker_index:
            return self._speaker_index[name]
        
        # 再查别名
        if name in self._alias_index:
            return self._alias_index[name]
        
        # 模糊匹配
        for speaker in self.speakers:
            if name in speaker.name or speaker.name in name:
                return speaker
        
        return None
    
    def check_permission(self, speaker_name: Optional[str]) -> SpeakerPermission:
        """检查说话人权限"""
        if not speaker_name:
            return SpeakerPermission.NO_AUTHORIZATION
        
        speaker = self.get_speaker(speaker_name)
        if not speaker:
            return SpeakerPermission.NO_AUTHORIZATION
        
        return speaker.permission
    
    def is_authorized(self, speaker_name: Optional[str]) -> bool:
        """检查说话人是否已授权"""
        permission = self.check_permission(speaker_name)
        return permission == SpeakerPermission.FULL_AUTHORIZATION
    
    def is_partially_authorized(self, speaker_name: Optional[str]) -> bool:
        """检查说话人是否部分授权"""
        permission = self.check_permission(speaker_name)
        return permission == SpeakerPermission.PARTIAL_AUTHORIZATION
    
    def check_speaker_name_in_text(self, text: str) -> List[Tuple[int, int, Speaker, str]]:
        """
        检查文本中是否包含未授权说话人的姓名
        
        Returns:
            List[(start_index, end_index, speaker, matched_name)]
        """
        detections = []
        detected_ranges: Set[Tuple[int, int]] = set()
        
        # 检查所有说话人的名字和别名
        for speaker in self.speakers:
            # 跳过完全授权的说话人
            if speaker.permission == SpeakerPermission.FULL_AUTHORIZATION:
                continue
            
            names_to_check = [speaker.name] + speaker.alias
            
            for name in names_to_check:
                if len(name) < 2:
                    continue  # 跳过太短的名字
                
                start = 0
                while True:
                    idx = text.find(name, start)
                    if idx == -1:
                        break
                    
                    end = idx + len(name)
                    
                    # 检查是否已被检测
                    range_key = (idx, end)
                    if range_key not in detected_ranges:
                        detections.append((idx, end, speaker, name))
                        detected_ranges.add(range_key)
                    
                    start = end
        
        # 按起始位置排序
        detections.sort(key=lambda x: x[0])
        
        return detections


class PatternDetector:
    """模式检测器（检测身份证、手机号、邮箱等）"""
    
    @staticmethod
    def detect_personal_id(text: str) -> List[Tuple[int, int, str]]:
        """检测身份证号"""
        return PatternMatcher.find_all_matches(text, 'PERSONAL_ID')
    
    @staticmethod
    def detect_phone(text: str) -> List[Tuple[int, int, str]]:
        """检测手机号"""
        return PatternMatcher.find_all_matches(text, 'PHONE')
    
    @staticmethod
    def detect_email(text: str) -> List[Tuple[int, int, str]]:
        """检测邮箱"""
        return PatternMatcher.find_all_matches(text, 'EMAIL')
    
    @staticmethod
    def detect_address(text: str) -> List[Tuple[int, int, str]]:
        """检测地址信息"""
        return PatternMatcher.find_all_matches(text, 'ADDRESS')
    
    @classmethod
    def detect_all(cls, text: str) -> List[Tuple[int, int, RiskType, str]]:
        """
        检测所有模式
        
        Returns:
            List[(start_index, end_index, risk_type, matched_text)]
        """
        detections = []
        
        # 身份证号
        for start, end, text_match in cls.detect_personal_id(text):
            detections.append((start, end, RiskType.PERSONAL_ID, text_match))
        
        # 手机号
        for start, end, text_match in cls.detect_phone(text):
            detections.append((start, end, RiskType.PHONE, text_match))
        
        # 邮箱
        for start, end, text_match in cls.detect_email(text):
            detections.append((start, end, RiskType.EMAIL, text_match))
        
        # 地址（可选，可能误报率较高）
        for start, end, text_match in cls.detect_address(text):
            detections.append((start, end, RiskType.ADDRESS, text_match))
        
        # 去重（按起始位置）
        detections = list({d[0]: d for d in detections}.values())
        detections.sort(key=lambda x: x[0])
        
        return detections


class RiskMarkingEngine:
    """风险标记引擎"""
    
    def __init__(self, 
                 sensitive_words: List[SensitiveWord],
                 speakers: List[Speaker]):
        self.sensitive_detector = SensitiveWordDetector(sensitive_words)
        self.speaker_checker = SpeakerAuthorityChecker(speakers)
        self.pattern_detector = PatternDetector()
    
    def analyze_subtitle(self, subtitle: SubtitleEntry) -> List[RiskMarker]:
        """
        分析单个字幕，生成风险标记
        
        Args:
            subtitle: 字幕条目
            
        Returns:
            风险标记列表
        """
        markers: List[RiskMarker] = []
        text = subtitle.text
        
        # 1. 检测敏感词
        for start, end, sensitive_word, matched_text in self.sensitive_detector.detect(text):
            marker = self._create_risk_marker(
                subtitle_id=subtitle.id,
                start_index=start,
                end_index=end,
                risk_text=matched_text,
                risk_type=sensitive_word.category,
                risk_level=sensitive_word.level,
                suggested_replacement=sensitive_word.replacement
            )
            markers.append(marker)
        
        # 2. 检测未授权说话人姓名
        for start, end, speaker, matched_name in self.speaker_checker.check_speaker_name_in_text(text):
            # 确定风险等级
            if speaker.permission == SpeakerPermission.NO_AUTHORIZATION:
                risk_level = RiskLevel.CRITICAL
            else:  # PARTIAL_AUTHORIZATION
                risk_level = RiskLevel.HIGH
            
            marker = self._create_risk_marker(
                subtitle_id=subtitle.id,
                start_index=start,
                end_index=end,
                risk_text=matched_name,
                risk_type=RiskType.UNAUTHORIZED_NAME,
                risk_level=risk_level,
                suggested_replacement="[说话人已脱敏]"
            )
            markers.append(marker)
        
        # 3. 检测模式（身份证、手机号、邮箱等）
        for start, end, risk_type, matched_text in self.pattern_detector.detect_all(text):
            # 确定风险等级和替换文本
            risk_level = RiskLevel.HIGH
            replacement = self._get_default_replacement(risk_type)
            
            marker = self._create_risk_marker(
                subtitle_id=subtitle.id,
                start_index=start,
                end_index=end,
                risk_text=matched_text,
                risk_type=risk_type,
                risk_level=risk_level,
                suggested_replacement=replacement
            )
            markers.append(marker)
        
        # 按起始位置排序
        markers.sort(key=lambda m: m.start_index)
        
        return markers
    
    def analyze_all_subtitles(self, subtitles: List[SubtitleEntry]) -> List[RiskMarker]:
        """
        分析所有字幕
        
        Returns:
            所有风险标记列表
        """
        all_markers = []
        for subtitle in subtitles:
            markers = self.analyze_subtitle(subtitle)
            all_markers.extend(markers)
        
        return all_markers
    
    def create_risk_fragments(self, 
                               markers: List[RiskMarker],
                               subtitles: List[SubtitleEntry],
                               merge_threshold: float = 2.0) -> List[RiskFragment]:
        """
        从风险标记创建风险片段
        
        Args:
            markers: 风险标记列表
            subtitles: 字幕列表（用于获取时间信息）
            merge_threshold: 合并阈值（秒），距离小于此值的相邻片段会被合并
            
        Returns:
            风险片段列表
        """
        if not markers:
            return []
        
        # 按字幕ID分组
        markers_by_subtitle: Dict[int, List[RiskMarker]] = defaultdict(list)
        for marker in markers:
            markers_by_subtitle[marker.subtitle_id].append(marker)
        
        # 构建字幕ID到字幕的映射
        subtitle_map = {s.id: s for s in subtitles}
        
        # 为每个有风险标记的字幕创建初始片段
        fragments: List[RiskFragment] = []
        for subtitle_id, subtitle_markers in markers_by_subtitle.items():
            subtitle = subtitle_map.get(subtitle_id)
            if not subtitle:
                continue
            
            fragment = self._create_risk_fragment(
                subtitle_ids=[subtitle_id],
                start_time=subtitle.start_time,
                end_time=subtitle.end_time,
                risk_markers=subtitle_markers
            )
            fragments.append(fragment)
        
        # 按时间排序
        fragments.sort(key=lambda f: f.start_time)
        
        # 合并相邻片段
        merged_fragments = self._merge_adjacent_fragments(fragments, merge_threshold)
        
        return merged_fragments
    
    def _create_risk_marker(self,
                            subtitle_id: int,
                            start_index: int,
                            end_index: int,
                            risk_text: str,
                            risk_type: RiskType,
                            risk_level: RiskLevel,
                            suggested_replacement: str) -> RiskMarker:
        """创建风险标记"""
        marker_id = str(uuid.uuid4())[:8]
        
        return RiskMarker(
            id=f"rm_{marker_id}",
            subtitle_id=subtitle_id,
            start_index=start_index,
            end_index=end_index,
            risk_text=risk_text,
            risk_type=risk_type,
            risk_level=risk_level,
            suggested_replacement=suggested_replacement,
            review_status=ReviewStatus.PENDING
        )
    
    def _create_risk_fragment(self,
                              subtitle_ids: List[int],
                              start_time: float,
                              end_time: float,
                              risk_markers: List[RiskMarker]) -> RiskFragment:
        """创建风险片段"""
        fragment_id = str(uuid.uuid4())[:8]
        
        return RiskFragment(
            id=f"rf_{fragment_id}",
            subtitle_ids=subtitle_ids,
            start_time=start_time,
            end_time=end_time,
            risk_markers=risk_markers,
            review_status=ReviewStatus.PENDING
        )
    
    def _merge_adjacent_fragments(self,
                                   fragments: List[RiskFragment],
                                   threshold: float) -> List[RiskFragment]:
        """合并相邻的风险片段"""
        if len(fragments) <= 1:
            return fragments
        
        merged = [fragments[0]]
        
        for fragment in fragments[1:]:
            last = merged[-1]
            
            # 检查是否可以合并
            # 条件：前一个片段的结束时间与当前片段的开始时间间隔小于阈值
            time_gap = fragment.start_time - last.end_time
            
            if time_gap <= threshold:
                # 合并
                new_fragment = RiskFragment(
                    id=f"rf_{str(uuid.uuid4())[:8]}",
                    subtitle_ids=last.subtitle_ids + fragment.subtitle_ids,
                    start_time=last.start_time,
                    end_time=fragment.end_time,
                    risk_markers=last.risk_markers + fragment.risk_markers,
                    review_status=ReviewStatus.PENDING,
                    merged=True,
                    merged_from=[last.id, fragment.id]
                )
                merged[-1] = new_fragment
            else:
                merged.append(fragment)
        
        return merged
    
    def _get_default_replacement(self, risk_type: RiskType) -> str:
        """获取默认替换文本"""
        replacements = {
            RiskType.PERSONAL_ID: "[身份证号已脱敏]",
            RiskType.PHONE: "[手机号已脱敏]",
            RiskType.EMAIL: "[邮箱已脱敏]",
            RiskType.ADDRESS: "[地址已脱敏]",
            RiskType.UNAUTHORIZED_NAME: "[姓名已脱敏]",
            RiskType.SENSITIVE_WORD: "[已脱敏]",
            RiskType.COMPANY: "[公司已脱敏]",
            RiskType.OTHER: "[已脱敏]",
        }
        return replacements.get(risk_type, "[已脱敏]")


class RiskReviewer:
    """风险复核器"""
    
    @staticmethod
    def approve(marker: RiskMarker, reviewer: str = "用户", notes: str = ""):
        """批准风险标记（接受脱敏建议）"""
        marker.review_status = ReviewStatus.APPROVED
        marker.reviewed_by = reviewer
        marker.reviewed_at = datetime.now()
        marker.reviewer_notes = notes
    
    @staticmethod
    def reject(marker: RiskMarker, reviewer: str = "用户", notes: str = ""):
        """驳回风险标记（认为不是风险）"""
        marker.review_status = ReviewStatus.REJECTED
        marker.reviewed_by = reviewer
        marker.reviewed_at = datetime.now()
        marker.reviewer_notes = notes
    
    @staticmethod
    def modify(marker: RiskMarker, custom_replacement: str, 
               reviewer: str = "用户", notes: str = ""):
        """修改风险标记（使用自定义替换文本）"""
        marker.review_status = ReviewStatus.MODIFIED
        marker.custom_replacement = custom_replacement
        marker.reviewed_by = reviewer
        marker.reviewed_at = datetime.now()
        marker.reviewer_notes = notes
    
    @staticmethod
    def approve_fragment(fragment: RiskFragment, reviewer: str = "用户", notes: str = ""):
        """批准整个风险片段"""
        fragment.review_status = ReviewStatus.APPROVED
        fragment.notes = notes
        for marker in fragment.risk_markers:
            RiskReviewer.approve(marker, reviewer, notes)
    
    @staticmethod
    def reject_fragment(fragment: RiskFragment, reviewer: str = "用户", notes: str = ""):
        """驳回整个风险片段"""
        fragment.review_status = ReviewStatus.REJECTED
        fragment.notes = notes
        for marker in fragment.risk_markers:
            RiskReviewer.reject(marker, reviewer, notes)


class RuleEngine:
    """规则引擎主类"""
    
    def __init__(self,
                 sensitive_words: List[SensitiveWord],
                 speakers: List[Speaker]):
        self.marking_engine = RiskMarkingEngine(sensitive_words, speakers)
        self.reviewer = RiskReviewer()
    
    def analyze(self, subtitles: List[SubtitleEntry]) -> Tuple[List[RiskMarker], List[RiskFragment]]:
        """
        完整分析字幕，生成风险标记和片段
        
        Args:
            subtitles: 字幕列表
            
        Returns:
            (风险标记列表, 风险片段列表)
        """
        markers = self.marking_engine.analyze_all_subtitles(subtitles)
        fragments = self.marking_engine.create_risk_fragments(markers, subtitles)
        
        return markers, fragments
    
    def get_statistics(self, markers: List[RiskMarker]) -> Dict:
        """获取风险统计"""
        stats = {
            'total': len(markers),
            'by_level': defaultdict(int),
            'by_type': defaultdict(int),
            'by_status': defaultdict(int),
        }
        
        for marker in markers:
            stats['by_level'][marker.risk_level.value] += 1
            stats['by_type'][marker.risk_type.value] += 1
            stats['by_status'][marker.review_status.value] += 1
        
        return dict(stats)
