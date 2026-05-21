#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

import re
from app.services import apply_masking


class Rule:
    def __init__(self, id, name, rule_type, pattern, replacement):
        self.id = id
        self.name = name
        self.rule_type = rule_type
        self.pattern = pattern
        self.replacement = replacement


rules = [
    Rule(1, "姓名-冒号", "name",
         r"[：:]\s*[\u4e00-\u9fa5]{2,3}(?:\s*[/、,，\s]\s*[\u4e00-\u9fa5]{2,3})*\s*(?=，|,|身份证|电话|住址|签字|。|；|;|\s|$)",
         "：**"),
    Rule(2, "姓名-签字", "name",
         r"[\u4e00-\u9fa5]{2,3}\s*[/、,，\s]\s*[\u4e00-\u9fa5]{2,3}(?:\s*[/、,，\s]\s*[\u4e00-\u9fa5]{2,3})*(?=\s*签字|\s*签名|$)",
         "**/**"),
    Rule(3, "身份证", "id_card",
         r"身份证号[：:]\s*\d{17}[\dXx]",
         "身份证号：**************"),
    Rule(4, "手机号", "phone",
         r"(?<![\d])1[3-9]\d{9}(?![\d])",
         "138****8000"),
    Rule(5, "邮箱", "email",
         r"[\w.-]+@[\w.-]+\.\w+",
         "***@example.com"),
    Rule(6, "住址", "address",
         r"住址[：:][\u4e00-\u9fa50-9]+",
         "住址：***"),
]

content = """甲方：张三，身份证号：110101199001011234
联系电话：13800138000，邮箱：zhangsan@example.com
住址：北京市朝阳区建国路88号

乙方：李四，身份证号：310101198505055678
联系电话：13900139000，邮箱：lisi@company.com
住址：上海市浦东新区陆家嘴环路1000号

丙方：王五、赵六，身份证号：440101198808088888
联系电话：13700137000，邮箱：wangwu@test.com
住址：广州市天河区珠江新城

甲方签字：张三
乙方签字：李四
共同签字：张三/李四/王五"""

print("=" * 70)
print("  脱敏逻辑验证")
print("=" * 70)

masked, hits = apply_masking(content, rules)

print("\n脱敏结果:")
for line in masked.split('\n'):
    if line.strip():
        print(f"  {line}")

print(f"\n命中 {len(hits)} 处:")
for i, h in enumerate(hits, 1):
    print(f"  {i}. L{h['line_number']}:{h['column_number']} "
          f"[{h['matched_text']}] -> [{h['replacement']}]")

checks = [
    ("身份证1脱敏", "110101199001011234" not in masked),
    ("身份证2脱敏", "310101198505055678" not in masked),
    ("身份证3脱敏", "440101198808088888" not in masked),
    ("身份证未被截断", "138****80004" not in masked),
    ("身份证替换正确", "身份证号：**************" in masked),
    ("手机号1脱敏", "13800138000" not in masked),
    ("手机号2脱敏", "13900139000" not in masked),
    ("手机号3脱敏", "13700137000" not in masked),
    ("张三(冒号)脱敏", "甲方：**" in masked),
    ("李四(冒号)脱敏", "乙方：**" in masked),
    ("王五赵六(顿号)脱敏", "丙方：**" in masked),
    ("张三(签字)脱敏", "甲方签字：**" in masked),
    ("李四(签字)脱敏", "乙方签字：**" in masked),
    ("共同签字脱敏", "**/**" in masked),
    ("邮箱1脱敏", "zhangsan@example.com" not in masked),
    ("住址1脱敏", "北京市朝阳区建国路88号" not in masked),
]

print("\n验证结果:")
ok = True
for n, p in checks:
    s = "✅" if p else "❌"
    print(f"  {s} {n}")
    if not p:
        ok = False

print("\n" + "=" * 70)
if ok:
    print("  ✅ 全部通过")
    sys.exit(0)
else:
    print("  ❌ 存在失败")
    sys.exit(1)
