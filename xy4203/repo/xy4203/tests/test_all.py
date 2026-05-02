#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试模块 - 单元测试和集成测试
"""

import os
import sys
import tempfile
import shutil
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any

import numpy as np
import cv2


def run_all_tests():
    """
    运行所有测试
    
    Returns:
        (是否全部通过, 测试结果列表)
    """
    print("=" * 60)
    print("运行修复前后影像比对台测试")
    print("=" * 60)
    
    test_results = []
    all_passed = True
    
    # 临时目录
    temp_dir = tempfile.mkdtemp(prefix="test_")
    
    try:
        # 测试1: 持久化模块
        print("\n[测试1] 持久化模块测试...")
        passed, result = test_persistence(temp_dir)
        test_results.append(("持久化模块", passed, result))
        if not passed:
            all_passed = False
        print(f"  结果: {'通过' if passed else '失败'} - {result}")
        
        # 测试2: CSV解析模块
        print("\n[测试2] CSV解析模块测试...")
        passed, result = test_csv_parser(temp_dir)
        test_results.append(("CSV解析模块", passed, result))
        if not passed:
            all_passed = False
        print(f"  结果: {'通过' if passed else '失败'} - {result}")
        
        # 测试3: 图像处理模块
        print("\n[测试3] 图像处理模块测试...")
        passed, result = test_image_processing(temp_dir)
        test_results.append(("图像处理模块", passed, result))
        if not passed:
            all_passed = False
        print(f"  结果: {'通过' if passed else '失败'} - {result}")
        
        # 测试4: 规则引擎模块
        print("\n[测试4] 规则引擎模块测试...")
        passed, result = test_rule_engine()
        test_results.append(("规则引擎模块", passed, result))
        if not passed:
            all_passed = False
        print(f"  结果: {'通过' if passed else '失败'} - {result}")
        
        # 测试5: 导出模块
        print("\n[测试5] 导出模块测试...")
        passed, result = test_export(temp_dir)
        test_results.append(("导出模块", passed, result))
        if not passed:
            all_passed = False
        print(f"  结果: {'通过' if passed else '失败'} - {result}")
        
        # 测试6: 示例数据生成器
        print("\n[测试6] 示例数据生成器测试...")
        passed, result = test_sample_data(temp_dir)
        test_results.append(("示例数据生成器", passed, result))
        if not passed:
            all_passed = False
        print(f"  结果: {'通过' if passed else '失败'} - {result}")
        
    finally:
        # 清理临时目录
        shutil.rmtree(temp_dir, ignore_errors=True)
    
    # 输出汇总
    print("\n" + "=" * 60)
    print("测试汇总")
    print("=" * 60)
    
    for name, passed, result in test_results:
        status = "✓ 通过" if passed else "✗ 失败"
        print(f"{name}: {status}")
    
    print("\n" + "=" * 60)
    if all_passed:
        print("所有测试通过! ✓")
    else:
        print("部分测试失败! ✗")
    print("=" * 60)
    
    return all_passed, test_results


def test_persistence(temp_dir: str) -> tuple:
    """测试持久化模块"""
    try:
        from persistence.data_store import DataStore, ProjectData, ManualAnnotation, ReviewRecord
        
        # 创建数据存储
        data_dir = os.path.join(temp_dir, "test_data")
        store = DataStore(data_dir)
        
        # 测试创建项目
        project = store.create_project("测试项目", "这是一个测试项目")
        
        if project.project_name != "测试项目":
            return False, "项目名称不正确"
        
        if not project.project_id:
            return False, "项目ID为空"
        
        # 测试添加图像路径
        store.add_image_paths(1, "/path/to/before.jpg", "/path/to/after.jpg")
        store.add_image_paths(2, "/path/to/before2.jpg", "/path/to/after2.jpg")
        
        if len(store.current_project.page_numbers) != 2:
            return False, "页码数量不正确"
        
        # 测试保存和加载
        store.save_project()
        project_id = project.project_id
        
        # 创建新的存储实例并加载
        store2 = DataStore(data_dir)
        loaded_project = store2.load_project(project_id)
        
        if loaded_project is None:
            return False, "项目加载失败"
        
        if loaded_project.project_name != "测试项目":
            return False, "加载的项目名称不正确"
        
        # 测试列出项目
        projects = store2.list_projects()
        if len(projects) != 1:
            return False, "项目列表数量不正确"
        
        # 测试ManualAnnotation
        annotation = ManualAnnotation(
            id="test_ann_1",
            page_number=1,
            annotation_type="rectangle",
            coordinates=[{"x": 10, "y": 10}, {"x": 100, "y": 10}, {"x": 100, "y": 50}, {"x": 10, "y": 50}],
            width=90,
            height=40,
            area=3600,
            label="测试标注"
        )
        
        store2.add_manual_annotation(1, annotation)
        
        annotations = store2.get_manual_annotations(1)
        if len(annotations) != 1:
            return False, "人工标注数量不正确"
        
        # 测试ReviewRecord
        review = ReviewRecord(
            page_number=1,
            review_status="已通过",
            reviewer_name="测试员",
            review_notes="测试复核备注"
        )
        
        store2.update_review_record(1, review)
        
        loaded_review = store2.get_review_record(1)
        if loaded_review is None:
            return False, "复核记录加载失败"
        
        # 测试添加问题
        issue = {
            "type": "page",
            "severity": "high",
            "page_number": 1,
            "message": "测试问题"
        }
        
        store2.add_issue(issue)
        
        if len(store2.current_project.issues) != 1:
            return False, "问题数量不正确"
        
        return True, "所有持久化测试通过"
        
    except Exception as e:
        return False, f"测试异常: {str(e)}"


def test_csv_parser(temp_dir: str) -> tuple:
    """测试CSV解析模块"""
    try:
        from annotation_parser.csv_parser import CSVParser, DefectAnnotation, MaterialRecord
        
        parser = CSVParser()
        
        # 创建测试病害标注CSV
        defect_csv_path = os.path.join(temp_dir, "test_defects.csv")
        defect_content = """id,page_number,defect_type,position_x,position_y,width,height,area,severity,description
