"""
命令行入口模块
提供完整的CLI命令：匹配、训练、报告导出等
"""
import os
import sys
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime

import click

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from config import (
    ensure_directories,
    RESUMES_DIR,
    JOBS_DIR,
    REPORTS_DIR,
    MODELS_DIR,
    SKILLS_DICT_PATH,
)
from .parser import DocumentLoader, Document
from .skills_dictionary import SkillsDictionary
from .model import ResumeMatcherModel, ModelEvaluation
from .report_generator import ReportGenerator
from .exceptions import (
    ResumeMatcherError,
    FileParseError,
    EmptyContentError,
    MissingFieldError,
    InvalidFormatError,
    ModelError,
    ReportError,
)


def print_header():
    """打印程序头部"""
    click.echo("=" * 60)
    click.echo("📋 简历岗位匹配小助手 - 本地AI/ML应用")
    click.echo("=" * 60)
    click.echo("")


def print_error(message: str):
    """打印错误信息"""
    click.echo(click.style(f"❌ 错误: {message}", fg="red"))


def print_warning(message: str):
    """打印警告信息"""
    click.echo(click.style(f"⚠️  警告: {message}", fg="yellow"))


def print_success(message: str):
    """打印成功信息"""
    click.echo(click.style(f"✅ {message}", fg="green"))


def print_info(message: str):
    """打印信息"""
    click.echo(click.style(f"ℹ️  {message}", fg="blue"))


def load_documents(
    path: str,
    doc_type: str,  # "resumes" or "jobs"
    recursive: bool = False,
) -> List[Document]:
    """加载文档"""
    loader = DocumentLoader()
    path_obj = Path(path)
    
    if path_obj.is_file():
        # 单个文件
        try:
            docs = loader.load_file(path_obj, doc_type)
            return docs
        except Exception as e:
            if isinstance(e, (EmptyContentError, MissingFieldError)):
                raise
            raise FileParseError(f"加载文件失败: {e}")
    elif path_obj.is_dir():
        # 目录
        try:
            docs, errors = loader.load_directory(path_obj, doc_type, recursive)
            
            if errors:
                click.echo("")
                for err in errors:
                    print_warning(err)
            
            if not docs:
                raise FileParseError(f"目录 {path} 中没有成功加载任何文档")
            
            return docs
        except FileNotFoundError:
            raise FileNotFoundError(f"路径不存在: {path}")
    else:
        raise FileNotFoundError(f"路径不存在: {path}")


@click.group()
@click.version_option(version="0.1.0", prog_name="resume-matcher")
def main():
    """
    简历岗位匹配小助手 - 本地AI/ML应用
    
    所有计算均在本地完成，保护您的隐私。
    
    主要功能:
    - match: 匹配简历和岗位JD
    - train: 训练和校准模型
    - list-skills: 查看技能词典
    - self-check: 自检
    """
    pass


@main.command()
@click.option("--resumes", "-r", default=None, help="简历文件或目录路径 (默认: data/resumes/)")
@click.option("--jobs", "-j", default=None, help="岗位JD文件或目录路径 (默认: data/jobs/)")
@click.option("--output", "-o", default=None, help="报告输出目录 (默认: data/reports/)")
@click.option("--format", "-f", "formats", multiple=True, default=["md", "html"], 
              type=click.Choice(["json", "md", "html"]),
              help="输出格式 (可多选: json, md, html)")
