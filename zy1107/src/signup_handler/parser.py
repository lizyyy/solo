import re
from typing import List, Optional, Tuple
from decimal import Decimal
from .models import RegistrationRecord


class ChatParser:
    TIME_SLOT_PATTERNS = [
        (r'周六(?:上|下)午', '周六上午' if '上' in r'\g<0>' else '周六下午'),
        (r'周日(?:上|下)午', '周日上午' if '上' in r'\g<0>' else '周日下午'),
        (r'周六', '周六上午'),
        (r'周日', '周日上午'),
        (r'周末', '周六上午'),
    ]
    
    DIETARY_PATTERNS = [
        (r'不[吃能](?:花生|海鲜|牛肉|羊肉|猪肉|鸡蛋|牛奶|辣|鱼|虾|蟹|芒果|菠萝)', 'allergy'),
        (r'过敏', 'allergy'),
        (r'素食|吃素', 'vegetarian'),
        (r'忌口', 'restriction'),
    ]
    
    def __init__(self):
        self.phone_pattern = re.compile(
            r'(?:1[3-9]\d)(?:\D{0,3}\d){8}',
            re.UNICODE
        )
        
        self.sequence_pattern = re.compile(
            r'^(\d+)[\.、\s:：]+',
            re.MULTILINE
        )
        
        self.people_pattern = re.compile(
            r'(\d+)\s*(?:大|成人|大人|家长)[\s+]*(\d+)?\s*(?:小|小孩|孩子|儿童|娃)?',
            re.UNICODE
        )
        
        self.total_people_pattern = re.compile(
            r'(?:共|一共|报名|参加)[\s：:]*(\d+)\s*(?:人|位|个)',
            re.UNICODE
        )
        
        self.child_pattern = re.compile(
            r'(\d+)\s*(?:小|小孩|孩子|儿童|娃)',
            re.UNICODE
        )
        
        self.amount_pattern = re.compile(
            r'(?:转账|付款|支付|红包|已付|转了)[\s：:]*[￥¥]?(\d+(?:\.\d{1,2})?)',
            re.UNICODE
        )
        
        self.screenshot_pattern = re.compile(
            r'(?:截图|图片|照片|已发|发了)[\s]*[图片]',
            re.UNICODE
        )

    def parse(self, content: str, source_file: str = "chat.txt") -> List[RegistrationRecord]:
        lines = content.split('\n')
        records = []
        
        current_record = None
        current_line_num = 0
        
        for line_num, line in enumerate(lines, 1):
            line = line.strip()
            
            if not line:
                if current_record:
                    records.append(current_record)
                    current_record = None
                continue
            
            is_new_record = self._is_new_record(line)
            
            if is_new_record:
                if current_record:
                    records.append(current_record)
                
                current_record = self._parse_line(line, line_num, source_file)
                current_line_num = line_num
            else:
                if current_record:
                    self._append_to_record(current_record, line, line_num)
        
        if current_record:
            records.append(current_record)
        
        return records

    def _is_new_record(self, line: str) -> bool:
        match = self.sequence_pattern.match(line)
        if match:
            return True
        
        if re.match(r'^[\w\u4e00-\u9fff]{2,}(?:\+|和|与)[\w\u4e00-\u9fff]{2,}', line):
            if any(kw in line for kw in ['报名', '参加', '周六', '周日', '下午', '上午']):
                return True
        
        if re.search(r'1[3-9]\d{9}', line) and len(line) > 20:
            if any(kw in line for kw in ['报名', '参加', '人', '大', '小', '转账', '付款']):
                return True
        
        return False

    def _parse_line(self, line: str, line_num: int, source_file: str) -> RegistrationRecord:
        record = RegistrationRecord(
            raw_line=line,
            line_number=line_num,
            source_file=source_file
        )
        
        seq_match = self.sequence_pattern.match(line)
        if seq_match:
            record.sequence_number = int(seq_match.group(1))
            remaining = line[seq_match.end():].strip()
        else:
            remaining = line
        
        self._extract_phones(record, remaining)
        self._extract_people_counts(record, remaining)
        self._extract_time_slots(record, remaining)
        self._extract_dietary_restrictions(record, remaining)
        self._extract_payment_info(record, remaining)
        self._extract_names(record, remaining)
        self._extract_notes(record, remaining)
        
        return record

    def _extract_phones(self, record: RegistrationRecord, text: str) -> None:
        phones = self.phone_pattern.findall(text)
        if phones:
            phone = phones[0]
            clean_phone = re.sub(r'\D', '', phone)
            if len(clean_phone) == 11:
                record.phone = clean_phone
            else:
                record.phone = clean_phone
                record.parse_warnings.append(f"手机号位数异常: {clean_phone}")

    def _extract_people_counts(self, record: RegistrationRecord, text: str) -> None:
        people_match = self.people_pattern.search(text)
        if people_match:
            adults = int(people_match.group(1))
            children = int(people_match.group(2)) if people_match.group(2) else 0
            record.adult_count = adults
            record.child_count = children
            record.total_people = adults + children
            return
        
        child_matches = self.child_pattern.findall(text)
        if child_matches:
            record.child_count = sum(int(c) for c in child_matches)
        
        total_match = self.total_people_pattern.search(text)
        if total_match:
            record.total_people = int(total_match.group(1))
            if record.child_count and record.total_people >= record.child_count:
                record.adult_count = record.total_people - record.child_count
            return
        
        single_pattern = re.compile(r'(?:报名|参加)[\s：:]*(\d+)(?!\s*[人位个大小时孩子童娃])')
        single_match = single_pattern.search(text)
        if single_match and '大' not in text and '小' not in text:
            record.total_people = int(single_match.group(1))
            record.adult_count = record.total_people
            return
        
        if record.total_people == 0:
            if '夫妻' in text or '夫妇' in text:
                record.total_people = 2
                record.adult_count = 2
            elif '一家' in text or '全家' in text:
                record.total_people = 3
                record.adult_count = 2
                record.child_count = 1
                record.parse_warnings.append("使用默认家庭人数(2大1小)，请核对")
            else:
                record.total_people = 1
                record.adult_count = 1
                record.parse_warnings.append("未明确说明人数，默认按1人计算")

    def _extract_time_slots(self, record: RegistrationRecord, text: str) -> None:
        slots = []
        
        if '周六上午' in text or '周六早上' in text:
            slots.append('周六上午')
        elif '周六下午' in text:
            slots.append('周六下午')
        elif '周日上午' in text or '周日早上' in text:
            slots.append('周日上午')
        elif '周日下午' in text:
            slots.append('周日下午')
        elif '周六' in text:
            slots.append('周六上午')
            record.parse_warnings.append("未明确时段，默认周六上午")
        elif '周日' in text:
            slots.append('周日上午')
            record.parse_warnings.append("未明确时段，默认周日上午")
        
        record.time_slots = slots if slots else ['周六上午']
        if not slots:
            record.parse_warnings.append("未指定时段，默认周六上午")

    def _extract_dietary_restrictions(self, record: RegistrationRecord, text: str) -> None:
        restrictions = []
        
        allergy_items = ['花生', '海鲜', '牛肉', '羊肉', '猪肉', '鸡蛋', '牛奶', '辣', '鱼', '虾', '蟹', '芒果', '菠萝', '坚果', '大豆', '小麦']
        
        for item in allergy_items:
            if f'不吃{item}' in text or f'不能吃{item}' in text or f'对{item}过敏' in text:
                restrictions.append(f'忌口{item}')
        
        if '素食' in text or '吃素' in text:
            restrictions.append('素食')
        
        if '忌口' in text:
            if not restrictions:
                record.parse_warnings.append("提及忌口但未说明具体内容")
        
        record.dietary_restrictions = restrictions

    def _extract_payment_info(self, record: RegistrationRecord, text: str) -> None:
        if '已转账' in text or '已付款' in text or '已支付' in text or '已发红包' in text:
            pass
        
        amount_match = self.amount_pattern.search(text)
        if amount_match:
            try:
                record.payment_amount = Decimal(amount_match.group(1))
            except:
                pass
        
        if '截图' in text or '图片' in text:
            record.has_payment_screenshot = True

    def _extract_names(self, record: RegistrationRecord, text: str) -> None:
        text_to_parse = text
        
        seq_match = self.sequence_pattern.match(text)
        if seq_match:
            text_to_parse = text[seq_match.end():].strip()
        
        text_to_parse = re.sub(r'1[3-9]\d{9}', '', text_to_parse)
        text_to_parse = re.sub(r'\d+\s*[大小时孩子童娃人位个家长成人]{1,3}', '', text_to_parse)
        text_to_parse = re.sub(r'[￥¥]?\d+\.\d{1,2}', '', text_to_parse)
        text_to_parse = re.sub(r'周六|周日|上午|下午|早上', '', text_to_parse)
        text_to_parse = re.sub(r'转账|付款|支付|红包|截图|图片', '', text_to_parse)
        text_to_parse = re.sub(r'报名|参加|忌口|过敏|不能吃', '', text_to_parse)
        text_to_parse = re.sub(r'夫妻|全家|一家|朋友|家人', '', text_to_parse)
        text_to_parse = re.sub(r'花生|海鲜|牛肉|羊肉|猪肉|鸡蛋|牛奶|辣|鱼|虾|蟹|芒果|菠萝|坚果|大豆|小麦', '', text_to_parse)
        text_to_parse = re.sub(r'[，。、；：""''（）\s]+', ' ', text_to_parse).strip()
        
        plus_match = re.match(r'([\w\u4e00-\u9fff]{2,})\s*[\+＋]\s*([\w\u4e00-\u9fff]{2,})', text_to_parse)
        if plus_match:
            record.group_nickname = f"{plus_match.group(1)}+{plus_match.group(2)}"
            record.real_name = plus_match.group(1)
            return
        
        first_token_match = re.match(r'^[\u4e00-\u9fff]{2,4}', text_to_parse)
        if first_token_match:
            first_name = first_token_match.group(0).strip()
            if first_name and len(first_name) >= 2:
                if re.match(r'^[\u4e00-\u9fff]{2,4}$', first_name):
                    record.real_name = first_name
                    record.group_nickname = first_name
                    return
        
        name_match = re.search(r'^[\u4e00-\u9fff]{2,4}(?:[\s,，、]*[\u4e00-\u9fff]{2,4})*', text_to_parse)
        if name_match:
            possible_name = name_match.group(0).strip()
            if possible_name and len(possible_name) >= 2:
                if not any(kw in possible_name for kw in ['报名', '参加', '周六', '周日', '上午', '下午', '不能吃', '忌口', '过敏']):
                    record.group_nickname = possible_name
                    if len(possible_name) <= 4 and re.match(r'^[\u4e00-\u9fff]+$', possible_name):
                        record.real_name = possible_name

    def _extract_notes(self, record: RegistrationRecord, text: str) -> None:
        notes = []
        
        text_to_extract = text
        seq_match = self.sequence_pattern.match(text)
        if seq_match:
            text_to_extract = text[seq_match.end():].strip()
        
        if '备注' in text_to_extract:
            note_match = re.search(r'备注[：:：]\s*(.*?)(?:$|\n)', text_to_extract)
            if note_match:
                notes.append(note_match.group(1).strip())
        
        if '手机号写在后面' in text_to_extract or '电话写在后面' in text_to_extract:
            notes.append("手机号已标注在报名信息后")
        
        if '朋友' in text_to_extract and '+' in text_to_extract:
            notes.append("携带朋友一同参加")
        
        record.notes = notes

    def _append_to_record(self, record: RegistrationRecord, line: str, line_num: int) -> None:
        record.raw_line += '\n' + line
        
        if not record.phone:
            self._extract_phones(record, line)
        
        if record.total_people == 1 and '大' in line or '小' in line:
            self._extract_people_counts(record, line)
        
        if not record.time_slots or record.time_slots == ['周六上午']:
            self._extract_time_slots(record, line)
        
        if not record.payment_amount or not record.has_payment_screenshot:
            self._extract_payment_info(record, line)
        
        if not record.dietary_restrictions:
            self._extract_dietary_restrictions(record, line)
