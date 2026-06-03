"""
多臂老虎机活动分流 - 核心计算模块
"""
import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import numpy as np
import pandas as pd
from config import HISTORY_DIR, DEFAULT_ALPHA, DEFAULT_BETA, EPSILON


class BanditCalculator:
    def __init__(self, epsilon: float = EPSILON):
        self.epsilon = epsilon
        self.arms = {}
        self.history = []
        self.correction_log = []
        
    def init_arm(self, arm_id: str, alpha: float = DEFAULT_ALPHA, beta: float = DEFAULT_BETA):
        self.arms[arm_id] = {'alpha': alpha, 'beta': beta, 'impressions': 0, 'clicks': 0}
        
    def parse_rate(self, rate_str: str) -> Tuple[float, str]:
        rate_str = str(rate_str).strip()
        if '%' in rate_str:
            clean = rate_str.replace('%', '').strip()
            return float(clean) / 100, 'percent'
        else:
            return float(rate_str), 'decimal'
    
    def detect_mixed_format(self, data: List[Dict]) -> List[Dict]:
        issues = []
        for idx, record in enumerate(data):
            if 'click_rate' in record:
                _, fmt = self.parse_rate(record['click_rate'])
                if fmt == 'percent' and idx > 0:
                    issues.append({
                        'record_idx': idx,
                        'record_id': record.get('id', f'record_{idx}'),
                        'issue': '百分数和小数混着出现',
                        'value': record['click_rate'],
                        'status': '待活动负责人复核'
                    })
        return issues
    
    def calculate_arm_score(self, arm_id: str, method: str = 'thompson') -> float:
        arm = self.arms.get(arm_id, {})
        alpha = arm.get('alpha', DEFAULT_ALPHA)
        beta = arm.get('beta', DEFAULT_BETA)
        clicks = arm.get('clicks', 0)
        impressions = arm.get('impressions', 0)
        
        if method == 'thompson':
            return np.random.beta(alpha + clicks, beta + (impressions - clicks))
        elif method == 'ucb':
            if impressions == 0:
                return float('inf')
            ctr = clicks / impressions
            return ctr + np.sqrt(2 * np.log(sum(a['impressions'] for a in self.arms.values())) / impressions)
        elif method == 'epsilon_greedy':
            if np.random.random() < self.epsilon:
                return np.random.random()
            return clicks / impressions if impressions > 0 else 0.5
        return 0.0
    
    def process_record(self, record: Dict, use_old_formula: bool = False) -> Dict:
        arm_id = record.get('arm_id')
        impressions = int(record.get('impressions', 0))
        clicks = int(record.get('clicks', 0))
        
        if arm_id not in self.arms:
            self.init_arm(arm_id)
        
        self.arms[arm_id]['impressions'] += impressions
        self.arms[arm_id]['clicks'] += clicks
        
        click_rate_input = record.get('click_rate', '')
        if click_rate_input:
            parsed_rate, rate_format = self.parse_rate(click_rate_input)
        else:
            parsed_rate = clicks / impressions if impressions > 0 else 0
            rate_format = 'calculated'
        
        if use_old_formula:
            score = self._old_formula_score(clicks, impressions)
            formula_used = '旧公式'
        else:
            score = self.calculate_arm_score(arm_id)
            formula_used = '汤普森采样'
        
        result = {
            'record_id': record.get('id'),
            'arm_id': arm_id,
            'impressions': self.arms[arm_id]['impressions'],
            'clicks': self.arms[arm_id]['clicks'],
            'click_rate_input': click_rate_input,
            'click_rate_parsed': parsed_rate,
            'rate_format': rate_format,
            'score': score,
            'formula_used': formula_used,
            'use_old_formula': use_old_formula,
            'timestamp': datetime.now().isoformat(),
            'note': record.get('note', '')
        }
        
        self.history.append(result)
        return result
    
    def _old_formula_score(self, clicks: int, impressions: int) -> float:
        if impressions == 0:
            return 0.0
        ctr = clicks / impressions
        return ctr * 0.8 + 0.1
    
    def apply_manual_correction(self, record_id: str, correction: Dict, operator: str = '唐老师') -> Dict:
        for idx, record in enumerate(self.history):
            if record.get('record_id') == record_id:
                old_record = record.copy()
                self.history[idx].update(correction)
                self.history[idx]['corrected'] = True
                self.history[idx]['corrected_by'] = operator
                self.history[idx]['corrected_at'] = datetime.now().isoformat()
                self.history[idx]['old_values'] = old_record
                
                correction_entry = {
                    'record_id': record_id,
                    'operator': operator,
                    'old_values': old_record,
                    'new_values': correction,
                    'timestamp': datetime.now().isoformat()
                }
                self.correction_log.append(correction_entry)
                return correction_entry
        raise ValueError(f"Record {record_id} not found")
    
    def get_calculation_details(self) -> pd.DataFrame:
        return pd.DataFrame(self.history)
    
    def save_history(self, run_id: str):
        os.makedirs(HISTORY_DIR, exist_ok=True)
        filepath = os.path.join(HISTORY_DIR, f'run_{run_id}.json')
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump({
                'history': self.history,
                'correction_log': self.correction_log,
                'arms_summary': self.arms,
                'run_id': run_id,
                'saved_at': datetime.now().isoformat()
            }, f, ensure_ascii=False, indent=2)
        return filepath
    
    def load_history(self, run_id: str):
        filepath = os.path.join(HISTORY_DIR, f'run_{run_id}.json')
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            self.history = data['history']
            self.correction_log = data.get('correction_log', [])
            self.arms = data.get('arms_summary', {})
        return data
