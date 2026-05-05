"""导出器测试"""

import pytest
import json
import tempfile
from pathlib import Path

from tpsim.models import SimulationConfig
from tpsim.simulator import ThreadPoolSimulator
from tpsim.exporter import ReportExporter


class TestReportExporter:
    """报告导出器测试"""
    
    def setup_method(self):
        """设置测试环境"""
        config = SimulationConfig(
            worker_count=2,
            simulation_duration=20.0,
            seed=42
        )
        
        simulator = ThreadPoolSimulator(config)
        
        from tpsim.models import Task
        for i in range(5):
            task = Task(id=f"t-{i}", duration=1.0)
            simulator.add_task(task)
        
        self.result = simulator.run()
        self.exporter = ReportExporter(self.result)
    
    def test_export_json(self):
        """测试导出 JSON"""
        json_str = self.exporter.export_json(pretty=True)
        
        # 应该是有效的 JSON
        data = json.loads(json_str)
        
        assert "overview" in data
        assert "worker_details" in data
        assert "queue_analysis" in data
        assert "timeline_summary" in data
        assert "full_timeline" in data
    
    def test_export_json_compact(self):
        """测试导出紧凑 JSON"""
        json_str = self.exporter.export_json(pretty=False)
        
        # 应该是有效的 JSON
        data = json.loads(json_str)
        assert "overview" in data
    
    def test_export_markdown(self):
        """测试导出 Markdown"""
        md_str = self.exporter.export_markdown()
        
        # 应该包含 Markdown 标题
        assert "# 线程池模拟报告" in md_str
        assert "## 1. 模拟概览" in md_str
        assert "## 2. Worker 详细统计" in md_str
        assert "## 3. 队列分析" in md_str
    
    def test_export_markdown_with_timeline(self):
        """测试导出包含时间线的 Markdown"""
        md_str = self.exporter.export_markdown(include_timeline=True)
        
        # 应该包含时间线部分
        assert "时间线" in md_str
    
    def test_get_severity_icon(self):
        """测试严重程度图标"""
        # 测试内部方法
        critical_icon = self.exporter._get_severity_icon("critical")
        warning_icon = self.exporter._get_severity_icon("warning")
        info_icon = self.exporter._get_severity_icon("info")
        
        assert critical_icon == "🔴"
        assert warning_icon == "🟡"
        assert info_icon == "🔵"
    
    def test_get_timestamp(self):
        """测试获取时间戳"""
        timestamp = self.exporter._get_timestamp()
        
        # 应该返回一个字符串
        assert isinstance(timestamp, str)
        # 应该包含日期格式
        assert len(timestamp) > 0


class TestExportToFile:
    """导出到文件测试"""
    
    def test_export_json_to_file(self):
        """测试导出 JSON 到文件"""
        config = SimulationConfig(
            worker_count=2,
            simulation_duration=10.0,
            seed=42
        )
        
        simulator = ThreadPoolSimulator(config)
        
        from tpsim.models import Task
        for i in range(3):
            task = Task(id=f"t-{i}", duration=1.0)
            simulator.add_task(task)
        
        result = simulator.run()
        exporter = ReportExporter(result)
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json_path = Path(f.name)
        
        try:
            exporter.export_to_file(json_path, format="json", pretty=True)
            
            # 验证文件存在
            assert json_path.exists()
            
            # 验证内容有效
            content = json_path.read_text()
            data = json.loads(content)
            assert "overview" in data
            
        finally:
            if json_path.exists():
                json_path.unlink()
    
    def test_export_markdown_to_file(self):
        """测试导出 Markdown 到文件"""
        config = SimulationConfig(
            worker_count=2,
            simulation_duration=10.0,
            seed=42
        )
        
        simulator = ThreadPoolSimulator(config)
        
        from tpsim.models import Task
        for i in range(3):
            task = Task(id=f"t-{i}", duration=1.0)
            simulator.add_task(task)
        
        result = simulator.run()
        exporter = ReportExporter(result)
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False) as f:
            md_path = Path(f.name)
        
        try:
            exporter.export_to_file(md_path, format="markdown", include_timeline=False)
            
            # 验证文件存在
            assert md_path.exists()
            
            # 验证内容
            content = md_path.read_text()
            assert "# 线程池模拟报告" in content
            
        finally:
            if md_path.exists():
                md_path.unlink()
    
    def test_export_creates_directory(self):
        """测试导出时创建目录"""
        config = SimulationConfig(
            worker_count=2,
            simulation_duration=10.0,
            seed=42
        )
        
        simulator = ThreadPoolSimulator(config)
        
        from tpsim.models import Task
        task = Task(id="t-0", duration=1.0)
        simulator.add_task(task)
        
        result = simulator.run()
        exporter = ReportExporter(result)
        
        # 使用临时目录下的嵌套路径
        with tempfile.TemporaryDirectory() as tmpdir:
            nested_path = Path(tmpdir) / "reports" / "output" / "report.md"
            
            # 导出
            exporter.export_to_file(nested_path, format="markdown")
            
            # 验证目录和文件都已创建
            assert nested_path.exists()
            assert nested_path.parent.exists()


class TestExportContent:
    """导出内容测试"""
    
    def test_json_contains_all_sections(self):
        """测试 JSON 包含所有部分"""
        config = SimulationConfig(
            worker_count=3,
            simulation_duration=20.0,
            seed=42
        )
        
        simulator = ThreadPoolSimulator(config)
        
        from tpsim.models import Task
        for i in range(10):
            task = Task(id=f"t-{i}", duration=1.0)
            simulator.add_task(task)
        
        result = simulator.run()
        exporter = ReportExporter(result)
        
        json_str = exporter.export_json()
        data = json.loads(json_str)
        
        # 检查所有关键部分
        assert "overview" in data
        assert "worker_details" in data
        assert "queue_analysis" in data
        assert "timeline_summary" in data
        assert "bottleneck_analysis" in data
        assert "suggestions" in data
        assert "config" in data
        assert "full_timeline" in data
    
    def test_markdown_contains_key_metrics(self):
        """测试 Markdown 包含关键指标"""
        config = SimulationConfig(
            worker_count=2,
            simulation_duration=15.0,
            seed=42
        )
        
        simulator = ThreadPoolSimulator(config)
        
        from tpsim.models import Task
        for i in range(5):
            task = Task(id=f"t-{i}", duration=1.0)
            simulator.add_task(task)
        
        result = simulator.run()
        exporter = ReportExporter(result)
        
        md_str = exporter.export_markdown()
        
        # 检查关键内容
        assert "Worker 数量" in md_str
        assert "成功率" in md_str
        assert "吞吐量" in md_str
        assert "平均等待时间" in md_str
        assert "Worker 利用率" in md_str
