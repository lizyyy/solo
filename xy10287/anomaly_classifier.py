import json
from typing import Dict, Any

class AnomalyClassifier:
    def __init__(self):
        self.rules = self._define_rules()
    
    def _define_rules(self) -> list:
        return [
            {
                'id': 'R001',
                'name': '高RMS值规则',
                'condition': lambda f: f.get('rms_level', 0) > 0.12,
                'anomaly_type': '潜在机械故障',
                'anomaly_level': 'warning',
                'confidence_base': 0.6,
                'explanation': 'RMS能量值超过正常阈值(0.12)，表明存在机械振动异常'
            },
            {
                'id': 'R002',
                'name': '高频峰值规则',
                'condition': lambda f: f.get('peak_frequency', 0) > 3000,
                'anomaly_type': '高频异响',
                'anomaly_level': 'warning',
                'confidence_base': 0.55,
                'explanation': '峰值频率超过3kHz，可能由气蚀或轴承故障引起'
            },
            {
                'id': 'R003',
                'name': '低谐波比规则',
                'condition': lambda f: f.get('harmonic_ratio', 1) < 0.5,
                'anomaly_type': '非稳态噪音',
                'anomaly_level': 'alert',
                'confidence_base': 0.7,
                'explanation': '谐波比过低(<0.5)，信号非线性成分显著增加'
            },
            {
                'id': 'R004',
                'name': '中频共振规则',
                'condition': lambda f: 500 <= f.get('peak_frequency', 0) <= 2000 and f.get('rms_level', 0) > 0.08,
                'anomaly_type': '结构共振',
                'anomaly_level': 'warning',
                'confidence_base': 0.65,
                'explanation': '中频范围(500-2000Hz)出现能量集中，可能存在管道或基座共振'
            },
            {
                'id': 'R005',
                'name': '关键词匹配-轴承',
                'condition': self._keyword_condition(['轴承', '磨损', '疲劳', '剥落']),
                'anomaly_type': '轴承故障',
                'anomaly_level': 'alert',
                'confidence_base': 0.85,
                'explanation': '巡检记录包含轴承相关异常描述关键词'
            },
            {
                'id': 'R006',
                'name': '关键词匹配-气蚀',
                'condition': self._keyword_condition(['气蚀', '气泡', '空化', '嘶嘶']),
                'anomaly_type': '气蚀现象',
                'anomaly_level': 'warning',
                'confidence_base': 0.8,
                'explanation': '巡检记录包含气蚀相关描述关键词'
            },
            {
                'id': 'R007',
                'name': '关键词匹配-叶轮',
                'condition': self._keyword_condition(['叶轮', '失衡', '震动', '抖动']),
                'anomaly_type': '叶轮失衡',
                'anomaly_level': 'warning',
                'confidence_base': 0.75,
                'explanation': '巡检记录包含叶轮失衡相关描述关键词'
            },
            {
                'id': 'R008',
                'name': '关键词匹配-正常',
                'condition': self._keyword_condition(['正常', '平稳', '无异响', '良好']),
                'anomaly_type': '正常运行',
                'anomaly_level': 'normal',
                'confidence_base': 0.9,
                'explanation': '巡检记录明确标注设备运行正常'
            },
            {
                'id': 'R009',
                'name': '严重异常组合',
                'condition': lambda f: f.get('rms_level', 0) > 0.2 and f.get('harmonic_ratio', 1) < 0.4,
                'anomaly_type': '严重机械故障',
                'anomaly_level': 'critical',
                'confidence_base': 0.9,
                'explanation': '高能量(RMS>0.2)配合极低谐波比(<0.4)，存在严重机械故障风险'
            }
        ]
    
    def _keyword_condition(self, keywords):
        def condition(features):
            noise_types = json.loads(features.get('noise_type_keywords', '[]'))
            return any(kw in ' '.join(noise_types) for kw in keywords)
        return condition
    
    def classify(self, acoustic_features: Dict[str, Any], record_id: str, batch_id: str) -> Dict[str, Any]:
        matched_rules = []
        max_confidence = 0
        primary_anomaly = '正常运行'
        primary_level = 'normal'
        primary_explanation = '未触发异常规则，设备运行状态正常'
        
        for rule in self.rules:
            if rule['condition'](acoustic_features):
                matched_rules.append({
                    'rule_id': rule['id'],
                    'rule_name': rule['name'],
                    'anomaly_type': rule['anomaly_type'],
                    'anomaly_level': rule['anomaly_level'],
                    'confidence': rule['confidence_base'],
                    'explanation': rule['explanation']
                })
                
                if rule['confidence_base'] > max_confidence:
                    max_confidence = rule['confidence_base']
                    primary_anomaly = rule['anomaly_type']
                    primary_level = rule['anomaly_level']
                    primary_explanation = rule['explanation']
        
        if matched_rules:
            explanations = [f"规则[{r['rule_id']}]: {r['explanation']}" for r in matched_rules]
            final_explanation = '；'.join(explanations)
        else:
            final_explanation = primary_explanation
        
        final_confidence = self._calculate_final_confidence(matched_rules, max_confidence)
        final_level = self._determine_final_level(matched_rules, primary_level)
        
        return {
            'record_id': record_id,
            'anomaly_type': primary_anomaly,
            'anomaly_level': final_level,
            'confidence_score': round(final_confidence, 2),
            'rule_matched': json.dumps(matched_rules, ensure_ascii=False),
            'explanation': final_explanation,
            'status': 'pending',
            'batch_id': batch_id
        }
    
    def _calculate_final_confidence(self, matched_rules: list, base_confidence: float) -> float:
        if not matched_rules:
            return 0.95
        
        critical_rules = [r for r in matched_rules if r['anomaly_level'] == 'critical']
        alert_rules = [r for r in matched_rules if r['anomaly_level'] == 'alert']
        
        if critical_rules:
            return min(0.98, base_confidence + 0.08)
        elif alert_rules:
            return min(0.95, base_confidence + 0.05)
        elif len(matched_rules) >= 2:
            return min(0.92, base_confidence + 0.03)
        
        return base_confidence
    
    def _determine_final_level(self, matched_rules: list, primary_level: str) -> str:
        if not matched_rules:
            return 'normal'
        
        levels = [r['anomaly_level'] for r in matched_rules]
        if 'critical' in levels:
            return 'critical'
        elif 'alert' in levels:
            return 'alert'
        elif 'warning' in levels:
            return 'warning'
        return 'normal'
