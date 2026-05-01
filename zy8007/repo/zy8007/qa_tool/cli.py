"""命令行入口模块"""

import argparse
import os
import sys
from typing import List, Optional
from dataclasses import dataclass

from .modules.data_import import DataImporter, QAEntry, ProductParam, CustomerQuestion
from .modules.text_cleaner import TextCleaner, CleanResult
from .modules.similarity_search import SimilaritySearch, SimilarMatch, ClusterResult
from .modules.conflict_detector import ConflictDetector, ConflictReport
from .modules.draft_generator import DraftGenerator, AnswerDraft
from .modules.report_exporter import ReportExporter


@dataclass
class ProcessingResult:
    """处理结果"""
    original_qa_count: int
    cleaned_qa_count: int
    param_count: int
    question_count: int
    clean_result: Optional[CleanResult]
    conflict_report: Optional[ConflictReport]
    drafts: List[AnswerDraft]
    clusters: Optional[List[ClusterResult]]
    output_files: List[str]


class QAToolPipeline:
    """QA工具主流程"""
    
    def __init__(
        self,
        output_dir: str = "out",
        similarity_threshold: float = 0.6,
        verbose: bool = False
    ):
        self.output_dir = output_dir
        self.similarity_threshold = similarity_threshold
        self.verbose = verbose
        
        self.importer = DataImporter()
        self.cleaner = TextCleaner()
        self.similarity_search = SimilaritySearch(
            similarity_threshold=similarity_threshold
        )
        self.conflict_detector = ConflictDetector(
            similarity_search=self.similarity_search,
            similarity_threshold=0.8
        )
        self.draft_generator = DraftGenerator(
            similarity_search=self.similarity_search,
            conflict_detector=self.conflict_detector
        )
        self.exporter = ReportExporter(output_dir=output_dir)
    
    def _log(self, message: str):
        """日志输出"""
        if self.verbose:
            print(f"[INFO] {message}")
    
    def load_data(
        self,
        qa_files: List[str],
        param_files: List[str],
        question_file: str,
        qa_format: str = "csv",
        question_format: str = "txt"
    ) -> tuple:
        """加载所有数据"""
        self._log("开始加载数据...")
        
        qa_count = 0
        for qa_file in qa_files:
            if not os.path.exists(qa_file):
                print(f"[警告] Q&A文件不存在: {qa_file}")
                continue
            
            if qa_format == "json" or qa_file.endswith('.json'):
                count = self.importer.load_qa_json(qa_file)
            else:
                count = self.importer.load_qa_csv(qa_file)
            qa_count += count
            self._log(f"  从 {qa_file} 加载了 {count} 条Q&A")
        
        param_count = 0
        for param_file in param_files:
            if not os.path.exists(param_file):
                print(f"[警告] 参数文件不存在: {param_file}")
                continue
            
            count = self.importer.load_product_params_csv(param_file)
            param_count += count
            self._log(f"  从 {param_file} 加载了 {param_count} 条参数")
        
        question_count = 0
        if question_file and os.path.exists(question_file):
            if question_format == "csv" or question_file.endswith('.csv'):
                question_count = self.importer.load_customer_questions_csv(question_file)
            else:
                question_count = self.importer.load_customer_questions_txt(question_file)
            self._log(f"  从 {question_file} 加载了 {question_count} 个客户问题")
        elif question_file:
            print(f"[警告] 客户问题文件不存在: {question_file}")
        
        self._log(f"数据加载完成: Q&A={qa_count}, 参数={param_count}, 问题={question_count}")
        
        return qa_count, param_count, question_count
    
    def clean_data(self) -> CleanResult:
        """清洗数据"""
        self._log("开始清洗数据...")
        
        qa_entries = self.importer.get_all_qa()
        cleaned_entries, clean_result = self.cleaner.clean_qa_entries(qa_entries)
        
        self._log(f"数据清洗完成: 原始={clean_result.original_count}, "
                  f"清洗后={clean_result.cleaned_count}, "
                  f"移除空答案={clean_result.removed_empty}, "
                  f"移除重复={clean_result.removed_duplicates}")
        
        product_params = self.importer.get_all_params()
        normalized_params = self.cleaner.normalize_product_params(product_params)
        
        customer_questions = self.importer.get_all_questions()
        normalized_questions = self.cleaner.normalize_customer_questions(customer_questions)
        
        self.importer.clear()
        for entry in cleaned_entries:
            self.importer.qa_entries.append(entry)
        for param in normalized_params:
            self.importer.product_params.append(param)
        for question in normalized_questions:
            self.importer.customer_questions.append(question)
        
        return clean_result
    
    def build_index(self):
        """构建搜索索引"""
        self._log("正在构建搜索索引...")
        
        qa_entries = self.importer.get_all_qa()
        product_params = self.importer.get_all_params()
        
        self.similarity_search.index_qa_entries(qa_entries)
        self.similarity_search.index_product_params(product_params)
        
        self._log(f"索引构建完成: Q&A={len(qa_entries)}, 参数={len(product_params)}")
    
    def detect_conflicts(self) -> ConflictReport:
        """检测冲突"""
        self._log("正在检测冲突...")
        
        qa_entries = self.importer.get_all_qa()
        product_params = self.importer.get_all_params()
        
        conflict_report = self.conflict_detector.generate_conflict_report(
            qa_entries, product_params
        )
        
        self._log(f"冲突检测完成: Q&A冲突={conflict_report.total_qa_conflicts}, "
                  f"参数冲突={conflict_report.total_param_conflicts}")
        
        return conflict_report
    
    def generate_drafts(
        self,
        top_similar: int = 3,
        top_params: int = 2
    ) -> List[AnswerDraft]:
        """生成答复草稿"""
        self._log("正在生成答复草稿...")
        
        customer_questions = self.importer.get_all_questions()
        
        if not customer_questions:
            self._log("没有客户问题需要处理")
            return []
        
        drafts = self.draft_generator.generate_drafts_for_questions(
            customer_questions,
            top_similar=top_similar,
            top_params=top_params
        )
        
        stats = self.draft_generator.get_statistics(drafts)
        self._log(f"草稿生成完成: 共 {stats['total_questions']} 个问题, "
                  f"平均置信度={stats['average_confidence']:.1%}")
        
        return drafts
    
    def cluster_questions(self) -> Optional[List[ClusterResult]]:
        """聚类相似问题"""
        self._log("正在聚类相似问题...")
        
        customer_questions = self.importer.get_all_questions()
        
        if len(customer_questions) < 2:
            self._log("问题数量不足，跳过聚类")
            return None
        
        questions = [q.question for q in customer_questions]
        clusters = self.similarity_search.cluster_similar_questions(
            questions, threshold=self.similarity_threshold
        )
        
        large_clusters = [c for c in clusters if c.size > 1]
        self._log(f"聚类完成: 发现 {len(large_clusters)} 个相似问题组")
        
        return clusters
    
    def export_results(
        self,
        drafts: List[AnswerDraft],
        conflict_report: ConflictReport,
        clean_result: Optional[CleanResult] = None,
        clusters: Optional[List[ClusterResult]] = None
    ) -> List[str]:
        """导出结果"""
        self._log("正在导出结果...")
        
        output_files = []
        
        stats = self.draft_generator.get_statistics(drafts) if drafts else None
        
        report_path = self.exporter.export_qa_report(
            drafts=drafts,
            conflict_report=conflict_report,
            clean_result=clean_result,
            clusters=clusters,
            stats=stats
        )
        output_files.append(report_path)
        self._log(f"  已生成: {report_path}")
        
        if drafts:
            csv_path = self.exporter.export_drafts_csv(drafts)
            output_files.append(csv_path)
            self._log(f"  已生成: {csv_path}")
        
        qa_count = len(self.importer.get_all_qa())
        param_count = len(self.importer.get_all_params())
        question_count = len(self.importer.get_all_questions())
        
        summary_path = self.exporter.export_processing_summary(
            qa_count=qa_count,
            param_count=param_count,
            question_count=question_count,
            clean_result=clean_result
        )
        output_files.append(summary_path)
        self._log(f"  已生成: {summary_path}")
        
        self._log("结果导出完成")
        
        return output_files
    
    def run(
        self,
        qa_files: List[str],
        param_files: List[str],
        question_file: str,
        qa_format: str = "csv",
        question_format: str = "txt",
        top_similar: int = 3,
        top_params: int = 2,
        skip_clustering: bool = False
    ) -> ProcessingResult:
        """执行完整流程"""
        print("=" * 60)
        print("招投标问答资料整理工具")
        print("=" * 60)
        
        qa_count, param_count, question_count = self.load_data(
            qa_files, param_files, question_file, qa_format, question_format
        )
        
        if qa_count == 0 and param_count == 0:
            print("[错误] 没有加载到任何Q&A或产品参数数据")
            sys.exit(1)
        
        clean_result = self.clean_data()
        cleaned_qa_count = clean_result.cleaned_count
        
        self.build_index()
        
        conflict_report = self.detect_conflicts()
        
        drafts = self.generate_drafts(top_similar=top_similar, top_params=top_params)
        
        clusters = None
        if not skip_clustering and question_count >= 2:
            clusters = self.cluster_questions()
        
        output_files = self.export_results(
            drafts=drafts,
            conflict_report=conflict_report,
            clean_result=clean_result,
            clusters=clusters
        )
        
        print("\n" + "=" * 60)
        print("处理完成！")
        print("=" * 60)
        print(f"  原始Q&A: {qa_count} 条")
        print(f"  清洗后Q&A: {cleaned_qa_count} 条")
        print(f"  产品参数: {param_count} 条")
        print(f"  客户问题: {question_count} 个")
        print(f"  检测到冲突: {conflict_report.total_qa_conflicts + conflict_report.total_param_conflicts} 个")
        print(f"  生成草稿: {len(drafts)} 个")
        print("\n输出文件:")
        for f in output_files:
            print(f"  - {f}")
        print("=" * 60)
        
        return ProcessingResult(
            original_qa_count=qa_count,
            cleaned_qa_count=cleaned_qa_count,
            param_count=param_count,
            question_count=question_count,
            clean_result=clean_result,
            conflict_report=conflict_report,
            drafts=drafts,
            clusters=clusters,
            output_files=output_files
        )


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description="招投标问答资料整理工具 - 本地离线处理历史Q&A、产品参数和客户问题",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 基本用法
  qa_tool --qa data/qa_history.csv --params data/product_params.csv --questions data/customer_questions.txt
  
  # 使用多个Q&A文件
  qa_tool --qa data/qa1.csv --qa data/qa2.csv --params data/params.csv --questions data/questions.txt
  
  # 调整相似度阈值
  qa_tool --qa data/qa.csv --params data/params.csv --questions data/questions.txt --threshold 0.7
  
  # 详细输出
  qa_tool --qa data/qa.csv --params data/params.csv --questions data/questions.txt --verbose
        """
    )
    
    parser.add_argument(
        "--qa", "-q",
        action="append",
        default=[],
        help="历史Q&A文件路径 (CSV或JSON格式)，可多次指定"
    )
    
    parser.add_argument(
        "--params", "-p",
        action="append",
        default=[],
        help="产品参数文件路径 (CSV格式)，可多次指定"
    )
    
    parser.add_argument(
        "--questions", "-c",
        required=True,
        help="客户问题文件路径 (TXT或CSV格式)"
    )
    
    parser.add_argument(
        "--qa-format",
        choices=["csv", "json"],
        default="csv",
        help="Q&A文件格式 (默认: csv)"
    )
    
    parser.add_argument(
        "--question-format",
        choices=["txt", "csv"],
        default="txt",
        help="客户问题文件格式 (默认: txt)"
    )
    
    parser.add_argument(
        "--threshold", "-t",
        type=float,
        default=0.6,
        help="相似度阈值 (0.0-1.0，默认: 0.6)"
    )
    
    parser.add_argument(
        "--top-similar",
        type=int,
        default=3,
        help="每个问题返回的相似Q&A数量 (默认: 3)"
    )
    
    parser.add_argument(
        "--top-params",
        type=int,
        default=2,
        help="每个问题返回的相关参数数量 (默认: 2)"
    )
    
    parser.add_argument(
        "--output", "-o",
        default="out",
        help="输出目录 (默认: out)"
    )
    
    parser.add_argument(
        "--skip-clustering",
        action="store_true",
        help="跳过问题聚类步骤"
    )
    
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="显示详细输出信息"
    )
    
    parser.add_argument(
        "--version",
        action="version",
        version="qa_tool 0.1.0"
    )
    
    args = parser.parse_args()
    
    if not args.qa and not args.params:
        parser.error("必须至少指定一个Q&A文件 (--qa) 或参数文件 (--params)")
    
    if args.threshold < 0.0 or args.threshold > 1.0:
        parser.error("相似度阈值必须在 0.0 和 1.0 之间")
    
    pipeline = QAToolPipeline(
        output_dir=args.output,
        similarity_threshold=args.threshold,
        verbose=args.verbose
    )
    
    try:
        pipeline.run(
            qa_files=args.qa,
            param_files=args.params,
            question_file=args.questions,
            qa_format=args.qa_format,
            question_format=args.question_format,
            top_similar=args.top_similar,
            top_params=args.top_params,
            skip_clustering=args.skip_clustering
        )
    except KeyboardInterrupt:
        print("\n[中断] 用户取消操作")
        sys.exit(1)
    except Exception as e:
        print(f"[错误] {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
