import pytest
import tempfile
import os
from pathlib import Path
import json

from perf_trainer.incident_parser import IncidentParser
from perf_trainer.storage import Database
from perf_trainer.engine import TroubleshootingEngine, CommandRecommendation
from perf_trainer.config import Config
from perf_trainer.exceptions import (
    IncidentNotFoundError,
    InvalidIncidentFormatError,
    SampleNotFoundError,
    InvalidStageError
)


@pytest.fixture
def temp_data_dir():
    """创建临时数据目录"""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def sample_incident(temp_data_dir):
    """创建样例事件目录"""
    incident_dir = temp_data_dir / "incident"
    samples_dir = incident_dir / "samples"
    samples_dir.mkdir(parents=True)
    
    # 创建 incident.yaml
    incident_yaml = """name: Test Incident
description: Test description
root_cause: Test root cause
difficulty: easy

stages:
  - name: cpu
    description: CPU stage
    commands:
      - name: top
        description: Top command
        sample: top.txt
    expected_analysis: Expected analysis
    success_criteria: Success criteria

samples:
  - name: top_output
    type: cpu
    file: top.txt
    description: Top output
"""
    
    with open(incident_dir / "incident.yaml", 'w') as f:
        f.write(incident_yaml)
    
    # 创建样本文件
    with open(samples_dir / "top.txt", 'w') as f:
        f.write("top - 10:00:00 up 1 day, load average: 1.00\n")
    
    return incident_dir


class TestConfig:
    """测试配置类"""
    
    def test_default_config(self):
        """测试默认配置"""
        assert Config.APP_NAME == "perf-trainer"
        assert Config.APP_VERSION == "0.1.0"
    
    def test_db_path(self, temp_data_dir):
        """测试数据库路径"""
        db_path = Config.get_db_path(temp_data_dir)
        assert db_path.name == "perf_trainer.db"
    
    def test_ensure_data_dir(self, temp_data_dir):
        """测试确保数据目录存在"""
        new_dir = temp_data_dir / "new_dir"
        result = Config.ensure_data_dir(new_dir)
        assert result.exists()
        assert result == new_dir


class TestIncidentParser:
    """测试 incident 解析器"""
    
    def test_load_valid_incident(self, sample_incident):
        """测试加载有效的 incident"""
        parser = IncidentParser(sample_incident)
        data = parser.load()
        
        assert data['name'] == "Test Incident"
        assert data['description'] == "Test description"
        assert len(data['stages']) == 1
        assert data['stages'][0]['name'] == 'cpu'
    
    def test_load_missing_incident(self, temp_data_dir):
        """测试加载不存在的 incident"""
        with pytest.raises(IncidentNotFoundError):
            parser = IncidentParser(temp_data_dir)
            parser.load()
    
    def test_invalid_yaml_format(self, temp_data_dir):
        """测试无效的 YAML 格式"""
        incident_dir = temp_data_dir / "bad_incident"
        incident_dir.mkdir()
        
        with open(incident_dir / "incident.yaml", 'w') as f:
            f.write("invalid: yaml: [missing\n")
        
        with pytest.raises(InvalidIncidentFormatError) as exc_info:
            parser = IncidentParser(incident_dir)
            parser.load()
        
        assert "YAML" in str(exc_info.value)
    
    def test_missing_required_field(self, temp_data_dir):
        """测试缺少必需字段"""
        incident_dir = temp_data_dir / "missing_field"
        samples_dir = incident_dir / "samples"
        samples_dir.mkdir(parents=True)
        
        # 缺少 'stages' 字段
        bad_yaml = """name: Test
description: Test
root_cause: Test
difficulty: easy
samples: []
"""
        
        with open(incident_dir / "incident.yaml", 'w') as f:
            f.write(bad_yaml)
        
        with pytest.raises(InvalidIncidentFormatError) as exc_info:
            parser = IncidentParser(incident_dir)
            parser.load()
        
        assert "stages" in str(exc_info.value).lower()
    
    def test_get_stage(self, sample_incident):
        """测试获取阶段配置"""
        parser = IncidentParser(sample_incident)
        parser.load()
        
        stage = parser.get_stage('cpu')
        assert stage is not None
        assert stage['name'] == 'cpu'
        
        none_stage = parser.get_stage('nonexistent')
        assert none_stage is None
    
    def test_read_sample_file(self, sample_incident):
        """测试读取样本文件"""
        parser = IncidentParser(sample_incident)
        parser.load()
        
        content = parser.read_sample_file('top.txt')
        assert "load average" in content
    
    def test_read_missing_sample(self, sample_incident):
        """测试读取不存在的样本"""
        parser = IncidentParser(sample_incident)
        parser.load()
        
        with pytest.raises(SampleNotFoundError):
            parser.read_sample_file('nonexistent.txt')


