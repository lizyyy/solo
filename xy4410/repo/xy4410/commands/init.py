#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
init命令 - 初始化工作目录
"""

import shutil
from pathlib import Path


def init_command(work_dir: Path, force: bool = False):
    print("正在初始化贴片回流生产管理工具工作目录...")
    
    if work_dir.exists():
        if force:
            print(f"  强制模式: 正在删除现有目录 {work_dir}")
            shutil.rmtree(work_dir)
        else:
            print(f"  工作目录已存在: {work_dir}")
            print("  使用 --force 参数强制重新初始化")
            return
    
    work_dir.mkdir(parents=True, exist_ok=True)
    
    from core.storage import DataStore
    store = DataStore(work_dir)
    
    config = store.get_config()
    
    print(f"  创建工作目录: {work_dir}")
    print(f"  创建数据目录: {store.data_dir}")
    print("  初始化默认配置:")
    print(f"    - 默认浸泡区起始温度: {config['default_soak_start']}°C")
    print(f"    - 默认浸泡区结束温度: {config['default_soak_end']}°C")
    print(f"    - 默认浸泡区最短时间: {config['default_soak_min_time']}秒")
    print(f"    - 默认浸泡区最长时间: {config['default_soak_max_time']}秒")
    print(f"    - 有铅锡膏峰值温度范围: {config['default_peak_min_lead']}°C ~ {config['default_peak_max_lead']}°C")
    print(f"    - 无铅锡膏峰值温度范围: {config['default_peak_min_lead_free']}°C ~ {config['default_peak_max_lead_free']}°C")
    print(f"    - 默认升温速率: {config['default_ramp_up_rate']}°C/秒")
    print(f"    - 默认降温速率: {config['default_ramp_down_rate']}°C/秒")
    print(f"    - 锡膏最大回温时间: {config['default_max_thaw_hours']}小时")
    print(f"    - 锡膏最大室温使用时间: {config['default_max_room_temp_hours']}小时")
    print(f"    - 最大允许返修次数: {config['max_reworks_allowed']}次")
    
    print("\n初始化完成！")
    print("\n下一步操作:")
    print("  1. 导入BOM: smt-workshop import <bom.csv> --type bom")
    print("  2. 导入贴片坐标: smt-workshop import <pick_place.csv> --type pick_place")
    print("  3. 导入炉温曲线: smt-workshop import <oven_profile.csv> --type oven_profile")
    print("  4. 导入钢网/锡膏批次: smt-workshop import <stencil_paste.json> --type paste_stencil")
    print("  5. 导入AOI缺陷表: smt-workshop import <aoi.csv> --type aoi")
    print("  6. 运行检查: smt-workshop check")
    print("  7. 人工复核: smt-workshop review <问题ID> -r \"备注内容\"")
    print("  8. 导出报告: smt-workshop export --all")
