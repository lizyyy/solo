import re
from typing import List, Tuple
from config import PHONE_PATTERN


class DesensitizationChecker:
    def __init__(self):
        self.phone_pattern = re.compile(PHONE_PATTERN)

    def mask_phone(self, phone: str) -> str:
        if len(phone) == 11:
            return phone[:3] + '****' + phone[7:]
        return phone[:3] + '****'

    def check_text(self, text: str) -> Tuple[bool, List[str], str]:
        found_phones = self.phone_pattern.findall(text)
        if not found_phones:
            return True, [], text

        masked_text = text
        for phone in found_phones:
            masked_text = masked_text.replace(phone, self.mask_phone(phone))

        return False, found_phones, masked_text

    def check_answer(self, answer: str) -> dict:
        passed, phones, masked = self.check_text(answer)
        return {
            "passed": passed,
            "raw_phones": phones,
            "masked_answer": masked,
            "leak_count": len(phones)
        }
