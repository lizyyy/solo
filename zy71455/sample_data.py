import requests
import json
import time

BASE_URL = "http://localhost:8000"

sample_contracts = [
    {
        "contract_id": "CALL-STANDARD-001",
        "source_reference": "作业-第1题-标准看涨期权",
        "option_type": "call",
        "underlying_price": 100.0,
        "strike_price": 105.0,
        "risk_free_rate": 0.05,
        "volatility": 0.2,
        "maturity_days": 365,
        "dividend_yield": 0.0,
        "random_seed": 42,
        "num_simulations": 10000,
        "num_steps": 252,
        "notes": "标准看涨期权，固定种子，用于结果可复现",
        "requires_manual_review": False
    },
    {
        "contract_id": "PUT-RANDOM-002",
        "source_reference": "作业-第2题-随机种子看跌",
        "option_type": "put",
        "underlying_price": 100.0,
        "strike_price": 95.0,
        "risk_free_rate": 0.05,
        "volatility": 0.25,
        "maturity_days": 180,
        "dividend_yield": 0.0,
        "random_seed": None,
        "num_simulations": 5000,
        "num_steps": 252,
        "notes": "看跌期权，种子不固定，每次运行结果不同",
        "requires_manual_review": False
    },
    {
        "contract_id": "CALL-NODISCOUNT-003",
        "source_reference": "作业-第3题-漏算贴现",
        "option_type": "call",
        "underlying_price": 100.0,
        "strike_price": 100.0,
        "risk_free_rate": 0.05,
        "volatility": 0.2,
        "maturity_days": 365,
        "dividend_yield": 0.0,
        "random_seed": 12345,
        "num_simulations": 10000,
        "num_steps": 252,
        "notes": "此合约用于演示贴现漏算的常见错误",
        "requires_manual_review": True,
        "review_reason": "需要验证贴现因子应用"
    },
    {
        "contract_id": "CALL-CI-004",
        "source_reference": "作业-第4题-置信区间",
        "option_type": "call",
        "underlying_price": 100.0,
        "strike_price": 110.0,
        "risk_free_rate": 0.05,
        "volatility": 0.3,
        "maturity_days": 90,
        "dividend_yield": 0.0,
        "random_seed": 999,
        "num_simulations": 2000,
        "num_steps": 252,
        "notes": "较少模拟次数，用于演示置信区间宽度与模拟次数的关系",
        "requires_manual_review": True,
        "review_reason": "置信区间较宽，需增加模拟次数"
    },
    {
        "contract_id": "PUT-INCOMPLETE-005",
        "source_reference": "作业-第5题-缺失参数",
        "option_type": "put",
        "underlying_price": 100.0,
        "strike_price": 100.0,
        "risk_free_rate": 0.05,
        "volatility": 0.2,
        "maturity_days": 365,
        "dividend_yield": 0.0,
        "random_seed": 777,
        "num_simulations": 10000,
        "num_steps": 252,
        "notes": "波动率数据来源存疑，需要人工确认参数正确性",
        "requires_manual_review": True,
        "review_reason": "波动率数值异常，需要人工补充资料确认"
    },
    {
        "contract_id": "CALL-EXTREME-VOL-006",
        "source_reference": "作业-第6题-高波动率",
        "option_type": "call",
        "underlying_price": 50.0,
        "strike_price": 60.0,
        "risk_free_rate": 0.03,
        "volatility": 0.8,
        "maturity_days": 30,
        "dividend_yield": 0.0,
        "random_seed": 555,
        "num_simulations": 10000,
        "num_steps": 252,
        "notes": "高波动率场景，用于演示尾部风险",
        "requires_manual_review": False
    }
]

def import_samples():
    print("=== 导入样例数据...")
    url = f"{BASE_URL}/api/import/batch"
    response = requests.post(url, json=sample_contracts)
    result = response.json()
    print(f"导入结果: {json.dumps(result, indent=2, ensure_ascii=False)")
    return result

