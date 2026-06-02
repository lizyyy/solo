import json
import numpy as np
import pandas as pd
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional


def _json_serializable(obj):
    if isinstance(obj, (np.int64, np.int32, np.int16)):
        return int(obj)
    elif isinstance(obj, (np.float64, np.float32)):
        return float(obj)
    elif isinstance(obj, np.bool_):
        return bool(obj)
    elif isinstance(obj, pd.Timestamp):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")


class ReportGenerator:
    def __init__(self, report_dir: str = "./workspace/reports"):
        self.report_dir = Path(report_dir)
        self.report_dir.mkdir(parents=True, exist_ok=True)
    
    def generate_report_id(self, version_id: str) -> str:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        return f"report_{version_id}_{timestamp}"
    
    def generate_full_report(self, df: pd.DataFrame, version_info: Dict, 
                             metrics: Dict, cluster_stats: Dict,
                             clean_stats: Dict, merge_stats: Dict,
                             comparison: Optional[Dict] = None) -> Dict:
        report_id = self.generate_report_id(version_info.get('version_id', 'unknown'))
        
        report = {
            "report_id": report_id,
            "generated_at": datetime.now().isoformat(),
            "version_info": version_info,
            "data_cleaning": clean_stats,
            "historical_merge": merge_stats,
            "clustering": cluster_stats,
            "metrics": metrics,
            "version_comparison": comparison or {},
            "sample_summary": self._get_sample_summary(df),
            "decision_trail": self._build_decision_trail(df, version_info)
        }
        
        report_path = self.report_dir / f"{report_id}.json"
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False, default=_json_serializable)
        
        return report
    
    def _get_sample_summary(self, df: pd.DataFrame) -> Dict:
        summary = {
            "total_samples": len(df),
            "by_review_status": {},
            "by_defect_type": {},
            "by_cluster": {},
            "representative_samples": []
        }
        
        if 'review_status' in df.columns:
            summary["by_review_status"] = df['review_status'].value_counts().to_dict()
        
        if 'defect_type' in df.columns:
            summary["by_defect_type"] = df['defect_type'].value_counts().to_dict()
        
        if 'cluster_id' in df.columns:
            cluster_summary = df['cluster_id'].value_counts().to_dict()
            summary["by_cluster"] = {k: int(v) for k, v in cluster_summary.items()}
        
        if 'cluster_representative' in df.columns:
            rep_samples = df[df['cluster_representative'] == True]
            summary["representative_samples"] = rep_samples[
                ['sample_id', 'cluster_id', 'defect_type', 'confidence']
            ].to_dict('records')
        
        return summary
    
    def _build_decision_trail(self, df: pd.DataFrame, version_info: Dict) -> List[Dict]:
        trail = []
        
        for idx, row in df.iterrows():
            decision = {
                "sample_id": row.get('sample_id', ''),
                "decisions": []
            }
            
            decision["decisions"].append({
                "step": "data_loading",
                "action": "loaded",
                "source": row.get('_source_file', 'unknown'),
                "raw_index": int(row.get('_raw_index', idx))
            })
            
            if pd.notna(row.get('review_source')):
                decision["decisions"].append({
                    "step": "historical_merge",
                    "action": "matched_history",
                    "source_version": row.get('review_source'),
                    "result": row.get('review_status')
                })
            
            if pd.notna(row.get('cluster_id')):
                decision["decisions"].append({
                    "step": "clustering",
                    "action": "clustered",
                    "cluster_id": row.get('cluster_id'),
                    "is_representative": bool(row.get('cluster_representative', False)),
                    "cluster_label": row.get('cluster_label')
                })
            
            if pd.notna(row.get('review_status')):
                decision["decisions"].append({
                    "step": "review",
                    "action": row.get('review_status'),
                    "model_label": row.get('predicted_label'),
                    "human_label": row.get('human_label'),
                    "note": row.get('review_note', '')
                })
            
            trail.append(decision)
        
        return trail
    
    def generate_handoff_report(self, df: pd.DataFrame, version_info: Dict, 
                                metrics: Dict) -> str:
        report_id = self.generate_report_id(version_info.get('version_id', 'unknown'))
        
        handoff_content = self._format_handoff_content(df, version_info, metrics)
        
        report_path = self.report_dir / f"{report_id}_handoff.md"
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(handoff_content)
        
        return str(report_path)
    
    def _format_handoff_content(self, df: pd.DataFrame, version_info: Dict, metrics: Dict) -> str:
        lines = []
        
        lines.append(f"# 图像质检缺陷聚类 - 交接报告")
        lines.append("")
        lines.append(f"**版本**: {version_info.get('version_id', 'unknown')}")
        lines.append(f"**模型版本**: {version_info.get('model_version', 'unknown')}")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**描述**: {version_info.get('description', '')}")
        lines.append("")
        
        lines.append("## 1. 概览")
        lines.append("")
        lines.append(f"- 总样本数: {len(df)}")
        lines.append(f"- 复核进度: {metrics.get('review_progress', 0)}%")
        
        if 'review_status' in metrics:
            for status, count in metrics['review_status'].items():
                lines.append(f"  - {status}: {count}")
        
        lines.append("")
        
        lines.append("## 2. 复核清单")
        lines.append("")
        
        if 'review_status' in df.columns:
            need_confirm = df[df['review_status'] == 'need_confirm']
            if len(need_confirm) > 0:
                lines.append("### 需要人工确认的样本")
                lines.append("")
                lines.append("| sample_id | 模型预测 | 历史标签 | 备注 |")
                lines.append("|-----------|----------|----------|------|")
                for _, row in need_confirm.iterrows():
                    lines.append(f"| {row.get('sample_id', '')} | {row.get('predicted_label', '')} | {row.get('human_label', '')} | {row.get('review_note', '')} |")
                lines.append("")
            
            pending = df[df['review_status'] == 'pending']
            if len(pending) > 0:
                lines.append("### 待复核样本")
                lines.append("")
                lines.append("| sample_id | 缺陷类型 | 模型预测 | 置信度 |")
                lines.append("|-----------|----------|----------|--------|")
                for _, row in pending.iterrows():
                    conf = row.get('confidence', 0)
                    try:
                        conf_float = float(conf)
                    except (ValueError, TypeError):
                        conf_float = 0.0
                    lines.append(f"| {row.get('sample_id', '')} | {row.get('defect_type', '')} | {row.get('predicted_label', '')} | {conf_float:.2f} |")
                lines.append("")
        
        lines.append("## 3. 聚类结果")
        lines.append("")
        
        if 'cluster_id' in df.columns:
            clusters = df['cluster_id'].unique()
            for cid in sorted(clusters):
                if cid == 'noise':
                    continue
                cluster_samples = df[df['cluster_id'] == cid]
                lines.append(f"### 聚类 {cid} ({len(cluster_samples)} 个样本)")
                lines.append("")
                
                rep = cluster_samples[cluster_samples['cluster_representative'] == True]
                if len(rep) > 0:
                    lines.append(f"- 代表样本: {rep.iloc[0].get('sample_id', '')}")
                    lines.append(f"- 主导类型: {rep.iloc[0].get('cluster_label', '')}")
                
                lines.append(f"- 缺陷类型分布: {cluster_samples['defect_type'].value_counts().to_dict() if 'defect_type' in cluster_samples else {}}")
                lines.append("")
        
        lines.append("## 4. 判断过程追溯")
        lines.append("")
        lines.append("> 所有样本的判断过程已完整记录在 JSON 报告中")
        lines.append("> 可通过 sample_id 查询具体决策轨迹")
        lines.append("")
        
        lines.append("## 5. 交接说明")
        lines.append("")
        lines.append("- [ ] 已确认所有 need_confirm 样本")
        lines.append("- [ ] 已完成所有 pending 样本复核")
        lines.append("- [ ] 已保存最终标签到历史记录")
        lines.append("- [ ] 报告已归档")
        lines.append("")
        
        return "\n".join(lines)
    
    def compare_version_metrics(self, old_metrics: Dict, new_metrics: Dict) -> Dict:
        comparison = {
            "sample_changes": {
                "old_total": old_metrics.get('total_samples', 0),
                "new_total": new_metrics.get('total_samples', 0),
                "delta": new_metrics.get('total_samples', 0) - old_metrics.get('total_samples', 0)
            },
            "review_changes": {},
            "label_changes": {},
            "metric_notes": []
        }
        
        old_review = old_metrics.get('review_status', {})
        new_review = new_metrics.get('review_status', {})
        all_statuses = set(old_review.keys()) | set(new_review.keys())
        
        for status in all_statuses:
            old_val = old_review.get(status, 0)
            new_val = new_review.get(status, 0)
            if old_val != new_val:
                comparison["review_changes"][status] = {
                    "old": old_val,
                    "new": new_val,
                    "delta": new_val - old_val
                }
        
        old_labels = old_metrics.get('label_distribution', {}).get('predicted_label', {})
        new_labels = new_metrics.get('label_distribution', {}).get('predicted_label', {})
        all_labels = set(old_labels.keys()) | set(new_labels.keys())
        
        for label in all_labels:
            old_val = old_labels.get(label, 0)
            new_val = new_labels.get(label, 0)
            if old_val != new_val:
                comparison["label_changes"][label] = {
                    "old": old_val,
                    "new": new_val,
                    "delta": new_val - old_val
                }
        
        if comparison["sample_changes"]["delta"] != 0:
            comparison["metric_notes"].append(f"样本数量变化: {comparison['sample_changes']['delta']:+d}")
        
        if comparison["review_changes"]:
            comparison["metric_notes"].append("复核状态有变更")
        
        if comparison["label_changes"]:
            comparison["metric_notes"].append("标签分布有变更")
        
        return comparison
    
    def export_result_excel(self, df: pd.DataFrame, version_id: str) -> str:
        report_id = self.generate_report_id(version_id)
        output_path = self.report_dir / f"{report_id}_results.xlsx"
        
        export_cols = ['sample_id', 'image_path', 'defect_type', 'defect_location',
                       'defect_description', 'predicted_label', 'confidence',
                       'cluster_id', 'cluster_label', 'cluster_representative',
                       'human_label', 'review_status', 'review_note', 'review_source']
        
        available_cols = [c for c in export_cols if c in df.columns]
        export_df = df[available_cols].copy()
        
        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            export_df.to_excel(writer, sheet_name='完整结果', index=False)
            
            if 'review_status' in df.columns:
                need_confirm = df[df['review_status'] == 'need_confirm']
                if len(need_confirm) > 0:
                    need_confirm[available_cols].to_excel(writer, sheet_name='待确认', index=False)
                
                pending = df[df['review_status'] == 'pending']
                if len(pending) > 0:
                    pending[available_cols].to_excel(writer, sheet_name='待复核', index=False)
            
            if 'cluster_id' in df.columns:
                def get_dominant(x):
                    vc = x.value_counts()
                    return vc.index[0] if len(vc) > 0 else ''
                
                def get_mean_confidence(x):
                    numeric = pd.to_numeric(x, errors='coerce').dropna()
                    return numeric.mean() if len(numeric) > 0 else 0
                
                cluster_summary = df.groupby('cluster_id').agg({
                    'sample_id': 'count',
                    'defect_type': get_dominant,
                    'confidence': get_mean_confidence
                }).rename(columns={
                    'sample_id': '样本数量',
                    'defect_type': '主导类型',
                    'confidence': '平均置信度'
                })
                cluster_summary.to_excel(writer, sheet_name='聚类统计')
        
        return str(output_path)
    
    def list_reports(self) -> List[Dict]:
        reports = []
        for report_file in sorted(self.report_dir.glob("*.json")):
            with open(report_file, 'r', encoding='utf-8') as f:
                try:
                    report_data = json.load(f)
                    reports.append({
                        "file": report_file.name,
                        "report_id": report_data.get('report_id', ''),
                        "version_id": report_data.get('version_info', {}).get('version_id', ''),
                        "generated_at": report_data.get('generated_at', ''),
                        "total_samples": report_data.get('sample_summary', {}).get('total_samples', 0)
                    })
                except:
                    continue
        
        return reports