@click.option("--recursive", "-R", is_flag=True, help="递归搜索子目录")
@click.option("--model-dir", "-m", default=None, help="加载已训练模型的目录")
@click.option("--verbose", "-v", is_flag=True, help="显示详细输出")
def match(resumes, jobs, output, formats, recursive, model_dir, verbose):
    """
    匹配简历和岗位JD
    
    示例:
    \b
    # 使用默认目录
    resume-matcher match
    
    \b
    # 指定文件
    resume-matcher match -r my_resume.md -j job_description.txt
    
    \b
    # 导出多种格式
    resume-matcher match -f json -f md -f html
    """
    print_header()
    
    try:
        # 确保目录存在
        ensure_directories()
        
        # 确定路径
        resumes_path = resumes or str(RESUMES_DIR)
        jobs_path = jobs or str(JOBS_DIR)
        output_dir = Path(output) if output else REPORTS_DIR
        
        # 验证路径
        if not Path(resumes_path).exists():
            print_error(f"简历路径不存在: {resumes_path}")
            sys.exit(1)
        
        if not Path(jobs_path).exists():
            print_error(f"岗位路径不存在: {jobs_path}")
            sys.exit(1)
        
        # 加载文档
        print_info(f"加载简历: {resumes_path}")
        try:
            resume_docs = load_documents(resumes_path, "resumes", recursive)
            print_success(f"成功加载 {len(resume_docs)} 份简历")
        except Exception as e:
            print_error(str(e))
            sys.exit(1)
        
        print_info(f"加载岗位JD: {jobs_path}")
        try:
            job_docs = load_documents(jobs_path, "jobs", recursive)
            print_success(f"成功加载 {len(job_docs)} 个岗位")
        except Exception as e:
            print_error(str(e))
            sys.exit(1)
        
        # 加载模型
        print_info("初始化匹配模型...")
        if model_dir and Path(model_dir).exists():
            model = ResumeMatcherModel.load(model_dir)
            print_success(f"从 {model_dir} 加载已训练模型")
        else:
            skills_dict = SkillsDictionary.load(str(SKILLS_DICT_PATH)) if SKILLS_DICT_PATH.exists() else SkillsDictionary()
            model = ResumeMatcherModel(skills_dict=skills_dict)
            print_success("使用默认模型配置")
        
        # 执行匹配
        click.echo("")
        print_info("开始匹配分析...")
        
        all_results, results_by_job = model.match_all(resume_docs, job_docs)
        
        # 生成比较矩阵
        comparison_matrix = model.generate_comparison_matrix(all_results, resume_docs, job_docs)
        
        print_success(f"完成 {len(all_results)} 组匹配分析")
        
        # 显示摘要
        click.echo("")
        click.echo("-" * 60)
        click.echo("📊 匹配摘要")
        click.echo("-" * 60)
        
        # 分数矩阵
        score_matrix = comparison_matrix.get("score_matrix", {})
        if score_matrix:
            click.echo("")
            click.echo("匹配分数矩阵:")
            
            # 获取所有简历和岗位ID
            resume_ids = list(score_matrix.keys())
            if resume_ids:
                job_ids = list(score_matrix[resume_ids[0]].keys())
                
                # 打印表头
                header = "简历\\岗位".ljust(20)
                for job_id in job_ids:
                    header += job_id[:10].ljust(12)
                click.echo(header)
                
                # 打印数据
                for resume_id in resume_ids:
                    row = resume_id[:18].ljust(20)
                    for job_id in job_ids:
                        score = score_matrix.get(resume_id, {}).get(job_id, 0)
                        if score >= 0.7:
                            score_str = click.style(f"{score:.1%}", fg="green")
                        elif score >= 0.5:
                            score_str = click.style(f"{score:.1%}", fg="yellow")
                        else:
                            score_str = click.style(f"{score:.1%}", fg="red")
                        row += score_str.ljust(12)
                    click.echo(row)
        
        # 各岗位最佳匹配
        click.echo("")
        click.echo("各岗位最佳匹配简历:")
        best_resumes = comparison_matrix.get("best_resumes_per_job", {})
        for job_id, info in best_resumes.items():
            score = info["best_score"]
            if score >= 0.7:
                indicator = "🌟"
            elif score >= 0.5:
                indicator = "⭐"
            else:
                indicator = "💫"
            click.echo(
                f"  {indicator} {info['job_title'][:30]:<30} → {info['best_resume_title'][:30]:<30} ({score:.1%})"
            )
        
        # 生成报告
        click.echo("")
        print_info("生成报告...")
        
        report_gen = ReportGenerator()
        
        # 元数据
        metadata = {
            "简历数": len(resume_docs),
            "岗位数": len(job_docs),
            "匹配组数": len(all_results),
            "模型路径": model_dir or "默认模型",
        }
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir.mkdir(parents=True, exist_ok=True)
        
        saved_files = []
        
        for fmt in formats:
            output_path = output_dir / f"match_report_{timestamp}.{fmt}"
            try:
                saved_path = report_gen.save_report(
                    output_path=str(output_path),
                    format=fmt,
                    all_results=all_results,
                    comparison_matrix=comparison_matrix,
                    metadata=metadata,
                )
                saved_files.append(saved_path)
                print_success(f"已生成 {fmt.upper()} 报告: {saved_path}")
            except Exception as e:
                print_error(f"生成 {fmt.upper()} 报告失败: {e}")
        
        click.echo("")
        click.echo("=" * 60)
        print_success("匹配分析完成!")
        click.echo(f"📁 报告已保存到: {output_dir}")
        for f in saved_files:
            click.echo(f"   - {f}")
        click.echo("=" * 60)
        
    except ResumeMatcherError as e:
        print_error(str(e))
        sys.exit(1)
    except Exception as e:
        print_error(f"未知错误: {e}")
        if verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


