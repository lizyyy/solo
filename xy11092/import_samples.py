import json
import requests
import sys

API_BASE_URL = "http://localhost:8000"

def import_sample_data():
    print("开始导入舞台灯光设备套装样例数据...")
    
    with open("sample_data/sample_sets.json", "r", encoding="utf-8") as f:
        sample_sets = json.load(f)
    
    print(f"共找到 {len(sample_sets)} 套样例数据")
    
    try:
        response = requests.post(f"{API_BASE_URL}/lighting-sets/batch-import/", json=sample_sets)
        response.raise_for_status()
        result = response.json()
        
        print(f"\n导入结果：")
        print(f"  总计: {result['total']} 条")
        print(f"  成功: {result['success']} 条")
        print(f"  失败: {result['failed']} 条")
        
        print("\n详细结果：")
        for row_result in result['results']:
            status = "✅ 成功" if row_result['success'] else "❌ 失败"
            print(f"  第{row_result['row']}行 - {row_result['set_code']}: {status}")
            if row_result.get('warnings'):
                for warning in row_result['warnings']:
                    print(f"      ⚠️  警告: {warning}")
            if row_result.get('errors'):
                for error in row_result['errors']:
                    print(f"      ❌ 错误: {error}")
        
        print("\n样例数据导入完成!")
        
    except requests.exceptions.ConnectionError:
        print("❌ 无法连接到 API 服务器，请先启动服务:")
        print("   uvicorn main:app --reload")
        sys.exit(1)
    except Exception as e:
        print(f"❌ 导入失败: {e}")
        sys.exit(1)

if __name__ == "__main__":
    import_sample_data()
