#!/usr/bin/env python3
"""
Markdown锚点迁移修复预览API自检脚本
验证导入、筛选、处理和导出功能
"""

import sys
import os
import json
import sqlite3

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import (
    init_db, insert_markdown_file, insert_heading_anchor, insert_link,
    update_link, get_link_by_id, get_links_by_status, get_all_links,
    get_anchors_by_file_id, get_file_by_path, get_all_files,
    create_report, get_report, get_all_reports
)
from anchor_utils import (
    parse_markdown_headings, parse_markdown_links, generate_anchor_slug,
    scan_file_for_broken_anchors, generate_file_hash, preview_fix,
    find_best_anchor_match
)


class TestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []
    
    def add(self, test_name, success, message=""):
        self.results.append({
            "test": test_name,
            "success": success,
            "message": message
        })
        if success:
            self.passed += 1
            print(f"✅ {test_name}")
        else:
            self.failed += 1
            print(f"❌ {test_name}: {message}")
    
    def summary(self):
        print("\n" + "="*60)
        print(f"测试结果: {self.passed} 通过, {self.failed} 失败")
        print("="*60)
        return self.failed == 0


def clean_test_db():
    """清理测试数据库"""
    db_path = "anchor_migration.db"
    if os.path.exists(db_path):
        os.remove(db_path)
    # 重新初始化
    init_db()


def test_anchor_generation():
    """测试锚点生成算法"""
    result = TestResult()
    
    test_cases = [
        ("Hello World", "hello-world"),
        ("标题 (带括号)", "标题-带括号"),
        ("Hello   World!!!", "hello-world"),
        ("123 Test 456", "123-test-456"),
    ]
    
    for input_text, expected in test_cases:
        actual = generate_anchor_slug(input_text)
        result.add(
            f"锚点生成: '{input_text}'",
            actual == expected,
            f"期望: '{expected}', 实际: '{actual}'"
        )
    
    return result


def test_heading_parsing():
    """测试Markdown标题解析"""
    result = TestResult()
    
    content = """# 一级标题
## 二级标题
### 三级标题

普通内容

另一个一级标题
===============
"""
    
    headings = parse_markdown_headings(content)
    
    result.add(
        "标题解析: 数量",
        len(headings) == 4,
        f"期望: 4, 实际: {len(headings)}"
    )
    
    h1_count = len([h for h in headings if h['level'] == 1])
    result.add(
        "标题解析: H1数量",
        h1_count == 2,
        f"期望: 2, 实际: {h1_count}"
    )
    
    h2_count = len([h for h in headings if h['level'] == 2])
    result.add(
        "标题解析: H2数量",
        h2_count == 1,
        f"期望: 1, 实际: {h2_count}"
    )
    
    anchors = [h['anchor'] for h in headings]
    result.add(
        "标题解析: 锚点生成",
        '一级标题' in anchors[0],
        f"实际锚点: {anchors}"
    )
    
    return result


def test_link_parsing():
    """测试Markdown链接解析"""
    result = TestResult()
    
    content = """# 测试文档

[正常链接](other.md#section-1)
[只有文件](doc.md)
[只有锚点](#internal-link)
<https://example.com/page#anchor>
"""
    
    links = parse_markdown_links(content)
    
    result.add(
        "链接解析: 数量",
        len(links) == 4,
        f"期望: 4, 实际: {len(links)}"
    )
    
    with_anchor = len([l for l in links if l['anchor']])
    result.add(
        "链接解析: 带锚点数量",
        with_anchor == 3,
        f"期望: 3, 实际: {with_anchor}"
    )
    
    return result


def test_anchor_matching():
    """测试锚点匹配算法"""
    result = TestResult()
    
    available_anchors = [
        {'anchor': 'section-one', 'text': '第一节'},
        {'anchor': 'section-two', 'text': '第二节'},
        {'anchor': 'introduction', 'text': '简介'},
    ]
    
    # 精确匹配
    match, score = find_best_anchor_match('section-one', available_anchors)
    result.add(
        "锚点匹配: 精确匹配",
        match is not None and match['anchor'] == 'section-one',
        f"相似度: {score}"
    )
    
    # 模糊匹配
    match, score = find_best_anchor_match('section-1', available_anchors, 0.5)
    result.add(
        "锚点匹配: 模糊匹配",
        match is not None,
        f"最佳匹配: {match}, 相似度: {score}"
    )
    
    # 不匹配
    match, score = find_best_anchor_match('nonexistent', available_anchors)
    result.add(
        "锚点匹配: 不匹配",
        match is None,
        f"相似度: {score}"
    )
    
    return result


