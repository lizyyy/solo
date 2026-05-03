"""导出模块 - 负责导出脱敏 SRT、Markdown 复核单和 JSON 审计包"""

import json
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from .parser import IssueType, ProjectScanner
from .sanitizer import NameSanitizer, Replacement, SRTSanitizer, SanitizationResult
from .storage import IssueStatus, StateManager


@dataclass
class ExportContext:
    """导出上下文"""
    project_dir: Path
    state_manager: StateManager
    scan_results: Dict[str, Any]
    
    name_sanitizer: Optional[NameSanitizer] = None
    srt_sanitizer: Optional[SRTSanitizer] = None
    
    export_time: str = field(default_factory=lambda: datetime.now().isoformat())
    metadata: Dict[str, Any] = field(default_factory=dict)


class SRTExporter:
    """SRT 导出器"""
    
    @staticmethod
    def export(sanitized_subtitles, output_path: Path) -> Path:
        """
        导出脱敏后的 SRT 文件
        
        Args:
            sanitized_subtitles: 脱敏后的字幕对象（pysrt SubRipFile）
            output_path: 输出路径
            
        Returns:
            输出文件路径
        """
        output_path.parent.mkdir(parents=True, exist_ok=True)
        sanitized_subtitles.save(str(output_path))
        return output_path
    
    @staticmethod
    def generate_sanitized_srt(context: ExportContext, original_srt_path: Path) -> tuple:
        """
        生成脱敏后的 SRT
        
        Args:
            context: 导出上下文
            original_srt_path: 原始 SRT 文件路径
            
        Returns:
            (脱敏后的字幕对象, 所有替换记录, 所有问题)
        """
        import pysrt
        
        original_subtitles = pysrt.open(str(original_srt_path))
        
        if context.srt_sanitizer is None:
            return original_subtitles, [], []
        
        sanitized_subtitles, results, issues = context.srt_sanitizer.sanitize_all(original_subtitles)
        
        all_replacements: List[Replacement] = []
        for result in results:
            all_replacements.extend(result.replacements)
        
        return sanitized_subtitles, all_replacements, issues


