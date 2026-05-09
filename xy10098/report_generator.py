import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.ticker import MultipleLocator
import pandas as pd
import numpy as np
from config import OUTPUT_DIR, REPORTS_DIR


class ReportGenerator:
    def __init__(self):
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        os.makedirs(REPORTS_DIR, exist_ok=True)
        plt.rcParams['font.sans-serif'] = ['Arial Unicode MS', 'SimHei', 'DejaVu Sans']
        plt.rcParams['axes.unicode_minus'] = False
    
    def generate_all_reports(self, pipeline_result, simulation_result, output_prefix='irrigation'):
        reports = []
        
        summary_html = self.generate_summary_report(pipeline_result, simulation_result, output_prefix)
        reports.append(summary_html)
        
        chart_files = self.generate_charts(simulation_result, output_prefix)
        reports.extend(chart_files)
        
        table_html = self.generate_tables(pipeline_result, simulation_result, output_prefix)
        reports.append(table_html)
        
        return reports
    
    def generate_summary_report(self, pipeline_result, simulation_result, output_prefix):
        html_content = '''
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>温室灌溉阈值模拟分析报告</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; }
        h3 { color: #7f8c8d; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .summary-card { background: #ecf0f1; padding: 20px; border-radius: 8px; text-align: center; }
        .summary-card .number { font-size: 36px; font-weight: bold; color: #3498db; }
        .summary-card .label { font-size: 14px; color: #7f8c8d; margin-top: 5px; }
        .good { color: #27ae60; }
        .warning { color: #e67e22; }
        .danger { color: #e74c3c; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #3498db; color: white; }
        tr:hover { background-color: #f8f9fa; }
        .chart-container { margin: 30px 0; text-align: center; }
        .chart-container img { max-width: 100%; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .section { margin: 30px 0; padding: 20px; background: #fafafa; border-radius: 8px; }
        .metric-table { width: auto; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>温室灌溉阈值模拟分析报告</h1>
        <p>生成时间: ''' + pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S') + '''</p>
        '''
        
        preprocess_stats = pipeline_result.get('statistics', {})
        qc_result = pipeline_result.get('qc_result', {})
        qc_report = qc_result.get('quality_report', {})
        sim_stats = simulation_result.get('statistics', {})
        
        html_content += '''
        <h2>一、数据处理概览</h2>
        <div class="summary-grid">
            <div class="summary-card">
                <div class="number">''' + str(pipeline_result.get('original_count', 0)) + '''</div>
                <div class="label">原始样本数</div>
            </div>
            <div class="summary-card">
                <div class="number ''' + ('good' if pipeline_result.get('valid_count', 0) > 0 else 'danger') + '''">''' + str(pipeline_result.get('valid_count', 0)) + '''</div>
                <div class="label">有效样本数</div>
            </div>
            <div class="summary-card">
                <div class="number">''' + str(preprocess_stats.get('duplicates_removed', 0)) + '''</div>
                <div class="label">重复样本移除</div>
            </div>
            <div class="summary-card">
                <div class="number danger">''' + str(pipeline_result.get('failed_count', 0) + qc_result.get('failed_count', 0)) + '''</div>
                <div class="label">失败样本总数</div>
            </div>
        </div>
        
        <h2>二、质量控制结果</h2>
        <div class="section">
            <h3>质控统计</h3>
            <table>
                <tr>
                    <th>检查项</th>
                    <th>样本数</th>
                    <th>状态</th>
                </tr>
                <tr>
                    <td>范围验证失败</td>
                    <td>''' + str(qc_report.get('range_failures', 0)) + '''</td>
                    <td class="''' + ('good' if qc_report.get('range_failures', 0) == 0 else 'warning') + '''">''' + ('通过' if qc_report.get('range_failures', 0) == 0 else '有问题') + '''</td>
                </tr>
                <tr>
                    <td>异常值检测</td>
                    <td>''' + str(qc_report.get('anomaly_failures', 0)) + '''</td>
                    <td class="''' + ('good' if qc_report.get('anomaly_failures', 0) == 0 else 'warning') + '''">''' + ('通过' if qc_report.get('anomaly_failures', 0) == 0 else '有问题') + '''</td>
                </tr>
                <tr>
                    <td>一致性检查</td>
                    <td>''' + str(qc_report.get('consistency_failures', 0)) + '''</td>
                    <td class="''' + ('good' if qc_report.get('consistency_failures', 0) == 0 else 'warning') + '''">''' + ('通过' if qc_report.get('consistency_failures', 0) == 0 else '有问题') + '''</td>
                </tr>
                <tr>
                    <td>总通过率</td>
                    <td>''' + f"{qc_report.get('pass_rate', 0)*100:.2f}" + '''%</td>
                    <td class="''' + ('good' if qc_report.get('pass_rate', 0) >= 0.8 else 'danger') + '''">''' + ('优秀' if qc_report.get('pass_rate', 0) >= 0.9 else '良好' if qc_report.get('pass_rate', 0) >= 0.7 else '需关注') + '''</td>
                </tr>
            </table>
        </div>
        
        <h2>三、灌溉模拟结果</h2>
        <div class="section">
            <h3>阈值参数</h3>
            <table class="metric-table">
                <tr><th>参数</th><th>值</th></tr>
                <tr><td>低阈值 (开启灌溉)</td><td>''' + str(sim_stats.get('threshold_low', 0)) + '''%</td></tr>
                <tr><td>高阈值 (关闭灌溉)</td><td>''' + str(sim_stats.get('threshold_high', 0)) + '''%</td></tr>
                <tr><td>噪声水平</td><td>''' + str(sim_stats.get('noise_level', 0)) + '''</td></tr>
            </table>
        </div>
        
        <div class="section">
            <h3>模拟统计</h3>
            <div class="summary-grid">
                <div class="summary-card">
                    <div class="number">''' + str(sim_stats.get('total_samples', 0)) + '''</div>
                    <div class="label">模拟样本数</div>
                </div>
                <div class="summary-card">
                    <div class="number">''' + str(sim_stats.get('irrigation_activated', 0)) + '''</div>
                    <div class="label">灌溉开启次数</div>
                </div>
                <div class="summary-card danger">
                    <div class="number">''' + str(sim_stats.get('over_irrigation_risk', 0)) + '''</div>
                    <div class="label">过灌风险</div>
                </div>
                <div class="summary-card danger">
                    <div class="number">''' + str(sim_stats.get('under_irrigation_risk', 0)) + '''</div>
                    <div class="label">漏灌风险</div>
                </div>
            </div>
        </div>
        
        <div class="section">
            <h3>湿度统计</h3>
            <table>
                <tr>
                    <th>指标</th>
                    <th>原始湿度</th>
                    <th>加噪声后湿度</th>
                </tr>
                <tr>
                    <td>平均值</td>
                    <td>''' + f"{sim_stats.get('avg_humidity', 0):.2f}" + '''%</td>
                    <td>''' + f"{sim_stats.get('avg_humidity', 0):.2f}" + '''%</td>
                </tr>
                <tr>
                    <td>最小值</td>
                    <td>''' + f"{sim_stats.get('min_humidity', 0):.2f}" + '''%</td>
                    <td>''' + f"{sim_stats.get('min_humidity', 0):.2f}" + '''%</td>
                </tr>
                <tr>
                    <td>最大值</td>
                    <td>''' + f"{sim_stats.get('max_humidity', 0):.2f}" + '''%</td>
                    <td>''' + f"{sim_stats.get('max_humidity', 0):.2f}" + '''%</td>
                </tr>
            </table>
        </div>
        
        <h2>四、风险评估</h2>
        <div class="section">
            '''
        
        over_risk = sim_stats.get('over_irrigation_risk', 0)
        under_risk = sim_stats.get('under_irrigation_risk', 0)
        
        risk_level = '低'
        risk_class = 'good'
        if over_risk + under_risk > 10:
            risk_level = '高'
            risk_class = 'danger'
        elif over_risk + under_risk > 5:
            risk_level = '中'
            risk_class = 'warning'
        
        html_content += '''
            <p><strong>整体风险等级: <span class="''' + risk_class + '''">''' + risk_level + '''</span></strong></p>
            <ul>
                <li>过灌风险样本数: ''' + str(over_risk) + ''' (湿度过高时仍在灌溉)</li>
                <li>漏灌风险样本数: ''' + str(under_risk) + ''' (湿度过低时未灌溉)</li>
            </ul>
            
            <h3>建议</h3>
            <ul>
        '''
        
        if risk_level == '高':
            html_content += '''
                <li>建议调整阈值范围，增加滞回区间</li>
                <li>考虑增加传感器数量以减少噪声影响</li>
                <li>对数据进行更严格的滤波处理</li>
            '''
        elif risk_level == '中':
            html_content += '''
                <li>建议监测灌溉效果，适当微调阈值</li>
                <li>可以考虑增加数据平滑处理</li>
            '''
        else:
            html_content += '''
                <li>当前阈值设置合理，可以保持</li>
                <li>建议定期复查数据质量</li>
            '''
        
        html_content += '''
            </ul>
        </div>
    </div>
