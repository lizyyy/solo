#!/usr/bin/env python3
import os
import re
import json
import shutil
import hashlib
from datetime import datetime
from typing import List, Dict, Any, Optional

import click
from dateutil import parser as date_parser


STATE_FILE = ".kb_checker_state.json"


class KnowledgeBaseChecker:
    def __init__(self, kb_path_str):
        self.kb_path_str = kb_path_str
        self.kb_path = os.path.abspath(kb_path_str)
        self.state_file = os.path.join(self.kb_path, STATE_FILE)
        self.state = self._load_state()

    def _load_state(self):
        if os.path.exists(self.state_file):
            with open(self.state_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {
            "articles": {},
            "risks": [],
            "last_scan": None
        }

    def _save_state(self):
        with open(self.state_file, 'w', encoding='utf-8') as f:
            json.dump(self.state, f, ensure_ascii=False, indent=2)

    def _parse_article(self, file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        metadata = {}
        
        price_match = re.search(r'价格[：:]\s*(.+?)(?:\n|$)', content)
        if price_match:
            metadata['price'] = price_match.group(1).strip()
        
        effect_date_match = re.search(r'(?:政策生效日期|生效日期)[：:]\s*(.+?)(?:\n|$)', content)
        if effect_date_match:
            try:
                metadata['effect_date'] = date_parser.parse(
                    effect_date_match.group(1).strip()
                ).strftime('%Y-%m-%d')
            except:
                metadata['effect_date'] = effect_date_match.group(1).strip()
        
        owner_match = re.search(r'(?:负责人|作者)[：:]\s*(.+?)(?:\n|$)', content)
        if owner_match:
            metadata['owner'] = owner_match.group(1).strip()
        
        business_line_match = re.search(r'(?:关联业务线|业务线)[：:]\s*(.+?)(?:\n|$)', content)
        if business_line_match:
            metadata['business_line'] = [
                bl.strip() 
                for bl in re.split(r'[,，、]', business_line_match.group(1))
                if bl.strip()
            ]
        
        screenshots_match = re.search(r'(?:截图说明|截图)[：:]\s*(.+?)(?:\n|$)', content)
        if screenshots_match:
            metadata['screenshots'] = [
                s.strip() 
                for s in re.split(r'[,，、]', screenshots_match.group(1))
                if s.strip()
            ]
        
        ref_pattern = r'\[(.+?)\]\((.+?)\)'
        metadata['references'] = [
            title for title, _ in re.findall(ref_pattern, content)
        ]
        
        title_match = re.search(r'^#\s+(.+?)(?:\n|$)', content, re.MULTILINE)
        metadata['title'] = title_match.group(1).strip() if title_match else os.path.basename(file_path).replace('.md', '')
        
        return metadata

    def _generate_risk_id(self, file_path, risk_type):
        abs_path = os.path.abspath(file_path)
        content = "{}:{}".format(abs_path, risk_type)
        return hashlib.md5(content.encode('utf-8')).hexdigest()[:16]

    def _detect_risks(self, file_path, metadata):
        risks = []
        today = datetime.now()

        if 'effect_date' in metadata:
            try:
                effect_date = datetime.strptime(metadata['effect_date'], '%Y-%m-%d')
                if effect_date < today:
                    risks.append({
                        'type': 'expired_policy',
                        'description': "政策已过期，生效日期为 {}".format(metadata['effect_date']),
                        'suggested_owner': metadata.get('owner', '未知负责人'),
                        'severity': 'high'
                    })
            except:
                pass
        
        if 'owner' not in metadata or not metadata['owner']:
            risks.append({
                'type': 'missing_owner',
                'description': '缺少负责人信息',
                'suggested_owner': '知识库管理员',
                'severity': 'medium'
            })
        
        ref_count = len(metadata.get('references', []))
        if ref_count >= 5:
            risks.append({
                'type': 'high_ref_not_revised',
                'description': "被高频引用（{}次）但未标记修订".format(ref_count),
                'suggested_owner': metadata.get('owner', '未知负责人'),
                'severity': 'medium',
                'ref_count': ref_count
            })
        
        if 'business_line' not in metadata or not metadata['business_line']:
            risks.append({
                'type': 'missing_business_line',
                'description': '缺少关联业务线信息',
                'suggested_owner': metadata.get('owner', '知识库管理员'),
                'severity': 'low'
            })
        
        return risks

    def _get_relative_path(self, file_path):
        return os.path.relpath(file_path, self.kb_path)

    def _update_risk_state(self, file_path, risks):
        file_key = self._get_relative_path(file_path)
        
        old_risk_ids = set()
        for risk in self.state['risks']:
            if risk.get('article_path') == file_key:
                old_risk_ids.add(risk['risk_id'])
        
        for risk_data in risks:
            risk_id = self._generate_risk_id(file_path, risk_data['type'])
            
            existing = None
            for r in self.state['risks']:
                if r['risk_id'] == risk_id:
                    existing = r
                    break
            
            if existing:
                old_risk_ids.discard(risk_id)
                if existing['status'] == 'confirmed':
                    existing['status'] = 're-expired'
                    existing['description'] = risk_data['description']
                    existing['updated_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            else:
                self.state['risks'].append({
                    'risk_id': risk_id,
                    'article_path': file_key,
                    'article_title': self.state['articles'][file_key].get('title', ''),
                    'type': risk_data['type'],
                    'description': risk_data['description'],
                    'suggested_owner': risk_data['suggested_owner'],
                    'severity': risk_data['severity'],
                    'ref_count': risk_data.get('ref_count', 0),
                    'status': 'pending',
                    'created_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                    'updated_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                })
        
        new_risks = []
        for r in self.state['risks']:
            if r['risk_id'] not in old_risk_ids:
                new_risks.append(r)
        self.state['risks'] = new_risks

    def scan(self):
        click.echo("正在扫描知识库目录: {}".format(self.kb_path_str))
        
        md_files = []
        for root, dirs, files in os.walk(self.kb_path):
            for f in files:
                if f.endswith('.md') and not f.startswith('.'):
                    md_files.append(os.path.join(root, f))
        
        click.echo("发现 {} 篇文章".format(len(md_files)))
        
        for file_path in md_files:
            file_key = self._get_relative_path(file_path)
            
            try:
                metadata = self._parse_article(file_path)
                self.state['articles'][file_key] = {
                    'title': metadata.get('title', os.path.basename(file_path).replace('.md', '')),
                    'metadata': metadata,
                    'last_scan': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                }
                
                risks = self._detect_risks(file_path, metadata)
                if risks:
                    click.echo("  发现风险: {} - {} 项".format(os.path.basename(file_path), len(risks)))
                    self._update_risk_state(file_path, risks)
                else:
                    file_key = self._get_relative_path(file_path)
                    self.state['risks'] = [
                        r for r in self.state['risks'] 
                        if r.get('article_path') != file_key
                    ]
                    
            except Exception as e:
                click.echo("  错误: 无法解析 {} - {}".format(os.path.basename(file_path), e))
        
        self.state['last_scan'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        self._save_state()
        
        total_risks = len(self.state['risks'])
        click.echo("扫描完成。共发现 {} 个风险项".format(total_risks))
        return self.state['risks']

    def list_risks(self, status=None, severity=None):
        risks = self.state['risks']
        
        if status:
            risks = [r for r in risks if r.get('status') == status]
        
        if severity:
            risks = [r for r in risks if r.get('severity') == severity]
        
        return risks

    def confirm_risk(self, risk_id):
        risk = None
        for r in self.state['risks']:
            if r['risk_id'] == risk_id:
                risk = r
                break
        
        if risk:
            risk['status'] = 'confirmed'
            risk['confirmed_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            risk['updated_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            self._save_state()
            return risk
        return None

    def confirm_all(self):
        for risk in self.state['risks']:
            if risk.get('status') == 'pending':
                risk['status'] = 'confirmed'
                risk['confirmed_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                risk['updated_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        self._save_state()
        return len(self.state['risks'])

    def export_report(self, output_path):
        report_data = {
            'report_generated_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'last_scan': self.state.get('last_scan', '未知'),
            'total_articles': len(self.state['articles']),
            'total_risks': len(self.state['risks']),
            'risks_by_severity': {
                'high': len([r for r in self.state['risks'] if r.get('severity') == 'high']),
                'medium': len([r for r in self.state['risks'] if r.get('severity') == 'medium']),
                'low': len([r for r in self.state['risks'] if r.get('severity') == 'low'])
            },
            'risks': self.state['risks']
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)
        
        return report_data


def create_samples(target_dir):
    if not os.path.exists(target_dir):
        os.makedirs(target_dir)
    
    samples = {
        "01_normal_article.md": """# 客服中心常见问题解答

价格：免费咨询，高级服务199元/月
政策生效日期：2026-12-31
负责人：张三
关联业务线：客服支持，技术咨询
截图说明：主界面截图、登录流程截图

## 常见问题

1. 如何重置密码？
   请参考我们的 [密码重置指南](password-reset.md)

2. 服务时间是什么？
   周一至周日 9:00-18:00

## 引用的文章
- [用户注册流程](registration.md)
- [常见问题FAQ](faq.md)
""",
        "02_expired_price_article.md": """# VIP会员服务条款

价格：VIP会员 99元/月，已包含所有增值服务
政策生效日期：2024-01-01
负责人：李四
关联业务线：会员服务，增值业务
截图说明：会员中心截图

## 服务说明

本VIP会员服务包含以下权益：
1. 优先客服支持
2. 专属优惠券
3. 生日礼包

请参考 [VIP权益详解](vip-benefits.md) 了解更多。
""",
        "03_missing_owner_article.md": """# 退款政策说明

价格：全额退款需在7天内申请
政策生效日期：2025-06-15
关联业务线：支付业务
截图说明：退款申请界面

## 退款规则

1. 商品未使用
2. 购买时间不超过7天
3. 需提供购买凭证

详细流程请参考：
- [退款申请流程](refund-process.md)
- [退款到账时间](refund-timeline.md)
- [常见退款问题](refund-faq.md)
- [特殊情况处理](refund-special.md)
- [联系客服](contact-support.md)
""",
        "04_high_reference_article.md": """# 新用户快速入门指南

价格：免费
政策生效日期：2026-03-01
负责人：王五
关联业务线：新用户引导，产品入门
截图说明：首页、产品概览、快速开始

## 快速开始

请按顺序阅读以下文档：

1. [产品介绍](product-intro.md)
2. [注册与登录](auth-guide.md)
3. [基础功能使用](basic-usage.md)
4. [高级功能介绍](advanced-features.md)
5. [常见问题解答](common-questions.md)
6. [支持与反馈](support-feedback.md)
7. [更新日志](changelog.md)
8. [API文档](api-docs.md)

## 更多资源

- [视频教程](video-tutorials.md)
- [社区论坛](community-forum.md)
""",
        "05_already_confirmed_expired.md": """# 老版本API使用指南

价格：基础调用免费，高级调用 0.01元/次
政策生效日期：2023-06-01
负责人：赵六
关联业务线：API服务，开发者工具
截图说明：API控制台、请求示例

## API说明

这是老版本的API文档，建议迁移到新版本。

参考文档：
- [新版API迁移指南](api-migration.md)
- [API版本对比](api-version-compare.md)
- [常见迁移问题](migration-faq.md)
- [兼容性说明](compatibility.md)
- [技术支持](tech-support.md)
"""
    }
    
    for filename, content in samples.items():
        file_path = os.path.join(target_dir, filename)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
    
    click.echo("已创建 {} 篇样例文章到 {}".format(len(samples), target_dir))


@click.group()
@click.version_option(version='1.0.0')
def cli():
    """客服知识库过期巡检CLI工具"""
    pass


@cli.command()
@click.argument('path')
def init(path):
    """初始化样例知识库目录"""
    if os.path.exists(path):
        click.confirm(
            "目录 {} 已存在，是否覆盖？".format(path),
            abort=True
        )
        shutil.rmtree(path)
    
    create_samples(path)
    click.echo("\n样例目录已创建！您可以运行以下命令：")
    click.echo("  python3 kb_checker.py scan {}  - 扫描知识库".format(path))
    click.echo("  python3 kb_checker.py list {}  - 列出风险".format(path))


@cli.command()
@click.argument('kb_path')
def scan(kb_path):
    """扫描知识库目录，检测风险"""
    if not os.path.exists(kb_path):
        click.echo("错误: 目录不存在: {}".format(kb_path))
        return
    
    checker = KnowledgeBaseChecker(kb_path)
    risks = checker.scan()
    
    if risks:
        click.echo("\n风险摘要：")
        for risk in risks:
            status_emoji = {
                'pending': '🔴',
                'confirmed': '🟡',
                're-expired': '🔴'
            }.get(risk.get('status', 'pending'), '🔴')
            
            click.echo("  {} [{}] {}".format(status_emoji, risk['risk_id'], risk['article_path']))
            click.echo("     类型: {}".format(risk['type']))
            click.echo("     原因: {}".format(risk['description']))
            click.echo("     建议处理人: {}".format(risk['suggested_owner']))
            click.echo("     引用数量: {}".format(risk.get('ref_count', 0)))
            click.echo("")


@cli.command()
@click.argument('kb_path')
@click.option('--status', type=click.Choice(['pending', 'confirmed', 're-expired']), 
              help='按状态筛选')
@click.option('--severity', type=click.Choice(['high', 'medium', 'low']), 
              help='按严重程度筛选')
@click.option('--json', 'output_json', is_flag=True, help='以JSON格式输出')
def list(kb_path, status, severity, output_json):
    """列出检测到的风险"""
    if not os.path.exists(kb_path):
        click.echo("错误: 目录不存在: {}".format(kb_path))
        return
    
    checker = KnowledgeBaseChecker(kb_path)
    risks = checker.list_risks(status, severity)
    
    if output_json:
        click.echo(json.dumps(risks, ensure_ascii=False, indent=2))
        return
    
    if not risks:
        click.echo("当前没有风险项")
        return
    
    click.echo("共 {} 个风险项：\n".format(len(risks)))
    
    for i, risk in enumerate(risks, 1):
        status_text = {
            'pending': '待处理',
            'confirmed': '已确认',
            're-expired': '再次过期'
        }.get(risk.get('status', 'pending'), '未知')
        
        severity_text = {
            'high': '高',
            'medium': '中',
            'low': '低'
        }.get(risk.get('severity', 'medium'), '中')
        
        click.echo("{}. [{}] {}".format(i, risk['risk_id'], risk['article_path']))
        click.echo("   状态: {} | 严重程度: {}".format(status_text, severity_text))
        click.echo("   类型: {}".format(risk['type']))
        click.echo("   原因: {}".format(risk['description']))
        click.echo("   建议处理人: {}".format(risk['suggested_owner']))
        click.echo("   引用数量: {}".format(risk.get('ref_count', 0)))
        click.echo("")


@cli.command()
@click.argument('kb_path')
@click.argument('risk_id', required=False)
@click.option('--all', 'confirm_all', is_flag=True, help='确认所有待处理的风险')
def confirm(kb_path, risk_id, confirm_all):
    """标记风险为已确认"""
    if not os.path.exists(kb_path):
        click.echo("错误: 目录不存在: {}".format(kb_path))
        return
    
    checker = KnowledgeBaseChecker(kb_path)
    
    if confirm_all:
        count = checker.confirm_all()
        click.echo("已确认 {} 个风险项".format(count))
        return
    
    if not risk_id:
        click.echo("请提供风险ID或使用 --all 选项")
        return
    
    risk = checker.confirm_risk(risk_id)
    if risk:
        click.echo("已确认风险: {}".format(risk_id))
        click.echo("文章: {}".format(risk['article_path']))
    else:
        click.echo("未找到风险: {}".format(risk_id))


@cli.command()
@click.argument('kb_path')
@click.option('--output', '-o', default='kb_report.json', help='报告输出路径')
def report(kb_path, output):
    """导出修订报告"""
    if not os.path.exists(kb_path):
        click.echo("错误: 目录不存在: {}".format(kb_path))
        return
    
    checker = KnowledgeBaseChecker(kb_path)
    report_data = checker.export_report(output)
    
    click.echo("报告已生成: {}".format(output))
    click.echo("\n报告摘要:")
    click.echo("  生成时间: {}".format(report_data['report_generated_at']))
    click.echo("  最后扫描: {}".format(report_data['last_scan']))
    click.echo("  文章总数: {}".format(report_data['total_articles']))
    click.echo("  风险总数: {}".format(report_data['total_risks']))
    click.echo("  高风险: {}".format(report_data['risks_by_severity']['high']))
    click.echo("  中风险: {}".format(report_data['risks_by_severity']['medium']))
    click.echo("  低风险: {}".format(report_data['risks_by_severity']['low']))


if __name__ == '__main__':
    cli()
