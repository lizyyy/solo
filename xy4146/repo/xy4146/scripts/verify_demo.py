#!/usr/bin/env python3
"""
离线采集包合并器 - 演示验证脚本

这个脚本会创建临时测试数据并执行完整的工作流程：
1. init - 初始化任务
2. scan - 扫描采集包
3. merge - 生成合并计划
4. export - 导出报告

使用方法：
    python3 scripts/verify_demo.py
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent


def run_command(args, cwd=None, env=None):
    """运行命令并返回结果"""
    print(f"\n{'='*60}")
    print(f"执行: {' '.join(args)}")
    print("="*60)
    
    run_env = os.environ.copy()
    run_env["PYTHONPATH"] = str(PROJECT_ROOT)
    if env:
        run_env.update(env)
    
    result = subprocess.run(
        args,
        cwd=cwd or str(PROJECT_ROOT),
        capture_output=True,
        text=True,
        env=run_env
    )
    
    if result.stdout:
        print("STDOUT:")
        print(result.stdout)
    if result.stderr:
        print("STDERR:")
        print(result.stderr)
    
    if result.returncode != 0:
        print(f"命令执行失败，返回码: {result.returncode}")
        return False
    
    return True


def create_test_data(test_dir):
    """创建测试数据"""
    print(f"\n创建测试数据目录: {test_dir}")
    
    sources_dir = test_dir / "sources"
    
    tablet1 = sources_dir / "平板1"
    tablet2 = sources_dir / "平板2"
    tablet3 = sources_dir / "平板3"
    
    for t in [tablet1, tablet2, tablet3]:
        t.mkdir(parents=True)
    
    print("\n创建 CSV 点位文件...")
    
    csv1 = """点位编号,纬度,经度,海拔,时间,备注
P001,39.9042,116.4074,43.5,2024-05-01 08:00:00,起点
P002,39.9052,116.4084,45.2,2024-05-01 08:15:00,中途点
"""
    (tablet1 / "points.csv").write_text(csv1, encoding="utf-8")
    
    csv2 = """点位编号,纬度,经度,海拔,时间,备注
P001,39.90421,116.40741,43.3,2024-05-01 08:05:00,起点（平板2）
P003,39.9062,116.4094,46.1,2024-05-01 08:30:00,终点
"""
    (tablet2 / "points.csv").write_text(csv2, encoding="utf-8")
    
    csv3 = """点位编号,纬度,经度,海拔,时间,备注
P004,40.0,117.0,50.0,2024-05-01 09:00:00,异常点
"""
    (tablet3 / "points.csv").write_text(csv3, encoding="utf-8")
    
    print("创建测试照片文件...")
    (tablet1 / "photo_001.jpg").write_text("平板1的照片内容")
    (tablet2 / "photo_001.jpg").write_text("平板2的照片内容（不同）")
    (tablet3 / "photo_002.jpg").write_text("平板3的照片")
    
    print("创建 GPX 轨迹文件...")
    gpx = """<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <trk>
    <name>测试轨迹</name>
    <trkseg>
      <trkpt lat="39.9042" lon="116.4074">
        <ele>43.5</ele>
        <time>2024-05-01T08:00:00Z</time>
      </trkpt>
      <trkpt lat="39.9052" lon="116.4084">
        <ele>45.2</ele>
        <time>2024-05-01T08:15:00Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>
