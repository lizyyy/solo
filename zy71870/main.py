#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import pandas as pd
from datetime import datetime
from jinja2 import Environment, FileSystemLoader

from config import DATA_DIR, REPORT_DIR, TEMPLATE_DIR
from data_importer import DataImporter
from fairness_model import FairnessModel
from history_tracker import HistoryTracker
from fairness_errors import format_error_for_display, FairnessError


class FairnessAnalyzer:
    def __init__(self):
        self.importer = DataImporter()
        self.model = FairnessModel()
        self.tracker = HistoryTracker()
        self.current_data = None
        self.import_summary = None
        self.import_errors = []
        self.param_errors = []

    def import_schedule(self, file_name: str) -> bool:
        file_path = os.path.join(DATA_DIR, file_name)
        
        try:
            self.current_data, self.import_summary = self.importer.import_file(file_path)
            self.import_errors = []
            return True
        except FairnessError as e:
            self.import_errors = [format_error_for_display(e)]
            return False
        except Exception as e:
            self.import_errors = [{
                "icon": "❌",
                "title": "未知错误",
                "message": f"导入数据时发生错误: {str(e)}",
                "suggestion": "请检查数据文件格式是否正确",
                "responsible": "技术支持",
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }]
            return False

    def evaluate_fairness(self) -> dict:
        if self.current_data is None:
            return {}
        
        try:
            results = self.model.evaluate(self.current_data)
            return results
        except FairnessError as e:
            self.param_errors = [format_error_for_display(e)]
            return {}
        except Exception as e:
            self.param_errors = [{
                "icon": "❌",
                "title": "评估失败",
                "message": f"公平性评估时发生错误: {str(e)}",
                "suggestion": "请检查数据格式是否正确",
                "responsible": "技术支持",
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }]
            return {}

    def update_parameters(self, new_params: dict, modified_by: str = "未指定", 
                          change_reason: str = "") -> bool:
        try:
            self.model.set_parameters(new_params)
            self.param_errors = []
            
            results = self.evaluate_fairness()
            
            snapshot_id = self.tracker.snapshot(
                parameters=self.model.parameters.copy(),
                model_description=self.model.get_model_description(),
                modified_by=modified_by,
                change_reason=change_reason,
                results=results
            )
            
            return True
        except FairnessError as e:
            self.param_errors = [format_error_for_display(e)]
            return False
        except Exception as e:
            self.param_errors = [{
                "icon": "❌",
                "title": "参数更新失败",
                "message": str(e),
                "suggestion": "请检查参数取值是否合法",
                "responsible": "主教练 (张指导)",
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }]
            return False

    def generate_report(self, output_file: str = None) -> str:
        if not output_file:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_file = os.path.join(REPORT_DIR, f"fairness_report_{timestamp}.html")

        env = Environment(loader=FileSystemLoader(TEMPLATE_DIR))
        template = env.get_template('report_template.html')

        validation_results = self.model.validation_results
        suggestions = self.model.get_suggestions() if validation_results else []
        
        history_snapshots = self.tracker.list_snapshots(limit=10)
        last_changes = []
        if history_snapshots and history_snapshots[-1]["parameter_changes"]:
            last_changes = history_snapshots[-1]["parameter_changes"]

        html_content = template.render(
            import_summary=self.import_summary,
            import_errors=self.import_errors,
            validation_results=validation_results,
            suggestions=suggestions,
            parameters=self.model.parameters,
            model_description=self.model.get_model_description(),
            param_errors=self.param_errors,
            last_changes=last_changes,
            history_snapshots=list(reversed(history_snapshots))
        )

        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(html_content)

        return output_file

    def export_results_excel(self, output_file: str = None) -> str:
        if not output_file:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_file = os.path.join(REPORT_DIR, f"fairness_results_{timestamp}.xlsx")

        results_df = self.model.export_results_to_dataframe()
        
        with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
            results_df.to_excel(writer, sheet_name='各队公平性得分', index=False)
            
            if self.current_data is not None:
                self.current_data.to_excel(writer, sheet_name='原始赛程数据', index=False)
            
            summary_data = {
                '评估项目': ['综合公平性得分', '休息时间公平性', '背靠背公平性', '场地均衡性', '对手强度均衡性'],
                '得分': [
                    self.model.validation_results.get('overall_score', ''),
                    self.model.validation_results.get('rest_time_fairness', {}).get('overall', ''),
                    self.model.validation_results.get('back_to_back_fairness', {}).get('overall', ''),
                    self.model.validation_results.get('venue_balance', {}).get('overall', ''),
                    self.model.validation_results.get('opponent_strength_fairness', {}).get('overall', '')
                ]
            }
            pd.DataFrame(summary_data).to_excel(writer, sheet_name='评估汇总', index=False)

        return output_file

    def list_available_files(self) -> list:
        return self.importer.list_available_files()