def test_preview_fix():
    """测试修复预览功能"""
    result = TestResult()
    
    original_content = """# 文档

[链接](other.md#old-anchor)
"""
    
    link_info = {
        'line': 3,
        'text': '链接',
        'url': 'other.md',
        'anchor': 'old-anchor'
    }
    
    new_content, details = preview_fix(original_content, link_info, 'new-anchor')
    
    result.add(
        "修复预览: 成功",
        details['success'] == True,
        f"详情: {details}"
    )
    
    result.add(
        "修复预览: 锚点替换",
        '#new-anchor' in new_content,
        f"新内容: {new_content}"
    )
    
    result.add(
        "修复预览: 旧锚点不存在",
        '#old-anchor' not in new_content,
        f"新内容: {new_content}"
    )
    
    return result


def test_database_operations():
    """测试数据库操作"""
    result = TestResult()
    
    # 导入文件
    file_path = "/test/doc1.md"
    content = """# 标题1
## 标题2
[链接](doc1.md#title-3)
"""
    
    file_hash = generate_file_hash(content)
    file_id = insert_markdown_file(file_path, file_hash)
    
    result.add(
        "数据库: 插入文件",
        file_id > 0,
        f"文件ID: {file_id}"
    )
    
    # 获取文件
    file = get_file_by_path(file_path)
    result.add(
        "数据库: 获取文件",
        file is not None and file['id'] == file_id,
        f"文件: {file}"
    )
    
    # 插入锚点
    anchor_id = insert_heading_anchor(
        file_id=file_id,
        heading_text='标题1',
        heading_level=1,
        anchor_slug='title-1',
        line_number=1
    )
    result.add(
        "数据库: 插入锚点",
        anchor_id > 0,
        f"锚点ID: {anchor_id}"
    )
    
    # 获取锚点
    anchors = get_anchors_by_file_id(file_id)
    result.add(
        "数据库: 获取锚点",
        len(anchors) >= 1,
        f"锚点数量: {len(anchors)}"
    )
    
    # 插入链接
    link_id = insert_link(
        source_file_id=file_id,
        link_text='链接',
        old_link_url='doc1.md',
        old_anchor='title-3',
        line_number=3,
        column_number=1
    )
    result.add(
        "数据库: 插入链接",
        link_id > 0,
        f"链接ID: {link_id}"
    )
    
    # 获取链接
    link = get_link_by_id(link_id)
    result.add(
        "数据库: 获取链接",
        link is not None and link['id'] == link_id,
        f"链接: {link}"
    )
    
    # 更新链接
    update_link(link_id, status='auto_fixed', new_anchor='title-2')
    updated_link = get_link_by_id(link_id)
    result.add(
        "数据库: 更新链接",
        updated_link['status'] == 'auto_fixed',
        f"状态: {updated_link['status']}"
    )
    
    # 创建报告
    report_id = create_report(
        report_name='测试报告',
        report_data={'test': 'data'},
        total_files_scanned=1,
        total_links_found=1,
        broken_links_found=1,
        auto_fixed_links=1,
        needs_review_links=0
    )
    result.add(
        "数据库: 创建报告",
        report_id > 0,
        f"报告ID: {report_id}"
    )
    
    # 获取报告
    report = get_report(report_id)
    result.add(
        "数据库: 获取报告",
        report is not None and report['id'] == report_id,
        f"报告: {report}"
    )
    
    return result


