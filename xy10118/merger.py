import re
import difflib
from collections import defaultdict
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass

@dataclass
class MergeResult:
    group_name: str
    alerts: List[Any]
    representative: Any
    explanation: str
    similarity_score: float

class AlertMerger:
    DEFAULT_CONFIG = {
        'text_similarity_threshold': 0.75,
        'alert_type_weight': 0.3,
        'message_weight': 0.5,
        'device_match_weight': 0.2,
        'enable_time_window': False,
        'time_window_minutes': 30,
        'max_group_size': 100,
        'keywords': []
    }

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = {**self.DEFAULT_CONFIG, **(config or {})}

    def normalize_text(self, text: str) -> str:
        text = text.lower()
        text = re.sub(r'\d+', '[数字]', text)
        text = re.sub(r'[^a-z0-9\u4e00-\u9fa5\s\[\\\]]', ' ', text)
        text = re.sub(r'\s+', ' ', text)
        return text.strip()

    def calculate_similarity(self, text1: str, text2: str) -> float:
        norm1 = self.normalize_text(text1)
        norm2 = self.normalize_text(text2)
        ratio = difflib.SequenceMatcher(None, norm1, norm2).ratio()
        return ratio

    def extract_keywords(self, message: str) -> List[str]:
        keywords = self.config.get('keywords', [])
        found = []
        for kw in keywords:
            if kw.lower() in message.lower():
                found.append(kw)
        return found

    def calculate_alert_similarity(self, alert1: Any, alert2: Any) -> Tuple[float, Dict[str, float]]:
        scores = {}
        
        device_match = 1.0 if alert1.device_id == alert2.device_id else 0.0
        scores['device'] = device_match
        
        type_match = 1.0 if alert1.alert_type == alert2.alert_type else 0.0
        scores['type'] = type_match
        
        message_sim = self.calculate_similarity(alert1.message, alert2.message)
        scores['message'] = message_sim
        
        total_score = (
            scores['device'] * self.config['device_match_weight'] +
            scores['type'] * self.config['alert_type_weight'] +
            scores['message'] * self.config['message_weight']
        )
        
        return total_score, scores

    def generate_group_name(self, alert: Any, alerts_in_group: List[Any]) -> str:
        if len(alerts_in_group) == 1:
            return f"{alert.device_id} - {alert.alert_type} ({alert.message[:30]}...)"
        
        first_msg = alerts_in_group[0].message
        keywords = self.extract_keywords(first_msg)
        if keywords:
            base_name = f"{alert.device_id} - {keywords[0]} 相关告警"
        else:
            base_name = f"{alert.device_id} - {alert.alert_type} 批量告警"
        
        return base_name

    def generate_explanation(self, alert: Any, group_alerts: List[Any], scores: Dict[str, float]) -> str:
        explanations = []
        
        if scores.get('device') == 1.0:
            explanations.append(f"设备相同: {alert.device_id}")
        else:
            explanations.append("设备不同")
            
        if scores.get('type') == 1.0:
            explanations.append(f"告警类型相同: {alert.alert_type}")
        else:
            explanations.append("告警类型不同")
            
        msg_score = scores.get('message', 0)
        if msg_score >= 0.8:
            explanations.append(f"消息文本高度相似: {msg_score:.1%}")
        elif msg_score >= 0.6:
            explanations.append(f"消息文本中等相似: {msg_score:.1%}")
        else:
            explanations.append(f"消息文本相似性: {msg_score:.1%}")
            
        explanations.append(f"共归并 {len(group_alerts)} 条告警")
        
        return " | ".join(explanations)

    def merge_alerts(self, alerts: List[Any]) -> List[MergeResult]:
        if not alerts:
            return []

        alerts = sorted(alerts, key=lambda a: (a.device_id, a.timestamp))
        
        device_alerts = defaultdict(list)
        for alert in alerts:
            device_alerts[alert.device_id].append(alert)
        
        results = []
        
        for device_id, device_alert_list in device_alerts.items():
            groups = []
            
            for alert in device_alert_list:
                best_group = None
                best_score = 0
                best_scores = {}
                
                for group in groups:
                    if not group:
                        continue
                    
                    if len(group) >= self.config['max_group_size']:
                        continue
                    
                    rep = group[0]
                    score, comp_scores = self.calculate_alert_similarity(alert, rep)
                    
                    if score > self.config['text_similarity_threshold'] and score > best_score:
                        best_score = score
                        best_group = group
                        best_scores = comp_scores
                
                if best_group is not None:
                    best_group.append(alert)
                else:
                    groups.append([alert])
            
            for group in groups:
                if not group:
                    continue
                
                representative = group[0]
                group_name = self.generate_group_name(representative, group)
                explanation = self.generate_explanation(
                    representative, 
                    group,
                    {'device': 1.0, 'type': 1.0, 'message': 0.9}
                )
                
                result = MergeResult(
                    group_name=group_name,
                    alerts=group,
                    representative=representative,
                    explanation=explanation,
                    similarity_score=best_score if best_score else 1.0
                )
                results.append(result)
        
        return results

    def update_config(self, new_config: Dict[str, Any]) -> Dict[str, Any]:
        self.config.update(new_config)
        return self.config
