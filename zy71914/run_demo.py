"""课程音频切片系统 - 完整演示脚本

演示完整工作流：
1. 导入广告口播表和原始音轨
2. 自动计算切片
3. 检测静音段问题并溯源
4. 手动复核、修正字幕
5. 生成可视化HTML报告
6. 导出上线清单
"""

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from audio_slicer.workflow import AudioSlicerWorkflow
from audio_slicer.report import ReportGenerator
from audio_slicer.engine import SliceCalculator
from examples.sample_data import AD_SPOTS, RAW_TRACKS


def main():
    print("=" * 70)
    print("🎙️  课程音频切片系统 - 完整演示")
    print("=" * 70)

    output_dir = os.path.join(os.path.dirname(__file__), "output")
    os.makedirs(output_dir, exist_ok=True)

    print("\n📥 [步骤1] 初始化工作流，导入源数据...")
    workflow = AudioSlicerWorkflow(project_name="Python高级技巧课程_第3期")

    result = workflow.run_full_workflow(
        ad_data=AD_SPOTS,
        track_data=RAW_TRACKS,
        operator="张小明"
    )

    print(f"   ✅ 导入广告口播: {result['ad_count']} 条")
    print(f"   ✅ 导入原始音轨: {result['track_count']} 条")
    print(f"   ✅ 生成切片: {result['slice_count']} 个")
    print(f"   ✅ 时间轴漂移修正: {result['drift_correction_seconds']:.3f} 秒")
    print(f"   ✅ 检测到静音段问题: {result['silence_issues_count']} 个")
    if result['warnings']:
        for w in result['warnings']:
            print(f"   ⚠️  {w}")

    print("\n🔍 [步骤2] 查看切片和来源追溯...")
    for idx, s in enumerate(workflow.project.slices[:3], 1):
        trace = workflow.tracer.trace_slice_source(s.id)
        print(f"\n   切片 {idx}: {s.name}")
        print(f"      时间: {SliceCalculator.format_time(s.start_time)} - {SliceCalculator.format_time(s.end_time)}")
        print(f"      来源: {s.source_ref}")
        print(f"      关联源数据: {len(trace.get('sources', []))} 个")
        for src in trace.get('sources', []):
            print(f"        → {src['name']}: {src['data']['name']}")

    print("\n🔇 [步骤3] 静音段问题溯源...")
    for idx, issue in enumerate(workflow.project.silence_issues, 1):
        details = workflow.tracer.get_silence_issue_details(issue.id)
        src_type = details.get('source_details', {}).get('type', '未知') if details.get('source_details') else '未知'
        print(f"\n   问题 {idx}: {issue.start_time:.2f}s - {issue.end_time:.2f}s (时长 {issue.duration:.2f}s)")
        print(f"      来源: {issue.source_ref}")
        print(f"      来源类型: {src_type}")
        print(f"      检测方式: {issue.detected_from}")
        print(f"      建议处理: {issue.action_suggested}")
        print(f"      联系人: {issue.contact_person}")

    print("\n✏️  [步骤4] 模拟播客剪辑修改字幕草稿...")
    print("   (演示：修改切片的字幕，记录历史)")

    for s in workflow.project.slices:
        if "装饰器" in s.name:
            old_subtitle = s.subtitle_draft
            new_subtitle = old_subtitle + " 【重要】装饰器的本质是高阶函数返回闭包。"

            warnings = workflow.reviewer.update_subtitle(
                slice_id=s.id,
                new_subtitle=new_subtitle,
                is_final=False,
                operator="李剪辑",
                reason="播客剪辑手动修改，补充重要提示"
            )
            print(f"   ✅ 修改切片[{s.name}]字幕草稿")
            print(f"      变更: {len(old_subtitle)}字 → {len(new_subtitle)}字")

            history = workflow.history.get_history_for_slice(s.id)
            print(f"      历史记录: {len(history)} 条")
            for h in history:
                print(f"        [{h['timestamp']}] {h['operator']}: {h['diff_summary']} - {h['reason']}")

            final_subtitle = new_subtitle.replace("【重要】", "💡") + " 建议配合示例代码理解。"
            warnings = workflow.reviewer.update_subtitle(
                slice_id=s.id,
                new_subtitle=final_subtitle,
                is_final=True,
                operator="王审核",
                reason="审核通过，优化表述"
            )
            print(f"   ✅ 更新切片[{s.name}]字幕最终版")

    print("\n✅ [步骤5] 模拟复核流程...")
    for idx, s in enumerate(workflow.project.slices, 1):
        if idx <= 3:
            approved = idx != 2
            comments = "内容准确，时间正确" if approved else "时间轴需要调整"
            corrections = {"end_time": s.end_time + 0.5} if not approved else None

            slice_obj, warnings = workflow.reviewer.review_slice(
                slice_id=s.id,
                reviewer="王审核",
                approved=approved,
                comments=comments,
                corrections=corrections
            )
            status = "通过" if approved else "拒绝"
            print(f"   切片 {idx}: [{s.name}] → 复核{status}")
            if corrections:
                print(f"      已修正结束时间 +0.5秒")

    summary = workflow.reviewer.get_review_summary()
    print(f"\n   复核进度: {summary['progress']}%")
    print(f"   总计: {summary['total']} | 已复核: {summary['reviewed']} | "
          f"通过: {summary['approved']} | 待处理: {summary['pending']}")

    print("\n📊 [步骤6] 生成可视化HTML报告...")
    report_gen = ReportGenerator(workflow.project)
    report_path = report_gen.generate_report(
        os.path.join(output_dir, "audio_slicer_report.html")
    )
    print(f"   ✅ HTML报告已生成: {report_path}")

    print("\n📤 [步骤7] 导出上线清单和数据...")

    slices_csv = workflow.exporter.export_slices_to_csv(
        os.path.join(output_dir, "slices_all.csv"),
        only_approved=False
    )
    print(f"   ✅ 完整切片清单: {slices_csv}")

    approved_csv = workflow.exporter.export_slices_to_csv(
        os.path.join(output_dir, "slices_approved.csv"),
        only_approved=True
    )
    print(f"   ✅ 已通过切片清单: {approved_csv}")

    silence_csv = workflow.exporter.export_silence_issues_to_csv(
        os.path.join(output_dir, "silence_issues.csv"),
        only_open=True
    )
    print(f"   ✅ 静音段问题清单: {silence_csv}")

    manifest_json = workflow.exporter.export_manifest_json(
        os.path.join(output_dir, "publish_manifest.json")
    )
    print(f"   ✅ 上线清单JSON: {manifest_json}")

    history_csv = workflow.exporter.export_history_to_csv(
        os.path.join(output_dir, "history_log.csv")
    )
    print(f"   ✅ 历史操作记录: {history_csv}")

    project_json = workflow.save_project(
        os.path.join(output_dir, "project_data.json")
    )
    print(f"   ✅ 完整项目数据: {project_json}")

    print("\n🔄 [步骤8] 演示项目保存与加载...")
    new_workflow = AudioSlicerWorkflow("空项目")
    loaded = new_workflow.load_project(project_json)
    if loaded:
        print(f"   ✅ 项目加载成功: {new_workflow.project.name}")
        print(f"      切片数量: {len(new_workflow.project.slices)}")
        print(f"      历史记录: {len(new_workflow.project.history)}")

    print("\n" + "=" * 70)
    print("🎉 演示完成！")
    print("=" * 70)
    print("\n📂 输出文件位置:")
    print(f"   {output_dir}/")
    print("   ├── audio_slicer_report.html  (可视化报告，双击打开)")
    print("   ├── slices_all.csv            (所有切片清单)")
    print("   ├── slices_approved.csv       (已通过切片清单)")
    print("   ├── silence_issues.csv        (静音段问题清单)")
    print("   ├── publish_manifest.json     (上线清单)")
    print("   ├── history_log.csv           (历史操作记录)")
    print("   └── project_data.json         (完整项目数据)")
    print("\n💡 提示: 直接在浏览器中打开 audio_slicer_report.html 查看可视化报告")
    print("   报告中支持：")
    print("   - 点击切片来源可回溯到广告口播表或原始音轨")
    print("   - 点击静音段问题可查看来源和处理建议")
    print("   - 查看字幕修改的完整历史记录")
    print("   - 时间轴可视化对比三类数据")
    print("\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())
