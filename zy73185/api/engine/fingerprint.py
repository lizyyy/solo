from typing import Optional


def make_submission_fingerprint(
    question_no: str, answer_content: str, supplementary_note: Optional[str]
) -> str:
    raw = f"{question_no}|||{answer_content.strip()}|||{(supplementary_note or '').strip()}"
    h = 2166136261
    for ch in raw:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return format(h, "08x")