defect_1,1,孔洞,200,300,50,50,2500,高,测试孔洞
defect_2,1,污渍,400,500,60,40,2400,中,测试污渍
defect_3,2,褶皱,150,200,100,30,3000,低,测试褶皱
"""
        
        with open(defect_csv_path, 'w', encoding='utf-8') as f:
            f.write(defect_content)
        
        # 解析CSV
        defects = parser.parse_defect_csv(defect_csv_path)
        
        if len(defects) != 3:
            return False, f"解析的病害数量不正确: 期望3, 实际{len(defects)}"
        
        if defects[0].defect_type != "孔洞":
            return False, "病害类型解析不正确"
        
        if defects[0].area != 2500:
            return False, f"面积解析不正确: 期望2500, 实际{defects[0].area}"
        
        # 测试按页码获取
        page1_defects = parser.get_defects_by_page(1)
        if len(page1_defects) != 2:
            return False, f"第1页病害数量不正确: 期望2, 实际{len(page1_defects)}"
        
        # 测试获取页码
        pages = parser.get_page_numbers()
        if set(pages) != {1, 2}:
            return False, f"页码列表不正确: {pages}"
        
        # 创建测试材料记录CSV
        material_csv_path = os.path.join(temp_dir, "test_materials.csv")
        material_content = """id,page_number,material_type,material_name,quantity,unit,usage_area,technician
