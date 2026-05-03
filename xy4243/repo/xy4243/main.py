#!/usr/bin/env python3
"""
道具交接节拍器 - 剧场舞台监督工具
"""

import sys
import tkinter as tk
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).parent))


def run_gui():
    from app.gui import MainWindow
    from app.storage import StoreManager

    root = tk.Tk()
    store = StoreManager()
    app = MainWindow(root, store)
    root.mainloop()


def run_cli_import(props_file: Optional[str] = None,
                    scenes_file: Optional[str] = None,
                    handovers_file: Optional[str] = None):
    from app.io import ImportManager
    from app.storage import StoreManager

    import_manager = ImportManager()
    store = StoreManager()

    if props_file:
        path = Path(props_file)
        props, errors, warnings = import_manager.import_props(path)
        if errors:
            print(f"道具表导入错误: {errors}")
        else:
            count = store.import_props(props)
            print(f"成功导入 {count} 个道具")
            if warnings:
                print(f"警告: {warnings}")

    if scenes_file:
        path = Path(scenes_file)
        scenes, errors, warnings = import_manager.import_scenes(path)
        if errors:
            print(f"场次表导入错误: {errors}")
        else:
            count = store.import_scenes(scenes)
            print(f"成功导入 {count} 个场次")
            if warnings:
                print(f"警告: {warnings}")

    if handovers_file:
        path = Path(handovers_file)
        existing_props = store.props.get_all()
        existing_scenes = store.scenes.get_all()
        handovers, errors, warnings = import_manager.import_handovers(
            path, existing_props, existing_scenes
        )
        if errors:
            print(f"演员表导入错误: {errors}")
        else:
            count = store.import_handovers(handovers)
            print(f"成功导入 {count} 条交接记录")
            if warnings:
                print(f"警告: {warnings}")


def run_rules_check():
    from app.rules import RulesEngine
    from app.storage import StoreManager

    store = StoreManager()
    rules_engine = RulesEngine()

    props = store.props.get_all()
    scenes = store.scenes.get_all()
    handovers = store.handovers.get_all()

    if not handovers:
        print("没有交接记录可供检查")
        return

    result = rules_engine.run_all_checks(handovers, props, scenes)
    store.violations.save_all(result.all_violations)

    if result.all_passed:
        print("所有检查通过，未发现问题")
    else:
        print(f"发现 {len(result.unresolved_violations)} 个问题:")
        print(f"- 错误: {result.error_count}")
        print(f"- 警告: {result.warning_count}")
        for v in result.unresolved_violations[:10]:
            print(f"  [{v.severity.upper()}] {v.violation_type}: {v.description}")


def show_stats():
    from app.storage import StoreManager

    store = StoreManager()
    stats = store.get_stats()

    print("=== 数据统计 ===")
    print(f"道具数: {stats.prop_count}")
    print(f"场次: {stats.scene_count}")
    print(f"交接记录: {stats.handover_count}")
    print(f"活动交接: {stats.active_handover_count}")
    print(f"未解决问题: {stats.unresolved_violation_count}")
    print(f"危险品: {stats.dangerous_prop_count}")


def main():
    import argparse

    parser = argparse.ArgumentParser(description="道具交接节拍器 - 剧场舞台监督工具")
    parser.add_argument("--gui", action="store_true", help="启动GUI界面（默认）")
    parser.add_argument("--import-props", type=str, help="导入道具表CSV文件")
    parser.add_argument("--import-scenes", type=str, help="导入场次表CSV文件")
    parser.add_argument("--import-handovers", type=str, help="导入演员上下场表CSV文件")
    parser.add_argument("--check", action="store_true", help="运行规则检查")
    parser.add_argument("--stats", action="store_true", help="显示数据统计")

    args = parser.parse_args()

    has_cli_action = any([
        args.import_props,
        args.import_scenes,
        args.import_handovers,
        args.check,
        args.stats,
    ])

    if has_cli_action:
        if args.import_props or args.import_scenes or args.import_handovers:
            run_cli_import(
                props_file=args.import_props,
                scenes_file=args.import_scenes,
                handovers_file=args.import_handovers,
            )

        if args.check:
            run_rules_check()

        if args.stats:
            show_stats()
    else:
        run_gui()


if __name__ == "__main__":
    main()