def run_pricing_for_all():
    print("\n=== 运行定价计算...")
    
    contracts = ["CALL-STANDARD-001", "PUT-RANDOM-002", "CALL-NODISCOUNT-003", "CALL-CI-004", "PUT-INCOMPLETE-005", "CALL-EXTREME-VOL-006"]
    
    for contract_id in contracts:
        print(f"\n处理合约: {contract_id}")
        
        if contract_id == "CALL-NODISCOUNT-003":
            apply_discount = False
            print("  注意: 不应用贴现因子（演示贴现漏算")
        else:
            apply_discount = True
        
        url = f"{BASE_URL}/api/price/run"
        payload = {
            "contract_id": contract_id,
            "confidence_level": 0.95,
            "store_sample_paths": True,
            "num_steps": 252,
            "apply_discount": apply_discount
        }
        
        try:
            response = requests.post(url, json=payload)
            if response.status_code == 200:
                result = response.json()
                print(f"  价格: {result['pricing_result']['option_price']:.4f}")
                print(f"  置信区间: [{result['pricing_result']['ci_lower']:.4f}, {result['pricing_result']['ci_upper']:.4f}]")
                print(f"  实际使用种子: {result['pricing_result']['actual_seed']}")
            else:
                print(f"  错误: {response.text}")
        except Exception as e:
            print(f"  异常: {e}")
        
        time.sleep(0.5)

def demonstrate_teaching_points():
    print("\n=== 教学要点演示:")
    
    print("\n1. 随机种子效应:")
    print("   - 固定种子(42)的合约每次定价结果可复现")
    print("   - 无种子的合约每次运行结果不同但相近")
    
    print("\n2. 贴现因子效应:")
    print("   - CALL-NODISCOUNT-003 不应用贴现")
    print("   - 价格为到期日预期收益，不是现值")
    print("   - 正确价格应乘以 exp(-rT)")
    
    print("\n3. 置信区间解读:")
    print("   - 95%置信区间不是'真实价格有95%概率在区间内'")
    print("   - 正确理解: 如果重复抽样，95%的区间会包含真实价格")
    print("   - 模拟次数越少，置信区间越宽")
    
    print("\n4. 状态追踪:")
    print("   - 每个合约都有完整的状态历史")
    print("   - imported -> processing -> completed/failed")

def show_contract_details():
    print("\n=== 查看合约详情...")
    
    url = f"{BASE_URL}/api/contracts/CALL-STANDARD-001"
    response = requests.get(url)
    if response.status_code == 200:
        data = response.json()
        print(f"合约: {data['contract']['contract_id']}")
        print(f"状态历史:")
        for h in data['status_history']:
            print(f"  {h['from_status']} -> {h['to_status']}: {h['reason']}")

def export_sample():
    print("\n=== 导出样例...")
    url = f"{BASE_URL}/api/export/CALL-STANDARD-001?format=json"
    response = requests.get(url)
    if response.status_code == 200:
        data = response.json()
        print("导出成功，包含:")
        print(f"  合约参数: {list(data['contract_parameters'].keys())}")
        print(f"  定价结果: {data['pricing_result']}")
        print(f"  计算方法: {data['calculation_methodology']}")

if __name__ == "__main__":
    print("蒙特卡洛期权定价讲解器 - 样例数据初始化")
    print("=" * 60)
    
    try:
        import_samples()
        time.sleep(1)
        run_pricing_for_all()
        time.sleep(1)
        show_contract_details()
        time.sleep(1)
        export_sample()
        demonstrate_teaching_points()
        
        print("\n" + "=" * 60)
        print("样例数据初始化完成!")
        print(f"查看所有合约: GET /api/contracts")
        print(f"查看模拟路径: GET /api/contracts/{{id}}/paths")
        print(f"误差分析: GET /api/contracts/{{id}}/error-analysis")
        
    except requests.exceptions.ConnectionError:
        print("错误: 无法连接到服务器")
        print("请先启动服务: uvicorn main:app --reload")
