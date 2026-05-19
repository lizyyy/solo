#!/usr/bin/env python3

import requests
import json

BASE_URL = "http://localhost:8000/api/v1"


def test_single_book_import():
    print("=== 测试单本书籍导入 ===")
    
    books = [
        {
            "title": "Python编程：从入门到实践",
            "isbn": "978-7-115-42802-8",
            "author": "Eric Matthes",
            "publisher": "人民邮电出版社",
            "condition": "九成新",
            "grade": "高一",
            "book_count": 2,
            "donor_name": "张三",
            "donor_phone": "13800138000",
            "donor_idcard": "110101199001011234",
            "remarks": "封皮轻微磨损"
        },
        {
            "title": "无ISBN测试书籍",
            "isbn": None,
            "author": "测试作者",
            "condition": "全新",
            "grade": "三年级",
            "book_count": 1
        }
    ]
    
    for book in books:
        response = requests.post(f"{BASE_URL}/books/", json=book)
        print(f"书名: {book['title']}")
        print(f"状态码: {response.status_code}")
        print(f"响应: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
        print("-" * 50)


def test_duplicate_book_import():
    print("\n=== 测试重复书籍导入（应该累加数量） ===")
    
    book = {
        "title": "Python编程：从入门到实践",
        "isbn": "978-7-115-42802-8",
        "author": "Eric Matthes",
        "condition": "九成新",
        "grade": "高一",
        "book_count": 3
    }
    
    response = requests.post(f"{BASE_URL}/books/", json=book)
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")


def test_invalid_isbn():
    print("\n=== 测试无效ISBN（应该被拒绝） ===")
    
    book = {
        "title": "无效ISBN测试",
        "isbn": "123456789",
        "condition": "八成新",
        "grade": "初一",
        "book_count": 1
    }
    
    response = requests.post(f"{BASE_URL}/books/", json=book)
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")


def test_invalid_condition():
    print("\n=== 测试无效品相（应该被拒绝） ===")
    
    book = {
        "title": "无效品相测试",
        "condition": "废品",
        "grade": "初二",
        "book_count": 1
    }
    
    response = requests.post(f"{BASE_URL}/books/", json=book)
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")


def test_batch_import():
    print("\n=== 测试批量导入 ===")
    
    batch_data = {
        "operator_name": "志愿者小李",
        "operator_phone": "13900139000",
        "books": [
            {
                "title": "三国演义",
                "isbn": "9787020008729",
                "author": "罗贯中",
                "condition": "七成新",
                "grade": "高二",
                "book_count": 2,
                "donor_name": "李四"
            },
            {
                "title": "红楼梦",
                "isbn": "9787020002208",
                "author": "曹雪芹",
                "condition": "八成新",
                "grade": "高三",
                "book_count": 1
            },
            {
                "title": "无效书籍测试",
                "condition": "无效品相",
                "grade": "五年级",
                "book_count": 1
            },
            {
                "title": "Python编程：从入门到实践",
                "isbn": "978-7-115-42802-8",
                "condition": "九成新",
                "grade": "高一",
                "book_count": 5
            }
        ]
    }
    
    response = requests.post(f"{BASE_URL}/books/batch-import", json=batch_data)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"批次号: {result['batch_no']}")
    print(f"总计: {result['total_count']}, 成功: {result['success_count']}, 失败: {result['failed_count']}")
    print("详细结果:")
    for item in result['results']:
        status = "✓" if item['success'] else "✗"
        book_title = item['book']['title'] if item['book'] else '未知'
        print(f"  {status} 行{item['row_number']}: {book_title} - {item['reason']}")


def test_get_books():
    print("\n=== 获取书籍列表 ===")
    
    response = requests.get(f"{BASE_URL}/books/")
    print(f"状态码: {response.status_code}")
    books = response.json()
    print(f"返回书籍数量: {len(books)}")
    for book in books[:3]:
        print(f"  - {book['title']} (ISBN: {book['isbn']}, 品相: {book['condition']}, 数量: {book['book_count']})")
        print(f"    捐赠人电话: {book.get('donor_phone', 'N/A')}")


def test_statistics():
    print("\n=== 获取统计信息 ===")
    
    response = requests.get(f"{BASE_URL}/books/statistics/overview")
    print(f"状态码: {response.status_code}")
    stats = response.json()
    print(f"总书籍数: {stats['total_books']}")
    print(f"唯一书籍数: {stats['total_unique_books']}")
    print(f"按年级统计: {stats['by_grade']}")
    print(f"按品相统计: {stats['by_condition']}")


def test_shelf_list():
    print("\n=== 获取上架清单 ===")
    
    response = requests.get(f"{BASE_URL}/books/shelf/list?status=待上架")
    print(f"状态码: {response.status_code}")
    shelf = response.json()
    print(f"清单项目数: {shelf['total_items']}, 总书籍: {shelf['total_books']}")


def test_import_batches():
    print("\n=== 获取导入批次列表 ===")
    
    response = requests.get(f"{BASE_URL}/books/import/batches")
    print(f"状态码: {response.status_code}")
    batches = response.json()
    print(f"批次数量: {len(batches)}")
    for batch in batches[:2]:
        print(f"  - {batch['batch_no']}: {batch['status']} (成功: {batch['success_count']}, 失败: {batch['failed_count']})")
        print(f"    操作员电话: {batch.get('operator_phone', 'N/A')}")


def test_allowed_values():
    print("\n=== 获取允许的品相和年级值 ===")
    
    response = requests.get(f"{BASE_URL}/meta/allowed-values")
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")


if __name__ == "__main__":
    print("公益书库管理系统 API 测试")
    print("=" * 60)
    
    try:
        test_allowed_values()
        test_single_book_import()
        test_duplicate_book_import()
        test_invalid_isbn()
        test_invalid_condition()
        test_batch_import()
        test_get_books()
        test_statistics()
        test_shelf_list()
        test_import_batches()
        
        print("\n" + "=" * 60)
        print("所有测试完成!")
        print(f"访问 http://localhost:8000/docs 查看完整API文档")
        
    except requests.exceptions.ConnectionError:
        print("\n错误: 无法连接到服务器。请先启动服务:")
        print("  pip install -r requirements.txt")
        print("  python main.py")
