import logging
import os
import json
import sys
from datetime import datetime
from typing import Dict, Any
from config import LOG_DIR, CONFIG


class ReproduciblePipeline:
    def __init__(self, config: Dict = None):
        self.config = config or CONFIG
        self.timestamp = self.config['timestamp']
        self.pipeline_log: Dict[str, Any] = {}
        self._setup_logger()
        
    def _setup_logger(self):
        os.makedirs(LOG_DIR, exist_ok=True)
        
        log_file = os.path.join(LOG_DIR, f'pipeline_{self.timestamp}.log')
        
        self.logger = logging.getLogger('rainfall_qc_pipeline')
        self.logger.setLevel(logging.DEBUG)
        
        if self.logger.handlers:
            self.logger.handlers.clear()
            
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setLevel(logging.DEBUG)
        
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.INFO)
        
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        
        file_handler.setFormatter(formatter)
        console_handler.setFormatter(formatter)
        
        self.logger.addHandler(file_handler)
        self.logger.addHandler(console_handler)
        
        self.logger.info(f"日志文件已创建: {log_file}")
        
    def record_start(self, pipeline_name: str):
        self.pipeline_log = {
            'pipeline_name': pipeline_name,
            'start_time': datetime.now().isoformat(),
            'config': self._serialize_config(self.config),
            'steps': [],
            'errors': []
        }
        self.logger.info(f"开始执行 {pipeline_name}")
        
    def record_step(self, step_name: str, status: str = 'success', 
                    details: Dict = None, error: Exception = None):
        step_record = {
            'step_name': step_name,
            'timestamp': datetime.now().isoformat(),
            'status': status,
            'details': details or {}
        }
        
        if error:
            step_record['error'] = {
                'type': type(error).__name__,
                'message': str(error)
            }
            self.pipeline_log['errors'].append(step_record)
            self.logger.error(f"步骤 {step_name} 失败: {error}")
        else:
            self.logger.info(f"步骤 {step_name} 完成")
            
        self.pipeline_log['steps'].append(step_record)
        
    def record_data_stats(self, stage: str, stats: Dict):
        self.pipeline_log['steps'].append({
            'step_name': f'data_stats_{stage}',
            'timestamp': datetime.now().isoformat(),
            'status': 'info',
            'details': stats
        })
        self.logger.info(f"{stage} 数据统计: {stats}")
        
    def record_end(self, status: str = 'success', details: Dict = None):
        self.pipeline_log['end_time'] = datetime.now().isoformat()
        self.pipeline_log['final_status'] = status
        self.pipeline_log['final_details'] = details or {}
        
        duration = (
            datetime.fromisoformat(self.pipeline_log['end_time']) - 
            datetime.fromisoformat(self.pipeline_log['start_time'])
        )
        self.pipeline_log['duration_seconds'] = duration.total_seconds()
        
        if status == 'success':
            self.logger.info(f"流水线执行成功，耗时 {duration.total_seconds():.2f} 秒")
        else:
            self.logger.error(f"流水线执行失败，耗时 {duration.total_seconds():.2f} 秒")
            
    def save_pipeline_log(self, output_dir: str = None):
        if output_dir is None:
            output_dir = LOG_DIR
            
        os.makedirs(output_dir, exist_ok=True)
        
        log_file = os.path.join(output_dir, f'pipeline_record_{self.timestamp}.json')
        
        with open(log_file, 'w', encoding='utf-8') as f:
            json.dump(self.pipeline_log, f, ensure_ascii=False, indent=2, 
                     default=str)
            
        self.logger.info(f"流水线记录已保存: {log_file}")
        return log_file
        
    def _serialize_config(self, config: Dict) -> Dict:
        serializable = {}
        for key, value in config.items():
            try:
                json.dumps({key: value})
                serializable[key] = value
            except:
                serializable[key] = str(value)
        return serializable
        
    def get_logger(self) -> logging.Logger:
        return self.logger
        
    def get_pipeline_log(self) -> Dict[str, Any]:
        return self.pipeline_log.copy()
