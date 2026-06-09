#!/usr/bin/env python3
"""
宠物减重报告导出 - 一键运行整包样例
====================================

一条命令跑完整个「宠物减重报告导出」流水线样例：
    python run_pet_weight_report.py

功能覆盖：
  ✅ 分批次寄养登记表（模拟分几次凑齐）
  ✅ 宠物别名重复检测（标记异常，不默默放行）
  ✅ 后补材料增量补录（不覆盖早先判断，留历史）
  ✅ 补录后结论变化（旧材料/新备注/改判原因全留痕）
  ✅ 状态分类（已放行/待补证据/人工改过/异常）
  ✅ 退出提示（准确定位别名重复卡在哪一行）
  ✅ 寄养登记表原始说法 × 接口处理结果 关联映射

给前台小温的交付文件：
  · *_前台小温视图.csv            — 直接上手用的表格
  · *_登记表处理结果关联.csv      — 原始说法 vs 处理结果对照
  · *_摘要.txt                    — 一眼看完总数+分组+阻塞项
  · *_改判历史.json               — 旧材料/新备注/改判原因 全记录
  · *_interface_response.json     — 项目经理要的接口返回（分4类桶）
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pet_weight_report.cli import main

if __name__ == "__main__":
    sys.exit(main())
