#!/usr/bin/env python3
# 机场廊桥停靠预演 - 重放脚本
# 生成时间: 2026-06-03T17:49:16.853731

import sys
sys.path.insert(0, '.')

from airbridge import PreflightManager, ReviewManager, Visualizer, WorkflowEngine
from airbridge.models import CoordinateOrigin, InspectionPhoto

def replay():
    pm = PreflightManager()
    rm = ReviewManager(pm)
    vz = Visualizer(pm)
    we = WorkflowEngine(pm, rm, vz)
    
    print('开始重放机场廊桥停靠预演流程...')
    print()

    # 步骤 1
    print('执行: airbridge import --origin=origin_001 --actor=system_initial')
    # airbridge import --origin=origin_001 --actor=system_initial

    # 步骤 2
    print('执行: airbridge add-photo --photo=photo_001 --origin=photo_001 --actor=designer_ajing')
    # airbridge add-photo --photo=photo_001 --origin=photo_001 --actor=designer_ajing

    # 步骤 3
    print('执行: airbridge add-photo --photo=photo_002 --origin=photo_002 --actor=designer_ajing')
    # airbridge add-photo --photo=photo_002 --origin=photo_002 --actor=designer_ajing

    # 步骤 4
    print('执行: airbridge update-remark --photo=photo_001 --remark='D10廊桥初始巡检 - 展陈设计师阿景复核确认' --actor=designer_ajing')
    # airbridge update-remark --photo=photo_001 --remark='D10廊桥初始巡检 - 展陈设计师阿景复核确认' --actor=designer_ajing

    # 步骤 5
    print('执行: airbridge update-remark --photo=photo_002 --remark='移动端复核截图 - 告警标签被遮挡，需施工经理确认' --actor=designer_ajing')
    # airbridge update-remark --photo=photo_002 --remark='移动端复核截图 - 告警标签被遮挡，需施工经理确认' --actor=designer_ajing

    # 步骤 6
    print('执行: airbridge submit-review --record=photo_002 --photo=photo_002 --actor=designer_ajing')
    # airbridge submit-review --record=photo_002 --photo=photo_002 --actor=designer_ajing

    # 步骤 7
    print('执行: airbridge resolve-block --photo=photo_002 --resolution=rephoto --actor=designer_ajing')
    # airbridge resolve-block --photo=photo_002 --resolution=rephoto --actor=designer_ajing

    # 步骤 8
    print('执行: airbridge rollback --record=None --actor=system')
    # airbridge rollback --record=None --actor=system

    # 步骤 9
    print('执行: airbridge import --origin=origin_002 --actor=system_initial')
    # airbridge import --origin=origin_002 --actor=system_initial

    # 步骤 10
    print('执行: airbridge add-photo --photo=photo_003 --origin=photo_003 --actor=designer_ajing')
    # airbridge add-photo --photo=photo_003 --origin=photo_003 --actor=designer_ajing

    print()
    print('重放完成！')
    print(f'预演记录总数: {len(pm.get_all_preflight_records())}')
    print(f'待复核记录数: {len(rm.get_records_needing_review())}')

if __name__ == '__main__':
    replay()