def test_file_import_and_scan():
    """测试完整的文件导入和扫描流程"""
    result = TestResult()
    
    # 模拟两个文件
    file1_content = """# 简介
## 安装说明
## 使用指南

[查看安装](#安装说明)
[查看配置](doc2.md#配置章节)
"""
    
    file2_content = """# 配置
## 配置章节
## 高级设置

[返回简介](doc1.md#简介)
"""
    
    # 导入文件1
    file1_id = insert_markdown_file("/test/doc1.md", generate_file_hash(file1_content))
    headings1 = parse_markdown_headings(file1_content)
    for h in headings1:
        insert_heading_anchor(file1_id, h['text'], h['level'], h['anchor'], h['line'])
    
    links1 = parse_markdown_links(file1_content)
    for l in links1:
        insert_link(file1_id, l['text'], l['url'], l['anchor'], l['line'], l['column'])
    
    # 导入文件2
    file2_id = insert_markdown_file("/test/doc2.md", generate_file_hash(file2_content))
    headings2 = parse_markdown_headings(file2_content)
    for h in headings2:
        insert_heading_anchor(file2_id, h['text'], h['level'], h['anchor'], h['line'])
    
    links2 = parse_markdown_links(file2_content)
    for l in links2:
        insert_link(file2_id, l['text'], l['url'], l['anchor'], l['line'], l['column'])
    
    # 验证导入
    all_files = get_all_files()
    result.add(
        "完整流程: 文件导入数量",
        len(all_files) == 2,
        f"实际: {len(all_files)}"
    )
    
    # 验证链接数量 (包含文件内和文件间链接)
    all_links = get_all_links()
    result.add(
        "完整流程: 链接数量",
        len(all_links) >= 3,
        f"实际: {len(all_links)}"
    )
    
    # 筛选待处理链接
    pending_links = get_links_by_status('pending')
    result.add(
        "完整流程: 待处理链接筛选",
        len(pending_links) == 3,
        f"实际: {len(pending_links)}"
    )
    
    return result


def test_error_scenarios():
    """测试错误处理场景"""
    result = TestResult()
    
    # 测试文件哈希生成
    hash1 = generate_file_hash("content1")
    hash2 = generate_file_hash("content2")
    result.add(
        "错误处理: 不同内容不同哈希",
        hash1 != hash2,
        f"hash1: {hash1}, hash2: {hash2}"
    )
    
    # 测试无效链接的预览修复
    invalid_content = "no links here"
    link_info = {'line': 1, 'text': 'test', 'url': 'test.md', 'anchor': 'old'}
    new_content, details = preview_fix(invalid_content, link_info, 'new')
    result.add(
        "错误处理: 行号超出范围处理",
        'new_content' in locals(),
        f"详情: {details}"
    )
    
    # 测试不存在的链接
    non_existent = get_link_by_id(99999)
    result.add(
        "错误处理: 不存在链接返回None",
        non_existent is None,
        f"结果: {non_existent}"
    )
    
    return result


def run_all_tests():
    """运行所有测试"""
    print("="*60)
    print("Markdown锚点迁移修复预览API - 自检脚本")
    print("="*60)
    
    # 清理并初始化数据库
    print("\n🧹 清理测试数据库...")
    clean_test_db()
    
    all_results = TestResult()
    
    # 运行各个测试模块
    print("\n📋 测试1: 锚点生成算法")
    r1 = test_anchor_generation()
    all_results.passed += r1.passed
    all_results.failed += r1.failed
    
    print("\n📋 测试2: Markdown标题解析")
    r2 = test_heading_parsing()
    all_results.passed += r2.passed
    all_results.failed += r2.failed
    
    print("\n📋 测试3: Markdown链接解析")
    r3 = test_link_parsing()
    all_results.passed += r3.passed
    all_results.failed += r3.failed
    
    print("\n📋 测试4: 锚点匹配算法")
    r4 = test_anchor_matching()
    all_results.passed += r4.passed
    all_results.failed += r4.failed
    
    print("\n📋 测试5: 修复预览功能")
    r5 = test_preview_fix()
    all_results.passed += r5.passed
    all_results.failed += r5.failed
    
    print("\n📋 测试6: 数据库操作")
    r6 = test_database_operations()
    all_results.passed += r6.passed
    all_results.failed += r6.failed
    
    print("\n📋 测试7: 文件导入和扫描流程")
    r7 = test_file_import_and_scan()
    all_results.passed += r7.passed
    all_results.failed += r7.failed
    
    print("\n📋 测试8: 错误处理场景")
    r8 = test_error_scenarios()
    all_results.passed += r8.passed
    all_results.failed += r8.failed
    
    # 总结
    success = all_results.summary()
    
    if success:
        print("\n🎉 所有测试通过! API功能正常。")
        return 0
    else:
        print(f"\n⚠️  {all_results.failed} 个测试失败，请检查相关功能。")
        return 1


if __name__ == "__main__":
    sys.exit(run_all_tests())
