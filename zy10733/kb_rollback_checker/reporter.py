from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional
from .models import CheckResult, RollbackStatus


class ReportGenerator:
    def __init__(self, detailed: bool = False):
        self.detailed = detailed
    
    def generate_console_report(self, result: CheckResult) -> str:
        lines = []
        lines.append("=" * 70)
        lines.append("📚 知识库发布日志文章回滚核验报告")
        lines.append("=" * 70)
        lines.append(f"📅 核验时间: {result.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"⏱  耗时: {self._format_duration(result.end_time - result.start_time)}")
        lines.append("")
        
        lines.extend(self._generate_summary(result))
        lines.append("")
        
        if self.detailed:
            lines.extend(self._generate_detailed_records(result))
            lines.append("")
        
        lines.extend(self._generate_exception_report(result))
        lines.append("")
        lines.append("=" * 70)
        
        return "\n".join(lines)
    
    def _generate_summary(self, result: CheckResult) -> list:
        lines = []
        lines.append("📊 核验汇总")
        lines.append("-" * 40)
        lines.append(f"  总记录数: {result.total_records}")
        lines.append(f"  ✅ 回滚完整: {result.complete_rollbacks} ({result.complete_rollbacks/result.total_records*100:.1f}%)")
        lines.append(f"  ⚠️  回滚不完整: {result.incomplete_rollbacks} ({result.incomplete_rollbacks/result.total_records*100:.1f}%)")
        lines.append("")
        lines.append("🔍 异常分布:")
        lines.append(f"  ⏳ 索引延迟: {result.index_delay_count} 条")
        lines.append(f"  📎 附件问题: {result.attachment_issues_count} 条")
        lines.append(f"  💾 缓存命中: {result.cache_hit_count} 条")
        lines.append(f"  ❌ 校验失败: {result.failed_count} 条")
        return lines
    
    def _generate_detailed_records(self, result: CheckResult) -> list:
        lines = []
        lines.append("📝 详细记录")
        lines.append("-" * 70)
        
        for i, record in enumerate(result.records, 1):
            status_icon = "✅" if record.is_complete else "⚠️"
            lines.append(f"\n{i}. {status_icon} 【{record.space_name}】{record.article_title}")
            lines.append(f"   文章ID: {record.article_id}")
            lines.append(f"   操作人: {record.operator}")
            lines.append(f"   回滚时间: {record.rollback_time.strftime('%Y-%m-%d %H:%M:%S')}")
            lines.append(f"   状态: {record.status.value}")
            if record.error_message:
                lines.append(f"   说明: {record.error_message}")
            lines.append(f"   版本: {record.previous_version} → {record.rollback_version}")
            if record.attachments:
                lines.append(f"   附件: {len(record.rolled_back_attachments)}/{len(record.attachments)} 个已回滚")
            
            if self.detailed:
                lines.append("   处理日志:")
                for log in record.processing_log:
                    lines.append(f"      {log}")
        
        return lines
    
    def _generate_exception_report(self, result: CheckResult) -> list:
        lines = []
        exception_records = [r for r in result.records if not r.is_complete or r.status != RollbackStatus.SUCCESS]
        
        if not exception_records:
            lines.append("🎉 没有发现异常记录")
            return lines
        
        lines.append("⚠️  异常报告")
        lines.append("-" * 40)
        
        for status in [RollbackStatus.INDEX_DELAY, RollbackStatus.ATTACHMENT_NOT_ROLLED_BACK, 
                       RollbackStatus.CACHE_HIT, RollbackStatus.FAILED, RollbackStatus.PARTIAL_ROLLBACK]:
            status_records = [r for r in exception_records if r.status == status]
            if not status_records:
                continue
            
            lines.append(f"\n🔴 {status.value}:")
            for record in status_records:
                lines.append(f"   • 【{record.space_name}】{record.article_title} ({record.article_id})")
                if record.error_message:
                    lines.append(f"     原因: {record.error_message}")
        
        return lines
    
    def _format_duration(self, delta: timedelta) -> str:
        total_seconds = delta.total_seconds()
        if total_seconds < 60:
            return f"{total_seconds:.1f} 秒"
        elif total_seconds < 3600:
            minutes = int(total_seconds // 60)
            seconds = int(total_seconds % 60)
            return f"{minutes} 分 {seconds} 秒"
        else:
            hours = int(total_seconds // 3600)
            minutes = int((total_seconds % 3600) // 60)
            return f"{hours} 小时 {minutes} 分"
    
    def save_report(self, result: CheckResult, output_path: str) -> None:
        report = self.generate_console_report(result)
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write(report)
