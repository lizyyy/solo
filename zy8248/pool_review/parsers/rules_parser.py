"""规则配置解析器"""
from pathlib import Path
from typing import Dict, Any, Optional
import yaml
import logging

from .base import BaseParser
from ..models import ReviewRules

logger = logging.getLogger(__name__)


class RulesParser(BaseParser):
    """规则配置YAML解析器"""
    
    def __init__(self, file_path: Path):
        super().__init__(file_path)
        self.rules: Optional[ReviewRules] = None
    
    def parse(self) -> ReviewRules:
        """解析rules.yaml文件"""
        logger.info(f"解析规则配置文件: {self.file_path}")
        
        if not self.file_path.exists():
            self.add_warning(f"规则文件不存在，使用默认规则: {self.file_path}")
            return self._get_default_rules()
        
        try:
            with open(self.file_path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
            
            self.rules = self._parse_rules(data)
        
        except Exception as e:
            self.add_error(f"规则文件解析失败: {str(e)}，使用默认规则")
            return self._get_default_rules()
        
        return self.rules
    
    def _parse_rules(self, data: Dict[str, Any]) -> ReviewRules:
        """解析规则数据"""
        if not data:
            return self._get_default_rules()
        
        decay_rules = data.get('chlorine_decay', {})
        window_rules = data.get('out_of_window', {})
        post_visitors = data.get('post_visitor_check', {})
        cooling_rules = data.get('dosing_cooling', {})
        sensor_rules = data.get('sensor_monitoring', {})
        severity_config = data.get('severity', {})
        
        return ReviewRules(
            max_decay_rate_per_hour=decay_rules.get('max_decay_rate_per_hour', 0.3),
            critical_decay_threshold=decay_rules.get('critical_decay_threshold', 0.5),
            decay_window_minutes=decay_rules.get('decay_window_minutes', 60),
            
            ph_window=(
                window_rules.get('ph_min', 7.2),
                window_rules.get('ph_max', 7.6)
            ),
            orp_window=(
                window_rules.get('orp_min', 650),
                window_rules.get('orp_max', 850)
            ),
            out_of_window_duration_minutes=window_rules.get('out_of_window_duration_minutes', 15),
            critical_outage_duration_minutes=window_rules.get('critical_outage_duration_minutes', 30),
            
            post_visitor_check_delay_minutes=post_visitors.get('check_delay_minutes', 30),
            post_visitor_check_window_minutes=post_visitors.get('check_window_minutes', 60),
            required_readings_after_visitors=post_visitors.get('required_readings', 3),
            
            cooling_minutes_after_dosing=cooling_rules.get('cooling_minutes', 30),
            forbidden_chemicals_during_cooling=cooling_rules.get('forbidden_chemicals', ['chlorine', 'ph_minus']),
            
            max_gap_minutes=sensor_rules.get('max_gap_minutes', 5),
            critical_gap_minutes=sensor_rules.get('critical_gap_minutes', 30),
            
            severity_thresholds=severity_config
        )
    
    def _get_default_rules(self) -> ReviewRules:
        """获取默认规则"""
        return ReviewRules(
            max_decay_rate_per_hour=0.3,
            critical_decay_threshold=0.5,
            decay_window_minutes=60,
            
            ph_window=(7.2, 7.6),
            orp_window=(650, 850),
            out_of_window_duration_minutes=15,
            critical_outage_duration_minutes=30,
            
            post_visitor_check_delay_minutes=30,
            post_visitor_check_window_minutes=60,
            required_readings_after_visitors=3,
            
            cooling_minutes_after_dosing=30,
            forbidden_chemicals_during_cooling=['chlorine', 'ph_minus'],
            
            max_gap_minutes=5,
            critical_gap_minutes=30,
            
            severity_thresholds={}
        )
    
    def validate(self) -> bool:
        """验证规则配置"""
        if not self.rules:
            self.add_error("规则配置未解析")
            return False
        
        if self.rules.max_decay_rate_per_hour <= 0:
            self.add_warning("余氯衰减率阈值无效")
        
        if self.rules.ph_window[0] >= self.rules.ph_window[1]:
            self.add_warning("pH窗口无效")
        
        if self.rules.orp_window[0] >= self.rules.orp_window[1]:
            self.add_warning("ORP窗口无效")
        
        return not self.has_errors()
    
    def get_rules(self) -> Optional[ReviewRules]:
        """获取解析后的规则"""
        return self.rules
