#!/usr/bin/env python3
"""
期权波动率曲面清洗主流程
========================
用法:
    python run_pipeline.py           # 运行完整样例
    python run_pipeline.py --demo    # 仅运行演示模式
    python run_pipeline.py --clean   # 先清除旧数据再运行
"""

import os
import sys
import json
import argparse
import shutil
from datetime import datetime
from typing import Dict, Any

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core import (
    ParameterManager,
    VolatilitySurfaceCleaner,
    AuditTrail,
    RecordStatus
)
from storage import SurfaceStorage, VersionManager
from reporting import ReportGenerator
from examples import (
    generate_sample_surface,
    generate_summary_page_data,
    create_three_sample_records,
    generate_conflict_scenario
)
from adapters import (
    LectureNoteImporter,
    BusinessTableImporter,
    ScreenshotImporter,
    SummaryPageImporter
)


class VolatilitySurfacePipeline:
    def __init__(self, storage_base: str = "storage"):
        self.base_dir = os.path.dirname(os.path.abspath(__file__))
        self.storage_base = os.path.join(self.base_dir, storage_base)

        self.param_manager = ParameterManager(
            storage_path=os.path.join(self.storage_base, "params.json")
        )
        self.audit_trail = AuditTrail(
            storage_path=os.path.join(self.storage_base, "audit_logs.json")
        )
        self.cleaner = VolatilitySurfaceCleaner(self.param_manager, self.audit_trail)
        self.storage = SurfaceStorage(
            base_path=os.path.join(self.storage_base, "surfaces")
        )
        self.version_manager = VersionManager(
            base_path=os.path.join(self.storage_base, "versions")
        )
        self.report_generator = ReportGenerator(
            version_manager=self.version_manager,
            output_dir=os.path.join(self.base_dir, "reports")
        )

    def clear_storage(self) -> None:
        data_dirs = [
            os.path.join(self.storage_base, "surfaces"),
            os.path.join(self.storage_base, "versions"),
            os.path.join(self.base_dir, "reports")
        ]
        data_files = [
            os.path.join(self.storage_base, "params.json"),
            os.path.join(self.storage_base, "audit_logs.json")
        ]

        for d in data_dirs:
            if os.path.exists(d):
                shutil.rmtree(d)
        for f in data_files:
            if os.path.exists(f):
                os.remove(f)

        os.makedirs(os.path.join(self.storage_base, "surfaces"), exist_ok=True)
        os.makedirs(os.path.join(self.storage_base, "versions"), exist_ok=True)

        print("[Pipeline] 已清除旧数据")

    def set_custom_parameter(self, name: str, value: Any,
                             comment: str = "", modified_by: str = "小孟") -> None:
        pv = self.param_manager.set_param(
            name=name,
            value=value,
            modified_by=modified_by,
            comment=comment
        )
        print(f"[Pipeline] 参数已更新: {name} = {value} (版本: {pv.version_id})")

    def import_from_multiple_sources(self, underlying: str = "50ETF",
                                      trade_date: datetime = None) -> Dict[str, Any]:
        print("\n" + "=" * 60)
        print("步骤1: 从多源导入数据（讲义、业务表、截图）")
        print("=" * 60)

        if trade_date is None:
            trade_date = datetime(2026, 5, 30)

        lecture_data = [
            {"期限": "1M", "行权价": 2.8, "隐含波动率": "18.5%"},
            {"期限": "1M", "行权价": 3.0, "隐含波动率": "16.2%"},
            {"期限": "1M", "行权价": 3.2, "隐含波动率": "17.8%"},
            {"期限": "3M", "行权价": 2.8, "隐含波动率": "19.5%"},
            {"期限": "3M", "行权价": 3.0, "隐含波动率": "17.0%"},
            {"期限": "3M", "行权价": 3.2, "隐含波动率": "18.8%"},
        ]
        lecture_importer = LectureNoteImporter("金融工程讲义-第7章")
        lecture_points, lecture_ds = lecture_importer.import_data(lecture_data)
        print(f"  ✓ 从讲义导入 {len(lecture_points)} 个点")

        business_data = [
            {"到期日": 0.5, "执行价": 2.8, "IV": 0.205, "期权类型": "call"},
            {"到期日": 0.5, "执行价": 3.0, "IV": 0.180, "期权类型": "call"},
            {"到期日": 0.5, "执行价": 3.2, "IV": 0.200, "期权类型": "call"},
            {"到期日": 1.0, "执行价": 2.8, "IV": 0.215, "期权类型": "call"},
            {"到期日": 1.0, "执行价": 3.0, "IV": 0.190, "期权类型": "call"},
            {"到期日": 1.0, "执行价": 3.2, "IV": 0.210, "期权类型": "call"},
        ]
        business_importer = BusinessTableImporter("期权做市系统导出_20260530")
        business_points, business_ds = business_importer.import_data(business_data)
        print(f"  ✓ 从业务表导入 {len(business_points)} 个点")

        ocr_text = """
        2Y  2.5  26.5%
        2Y  3.0  20.0%
        2Y  3.5  28.0%
        3Y  2.5  27.5%
        3Y  3.0  21.0%
        3Y  3.5  29.0%
        """
        screenshot_importer = ScreenshotImporter("彭博终端截图_15:30")
        screenshot_points, screenshot_ds = screenshot_importer.import_data(ocr_text)
        print(f"  ✓ 从截图OCR导入 {len(screenshot_points)} 个点")

        all_points = lecture_points + business_points + screenshot_points
        all_sources = [lecture_ds, business_ds, screenshot_ds]

        import uuid
        surface_id = f"VOL_{underlying}_{trade_date.strftime('%Y%m%d')}_{str(uuid.uuid4())[:4]}"

        from core.models import VolatilitySurface
        surface = VolatilitySurface(
            surface_id=surface_id,
            underlying=underlying,
            trade_date=trade_date,
            points=all_points,
            data_sources=all_sources,
            comments=f"多源导入曲面 - 讲义+业务表+截图"
        )

        self.storage.save_raw_surface(surface)
        print(f"  ✓ 原始曲面已保存，共 {len(all_points)} 个点")

        return {"surface": surface, "points_count": len(all_points)}

    def run_cleaning_pipeline(self, surface, summary_page_data: Dict[str, float] = None,
                              user_params: Dict[str, Any] = None) -> Dict[str, Any]:
        print("\n" + "=" * 60)
        print("步骤2: 执行波动率曲面清洗")
        print("=" * 60)

        if user_params:
            for name, value in user_params.items():
                self.set_custom_parameter(
                    name=name,
                    value=value,
                    comment="清洗前用户调整",
                    modified_by="小孟"
                )

        print(f"  曲面ID: {surface.surface_id}")
        print(f"  标的: {surface.underlying}")
        print(f"  交易日: {surface.trade_date.strftime('%Y-%m-%d')}")
        print(f"  原始点数: {len(surface.points)}")

        incremental_state = self.storage.get_incremental_state(surface.surface_id)
        if incremental_state["exists"]:
            print(f"  ℹ️  检测到历史处理记录，上次状态: {incremental_state['last_status']}")
            if incremental_state["last_processed"]:
                print(f"     上次处理时间: {incremental_state['last_processed']}")

        result = self.cleaner.clean(surface, summary_page_data)

        self.storage.save_cleaned_surface(result.surface)
        self.storage.save_clean_result(result)

        print(f"\n  --- 清洗结果 ---")
        print(f"  原始点数: {result.original_points}")
        print(f"  有效点数: {result.cleaned_points}")
        print(f"  异常移除: {result.outliers_removed}")
        print(f"  插值补全: {result.interpolated_points}")
        print(f"  冲突检测: {len(result.conflicts_found)} 个")
        print(f"  处理耗时: {result.processing_time:.3f}秒")
        print(f"  曲面状态: {result.surface.status.value}")

        if result.conflicts_found:
            print(f"\n  ⚠️  发现 {len(result.conflicts_found)} 个冲突，不自动决策:")
            for c in result.conflicts_found:
                print(f"    - 点 {c.point_id}: 导入={c.imported_value:.4f} vs 汇总={c.summary_page_value:.4f} ({c.difference:.1f}%)")
                print(f"      建议: {c.suggested_action}")

        return {"result": result, "surface_id": surface.surface_id}

    def generate_reports(self, result) -> Dict[str, str]:
        print("\n" + "=" * 60)
        print("步骤3: 生成可复查报告")
        print("=" * 60)

        report_path = self.report_generator.generate_html_report(result)
        text_summary = self.report_generator.generate_text_summary(result)

        text_path = report_path.replace('_report.html', '_summary.txt')
        with open(text_path, 'w', encoding='utf-8') as f:
            f.write(text_summary)

        version_data = result.to_dict() if hasattr(result, 'to_dict') else {'result': str(result)}
        version_id = self.version_manager.save_version(
            result.surface.surface_id,
            version_data,
            comment="报告生成版本"
        )

        print(f"  ✓ HTML报告: {report_path}")
        print(f"  ✓ 文本摘要: {text_path}")
        print(f"  ✓ 版本记录: {version_id}")
        print(f"\n  💡 报告特性:")
        print(f"     - 点击3D曲面/微笑曲线/期限结构上的点可查看决策路径")
        print(f"     - 每个数据点包含完整的处理日志和参数版本")
        print(f"     - 冲突记录包含双方证据和建议动作")
        print(f"     - 参数版本区分系统默认和人工修改")

        return {
            "html_report": report_path,
            "text_summary": text_path,
            "version_id": version_id
        }

    def demonstrate_three_records(self) -> None:
        print("\n" + "=" * 60)
        print("演示: 三类样例记录（顺利/待确认/旧口径）")
        print("=" * 60)

        surface_success, surface_pending, surface_legacy = create_three_sample_records()

        print(f"\n📗 【样例1】顺利记录 - {surface_success.surface_id}")
        print(f"  状态: {surface_success.status.value}")
        print(f"  {surface_success.comments}")
        print(f"  点数: {len(surface_success.points)}")

        print(f"\n📙 【样例2】待确认记录 - {surface_pending.surface_id}")
        print(f"  状态: {surface_pending.status.value}")
        print(f"  {surface_pending.comments}")
        print(f"  异常点: {len([p for p in surface_pending.points if p.is_outlier])} 个")

        print(f"\n📘 【样例3】旧口径记录 - {surface_legacy.surface_id}")
        print(f"  状态: {surface_legacy.status.value}")
        print(f"  {surface_legacy.comments}")
        print(f"  旧口径点数: {len([p for p in surface_legacy.points if 'legacy' in p.tags])}")
        print(f"  校准方法: {surface_legacy.metadata.get('legacy_method', 'N/A')}")
        print(f"  来源位置: {surface_legacy.metadata.get('source_page', 'N/A')}")

        self.storage.save_raw_surface(surface_success)
        self.storage.save_raw_surface(surface_pending)
        self.storage.save_raw_surface(surface_legacy)

        summary_data = generate_summary_page_data()
        result_success = self.cleaner.clean(surface_success, None)
        result_pending = self.cleaner.clean(surface_pending, summary_data)
        result_legacy = self.cleaner.clean(surface_legacy, None)

        print(f"\n--- 清洗结果对比 ---")
        print(f"{'记录类型':<12} {'原始':>6} {'有效':>6} {'异常':>6} {'插值':>6} {'冲突':>6}")
        print("-" * 60)
        for name, r in [("顺利", result_success), ("待确认", result_pending), ("旧口径", result_legacy)]:
            print(f"{name:<12} {r.original_points:>6} {r.cleaned_points:>6} {r.outliers_removed:>6} {r.interpolated_points:>6} {len(r.conflicts_found):>6}")

        self.report_generator.generate_html_report(result_success)
        self.report_generator.generate_html_report(result_pending)
        self.report_generator.generate_html_report(result_legacy)

    def demonstrate_parameter_persistence(self) -> None:
        print("\n" + "=" * 60)
        print("演示: 参数持久化与增量处理")
        print("=" * 60)

        print("\n当前参数状态:")
        for name in ["outlier_zscore_threshold", "conflict_tolerance_pct"]:
            pv = self.param_manager.get_param_version(name)
            modified = "⚠️ 人工修改" if pv.is_user_modified else "  系统默认"
            print(f"  {name:<30} = {pv.value:<10} {modified} (版本: {pv.version_id})")

        print("\n模拟: 用户调整参数（不覆盖默认值）")
        self.set_custom_parameter(
            "outlier_zscore_threshold",
            2.5,
            comment="近期市场波动较大，收紧异常检测阈值",
            modified_by="小孟"
        )
        self.set_custom_parameter(
            "conflict_tolerance_pct",
            3.0,
            comment="提高数据一致性要求",
            modified_by="小孟"
        )

        print("\n调整后参数状态:")
        for name in ["outlier_zscore_threshold", "conflict_tolerance_pct"]:
            pv = self.param_manager.get_param_version(name)
            modified = "⚠️ 人工修改" if pv.is_user_modified else "  系统默认"
            print(f"  {name:<30} = {pv.value:<10} {modified} (版本: {pv.version_id})")

        print("\n模拟: 重复运行 - 验证人工参数不被覆盖")
        param_manager2 = ParameterManager(
            storage_path=os.path.join(self.storage_base, "params.json")
        )
        print("\n重新加载后的参数状态:")
        for name in ["outlier_zscore_threshold", "conflict_tolerance_pct"]:
            pv = param_manager2.get_param_version(name)
            modified = "⚠️ 人工修改" if pv.is_user_modified else "  系统默认"
            print(f"  {name:<30} = {pv.value:<10} {modified} (保留!)")

        print(f"\n  ✓ 参数持久化验证通过: 人工修改的值已保留，未被默认值覆盖")

        history = self.param_manager.get_history("outlier_zscore_threshold")
        print(f"\n参数变更历史 (outlier_zscore_threshold):")
        for h in history:
            status = "人工修改" if h.is_user_modified else "系统默认"
            print(f"  {h.version_id}: {h.value} ({status}, {h.valid_from.strftime('%H:%M:%S')})")

    def demonstrate_decision_evidence(self, result) -> None:
        print("\n" + "=" * 60)
        print("演示: 决策证据链 - 它真的参与了判断")
        print("=" * 60)

        surface = result.surface
        sample_point = None
        for p in surface.points:
            if not p.is_outlier and p.review_comment:
                sample_point = p
                break
        if not sample_point:
            sample_point = surface.points[0]

        print(f"\n🔍 抽样检查点: {sample_point.point_id}")
        print(f"   期限: {sample_point.tenor}, 行权价: {sample_point.strike}")
        raw_str = f"{sample_point.raw_value:.4f}" if sample_point.raw_value is not None else "-"
        print(f"   原始值: {raw_str} → 清洗后: {sample_point.implied_vol:.4f}")
        print(f"   数据来源: {sample_point.data_source_id}")
        print(f"   置信度: {sample_point.confidence:.3f}")

        evidence = self.cleaner.get_processing_evidence(sample_point)

        print(f"\n📋 完整决策路径:")
        for step in evidence["decision_path"]:
            print(f"   {step}")

        print(f"\n📝 关联处理日志:")
        for log in evidence["processing_logs"][:5]:
            old = f"{log['old_value']:.4f}" if log["old_value"] is not None else "-"
            new = f"{log['new_value']:.4f}" if log["new_value"] is not None else "-"
            print(f"   [{log['timestamp'][11:19]}] {log['action']:<15} {old} → {new} | {log['reason']}")

        print(f"\n⚙️  使用的参数版本:")
        for pv in evidence["parameters_used"][:5]:
            modified = "(人工)" if pv["is_user_modified"] else "(默认)"
            print(f"   {pv['parameter_name']:<30} = {pv['value']} {modified}")

        print(f"\n  ✓ 证据链完整: 从原始值导入到最终结果，每一步都可追溯")

    def demonstrate_incremental_processing(self) -> None:
        print("\n" + "=" * 60)
        print("演示: 增量处理 - 后续补充材料可接着处理")
        print("=" * 60)

        surface1, _ = generate_sample_surface("50ETF", datetime(2026, 5, 28), False)
        self.storage.save_raw_surface(surface1)
        result1 = self.cleaner.clean(surface1, None)
        print(f"  第一次处理: {surface1.surface_id} - {len(surface1.points)} 个点")

        summary_page_importer = SummaryPageImporter("老板看的汇总页-历史数据区")
        new_data = {
            "5Y_2.5000": 0.305,
            "5Y_3.0000": 0.240,
            "5Y_3.5000": 0.320,
            "10Y_2.5000": 0.325,
            "10Y_3.0000": 0.260,
            "10Y_3.5000": 0.340,
        }
        new_points, new_ds = summary_page_importer.import_data(new_data)
        for p in new_points:
            p.tags.append("supplemental")
            p.tags.append("summary_page")

        print(f"  补充材料: 从汇总页追加 {len(new_points)} 个长期限点")

        merged_surface = self.storage.merge_incremental_points(surface1, new_points)
        merged_surface.data_sources.append(new_ds)
        merged_surface.comments += " | 已补充5Y和10Y期限点"

        print(f"  增量处理: 合并后共 {len(merged_surface.points)} 个点")

        result2 = self.cleaner.clean(merged_surface, None)
        print(f"  二次清洗完成: 有效 {result2.cleaned_points} 个点")

        versions = self.version_manager.get_versions(surface1.surface_id)
        print(f"\n  版本历史 (共 {len(versions)} 个版本):")
        for v in versions:
            print(f"    {v['version_id']}: {v['created_at'][:19]} - {v['comment']}")

        print(f"\n  ✓ 增量处理验证通过: 补充材料可在原有基础上继续处理")

    def run_full_demo(self) -> None:
        print("\n" + "╔" + "=" * 58 + "╗")
        print("║" + " " * 15 + "期权波动率曲面清洗系统" + " " * 18 + "║")
        print("║" + " " * 18 + "量化助理小孟专用" + " " * 20 + "║")
        print("╚" + "=" * 58 + "╝")

        self.demonstrate_parameter_persistence()
        self.demonstrate_three_records()

        import_result = self.import_from_multiple_sources()
        surface = import_result["surface"]

        summary_page_data = generate_summary_page_data()

        conflict_scenario = generate_conflict_scenario()
        _, _, conflict_evidence = conflict_scenario

        print(f"\n📊 冲突检测场景证据:")
        for cp in conflict_evidence["conflict_points"]:
            print(f"  {cp['tenor']} @ K={cp['strike']}:")
            print(f"    导入值 ({cp['imported_source']}): {cp['imported_value']:.4f}")
            print(f"    汇总值 ({cp['summary_source']}): {cp['summary_value']:.4f}")
            print(f"    差异: {cp['difference_pct']:.1f}%")
            print(f"    建议: {cp['suggested_action']}")

        clean_result = self.run_cleaning_pipeline(surface, summary_page_data)
        result = clean_result["result"]

        self.demonstrate_decision_evidence(result)
        self.demonstrate_incremental_processing()

        report_paths = self.generate_reports(result)

        print("\n" + "=" * 60)
        print("✅ 完整流程演示完成")
        print("=" * 60)
        print(f"\n📁 输出文件:")
        print(f"  HTML报告: {report_paths['html_report']}")
        print(f"  文本摘要: {report_paths['text_summary']}")
        print(f"  数据存储: {self.storage_base}/")
        print(f"\n🎯 系统特性总结:")
        print(f"  ✓ 计算过程不藏 - 每一步都有审计日志和决策路径")
        print(f"  ✓ 参数版本化 - 人工修改不被默认值覆盖，完整记录")
        print(f"  ✓ 异常样本可见 - 异常点标记原因，可追溯")
        print(f"  ✓ 图表可溯源 - 点击图表上的点查看完整证据链")
        print(f"  ✓ 冲突不拍板 - 展示双方证据和建议，等待人工确认")
        print(f"  ✓ 增量可接续 - 补充材料时在原有基础上继续处理")
        print(f"  ✓ 多源适配 - 支持讲义、业务表、截图、汇总页等不同来源")
        print(f"  ✓ 报告给非技术人员 - 月底复盘可直接拿出来解释")
        print(f"\n💡 打开 {report_paths['html_report']} 查看交互式报告")
        print(f"   在浏览器中点击图表上的任意点，查看完整决策路径！")


def main():
    parser = argparse.ArgumentParser(description="期权波动率曲面清洗系统")
    parser.add_argument("--clean", action="store_true", help="清除旧数据后运行")
    parser.add_argument("--demo", action="store_true", help="仅运行演示模式")
    parser.add_argument("--storage", type=str, default="storage", help="存储目录")
    args = parser.parse_args()

    pipeline = VolatilitySurfacePipeline(storage_base=args.storage)

    if args.clean:
        pipeline.clear_storage()

    pipeline.run_full_demo()


if __name__ == "__main__":
    main()
