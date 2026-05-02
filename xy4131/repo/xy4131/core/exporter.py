import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime
import json
import pytz

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config.settings import Settings
from utils.helpers import format_datetime


class ReportExporter:
    def __init__(self):
        Settings.ensure_dirs()
        self.exports_dir = Settings.EXPORTS_DIR
    
    def export_markdown(self, risks: pd.DataFrame, 
                        risk_summary: Dict,
                        normalized_data: Dict[str, pd.DataFrame] = None,
                        session_info: Dict = None,
                        filename: str = None) -> str:
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"岸电复盘报告_{timestamp}.md"
        
        filepath = self.exports_dir / filename
        
        md_content = self._generate_markdown_report(risks, risk_summary, normalized_data, session_info)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(md_content)
        
        return str(filepath)
    
    def export_csv(self, risks: pd.DataFrame, 
                   risk_summary: Dict = None,
                   normalized_data: Dict[str, pd.DataFrame] = None,
                   filename_prefix: str = None) -> List[str]:
        if filename_prefix is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename_prefix = f"岸电复盘_{timestamp}"
        
        exported_files = []
        
        if risks is not None and not risks.empty:
            risks_csv = risks.copy()
            for col in risks_csv.columns:
                if risks_csv[col].dtype == 'datetime64[ns]' or risks_csv[col].dtype == 'datetime64[ns, Asia/Shanghai]':
                    risks_csv[col] = risks_csv[col].apply(lambda x: format_datetime(x) if pd.notna(x) else '')
            
            risks_filepath = self.exports_dir / f"{filename_prefix}_风险清单.csv"
            risks_csv.to_csv(risks_filepath, index=False, encoding='utf-8-sig')
            exported_files.append(str(risks_filepath))
        
        if normalized_data:
            for name, df in normalized_data.items():
                if df is not None and not df.empty:
                    df_csv = df.copy()
                    for col in df_csv.columns:
                        if df_csv[col].dtype == 'datetime64[ns]' or df_csv[col].dtype == 'datetime64[ns, Asia/Shanghai]':
                            df_csv[col] = df_csv[col].apply(lambda x: format_datetime(x) if pd.notna(x) else '')
                    
                    filepath = self.exports_dir / f"{filename_prefix}_{name}.csv"
                    df_csv.to_csv(filepath, index=False, encoding='utf-8-sig')
                    exported_files.append(str(filepath))
        
        return exported_files
    
    def export_json(self, risks: pd.DataFrame,
                    risk_summary: Dict,
                    normalized_data: Dict[str, pd.DataFrame] = None,
                    session_info: Dict = None,
                    filename: str = None) -> str:
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"岸电复盘报告_{timestamp}.json"
        
        filepath = self.exports_dir / filename
        
        export_data = {
            'export_time': datetime.now(pytz.timezone(Settings.TIMEZONE)).isoformat(),
            'risk_summary': risk_summary,
            'risks': [],
            'session_info': session_info,
            'data_sources': {}
        }
        
        if risks is not None and not risks.empty:
            risks_json = risks.copy()
            for col in risks_json.columns:
                if risks_json[col].dtype == 'datetime64[ns]' or risks_json[col].dtype == 'datetime64[ns, Asia/Shanghai]':
                    risks_json[col] = risks_json[col].apply(lambda x: x.isoformat() if pd.notna(x) else None)
            export_data['risks'] = risks_json.to_dict('records')
        
        if normalized_data:
            for name, df in normalized_data.items():
                if df is not None and not df.empty:
                    df_json = df.copy()
                    for col in df_json.columns:
                        if df_json[col].dtype == 'datetime64[ns]' or df_json[col].dtype == 'datetime64[ns, Asia/Shanghai]':
                            df_json[col] = df_json[col].apply(lambda x: x.isoformat() if pd.notna(x) else None)
                    export_data['data_sources'][name] = {
                        'count': len(df_json),
                        'columns': list(df_json.columns),
                        'data': df_json.to_dict('records')
                    }
        
        def default_converter(obj):
            if isinstance(obj, datetime):
                return obj.isoformat()
            if isinstance(obj, pd.Timestamp):
                return obj.isoformat()
            raise TypeError(f"Object of type {type(obj)} is not JSON serializable")
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2, default=default_converter)
        
        return str(filepath)
    
    def _generate_markdown_report(self, risks: pd.DataFrame, 
                                   risk_summary: Dict,
                                   normalized_data: Dict[str, pd.DataFrame] = None,
                                   session_info: Dict = None) -> str:
        lines = []
        
        lines.append("# 岸电插拔复盘报告")
        lines.append("")
        lines.append(f"**生成时间**: {format_datetime(datetime.now(pytz.timezone(Settings.TIMEZONE)))}")
        lines.append("")
        
        if session_info:
            lines.append("## 会话信息")
            lines.append("")
            lines.append(f"- **会话名称**: {session_info.get('name', '未命名')}")
            lines.append(f"- **会话ID**: {session_info.get('session_id', '')}")
            lines.append(f"- **创建时间**: {format_datetime(session_info.get('created_at'))}")
            lines.append("")
        
        lines.append("## 风险概览")
        lines.append("")
        
        total_risks = risk_summary.get('total_risks', 0)
        by_severity = risk_summary.get('by_severity', {})
        
        lines.append(f"- **总风险数**: {total_risks}")
        lines.append(f"  - 紧急: {by_severity.get('紧急', 0)}")
        lines.append(f"  - 重要: {by_severity.get('重要', 0)}")
        lines.append(f"  - 一般: {by_severity.get('一般', 0)}")
        lines.append(f"  - 提示: {by_severity.get('提示', 0)}")
        lines.append("")
        
        by_type = risk_summary.get('by_type', {})
        if by_type:
            lines.append("### 按风险类型分布")
            lines.append("")
            for risk_type, count in by_type.items():
                lines.append(f"- **{risk_type}**: {count}")
            lines.append("")
        
        if risks is not None and not risks.empty:
            lines.append("## 风险详情")
            lines.append("")
            
            severity_order = ['紧急', '重要', '一般', '提示']
            for severity in severity_order:
                severity_risks = risks[risks['severity'] == severity]
                if len(severity_risks) == 0:
                    continue
                
                lines.append(f"### {severity}风险 ({len(severity_risks)}项)")
                lines.append("")
                lines.append("| 风险ID | 风险类型 | 集装箱 | 堆位 | 风险时间 | 持续时间(分钟) | 描述 |")
                lines.append("|--------|----------|--------|------|----------|----------------|------|")
                
                for _, row in severity_risks.iterrows():
                    lines.append(
                        f"| {row.get('risk_id', '')} | "
                        f"{row.get('risk_type', '')} | "
                        f"{row.get('container_no', '')} | "
                        f"{row.get('slot_id', '')} | "
                        f"{format_datetime(row.get('risk_time'))} | "
                        f"{row.get('duration_minutes', '')} | "
                        f"{row.get('description', '')} |"
                    )
                lines.append("")
        
        if normalized_data:
            lines.append("## 数据源统计")
            lines.append("")
            
            for name, df in normalized_data.items():
                if df is not None and not df.empty:
                    lines.append(f"### {name}")
                    lines.append(f"- 记录数: {len(df)}")
                    lines.append(f"- 列数: {len(df.columns)}")
                    lines.append("")
        
        if session_info and session_info.get('notes'):
            lines.append("## 复盘备注")
            lines.append("")
            lines.append(session_info.get('notes', ''))
            lines.append("")
        
        lines.append("---")
        lines.append("*本报告由岸电插拔复盘台自动生成*")
        
        return "\n".join(lines)
    
    def get_export_history(self) -> List[Dict]:
        files = []
        
        for file in self.exports_dir.glob("*"):
            if file.is_file():
                stat = file.stat()
                files.append({
                    'name': file.name,
                    'path': str(file),
                    'size': stat.st_size,
                    'modified_time': datetime.fromtimestamp(stat.st_mtime, pytz.timezone(Settings.TIMEZONE)),
                    'extension': file.suffix.lower()
                })
        
        files.sort(key=lambda x: x['modified_time'], reverse=True)
        return files
