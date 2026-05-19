#!/usr/bin/env python3
import sys
import os
import json
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, init_db, ChangeLog, ProcessingStatus, RiskLevel
from processor import ChangeLogProcessor, ExportService, MarkdownParser, TagExtractor, RiskAnalyzer


TEST_CHANGELOGS = [
    {
        "title": "v2.0.0 重大版本更新",
        "content": """
# v2.0.0 重大版本更新

## 重要提示
- ⚠️ **废弃**: 旧版用户认证接口 /api/v1/auth/login 将于30天后移除，请尽快迁移
- ⚠️ **不兼容变更**: 用户信息接口返回格式修改，移除了多余字段

## API变更
### 移除接口
- DELETE /api/v1/users/{id} - 删除用户功能已废弃，请使用新的批量操作接口

### 修改接口
- POST /api/v2/auth/login - 新增MFA支持，返回字段变更
- GET /api/v2/users/{id} - 用户信息字段优化
- PUT /api/v2/orders/{id} - 订单更新接口新增状态校验

## 功能变更
- 用户模块: 新增双因素认证功能，优化登录流程
- 订单模块: 修复支付状态不同步问题
- 性能优化: API响应速度提升50%

## 客户影响
请所有开发者在两周内完成接口迁移，企业客户请联系客户经理获取支持方案
        """.strip()
    },
    {
        "title": "v1.5.0 常规功能更新",
        "content": """
# v1.5.0 常规更新

## 新增功能
- GET /api/v1/products/search - 商品搜索接口
- POST /api/v1/coupons - 优惠券创建接口

## 优化
- 优化商品列表加载速度
- 修复报表导出功能bug
        """.strip()
    },
    {
        "title": "v1.4.2 安全补丁",
        "content": """
# v1.4.2 安全补丁更新

## 修复内容
- 修复权限验证漏洞
- 加密算法升级
- 修改用户密码重置逻辑
        """.strip()
    }
]


