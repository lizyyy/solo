import pandas as pd
import numpy as np
import logging
import os
from typing import Dict, Any
from config import OUTPUT_DIR, CONFIG


logger = logging.getLogger(__name__)


class FileExporter:
    def __init__(self, config: Dict = None):
        self.config = config or CONFIG
        self.timestamp = self.config['timestamp']
        
    def export_all(self, reports: Dict, filled_df: pd.DataFrame,
                   pipeline_log: Dict, loading_errors: list,
                   output_dir: str = None) -> Dict:
        if output_dir is None:
            output_dir = OUTPUT_DIR
            
        os.makedirs(output_dir, exist_ok=True)
        
        exported_files = {}
        
        tables = reports.get('tables', {})
        
        excel_path = self._export_excel(tables, output_dir)
        exported_files['excel_report'] = excel_path
        
        csv_path = self._export_csv(tables, filled_df, output_dir)
        exported_files['csv_data'] = csv_path
        
        json_path = self._export_json(tables, pipeline_log, output_dir)
        exported_files['json_report'] = json_path
        
        pipeline_record_path = self._export_pipeline_record(pipeline_log, output_dir)
        exported_files['pipeline_record'] = pipeline_record_path
        
        loading_errors_path = self._export_loading_errors(loading_errors, output_dir)
        if loading_errors_path:
            exported_files['loading_errors'] = loading_errors_path
            
        logger.info(f"所有文件已导出到 {output_dir}")
        return exported_files
        
    def _export_excel(self, tables: Dict, output_dir: str) -> str:
        excel_path = os.path.join(output_dir, f'rainfall_qc_report_{self.timestamp}.xlsx')
        
        with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
            for table_name, df in tables.items():
                if isinstance(df, pd.DataFrame) and not df.empty:
                    sheet_name = self._sanitize_sheet_name(table_name)
                    
                    if len(df) > 100000:
                        chunks = [df[i:i+100000] 
                                 for i in range(0, len(df), 100000)]
                        for i, chunk in enumerate(chunks):
                            chunk.to_excel(writer, sheet_name=f'{sheet_name}_{i+1}', 
                                         index=False)
                    else:
                        df.to_excel(writer, sheet_name=sheet_name, index=False)
                        
            self._add_summary_sheet(writer, tables)
            
        logger.info(f"Excel报告已导出: {excel_path}")
        return excel_path
        
    def _export_csv(self, tables: Dict, filled_df: pd.DataFrame, 
                   output_dir: str) -> Dict:
        csv_files = {}
        
        final_data = tables.get('final_data', pd.DataFrame())
        if not final_data.empty:
            csv_path = os.path.join(output_dir, 
                                   f'processed_rainfall_data_{self.timestamp}.csv')
            final_data.to_csv(csv_path, index=False, encoding='utf-8-sig')
            csv_files['final_data'] = csv_path
            logger.info(f"最终数据已导出: {csv_path}")
            
        failed_samples = tables.get('failed_samples', pd.DataFrame())
        if not failed_samples.empty:
            csv_path = os.path.join(output_dir, 
                                   f'failed_samples_{self.timestamp}.csv')
            failed_samples.to_csv(csv_path, index=False, encoding='utf-8-sig')
            csv_files['failed_samples'] = csv_path
            logger.info(f"失败样本已导出: {csv_path}")
            
        fill_results = tables.get('fill_results', pd.DataFrame())
        if not fill_results.empty:
            csv_path = os.path.join(output_dir, 
                                   f'fill_details_{self.timestamp}.csv')
            fill_results.to_csv(csv_path, index=False, encoding='utf-8-sig')
            csv_files['fill_details'] = csv_path
            logger.info(f"补全详情已导出: {csv_path}")
            
        return csv_files
        
    def _export_json(self, tables: Dict, pipeline_log: Dict, 
                    output_dir: str) -> str:
        import json
        
        json_data = {
            'timestamp': self.timestamp,
            'pipeline_info': {
                'start_time': pipeline_log.get('start_time'),
                'end_time': pipeline_log.get('end_time'),
                'duration_seconds': pipeline_log.get('duration_seconds'),
                'final_status': pipeline_log.get('final_status')
            },
            'config': pipeline_log.get('config', {}),
            'overview': {},
            'qc_results': [],
            'fill_results': [],
            'failed_samples': []
        }
        
        overview = tables.get('overview', pd.DataFrame())
        if not overview.empty:
            for _, row in overview.iterrows():
                json_data['overview'][str(row['统计项'])] = str(row['数值'])
                
        qc_results = tables.get('qc_results', pd.DataFrame())
        if not qc_results.empty:
            json_data['qc_results'] = qc_results.to_dict('records')
            
        fill_results = tables.get('fill_results', pd.DataFrame())
        if not fill_results.empty:
            json_data['fill_results'] = fill_results.to_dict('records')
            
        failed_samples = tables.get('failed_samples', pd.DataFrame())
        if not failed_samples.empty:
            json_data['failed_samples'] = failed_samples.to_dict('records')
            
        json_path = os.path.join(output_dir, f'report_{self.timestamp}.json')
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, ensure_ascii=False, indent=2, default=str)
            
        logger.info(f"JSON报告已导出: {json_path}")
        return json_path
        
    def _export_pipeline_record(self, pipeline_log: Dict, 
                                output_dir: str) -> str:
        import json
        
        json_path = os.path.join(output_dir, 
                                f'pipeline_execution_record_{self.timestamp}.json')
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(pipeline_log, f, ensure_ascii=False, indent=2, default=str)
            
        logger.info(f"流水线执行记录已导出: {json_path}")
        return json_path
        
    def _export_loading_errors(self, loading_errors: list, 
                              output_dir: str) -> str:
        if not loading_errors:
            return None
            
        import json
        
        json_path = os.path.join(output_dir, 
                                f'loading_errors_{self.timestamp}.json')
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(loading_errors, f, ensure_ascii=False, indent=2, default=str)
            
        logger.info(f"数据加载错误已导出: {json_path}")
        return json_path
        
    def _sanitize_sheet_name(self, name: str) -> str:
        invalid_chars = ['\\', '/', '?', '*', '[', ']', ':', '']
        for char in invalid_chars:
            name = name.replace(char, '_')
            
        if len(name) > 31:
            name = name[:31]
            
        if not name:
            name = 'Sheet'
            
        return name
        
    def _add_summary_sheet(self, writer: pd.ExcelWriter, tables: Dict):
        overview = tables.get('overview', pd.DataFrame())
        by_station = tables.get('by_station', pd.DataFrame())
        
        summary_data = []
        
        if not overview.empty:
            summary_data.append('=' * 50)
            summary_data.append('概览统计')
            summary_data.append('=' * 50)
            for _, row in overview.iterrows():
                summary_data.append(f"{row['统计项']}: {row['数值']}")
                
        if not by_station.empty:
            summary_data.append('')
            summary_data.append('=' * 50)
            summary_data.append('各站点统计')
            summary_data.append('=' * 50)
            
            summary_df = pd.DataFrame(summary_data, columns=['信息'])
            summary_df.to_excel(writer, sheet_name='摘要', index=False)
            
            by_station.to_excel(writer, sheet_name='站点统计', index=False)