class TestDatabase:
    """测试数据库模块"""
    
    def test_create_session(self, temp_data_dir):
        """测试创建会话"""
        db = Database(temp_data_dir / "test.db")
        session_id = db.create_session("/path/to/incident", "Test Incident")
        
        assert session_id > 0
        
        session = db.get_session(session_id)
        assert session is not None
        assert session['incident_name'] == "Test Incident"
    
    def test_list_sessions(self, temp_data_dir):
        """测试列出会话"""
        db = Database(temp_data_dir / "test.db")
        
        # 创建几个会话
        db.create_session("/path/1", "Incident 1")
        db.create_session("/path/2", "Incident 2")
        
        sessions = db.list_sessions(limit=10)
        assert len(sessions) == 2
    
    def test_add_and_get_steps(self, temp_data_dir):
        """测试添加和获取步骤"""
        db = Database(temp_data_dir / "test.db")
        session_id = db.create_session("/path", "Test")
        
        # 添加步骤
        db.add_step(
            session_id=session_id,
            stage='cpu',
            command='top',
            user_choice='High CPU process found',
            is_correct=True,
            feedback='Good analysis',
            sample_viewed='top.txt'
        )
        
        # 获取步骤
        steps = db.get_session_steps(session_id)
        assert len(steps) == 1
        assert steps[0]['stage'] == 'cpu'
        assert steps[0]['command'] == 'top'
        assert steps[0]['is_correct'] == True
    
    def test_update_session_status(self, temp_data_dir):
        """测试更新会话状态"""
        db = Database(temp_data_dir / "test.db")
        session_id = db.create_session("/path", "Test")
        
        db.update_session_status(session_id, 'completed', 'Test notes')
        
        session = db.get_session(session_id)
        assert session['status'] == 'completed'
        assert session['notes'] == 'Test notes'


class TestEngine:
    """测试排障引擎"""
    
    def test_create_engine(self, sample_incident, temp_data_dir):
        """测试创建引擎"""
        db = Database(temp_data_dir / "test.db")
        engine = TroubleshootingEngine(sample_incident, db)
        
        assert engine.incident_data['name'] == "Test Incident"
    
    def test_start_session(self, sample_incident, temp_data_dir):
        """测试开始会话"""
        db = Database(temp_data_dir / "test.db")
        engine = TroubleshootingEngine(sample_incident, db)
        
        session_id = engine.start_session()
        assert session_id > 0
        assert engine.current_session_id == session_id
    
    def test_get_stages_order(self, sample_incident, temp_data_dir):
        """测试获取阶段顺序"""
        db = Database(temp_data_dir / "test.db")
        engine = TroubleshootingEngine(sample_incident, db)
        
        order = engine.get_stages_order()
        assert 'cpu' in order
    
    def test_get_command_recommendations(self, sample_incident, temp_data_dir):
        """测试获取命令推荐"""
        db = Database(temp_data_dir / "test.db")
        engine = TroubleshootingEngine(sample_incident, db)
        
        recs = engine.get_command_recommendations('cpu')
        assert len(recs) > 0
        assert isinstance(recs[0], CommandRecommendation)
        assert recs[0].command == 'top'
    
    def test_invalid_stage_recommendations(self, sample_incident, temp_data_dir):
        """测试无效阶段的推荐"""
        db = Database(temp_data_dir / "test.db")
        engine = TroubleshootingEngine(sample_incident, db)
        
        with pytest.raises(InvalidStageError):
            engine.get_command_recommendations('invalid_stage')
    
    def test_execute_command(self, sample_incident, temp_data_dir):
        """测试执行命令"""
        db = Database(temp_data_dir / "test.db")
        engine = TroubleshootingEngine(sample_incident, db)
        
        sample_file, output = engine.execute_command('top', 'cpu')
        assert sample_file == 'top.txt'
        assert "load average" in output
    
    def test_analyze_choice(self, sample_incident, temp_data_dir):
        """测试分析用户选择"""
        db = Database(temp_data_dir / "test.db")
        engine = TroubleshootingEngine(sample_incident, db)
        engine.start_session()
        
        result = engine.analyze_choice(
            stage='cpu',
            command_used='top',
            sample_viewed='top.txt',
            user_analysis='I found high CPU usage in the top output'
        )
        
        assert result.stage == 'cpu'
        assert result.command_used == 'top'
        # 分析应该被评估
        assert hasattr(result, 'is_correct')


class TestCLIIntegration:
    """测试 CLI 集成"""
    
    def test_cli_import(self):
        """测试 CLI 可以导入"""
        from perf_trainer.cli import main
        assert main is not None
    
    def test_seed_generates_valid_structure(self, temp_data_dir):
        """测试 seed 生成有效的结构"""
        from perf_trainer.cli import _create_sample_incident_yaml, _create_sample_files
        
        # 测试生成的 YAML 可以被解析
        yaml_content = _create_sample_incident_yaml()
        assert 'name:' in yaml_content
        assert 'stages:' in yaml_content
        
        # 测试生成的样本文件
        sample_files = _create_sample_files()
        assert len(sample_files) > 0
        assert 'top_output.txt' in sample_files


class TestEdgeCases:
    """测试边界情况"""
    
    def test_empty_incident_directory(self, temp_data_dir):
        """测试空的 incident 目录"""
        empty_dir = temp_data_dir / "empty"
        empty_dir.mkdir()
        
        with pytest.raises(IncidentNotFoundError):
            parser = IncidentParser(empty_dir)
            parser.load()
    
    def test_incident_with_bad_stage_name(self, temp_data_dir):
        """测试包含无效阶段名称的 incident"""
        incident_dir = temp_data_dir / "bad_stage"
        samples_dir = incident_dir / "samples"
        samples_dir.mkdir(parents=True)
        
        bad_yaml = """name: Test
description: Test
root_cause: Test
difficulty: easy

stages:
  - name: invalid_stage_name
    description: Bad stage
    commands:
      - name: top
        description: Top
    expected_analysis: Test
    success_criteria: Test

samples: []
"""
        
        with open(incident_dir / "incident.yaml", 'w') as f:
            f.write(bad_yaml)
        
        with pytest.raises(InvalidIncidentFormatError) as exc_info:
            parser = IncidentParser(incident_dir)
            parser.load()
        
        assert "invalid_stage_name" in str(exc_info.value)
    
    def test_session_not_found(self, temp_data_dir):
        """测试会话不存在"""
        db = Database(temp_data_dir / "test.db")
        
        # 不存在的会话
        session = db.get_session(99999)
        assert session is None
