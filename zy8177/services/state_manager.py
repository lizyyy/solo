#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
状态管理模块
用于保存和加载应用程序状态
"""

import json
import pickle
from datetime import datetime
from typing import Dict, Any, Optional

from models.data_models import PatientData, VisualFieldTest, ReliabilityRules


class StateManager:
    """
    状态管理器
    负责保存和加载应用程序的完整状态
    """
    
    def __init__(self):
        # 状态版本
        self.version = "1.0"
        
    def save_state(self, file_path: str, 
                   patient_data: Optional[PatientData],
                   reliability_rules: Optional[ReliabilityRules],
                   confirmation_states: Dict[int, Dict[str, Any]]):
        """
        保存状态到文件
        
        Args:
            file_path: 保存文件路径
            patient_data: 患者数据
            reliability_rules: 可靠性规则
            confirmation_states: 确认状态
        """
        state = {
            'version': self.version,
            'save_time': datetime.now().isoformat(),
            'patient_data': None,
            'reliability_rules': None,
            'confirmation_states': confirmation_states
        }
        
        # 序列化患者数据
        if patient_data:
            state['patient_data'] = patient_data.to_dict()
        
        # 序列化可靠性规则
        if reliability_rules:
            state['reliability_rules'] = reliability_rules.to_dict()
        
        # 写入文件
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(state, f, ensure_ascii=False, indent=2)
            
    def load_state(self, file_path: str) -> Dict[str, Any]:
        """
        从文件加载状态
        
        Args:
            file_path: 状态文件路径
            
        Returns:
            包含加载数据的字典
        """
        with open(file_path, 'r', encoding='utf-8') as f:
            state = json.load(f)
        
        result = {
            'patient_data': None,
            'reliability_rules': None,
            'confirmation_states': state.get('confirmation_states', {})
        }
        
        # 反序列化患者数据
        patient_data_dict = state.get('patient_data')
        if patient_data_dict:
            result['patient_data'] = PatientData.from_dict(patient_data_dict)
        
        # 反序列化可靠性规则
        reliability_rules_dict = state.get('reliability_rules')
        if reliability_rules_dict:
            result['reliability_rules'] = ReliabilityRules.from_dict(reliability_rules_dict)
        
        return result
        
    def save_state_binary(self, file_path: str,
                          patient_data: Optional[PatientData],
                          reliability_rules: Optional[ReliabilityRules],
                          confirmation_states: Dict[int, Dict[str, Any]]):
        """
        使用 pickle 保存二进制状态（更完整的序列化）
        
        Args:
            file_path: 保存文件路径
            patient_data: 患者数据
            reliability_rules: 可靠性规则
            confirmation_states: 确认状态
        """
        state = {
            'version': self.version,
            'save_time': datetime.now(),
            'patient_data': patient_data,
            'reliability_rules': reliability_rules,
            'confirmation_states': confirmation_states
        }
        
        with open(file_path, 'wb') as f:
            pickle.dump(state, f)
            
    def load_state_binary(self, file_path: str) -> Dict[str, Any]:
        """
        从二进制文件加载状态
        
        Args:
            file_path: 状态文件路径
            
        Returns:
            包含加载数据的字典
        """
        with open(file_path, 'rb') as f:
            state = pickle.load(f)
        
        return {
            'patient_data': state.get('patient_data'),
            'reliability_rules': state.get('reliability_rules'),
            'confirmation_states': state.get('confirmation_states', {})
        }