@main.command()
@click.option("--training-data", "-d", required=True, help="训练数据文件路径 (JSON格式)")
@click.option("--model-dir", "-m", default=str(MODELS_DIR), help="模型保存目录")
@click.option("--verbose", "-v", is_flag=True, help="显示详细输出")
def train(training_data, model_dir, verbose):
    """
    训练和校准模型
    
    训练数据格式示例:
    [
        {
            "resume_content": "简历内容...",
            "job_content": "岗位JD内容...",
            "label": "high_match"  # high_match, medium_match, low_match
        }
    ]
    """
    print_header()
    
    try:
        import json
        
        # 加载训练数据
        print_info(f"加载训练数据: {training_data}")
        training_path = Path(training_data)
        
        if not training_path.exists():
            print_error(f"训练数据文件不存在: {training_data}")
            sys.exit(1)
        
        with open(training_path, 'r', encoding='utf-8') as f:
            training_samples = json.load(f)
        
        if len(training_samples) < 10:
            print_warning(f"训练样本较少 ({len(training_samples)} 个)，建议至少10个样本以获得更好效果")
        
        print_success(f"成功加载 {len(training_samples)} 个训练样本")
        
        # 初始化模型
        print_info("初始化模型...")
        skills_dict = SkillsDictionary.load(str(SKILLS_DICT_PATH)) if SKILLS_DICT_PATH.exists() else SkillsDictionary()
        model = ResumeMatcherModel(skills_dict=skills_dict)
        
        # 添加训练样本
        print_info("准备训练数据...")
        from .parser import Document
        
        for sample in training_samples:
            resume_doc = Document(
                id=f"train_resume_{id(sample)}",
                title="训练简历",
                content=sample.get("resume_content", ""),
            )
            job_doc = Document(
                id=f"train_job_{id(sample)}",
                title="训练岗位",
                content=sample.get("job_content", ""),
            )
            model.add_training_sample(resume_doc, job_doc, sample.get("label", "medium_match"))
        
        # 训练模型
        click.echo("")
        print_info("开始训练模型...")
        
        try:
            evaluation = model.train()
            
            click.echo("")
            click.echo(str(evaluation))
            
        except ModelError as e:
            print_error(str(e))
            sys.exit(1)
        
        # 保存模型
        click.echo("")
        print_info(f"保存模型到: {model_dir}")
        
        model.save(model_dir)
        
        # 同时保存技能词典
        skills_dict_path = Path(model_dir) / "skills_dictionary.json"
        model.skills_dict.save(str(skills_dict_path))
        
        click.echo("")
        click.echo("=" * 60)
        print_success("模型训练完成!")
        click.echo(f"📁 模型已保存到: {model_dir}")
        click.echo("=" * 60)
        
    except ResumeMatcherError as e:
        print_error(str(e))
        sys.exit(1)
    except Exception as e:
        print_error(f"训练失败: {e}")
        if verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


