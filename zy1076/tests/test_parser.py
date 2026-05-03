"""
文件解析模块测试
"""
import pytest
import sys
import tempfile
import os
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from resume_matcher.parser import (
    DocumentLoader,
    TextParser,
    MarkdownParser,
    CSVParser,
    ParserFactory,
    Document,
)
from resume_matcher.exceptions import (
    EmptyContentError,
    MissingFieldError,
    InvalidFormatError,
    FileParseError,
)


class TestDocument:
    """Document数据类测试"""
    
    def test_document_creation(self):
        """测试创建Document对象"""
        doc = Document(
            id="test_001",
            title="测试文档",
            content="这是测试内容",
            metadata={"source": "test"},
        )
        assert doc.id == "test_001"
        assert doc.title == "测试文档"
        assert doc.content == "这是测试内容"
    
    def test_document_to_dict(self):
        """测试Document转字典"""
        doc = Document(
            id="dict_test",
            title="Dict Test",
            content="Content",
            metadata={"key": "value"},
        )
        doc_dict = doc.to_dict()
        assert doc_dict["id"] == "dict_test"
        assert doc_dict["title"] == "Dict Test"
        assert doc_dict["content"] == "Content"


class TestTextParser:
    """TextParser测试"""
    
    def test_parse_valid_text(self, tmp_path):
        """测试解析有效文本文件"""
        # 创建测试文件
        test_file = tmp_path / "resume.txt"
        test_file.write_text("张三\n\n技能：Python、Java\n\n经验：3年开发经验", encoding="utf-8")
        
        parser = TextParser()
        doc = parser.parse(test_file)
        
        assert doc.id == "resume"
        assert "张三" in doc.content
        assert "Python" in doc.content
    
    def test_parse_empty_text(self, tmp_path):
        """测试解析空文本文件"""
        test_file = tmp_path / "empty.txt"
        test_file.write_text("", encoding="utf-8")
        
        parser = TextParser()
        with pytest.raises(EmptyContentError):
            parser.parse(test_file)
    
    def test_parse_whitespace_only(self, tmp_path):
        """测试解析只有空白字符的文件"""
        test_file = tmp_path / "whitespace.txt"
        test_file.write_text("   \n\n\t\n   ", encoding="utf-8")
        
        parser = TextParser()
        with pytest.raises(EmptyContentError):
            parser.parse(test_file)
    
    def test_parse_encoding_gbk(self, tmp_path):
        """测试解析GBK编码文件"""
        test_file = tmp_path / "gbk_file.txt"
        test_file.write_text("这是GBK编码的内容", encoding="gbk")
        
        parser = TextParser()
        doc = parser.parse(test_file)
        assert "GBK编码" in doc.content


class TestMarkdownParser:
    """MarkdownParser测试"""
    
    def test_parse_markdown(self, tmp_path):
        """测试解析Markdown文件"""
        test_file = tmp_path / "resume.md"
        markdown_content = """# 张三 - 软件工程师

## 技能
- Python
- JavaScript
- React

## 经验
3年开发经验
"""
        test_file.write_text(markdown_content, encoding="utf-8")
        
        parser = MarkdownParser()
        doc = parser.parse(test_file)
        
        assert doc.id == "resume"
        assert doc.title == "张三 - 软件工程师"
        assert "Python" in doc.content
        assert "JavaScript" in doc.content
    
    def test_markdown_cleaning(self):
        """测试Markdown格式清理"""
        parser = MarkdownParser()
        
        # 测试清理代码块
        test_text = """
# 标题

```python
print("hello")
```

`inline code`

**粗体** *斜体*

- 列表1
- 列表2

> 引用

[链接](http://example.com)
![图片](http://example.com/img.png)
"""
        
        clean_text = parser._clean_markdown(test_text)
        
        # 代码块应该被移除
        assert "print(" not in clean_text
        assert "inline code" not in clean_text
        
        # 格式符号应该被移除，但内容保留
        assert "粗体" in clean_text
        assert "斜体" in clean_text
        assert "列表1" in clean_text
        assert "列表2" in clean_text
        assert "引用" in clean_text
        assert "链接" in clean_text
        assert "图片" not in clean_text  # 图片alt文本也会被清理
    
    def test_markdown_no_h1(self, tmp_path):
        """测试没有H1标题的Markdown"""
        test_file = tmp_path / "no_h1.md"
        test_file.write_text("""
## 二级标题

内容内容。
""", encoding="utf-8")
        
        parser = MarkdownParser()
        doc = parser.parse(test_file)
        
        # 没有H1时使用文件名作为标题
        assert doc.title == "no_h1"


