import os
import pandas as pd
from config import OUTPUT_DIR


class DataExporter:
    def __init__(self):
        os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    def export_all(self, pipeline_result, simulation_result, output_prefix='irrigation'):
        exported_files = []
        
        processed_data_file = self.export_processed_data(pipeline_result, output_prefix)
        if processed_data_file:
            exported_files.append(processed_data_file)
        
        failed_records_file = self.export_failed_records(pipeline_result, output_prefix)
        if failed_records_file:
            exported_files.append(failed_records_file)
        
        simulation_file = self.export_simulation_result(simulation_result, output_prefix)
        if simulation_file:
            exported_files.append(simulation_file)
        
        all_data_file = self.export_combined_excel(pipeline_result, simulation_result, output_prefix)
        if all_data_file:
            exported_files.append(all_data_file)
        
        return exported_files
    
    def export_processed_data(self, pipeline_result, output_prefix):
        qc_result = pipeline_result.get('qc_result', {})
        passed_data = qc_result.get('passed_data')
        
        if passed_data is None or len(passed_data) == 0:
            return None
        
        output_file = os.path.join(OUTPUT_DIR, f'{output_prefix}_processed_data.csv')
        passed_data.to_csv(output_file, index=False, encoding='utf-8-sig')
        return output_file
    
    def export_failed_records(self, pipeline_result, output_prefix):
        preprocess_failed = pipeline_result.get('failed_records', [])
        qc_failed = pipeline_result.get('qc_result', {}).get('failed_records', [])
        
        all_failed = preprocess_failed + qc_failed
        
        if not all_failed:
            return None
        
        failed_df = pd.DataFrame([
            {
                'index': record.get('index', i),
                'category': record.get('category', 'unknown'),
                'reason': record.get('reason', '未知原因'),
                'original_data': str(record.get('data', {}))
            }
            for i, record in enumerate(all_failed)
        ])
        
        output_file = os.path.join(OUTPUT_DIR, f'{output_prefix}_failed_records.csv')
        failed_df.to_csv(output_file, index=False, encoding='utf-8-sig')
        return output_file
    
    def export_simulation_result(self, simulation_result, output_prefix):
        sim_data = simulation_result.get('simulation_data')
        
        if sim_data is None or len(sim_data) == 0:
            return None
        
        output_file = os.path.join(OUTPUT_DIR, f'{output_prefix}_simulation_result.csv')
        sim_data.to_csv(output_file, index=False, encoding='utf-8-sig')
        return output_file
    
    def export_combined_excel(self, pipeline_result, simulation_result, output_prefix):
        output_file = os.path.join(OUTPUT_DIR, f'{output_prefix}_complete_report.xlsx')
        
        with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
            summary_data = self._create_summary_sheet(pipeline_result, simulation_result)
            summary_data.to_excel(writer, sheet_name='摘要', index=False)
            
            qc_result = pipeline_result.get('qc_result', {})
            passed_data = qc_result.get('passed_data')
            if passed_data is not None and len(passed_data) > 0:
                passed_data.to_excel(writer, sheet_name='有效数据', index=False)
            
            preprocess_failed = pipeline_result.get('failed_records', [])
            qc_failed = qc_result.get('failed_records', [])
            all_failed = preprocess_failed + qc_failed
            
            if all_failed:
                failed_df = pd.DataFrame([
                    {
                        '序号': i + 1,
                        '类别': record.get('category', 'unknown'),
                        '失败原因': record.get('reason', '未知原因'),
                        '原始数据': str(record.get('data', {}))
                    }
                    for i, record in enumerate(all_failed)
                ])
                failed_df.to_excel(writer, sheet_name='失败记录', index=False)
            
            sim_data = simulation_result.get('simulation_data')
            if sim_data is not None and len(sim_data) > 0:
                sim_data.to_excel(writer, sheet_name='模拟结果', index=False)
            
            stats = simulation_result.get('statistics', {})
            if stats:
                stats_df = pd.DataFrame([
                    {'指标': '低阈值 (开启灌溉)', '值': f"{stats.get('threshold_low', 0)}%"},
                    {'指标': '高阈值 (关闭灌溉)', '值': f"{stats.get('threshold_high', 0)}%"},
                    {'指标': '噪声水平', '值': stats.get('noise_level', 0)},
                    {'指标': '模拟样本数', '值': stats.get('total_samples', 0)},
                    {'指标': '灌溉开启次数', '值': stats.get('irrigation_activated', 0)},
                    {'指标': '过灌风险样本数', '值': stats.get('over_irrigation_risk', 0)},
                    {'指标': '漏灌风险样本数', '值': stats.get('under_irrigation_risk', 0)},
                    {'指标': '平均湿度', '值': f"{stats.get('avg_humidity', 0):.2f}%"},
                    {'指标': '最小湿度', '值': f"{stats.get('min_humidity', 0):.2f}%"},
                    {'指标': '最大湿度', '值': f"{stats.get('max_humidity', 0):.2f}%"},
                ])
                stats_df.to_excel(writer, sheet_name='统计信息', index=False)
        
        return output_file
    
    def _create_summary_sheet(self, pipeline_result, simulation_result):
        preprocess_stats = pipeline_result.get('statistics', {})
        qc_report = pipeline_result.get('qc_result', {}).get('quality_report', {})
        sim_stats = simulation_result.get('statistics', {})
        
        summary_data = [
            {'类别': '数据处理', '指标': '原始样本数', '值': pipeline_result.get('original_count', 0)},
            {'类别': '数据处理', '指标': '有效样本数', '值': pipeline_result.get('valid_count', 0)},
            {'类别': '数据处理', '指标': '重复样本移除', '值': preprocess_stats.get('duplicates_removed', 0)},
            {'类别': '数据处理', '指标': '时间戳问题', '值': preprocess_stats.get('timestamp_failed', 0)},
            {'类别': '数据处理', '指标': '单位问题', '值': preprocess_stats.get('unit_failed', 0)},
            {'类别': '数据处理', '指标': '缺失值问题', '值': preprocess_stats.get('missing_values_failed', 0)},
            {'类别': '质量控制', '指标': '范围验证失败', '值': qc_report.get('range_failures', 0)},
            {'类别': '质量控制', '指标': '异常值检测失败', '值': qc_report.get('anomaly_failures', 0)},
            {'类别': '质量控制', '指标': '一致性检查失败', '值': qc_report.get('consistency_failures', 0)},
            {'类别': '质量控制', '指标': '总通过率', '值': f"{qc_report.get('pass_rate', 0)*100:.2f}%"},
            {'类别': '灌溉模拟', '指标': '低阈值', '值': f"{sim_stats.get('threshold_low', 0)}%"},
            {'类别': '灌溉模拟', '指标': '高阈值', '值': f"{sim_stats.get('threshold_high', 0)}%"},
            {'类别': '灌溉模拟', '指标': '灌溉开启次数', '值': sim_stats.get('irrigation_activated', 0)},
            {'类别': '灌溉模拟', '指标': '过灌风险', '值': sim_stats.get('over_irrigation_risk', 0)},
            {'类别': '灌溉模拟', '指标': '漏灌风险', '值': sim_stats.get('under_irrigation_risk', 0)},
        ]
        
        return pd.DataFrame(summary_data)