"""
    (tablet1 / "track.gpx").write_text(gpx, encoding="utf-8")
    
    print("\n测试数据创建完成！")
    print(f"  - 平板1: {tablet1}")
    print(f"    - points.csv (2个点位)")
    print(f"    - photo_001.jpg")
    print(f"    - track.gpx")
    print(f"  - 平板2: {tablet2}")
    print(f"    - points.csv (2个点位，含重复点位P001)")
    print(f"    - photo_001.jpg (同名不同内容)")
    print(f"  - 平板3: {tablet3}")
    print(f"    - points.csv (1个点位，坐标越界)")
    print(f"    - photo_002.jpg")
    
    return {
        "sources": sources_dir,
        "tablet1": tablet1,
        "tablet2": tablet2,
        "tablet3": tablet3,
    }


def main():
    """主函数"""
    print("\n" + "="*60)
    print("    离线采集包合并器 - 演示验证脚本")
    print("="*60)
    
    test_base = Path(tempfile.gettempdir()) / "offline_merger_demo"
    
    if test_base.exists():
        shutil.rmtree(test_base)
    
    test_base.mkdir(parents=True)
    
    work_dir = test_base / "work"
    work_dir.mkdir()
    
    python_exe = sys.executable
    cli_path = PROJECT_ROOT / "offline_merger" / "cli.py"
    
    try:
        dirs = create_test_data(test_base)
        
        print("\n" + "="*60)
        print("步骤 1: 初始化任务 (init)")
        print("="*60)
        
        init_args = [
            python_exe, str(cli_path),
            "init", "演示测试任务",
            "--output", str(work_dir / "merged_output"),
            "--quarantine", str(work_dir / "quarantine"),
            "--coord-system", "WGS84",
            "--duplicate-threshold", "10.0",
        ]
        
        if not run_command(init_args, cwd=str(work_dir)):
            print("初始化任务失败")
            return 1
        
        state_dir = work_dir / ".merger_state"
        config_file = work_dir / "merger_config.json"
        
        if config_file.exists():
            print("\n任务配置已创建:")
            config = json.loads(config_file.read_text(encoding="utf-8"))
            print(json.dumps(config, ensure_ascii=False, indent=2))
        
        print("\n" + "="*60)
        print("步骤 2: 扫描采集包 (scan)")
        print("="*60)
        
        scan_args = [
            python_exe, str(cli_path),
            "scan",
            str(dirs["tablet1"]),
            str(dirs["tablet2"]),
            str(dirs["tablet3"]),
        ]
        
        if not run_command(scan_args, cwd=str(work_dir)):
            print("扫描失败")
            return 1
        
        scan_results_path = state_dir / "scan_results.json"
        if scan_results_path.exists():
            print("\n扫描结果摘要:")
            with open(scan_results_path, "r", encoding="utf-8") as f:
                scan_data = json.load(f)
            
            packages = scan_data.get("packages", {})
            print(f"  - 扫描的采集包: {len(packages)}")
            
            total_files = 0
            for pkg_name, pkg_data in packages.items():
                files = pkg_data.get("files", [])
                total_files += len(files)
                print(f"  - {pkg_name}: {len(files)} 个文件")
                for f in files:
                    print(f"    - {f['file_name']} ({f.get('file_type', 'unknown')})")
        
        print("\n" + "="*60)
        print("步骤 3: 生成合并计划 (merge)")
        print("="*60)
        
        merge_args = [
            python_exe, str(cli_path),
            "merge",
            "--no-dry-run",
        ]
        
        if not run_command(merge_args, cwd=str(work_dir)):
            print("生成合并计划失败")
            return 1
        
        merge_plan_path = state_dir / "merge_plan.json"
        if merge_plan_path.exists():
            print("\n合并计划摘要:")
            with open(merge_plan_path, "r", encoding="utf-8") as f:
                merge_data = json.load(f)
            
            summary = merge_data.get("summary", {})
            print(f"  - 总文件数: {summary.get('total_files', 0)}")
            print(f"  - 唯一文件: {summary.get('unique_files', 0)}")
            print(f"  - 待复制: {summary.get('files_to_copy', 0)}")
            print(f"  - 待隔离: {summary.get('files_to_isolate', 0)}")
            print(f"  - 待重命名: {summary.get('files_to_rename', 0)}")
            
            conflicts = merge_data.get("conflicts", [])
            if conflicts:
                print(f"\n  - 检测到 {len(conflicts)} 个冲突:")
                for i, c in enumerate(conflicts, 1):
                    print(f"    {i}. [{c.get('conflict_type', 'unknown')}] {c.get('message', '')}")
                    print(f"       状态: {c.get('status', 'unknown')}")
            else:
                print("  - 未检测到冲突")
        
        print("\n" + "="*60)
        print("步骤 4: 导出报告 (export)")
        print("="*60)
        
        reports_dir = work_dir / "reports"
        
        export_md_args = [
            python_exe, str(cli_path),
            "export", "markdown",
            "--output", str(reports_dir),
        ]
        
        if run_command(export_md_args, cwd=str(work_dir)):
            md_path = reports_dir / "handover_report.md"
            if md_path.exists():
                print(f"\nMarkdown 报告已导出: {md_path}")
                print("\n报告内容:")
                print("-"*60)
                print(md_path.read_text(encoding="utf-8"))
                print("-"*60)
        
        export_csv_args = [
            python_exe, str(cli_path),
            "export", "csv",
            "--output", str(reports_dir),
        ]
        
        if run_command(export_csv_args, cwd=str(work_dir)):
            print(f"\nCSV 报告已导出至: {reports_dir}")
        
        export_json_args = [
            python_exe, str(cli_path),
            "export", "json",
            "--output", str(reports_dir),
        ]
        
        if run_command(export_json_args, cwd=str(work_dir)):
            print(f"\nJSON 报告已导出至: {reports_dir}")
        
        print("\n" + "="*60)
        print("演示验证完成！")
        print("="*60)
        
        print(f"\n测试目录: {test_base}")
        print(f"工作目录: {work_dir}")
        
        print("\n生成的文件:")
        if reports_dir.exists():
            for f in sorted(reports_dir.iterdir()):
                print(f"  - reports/{f.name}")
        if state_dir.exists():
            for f in sorted(state_dir.iterdir()):
                print(f"  - .merger_state/{f.name}")
        
        print("\n" + "-"*60)
        print("下一步:")
        print("-"*60)
        print("1. 查看 merge_plan.json 中的冲突")
        print("2. 修改冲突的 action 字段 (keep/isolate/rename/merge/delete)")
        print("3. 运行 commit 命令提交合并")
        print(f"   cd {work_dir} && python3 -m offline_merger.cli commit")
        print("4. 查看隔离区和审计日志")
        
        user_input = input("\n是否清理测试数据? [y/N] ")
        if user_input.strip().lower() == "y":
            shutil.rmtree(test_base)
            print(f"\n已清理测试目录: {test_base}")
        else:
            print(f"\n测试数据保留在: {test_base}")
        
        return 0
        
    except Exception as e:
        print(f"\n错误: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
