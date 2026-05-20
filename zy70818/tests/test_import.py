#!/usr/bin/env python3
"""测试数据导入功能"""

import sys
sys.path.insert(0, '.')

from services.import_service import import_service


def test_inventory_import():
    print("测试库存CSV导入...")
    with open('data/sample_inventory.csv', 'r', encoding='utf-8-sig') as f:
        content = f.read()
    result = import_service.import_inventory(content)
    print(f"结果: {result['message']}")
    print(f"导入数量: {result['count']}")
    return result


def test_recall_import():
    print("\n测试召回公告Markdown导入...")
    with open('data/sample_recall.md', 'r', encoding='utf-8') as f:
        content = f.read()
    result = import_service.import_recall(content)
    print(f"结果: {result['message']}")
    print(f"公告标题: {result['notice']['title']}")
    return result


def test_consumption_import():
    print("\n测试消耗CSV导入...")
    with open('data/sample_consumption.csv', 'r', encoding='utf-8-sig') as f:
        content = f.read()
    result = import_service.import_consumption(content)
    print(f"结果: {result['message']}")
    print(f"导入数量: {result['count']}")
    return result


if __name__ == '__main__':
    print("=" * 50)
    print("口腔连锁对账服务 - 导入功能测试")
    print("=" * 50)

    test_inventory_import()
    test_recall_import()
    test_consumption_import()

    print("\n" + "=" * 50)
    print("数据导入测试完成!")
    print("=" * 50)
