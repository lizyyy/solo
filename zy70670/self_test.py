#!/usr/bin/env python3
"""
知识库失效产品状态引用统计 - 自检脚本
验证导入、筛选、处理和导出功能
"""

import os
import sys
import tempfile
import json
from io import BytesIO

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models import ProductStatus, ReferenceStatus, FailureReason, Product, Article, ArticleReference
from app import services, schemas, exporter


def print_step(step_num, title):
    print(f"\n{'='*60}")
    print(f"步骤 {step_num}: {title}")
    print('='*60)


def print_success(message):
    print(f"✓ {message}")


def print_failure(message):
    print(f"✗ {message}")


def run_tests():
    print("\n" + "="*60)
    print("知识库失效产品状态引用统计 - 自检脚本")
    print("="*60)

    test_db_path = os.path.join(tempfile.gettempdir(), "test_knowledge_base.db")
    if os.path.exists(test_db_path):
        os.remove(test_db_path)

    engine = create_engine(f"sqlite:///{test_db_path}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        print_step(1, "创建产品数据")
        
        product_service = services.ProductService(db)
        
        product1 = product_service.create_product(
            schemas.ProductCreate(name="产品A", status=ProductStatus.ACTIVE, description="这是一个活跃产品")
        )
        print_success(f"创建产品: {product1.name} (ID: {product1.id})")
        
        product2 = product_service.create_product(
            schemas.ProductCreate(name="产品B", status=ProductStatus.ACTIVE, description="即将下线的产品")
        )
        print_success(f"创建产品: {product2.name} (ID: {product2.id})")

        print_step(2, "导入测试文章")
        
        article_service = services.ArticleService(db)
        
        test_articles = [
            {
                "title": "产品A使用指南",
                "content": "# 产品A使用指南\n\n请参考[产品B配置说明](/docs/product-b-config.md)进行初始设置。\n\n更多信息请查看[官方网站](https://example.com)。",
                "file_path": "/docs/product-a-guide.md",
                "product_id": 1
            },
            {
                "title": "产品B配置说明",
                "content": "# 产品B配置说明\n\n本产品配置流程说明。",
                "file_path": "/docs/product-b-config.md",
                "product_id": 2
            },
            {
                "title": "常见问题解答",
                "content": "# 常见问题解答\n\nQ: 如何获取产品B支持？\nA: 请联系客服或查看[产品B配置说明](/docs/product-b-config.md)。",
                "file_path": "/docs/faq.md",
                "product_id": None
            }
        ]
        
        for i, article_data in enumerate(test_articles):
            article = Article(
                title=article_data["title"],
                content=article_data["content"],
                file_path=article_data["file_path"],
                product_id=product1.id if i == 0 else product2.id if i == 1 else None
            )
            db.add(article)
        db.commit()
        
        articles = db.query(Article).all()
        print_success(f"成功导入 {len(articles)} 篇测试文章")
        for article in articles:
            print_success(f"  - {article.title} (ID: {article.id})")

        print_step(3, "扫描文章链接")
        
        scanned_count, new_references, updated_references = article_service.scan_articles()
        
        print_success(f"扫描完成:")
        print_success(f"  - 扫描文章数: {scanned_count}")
        print_success(f"  - 新发现引用: {new_references}")
        print_success(f"  - 更新引用: {updated_references}")
        
        all_references = db.query(ArticleReference).all()
        print_success(f"数据库中共有 {len(all_references)} 条引用记录")
        
        resolved_refs = 0
        for ref in all_references:
            target_article_info = f", target_article_id: {ref.target_article_id}" if ref.target_article_id else ""
            print_success(f"  - 引用 {ref.id}: {ref.link_text} -> {ref.target_url}{target_article_info}")
            if ref.target_article_id:
                resolved_refs += 1
        print_success(f"成功解析 {resolved_refs}/{len(all_references)} 个内部链接到目标文章")

        print_step(4, "将产品B标记为下线状态")
        
        updated_product = product_service.update_product_status(product2.id, ProductStatus.END_OF_LIFE)
        print_success(f"产品 '{updated_product.name}' 状态已更新为: {updated_product.status.value}")
        
        invalid_references = article_service.get_invalid_references()
        print_success(f"检测到 {len(invalid_references)} 条失效引用")
        
        if len(invalid_references) == 0:
            raise AssertionError("核心测试失败：产品下线后应检测到失效引用，但 get_invalid_references() 返回空列表！")
        
        for ref in invalid_references:
            print_success(f"  - ID: {ref.id}, 状态: {ref.status.value}, 原因: {ref.failure_reason.value if ref.failure_reason else 'N/A'}")
            if ref.failure_reason != FailureReason.PRODUCT_OFFLINE:
                raise AssertionError(f"失效原因错误：期望 PRODUCT_OFFLINE，实际 {ref.failure_reason}")

        print_step(5, "按条件筛选失效引用")
        
        needs_review = article_service.get_invalid_references(
            status=ReferenceStatus.NEEDS_MANUAL_REVIEW
        )
        print_success(f"需要人工复核的引用: {len(needs_review)} 条")
        
        product_offline = article_service.get_invalid_references(
            failure_reason=FailureReason.PRODUCT_OFFLINE
        )
        print_success(f"产品下线导致的失效引用: {len(product_offline)} 条")

        print_step(6, "标记引用为已处理")
        
        if needs_review:
            ref_to_process = needs_review[0]
            print(f"处理引用 ID: {ref_to_process.id}")
            
            processed_ref = article_service.mark_as_processed(ref_to_process.id)
            print_success(f"引用状态已更新为: {processed_ref.status.value}")
            print_success(f"处理时间: {processed_ref.processed_at}")
        else:
            print("没有需要处理的引用")

        print_step(7, "生成体检报告")
        
        report = article_service.generate_health_report("full", generated_by="self_test")
        print_success(f"体检报告生成成功 (ID: {report.id})")
        print_success(f"  - 总文章数: {report.total_articles}")
        print_success(f"  - 总引用数: {report.total_references}")
        print_success(f"  - 失效引用数: {report.invalid_references}")
        print_success(f"  - 产品下线引用: {report.deprecated_product_references}")
        print_success(f"  - 需要复核数: {report.needs_review_count}")

        print_step(8, "导出报告为JSON")
        
        json_report = exporter.ReportExporter.export_health_report_to_json(report)
        print_success("JSON报告导出成功")
        print("报告内容预览:")
        print(json_report[:500] + "..." if len(json_report) > 500 else json_report)

        print_step(9, "导出失效引用为Excel")
        
        excel_data = exporter.ReportExporter.export_references_to_excel(invalid_references)
        excel_size = len(excel_data.getvalue())
        print_success(f"Excel文件生成成功，大小: {excel_size} 字节")
        
        output_path = os.path.join(os.path.dirname(__file__), "test_invalid_references.xlsx")
        with open(output_path, "wb") as f:
            f.write(excel_data.getvalue())
        print_success(f"Excel文件已保存到: {output_path}")

        print_step(10, "导出统计数据为Excel")
        
        stats_excel = exporter.ReportExporter.export_statistics_to_excel(db)
        stats_size = len(stats_excel.getvalue())
        print_success(f"统计Excel文件生成成功，大小: {stats_size} 字节")
        
        stats_output_path = os.path.join(os.path.dirname(__file__), "test_statistics.xlsx")
        with open(stats_output_path, "wb") as f:
            f.write(stats_excel.getvalue())
        print_success(f"统计Excel文件已保存到: {stats_output_path}")

        print("\n" + "="*60)
        print("所有测试完成！")
        print("="*60)
        print("\n测试摘要:")
        print(f"  ✓ 产品创建: 成功")
        print(f"  ✓ 文章导入: 成功 ({len(articles)} 篇)")
        print(f"  ✓ 链接扫描: 成功 ({new_references} 条新引用)")
        print(f"  ✓ 状态更新: 成功 (产品下线检测)")
        print(f"  ✓ 筛选功能: 成功 (按状态/原因筛选)")
        print(f"  ✓ 处理标记: 成功")
        print(f"  ✓ 体检报告: 成功")
        print(f"  ✓ JSON导出: 成功")
        print(f"  ✓ Excel导出: 成功")
        print("\n自检全部通过！系统运行正常。\n")

    except Exception as e:
        print_failure(f"测试过程中发生错误: {str(e)}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()
        if os.path.exists(test_db_path):
            os.remove(test_db_path)
            print(f"测试数据库已清理: {test_db_path}")


if __name__ == "__main__":
    run_tests()
