#!/usr/bin/env python3
"""生成样例数据脚本"""

from api_key_risk.sample_data import SampleDataGenerator

if __name__ == "__main__":
    generator = SampleDataGenerator(data_dir="./data")
    generator.generate_all_samples()
    print("\n样例数据说明:")
    print("  CUST-001 / KEY-001: 正常业务增长（低风险）")
    print("  CUST-002 / KEY-002: 疑似密钥泄露（高风险 - 多IP+非常用地区+敏感接口）")
    print("  CUST-003 / KEY-003: 撞库失败攻击（高风险 - 高失败率+多IP）")
    print("  CUST-004 / KEY-004: 新客户误报（中风险但标记安全后可降低）")
