import re

path = '/Users/lzy/pro/solo/workspaces/zy72506/src/engine.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

pattern = r"(    if record\.operation_reviewed_by:\n        reasons\.append\(f\"运营复核人 \{record\.operation_reviewed_by\} 于 \{record\.operation_reviewed_at\} 给出意见: \{record\.operation_review_comment or '无'\}\"\n)        decisions\.append\(f\"运营复核\{'通过' if record\.status == VerificationStatus\.OPERATION_APPROVED else '驳回'\} → 进入第三步\"\)"

replacement = r"""\1        op_approved = False
        for h in reversed(record.status_history):
            if h.get("new_status") == VerificationStatus.OPERATION_APPROVED:
                op_approved = True
                break
            if h.get("new_status") == VerificationStatus.OPERATION_REJECTED:
                op_approved = False
                break
        decisions.append(f"运营复核{'通过' if op_approved else '驳回'} → 进入第三步")"""

new_content, n = re.subn(pattern, replacement, content)
print("替换次数:", n)
if n > 0:
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("patched OK")
else:
    print("匹配失败，显示附近片段：")
    idx = content.find("operation_reviewed_by")
    print(content[idx:idx+600])
