import requests
import json

BASE_URL = "http://localhost:8000/api"

def init_sample_data():
    print("开始初始化样例数据...")
    
    # 1. 创建身份源
    print("1. 创建身份源...")
    source_data = {
        "name": "企业AD域",
        "provider": "ActiveDirectory",
        "config": {
            "ldap_url": "ldap://ad.example.com",
            "base_dn": "DC=example,DC=com"
        }
    }
    resp = requests.post(f"{BASE_URL}/identity-sources", json=source_data)
    source_id = resp.json()["id"]
    print(f"   身份源创建成功, ID: {source_id}")
    
    # 2. 创建属性映射
    print("2. 创建属性映射...")
    mappings = [
        {
            "identity_source_id": source_id,
            "source_attribute": "sAMAccountName",
            "target_attribute": "username",
            "mapping_type": "direct",
            "is_required": True
        },
        {
            "identity_source_id": source_id,
            "source_attribute": "mail",
            "target_attribute": "email",
            "mapping_type": "direct",
            "is_required": True
        },
        {
            "identity_source_id": source_id,
            "source_attribute": "memberOf",
            "target_attribute": "roles",
            "mapping_type": "array",
            "is_required": False
        },
        {
            "identity_source_id": source_id,
            "source_attribute": "department",
            "target_attribute": "department",
            "mapping_type": "direct",
            "is_required": True
        }
    ]
    
    for m in mappings:
        resp = requests.post(f"{BASE_URL}/attribute-mappings", json=m)
        print(f"   映射创建: {m['source_attribute']} -> {m['target_attribute']}")
    
    # 3. 创建测试用户1 - 正常用户
    print("3. 创建测试用户...")
    user1_data = {
        "identity_source_id": source_id,
        "external_id": "AD001",
        "email": "zhangsan@example.com",
        "raw_attributes": {
            "sAMAccountName": "zhangsan",
            "mail": "zhangsan@example.com",
            "memberOf": ["CN=技术部,DC=example,DC=com", "CN=开发组,DC=example,DC=com"],
            "department": "技术部"
        }
    }
    resp = requests.post(f"{BASE_URL}/test-users", json=user1_data)
    user1_id = resp.json()["id"]
    print(f"   用户1(张三)创建成功, ID: {user1_id}")
    
    # 4. 创建测试用户2 - 缺少必填字段（会被规则拦住）
    user2_data = {
        "identity_source_id": source_id,
        "external_id": "AD002",
        "email": "lisi@example.com",
        "raw_attributes": {
            "sAMAccountName": "lisi",
            "mail": "lisi@example.com",
            "memberOf": ["CN=市场部,DC=example,DC=com"]
        }
    }
    resp = requests.post(f"{BASE_URL}/test-users", json=user2_data)
    user2_id = resp.json()["id"]
    print(f"   用户2(李四-缺少department)创建成功, ID: {user2_id}")
    
    # 5. 创建测试用户3 - 角色名过长（会触发冲突检测）
    user3_data = {
        "identity_source_id": source_id,
        "external_id": "AD003",
        "email": "wangwu@example.com",
        "raw_attributes": {
            "sAMAccountName": "wangwu",
            "mail": "wangwu@example.com",
            "memberOf": ["CN=这是一个非常长的角色名称用来测试角色冲突检测功能是否正常工作,DC=example,DC=com"],
            "department": "产品部"
        }
    }
    resp = requests.post(f"{BASE_URL}/test-users", json=user3_data)
    user3_id = resp.json()["id"]
    print(f"   用户3(王五-角色名过长)创建成功, ID: {user3_id}")
    
    print("\n样例数据初始化完成!")
    print(f"\n身份源ID: {source_id}")
    print(f"用户ID列表: {user1_id}, {user2_id}, {user3_id}")
    print("\n接下来可以运行:")
    print(f"  验证用户1: curl -X POST {BASE_URL}/test-users/{user1_id}/validate")
    print(f"  验证用户2(会失败): curl -X POST {BASE_URL}/test-users/{user2_id}/validate")
    print(f"  验证用户3(有冲突): curl -X POST {BASE_URL}/test-users/{user3_id}/validate")

if __name__ == "__main__":
    init_sample_data()