class MarkdownExporter:
    """Markdown 复核单导出器"""
    
    @staticmethod
    def export(context: ExportContext, output_path: Path, 
               replacements: Optional[List[Replacement]] = None) -> Path:
        """
        导出 Markdown 复核单
        
        Args:
            context: 导出上下文
            output_path: 输出路径
            replacements: 替换记录列表
            
        Returns:
            输出文件路径
        """
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        md_content = MarkdownExporter._generate_markdown(context, replacements)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(md_content)
        
        return output_path
    
    @staticmethod
    def _generate_markdown(context: ExportContext, 
                           replacements: Optional[List[Replacement]] = None) -> str:
        """生成 Markdown 内容"""
        lines = []
        
        lines.append("# 访谈脱敏复核单")
        lines.append("")
        lines.append(f"**导出时间**: {context.export_time}")
        lines.append(f"**项目目录**: {context.project_dir}")
        lines.append("")
        
        lines.append("## 1. 扫描结果摘要")
        lines.append("")
        
        scan_results = context.scan_results
        if scan_results:
            files_found = scan_results.get('files_found', {})
            issues_summary = scan_results.get('issues_summary', {})
            
            lines.append("### 1.1 检测到的文件")
            lines.append("")
            lines.append("| 文件类型 | 是否存在 |")
            lines.append("|----------|----------|")
            lines.append(f"| SRT 字幕 | {'✅ 是' if files_found.get('srt') else '❌ 否'} |")
            lines.append(f"| 授权表 | {'✅ 是' if files_found.get('authorization') else '❌ 否'} |")
            lines.append(f"| 敏感词词典 | {'✅ 是' if files_found.get('sensitive_names') else '❌ 否'} |")
            lines.append(f"| 音频清单 | {'✅ 是' if files_found.get('audio_manifest') else '❌ 否'} |")
            lines.append("")
            
            lines.append("### 1.2 问题汇总")
            lines.append("")
            if issues_summary:
                lines.append("| 问题类型 | 数量 |")
                lines.append("|----------|------|")
                for issue_type, count in issues_summary.items():
                    if count > 0:
                        lines.append(f"| {issue_type} | {count} |")
                lines.append("")
            else:
                lines.append("无检测到的问题。")
                lines.append("")
        
        issues = scan_results.get('issues', []) if scan_results else []
        if issues:
            lines.append("### 1.3 详细问题列表")
            lines.append("")
            
            issue_statuses = context.state_manager.load_state().issue_notes
            
            for idx, issue in enumerate(issues):
                issue_id = str(idx)
                status_note = issue_statuses.get(issue_id)
                status = status_note.status.value if status_note else "待处理"
                comment = status_note.comment if status_note else ""
                
                lines.append(f"#### 问题 {idx + 1}: {issue['type']}")
                lines.append("")
                lines.append(f"- **严重程度**: {issue.get('severity', 'unknown')}")
                lines.append(f"- **描述**: {issue.get('description', '')}")
                lines.append(f"- **处理状态**: {status}")
                
                if comment:
                    lines.append(f"- **处理备注**: {comment}")
                
                location = issue.get('location')
                if location:
                    lines.append(f"- **位置**: {json.dumps(location, ensure_ascii=False)}")
                
                context_text = issue.get('context')
                if context_text:
                    lines.append(f"- **上下文**: `{context_text}`")
                
                lines.append("")
        
        if replacements:
            lines.append("## 2. 脱敏替换记录")
            lines.append("")
            lines.append("| 序号 | 原始内容 | 替换为 | 位置 |")
            lines.append("|------|----------|--------|------|")
            
            for idx, rep in enumerate(replacements):
                location = ""
                if rep.location:
                    if 'subtitle_index' in rep.location:
                        location = f"字幕 #{rep.location['subtitle_index']}"
                    else:
                        location = json.dumps(rep.location, ensure_ascii=False)
                
                lines.append(f"| {idx + 1} | `{rep.original}` | `{rep.replacement}` | {location} |")
            
            lines.append("")
        
        lines.append("## 3. 复核意见")
        lines.append("")
        lines.append("### 3.1 复核人签字")
        lines.append("")
        lines.append("**复核人**: _______________")
        lines.append("")
        lines.append("**复核日期**: _______________")
        lines.append("")
        lines.append("### 3.2 复核结论")
        lines.append("")
        lines.append("- [ ] 所有问题已处理完毕")
        lines.append("- [ ] 脱敏结果符合要求")
        lines.append("- [ ] 可以进行下一步操作")
        lines.append("")
        lines.append("**备注**:")
        lines.append("")
        lines.append("________________________________________")
        lines.append("________________________________________")
        lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append(f"*本复核单由访谈脱敏打包员生成于 {context.export_time}*")
        
        return "\n".join(lines)


class JSONAuditExporter:
    """JSON 审计包导出器"""
    
    @staticmethod
    def export(context: ExportContext, output_path: Path,
               replacements: Optional[List[Replacement]] = None) -> Path:
        """
        导出 JSON 审计包
        
        Args:
            context: 导出上下文
            output_path: 输出路径
            replacements: 替换记录列表
            
        Returns:
            输出文件路径
        """
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        audit_package = JSONAuditExporter._generate_audit_package(context, replacements)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(audit_package, f, ensure_ascii=False, indent=2)
        
        return output_path
    
    @staticmethod
    def _generate_audit_package(context: ExportContext,
                                replacements: Optional[List[Replacement]] = None) -> Dict[str, Any]:
        """生成审计包内容"""
        state = context.state_manager.load_state()
        
        replacements_data = []
        if replacements:
            replacements_data = [
                {
                    "original": rep.original,
                    "replacement": rep.replacement,
                    "location": rep.location,
                    "context": rep.context
                }
                for rep in replacements
            ]
        
        issue_notes_data = {
            k: {
                "issue_id": v.issue_id,
                "status": v.status.value,
                "comment": v.comment,
                "assignee": v.assignee,
                "updated_at": v.updated_at
            }
            for k, v in state.issue_notes.items()
        }
        
        name_overrides_data = {
            k: {
                "original_name": v.original_name,
                "override_pseudonym": v.override_pseudonym,
                "comment": v.comment,
                "created_at": v.created_at
            }
            for k, v in state.name_overrides.items()
        }
        
        segment_exclusions_data = {
            k: {
                "segment_index": v.segment_index,
                "start_time": v.start_time,
                "end_time": v.end_time,
                "reason": v.reason,
                "excluded": v.excluded,
                "comment": v.comment
            }
            for k, v in state.segment_exclusions.items()
        }
        
        audit_package = {
            "audit_version": "1.0",
            "export_time": context.export_time,
            "project_info": {
                "project_id": state.project_id,
                "project_dir": state.project_dir,
                "created_at": state.created_at,
                "updated_at": state.updated_at
            },
            "scan_results": context.scan_results,
            "replacements": replacements_data,
            "processing_state": {
                "issue_notes": issue_notes_data,
                "name_overrides": name_overrides_data,
                "segment_exclusions": segment_exclusions_data
            },
            "export_history": state.export_history,
            "metadata": {
                **context.metadata,
                "tool_version": "0.1.0"
            }
        }
        
        return audit_package


