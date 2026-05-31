import re
import difflib
from typing import List, Tuple, Dict, Any
from difflib import unified_diff

try:
    from diff_match_patch import diff_match_patch
    HAS_DIFF_MATCH_PATCH = True
except ImportError:
    HAS_DIFF_MATCH_PATCH = False

from app.core.exceptions import ValidationException


def parse_version(version_str: str) -> Tuple[int, ...]:
    try:
        version_str = version_str.strip().lstrip('vV')
        parts = re.findall(r'\d+', version_str)
        if not parts:
            raise ValueError(f"Invalid version format: {version_str}")
        return tuple(int(p) for p in parts)
    except Exception as e:
        raise ValidationException(
            message=f"Failed to parse version: {str(e)}",
            user_friendly_message=f"版本号格式不对哦，应该是像 1.0.0 这样的格式～"
        )


def increment_version(version_str: str, level: str = "patch") -> str:
    version = parse_version(version_str)
    version_list = list(version)

    while len(version_list) < 3:
        version_list.append(0)

    if level == "major":
        version_list[0] += 1
        version_list[1] = 0
        version_list[2] = 0
    elif level == "minor":
        version_list[1] += 1
        version_list[2] = 0
    elif level == "patch":
        version_list[2] += 1
    else:
        raise ValidationException(
            message=f"Unknown version level: {level}",
            user_friendly_message="版本级别不对哦，应该是 major、minor 或 patch～"
        )

    return ".".join(str(v) for v in version_list)


def compare_versions(version1: str, version2: str) -> int:
    v1 = parse_version(version1)
    v2 = parse_version(version2)

    max_len = max(len(v1), len(v2))
    v1 = v1 + (0,) * (max_len - len(v1))
    v2 = v2 + (0,) * (max_len - len(v2))

    if v1 < v2:
        return -1
    elif v1 > v2:
        return 1
    else:
        return 0


def diff_content(old_content: str, new_content: str, use_diff_match_patch: bool = True) -> str:
    if use_diff_match_patch and HAS_DIFF_MATCH_PATCH:
        dmp = diff_match_patch()
        patches = dmp.patch_make(old_content, new_content)
        return dmp.patch_toText(patches)
    else:
        old_lines = old_content.splitlines(keepends=True)
        new_lines = new_content.splitlines(keepends=True)

        diff = list(unified_diff(
            old_lines,
            new_lines,
            fromfile='old_version',
            tofile='new_version',
            lineterm=''
        ))

        return "\n".join(diff)


def get_diff_details(old_content: str, new_content: str) -> Dict[str, Any]:
    changes = []

    if HAS_DIFF_MATCH_PATCH:
        dmp = diff_match_patch()
        diffs = dmp.diff_main(old_content, new_content)
        dmp.diff_cleanupSemantic(diffs)

        for op, text in diffs:
            if op == dmp.DIFF_INSERT:
                changes.append({
                    "type": "insert",
                    "content": text
                })
            elif op == dmp.DIFF_DELETE:
                changes.append({
                    "type": "delete",
                    "content": text
                })
            elif op == dmp.DIFF_EQUAL:
                if len(text) > 100:
                    changes.append({
                        "type": "equal",
                        "content": text[:50] + "..." + text[-50:]
                    })
    else:
        old_words = re.findall(r'[\w\u4e00-\u9fff]+|[^\w\s]', old_content)
        new_words = re.findall(r'[\w\u4e00-\u9fff]+|[^\w\s]', new_content)

        matcher = difflib.SequenceMatcher(None, old_words, new_words)

        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == 'insert':
                changes.append({
                    "type": "insert",
                    "content": ' '.join(new_words[j1:j2])
                })
            elif tag == 'delete':
                changes.append({
                    "type": "delete",
                    "content": ' '.join(old_words[i1:i2])
                })
            elif tag == 'replace':
                changes.append({
                    "type": "replace",
                    "old_content": ' '.join(old_words[i1:i2]),
                    "new_content": ' '.join(new_words[j1:j2])
                })

    return {
        "changes": changes,
        "total_changes": len(changes),
        "old_length": len(old_content),
        "new_length": len(new_content),
        "diff_text": diff_content(old_content, new_content)
    }


def extract_changed_keywords(old_content: str, new_content: str) -> Tuple[List[str], List[str], List[str]]:
    from app.utils.text_compare import extract_keywords

    old_keywords = set(extract_keywords(old_content))
    new_keywords = set(extract_keywords(new_content))

    added_keywords = list(new_keywords - old_keywords)
    removed_keywords = list(old_keywords - new_keywords)
    common_keywords = list(old_keywords & new_keywords)

    return added_keywords, removed_keywords, common_keywords


def calculate_change_magnitude(old_content: str, new_content: str) -> float:
    if not old_content or not new_content:
        return 1.0

    import difflib
    seq = difflib.SequenceMatcher(None, old_content, new_content)
    similarity = seq.ratio()

    return 1.0 - similarity


def check_question_affected(question: str, answer: str, old_knowledge: str, new_knowledge: str, threshold: float = 0.3) -> bool:
    from app.utils.text_compare import preprocess_text, match_keywords

    q_and_a = f"{question} {answer}"
    added_keywords, removed_keywords, common_keywords = extract_changed_keywords(old_knowledge, new_knowledge)

    all_changed_keywords = added_keywords + removed_keywords

    if not all_changed_keywords:
        return False

    q_and_a_lower = preprocess_text(q_and_a)

    for keyword in all_changed_keywords:
        if keyword in q_and_a_lower:
            return True

    _, _, match_ratio = match_keywords(" ".join(all_changed_keywords), q_and_a)

    return match_ratio >= threshold


def generate_change_description(old_content: str, new_content: str, old_version: str, new_version: str) -> str:
    added_keywords, removed_keywords, common_keywords = extract_changed_keywords(old_content, new_content)
    change_magnitude = calculate_change_magnitude(old_content, new_content)

    descriptions = []

    if change_magnitude > 0.5:
        descriptions.append("内容有较大更新")
    elif change_magnitude > 0.2:
        descriptions.append("内容有部分更新")
    else:
        descriptions.append("内容有微调")

    if added_keywords:
        if len(added_keywords) <= 5:
            descriptions.append(f"新增关键词：{', '.join(added_keywords)}")
        else:
            descriptions.append(f"新增 {len(added_keywords)} 个关键词")

    if removed_keywords:
        if len(removed_keywords) <= 5:
            descriptions.append(f"移除关键词：{', '.join(removed_keywords)}")
        else:
            descriptions.append(f"移除 {len(removed_keywords)} 个关键词")

    descriptions.append(f"版本从 {old_version} 升级到 {new_version}")

    return "；".join(descriptions)