@main.command("list-skills")
@click.option("--category", "-c", default=None, help="按类别筛选")
@click.option("--search", "-s", default=None, help="搜索关键词")
@click.option("--export", "-e", default=None, help="导出到JSON文件")
def list_skills(category, search, export):
    """
    查看和管理技能词典
    
    示例:
    \b
    # 查看所有技能
    resume-matcher list-skills
    
    \b
    # 按类别筛选
    resume-matcher list-skills -c "AI/机器学习"
    
    \b
    # 搜索技能
    resume-matcher list-skills -s "Python"
    """
    print_header()
    
    try:
        # 加载技能词典
        skills_dict = SkillsDictionary.load(str(SKILLS_DICT_PATH)) if SKILLS_DICT_PATH.exists() else SkillsDictionary()
        
        # 获取技能列表
        if category:
            skills = skills_dict.get_skills_by_category(category)
            click.echo(f"📂 类别: {category}")
        elif search:
            skills = []
            search_lower = search.lower()
            for skill in skills_dict.get_all_skills():
                if (search_lower in skill.name.lower() or 
                    any(search_lower in a.lower() for a in skill.aliases)):
                    skills.append(skill)
            click.echo(f"🔍 搜索: {search}")
        else:
            skills = skills_dict.get_all_skills()
            click.echo(f"📚 所有技能")
        
        click.echo(f"📊 共 {len(skills)} 个技能")
        click.echo("")
        
        # 按类别分组显示
        from collections import defaultdict
        skills_by_category = defaultdict(list)
        for skill in skills:
            skills_by_category[skill.category].append(skill)
        
        for cat, cat_skills in sorted(skills_by_category.items()):
            click.echo(click.style(f"【{cat}】", fg="blue", bold=True))
            for skill in sorted(cat_skills, key=lambda s: s.weight, reverse=True):
                weight_str = f" (权重: {skill.weight})" if skill.weight != 1.0 else ""
                aliases_str = f" | 别名: {', '.join(skill.aliases[:3])}" if skill.aliases else ""
                click.echo(f"  • {skill.name}{weight_str}{aliases_str}")
            click.echo("")
        
        # 显示所有类别
        if not category and not search:
            click.echo("-" * 60)
            click.echo("📁 所有类别:")
            for cat in sorted(skills_dict.get_all_categories()):
                count = len(skills_dict.get_skills_by_category(cat))
                click.echo(f"  • {cat} ({count} 个技能)")
        
        # 导出
        if export:
            export_path = Path(export)
            skills_dict.save(str(export_path))
            click.echo("")
            print_success(f"技能词典已导出到: {export_path}")
        
    except Exception as e:
        print_error(f"操作失败: {e}")
        sys.exit(1)