class TestCSVParser:
    """CSVParser测试"""
    
    def test_parse_valid_csv_resumes(self, tmp_path):
        """测试解析有效的简历CSV"""
        test_file = tmp_path / "resumes.csv"
        csv_content = """name,title,skills,experience
张三,Python开发工程师,"Python,Django,Flask","3年开发经验"
李四,Java开发工程师,"Java,Spring Boot","4年后端开发"
"""
        test_file.write_text(csv_content, encoding="utf-8")
        
        parser = CSVParser()
        docs = parser.parse(test_file, "resumes")
        
        assert len(docs) == 2
        
        # 检查第一份简历
        assert docs[0].title == "张三"
        assert "Python" in docs[0].content
        assert "Django" in docs[0].content
        
        # 检查第二份简历
        assert docs[1].title == "李四"
        assert "Java" in docs[1].content
    
    def test_parse_valid_csv_jobs(self, tmp_path):
        """测试解析有效的岗位CSV"""
        test_file = tmp_path / "jobs.csv"
        csv_content = """title,company,skills,requirements
Python开发工程师,某科技公司,"Python,Django","3年以上经验"
Java开发工程师,某互联网公司,"Java,Spring","熟悉微服务"
"""
        test_file.write_text(csv_content, encoding="utf-8")
        
        parser = CSVParser()
        docs = parser.parse(test_file, "jobs")
        
        assert len(docs) == 2
        assert docs[0].title == "Python开发工程师"
        assert docs[1].title == "Java开发工程师"
    
    def test_csv_missing_required_field(self, tmp_path):
        """测试CSV缺少必要字段"""
        test_file = tmp_path / "missing_field.csv"
        csv_content = """skills,experience
Python,3年经验
"""
        test_file.write_text(csv_content, encoding="utf-8")
        
        parser = CSVParser()
        with pytest.raises(MissingFieldError):
            parser.parse(test_file, "resumes")  # resumes需要name字段
    
    def test_csv_empty_row(self, tmp_path):
        """测试CSV空行"""
        test_file = tmp_path / "empty_row.csv"
        csv_content = """name,title,skills,experience
张三,工程师,"Python",
李四,工程师,"Java","4年"
"""
        test_file.write_text(csv_content, encoding="utf-8")
        
        parser = CSVParser()
        docs = parser.parse(test_file, "resumes")
        
        # 应该能够解析，空字段处理
        assert len(docs) == 2
    
    def test_csv_gbk_encoding(self, tmp_path):
        """测试GBK编码的CSV"""
        test_file = tmp_path / "gbk_csv.csv"
        csv_content = """name,title,skills
王五,测试工程师,测试技能
"""
        test_file.write_text(csv_content, encoding="gbk")
        
        parser = CSVParser()
        docs = parser.parse(test_file, "resumes")
        
        assert len(docs) == 1
        assert docs[0].title == "王五"


class TestParserFactory:
    """ParserFactory测试"""
    
    def test_get_parser_txt(self):
        """测试获取txt解析器"""
        parser = ParserFactory.get_parser(".txt")
        assert isinstance(parser, TextParser)
    
    def test_get_parser_md(self):
        """测试获取md解析器"""
        parser = ParserFactory.get_parser(".md")
        assert isinstance(parser, MarkdownParser)
    
    def test_get_parser_csv(self):
        """测试获取csv解析器"""
        parser = ParserFactory.get_parser(".csv")
        assert isinstance(parser, CSVParser)
    
    def test_get_parser_case_insensitive(self):
        """测试大小写不敏感"""
        parser = ParserFactory.get_parser(".TXT")
        assert isinstance(parser, TextParser)
        
        parser = ParserFactory.get_parser(".MD")
        assert isinstance(parser, MarkdownParser)
    
    def test_get_parser_invalid_format(self):
        """测试无效格式"""
        with pytest.raises(InvalidFormatError):
            ParserFactory.get_parser(".pdf")


class TestDocumentLoader:
    """DocumentLoader测试"""
    
    def test_load_single_file(self, tmp_path):
        """测试加载单个文件"""
        # 创建测试文件
        test_file = tmp_path / "test_resume.txt"
        test_file.write_text("测试简历内容\nPython\nJava", encoding="utf-8")
        
        loader = DocumentLoader()
        docs = loader.load_file(test_file, "resumes")
        
        assert len(docs) == 1
        assert "Python" in docs[0].content
    
    def test_load_directory(self, tmp_path):
        """测试加载目录"""
        # 创建测试目录和文件
        resumes_dir = tmp_path / "resumes"
        resumes_dir.mkdir()
        
        (resumes_dir / "resume1.txt").write_text("简历1\nPython", encoding="utf-8")
        (resumes_dir / "resume2.md").write_text("# 简历2\n\nJava", encoding="utf-8")
        (resumes_dir / "other.docx").write_text("其他格式", encoding="utf-8")  # 应该被忽略
        
        loader = DocumentLoader()
        docs, errors = loader.load_directory(resumes_dir, "resumes")
        
        # 应该只加载txt和md文件
        assert len(docs) == 2
    
    def test_load_nonexistent_path(self):
        """测试加载不存在的路径"""
        loader = DocumentLoader()
        with pytest.raises(FileNotFoundError):
            loader.load_file("/nonexistent/path/file.txt", "resumes")
    
    def test_load_unsupported_format(self, tmp_path):
        """测试加载不支持的格式"""
        test_file = tmp_path / "test.pdf"
        test_file.write_text("PDF内容", encoding="utf-8")
        
        loader = DocumentLoader()
        with pytest.raises(InvalidFormatError):
            loader.load_file(test_file, "resumes")
    
    def test_load_csv_file(self, tmp_path):
        """测试加载CSV文件"""
        test_file = tmp_path / "resumes.csv"
        csv_content = """name,title,skills
张三,工程师,"Python,Java"
李四,设计师,"UI,UX"
"""
        test_file.write_text(csv_content, encoding="utf-8")
        
        loader = DocumentLoader()
        docs = loader.load_file(test_file, "resumes")
        
        assert len(docs) == 2
        assert docs[0].title == "张三"
        assert docs[1].title == "李四"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
