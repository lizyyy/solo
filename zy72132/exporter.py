from typing import List
from pathlib import Path
from datetime import datetime
import csv

from database import Record
from rhythm_book import RhythmErrorBook


class ReportExporter:
    def __init__(self, rhythm_book: RhythmErrorBook):
        self.rhythm_book = rhythm_book

    def generate_summary_report(self) -> str:
        records = self.rhythm_book.get_all_records()

        total = len(records)
        normal_count = len([r for r in records if r.status == '正常'])
        pending_count = len([r for r in records if r.status == '待确认'])
        resolved_count = len([r for r in records if r.status == '已解决'])
        deprecated_count = len([r for r in records if r.status == '已废弃'])

        lines = []
        lines.append("=" * 80)
        lines.append("                     音 乐 课 节 奏 错 题 本")
        lines.append("                    MUSIC RHYTHM ERROR BOOK")
        lines.append("=" * 80)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        lines.append(f"【总览统计】")
        lines.append(f"  记录总数: {total} 条")
        lines.append(f"  正常: {normal_count} 条")
        lines.append(f"  待确认: {pending_count} 条 (需要人工处理)")
        lines.append(f"  已解决: {resolved_count} 条")
        lines.append(f"  已废弃: {deprecated_count} 条")
        lines.append("")

        if pending_count > 0:
            lines.append("-" * 80)
            lines.append("【需要关注的记录】")
            lines.append("  以下记录需要人工确认或处理:")
            lines.append("")
            for r in records:
                if r.status == '待确认':
                    lines.append(f"  #{r.id} {r.track_name}")
                    lines.append(f"     文件: {r.file_name}")
                    lines.append(f"     原因: {r.exception_reason or '未说明'}")
                    lines.append(f"     来源: {r.source_type} - {r.source_detail or 'N/A'}")
                    lines.append("")

        lines.append("-" * 80)
        lines.append("【详细清单】")
        lines.append("")

        for idx, r in enumerate(records, 1):
            icon = self.rhythm_book.get_status_icon(r.status)
            lines.append(f"{idx:2d}. [{icon}] {r.track_name}")
            lines.append(f"    ID: {r.id} | 状态: {r.status} | 版本: v{r.version}")
            lines.append(f"    文件: {r.file_name}")
            if r.contract_deadline:
                lines.append(f"    授权截止: {r.contract_deadline}")
            lines.append(f"    来源: {r.source_type} - {r.source_detail or 'N/A'}")
            if r.exception_reason:
                lines.append(f"    异常: {r.exception_reason}")
            if r.notes:
                note_lines = r.notes.split('\n')
                lines.append(f"    备注: {note_lines[0]}")
                for note_line in note_lines[1:]:
                    lines.append(f"          {note_line}")
            lines.append("")

        lines.append("=" * 80)
        lines.append("使用说明:")
        lines.append("  - 状态为「待确认」的记录需要人工核对")
        lines.append("  - 所有变更都有历史记录可追溯")
        lines.append("  - 来源字段可追溯每条记录的导入渠道")
        lines.append("=" * 80)

        return "\n".join(lines)

    def export_to_csv(self, output_path: str) -> bool:
        records = self.rhythm_book.get_all_records()
        file_path = Path(output_path)

        try:
            with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([
                    '序号', '状态', '曲目名称', '文件名', '文件路径',
                    '来源类型', '来源详情', '异常原因', '备注',
                    '授权截止', '创建时间', '更新时间', '版本'
                ])

                for idx, r in enumerate(records, 1):
                    writer.writerow([
                        idx, r.status, r.track_name, r.file_name, r.file_path or '',
                        r.source_type, r.source_detail or '', r.exception_reason or '',
                        r.notes or '', r.contract_deadline or '',
                        r.created_at, r.updated_at, r.version
                    ])
            return True
        except Exception as e:
            print(f"导出CSV失败: {e}")
            return False

    def print_console_report(self):
        report = self.generate_summary_report()
        print(report)

    def export_to_txt(self, output_path: str) -> bool:
        report = self.generate_summary_report()
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(report)
            return True
        except Exception as e:
            print(f"导出TXT失败: {e}")
            return False

    def generate_pending_actions_report(self) -> str:
        records = self.rhythm_book.get_records_by_status('待确认')

        lines = []
        lines.append("=" * 80)
        lines.append("                音 乐 课 节 奏 错 题 本 - 待 处 理 清 单")
        lines.append("=" * 80)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"待处理记录: {len(records)} 条")
        lines.append("")

        if not records:
            lines.append("  太棒了！目前没有需要处理的记录。")
        else:
            for idx, r in enumerate(records, 1):
                lines.append(f"【第 {idx} 项】")
                lines.append(f"  曲目: {r.track_name}")
                lines.append(f"  问题: {r.exception_reason or '需要确认'}")
                lines.append(f"  源文件: {r.file_name}")
                lines.append(f"  来源渠道: {r.source_type}")
                lines.append(f"  记录ID: {r.id}")
                lines.append("")

        lines.append("=" * 80)
        return "\n".join(lines)
