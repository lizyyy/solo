import json
import os
import hashlib
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
import pandas as pd
from simulator import SimulationConfig
from models import PatientPriority


@dataclass
class VersionInfo:
    version_id: str
    created_at: str
    config_hash: str
    notes: str
    receipt_info: str
    config: Dict[str, Any]
    result_summary: Optional[Dict[str, Any]] = None


class ConfigVersionManager:
    def __init__(self, storage_path: str = './versions'):
        self.storage_path = storage_path
        self._ensure_storage()

    def _ensure_storage(self):
        os.makedirs(self.storage_path, exist_ok=True)
        os.makedirs(f'{self.storage_path}/configs', exist_ok=True)
        os.makedirs(f'{self.storage_path}/reports', exist_ok=True)

    def _compute_config_hash(self, config: SimulationConfig) -> str:
        config_dict = self._config_to_dict(config)
        config_str = json.dumps(config_dict, sort_keys=True)
        return hashlib.md5(config_str.encode()).hexdigest()[:8]

    def _config_to_dict(self, config: SimulationConfig) -> Dict[str, Any]:
        priority_ratio = {
            k.name: v for k, v in config.priority_ratio.items()
        }
        return {
            'num_patients': config.num_patients,
            'num_windows': config.num_windows,
            'arrival_rate': config.arrival_rate,
            'avg_service_time': config.avg_service_time,
            'std_service_time': config.std_service_time,
            'sim_duration': config.sim_duration,
            'random_seed': config.random_seed,
            'strategy_name': config.strategy_name,
            'strategy_params': config.strategy_params,
            'window_breaks': config.window_breaks,
            'priority_ratio': priority_ratio,
            'notes': config.notes,
            'receipt_info': config.receipt_info,
        }

    def _dict_to_config(self, data: Dict[str, Any]) -> SimulationConfig:
        priority_ratio = {
            PatientPriority[k]: v for k, v in data.get('priority_ratio', {}).items()
        }
        return SimulationConfig(
            num_patients=data.get('num_patients', 100),
            num_windows=data.get('num_windows', 3),
            arrival_rate=data.get('arrival_rate', 2.0),
            avg_service_time=data.get('avg_service_time', 10.0),
            std_service_time=data.get('std_service_time', 3.0),
            sim_duration=data.get('sim_duration', 480.0),
            random_seed=data.get('random_seed'),
            strategy_name=data.get('strategy_name', 'FCFS'),
            strategy_params=data.get('strategy_params', {}),
            window_breaks=data.get('window_breaks', []),
            priority_ratio=priority_ratio,
            notes=data.get('notes', ''),
            receipt_info=data.get('receipt_info', ''),
        )

    def save_config(self, config: SimulationConfig, notes: str = '', receipt_info: str = '') -> VersionInfo:
        config.notes = notes or config.notes
        config.receipt_info = receipt_info or config.receipt_info
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        config_hash = self._compute_config_hash(config)
        version_id = f"{timestamp}_{config_hash}"
        
        version_info = VersionInfo(
            version_id=version_id,
            created_at=datetime.now().isoformat(),
            config_hash=config_hash,
            notes=config.notes,
            receipt_info=config.receipt_info,
            config=self._config_to_dict(config),
        )
        
        config_path = f'{self.storage_path}/configs/{version_id}.json'
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(asdict(version_info), f, ensure_ascii=False, indent=2)
        
        return version_info

    def load_config(self, version_id: str) -> Optional[SimulationConfig]:
        config_path = f'{self.storage_path}/configs/{version_id}.json'
        if not os.path.exists(config_path):
            return None
        
        with open(config_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return self._dict_to_config(data['config'])

    def list_versions(self) -> List[VersionInfo]:
        versions = []
        configs_dir = f'{self.storage_path}/configs'
        
        if not os.path.exists(configs_dir):
            return versions
        
        for filename in sorted(os.listdir(configs_dir), reverse=True):
            if filename.endswith('.json'):
                with open(f'{configs_dir}/{filename}', 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    versions.append(VersionInfo(**data))
        
        return versions

    def find_by_hash(self, config_hash: str) -> Optional[VersionInfo]:
        for version in self.list_versions():
            if version.config_hash == config_hash:
                return version
        return None

    def update_notes(self, version_id: str, notes: str) -> bool:
        config_path = f'{self.storage_path}/configs/{version_id}.json'
        if not os.path.exists(config_path):
            return False
        
        with open(config_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        data['notes'] = notes
        
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        return True

    def update_receipt(self, version_id: str, receipt_info: str) -> bool:
        config_path = f'{self.storage_path}/configs/{version_id}.json'
        if not os.path.exists(config_path):
            return False
        
        with open(config_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        data['receipt_info'] = receipt_info
        
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        return True


class ReportGenerator:
    def __init__(self, output_path: str = './versions/reports'):
        self.output_path = output_path
        os.makedirs(output_path, exist_ok=True)

    def generate_comparison_report(
        self,
        comparison_result,
        filename: str = 'comparison_report.xlsx'
    ) -> str:
        filepath = f'{self.output_path}/{filename}'
        
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            df = comparison_result.comparison_df
            df.to_excel(writer, sheet_name='对比汇总', index=False)
            
            summary_data = []
            for metrics in comparison_result.all_metrics:
                summary_data.append({
                    '策略': metrics.strategy_name,
                    '模拟次数': metrics.num_runs,
                    '种子一致性': '是' if metrics.seed_consistent else '否',
                    '极端等待轮次': metrics.has_extreme_wait_runs,
                    '休息配置问题': metrics.has_break_miss_runs,
                })
            
            pd.DataFrame(summary_data).to_excel(writer, sheet_name='运行状态', index=False)
            
            issues_data = []
            for metrics in comparison_result.all_metrics:
                for issue in metrics.issues:
                    issues_data.append({
                        '策略': metrics.strategy_name,
                        '级别': issue.level.value,
                        '类别': issue.category,
                        '问题描述': issue.message,
                        '影响': issue.impact,
                    })
            
            if issues_data:
                pd.DataFrame(issues_data).to_excel(writer, sheet_name='问题清单', index=False)
            
            pd.DataFrame([{
                '生成时间': datetime.now().isoformat(),
                '策略数量': len(comparison_result.all_metrics),
                '总模拟次数': sum(m.num_runs for m in comparison_result.all_metrics),
            }]).to_excel(writer, sheet_name='报告信息', index=False)
        
        return filepath
