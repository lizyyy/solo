from typing import Dict, List, Any
import json
import os
from .models import generate_id


SAMPLE_BILLS = [
    {
        "bill_id": "bill_001",
        "resource_id": "ec2-prod-web-01",
        "resource_type": "ec2",
        "cost": 1280.50,
        "currency": "CNY",
        "billing_period": "2024-03",
        "billing_date": "2024-03-31",
        "provider": "aliyun",
        "project": "ecommerce",
        "env": "prod",
        "owner": "zhangwei"
    },
    {
        "bill_id": "bill_002",
        "resource_id": "ecs-dev-api-01",
        "resource_type": "ecs",
        "cost": 320.00,
        "currency": "CNY",
        "billing_period": "2024-03",
        "billing_date": "2024-03-31",
        "provider": "aliyun",
        "project": "ecommerce",
        "env": "dev",
        "owner": "lisi"
    },
    {
        "bill_id": "bill_003",
        "resource_id": "rds-prod-master",
        "resource_type": "rds",
        "cost": 2500.00,
        "currency": "CNY",
        "billing_period": "2024-03",
        "billing_date": "2024-03-31",
        "provider": "aliyun",
        "project": "payment",
        "env": "prod",
        "owner": "wanghong"
    },
    {
        "bill_id": "bill_004",
        "resource_id": "oss-log-bucket",
        "resource_type": "oss",
        "cost": 450.00,
        "currency": "CNY",
        "billing_period": "2024-03",
        "billing_date": "2024-03-31",
        "provider": "aliyun",
        "project": None,
        "env": None,
        "owner": None
    },
    {
        "bill_id": "bill_005",
        "resource_id": "ecs-staging-01",
        "resource_type": "ecs",
        "cost": 680.00,
        "currency": "CNY",
        "billing_period": "2024-03",
        "billing_date": "2024-03-31",
        "provider": "aliyun",
        "project": "ecommerce",
        "env": "staging",
        "owner": None
    },
    {
        "bill_id": "bill_006",
        "resource_id": "redis-cache-prod",
        "resource_type": "redis",
        "cost": 920.00,
        "currency": "CNY",
        "billing_period": "2024-03",
        "billing_date": "2024-03-31",
        "provider": "aliyun",
        "project": None,
        "env": "prod",
        "owner": "zhaoming"
    },
    {
        "bill_id": "bill_007",
        "resource_id": "slb-frontend",
        "resource_type": "slb",
        "cost": 380.00,
        "currency": "CNY",
        "billing_period": "2024-03",
        "billing_date": "2024-03-31",
        "provider": "aliyun",
        "project": "ecommerce",
        "env": "prod",
        "owner": "zhangwei"
    },
    {
        "bill_id": "bill_008",
        "resource_id": "ecs-legacy-old",
        "resource_type": "ecs",
        "cost": 520.00,
        "currency": "CNY",
        "billing_period": "2024-03",
        "billing_date": "2024-03-31",
        "provider": "aliyun",
        "project": "legacy",
        "env": "prod",
        "owner": "old_owner"
    },
    {
        "bill_id": "bill_009",
        "resource_id": "nas-shared",
        "resource_type": "nas",
        "cost": 780.00,
        "currency": "CNY",
        "billing_period": "2024-03",
        "billing_date": "2024-03-31",
        "provider": "aliyun",
        "project": None,
        "env": None,
        "owner": None
    },
    {
        "bill_id": "bill_010",
        "resource_id": "rds-archive",
        "resource_type": "rds",
        "cost": 1100.00,
        "currency": "CNY",
        "billing_period": "2024-03",
        "billing_date": "2024-03-31",
        "provider": "aliyun",
        "project": "payment",
        "env": "archive",
        "owner": None
    },
    {
        "bill_id": "bill_011",
        "resource_id": "ec2-monitoring",
        "resource_type": "ec2",
        "cost": 220.00,
        "currency": "CNY",
        "billing_period": "2024-03",
        "billing_date": "2024-03-31",
        "provider": "aws",
        "project": "monitor",
        "env": "prod",
        "owner": None
    },
    {
        "bill_id": "bill_012",
        "resource_id": "unknown-spend-001",
        "resource_type": "unknown",
        "cost": 890.00,
        "currency": "CNY",
        "billing_period": "2024-03",
        "billing_date": "2024-03-31",
        "provider": "aliyun",
        "project": None,
        "env": None,
        "owner": None
    }
]

