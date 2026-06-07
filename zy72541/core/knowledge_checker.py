from typing import Tuple


class KnowledgeChecker:
    def __init__(self):
        self.expired_keywords = [
            "旧版", "原规定", "以前的政策", "之前的口径",
            "去年", "上一版", "已变更", "已更新"
        ]
        self.onsite_keywords = [
            "现场确认", "实际操作", "最新口径", "已调整",
            "现在改成", "最新政策", "现场说法"
        ]

    def check_expired(self, current_answer: str, annotation_text: str = "") -> Tuple[bool, str]:
        reason = ""
        is_expired = False

        for kw in self.expired_keywords:
            if kw in current_answer:
                is_expired = True
                reason = f"答案中包含过期标识: {kw}"
                break

        if annotation_text:
            for kw in self.onsite_keywords:
                if kw in annotation_text:
                    is_expired = True
                    reason = f"标注员留言提示有新口径: {kw}"
                    break

        return is_expired, reason

    def needs_review(self, answer: str, found_phones: list) -> bool:
        if found_phones:
            return True
        return False
