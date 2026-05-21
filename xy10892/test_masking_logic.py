#!/usr/bin/env python3
"""
脱敏核心逻辑单元测试
直接测试 apply_masking 函数，无需启动完整服务
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

import re
from app.services import apply_masking


class MockRule:
    def __init__(self, id, name, rule_type, pattern, replacement):
        self.id = id
        self.name = name
        self.rule_type = rule_type
        self.pattern = pattern
        self.replacement = replacement


test_rules = [
    MockRule(1, "姓名脱敏-冒号格式", "name",
             r"[：:]\s*[\u4e00-\u9fa5]{2,3}(?:\s*[/、,，\s]\s*[\u4e00-\u9fa5]{2,3})*\s*(?=，|,|身份证|电话|住址|签字|。|；|;|\s|$)",
             "：**"),
    MockRule(2, "姓名脱敏-签字格式", "name",
             r"[\u4e00-\u9fa5]{2,3}\s*[/、,，\s]\s*[\u4e00-\u9fa5]{2,3}(?:\s*[/、,，\s]\s*[\u4e00-\u9fa5]{2,3})*(?=\s*签字|\s*签名|$)",
             "**/**"),
    MockRule(3, "身份证号脱敏", "id_card",
             r"身份证号[：:]\s*\d{17}[\dXx]",
             "身份证号：**************"),
    MockRule(4, "手机号脱敏", "phone",
             r"(?<![\d])1[3-9]\d{9}(?![\d])",
             "138****8000"),
    MockRule(5, "邮箱脱敏", "email",
             r"[\w.-]+@[\w.-]+\.\w+",
             "***@example.com"),
    MockRule(6, "住址脱敏", "address",
             r"住址[：:][\u4e00-\u9fa50-9]+",
             "住址：***"),
]

test_content = """甲方：张三，身份证号：110101199001011234
联系电话：13800138000，邮箱：zhangsan@example.com
住址：北京市朝阳区建国路88号

乙方：李四，身份证号：310101198505055678
联系电话：13900139000，邮箱：lisi@company.com
住址：上海市浦东新区陆家嘴环路1000号

丙方：王五、赵六，身份证号：440101198808088888
联系电话：13700137000，邮箱：wangwu@test.com
住址：广州市天河区珠江新城

鉴于甲方需要向乙方提供服务，双方约定如下：
1. 甲方保证所提供信息真实有效
2. 乙方对甲方信息负有保密义务
3. 本合同自双方签字之日起生效

甲方签字：张三
乙方签字：李四
共同签字：张三/李四/王五
日期：2024年1月15日"""

print("=" * 80)
print("  脱敏核心逻辑单元测试")
print("  验证重点：身份证号不被手机号截断、签字格式姓名脱敏")
print("=" * 80)
print()

print("【原始内容】")
print(test_content)
print()

masked_content, hits = apply_masking(test_content, test_rules)

print("【脱敏后内容】")
print(masked_content)
print()

print(f"【命中结果】共 {len(hits)} 处")
for i, hit in enumerate(hits, 1):
    print(f"  {i}. 行{hit['line_number']}:{hit['column_number']} "
          f"[{hit['matched_text']}] → [{hit['replacement']}]")
print()

print("=" * 80)
print("  正确性验证")
print("=" * 80)
print()

checks = [
    ("身份证号1完整脱敏", "110101199001011234" not in masked_content),
    ("身份证号2完整脱敏", "310101198505055678" not in masked_content),
    ("身份证号3完整脱敏", "440101198808088888" not in masked_content),
    ("身份证号替换正确", "身份证号：**************" in masked_content),
    ("身份证号未被手机号截断", "138****80004" not in masked_content),
    ("手机号1脱敏", "13800138000" not in masked_content),
    ("手机号2脱敏", "13900139000" not in masked_content),
    ("手机号3脱敏", "13700137000" not in masked_content),
    ("手机号替换正确", "138****8000" in masked_content),
    ("姓名张三脱敏(冒号)", "甲方：**" in masked_content),
    ("姓名李四脱敏(冒号)", "乙方：**" in masked_content),
    ("姓名王五赵六脱敏(冒号+顿号)", "丙方：**" in masked_content),
    ("签字张三脱敏", "甲方签字：**" in masked_content),
    ("签字李四脱敏", "乙方签字：**" in masked_content),
    ("共同签字脱敏(斜杠)", "共同签字：**/**/**" in masked_content or "**/**" in masked_content),
    ("邮箱1脱敏", "zhangsan@example.com" not in masked_content),
    ("邮箱2脱敏", "lisi@company.com" not in masked_content),
    ("邮箱3脱敏", "wangwu@test.com" not in masked_content),
    ("住址1脱敏", "北京市朝阳区建国路88号" not in masked_content),
    ("住址2脱敏", "上海市浦东新区陆家嘴环路1000号" not in masked_content),
    ("住址3脱敏", "广州市天河区珠江新城" not in masked_content),
    ("手机号规则未破坏身份证号", sum(1 for h in hits if h['matched_text'] == '110101199001011234') == 1),
]

all_passed = True
for name, passed in checks:
    status = "✅" if passed else "❌"
    print(f"  {status} {name}")
    if not passed:
        all_passed = False

print()
print("=" * 80)
if all_passed:
    print("  ✅ 全部验证通过！脱敏逻辑已修复")
    print()
    print("  修复要点：")
    print("  1. 规则优先级：身份证号 > 住址 > 姓名 > 手机号 > 邮箱")
    print("  2. 区间检测：同一位置高优先级规则匹配后，低优先级规则跳过")
    print("  3. 手机号规则增加边界断言：(?<![\\d]) 和 (?![\\d])")
    print("  4. 姓名规则扩展：支持 /、、,， 等多种分隔符的多姓名格式")
    print("  5. 新增签字格式规则：匹配 张三/李四 等无冒号前缀的姓名组合")
    print("  6. 替换时使用精确位置偏移，避免字符串 replace 的不确定性")
    exit(0)
else:
    print("  ❌ 部分验证失败，请检查")
    exit(1)