</body>
</html>
        '''
        
        output_file = os.path.join(REPORTS_DIR, f'{output_prefix}_summary_report.html')
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        return output_file
    
    def generate_charts(self, simulation_result, output_prefix):
        chart_files = []
        sim_data = simulation_result.get('simulation_data')
        
        if sim_data is None or len(sim_data) == 0:
            return chart_files
        
        fig, axes = plt.subplots(2, 2, figsize=(16, 12))
        fig.suptitle('温室灌溉阈值模拟分析', fontsize=16, fontweight='bold')
        
        ax1 = axes[0, 0]
        ax1.plot(sim_data['timestamp'], sim_data['humidity'], 'b-', label='原始湿度', alpha=0.7)
        ax1.plot(sim_data['timestamp'], sim_data['humidity_noise'], 'g-', label='带噪声湿度', alpha=0.5)
        ax1.axhline(y=simulation_result['statistics']['threshold_low'], color='r', linestyle='--', label='低阈值')
        ax1.axhline(y=simulation_result['statistics']['threshold_high'], color='r', linestyle='-', label='高阈值')
        ax1.set_title('湿度时间序列与阈值')
        ax1.set_xlabel('时间')
        ax1.set_ylabel('湿度 (%)')
        ax1.legend(loc='best')
        ax1.xaxis.set_major_formatter(mdates.DateFormatter('%m-%d %H'))
        ax1.tick_params(axis='x', rotation=45)
        ax1.grid(True, alpha=0.3)
        
        ax2 = axes[0, 1]
        ax2.hist(sim_data['humidity'], bins=20, alpha=0.5, label='原始湿度', color='blue')
        ax2.hist(sim_data['humidity_noise'], bins=20, alpha=0.5, label='带噪声湿度', color='green')
        ax2.axvline(x=simulation_result['statistics']['threshold_low'], color='r', linestyle='--', label='低阈值')
        ax2.axvline(x=simulation_result['statistics']['threshold_high'], color='r', linestyle='-', label='高阈值')
        ax2.set_title('湿度分布直方图')
        ax2.set_xlabel('湿度 (%)')
        ax2.set_ylabel('频数')
        ax2.legend(loc='best')
        ax2.grid(True, alpha=0.3)
        
        ax3 = axes[1, 0]
        colors = ['green' if x == 0 else 'blue' for x in sim_data['irrigation_decision']]
        ax3.scatter(sim_data['timestamp'], sim_data['humidity_noise'], c=colors, s=30, alpha=0.6)
        ax3.axhline(y=simulation_result['statistics']['threshold_low'], color='r', linestyle='--')
        ax3.axhline(y=simulation_result['statistics']['threshold_high'], color='r', linestyle='-')
        ax3.set_title('灌溉决策散点图 (绿色=关闭, 蓝色=开启)')
        ax3.set_xlabel('时间')
        ax3.set_ylabel('湿度 (%)')
        ax3.xaxis.set_major_formatter(mdates.DateFormatter('%m-%d %H'))
        ax3.tick_params(axis='x', rotation=45)
        ax3.grid(True, alpha=0.3)
        
        ax4 = axes[1, 1]
        decisions = ['关闭', '开启']
        counts = [(sim_data['irrigation_decision'] == 0).sum(), (sim_data['irrigation_decision'] == 1).sum()]
        colors_pie = ['#e74c3c', '#3498db']
        ax4.pie(counts, labels=decisions, colors=colors_pie, autopct='%1.1f%%', startangle=90)
        ax4.set_title('灌溉决策分布')
        
        plt.tight_layout()
        chart_file1 = os.path.join(REPORTS_DIR, f'{output_prefix}_analysis_charts.png')
        plt.savefig(chart_file1, dpi=150, bbox_inches='tight')
        plt.close()
        chart_files.append(chart_file1)
        
        fig, ax = plt.subplots(figsize=(12, 6))
        ax.plot(sim_data['timestamp'], sim_data['humidity_noise'], 'b-', label='湿度', alpha=0.7)
        ax.axhline(y=simulation_result['statistics']['threshold_low'], color='r', linestyle='--', label='低阈值')
        ax.axhline(y=simulation_result['statistics']['threshold_high'], color='r', linestyle='-', label='高阈值')
        
        for idx, row in sim_data.iterrows():
            if row['irrigation_decision'] == 1:
                ax.axvspan(row['timestamp'], row['timestamp'], alpha=0.3, color='green', linewidth=0)
        
        irrigation_periods = sim_data[sim_data['irrigation_decision'] == 1]
        for _, row in irrigation_periods.iterrows():
            ax.axvline(x=row['timestamp'], ymin=0, ymax=0.1, color='green', linewidth=2, alpha=0.5)
        
        ax.set_title('湿度与灌溉决策时间线')
        ax.set_xlabel('时间')
        ax.set_ylabel('湿度 (%)')
        ax.legend(loc='best')
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%m-%d %H'))
        ax.tick_params(axis='x', rotation=45)
        ax.grid(True, alpha=0.3)
        
        chart_file2 = os.path.join(REPORTS_DIR, f'{output_prefix}_irrigation_timeline.png')
        plt.tight_layout()
        plt.savefig(chart_file2, dpi=150, bbox_inches='tight')
        plt.close()
        chart_files.append(chart_file2)
        
        return chart_files
    
    def generate_tables(self, pipeline_result, simulation_result, output_prefix):
        html_content = '''
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>详细数据表</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1400px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; }
        h1, h2 { color: #2c3e50; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 12px; }
        th, td { padding: 8px; text-align: left; border: 1px solid #ddd; }
        th { background-color: #3498db; color: white; position: sticky; top: 0; }
        tr:hover { background-color: #f8f9fa; }
        .failed { background-color: #ffcccc; }
        .section { margin: 30px 0; padding: 20px; background: #fafafa; border-radius: 8px; }
        .scrollable { max-height: 400px; overflow-y: auto; }
    </style>
</head>
<body>
    <div class="container">
        <h1>详细数据表</h1>
        '''
        
        preprocess_failed = pipeline_result.get('failed_records', [])
        qc_failed = pipeline_result.get('qc_result', {}).get('failed_records', [])
        all_failed = preprocess_failed + qc_failed
        
        if all_failed:
            html_content += '''
        <h2>一、失败样本详情</h2>
        <div class="section">
            <div class="scrollable">
                <table>
                    <thead>
                        <tr>
                            <th>序号</th>
                            <th>类别</th>
                            <th>失败原因</th>
                            <th>数据摘要</th>
                        </tr>
                    </thead>
                    <tbody>
            '''
            
            for i, record in enumerate(all_failed, 1):
                data_str = str(record.get('data', {}))[:200]
                html_content += f'''
                        <tr class="failed">
                            <td>{i}</td>
                            <td>{record.get('category', '未知')}</td>
                            <td>{record.get('reason', '未知原因')}</td>
                            <td>{data_str}</td>
                        </tr>
                '''
            
            html_content += '''
                    </tbody>
                </table>
            </div>
        </div>
            '''
        
        sim_data = simulation_result.get('simulation_data')
        if sim_data is not None and len(sim_data) > 0:
            html_content += '''
        <h2>二、模拟结果数据</h2>
        <div class="section">
            <div class="scrollable">
                <table>
                    <thead>
                        <tr>
                            <th>时间</th>
                            <th>原始湿度</th>
                            <th>加噪声湿度</th>
                            <th>灌溉决策</th>
                            <th>是否应灌溉</th>
                            <th>是否应停止</th>
                        </tr>
                    </thead>
                    <tbody>
            '''
            
            for _, row in sim_data.iterrows():
                decision_text = '开启' if row['irrigation_decision'] == 1 else '关闭'
                html_content += f'''
                        <tr>
                            <td>{row['timestamp']}</td>
                            <td>{row.get('humidity', 'N/A'):.2f}%</td>
                            <td>{row.get('humidity_noise', 'N/A'):.2f}%</td>
                            <td>{decision_text}</td>
                            <td>{'是' if row['should_irrigate'] == 1 else '否'}</td>
                            <td>{'是' if row['should_stop'] == 1 else '否'}</td>
                        </tr>
                '''
            
            html_content += '''
                    </tbody>
                </table>
            </div>
        </div>
            '''
        
        html_content += '''
    </div>
</body>
</html>
        '''
        
        output_file = os.path.join(REPORTS_DIR, f'{output_prefix}_detail_tables.html')
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        return output_file
