import pandas as pd
from pathlib import Path
from typing import Dict, List, Any
from datetime import datetime


class DataExporter:
    @staticmethod
    def export_anomalies_csv(anomalies: List[Dict[str, Any]], output_path: str = "anomalies.csv"):
        df = pd.DataFrame(anomalies)
        df.to_csv(output_path, index=False, encoding='utf-8-sig')
        return output_path

    @staticmethod
    def export_summary_md(quadrat_metrics: pd.DataFrame, site_metrics: pd.DataFrame, anomalies: List[Dict[str, Any]], output_path: str = "summary.md"):
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("# 生态样方复核报告\n\n")
            f.write(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            
            f.write("## 1. 样地总体统计\n\n")
            f.write(site_metrics.to_markdown(index=False))
            f.write("\n\n")
            
            f.write("## 2. 样方多样性指标\n\n")
            f.write(quadrat_metrics.to_markdown(index=False))
            f.write("\n\n")
            
            f.write("## 3. 异常检测结果\n\n")
            if not anomalies:
                f.write("✅ 未检测到异常\n\n")
            else:
                f.write(f"共检测到 **{len(anomalies)}** 个异常项：\n\n")
                for i, anomaly in enumerate(anomalies, 1):
                    f.write(f"### {i}. {anomaly.get('type', '未知异常')}\n\n")
                    f.write(f"- **严重程度**: {anomaly.get('severity', 'unknown')}\n")
                    for key, value in anomaly.items():
                        if key not in ['type', 'severity']:
                            f.write(f"- **{key}**: {value}\n")
                    f.write("\n")
        
        return output_path
