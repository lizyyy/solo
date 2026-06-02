import os
from datetime import datetime
from .config import Config
from .importer import DataImporter
from .merger import DataMerger
from .reviewer import Reviewer
from .exporter import Exporter

class MarketStallRotation:
    def __init__(self):
        Config.ensure_dirs()
        self.importer = DataImporter()
        self.merger = DataMerger()
        self.reviewer = Reviewer()
        self.exporter = Exporter()
        
        self.raw_data = None
        self.merged_data = None
        self.reviewed_data = None
        self.export_result = None
    
    def run_full_process(self, file_path, source_name="农贸市场摊位数据"):
        print("=" * 60)
        print("农贸市场摊位轮换 - 主流程开始")
        print("=" * 60)
        
        print("\n【步骤 1/5: 数据导入中...")
        self.raw_data = self.importer.import_file(file_path, source_name)
        import_summary = self.importer.get_import_summary()
        print(f"  ✓ 导入完成，共 {import_summary['记录数']} 条记录")
        
        issues = self.importer.validate_data()
        if issues:
            print(f"  ⚠ 发现 {len(issues)} 个数据质量问题")
            for issue in issues:
                print(f"    - {issue['message']}")
        
        print("\n【步骤 2/5: 数据归并中...】")
        self.merged_data = self.merger.merge_data(self.raw_data)
        merge_report = self.merger.get_merge_report()
        print(f"  ✓ 归并完成，处理后共 {merge_report['merge_summary']['total_records']} 条记录")
        print(f"  ✓ 归并操作: {merge_report['merge_summary']['merge_operations']} 次")
        
        exceptions = self.merger.get_exceptions_summary()
        if exceptions:
            print(f"  ⚠ 发现 {len(exceptions)} 个异常情况")
            for exc in exceptions:
                print(f"    - 【{exc['类型']}】{exc['详情']}")
        
        print("\n【步骤 3/5: 初始化复核模块...】")
        self.reviewed_data = self.reviewer.load_data(self.merged_data)
        review_summary = self.reviewer.get_review_summary()
        print(f"  ✓ 复核模块就绪")
        print(f"  ✓ 待处理项: {len(self.reviewer.get_pending_items())} 项")
        
        return {
            'import_summary': import_summary,
            'merge_report': merge_report,
            'review_summary': review_summary,
            'data': self.reviewed_data
        }
    
    def add_review_note(self, record_id, note, reviewer="城市规划师小赵"):
        result = self.reviewer.add_note(record_id, note, reviewer)
        self.reviewed_data = self.reviewer.get_reviewed_data()
        return result
    
    def update_record_status(self, record_id, new_status, reason="", reviewer="城市规划师小赵"):
        result = self.reviewer.update_status(record_id, new_status, reason, reviewer)
        self.reviewed_data = self.reviewer.get_reviewed_data()
        return result
    
    def get_review_diffs(self):
        return self.reviewer.get_review_diffs()
    
    def get_review_summary(self):
        return self.reviewer.get_review_summary()
    
    def get_exceptions(self):
        return self.merger.get_exceptions_summary()
    
    def export_results(self, filename_prefix="农贸市场摊位轮换"):
        print("\n【步骤 4/5: 导出结果中...")
        
        merge_report = self.merger.get_merge_report()
        review_summary = self.reviewer.get_review_summary()
        
        self.export_result = self.exporter.export_all(
            self.reviewed_data,
            merge_report=merge_report,
            review_summary=review_summary,
            filename_prefix=filename_prefix
        )
        
        print(f"  ✓ 导出完成，共生成 {len(self.export_result['files'])} 个文件")
        for f in self.export_result['files']:
            print(f"    - {f['type']}: {f['name']}")
        
        print("\n【步骤 5/5: 生成处理摘要...】")
        self._print_final_summary()
        
        return self.export_result
    
    def _print_final_summary(self):
        summary = self.export_result['summary'] if self.export_result else {}
        review_summary = self.reviewer.get_review_summary()
        
        print("\n" + "=" * 60)
        print("农贸市场摊位轮换 - 处理完成")
        print("=" * 60)
        print(f"导出时间: {summary.get('export_time', 'N/A')}")
        print(f"总记录数: {summary.get('total_records', 0)}")
        print(f"状态分布: {summary.get('status_distribution', {})}")
        print(f"数据异常数: {summary.get('merge_exceptions', 0)}")
        print(f"复核变更数: {summary.get('review_changes', 0)}")
        print("\n" + "=" * 60)
        print("城市规划师小赵不用再手工对账了！")
        print("=" * 60)