def main():
    print("=" * 60)
    print("🏆 赛程公平性建模工具")
    print("=" * 60)
    
    analyzer = FairnessAnalyzer()
    
    available_files = analyzer.list_available_files()
    
    if not available_files:
        print("\n❌ data 目录中没有找到可用的赛程文件")
        print("💡 请将赛程文件 (Excel/CSV) 放入 data 目录后重新运行")
        print("\n支持的文件格式: .xlsx, .xls, .csv")
        print("\n必需的数据列: 比赛日期, 比赛时间, 主队, 客队, 场地, 主队排名, 客队排名")
        return
    
    print(f"\n📂 找到 {len(available_files)} 个数据文件:")
    for i, f in enumerate(available_files, 1):
        print(f"  {i}. {f}")
    
    selected_file = available_files[0]
    print(f"\n📥 正在导入: {selected_file}")
    
    if analyzer.import_schedule(selected_file):
        print("✅ 数据导入成功")
        
        if analyzer.import_summary and analyzer.import_summary.get('unit_issues'):
            print(f"\n⚠️  检测到 {len(analyzer.import_summary['unit_issues'])} 个单位问题")
            for issue in analyzer.import_summary['unit_issues']:
                print(f"   - {issue['details']['column_name']}: {issue['details']['found_unit']} -> {issue['details']['expected_unit']}")
                print(f"     对接人: {issue['responsible_person']}")
        
        print("\n🔍 开始公平性评估...")
        results = analyzer.evaluate_fairness()
        
        if results:
            print(f"✅ 评估完成")
            print(f"\n📊 评估结果:")
            print(f"   综合得分: {results['overall_score']} ({results['fairness_level']})")
            print(f"   休息时间: {results['rest_time_fairness']['overall']}")
            print(f"   背靠背: {results['back_to_back_fairness']['overall']}")
            print(f"   场地均衡: {results['venue_balance']['overall']}")
            print(f"   对手强度: {results['opponent_strength_fairness']['overall']}")
            
            print(f"\n💡 优化建议:")
            for suggestion in analyzer.model.get_suggestions():
                print(f"   - {suggestion}")
        
        print("\n💾 保存初始参数快照...")
        analyzer.update_parameters(
            analyzer.model.parameters,
            modified_by="系统初始化",
            change_reason="初始参数配置"
        )
        print("✅ 参数已保存到历史记录")
        
        print("\n📄 生成HTML报告...")
        report_path = analyzer.generate_report()
        print(f"✅ 报告已生成: {report_path}")
        
        print("\n📊 导出Excel结果...")
        excel_path = analyzer.export_results_excel()
        print(f"✅ Excel已导出: {excel_path}")
        
        print("\n" + "=" * 60)
        print("🎉 分析完成！")
        print(f"\n📁 打开报告查看详细结果:")
        print(f"   file://{report_path}")
        print("=" * 60)
    else:
        print("\n❌ 数据导入失败")
        for error in analyzer.import_errors:
            print(f"\n{error['icon']} {error['title']}")
            print(f"   {error['message']}")
            if error['suggestion']:
                print(f"   💡 {error['suggestion']}")
            if error['responsible']:
                print(f"   👤 对接人: {error['responsible']}")


if __name__ == "__main__":
    main()
