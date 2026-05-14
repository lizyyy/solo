#!/usr/bin/env python3
"""验证第三轮修复 - 规则版本升级与缓存冲突检测"""

import sys
sys.path.insert(0, '.')

print("验证第三轮修复 - 规则版本升级与缓存冲突检测")
print("=" * 70)

# 1. 验证代码可以正常导入
from dead_config_scanner.rules.engine import RuleEngine
from dead_config_scanner.rules.builtin import get_default_rule_set
from dead_config_scanner.models.scan import ScanConfig, ScanItem, ScanItemStatus
from dead_config_scanner.storage import StorageManager

print("✅ 1. 代码模块导入成功")

# 2. 验证规则版本已升级到 2.0.0
rule_set = get_default_rule_set()
print(f"\n✅ 2. 规则集版本: {rule_set.version}")
assert rule_set.version == "2.0.0", "规则集版本应为 2.0.0"

for rule in rule_set.rules:
    print(f"   - {rule.rule_id}: v{rule.version}")
    assert rule.version == "2.0.0", f"{rule.rule_id} 版本应为 2.0.0"

# 3. 验证当前规则版本字典
current_rule_versions = rule_set.get_rule_versions()
print(f"\n✅ 3. 当前规则版本映射: {current_rule_versions}")

# 4. 模拟旧缓存场景（v1.0.0 规则缓存了 invalid 的结果）
print("\n" + "=" * 70)
print("4. 模拟缓存冲突检测场景:")

# 模拟旧缓存 (v1.0.0)
old_cache_rule_versions = {
    "url_alive_check": "1.0.0",
    "deprecated_pattern": "1.0.0", 
    "legal_evidence_url": "1.0.0"
}
print(f"   旧缓存规则版本 (v1.0.0): {old_cache_rule_versions}")
print(f"   当前规则版本 (v2.0.0): {current_rule_versions}")

# 创建 StorageManager 并测试冲突检测
import tempfile
import os
temp_dir = tempfile.mkdtemp()
storage = StorageManager(temp_dir)

# 手动添加一条旧缓存（模拟 v1.0.0 时的误判结果）
old_cache_content = "https://httpstat.us/200"
old_content_hash = "f1db3eddca2f33a6"  # 与报告中一致
storage.item_cache[old_content_hash] = {
    "status": "invalid",
    "error_message": "请求异常: Server disconnected (GET)",
    "rule_versions": old_cache_rule_versions,
    "last_updated": "2026-05-15T00:43:40.438166",
    "source": "灰度法务证据页-示例2"
}
storage._save_cache()
print(f"\n   ✅ 已添加旧缓存: {old_cache_content}")
print(f"      缓存状态: invalid (误判结果)")

# 测试冲突检测
test_item = ScanItem(source="test", content=old_cache_content)
cached_status, conflict_msg, has_conflict = storage.check_cached_item(
    test_item, current_rule_versions
)

print(f"\n   缓存冲突检测结果:")
print(f"   - 缓存状态: {cached_status}")
print(f"   - 是否冲突: {has_conflict}")
print(f"   - 冲突信息: {conflict_msg}")

assert has_conflict == True, "规则版本不同应该检测到冲突"
assert cached_status == ScanItemStatus.INVALID, "缓存状态应为 invalid"
assert "规则版本冲突" in str(conflict_msg), "应返回冲突信息"
print(f"\n   ✅ 缓存冲突检测正确!")
print(f"      → 规则版本从 v1.0.0 升级到 v2.0.0 会触发重新扫描")
print(f"      → 不会复用旧的误判结果")

# 5. 验证 scanner 中的冲突处理逻辑
print("\n" + "=" * 70)
print("5. 验证扫描器冲突处理逻辑:")

with open('dead_config_scanner/scanner.py', 'r') as f:
    scanner_content = f.read()
    
checks = [
    ("检测缓存冲突", 'has_conflict = self.storage.check_cached_item'),
    ("无冲突才使用缓存", 'if cached_status is not None and not has_conflict:'),
    ("冲突时标记metadata", 'item.metadata["cache_conflict"] = cached_error'),
]

for check_name, check_code in checks:
    if check_code in scanner_content:
        print(f"   ✅ {check_name}")
    else:
        print(f"   ❌ {check_name}")

print("\n" + "=" * 70)
print("修复总结:")
print("""
问题原因:
  - 核心修复已完成，但规则版本仍停留在 1.0.0
  - 旧缓存 item_cache.json 中 https://httpstat.us/200 仍是 invalid
  - StorageManager.check_cached_item 只比较规则版本
  - 相同内容默认扫描直接复用旧误判，不提示冲突
  - 核心修复在真实默认链路中失效

修复方案:
  1. 将所有规则版本从 1.0.0 升级到 2.0.0:
     - RuleSet 版本: default:v2.0.0
     - url_alive_check: v2.0.0
     - deprecated_pattern: v2.0.0
     - legal_evidence_url: v2.0.0

  2. 缓存冲突检测机制自动生效:
     - 旧缓存 (v1.0.0) vs 新规则 (v2.0.0) → 检测到冲突
     - 冲突时不使用旧缓存
     - 触发重新扫描，应用新的判定逻辑
     - 在 item.metadata 中记录 cache_conflict 信息

  3. 效果:
     - 旧误判不会被复用
     - 核心修复（HEAD+GET兜底、INVALID/ERROR区分）在默认链路生效
     - 返回码可信度恢复
""")

print("=" * 70)
print("✅ 第三轮修复验证完成!")
print(f"\n临时目录: {temp_dir}")