class Exporter:
    """主导出器"""
    
    def __init__(self, project_dir: Path):
        self.project_dir = project_dir
        self.state_manager = StateManager(project_dir)
        self.output_dir = project_dir / "output"
    
    def export_all(self) -> Dict[str, Path]:
        """
        执行完整导出流程
        
        Returns:
            各导出类型的输出路径字典
        """
        if not self.state_manager.is_initialized():
            raise RuntimeError("项目未初始化，请先运行 init 命令")
        
        scan_results = self.state_manager.get_scan_results()
        if not scan_results:
            raise RuntimeError("未找到扫描结果，请先运行 scan 命令")
        
        name_sanitizer = self._build_name_sanitizer()
        srt_sanitizer = SRTSanitizer(name_sanitizer) if name_sanitizer else None
        
        context = ExportContext(
            project_dir=self.project_dir,
            state_manager=self.state_manager,
            scan_results=scan_results,
            name_sanitizer=name_sanitizer,
            srt_sanitizer=srt_sanitizer
        )
        
        output_paths = {}
        
        srt_path = self._find_srt_file()
        if srt_path and srt_sanitizer:
            sanitized_subs, replacements, issues = SRTExporter.generate_sanitized_srt(
                context, srt_path
            )
            
            srt_output = self.output_dir / "sanitized.srt"
            SRTExporter.export(sanitized_subs, srt_output)
            output_paths["srt"] = srt_output
            
            md_output = self.output_dir / "review_report.md"
            MarkdownExporter.export(context, md_output, replacements)
            output_paths["markdown"] = md_output
            
            json_output = self.output_dir / "audit_package.json"
            JSONAuditExporter.export(context, json_output, replacements)
            output_paths["json"] = json_output
            
            for export_type, path in output_paths.items():
                self.state_manager.record_export(
                    export_type=export_type,
                    output_path=str(path),
                    metadata={
                        "replacements_count": len(replacements),
                        "issues_count": len(issues)
                    }
                )
        
        return output_paths
    
    def _build_name_sanitizer(self) -> Optional[NameSanitizer]:
        """构建姓名脱敏器（整合授权表和人工覆盖规则）"""
        from .parser import AuthorizationParser, SensitiveNamesParser
        
        auth_data = None
        sensitive_names = None
        
        auth_files = list(self.project_dir.glob("**/*授权*.csv")) + list(self.project_dir.glob("**/*authorization*.csv"))
        if auth_files:
            auth_data = AuthorizationParser.parse(auth_files[0])
        
        sensitive_files = list(self.project_dir.glob("**/*敏感*.csv")) + list(self.project_dir.glob("**/*sensitive*.csv"))
        if sensitive_files:
            sensitive_names = SensitiveNamesParser.parse(sensitive_files[0])
        
        name_sanitizer = NameSanitizer(auth_data, sensitive_names)
        
        name_overrides = self.state_manager.get_name_overrides()
        for original_name, override in name_overrides.items():
            name_sanitizer._name_map[original_name] = override.override_pseudonym
        
        return name_sanitizer
    
    def _find_srt_file(self) -> Optional[Path]:
        """查找 SRT 文件"""
        srt_files = list(self.project_dir.glob("**/*.srt"))
        return srt_files[0] if srt_files else None
