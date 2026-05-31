#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import os
from config_drift_scanner import ConfigDriftScanner, ChangeType


def main():
    parser = argparse.ArgumentParser(description='配置漂移扫描工具 - 凌晨值班专用')
    parser.add_argument('directory', nargs='?', default='./configs', 
                        help='要扫描的配置目录（默认: ./configs）')
    parser.add_argument('--baseline', '-b', default='config_baseline.json',
                        help='基线文件路径（默认: config_baseline.json）')
    parser.add_argument('--report', '-r', default='drift_report.md',
                        help='输出报告路径（默认: drift_report.md）')
    parser.add_argument('--init', action='store_true',
                        help='仅初始化基线，不生成报告')
    parser.add_argument('--record-exec', metavar='FILE',
                        help='记录某文件的执行历史（用于重复执行检测）')
    
    args = parser.parse_args()

    scanner = ConfigDriftScanner(baseline_path=args.baseline)

    if args.record_exec:
        if os.path.exists(args.record_exec):
            file_hash = scanner._calculate_file_hash(args.record_exec)
            scanner.record_execution(args.record_exec, file_hash)
            print(f"已记录执行: {args.record_exec}")
        else:
            print(f"文件不存在: {args.record_exec}")
        return

    if not os.path.exists(args.directory):
        print(f"目录不存在: {args.directory}")
        print("正在创建测试样例目录...")
        create_test_samples(args.directory)
        return

    print(f"正在扫描目录: {args.directory}")
    results = scanner.scan_directory(args.directory)
    
    if args.init:
        print(f"基线已初始化，共扫描 {len(results)} 个文件")
        return

    report = scanner.generate_report(results, args.report)
    
    abnormal = [r for r in results if r.change_type != ChangeType.NORMAL]
    controversial = [r for r in results if r.is_controversial]
    
    print(f"\n=== 扫描完成 ===")
    print(f"总文件数: {len(results)}")
    print(f"正常: {len(results) - len(abnormal)}")
    print(f"异常: {len(abnormal)}")
    print(f"有争议（需人工确认）: {len(controversial)}")
    print(f"\n详细报告已生成: {args.report}")
    
    if controversial:
        print("\n⚠️  有争议的文件列表（请重点关注）:")
        for r in controversial:
            print(f"  - [{r.change_type.value}] {r.file_path}")


def create_test_samples(base_dir: str):
    """创建测试样例，模拟各种场景"""
    import time
    
    os.makedirs(base_dir, exist_ok=True)
    
    samples = {
        "app_config.yaml": """
server:
  port: 8080
  host: localhost
database:
  url: jdbc:mysql://localhost:3306/mydb
""",
        "db_config.properties": """
db.driver=com.mysql.jdbc.Driver
db.url=jdbc:mysql://localhost:3306/test
db.username=admin
""",
        "feature_flags.json": """
{
  "new_ui": true,
  "beta_features": false,
  "maintenance_mode": false
}
""",
    }
    
    for filename, content in samples.items():
        filepath = os.path.join(base_dir, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  创建: {filename}")
    
    space_dir = os.path.join(base_dir, "my configs")
    os.makedirs(space_dir, exist_ok=True)
    with open(os.path.join(space_dir, "special.conf"), 'w', encoding='utf-8') as f:
        f.write("special.settings=enabled\n")
    print(f"  创建: my configs/special.conf (路径含空格)")
    
    with open(os.path.join(base_dir, "change_report.txt"), 'w', encoding='utf-8') as f:
        f.write("变更报告:\n- app_config.yaml\n- db_config.properties\n")
    print(f"  创建: change_report.txt (报告文件)")
    
    with open(os.path.join(base_dir, "late_config.ini"), 'w', encoding='utf-8') as f:
        f.write("[late]\nadded=later\n")
    print(f"  创建: late_config.ini (模拟后续新增的补材料)")
    
    print(f"\n测试样例已创建在: {base_dir}")
    print("\n使用方法:")
    print("  1. 首次执行创建基线: python main.py --init")
    print("  2. 修改配置文件模拟变更")
    print("  3. 再次执行扫描: python main.py")
    print("  4. 查看生成的 drift_report.md 报告")


if __name__ == '__main__':
    main()