@main.command("self-check")
@click.option("--verbose", "-v", is_flag=True, help="显示详细输出")
def self_check(verbose):
    """
    运行自检脚本
    
    检查:
    - 依赖是否安装
    - 技能词典是否正常
    - 别名归一化是否正常
    - 异常输入处理是否正常
    """
    print_header()
    
    all_passed = True
    
    def check(name, func):
        nonlocal all_passed
        try:
            result = func()
            if result is True or result is None:
                print_success(f"✓ {name}")
                return True
            else:
                print_warning(f"? {name}: {result}")
                return True
        except Exception as e:
            print_error(f"✗ {name}: {e}")
            all_passed = False
            return False
    
    # 1. 检查依赖
    click.echo("📦 检查依赖...")
    
    def check_dependencies():
        import sklearn
        import numpy
        import pandas
        import jieba
        import Levenshtein
        import click
        import jinja2
        return True
    
    check("核心依赖 (sklearn, numpy, pandas)", check_dependencies)
    
    # 2. 检查技能词典
    click.echo("")
    click.echo("📚 检查技能词典...")
    
    def check_skills_dict():
        skills_dict = SkillsDictionary()
        assert len(skills_dict.get_all_skills()) > 0, "技能词典为空"
        assert len(skills_dict.get_all_categories()) > 0, "类别为空"
        return True
    
    check("技能词典初始化", check_skills_dict)
    
    # 3. 检查别名归一化
    click.echo("")
    click.echo("🔄 检查别名归一化...")
    
    def check_aliases():
        skills_dict = SkillsDictionary()
        
        # 测试用例
        test_cases = [
            ("JS", "JavaScript"),
            ("js", "JavaScript"),
            ("React.js", "React"),
            ("reactjs", "React"),
            ("PYTHON", "Python"),
            ("py", "Python"),
            ("NLP", "自然语言处理"),
            ("ML", "机器学习"),
            ("BI", "数据分析"),
            ("K8s", "Kubernetes"),
        ]
        
        failed = []
        for alias, expected in test_cases:
            normalized = skills_dict.normalize(alias)
            if normalized != expected:
                failed.append(f"{alias} → {normalized} (期望: {expected})")
        
        if failed:
            return "部分别名归一化失败: " + "; ".join(failed)
        
        return True
    
    check("别名归一化", check_aliases)
    
    # 4. 检查技能提取
    click.echo("")
    click.echo("🔍 检查技能提取...")
    
    def check_skill_extraction():
        skills_dict = SkillsDictionary()
        
        test_text = """
        我精通 Python 和 JavaScript，熟练使用 React、Vue.js 进行前端开发。
        有丰富的机器学习和自然语言处理经验，熟悉 TensorFlow 和 PyTorch。
        掌握 SQL 和 MySQL，了解数据分析和 BI 工具。
        """
        
        extracted = skills_dict.extract_skills(test_text)
        skill_names = [s[0].name for s in extracted]
        
        expected_skills = ["Python", "JavaScript", "React", "Vue.js", "机器学习", 
                          "自然语言处理", "TensorFlow", "PyTorch", "SQL", "MySQL", "数据分析"]
        
        found = [s for s in expected_skills if s in skill_names]
        missing = [s for s in expected_skills if s not in skill_names]
        
        if missing:
            return f"未提取到: {', '.join(missing)}"
        
        return True
    
    check("技能提取", check_skill_extraction)
    
    # 5. 检查模型匹配
    click.echo("")
    click.echo("🤖 检查模型匹配...")
    
    def check_model_match():
        from .parser import Document
        
        model = ResumeMatcherModel()
        
        # 测试简历
        resume = Document(
            id="test_resume",
            title="测试简历",
            content="""
            我是一名Python开发工程师，精通Python和Django框架。
            有3年机器学习经验，熟悉TensorFlow和PyTorch。
            熟练使用MySQL和Redis数据库。
            """,
        )
        
        # 测试岗位1：匹配度高
        job1 = Document(
            id="test_job_1",
            title="Python后端工程师",
            content="""
            要求：精通Python，熟悉Django或Flask框架。
            有机器学习经验优先，熟悉TensorFlow或PyTorch。
            掌握MySQL、Redis等数据库。
            """,
        )
        
        # 测试岗位2：匹配度低
        job2 = Document(
            id="test_job_2",
            title="Java开发工程师",
            content="""
            要求：精通Java，熟悉Spring Boot框架。
            有企业级应用开发经验，熟悉Oracle数据库。
            """,
        )
        
        result1 = model.match(resume, job1)
        result2 = model.match(resume, job2)
        
        # 验证分数逻辑
        if result1.total_score <= result2.total_score:
            return f"分数逻辑异常: 匹配岗位分数({result1.total_score:.2%}) <= 不匹配岗位分数({result2.total_score:.2%})"
        
        # 验证匹配技能
        if not result1.matched_skills:
            return "未匹配到任何技能"
        
        # 验证缺失技能
        if not result2.missing_skills:
            return "未识别到缺失技能"
        
        return True
    
    check("模型匹配逻辑", check_model_match)
    
    # 6. 检查异常处理
    click.echo("")
    click.echo("⚠️  检查异常处理...")
    
    def check_exception_handling():
        from .exceptions import EmptyContentError, MissingFieldError
        
        skills_dict = SkillsDictionary()
        
        # 测试空文本
        try:
            extracted = skills_dict.extract_skills("")
            if extracted != []:
                return "空文本应该返回空列表"
        except Exception as e:
            return f"空文本处理异常: {e}"
        
        # 测试None
        try:
            normalized = skills_dict.normalize("不存在的技能")
            if normalized is not None:
                return "不存在的技能应该返回None"
        except Exception as e:
            return f"未知技能处理异常: {e}"
        
        return True
    
    check("异常处理", check_exception_handling)
    
    # 7. 检查报告生成
    click.echo("")
    click.echo("📄 检查报告生成...")
    
    def check_report_generation():
        import tempfile
        from .parser import Document
        
        model = ResumeMatcherModel()
        report_gen = ReportGenerator()
        
        resume = Document(
            id="r1",
            title="测试简历",
            content="精通Python和机器学习。",
        )
        
        job = Document(
            id="j1",
            title="测试岗位",
            content="要求Python和机器学习经验。",
        )
        
        result = model.match(resume, job)
        comparison_matrix = model.generate_comparison_matrix([result], [resume], [job])
        
        # 测试JSON
        json_report = report_gen.generate_json_report([result], comparison_matrix)
        assert "report_info" in json_report, "JSON报告缺少report_info"
        assert "match_results" in json_report, "JSON报告缺少match_results"
        
        # 测试Markdown
        md_report = report_gen.generate_markdown_report([result], comparison_matrix)
        assert len(md_report) > 0, "Markdown报告为空"
        
        # 测试HTML
        html_report = report_gen.generate_html_report([result], comparison_matrix)
        assert len(html_report) > 0, "HTML报告为空"
        
        return True
    
    check("报告生成", check_report_generation)
    
    # 总结
    click.echo("")
    click.echo("=" * 60)
    if all_passed:
        print_success("所有自检项通过! ✨")
    else:
        print_warning("部分自检项未通过，请检查上述问题。")
    click.echo("=" * 60)
    
    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()