class SelfCheckTester:
    def __init__(self):
        self.db = SessionLocal()
        self.passed = 0
        self.failed = 0
        self.results = []
    
    def log(self, test_name, status, message=""):
        status_icon = "✅" if status else "❌"
        print(f"{status_icon} {test_name}")
        if message:
            print(f"   {message}")
        
        if status:
            self.passed += 1
        else:
            self.failed += 1
        
        self.results.append({
            "test": test_name,
            "status": "PASSED" if status else "FAILED",
            "message": message
        })
    
    def test_1_database_init(self):
        try:
            init_db()
            self.log("数据库初始化", True)
        except Exception as e:
            self.log("数据库初始化", False, str(e))
    
    def test_2_markdown_parsing(self):
        try:
            content = TEST_CHANGELOGS[0]["content"]
            
            headings = MarkdownParser.parse_headings(content)
            assert len(headings) > 0, "应解析出标题"
            
            list_items = MarkdownParser.parse_list_items(content)
            assert len(list_items) > 0, "应解析出列表项"
            
            interfaces = MarkdownParser.extract_interfaces(content)
            assert len(interfaces) >= 4, f"应至少解析出4个接口，实际: {len(interfaces)}"
            
            version = MarkdownParser.extract_version(content)
            assert version == "2.0.0" or version == "v2.0.0", f"版本号解析错误: {version}"
            
            self.log("Markdown解析", True, f"解析到 {len(interfaces)} 个接口")
        except Exception as e:
            self.log("Markdown解析", False, str(e))
    
    def test_3_tag_extraction(self):
        try:
            content = TEST_CHANGELOGS[0]["content"]
            tags = TagExtractor.extract_tags(content)
            
            assert len(tags) > 0, "应提取出标签"
            
            tag_names = [t["tag_name"] for t in tags]
            assert "用户" in tag_names, "应包含用户标签"
            assert "API" in tag_names, "应包含API标签"
            
            self.log("标签提取", True, f"提取到 {len(tags)} 个标签: {tag_names}")
        except Exception as e:
            self.log("标签提取", False, str(e))
    
    def test_4_risk_analysis(self):
        try:
            risk_words = [
                {"risk_level": RiskLevel.CRITICAL},
                {"risk_level": RiskLevel.HIGH}
            ]
            risk_level = RiskAnalyzer.calculate_risk_level(risk_words)
            assert risk_level == RiskLevel.CRITICAL, "风险等级应为CRITICAL"
            
            needs_review = RiskAnalyzer.needs_human_review(RiskLevel.CRITICAL, 5, 3)
            assert needs_review == True, "高风险应需要人工复核"
            
            self.log("风险分析", True, f"最高风险等级: {risk_level.value}")
        except Exception as e:
            self.log("风险分析", False, str(e))
    
    def test_5_import_changelog(self):
        try:
            changelog_ids = []
            for test_data in TEST_CHANGELOGS:
                db_changelog = ChangeLog(
                    title=test_data["title"],
                    content=test_data["content"]
                )
                self.db.add(db_changelog)
                self.db.commit()
                self.db.refresh(db_changelog)
                changelog_ids.append(db_changelog.id)
            
            assert len(changelog_ids) == 3, "应导入3条变更日志"
            self.test_changelog_ids = changelog_ids
            
            self.log("变更日志导入", True, f"导入了 {len(changelog_ids)} 条记录")
        except Exception as e:
            self.log("变更日志导入", False, str(e))
    
    def test_6_process_changelog(self):
        try:
            changelog_id = self.test_changelog_ids[0]
            processor = ChangeLogProcessor(self.db)
            result = processor.process_changelog(changelog_id)
            
            assert result.status in [ProcessingStatus.PROCESSED, ProcessingStatus.NEEDS_REVIEW], "处理状态异常"
            assert result.risk_level == RiskLevel.CRITICAL, f"风险等级应为CRITICAL，实际: {result.risk_level}"
            assert result.needs_human_review == True, "高风险变更应需要人工复核"
            assert len(result.interfaces) >= 4, "应关联至少4个接口"
            assert len(result.tags) >= 2, "应至少有2个标签"
            assert len(result.customer_impacts) >= 1, "应生成客户影响分析"
            assert len(result.risk_words) >= 3, "应匹配到风险词"
            
            self.log("变更日志处理", True, 
                f"状态: {result.status.value}, 风险: {result.risk_level.value}, "
                f"接口: {len(result.interfaces)}, 标签: {len(result.tags)}")
        except Exception as e:
            self.log("变更日志处理", False, str(e))
    
    def test_7_process_other_changelogs(self):
        try:
            processor = ChangeLogProcessor(self.db)
            
            result2 = processor.process_changelog(self.test_changelog_ids[1])
            assert result2.risk_level == RiskLevel.LOW, f"第二个日志风险等级应为LOW，实际: {result2.risk_level}"
            assert result2.needs_human_review == False, "低风险变更不需要人工复核"
            
            result3 = processor.process_changelog(self.test_changelog_ids[2])
            assert result3.risk_level in [RiskLevel.MEDIUM, RiskLevel.HIGH], f"第三个日志风险等级异常: {result3.risk_level}"
            
            self.log("多日志处理", True, 
                f"v1.5.0风险: {result2.risk_level.value}, v1.4.2风险: {result3.risk_level.value}")
        except Exception as e:
            self.log("多日志处理", False, str(e))
    
    def test_8_filter_and_query(self):
        try:
            changelogs = self.db.query(ChangeLog).filter_by(status=ProcessingStatus.PROCESSED).all()
            assert len(changelogs) >= 1, "应查询到已处理的日志"
            
            high_risk = self.db.query(ChangeLog).filter_by(risk_level=RiskLevel.CRITICAL).all()
            assert len(high_risk) >= 1, "应查询到高风险日志"
            
            needs_review = self.db.query(ChangeLog).filter_by(needs_human_review=True).all()
            assert len(needs_review) >= 1, "应查询到需要复核的日志"
            
            self.log("筛选查询", True, 
                f"已处理: {len(changelogs)}, 高风险: {len(high_risk)}, 待复核: {len(needs_review)}")
        except Exception as e:
            self.log("筛选查询", False, str(e))
    
    def test_9_export_service(self):
        try:
            changelog = self.db.query(ChangeLog).filter_by(id=self.test_changelog_ids[0]).first()
            exported = ExportService.export_to_dict(changelog)
            
            assert "id" in exported
            assert "title" in exported
            assert "risk_level" in exported
            assert "interfaces" in exported
            assert "customer_impacts" in exported
            assert exported["id"] == self.test_changelog_ids[0]
            
            self.log("导出服务", True, "导出数据结构完整")
        except Exception as e:
            self.log("导出服务", False, str(e))
    
    def test_10_error_cases(self):
        try:
            processor = ChangeLogProcessor(self.db)
            
            try:
                processor.process_changelog(self.test_changelog_ids[0])
                self.log("重复处理检测", False, "未检测到重复处理")
            except ValueError as e:
                assert "already processed" in str(e).lower() or "已经处理" in str(e), "错误信息不正确"
                self.log("重复处理检测", True, "正确拒绝重复处理")
            
            try:
                processor.process_changelog(999999)
                self.log("不存在日志处理", False, "未检测到不存在的日志")
            except ValueError as e:
                assert "not found" in str(e).lower() or "不存在" in str(e), "错误信息不正确"
                self.log("不存在日志处理", True, "正确处理不存在的日志")
                
        except Exception as e:
            self.log("错误场景处理", False, str(e))
    
    def cleanup(self):
        for test_data in TEST_CHANGELOGS:
            self.db.query(ChangeLog).filter_by(title=test_data["title"]).delete()
        self.db.commit()
        self.db.close()
        
        db_path = os.path.join(os.path.dirname(__file__), "changelog_impact.db")
        if os.path.exists(db_path):
            os.remove(db_path)
    
    def run_all_tests(self):
        print("\n" + "="*60)
        print("变更日志影响抽取风险分级系统 - 自检脚本")
        print("="*60 + "\n")
        
        self.test_1_database_init()
        self.test_2_markdown_parsing()
        self.test_3_tag_extraction()
        self.test_4_risk_analysis()
        self.test_5_import_changelog()
        self.test_6_process_changelog()
        self.test_7_process_other_changelogs()
        self.test_8_filter_and_query()
        self.test_9_export_service()
        self.test_10_error_cases()
        
        print("\n" + "="*60)
        print(f"测试结果: 通过 {self.passed}, 失败 {self.failed}")
        print("="*60)
        
        if self.failed > 0:
            print("\n失败的测试:")
            for r in self.results:
                if r["status"] == "FAILED":
                    print(f"  - {r['test']}: {r['message']}")
        
        self.cleanup()
        
        return self.failed == 0


if __name__ == "__main__":
    tester = SelfCheckTester()
    success = tester.run_all_tests()
    
    sys.exit(0 if success else 1)
