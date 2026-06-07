from demo_data import create_demo_review, create_normal_demo_review, create_three_step_demo
from core import get_track_status
from cli import print_report

print("=" * 60)
print("测试1: 完整流程演示 (夏天的风) - 含人工修正+重跑")
print("=" * 60)
r1 = create_demo_review()
print_report(r1)

print("=" * 60)
print("测试2: 正常流程演示 (晴天)")
print("=" * 60)
r2 = create_normal_demo_review()
print_report(r2)

print("=" * 60)
print("测试3: 三步标准流程 (稻香)")
print("=" * 60)
r3 = create_three_step_demo()
print_report(r3)

print("=" * 60)
print("所有测试完成!")
print("=" * 60)
