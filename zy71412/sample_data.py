import requests
from datetime import date, timedelta
import json

BASE_URL = "http://localhost:8000"


def demo_workflow():
    print("=" * 60)
    print("银行授信抵押物复估系统 - 样例数据导入")
    print("=" * 60)

    today = date.today()

    print("\n[1/6] 导入三个抵押物（含多个版本）...")

    collaterals = [
        {
            "collateral_no": "DY2024001",
            "name": "北京市朝阳区建国路88号1号楼1001室",
            "collateral_type": "住宅",
            "address": "北京市朝阳区建国路88号1号楼1001室",
            "owner": "张三",
            "id_card": "110101198001011234",
            "appraised_value": 8000000,
            "appraisal_date": today - timedelta(days=400),
            "appraisal_expiry_date": today - timedelta(days=35),
            "mortgage_rate": 0.7,
            "appraiser": "北京XX评估有限公司",
            "appraisal_report_no": "PG20240001",
            "file_name": "PG20240001_北京建国路88号评估报告.pdf",
            "uploaded_by": "评估公司-李经理",
            "source": "评估公司邮件"
        },
        {
            "collateral_no": "DY2024002",
            "name": "上海市浦东新区世纪大道100号2号楼502室",
            "collateral_type": "商业用房",
            "address": "上海市浦东新区世纪大道100号2号楼502室",
            "owner": "李四",
            "id_card": "310101197805155678",
            "appraised_value": 15000000,
            "appraisal_date": today - timedelta(days=180),
            "appraisal_expiry_date": today + timedelta(days=185),
            "mortgage_rate": 0.6,
            "appraiser": "上海YY评估事务所",
            "appraisal_report_no": "PG20240056",
            "file_name": "PG20240056_上海世纪大道评估报告.pdf",
            "uploaded_by": "客户经理-王芳",
            "source": "客户现场提交"
        },
        {
            "collateral_no": "DY2024003",
            "name": "广州市天河区珠江新城华夏路16号3栋1203室",
            "collateral_type": "住宅",
            "address": "广州市天河区珠江新城华夏路16号3栋1203室",
            "owner": "王五",
            "id_card": "440101198512209012",
            "appraised_value": 5000000,
            "appraisal_date": today - timedelta(days=90),
            "appraisal_expiry_date": today + timedelta(days=275),
            "mortgage_rate": 0.7,
            "appraiser": "广东ZZ评估有限公司",
            "appraisal_report_no": "PG20240128",
            "file_name": "PG20240128_广州珠江新城评估报告.pdf",
            "uploaded_by": "客户经理-陈明",
            "source": "内部系统上传"
        }
    ]

    collateral_ids = []
    for idx, col in enumerate(collaterals, 1):
        payload = {k: (v.isoformat() if isinstance(v, date) else v) for k, v in col.items()}
        resp = requests.post(f"{BASE_URL}/api/collaterals/import", json=payload)
        if resp.status_code == 200:
            data = resp.json()
            collateral_ids.append(data["collateral_id"])
            print(f"  ✓ DY202400{idx} 导入成功，版本号: {data['version_no']}, 评估价: {data['appraised_value']:,.0f}元")
        else:
            print(f"  ✗ DY202400{idx} 导入失败: {resp.text}")

    print("\n[2/6] 给DY2024001补一个新版本（重新评估，更新评估价）...")
    new_version = {
        "collateral_id": collateral_ids[0],
        "appraised_value": 9500000,
        "appraisal_date": today.isoformat(),
        "appraisal_expiry_date": (today + timedelta(days=365)).isoformat(),
        "mortgage_rate": 0.7,
        "appraiser": "北京XX评估有限公司",
        "appraisal_report_no": "PG20250089",
        "remark": "重新评估，较上版增值150万元"
    }
    resp = requests.post(f"{BASE_URL}/api/collaterals/versions", json=new_version)
    if resp.status_code == 200:
        data = resp.json()
        print(f"  ✓ DY2024001 新版本创建成功，版本号: {data['version_no']}, 新评估价: {data['appraised_value']:,.0f}元")
    else:
        print(f"  ✗ 新版本创建失败: {resp.text}")

    print("\n[3/6] 导入授信合同并关联抵押物...")

    contracts = [
        {
            "contract_no": "SX20240001",
            "borrower": "张三",
            "borrower_id_card": "110101198001011234",
            "credit_amount": 5600000,
            "start_date": (today - timedelta(days=365)).isoformat(),
            "end_date": (today + timedelta(days=365)).isoformat(),
            "bank": "中国工商银行北京分行",
            "account_manager": "客户经理-王芳",
            "file_name": "SX20240001_张三个人经营贷合同.pdf",
            "uploaded_by": "综合岗-刘姐",
            "source": "信贷系统同步",
            "collateral_no": "DY2024001",
            "occupancy_amount": 5600000,
            "occupancy_date": (today - timedelta(days=365)).isoformat()
        },
        {
            "contract_no": "SX20240023",
            "borrower": "上海XX贸易有限公司",
            "borrower_id_card": "91310115MA12345678",
            "credit_amount": 9000000,
            "start_date": (today - timedelta(days=200)).isoformat(),
            "end_date": (today + timedelta(days=530)).isoformat(),
            "bank": "中国建设银行上海分行",
            "account_manager": "客户经理-张伟",
            "file_name": "SX20240023_上海XX贸易公司授信合同.pdf",
            "uploaded_by": "客户经理-张伟",
            "source": "客户提交",
            "collateral_no": "DY2024002",
            "occupancy_amount": 9000000,
            "occupancy_date": (today - timedelta(days=200)).isoformat()
        },
        {
            "contract_no": "SX20240045",
            "borrower": "广州YY科技有限公司",
            "borrower_id_card": "91440101MA87654321",
            "credit_amount": 4000000,
            "start_date": (today - timedelta(days=100)).isoformat(),
            "end_date": (today + timedelta(days=630)).isoformat(),
            "bank": "中国银行广州分行",
            "account_manager": "客户经理-李娜",
            "file_name": "SX20240045_广州YY科技授信合同.pdf",
            "uploaded_by": "客户经理-李娜",
            "source": "客户提交",
            "collateral_no": "DY2024003",
            "occupancy_amount": 3500000,
            "occupancy_date": (today - timedelta(days=100)).isoformat()
        },
        {
            "contract_no": "SX20240078",
            "borrower": "王五",
            "borrower_id_card": "440101198512209012",
            "credit_amount": 2000000,
            "start_date": (today - timedelta(days=60)).isoformat(),
            "end_date": (today + timedelta(days=300)).isoformat(),
            "bank": "招商银行广州分行",
            "account_manager": "客户经理-赵强",
            "file_name": "SX20240078_王五个人消费贷合同.pdf",
            "uploaded_by": "客户经理-赵强",
            "source": "客户提交",
            "collateral_no": "DY2024003",
            "occupancy_amount": 2000000,
            "occupancy_date": (today - timedelta(days=60)).isoformat()
        }
    ]

    for idx, contract in enumerate(contracts, 1):
        resp = requests.post(f"{BASE_URL}/api/contracts/import", json=contract)
        if resp.status_code == 200:
            print(f"  ✓ {contract['contract_no']} 导入成功，关联抵押物: {contract['collateral_no']}, 占用金额: {contract['occupancy_amount']:,.0f}元")
        else:
            print(f"  ✗ {contract['contract_no']} 导入失败: {resp.text}")

    print("\n[4/6] 创建复估任务...")
    reassessment_data = {
        "name": f"2025年Q2抵押物批量复估",
        "collateral_ids": collateral_ids,
        "triggered_by": "季度常规复估",
        "max_rate": 0.7
    }
    resp = requests.post(f"{BASE_URL}/api/reassessments", json=reassessment_data)
    reassessment_id = None
    if resp.status_code == 200:
        data = resp.json()
        reassessment_id = data["id"]
        print(f"  ✓ 复估任务创建成功，编号: {data['reassessment_no']}, 包含 {len(data['tasks'])} 个抵押物")
    else:
        print(f"  ✗ 复估任务创建失败: {resp.text}")

    print("\n[5/6] 执行复估处理（自动检测异常）...")
    if reassessment_id:
        resp = requests.post(
            f"{BASE_URL}/api/reassessments/{reassessment_id}/process",
            params={"handler": "客户经理-王芳"}
        )
        if resp.status_code == 200:
            data = resp.json()
            print(f"  ✓ 复估处理完成，状态: {data['status']}")
            for task in data["tasks"]:
                status_icon = "⚠" if task["status"] == "warning" else "✓"
                rate_str = f"{task['current_mortgage_rate']:.2%}" if task["current_mortgage_rate"] else "N/A"
                print(f"    {status_icon} 抵押物任务 {task['id']}: 状态={task['status']}, 抵押率={rate_str}")
        else:
            print(f"  ✗ 复估处理失败: {resp.text}")

    print("\n[6/6] 查看复估预警详情...")
    if reassessment_id:
        resp = requests.get(f"{BASE_URL}/api/reassessments/{reassessment_id}/warnings")
        if resp.status_code == 200:
            data = resp.json()
            print(f"  共检测到 {data['total_warnings']} 条预警（错误: {data['error_count']}, 警告: {data['warning_count']}）")
            for w in data["warnings"]:
                severity_icon = "🔴" if w["severity"] == "error" else "🟡"
                print(f"\n    {severity_icon} [{w['warning_type']}] {w['message']}")
                print(f"       触发材料: {w['trigger_material']}")
                print(f"       卡在哪: {w['blocked_at']}")
                print(f"       补什么: {w['next_action']}")
        else:
            print(f"  ✗ 获取预警失败: {resp.text}")

    print("\n" + "=" * 60)
    print("样例数据导入完成！")
    print("=" * 60)
    print("\n接下来可以操作：")
    print(f"  1. 查看复估任务详情: GET {BASE_URL}/api/reassessments/{reassessment_id}")
    print(f"  2. 导出复估报告: GET {BASE_URL}/api/reassessments/{reassessment_id}/export")
    print(f"  3. 复核复估结果: POST {BASE_URL}/api/reassessments/{reassessment_id}/review")
    print(f"  4. 查看抵押物历史: GET {BASE_URL}/api/collaterals/{collateral_ids[0]}/history")
    print(f"  5. 单抵押物检测: GET {BASE_URL}/api/detect/{collateral_ids[2]}")
    print(f"  6. 查看统计数据: GET {BASE_URL}/api/statistics")
    print(f"\nAPI文档: {BASE_URL}/docs")

    return reassessment_id


if __name__ == "__main__":
    try:
        demo_workflow()
    except requests.exceptions.ConnectionError:
        print("\n❌ 无法连接到服务器，请先启动服务：")
        print("   1. pip install -r requirements.txt")
        print("   2. python main.py")
        print("   3. 再运行 python sample_data.py")
