import pandas as pd
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime
import hashlib
from .attribution import AttributionResult
from .sampling import SampleResult
from .matching_engine import MatchResult


class ReportGenerator:
    def __init__(self, output_dir: str = "./output"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.report_hash: str = ""

    def _generate_summary_data(
        self,
        all_attributions: List[AttributionResult],
        sample_results: List[SampleResult],
        match_results: List[MatchResult]
    ) -> Dict[str, Any]:
        total_tickets = len(match_results)
        matched_with_recording = sum(1 for m in match_results if len(m.matched_recordings) > 0)
        no_recording = sum(1 for m in match_results if len(m.matched_recordings) == 0)
        full_match = sum(1 for m in match_results if m.match_status == "完全匹配")
        partial_match = sum(1 for m in match_results if m.match_status == "部分匹配")
        
        reason_summary: Dict[str, int] = {}
        for attr in all_attributions:
            reason = attr.missing_reason_desc
            reason_summary[reason] = reason_summary.get(reason, 0) + 1
        
        summary = {
            '生成时间': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            '总工单数量': total_tickets,
            '有录音工单': matched_with_recording,
            '无录音工单': no_recording,
            '完全匹配工单': full_match,
            '部分匹配工单': partial_match,
            '录音匹配率': f"{(matched_with_recording/total_tickets*100):.1f}%" if total_tickets > 0 else "N/A",
            '抽样数量': len(sample_results),
            '缺失原因分布': reason_summary
        }
        
        return summary

    def _create_summary_sheet(
        self,
        writer: pd.ExcelWriter,
        summary: Dict[str, Any]
    ) -> None:
        summary_rows = []
        for key, value in summary.items():
            if key == '缺失原因分布':
                continue
            summary_rows.append({'项目': key, '值': str(value)})
        
        df_summary = pd.DataFrame(summary_rows)
        df_summary.to_excel(writer, sheet_name='概览', index=False)
        
        if summary['缺失原因分布']:
            reason_rows = [{'缺失原因': k, '工单数量': v} for k, v in summary['缺失原因分布'].items()]
            df_reasons = pd.DataFrame(reason_rows)
            df_reasons.to_excel(writer, sheet_name='缺失原因统计', index=False)

    def _create_matching_sheet(
        self,
        writer: pd.ExcelWriter,
        match_results: List[MatchResult]
    ) -> None:
        match_rows = []
        for result in sorted(match_results, key=lambda x: x.ticket.ticket_id or ""):
            row = {
                '工单号': result.ticket.ticket_id,
                '坐席号': result.ticket.agent_id,
                '匹配状态': result.match_status,
                '匹配分数': result.match_score,
                '是否有录音': len(result.matched_recordings) > 0,
                '匹配录音数': len(result.matched_recordings),
                '录音文件名': "; ".join(r.file_name for r in result.matched_recordings),
                '录音路径': "; ".join(r.file_path for r in result.matched_recordings),
                '匹配问题': " | ".join(result.issues),
                '工单来源文件': result.ticket.source_file,
                '工单来源行号': result.ticket.row_index
            }
            match_rows.append(row)
        
        df_match = pd.DataFrame(match_rows)
        df_match.to_excel(writer, sheet_name='匹配结果详情', index=False)

    def _create_attribution_sheet(
        self,
        writer: pd.ExcelWriter,
        attributions: List[AttributionResult]
    ) -> None:
        attr_rows = []
        for attr in sorted(attributions, key=lambda x: x.ticket_id or ""):
            row = {
                '工单号': attr.ticket_id,
                '缺失原因代码': attr.missing_reason_code,
                '缺失原因描述': attr.missing_reason_desc,
                '置信度': f"{attr.confidence*100:.0f}%",
                '匹配分数': attr.match_score,
                '是否有录音': attr.has_recording,
                '是否有有效坐席': attr.has_valid_agent,
                '录音路径': "; ".join(attr.recording_files),
                '详细信息': " | ".join([f"{k}:{v}" for k, v in attr.details.items()]),
                '来源文件': attr.source_file,
                '来源行号': attr.source_row
            }
            attr_rows.append(row)
        
        df_attr = pd.DataFrame(attr_rows)
        df_attr.to_excel(writer, sheet_name='缺失归因详情', index=False)

    def _create_sampling_sheet(
        self,
        writer: pd.ExcelWriter,
        samples: List[SampleResult]
    ) -> None:
        sample_rows = []
        for sample in sorted(samples, key=lambda x: x.sample_id):
            row = {
                '抽样编号': sample.sample_id,
                '工单号': sample.ticket_id,
                '缺失原因': sample.missing_reason,
                '原因代码': sample.missing_reason_code,
                '置信度': f"{sample.confidence*100:.0f}%",
                '匹配分数': sample.match_score,
                '是否有录音': sample.has_recording,
                '录音路径': sample.recording_paths,
                '详细信息': sample.details,
                '来源文件': sample.source_file,
                '来源行号': sample.source_row,
                '随机种子': sample.random_seed
            }
            sample_rows.append(row)
        
        df_sample = pd.DataFrame(sample_rows)
        df_sample.to_excel(writer, sheet_name='抽样清单', index=False)

    def _create_tracing_sheet(
        self,
        writer: pd.ExcelWriter,
        hash_values: Dict[str, str]
    ) -> None:
        tracing_rows = [{'环节': k, '校验哈希值': v} for k, v in hash_values.items()]
        df_tracing = pd.DataFrame(tracing_rows)
        df_tracing.to_excel(writer, sheet_name='数据校验追踪', index=False)

    def generate_report(
        self,
        match_results: List[MatchResult],
        attribution_results: List[AttributionResult],
        sample_results: List[SampleResult],
        hash_values: Dict[str, str],
        filename: str = None
    ) -> str:
        if filename is None:
            filename = f"质检录音匹配排查_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        
        output_path = self.output_dir / filename
        
        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            summary = self._generate_summary_data(attribution_results, sample_results, match_results)
            self._create_summary_sheet(writer, summary)
            self._create_matching_sheet(writer, match_results)
            self._create_attribution_sheet(writer, attribution_results)
            self._create_sampling_sheet(writer, sample_results)
            self._create_tracing_sheet(writer, hash_values)
        
        self._generate_report_hash(output_path, hash_values)
        return str(output_path)

    def generate_sampling_list_only(
        self,
        sample_results: List[SampleResult],
        filename: str = None
    ) -> str:
        if filename is None:
            filename = f"质检抽样清单_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        
        output_path = self.output_dir / filename
        
        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            self._create_sampling_sheet(writer, sample_results)
        
        return str(output_path)

    def _generate_report_hash(self, output_path: Path, hash_values: Dict[str, str]) -> None:
        content = "|".join(sorted(f"{k}:{v}" for k, v in hash_values.items()))
        self.report_hash = hashlib.md5(content.encode()).hexdigest()

    def print_console_summary(
        self,
        match_results: List[MatchResult],
        attribution_results: List[AttributionResult],
        sample_results: List[SampleResult]
    ) -> None:
        summary = self._generate_summary_data(attribution_results, sample_results, match_results)
        
        print("=" * 60)
        print("  质检录音匹配排查结果概览")
        print("=" * 60)
        print(f"  生成时间: {summary['生成时间']}")
        print(f"  总工单数量: {summary['总工单数量']}")
        print(f"  有录音工单: {summary['有录音工单']}")
        print(f"  无录音工单: {summary['无录音工单']}")
        print(f"  完全匹配工单: {summary['完全匹配工单']}")
        print(f"  部分匹配工单: {summary['部分匹配工单']}")
        print(f"  录音匹配率: {summary['录音匹配率']}")
        print(f"  抽样数量: {summary['抽样数量']}")
        print()
        print("  缺失原因分布:")
        for reason, count in summary['缺失原因分布'].items():
            print(f"    - {reason}: {count} 条")
        print("=" * 60)