SAMPLE_RESOURCES = [
    {
        "resource_id": "oss-log-bucket",
        "resource_type": "oss",
        "provider": "aliyun",
        "project": "ecommerce",
        "env": "prod",
        "owner": "zhangwei"
    },
    {
        "resource_id": "ecs-staging-01",
        "resource_type": "ecs",
        "provider": "aliyun",
        "project": "ecommerce",
        "env": "staging",
        "owner": "lisi"
    },
    {
        "resource_id": "redis-cache-prod",
        "resource_type": "redis",
        "provider": "aliyun",
        "project": "payment",
        "env": "prod",
        "owner": "zhaoming"
    },
    {
        "resource_id": "rds-archive",
        "resource_type": "rds",
        "provider": "aliyun",
        "project": "payment",
        "env": "archive",
        "owner": "wanghong"
    },
    {
        "resource_id": "ec2-monitoring",
        "resource_type": "ec2",
        "provider": "aws",
        "project": "monitor",
        "env": "prod",
        "owner": "chenjian"
    }
]

SAMPLE_STRATEGIES = [
    {
        "strategy_id": "strat_oss_logs",
        "name": "OSS日志存储规则",
        "description": "所有OSS日志存储默认归属于电商项目",
        "resource_type_pattern": "oss",
        "tag_rules": {
            "project": "ecommerce",
            "env": "prod",
            "owner": "zhangwei"
        },
        "priority": 10
    },
    {
        "strategy_id": "strat_shared_nas",
        "name": "共享NAS规则",
        "description": "NAS共享存储默认挂公共成本",
        "resource_type_pattern": "nas",
        "tag_rules": {
            "project": "common",
            "env": "shared",
            "owner": "common"
        },
        "priority": 5
    }
]

SAMPLE_OWNERS = [
    {
        "owner_id": "own_001",
        "name": "zhangwei",
        "email": "zhangwei@example.com",
        "projects": ["ecommerce", "common"]
    },
    {
        "owner_id": "own_002",
        "name": "wanghong",
        "email": "wanghong@example.com",
        "projects": ["payment"]
    },
    {
        "owner_id": "own_003",
        "name": "lisi",
        "email": "lisi@example.com",
        "projects": ["ecommerce"]
    },
    {
        "owner_id": "own_004",
        "name": "zhaoming",
        "email": "zhaoming@example.com",
        "projects": ["payment"]
    },
    {
        "owner_id": "own_005",
        "name": "chenjian",
        "email": "chenjian@example.com",
        "projects": ["monitor"]
    },
    {
        "owner_id": "own_006",
        "name": "common",
        "email": "common@example.com",
        "projects": ["common"]
    }
]

SAMPLE_PROJECTS = [
    {
        "project_id": "proj_ecommerce",
        "name": "电商平台",
        "code": "ecommerce",
        "status": "active",
        "description": "核心电商交易系统"
    },
    {
        "project_id": "proj_payment",
        "name": "支付系统",
        "code": "payment",
        "status": "active",
        "description": "支付网关和结算系统"
    },
    {
        "project_id": "proj_monitor",
        "name": "监控平台",
        "code": "monitor",
        "status": "active",
        "description": "统一监控告警系统"
    },
    {
        "project_id": "proj_common",
        "name": "公共成本",
        "code": "common",
        "status": "active",
        "description": "无法直接分摊的公共资源"
    },
    {
        "project_id": "proj_legacy",
        "name": "遗留系统",
        "code": "legacy",
        "status": "inactive",
        "description": "已下线的遗留系统"
    }
]


def export_sample_files(output_dir: str):
    os.makedirs(output_dir, exist_ok=True)

    files = {
        "bills_sample.json": SAMPLE_BILLS,
        "resources_sample.json": SAMPLE_RESOURCES,
        "strategies_sample.json": SAMPLE_STRATEGIES,
        "owners_sample.json": SAMPLE_OWNERS,
        "projects_sample.json": SAMPLE_PROJECTS
    }

    for filename, data in files.items():
        filepath = os.path.join(output_dir, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    return list(files.keys())
