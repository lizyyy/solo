#!/usr/bin/env python3
import sys
from pathlib import Path
from warehouse_picking import (
    DataImporter,
    ResultValidator,
    VersionManager,
    DataExporter,
    ValidationStatus,
)
from datetime import datetime


def print_banner():
    banner = """
╔═══════════════════════════════════════════════════════════════╗
║                仓储拣货优化 - 结果验证管理系统                   ║
║  Warehouse Picking Optimization - Validation & Management      ║
╚═══════════════════════════════════════════════════════════════╝
    """
    print(banner)


def print_menu():
    print("\n" + "=" * 60)
    print("  主菜单")
    print("=" * 60)
    print("  1. 导入拣货结果")
    print("  2. 验证结果 (自动检测问题)")
    print("  3. 查看验证汇总")
    print("  4. 查看待确认/存疑记录")
    print("  5. 人工复核确认")
    print("  6. 查看版本历史")
    print("  7. 撤回修正 (回滚版本)")
    print("  8. 筛选导出")
    print("  9. 操作日志")
    print("  0. 退出")
    print("=" * 60)


def print_section(title):
    print("\n" + "-" * 60)
    print(f"  {title}")
    print("-" * 60)


def pause():
    input("\n按回车键继续...")


class PickingApp:
    def __init__(self):
        self.importer = DataImporter()
        self.validator = ResultValidator()
        self.version_mgr = VersionManager()
        self.exporter = DataExporter()
        self.current_operator = "user"

    def run(self):
        print_banner()

        while True:
            print_menu()
            choice = input("\n请选择操作 (0-9): ").strip()

            if choice == "1":
                self.import_data()
            elif choice == "2":
                    self.validate_data()
            elif choice == "3":
                self.show_summary()
            elif choice == "4":
                self.show_suspicious()
            elif choice == "5":
                self.confirm_record()
            elif choice == "6":
                self.show_version_history()
            elif choice == "7":
                self.rollback_version()
            elif choice == "8":
                self.filter_export()
            elif choice == "9":
                self.show_logs()
            elif choice == "0":
                print("\n感谢使用，再见！")
                break
            else:
                print("无效选择，请重试。")

    def import_data(self):
        print_section("导入拣货结果")

        file_path = input("请输入数据文件路径 (Excel/CSV): ").strip()
        if not file_path:
            print("路径不能为空")
            return

        if not Path(file_path).exists():
            print(f"文件不存在: {file_path}")
            return

        run_id = input("请输入运行ID (如: RUN-20240101): ").strip() or f"RUN-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        batch_no = input("请输入批次号 (如: BATCH-001): ").strip() or "BATCH-001"

        try:
            if file_path.endswith((".xlsx", ".xls")):
                results, stats = self.importer.import_from_excel(file_path, run_id, batch_no)
            elif file_path.endswith(".csv"):
                results, stats = self.importer.import_from_csv(file_path, run_id, batch_no)
            else:
                print("不支持的文件格式")
                return

            self.version_mgr.add_results(results, self.current_operator)

            print(f"\n导入完成！")
            print(f"  总行数: {stats['total_rows']}")
            print(f"  成功导入: {stats['imported']}")
            print(f"  跳过重复: {stats['skipped_duplicates']}")
            if stats['warnings']:
                print(f"  警告信息:")
                for w in stats['warnings'][:3]:
                    print(f"    - {w}")

        except Exception as e:
            print(f"导入失败: {e}")

        pause()

    def validate_data(self):
        print_section("验证结果")

        results = self.version_mgr.get_all_latest()
        if not results:
            print("没有数据，请先导入")
            pause()
            return

        baseline_file = input("基线数据文件路径 (用于漂移检测，直接回车跳过): ").strip()
        baseline_results = None

        if baseline_file and Path(baseline_file).exists():
            try:
                if baseline_file.endswith((".xlsx", ".xls")):
                    baseline_results, _ = self.importer.import_from_excel(
                        baseline_file, "BASELINE", "BASELINE"
                    )
                elif baseline_file.endswith(".csv"):
                    baseline_results, _ = self.importer.import_from_csv(
                        baseline_file, "BASELINE", "BASELINE"
                    )
            except Exception as e:
                print(f"加载基线数据失败: {e}")

        validated, stats = self.validator.validate_all(results, baseline_results)

        for result in validated:
            self.version_mgr.update_record(
                record_id=result.record_id,
                updates={
                    "status": result.status,
                    "issues": result.issues,
                },
                operator=self.current_operator,
                reason="自动验证",
            )

        print(f"\n验证完成！")
        print(f"  总记录数: {stats['total']}")
        print(f"  正常: {stats['normal']}")
        print(f"  待确认: {stats['pending']}")
        print(f"  存疑: {stats['suspicious']}")
        print(f"  无效: {stats['invalid']}")

        if stats['issues_by_type']:
            print(f"\n问题分布:")
            for issue_type, count in stats['issues_by_type'].items():
                print(f"  {issue_type}: {count}")

        pause()

    def show_summary(self):
        print_section("验证汇总")

        results = self.version_mgr.get_all_latest()
        if not results:
            print("没有数据")
            pause()
            return

        summary = self.validator.get_validation_summary(results)

        print(f"\n总记录数: {summary['total_records']}")
        print(f"\n状态分布:")
        for status, count in summary['by_status'].items():
            print(f"  {status}: {count}")

        if summary['by_issue_type']:
            print(f"\n问题类型统计:")
            for issue_type, count in summary['by_issue_type'].items():
                print(f"  {issue_type}: {count}")

        pause()

    def show_suspicious(self):
        print_section("待确认/存疑记录")

        results = self.version_mgr.get_all_latest()
        if not results:
            print("没有数据")
            pause()
            return

        suspicious = [
            r for r in results
            if r.status in [ValidationStatus.PENDING, ValidationStatus.SUSPICIOUS]
        ]

        if not suspicious:
            print("没有待确认或存疑记录")
            pause()
            return

        print(f"\n共发现 {len(suspicious)} 条待处理记录:\n")

        for i, r in enumerate(suspicious, 1):
            print(f"  [{i}] 记录ID: {r.record_id}")
            print(f"      订单: {r.order_no} | 商品: {r.sku_code} - {r.sku_name}")
            print(f"      状态: {r.status.value}")
            print(f"      拣货: {r.pick_qty} {r.unit}")
            print(f"      问题:")
            for issue in r.issues:
                print(f"        - {issue.issue_type.value}: {issue.description}")
                if issue.evidence:
                    evidence_str = ", ".join([f"{k}={v}" for k, v in issue.evidence.items()])
                    print(f"          证据: {evidence_str}")
                print(f"          建议: {issue.suggestion}")
            print()

        pause()

    def confirm_record(self):
        print_section("人工复核确认")

        record_id = input("请输入记录ID: ").strip()
        if not record_id:
            print("记录ID不能为空")
            pause()
            return

        record = self.version_mgr.get_latest(record_id)
        if not record:
            print(f"记录不存在")
            pause()
            return

        print(f"\n当前记录:")
        print(f"  记录ID: {record.record_id}")
        print(f"  当前状态: {record.status.value}")
        print(f"  订单: {record.order_no}")
        print(f"  商品: {record.sku_code} - {record.sku_name}")
        print(f"  拣货: {record.pick_qty} {record.unit}")

        print("\n可选状态:")
        print("  1. 正常")
        print("  2. 待确认")
        print("  3. 存疑")
        print("  4. 无效")

        status_choice = input("\n请选择新状态 (1-4): ").strip()
        status_map = {
            "1": ValidationStatus.NORMAL, "2": ValidationStatus.PENDING, "3": ValidationStatus.SUSPICIOUS, "4": ValidationStatus.INVALID,
        }
        new_status = status_map.get(status_choice)
        if not new_status:
            print("无效选择")
            pause()
            return

        notes = input("请输入复核说明: ").strip()

        self.version_mgr.confirm_status(
            record_id, new_status, self.current_operator, notes
        )
        print(f"\n已确认状态为: {new_status.value}")

        pause()

    def show_version_history(self):
        print_section("版本历史")

        record_id = input("请输入记录ID: ").strip()
        if not record_id:
            print("记录ID不能为空")
            pause()
            return

        history = self.version_mgr.get_version_history(record_id)
        if not history:
            print("没有找到版本历史")
            pause()
            return

        print(f"\n记录 {record_id} 的版本历史:\n")
        for v in history:
            print(f"  版本{v['version']}:")
            print(f"    拣货数量: {v['pick_qty']} {v['unit']}")
            print(f"    状态: {v['status']}")
            print(f"    更新时间: {v['updated_at']}")
            print(f"    问题数: {v['issues_count']}")
            print()

        pause()

    def rollback_version(self):
        print_section("撤回修正 (回滚版本)")

        record_id = input("请输入记录ID: ").strip()
        if not record_id:
            print("记录ID不能为空")
            pause()
            return

        history = self.version_mgr.get_version_history(record_id)
        if not history:
            print("没有找到版本历史")
            pause()
            return

        print(f"\n可用版本: {[v['version'] for v in history]}")
        target_version = input("请输入目标版本号: ").strip()

        try:
            target_version_int = int(target_version)
        except ValueError:
            print("无效的版本号")
            pause()
            return

        reason = input("请输入回滚原因: ").strip() or "撤回修正"

        result = self.version_mgr.rollback(
            record_id, target_version_int, self.current_operator, reason
        )
        if result:
            print(f"\n已回滚到版本 {target_version_int}")
            print(f"新版本号: {result.version}")
        else:
            print("回滚失败")

        pause()

    def filter_export(self):
        print_section("筛选导出")

        results = self.version_mgr.get_all_latest()
        if not results:
            print("没有数据")
            pause()
            return

        print("\n筛选条件 (直接回车跳过该条件):")
        status_choice = input("  状态筛选 (1=正常,2=待确认,3=存疑,4=无效,多个用逗号分隔): ").strip()
        order_filter = input("  订单号包含: ").strip()
        sku_filter = input("  商品编码/名称包含: ").strip()
        run_id_filter = input("  运行ID包含: ").strip()

        status_filter = None
        if status_choice:
            status_map = {
                "1": ValidationStatus.NORMAL, "2": ValidationStatus.PENDING, "3": ValidationStatus.SUSPICIOUS, "4": ValidationStatus.INVALID,
            }
            status_filter = [
                status_map[c.strip()] for c in status_choice.split(",") if c.strip() in status_map
            ]

        filtered = self.exporter.filter_results(
            results,
            status_filter=status_filter,
            order_no_filter=order_filter,
            sku_filter=sku_filter,
            run_id_filter=run_id_filter,
        )

        print(f"\n筛选结果: {len(filtered)} 条记录")

        if not filtered:
            print("没有符合条件的记录")
            pause()
            return

        filename = input("\n请输入导出文件名: ").strip()
        if not filename:
            print("文件名不能为空")
            pause()
            return

        export_format = input("导出格式 (1=Excel, 2=CSV): ").strip() or "1"

        try:
            if export_format == "1":
                output_path = self.exporter.export_to_excel(filtered, filename)
            else:
                output_path = self.exporter.export_to_csv(filtered, filename)
            print(f"\n导出成功: {output_path}")
        except Exception as e:
            print(f"导出失败: {e}")

        pause()

    def show_logs(self):
        print_section("操作日志")

        logs = self.version_mgr.get_change_logs()
        if not logs:
            print("没有操作日志")
            pause()
            return

        print(f"\n共 {len(logs)} 条日志 (最近20条):\n")
        for log in logs[-20:]:
            print(f"  [{log.timestamp.strftime('%Y-%m-%d %H:%M:%S')}]")
            print(f"    操作: {log.action}")
            print(f"    记录ID: {log.record_id}")
            print(f"    操作人: {log.operator}")
            print(f"    原因: {log.reason}")
            if log.previous_version or log.new_version:
                print(f"    版本: {log.previous_version} -> {log.new_version}")
            print()

        pause()


if __name__ == "__main__":
    app = PickingApp()
    app.run()
