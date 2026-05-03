import pandas as pd
import numpy as np
import json
from pathlib import Path
from typing import Optional, Dict, Any, List
from datetime import datetime
import logging
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from config import EXPORT_CONFIG

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DataExporter:
    """数据导出器"""
    
    VERIFICATION_RESULTS = {
        "confirmed": "已确认",
        "pending": "待核实",
        "rejected": "已排除",
        "unknown": "未知"
    }
    
    NOISE_SOURCE_NAMES = {
        "short_construction": "短时施工",
        "bar_closing": "酒吧散场",
        "road_construction": "道路施工",
        "traffic": "交通噪声",
        "unknown": "未知噪声"
    }
    
    def __init__(self, export_dir: Optional[Path] = None):
        self.export_dir = export_dir or Path("exports")
        self.export_dir.mkdir(parents=True, exist_ok=True)
        
        self.export_stats: Dict[str, Any] = {
            "total_exports": 0,
            "by_type": {}
        }
    
    def generate_markdown_report(
        self,
        session_data: Dict[str, Any],
        analysis_results: Dict[str, Any],
        output_path: Optional[Path] = None
    ) -> Path:
        """
        生成Markdown简报
        
        Args:
            session_data: 会话数据
            analysis_results: 分析结果
            output_path: 输出路径
            
        Returns:
            输出文件路径
        """
        if output_path is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = self.export_dir / f"noise_analysis_report_{timestamp}.md"
        
        try:
            report_content = self._build_markdown_content(session_data, analysis_results)
            
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(report_content)
            
            self._record_export("markdown", output_path)
            logger.info(f"Markdown报告已生成: {output_path}")
            
            return output_path
            
        except Exception as e:
            logger.error(f"生成Markdown报告失败: {e}")
            raise
    
    def _build_markdown_content(
        self,
        session_data: Dict[str, Any],
        analysis_results: Dict[str, Any]
    ) -> str:
        """构建Markdown内容"""
        lines = []
        
        lines.append("# 夜间噪声投诉溯源分析报告")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**会话名称**: {session_data.get('session_name', '未命名会话')}")
        lines.append(f"**会话ID**: {session_data.get('session_id', 'N/A')}")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        lines.append("## 1. 数据概览")
        lines.append("")
        
        data_sources = session_data.get("data_sources", {})
        lines.append("### 1.1 数据源统计")
        lines.append("")
        lines.append("| 数据类型 | 文件名 | 记录数 | 加载时间 |")
        lines.append("|----------|--------|--------|----------|")
        
        for source_type, source_info in data_sources.items():
            if source_info:
                source_name = {
                    "complaints": "居民投诉",
                    "permits": "施工备案",
                    "monitoring": "噪声监测",
                    "grids": "街区网格"
                }.get(source_type, source_type)
                
                lines.append(
                    f"| {source_name} | {source_info.get('file_name', 'N/A')} | "
                    f"{source_info.get('record_count', 0)} | "
                    f"{source_info.get('loaded_at', 'N/A')[:19]} |"
                )
        
        lines.append("")
        
        lines.append("## 2. 分析结果")
        lines.append("")
        
        noise_metrics = analysis_results.get("noise_metrics", {})
        if noise_metrics:
            lines.append("### 2.1 噪声指标")
            lines.append("")
            
            overall = noise_metrics.get("overall", {})
            if overall:
                lines.append("#### 整体统计")
                lines.append("")
                lines.append(f"- **平均分贝**: {overall.get('mean_db', 'N/A'):.1f} dB")
                lines.append(f"- **最大分贝**: {overall.get('max_db', 'N/A'):.1f} dB")
                lines.append(f"- **最小分贝**: {overall.get('min_db', 'N/A'):.1f} dB")
                lines.append(f"- **标准偏差**: {overall.get('std_db', 'N/A'):.1f} dB")
                lines.append(f"- **总记录数**: {overall.get('total_records', 0)}")
                lines.append("")
            
            night_stats = noise_metrics.get("night_stats", {})
            if night_stats:
                lines.append("#### 夜间统计 (22:00 - 06:00)")
                lines.append("")
                lines.append(f"- **夜间平均分贝**: {night_stats.get('mean_db', 'N/A'):.1f} dB")
                lines.append(f"- **夜间最大分贝**: {night_stats.get('max_db', 'N/A'):.1f} dB")
                lines.append(f"- **夜间记录占比**: {night_stats.get('night_ratio', 0):.1%}")
                lines.append("")
            
            exceedances = noise_metrics.get("exceedances", {})
            if exceedances:
                lines.append("#### 超标情况")
                lines.append("")
                lines.append(f"- **阈值**: {exceedances.get('threshold', 55)} dB")
                lines.append(f"- **超标次数**: {exceedances.get('count', 0)}")
                lines.append(f"- **超标比例**: {exceedances.get('ratio', 0):.1%}")
                lines.append(f"- **最大超标量**: {exceedances.get('max_exceedance', 0):.1f} dB")
                lines.append("")
        
        complaint_density = analysis_results.get("complaint_density", {})
        if complaint_density:
            lines.append("### 2.2 投诉密度")
            lines.append("")
            lines.append(f"- **总投诉数**: {complaint_density.get('total_complaints', 0)}")
            
            density = complaint_density.get("density", {})
            if density:
                lines.append(f"- **高峰时段投诉数**: {density.get('peak_hour_count', 0)}")
                lines.append(f"- **高峰时段投诉占比**: {density.get('peak_hour_ratio', 0):.1%}")
            lines.append("")
        
        permit_coverage = analysis_results.get("permit_coverage", {})
        if permit_coverage:
            lines.append("### 2.3 备案覆盖率")
            lines.append("")
            lines.append(f"- **高噪声事件数**: {permit_coverage.get('total_noise_events', 0)}")
            lines.append(f"- **有备案覆盖**: {permit_coverage.get('covered_events', 0)}")
            lines.append(f"- **无备案覆盖**: {permit_coverage.get('uncovered_count', 0)}")
            lines.append(f"- **备案覆盖率**: {permit_coverage.get('coverage_ratio', 0):.1%}")
            lines.append(f"- **距离阈值**: {permit_coverage.get('distance_threshold_km', 0.5)} km")
            lines.append("")
        
        hotspots = analysis_results.get("hotspots", [])
        if hotspots:
            lines.append("### 2.4 热区排行")
            lines.append("")
            lines.append("| 排名 | 网格ID | 投诉数 | 最大分贝 | 热区得分 |")
            lines.append("|------|--------|--------|----------|----------|")
            
            for i, hotspot in enumerate(hotspots[:10], 1):
                lines.append(
                    f"| {i} | {hotspot.get('grid_id', 'N/A')} | "
                    f"{hotspot.get('complaint_count', 0)} | "
                    f"{hotspot.get('max_db', 'N/A'):.1f} | "
                    f"{hotspot.get('hotspot_score', 0)} |"
                )
            lines.append("")
        
        suspicious_sources = analysis_results.get("suspicious_sources", [])
        if suspicious_sources:
            lines.append("### 2.5 可疑噪声源分析")
            lines.append("")
            
            for source in suspicious_sources[:10]:
                source_type = source.get("source_type", "unknown")
                source_name = self.NOISE_SOURCE_NAMES.get(source_type, source_type)
                
                lines.append(f"#### {source_name}")
                lines.append("")
                lines.append(f"- **置信度**: {source.get('confidence', 0):.1%}")
                lines.append(f"- **优先级**: {source.get('priority', 'N/A')}")
                
                evidences = source.get("evidences", [])
                if evidences:
                    lines.append(f"- **证据**:")
                    for evidence in evidences:
                        lines.append(f"  - [{evidence.get('type', 'N/A')}] {evidence.get('reason', 'N/A')} (置信度: {evidence.get('confidence', 0):.0%})")
                lines.append("")
        
        lines.append("## 3. 人工标记与核实")
        lines.append("")
        
        user_tags = session_data.get("user_tags", [])
        if user_tags:
            lines.append("### 3.1 用户标记")
            lines.append("")
            lines.append("| 标记ID | 类型 | 目标ID | 标记值 | 备注 | 创建时间 |")
            lines.append("|--------|------|--------|--------|------|----------|")
            
            for tag in user_tags:
                lines.append(
                    f"| {tag.get('tag_id', 'N/A')} | {tag.get('tag_type', 'N/A')} | "
                    f"{tag.get('target_id', 'N/A')} | {tag.get('tag_value', 'N/A')} | "
                    f"{tag.get('notes', '')} | {tag.get('created_at', 'N/A')[:19]} |"
                )
            lines.append("")
        else:
            lines.append("*暂无用户标记*")
            lines.append("")
        
        verifications = session_data.get("verifications", [])
        if verifications:
            lines.append("### 3.2 核实记录")
            lines.append("")
            lines.append("| 核实ID | 事件ID | 结果 | 核实人 | 备注 | 核实时间 |")
            lines.append("|--------|--------|------|--------|------|----------|")
            
            for ver in verifications:
                result = self.VERIFICATION_RESULTS.get(ver.get('result', 'unknown'), ver.get('result', 'N/A'))
                lines.append(
                    f"| {ver.get('verification_id', 'N/A')} | {ver.get('event_id', 'N/A')} | "
                    f"{result} | {ver.get('verifier', 'N/A')} | "
                    f"{ver.get('notes', '')} | {ver.get('created_at', 'N/A')[:19]} |"
                )
            lines.append("")
        else:
            lines.append("*暂无核实记录*")
            lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*报告由夜间噪声投诉溯源台自动生成*")
        
        return "\n".join(lines)
    
    def export_hotspots_csv(
        self,
        hotspots_df: pd.DataFrame,
        output_path: Optional[Path] = None
    ) -> Path:
        """
        导出热区表为CSV
        
        Args:
            hotspots_df: 热区数据DataFrame
            output_path: 输出路径
            
        Returns:
            输出文件路径
        """
        if output_path is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = self.export_dir / f"noise_hotspots_{timestamp}.csv"
        
        try:
            hotspots_df.to_csv(
                output_path,
                index=False,
                encoding=EXPORT_CONFIG.get("csv_encoding", "utf-8-sig")
            )
            
            self._record_export("csv", output_path)
            logger.info(f"热区CSV已导出: {output_path}")
            
            return output_path
            
        except Exception as e:
            logger.error(f"导出热区CSV失败: {e}")
            raise
    
    def export_audit_package(
        self,
        session_data: Dict[str, Any],
        analysis_results: Dict[str, Any],
        output_path: Optional[Path] = None
    ) -> Path:
        """
        导出JSON审计包
        
        Args:
            session_data: 会话数据
            analysis_results: 分析结果
            output_path: 输出路径
            
        Returns:
            输出文件路径
        """
        if output_path is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = self.export_dir / f"noise_audit_{timestamp}.json"
        
        try:
            audit_package = {
                "audit_info": {
                    "export_time": datetime.now().isoformat(),
                    "version": "1.0",
                    "package_type": "noise_analysis_audit"
                },
                "session_info": {
                    "session_id": session_data.get("session_id"),
                    "session_name": session_data.get("session_name"),
                    "description": session_data.get("description"),
                    "created_at": session_data.get("created_at"),
                    "updated_at": session_data.get("updated_at")
                },
                "data_sources": session_data.get("data_sources", {}),
                "analysis_results": self._make_json_serializable(analysis_results),
                "user_tags": session_data.get("user_tags", []),
                "verifications": session_data.get("verifications", [])
            }
            
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(
                    audit_package,
                    f,
                    ensure_ascii=False,
                    indent=EXPORT_CONFIG.get("json_indent", 2),
                    default=str
                )
            
            self._record_export("json", output_path)
            logger.info(f"审计包已导出: {output_path}")
            
            return output_path
            
        except Exception as e:
            logger.error(f"导出审计包失败: {e}")
            raise
    
    def _make_json_serializable(self, obj: Any) -> Any:
        """使对象可JSON序列化"""
        if isinstance(obj, pd.DataFrame):
            return obj.to_dict(orient="records")
        elif isinstance(obj, pd.Series):
            return obj.to_dict()
        elif isinstance(obj, (datetime, pd.Timestamp)):
            return obj.isoformat()
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, dict):
            return {k: self._make_json_serializable(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._make_json_serializable(item) for item in obj]
        elif pd.isna(obj) if hasattr(pd, 'isna') else False:
            return None
        return obj
    
    def _record_export(self, export_type: str, output_path: Path):
        """记录导出操作"""
        self.export_stats["total_exports"] += 1
        
        if export_type not in self.export_stats["by_type"]:
            self.export_stats["by_type"][export_type] = []
        
        self.export_stats["by_type"][export_type].append({
            "path": str(output_path),
            "timestamp": datetime.now().isoformat(),
            "file_size": output_path.stat().st_size if output_path.exists() else 0
        })
    
    def export_complaints_with_classification(
        self,
        complaints_df: pd.DataFrame,
        output_path: Optional[Path] = None
    ) -> Path:
        """
        导出带分类结果的投诉数据
        
        Args:
            complaints_df: 投诉数据DataFrame
            output_path: 输出路径
            
        Returns:
            输出文件路径
        """
        if output_path is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = self.export_dir / f"classified_complaints_{timestamp}.csv"
        
        export_df = complaints_df.copy()
        
        if "classification_details" in export_df.columns:
            export_df = export_df.drop(columns=["classification_details"])
        
        export_df.to_csv(
            output_path,
            index=False,
            encoding=EXPORT_CONFIG.get("csv_encoding", "utf-8-sig")
        )
        
        self._record_export("csv", output_path)
        logger.info(f"分类投诉数据已导出: {output_path}")
        
        return output_path
    
    def get_export_stats(self) -> Dict[str, Any]:
        """获取导出统计"""
        return self.export_stats
