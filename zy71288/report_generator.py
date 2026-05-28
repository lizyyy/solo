import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from typing import List, Dict, Any, Optional
from datetime import datetime
from pathlib import Path
import logging
import json

from config import config
from data_models import ForecastResult, AnomalyRecord

logger = logging.getLogger(__name__)

plt.rcParams['font.sans-serif'] = ['Arial Unicode MS', 'SimHei']
plt.rcParams['axes.unicode_minus'] = False


class ReportGenerator:
    def __init__(self, output_dir: Optional[Path] = None):
        self.output_dir = output_dir or config.CHARTS_DIR
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def create_forecast_chart(self, forecast_results: List[ForecastResult],
                               historical_data: Optional[List[Dict[str, Any]]] = None,
                               filename: str = "forecast_chart.png") -> str:
        logger.info("生成预测趋势图表...")
        
        pred_df = pd.DataFrame([f.model_dump() for f in forecast_results])
        pred_df['datetime'] = pd.to_datetime(pred_df['date'] + ' ' + pred_df['hour'].astype(str) + ':00')
        
        fig, ax = plt.subplots(figsize=(14, 8))
        
        if historical_data:
            hist_df = pd.DataFrame(historical_data)
            hist_df['datetime'] = pd.to_datetime(hist_df['date'] + ' ' + hist_df['hour'].astype(str) + ':00')
            hist_df = hist_df.sort_values('datetime')
            ax.plot(hist_df['datetime'], hist_df['actual_visitors'], 
                    label='历史客流', color='gray', alpha=0.6, linestyle='--')
        
        ax.plot(pred_df['datetime'], pred_df['predicted_visitors'], 
                label='预测客流', color='#1f77b4', linewidth=2)
        ax.fill_between(pred_df['datetime'], 
                        pred_df['lower_bound'], 
                        pred_df['upper_bound'], 
                        alpha=0.3, color='#1f77b4', label='置信区间')
        
        ax.axhline(y=config.GALLERY_CAPACITY, color='red', linestyle='--', 
                   label=f'展厅容量({config.GALLERY_CAPACITY}人)')
        ax.axhline(y=config.GALLERY_CAPACITY * config.SAFE_OCCUPANCY_RATE, 
                   color='orange', linestyle='--', 
                   label=f'安全线({int(config.GALLERY_CAPACITY * config.SAFE_OCCUPANCY_RATE)}人)')
        
        ax.set_xlabel('时间', fontsize=12)
        ax.set_ylabel('客流人数', fontsize=12)
        ax.set_title('艺术展客流预测趋势图', fontsize=14, fontweight='bold')
        ax.legend(loc='upper right')
        ax.grid(True, alpha=0.3)
        plt.xticks(rotation=45)
        plt.tight_layout()
        
        output_path = self.output_dir / filename
        plt.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close()
        
        logger.info(f"图表已保存: {output_path}")
        return str(output_path)
    
    def create_scenario_comparison_chart(self, scenario_results: Dict[str, List[ForecastResult]],
                                          filename: str = "scenario_comparison.png") -> str:
        logger.info("生成多情景对比图表...")
        
        fig, ax = plt.subplots(figsize=(14, 8))
        
        colors = {
            'base': '#1f77b4',
            'optimistic': '#2ca02c',
            'pessimistic': '#ff7f0e'
        }
        
        labels = {
            'base': '基准情景',
            'optimistic': '乐观情景',
            'pessimistic': '悲观情景'
        }
        
        for scenario, results in scenario_results.items():
            df = pd.DataFrame([f.model_dump() for f in results])
            df['datetime'] = pd.to_datetime(df['date'] + ' ' + df['hour'].astype(str) + ':00')
            df = df.sort_values('datetime')
            
            ax.plot(df['datetime'], df['predicted_visitors'], 
                    label=labels.get(scenario, scenario), 
                    color=colors.get(scenario, '#1f77b4'), 
                    linewidth=2)
        
        ax.axhline(y=config.GALLERY_CAPACITY, color='red', linestyle='--', 
                   label=f'展厅容量({config.GALLERY_CAPACITY}人)')
        
        ax.set_xlabel('时间', fontsize=12)
        ax.set_ylabel('预测客流人数', fontsize=12)
        ax.set_title('多情景客流预测对比', fontsize=14, fontweight='bold')
        ax.legend(loc='upper right')
        ax.grid(True, alpha=0.3)
        plt.xticks(rotation=45)
        plt.tight_layout()
        
        output_path = self.output_dir / filename
        plt.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close()
        
        logger.info(f"图表已保存: {output_path}")
        return str(output_path)
    
    def create_hourly_distribution_chart(self, forecast_results: List[ForecastResult],
                                          filename: str = "hourly_distribution.png") -> str:
        logger.info("生成小时分布图表...")
        
        df = pd.DataFrame([f.model_dump() for f in forecast_results])
        
        hourly_avg = df.groupby('hour')['predicted_visitors'].agg(['mean', 'min', 'max'])
        
        fig, ax = plt.subplots(figsize=(12, 6))
        
        bars = ax.bar(hourly_avg.index, hourly_avg['mean'], 
                      color='#1f77b4', alpha=0.7, label='平均预测')
        ax.errorbar(hourly_avg.index, hourly_avg['mean'],
                    yerr=[hourly_avg['mean'] - hourly_avg['min'], 
                          hourly_avg['max'] - hourly_avg['mean']],
                    fmt='none', color='gray', capsize=5)
        
        ax.axhline(y=config.GALLERY_CAPACITY, color='red', linestyle='--', alpha=0.7)
        ax.axhline(y=config.GALLERY_CAPACITY * config.SAFE_OCCUPANCY_RATE, 
                   color='orange', linestyle='--', alpha=0.7)
        
        ax.set_xlabel('小时', fontsize=12)
        ax.set_ylabel('预测客流人数', fontsize=12)
        ax.set_title('小时客流分布预测', fontsize=14, fontweight='bold')
        ax.set_xticks(range(0, 24))
        ax.grid(True, alpha=0.3, axis='y')
        plt.legend()
        plt.tight_layout()
        
        output_path = self.output_dir / filename
        plt.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close()
        
        logger.info(f"图表已保存: {output_path}")
        return str(output_path)
    
    def create_error_analysis_chart(self, historical_data: List[Dict[str, Any]],
                                     predictions: List[ForecastResult],
                                     error_metrics: Dict[str, float],
                                     filename: str = "error_analysis.png") -> str:
        logger.info("生成误差分析图表...")
        
        hist_df = pd.DataFrame(historical_data)
        pred_df = pd.DataFrame([p.model_dump() for p in predictions])
        
        merged = hist_df.merge(pred_df, on=['date', 'hour'], how='inner')
        
        if len(merged) == 0:
            logger.warning("没有可对比的数据，跳过误差分析图表")
            return ""
        
        merged['error'] = merged['predicted_visitors'] - merged['actual_visitors']
        merged['error_pct'] = merged['error'] / merged['actual_visitors'] * 100
        merged['datetime'] = pd.to_datetime(merged['date'] + ' ' + merged['hour'].astype(str) + ':00')
        
        fig, axes = plt.subplots(2, 1, figsize=(14, 10))
        
        ax1 = axes[0]
        ax1.plot(merged['datetime'], merged['actual_visitors'], 
                 label='实际值', color='green', marker='o')
        ax1.plot(merged['datetime'], merged['predicted_visitors'], 
                 label='预测值', color='blue', marker='x')
        ax1.set_title('实际值 vs 预测值对比', fontsize=12, fontweight='bold')
        ax1.set_ylabel('客流人数')
        ax1.legend()
        ax1.grid(True, alpha=0.3)
        plt.setp(ax1.get_xticklabels(), rotation=45)
        
        ax2 = axes[1]
        colors = ['red' if abs(e) > 50 else 'orange' if abs(e) > 20 else 'green' 
                  for e in merged['error']]
        ax2.bar(merged['datetime'], merged['error'], color=colors, alpha=0.7)
        ax2.axhline(y=0, color='black', linestyle='-', linewidth=0.5)
        ax2.set_title(f'预测误差 (MAE: {error_metrics.get("mae", 0):.1f}, MAPE: {error_metrics.get("mape", 0):.1f}%)', 
                      fontsize=12, fontweight='bold')
        ax2.set_ylabel('误差值')
        ax2.grid(True, alpha=0.3, axis='y')
        plt.setp(ax2.get_xticklabels(), rotation=45)
        
        plt.tight_layout()
        
        output_path = self.output_dir / filename
        plt.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close()
        
        logger.info(f"图表已保存: {output_path}")
        return str(output_path)
    
    def create_anomaly_summary_chart(self, anomalies: List[AnomalyRecord],
                                      filename: str = "anomaly_summary.png") -> str:
        logger.info("生成异常汇总图表...")
        
        if not anomalies:
            logger.warning("没有异常数据，跳过异常汇总图表")
            return ""
        
        df = pd.DataFrame([a.model_dump() for a in anomalies])
        
        fig, axes = plt.subplots(1, 2, figsize=(14, 6))
        
        severity_counts = df['severity'].value_counts()
        colors_severity = {'error': '#ff4444', 'warning': '#ffbb33', 'info': '#00C851'}
        axes[0].pie(severity_counts.values, labels=severity_counts.index,
                    colors=[colors_severity.get(s, '#33b5e5') for s in severity_counts.index],
                    autopct='%1.1f%%', startangle=90)
        axes[0].set_title('异常严重程度分布', fontsize=12, fontweight='bold')
        
        type_counts = df['anomaly_type'].value_counts()
        bars = axes[1].barh(range(len(type_counts)), type_counts.values, color='#1f77b4')
        axes[1].set_yticks(range(len(type_counts)))
        axes[1].set_yticklabels(type_counts.index)
        axes[1].set_title('异常类型分布', fontsize=12, fontweight='bold')
        axes[1].set_xlabel('数量')
        
        for i, bar in enumerate(bars):
            width = bar.get_width()
            axes[1].text(width + 0.1, bar.get_y() + bar.get_height()/2,
                         f'{int(width)}', ha='left', va='center')
        
        plt.tight_layout()
        
        output_path = self.output_dir / filename
        plt.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close()
        
        logger.info(f"图表已保存: {output_path}")
        return str(output_path)
    
    def generate_forecast_report(self, forecast_results: List[ForecastResult],
                                  error_metrics: Optional[Dict[str, float]] = None,
                                  anomalies: Optional[List[AnomalyRecord]] = None,
                                  filename: str = "forecast_report.csv") -> str:
        logger.info("生成预测报告CSV...")
        
        df = pd.DataFrame([f.model_dump() for f in forecast_results])
        df = df[['date', 'hour', 'predicted_visitors', 'lower_bound', 
                 'upper_bound', 'confidence_level', 'scenario']]
        df['predicted_visitors'] = df['predicted_visitors'].round(0).astype(int)
        df['lower_bound'] = df['lower_bound'].round(0).astype(int)
        df['upper_bound'] = df['upper_bound'].round(0).astype(int)
        
        output_path = config.REPORTS_DIR / filename
        df.to_csv(output_path, index=False, encoding='utf-8-sig')
        
        logger.info(f"报告已保存: {output_path}")
        return str(output_path)
    
    def generate_full_report(self, forecast_results: List[ForecastResult],
                              scenario_results: Dict[str, List[ForecastResult]],
                              historical_data: Optional[List[Dict[str, Any]]] = None,
                              error_metrics: Optional[Dict[str, float]] = None,
                              anomalies: Optional[List[AnomalyRecord]] = None,
                              model_info: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        logger.info("生成完整报告包...")
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        charts = {}
        charts['forecast'] = self.create_forecast_chart(
            forecast_results, historical_data,
            f"forecast_chart_{timestamp}.png"
        )
        
        charts['scenario'] = self.create_scenario_comparison_chart(
            scenario_results,
            f"scenario_comparison_{timestamp}.png"
        )
        
        charts['hourly'] = self.create_hourly_distribution_chart(
            forecast_results,
            f"hourly_distribution_{timestamp}.png"
        )
        
        if historical_data and error_metrics:
            charts['error'] = self.create_error_analysis_chart(
                historical_data, forecast_results, error_metrics,
                f"error_analysis_{timestamp}.png"
            )
        
        if anomalies:
            charts['anomaly'] = self.create_anomaly_summary_chart(
                anomalies,
                f"anomaly_summary_{timestamp}.png"
            )
        
        report_file = self.generate_forecast_report(
            forecast_results, error_metrics, anomalies,
            f"forecast_report_{timestamp}.csv"
        )
        
        summary = {
            'timestamp': timestamp,
            'charts': charts,
            'report_file': report_file,
            'forecast_count': len(forecast_results),
            'error_metrics': error_metrics or {},
            'anomaly_count': len(anomalies) if anomalies else 0,
            'model_info': model_info or {}
        }
        
        summary_file = config.REPORTS_DIR / f"summary_{timestamp}.json"
        with open(summary_file, 'w', encoding='utf-8') as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        
        logger.info(f"完整报告生成完成，摘要文件: {summary_file}")
        return summary
