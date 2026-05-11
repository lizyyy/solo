#!/usr/bin/env python3
"""演示脚本：展示小程序用户迁移 CLI 的完整功能"""

import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
SAMPLES_DIR = SCRIPT_DIR / 'samples'


def run_cmd(cmd):
    print(f'\n>>> {cmd}')
    result = subprocess.run(
        cmd,
        shell=True,
        capture_output=True,
        text=True,
        cwd=str(SCRIPT_DIR)
    )
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)
    return result.returncode


def main():
    print('=' * 80)
    print('小程序用户迁移 CLI - 演示脚本')
    print('=' * 80)

    base_cmd = f'{sys.executable} -m migration_cli.cli'

    print('\n' + '=' * 80)
    print('步骤 1: 导入所有数据')
    print('=' * 80)
    run_cmd(f'{base_cmd} import all '
            f'--users {SAMPLES_DIR}/old_users.csv '
            f'--mapping {SAMPLES_DIR}/user_mapping.csv '
            f'--points {SAMPLES_DIR}/point_records.csv '
            f'--coupons {SAMPLES_DIR}/coupons.csv '
            f'--phones {SAMPLES_DIR}/phone_bindings.csv')

    print('\n' + '=' * 80)
    print('步骤 2: 生成迁移计划（查看手机号冲突、过期券等问题）')
    print('=' * 80)
    run_cmd(f'{base_cmd} plan')

    print('\n' + '=' * 80)
    print('步骤 3: 执行模拟迁移')
    print('=' * 80)
    run_cmd(f'{base_cmd} execute')

    print('\n' + '=' * 80)
    print('步骤 4: 查看权益汇总报告')
    print('=' * 80)
    run_cmd(f'{base_cmd} report --summary')

    print('\n' + '=' * 80)
    print('步骤 5: 正式执行迁移（--real）')
    print('=' * 80)
    run_cmd(f'{base_cmd} execute --real')

    print('\n' + '=' * 80)
    print('步骤 6: 尝试重复执行 - 已迁移用户会被跳过')
    print('=' * 80)
    run_cmd(f'{base_cmd} execute --real')

    print('\n' + '=' * 80)
    print('演示完成！')
    print('=' * 80)
    print('''
样例数据场景说明：
1. U001 (张三): 正常迁移 - 500积分 + 1张有效券
2. U002 (李四): 有1张过期券被跳过 - 1200积分 + 1张有效券
3. U003 (王五): 正常迁移 - 800积分（无流水警告）+ 1张过期券
4. U004 (赵六): 大额积分2500但无流水 → 需要人工确认
5. U005 (孙七): 与U002共享手机号13800138002 → 需要人工确认
6. U006 (周八): 无手机号无权益 → 正常迁移

报告包含：
- 迁移前后权益对比（积分、优惠券）
- 失败原因清单
- 待人工确认名单
- 跳过项清单
''')


if __name__ == '__main__':
    main()
