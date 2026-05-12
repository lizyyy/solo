#!/usr/bin/env python3
import json
from datetime import datetime, timedelta

SAMPLE_USERS = {
    'normal_user': {
        'user_id': 'user_001',
        'name': '张三（普通用户）',
        'events': []
    },
    'bot_user': {
        'user_id': 'user_002',
        'name': '李四（羊毛党）',
        'events': [
            {
                'event_id': 'evt_bot_001',
                'risk_type': 'bot_detection',
                'severity': 'medium',
                'description': '检测到自动化脚本行为，短时间内连续注册多账号',
                'evidence': {
                    'ip_count': 5,
                    'device_fingerprint_similarity': 0.95,
                    'signup_interval_sec': 2,
                    'total_signups': 20
                },
                'source': 'bot_detection_engine',
                'graylist_config': {
                    'single_transaction_limit': 1000,
                    'daily_transaction_limit': 5000
                }
            },
            {
                'event_id': 'evt_bot_002',
                'risk_type': 'ip_anomaly',
                'severity': 'medium',
                'description': '同一IP地址下大量异常操作',
                'evidence': {
                    'ip': '192.168.1.100',
                    'operations_last_hour': 500,
                    'proxy_detected': True
                },
                'source': 'ip_analytics'
            }
        ]
    },
    'fraud_user': {
        'user_id': 'user_003',
        'name': '王五（疑似盗刷）',
        'events': [
            {
                'event_id': 'evt_fraud_001',
                'risk_type': 'fraud_suspected',
                'severity': 'high',
                'description': '疑似信用卡盗刷，异地大额交易',
                'evidence': {
                    'transaction_amount': 50000,
                    'location': '北京',
                    'user_history_location': '上海',
                    'velocity_detection': True,
                    'card_bin_risk': 'high'
                },
                'source': 'fraud_detection',
                'graylist_config': {
                    'single_transaction_limit': 100,
                    'daily_transaction_limit': 500
                }
            },
            {
                'event_id': 'evt_fraud_002',
                'risk_type': 'device_anomaly',
                'severity': 'medium',
                'description': '陌生设备首次登录',
                'evidence': {
                    'device_id': 'dev_unknown_999',
                    'user_registered_devices': 3,
                    'first_seen': True
                },
                'source': 'device_analytics'
            }
        ]
    },
    'false_positive_user': {
        'user_id': 'user_004',
        'name': '赵六（误报恢复）',
        'events': [
            {
                'event_id': 'evt_fp_001',
                'risk_type': 'ip_anomaly',
                'severity': 'medium',
                'description': 'VPN IP检测到异常登录',
                'evidence': {
                    'ip': '103.123.45.67',
                    'vpn_detected': True,
                    'user_location_history': ['深圳', '广州']
                },
                'source': 'ip_analytics'
            }
        ],
        'review': {
            'decision': 'approve',
            'reviewer_id': 'reviewer_001',
            'remark': '核实为用户出差使用公司VPN，属于误报，解除限制',
            'evidence': {
                'corporate_vpn_verified': True,
                'employee_id_match': 'emp_12345',
                'travel_expense_record': 'TRV-2026-0510'
            }
        }
    }
}

if __name__ == '__main__':
    print(json.dumps(SAMPLE_USERS, ensure_ascii=False, indent=2))