mat_1,1,补纸,宣纸,1,张,3000,张修复师
mat_2,2,补纸,皮纸,2,张,5000,李修复师
"""
        
        with open(material_csv_path, 'w', encoding='utf-8') as f:
            f.write(material_content)
        
        # 解析材料记录
        materials = parser.parse_material_csv(material_csv_path)
        
        if len(materials) != 2:
            return False, f"解析的材料记录数量不正确: 期望2, 实际{len(materials)}"
        
        if materials[0].material_name != "宣纸":
            return False, "材料名称解析不正确"
        
        # 测试验证
        validation_issues = parser.validate_defect_annotations()
        # 应该没有严重问题
        
        # 测试获取病害类型
        types = parser.get_defect_types()
        if "孔洞" not in types or "污渍" not in types or "褶皱" not in types:
            return False, f"病害类型列表不正确: {types}"
        
        return True, "所有CSV解析测试通过"
        
    except Exception as e:
        return False, f"测试异常: {str(e)}"


def test_image_processing(temp_dir: str) -> tuple:
    """测试图像处理模块"""
    try:
        from image_processing.comparator import ImageComparator
        from image_processing.defect_analyzer import DefectAnalyzer
        from image_processing.color_analyzer import ColorAnalyzer
        
        # 创建测试图像
        img_before = np.full((100, 100, 3), (200, 220, 240), dtype=np.uint8)
        img_after = np.full((100, 100, 3), (200, 220, 240), dtype=np.uint8)
        
        # 在修复前图像上添加一个"缺陷"
        cv2.circle(img_before, (50, 50), 20, (50, 50, 50), -1)
        
        # 保存测试图像
        before_path = os.path.join(temp_dir, "test_before.jpg")
        after_path = os.path.join(temp_dir, "test_after.jpg")
        
        cv2.imwrite(before_path, img_before)
        cv2.imwrite(after_path, img_after)
        
        # 测试ImageComparator
        comparator = ImageComparator()
        
        if not comparator.load_images(before_path, after_path):
            return False, "图像加载失败"
        
        # 测试并排显示
        side_by_side = comparator.get_side_by_side()
        if side_by_side.shape[1] != 200:  # 两张100宽的图像并排
            return False, f"并排图像宽度不正确: 期望200, 实际{side_by_side.shape[1]}"
        
        # 测试叠加显示
        overlay = comparator.get_overlay(0.5)
        if overlay.shape != (100, 100, 3):
            return False, f"叠加图像形状不正确"
        
        # 测试差异图
        diff = comparator.get_difference_map()
        if diff.shape != (100, 100, 3):
            return False, f"差异图形状不正确"
        
        # 测试图像尺寸
        width, height = comparator.get_image_size()
        if width != 100 or height != 100:
            return False, f"图像尺寸不正确: 期望(100,100), 实际({width},{height})"
        
        # 测试DefectAnalyzer
        analyzer = DefectAnalyzer()
        
        if not analyzer.load_images(before_path, after_path):
            return False, "缺损分析器图像加载失败"
        
        # 测试缺损检测
        defects_before = analyzer.detect_defects(img_before)
        # 应该能检测到我们创建的缺陷
        
        # 测试缺损变化分析
        analysis = analyzer.analyze_defect_changes()
        
        if "statistics" not in analysis:
            return False, "缺损分析结果缺少statistics字段"
        
        if "defects_before" not in analysis:
            return False, "缺损分析结果缺少defects_before字段"
        
        # 测试ColorAnalyzer
        color_analyzer = ColorAnalyzer()
        
        if not color_analyzer.load_images(before_path, after_path):
            return False, "色差分析器图像加载失败"
        
        # 测试颜色变化分析
        color_analysis = color_analyzer.analyze_color_changes()
        
        if "statistics" not in color_analysis:
            return False, "颜色分析结果缺少statistics字段"
        
        if "abnormal_regions" not in color_analysis:
            return False, "颜色分析结果缺少abnormal_regions字段"
        
        return True, "所有图像处理测试通过"
        
    except Exception as e:
        return False, f"测试异常: {str(e)}"


def test_rule_engine() -> tuple:
    """测试规则引擎模块"""
    try:
        from rule_engine.page_checker import PageChecker, PageIssue
        from rule_engine.area_calculator import AreaCalculator, AreaIssue
        from rule_engine.color_checker import ColorChecker, ColorIssue
        
        # 测试PageChecker
        page_checker = PageChecker()
        
        # 测试页码序列检查
        pages = [1, 2, 3, 5, 6]  # 缺少4
        issues = page_checker.check_page_sequence(pages)
        
        if len(issues) == 0:
            return False, "应该检测到页码缺失"
        
        # 检查是否检测到缺失的页码4
        has_gap_issue = any("缺失" in issue.message for issue in issues)
        if not has_gap_issue:
            return False, "未检测到页码缺失"
        
        # 测试重复页码
        pages_with_duplicates = [1, 2, 2, 3, 4]
        issues = page_checker.check_page_sequence(pages_with_duplicates)
        
        has_duplicate_issue = any("重复" in issue.message for issue in issues)
        if not has_duplicate_issue:
            return False, "未检测到重复页码"
        
        # 测试从文件名提取页码
        test_filenames = [
            "page_001_before.jpg",
            "修复后_第2页.jpg",
            "image_3_after.tif",
            "页5_扫描件.png"
        ]
        
        expected_pages = [1, 2, 3, 5]
        for filename, expected in zip(test_filenames, expected_pages):
            result = page_checker.extract_page_number_from_filename(filename)
            if result != expected:
                return False, f"文件名 '{filename}' 提取页码失败: 期望{expected}, 实际{result}"
        
        # 测试页码统计
        stats = page_checker.get_page_statistics([1, 2, 3, 4, 5])
        if stats["unique_count"] != 5:
            return False, f"页码统计不正确"
        
        # 测试AreaCalculator
        area_calculator = AreaCalculator()
        
        # 测试IOU计算
        bbox1 = (100, 100, 50, 50)  # x, y, w, h
        bbox2 = (110, 110, 50, 50)  # 有重叠
        bbox3 = (200, 200, 50, 50)  # 无重叠
        
        iou1 = area_calculator._calculate_iou(bbox1, bbox2)
        if iou1 <= 0:
            return False, "重叠边界框的IOU应该大于0"
        
        iou2 = area_calculator._calculate_iou(bbox1, bbox3)
        if iou2 != 0:
            return False, "不重叠边界框的IOU应该为0"
        
        # 测试标注与实际比较
        annotated_defects = [
            {
                "id": "defect_1",
                "area": 2500,
                "bounding_box": (100, 100, 50, 50)
            }
        ]
        
        detected_defects = [
            {
                "area": 2000,
                "bounding_box": (105, 105, 45, 45)
            }
        ]
        
        issues = area_calculator.compare_annotation_vs_actual(
            annotated_defects, detected_defects, 800, 600
        )
        # 应该返回一些比较结果
        
        # 测试ColorChecker
        color_checker = ColorChecker()
        
        # 创建测试图像
        img1 = np.full((100, 100, 3), (200, 220, 240), dtype=np.uint8)
        img2 = np.full((100, 100, 3), (150, 170, 200), dtype=np.uint8)  # 颜色有差异
        
        # 测试颜色变化检查
        color_issues = color_checker.check_color_changes(img1, img2, page_number=1)
        
        # 颜色差异明显，应该有问题
        if len(color_issues) == 0:
            return False, "应该检测到颜色差异"
        
        # 测试严重程度判断
        severity = color_checker._get_severity(15.0)  # 超过critical阈值
        if severity != "high":
            return False, f"严重程度判断错误: 期望high, 实际{severity}"
        
        return True, "所有规则引擎测试通过"
        
    except Exception as e:
        return False, f"测试异常: {str(e)}"


def test_export(temp_dir: str) -> tuple:
    """测试导出模块"""
    try:
        from export.markdown_exporter import MarkdownExporter
        from export.csv_exporter import CSVExporter
        from export.json_exporter import JSONExporter
        from persistence.data_store import DataStore, ProjectData
        
        # 创建测试项目
        data_dir = os.path.join(temp_dir, "export_test_data")
        store = DataStore(data_dir)
        
        project = store.create_project("导出测试项目", "用于测试导出功能的项目")
        project.page_numbers = [1, 2, 3]
        project.before_image_paths = {1: "/test/before1.jpg", 2: "/test/before2.jpg", 3: "/test/before3.jpg"}
        project.after_image_paths = {1: "/test/after1.jpg", 2: "/test/after2.jpg", 3: "/test/after3.jpg"}
        
        # 添加一些问题
        issues = [
            {
                "id": "issue_1",
                "type": "page",
                "severity": "high",
                "page_number": 1,
                "message": "页码检测异常",
                "timestamp": datetime.now().isoformat(),
                "reviewed": False
            },
            {
                "id": "issue_2",
                "type": "color",
                "severity": "medium",
                "page_number": 2,
                "message": "色差超过阈值",
                "timestamp": datetime.now().isoformat(),
                "reviewed": False
            }
        ]
        
        project.issues = issues
        store.save_project()
        
        # 测试Markdown导出
        md_exporter = MarkdownExporter()
        md_path = os.path.join(temp_dir, "test_report.md")
        
        if not md_exporter.export(project, md_path):
            return False, "Markdown导出失败"
        
        if not os.path.exists(md_path):
            return False, "Markdown文件未创建"
        
        # 验证文件内容
        with open(md_path, 'r', encoding='utf-8') as f:
            md_content = f.read()
        
        if "导出测试项目" not in md_content:
            return False, "Markdown内容缺少项目名称"
        
        if "页码检测异常" not in md_content:
            return False, "Markdown内容缺少问题描述"
        
        # 测试CSV导出
        csv_exporter = CSVExporter()
        csv_path = os.path.join(temp_dir, "test_issues.csv")
        
        if not csv_exporter.export_issues(project, csv_path):
            return False, "CSV导出失败"
        
        if not os.path.exists(csv_path):
            return False, "CSV文件未创建"
        
        # 测试统计信息导出
        csv_stats_path = os.path.join(temp_dir, "test_stats.csv")
        csv_exporter.export_statistics(project, csv_stats_path)
        
        # 测试JSON导出
        json_exporter = JSONExporter()
        json_path = os.path.join(temp_dir, "test_audit.json")
        
        if not json_exporter.export(project, json_path):
            return False, "JSON导出失败"
        
        if not os.path.exists(json_path):
            return False, "JSON文件未创建"
        
        # 验证JSON内容
        import json
        with open(json_path, 'r', encoding='utf-8') as f:
            json_data = json.load(f)
        
        if "project" not in json_data:
            return False, "JSON内容缺少project字段"
        
        if "issues" not in json_data:
            return False, "JSON内容缺少issues字段"
        
        if "statistics" not in json_data:
            return False, "JSON内容缺少statistics字段"
        
        # 测试JSON摘要导出
        json_summary_path = os.path.join(temp_dir, "test_summary.json")
        json_exporter.export_summary(project, json_summary_path)
        
        return True, "所有导出模块测试通过"
        
    except Exception as e:
        return False, f"测试异常: {str(e)}"


def test_sample_data(temp_dir: str) -> tuple:
    """测试示例数据生成器"""
    try:
        from sample_data.generator import SampleDataGenerator, create_sample_data
        
        # 测试创建示例数据
        result = create_sample_data(temp_dir)
        
        if "before_images" not in result:
            return False, "示例数据结果缺少before_images"
        
        if "after_images" not in result:
            return False, "示例数据结果缺少after_images"
        
        if "defect_csv" not in result:
            return False, "示例数据结果缺少defect_csv"
        
        if "material_csv" not in result:
            return False, "示例数据结果缺少material_csv"
        
        # 验证生成的文件
        for img_path in result["before_images"]:
            if not os.path.exists(img_path):
                return False, f"生成的图像不存在: {img_path}"
            
            # 验证图像可以正常读取
            img = cv2.imread(img_path)
            if img is None:
                return False, f"生成的图像无法读取: {img_path}"
        
        for img_path in result["after_images"]:
            if not os.path.exists(img_path):
                return False, f"生成的图像不存在: {img_path}"
            
            img = cv2.imread(img_path)
            if img is None:
                return False, f"生成的图像无法读取: {img_path}"
        
        # 验证CSV文件
        if not os.path.exists(result["defect_csv"]):
            return False, f"生成的病害CSV不存在: {result['defect_csv']}"
        
        if not os.path.exists(result["material_csv"]):
            return False, f"生成的材料CSV不存在: {result['material_csv']}"
        
        # 测试获取示例信息
        generator = SampleDataGenerator(temp_dir)
        info = generator.get_sample_info()
        
        if "output_directory" not in info:
            return False, "示例信息缺少output_directory"
        
        if "expected_files" not in info:
            return False, "示例信息缺少expected_files"
        
        # 测试生成不同页数的示例数据
        generator2 = SampleDataGenerator(os.path.join(temp_dir, "more_pages"))
        result2 = generator2.generate_all_samples(num_pages=5)
        
        if len(result2["before_images"]) != 5:
            return False, f"生成的图像数量不正确: 期望5, 实际{len(result2['before_images'])}"
        
        return True, "所有示例数据生成器测试通过"
        
    except Exception as e:
        return False, f"测试异常: {str(e)}"


if __name__ == "__main__":
    run_all_tests()
