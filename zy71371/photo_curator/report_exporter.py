import os
import json
import csv
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import pandas as pd
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from .models import PhotoRecord, PhotoStatus, CurateResult, DuplicateGroup


console = Console()


class ReportExporter:
    def __init__(self, output_dir: str = "./output"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def _generate_filename(self, prefix: str, suffix: str, ext: str) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return f"{prefix}_{suffix}_{timestamp}.{ext}"
    
    def export_summary(self, result: CurateResult, title: str = "选片报告") -> str:
        summary_file = self.output_dir / self._generate_filename("summary", title, "md")
        
        content = []
        content.append(f"# {title}")
        content.append("")
        content.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        content.append("")
        content.append("## 概览")
        content.append("")
        content.append("| 指标 | 数值 |")
        content.append("|------|------|")
        content.append(f"| 总照片数 | {result.total_photos} |")
        content.append(f"| 保留照片 | {result.keep_count} |")
        content.append(f"| 移除照片 | {result.remove_count} |")
        content.append(f"| 平均评分 | {result.average_score:.2f} |")
        content.append(f"| 处理时间 | {result.processing_time:.2f}秒 |")
        content.append("")
        
        content.append("## 移除原因分布")
        content.append("")
        content.append("| 原因 | 数量 | 占比 |")
        content.append("|------|------|------|")
        total_removed = result.remove_count or 1
        reasons = [
            ("重复照片", result.photos_removed_as_duplicate),
            ("闭眼照片", result.photos_removed_closed_eyes),
            ("低评分", result.photos_removed_low_score),
            ("手动删除", result.photos_removed_manual),
        ]
        for reason, count in reasons:
            percentage = (count / total_removed) * 100 if total_removed > 0 else 0
            content.append(f"| {reason} | {count} | {percentage:.1f}% |")
        content.append("")
        
        content.append("## 重复照片分析")
        content.append("")
        content.append(f"- 重复组数: {result.duplicate_groups}")
        content.append(f"- 重复照片数: {result.photos_removed_as_duplicate}")
        content.append("")
        
        content.append("## 重点人物统计")
        content.append("")
        if result.key_persons_found:
            content.append("| 人物 | 照片数 |")
            content.append("|------|--------|")
            for person in sorted(result.key_persons_found):
                count = result.key_person_photos.get(person, 0)
                content.append(f"| {person} | {count} |")
        else:
            content.append("未检测到重点人物")
        content.append("")
        
        content.append("## 备注")
        content.append("")
        content.append("- 本报告由 photo-curator-cli 自动生成")
        content.append("- 详细明细请参考配套的 CSV/JSON 文件")
        
        with open(summary_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(content))
        
        console.print(f"[green]摘要报告已导出:[/green] {summary_file}")
        return str(summary_file)
    
    def export_details_csv(self, photos: List[PhotoRecord], title: str = "details") -> str:
        details_file = self.output_dir / self._generate_filename("details", title, "csv")
        
        rows = []
        for photo in photos:
            row = photo.to_dict()
            rows.append(row)
        
        df = pd.DataFrame(rows)
        df.to_csv(details_file, index=False, encoding='utf-8-sig')
        
        console.print(f"[green]详细明细已导出:[/green] {details_file}")
        return str(details_file)
    
    def export_details_json(self, photos: List[PhotoRecord], title: str = "details") -> str:
        details_file = self.output_dir / self._generate_filename("details", title, "json")
        
        data = {
            "export_time": datetime.now().isoformat(),
            "total_photos": len(photos),
            "photos": [p.to_dict() for p in photos]
        }
        
        with open(details_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        console.print(f"[green]JSON明细已导出:[/green] {details_file}")
        return str(details_file)
    
    def export_duplicate_groups(self, groups: List[DuplicateGroup], title: str = "duplicates") -> str:
        dup_file = self.output_dir / self._generate_filename("duplicates", title, "md")
        
        content = []
        content.append("# 重复照片组明细")
        content.append("")
        content.append(f"共 {len(groups)} 个重复组")
        content.append("")
        
        for i, group in enumerate(groups, 1):
            content.append(f"## 重复组 {i}: {group.group_id}")
            content.append("")
            content.append("| 排名 | 文件名 | 评分 | 状态 | 原因 |")
            content.append("|------|--------|------|------|------|")
            
            for photo in sorted(group.photos, key=lambda p: p.duplicate_rank):
                status_emoji = "✅" if photo.status == PhotoStatus.KEEP else "❌"
                content.append(f"| {photo.duplicate_rank} | {photo.metadata.file_name} | {photo.score:.1f} | {status_emoji} {photo.status.value} | {photo.status_reason or ''} |")
            content.append("")
        
        with open(dup_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(content))
        
        console.print(f"[green]重复组明细已导出:[/green] {dup_file}")
        return str(dup_file)
    
    def export_key_person_photos(self, photos: List[PhotoRecord], key_persons: List[str], title: str = "key_persons") -> str:
        kp_file = self.output_dir / self._generate_filename("keypersons", title, "md")
        
        content = []
        content.append("# 重点人物照片明细")
        content.append("")
        
        for person in key_persons:
            person_photos = [p for p in photos if any(f.person_name == person and f.is_key_person for f in p.faces)]
            content.append(f"## {person}")
            content.append("")
            content.append(f"共 {len(person_photos)} 张照片")
            content.append("")
            content.append("| 文件名 | 评分 | 状态 |")
            content.append("|--------|------|------|")
            
            for photo in sorted(person_photos, key=lambda p: p.score, reverse=True):
                status_emoji = "✅" if photo.status == PhotoStatus.KEEP else "❌"
                content.append(f"| {photo.metadata.file_name} | {photo.score:.1f} | {status_emoji} |")
            content.append("")
        
        with open(kp_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(content))
        
        console.print(f"[green]重点人物明细已导出:[/green] {kp_file}")
        return str(kp_file)
    
    def export_all(self, result: CurateResult, photos: List[PhotoRecord], 
                   duplicate_groups: List[DuplicateGroup], key_persons: List[str]) -> dict:
        files = {}
        
        files['summary'] = self.export_summary(result)
        files['details_csv'] = self.export_details_csv(photos)
        files['details_json'] = self.export_details_json(photos)
        
        if duplicate_groups:
            files['duplicates'] = self.export_duplicate_groups(duplicate_groups)
        
        if key_persons:
            files['key_persons'] = self.export_key_person_photos(photos, key_persons)
        
        return files
    
    def print_console_summary(self, result: CurateResult):
        console.print()
        console.print(Panel.fit("[bold green]选片完成[/bold green]"))
        
        table = Table(title="选片统计")
        table.add_column("项目", style="cyan")
        table.add_column("数量", style="yellow", justify="right")
        
        table.add_row("总照片数", str(result.total_photos))
        table.add_row("✅ 保留", str(result.keep_count))
        table.add_row("❌ 移除", str(result.remove_count))
        table.add_row()
        table.add_row("   ├─ 重复照片", str(result.photos_removed_as_duplicate))
        table.add_row("   ├─ 闭眼照片", str(result.photos_removed_closed_eyes))
        table.add_row("   ├─ 低评分", str(result.photos_removed_low_score))
        table.add_row("   └─ 手动删除", str(result.photos_removed_manual))
        table.add_row()
        table.add_row("重复组数", str(result.duplicate_groups))
        table.add_row("平均评分", f"{result.average_score:.2f}")
        
        console.print(table)
        
        if result.key_persons_found:
            kp_table = Table(title="重点人物统计")
            kp_table.add_column("人物", style="magenta")
            kp_table.add_column("照片数", style="yellow", justify="right")
            
            for person in sorted(result.key_persons_found):
                count = result.key_person_photos.get(person, 0)
                kp_table.add_row(person, str(count))
            
            console.print(kp_table)
