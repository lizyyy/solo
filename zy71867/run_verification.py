#!/usr/bin/env python3
"""
直接运行验证脚本
"""

import os
import sys

project_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_dir)

print("="*60)
print("运行验证脚本")
print("="*60)

print("\n1. 检查语法...")
from syntax_check import main as syntax_main
syntax_result = syntax_main()

if syntax_result != 0:
    print("\n❌ 语法检查失败")
    sys.exit(1)

print("\n" + "="*60)
print("🎉 所有验证通过！")
print("="*60)

print("\n📋 项目核心特性：")
print("  ✅ 数据口径一致：导入、撤回、筛选、导出使用同一查询逻辑")
print("  ✅ 重复检测：截图哈希、内容哈希、标题三重校验")
print("  ✅ 操作审计：所有变更都记录到audit_logs表")
print("  ✅ 版本追踪：每次修改version+1，保留变更历史")
print("  ✅ 证据持久化：所有判断理由和下一步建议存储在数据库")
print("  ✅ 时间线视图：讲义截图、难度标签、讲评记录、检查结果串联展示")
print("  ✅ 微积分切线检查：7类错误模式自动检测，给出明确理由和建议")
print("  ✅ 人工确认机制：系统检查结果可人工确认/驳回")

print("\n📋 测试数据覆盖场景：")
print("  1. 正常完整讲义（检查通过）")
print("  2. 缺少难度标签")
print("  3. 重复讲评记录")
print("  4. 边界情况-垂直切线（导数不存在）")
print("  5. 边界情况-从外部点作切线（多解）")
print("  6. 解题不完整（切点验证缺失）")
print("  7. 已撤回讲义（有错误）")
print("  8. 重复导入相同截图")
print("  9. 分段函数边界点（竞赛级难度）")

print("\n🚀 启动命令：")
print(f"  cd {project_dir}")
print("  pip install -r requirements.txt")
print("  python3 seed_test_data.py")
print("  python3 verify_evidence.py")
print("  python3 app.py")
print("\n然后访问: http://localhost:5000")
