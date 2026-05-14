import requests
import json

BASE_URL = "http://localhost:8000"

test_addresses = [
    {
        "original_address": "北京市朝阳区建国路88号SOHO现代城A座",
        "geocoding_result": json.dumps({"lat": 39.9142, "lng": 116.4830}),
        "candidate_coordinates": json.dumps([
            {"lat": 39.9142, "lng": 116.4830, "name": "SOHO现代城"},
            {"lat": 39.9150, "lng": 116.4820, "name": "建国路88号"}
        ]),
        "delivery_range": "朝阳区三环内",
        "hit_report": "匹配成功"
    },
    {
        "original_address": "上海市浦东新区陆家嘴环路1000号",
        "geocoding_result": json.dumps({"lat": 31.2397, "lng": 121.5058}),
        "candidate_coordinates": json.dumps([
            {"lat": 31.2400, "lng": 121.5000, "name": "陆家嘴"},
            {"lat": 31.2500, "lng": 121.5100, "name": "环路1000号"}
        ]),
        "delivery_range": "浦东新区内环",
        "hit_report": "待匹配"
    },
    {
        "original_address": "广州市天河区珠江新城华夏路16号",
        "geocoding_result": json.dumps({"lat": 23.1200, "lng": 113.3200}),
        "candidate_coordinates": json.dumps([
            {"lat": 25.1200, "lng": 115.3200, "name": "错误坐标1"},
            {"lat": 24.1200, "lng": 114.3200, "name": "错误坐标2"}
        ]),
        "delivery_range": "天河区CBD",
        "hit_report": "匹配失败"
    },
    {
        "original_address": "深圳市南山区科技园南区深南大道9996号",
        "geocoding_result": json.dumps({"lat": 22.5431, "lng": 113.9413}),
        "candidate_coordinates": json.dumps([
            {"lat": 22.5431, "lng": 113.9413, "name": "科技园南区"},
            {"lat": 22.5440, "lng": 113.9420, "name": "深南大道"}
        ]),
        "delivery_range": "南山区科技园",
        "hit_report": "匹配成功"
    },
    {
        "original_address": "杭州市西湖区文三路478号华星科技大厦",
        "geocoding_result": json.dumps({"lat": 30.2741, "lng": 120.1551}),
        "candidate_coordinates": json.dumps([
            {"lat": 30.2800, "lng": 120.1600, "name": "文三路"},
            {"lat": 30.2700, "lng": 120.1500, "name": "华星大厦"}
        ]),
        "delivery_range": "西湖区文教区",
        "hit_report": "待复核"
    }
]

def create_test_data():
    print("开始创建测试数据...")
    for addr in test_addresses:
        try:
            response = requests.post(f"{BASE_URL}/api/addresses", json=addr)
            if response.status_code == 200:
                print(f"✓ 创建成功: {addr['original_address'][:20]}...")
            else:
                print(f"✗ 创建失败: {response.text}")
        except Exception as e:
            print(f"✗ 错误: {e}")

    print("\n测试数据创建完成！")

if __name__ == "__main__":
    create_test_data()
