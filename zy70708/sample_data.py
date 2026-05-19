import requests
import json

BASE_URL = "http://localhost:8000"


def create_sample_tasks():
    print("开始创建示例数据...")

    task1 = {
        "domain": "example.com",
        "record_type": "A",
        "old_target": "192.168.1.1",
        "new_target": "10.0.0.1",
        "ttl_strategy": 300,
        "created_by": "zhangsan",
        "records": [
            {
                "record_name": "www.example.com",
                "record_type": "A",
                "old_value": "192.168.1.1",
                "new_value": "10.0.0.1",
                "old_ttl": 7200,
                "new_ttl": 300
            },
            {
                "record_name": "api.example.com",
                "record_type": "A",
                "old_value": "192.168.1.2",
                "new_value": "10.0.0.2",
                "old_ttl": 3600,
                "new_ttl": 300
            }
        ]
    }

    task2 = {
        "domain": "test.org",
        "record_type": "CNAME",
        "old_target": "old.test.org",
        "new_target": "new.test.org",
        "ttl_strategy": 300,
        "created_by": "lisi",
        "records": [
            {
                "record_name": "test.org",
                "record_type": "CNAME",
                "old_value": "old.test.org",
                "new_value": "new.test.org",
                "old_ttl": 300,
                "new_ttl": 300
            }
        ]
    }

    task3 = {
        "domain": "highrisk.cn",
        "record_type": "A",
        "old_target": "1.2.3.4",
        "new_target": "5.6.7.8",
        "ttl_strategy": 600,
        "created_by": "wangwu",
        "records": [
            {
                "record_name": "www.highrisk.cn",
                "record_type": "A",
                "old_value": "1.2.3.4",
                "new_value": "5.6.7.8",
                "old_ttl": 86400,
                "new_ttl": 600
            },
            {
                "record_name": "m.highrisk.cn",
                "record_type": "A",
                "old_value": "1.2.3.5",
                "new_value": "5.6.7.9",
                "old_ttl": 43200,
                "new_ttl": 600
            },
            {
                "record_name": "api.highrisk.cn",
                "record_type": "A",
                "old_value": None,
                "new_value": "5.6.7.10",
                "old_ttl": None,
                "new_ttl": 300
            }
        ]
    }

    for i, task in enumerate([task1, task2, task3], 1):
        try:
            response = requests.post(f"{BASE_URL}/api/tasks/", json=task)
            if response.status_code == 200:
                data = response.json()
                print(f"任务 {i} 创建成功: ID={data['id']}, 域名={data['domain']}, 风险等级={data['risk_level']}")
            else:
                print(f"任务 {i} 创建失败: {response.text}")
        except Exception as e:
            print(f"任务 {i} 创建异常: {e}")

    print("\n示例数据创建完成!")


def show_usage_examples():
    print("\n" + "=" * 60)
    print("常用 curl 命令示例")
    print("=" * 60)

    examples = [
        ("创建任务", f"""curl -X POST {BASE_URL}/api/tasks/ \\
  -H "Content-Type: application/json" \\
  -d '{{
    "domain": "demo.com",
    "record_type": "A",
    "old_target": "1.1.1.1",
    "new_target": "2.2.2.2",
    "ttl_strategy": 300,
    "created_by": "demo",
    "records": [
      {{
        "record_name": "www.demo.com",
        "record_type": "A",
        "old_value": "1.1.1.1",
        "new_value": "2.2.2.2",
        "old_ttl": 3600,
        "new_ttl": 300
      }}
    ]
  }}'"""),

        ("查询任务列表", f"curl {BASE_URL}/api/tasks/"),

        ("查询单个任务", f"curl {BASE_URL}/api/tasks/1"),

        ("获取可转换状态", f"curl {BASE_URL}/api/tasks/1/valid-statuses"),

        ("推进状态", f"""curl -X POST {BASE_URL}/api/tasks/1/status \\
  -H "Content-Type: application/json" \\
  -d '{{"target_status": "pending_audit", "operator": "admin", "remark": "提交审核"}}'"""),

        ("人工修正", f"""curl -X POST {BASE_URL}/api/tasks/1/correct \\
  -H "Content-Type: application/json" \\
  -d '{{"operator": "admin", "ttl_strategy": 60, "remark": "降低TTL以减少风险"}}'"""),

        ("获取预演报告", f"curl {BASE_URL}/api/tasks/1/report"),

        ("导出CSV", f"curl -o report.csv {BASE_URL}/api/tasks/1/export"),

        ("查看操作日志", f"curl {BASE_URL}/api/tasks/1/logs"),

        ("关闭任务", f"""curl -X POST {BASE_URL}/api/tasks/1/close \\
  -H "Content-Type: application/json" \\
  -d '{{"operator": "admin", "reason": "任务取消", "conclusion": "无需切换"}}'""")
    ]

    for name, cmd in examples:
        print(f"\n【{name}】")
        print(cmd)


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "examples":
        show_usage_examples()
    else:
        create_sample_tasks()
