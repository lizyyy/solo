"""核心模块单元测试"""

import tempfile
import shutil
from pathlib import Path
from datetime import datetime

import pytest

from offline_sync_repair.utils import calculate_file_hash, calculate_string_hash, load_json, save_json
from offline_sync_repair.tile_index import TileIndexManager, TileInfo, ParcelInfo, TaskInfo, RollbackPackage
from offline_sync_repair.log_parser import LogParser, LogEvent, TerminalStatus, LogEventType
from offline_sync_repair.rules_engine import RulesEngine, CheckReport, CheckResult, CheckSeverity, CheckCategory
from offline_sync_repair.patch_plan import PatchPlanner, PatchAction, PatchActionType, PatchPriority
from offline_sync_repair.executor import DryRunExecutor, ExecutionResult, JournalEntry, ExecutionStatus
from offline_sync_repair.reporter import Reporter, ReportPackage


@pytest.fixture
def temp_dir():
    """创建临时目录"""
    dir_path = Path(tempfile.mkdtemp(prefix="offline_sync_test_"))
    yield dir_path
    shutil.rmtree(dir_path, ignore_errors=True)


@pytest.fixture
def sample_geojson():
    """示例GeoJSON数据"""
    return {
        "type": "Feature",
        "properties": {
            "parcel_id": "TEST_001",
            "name": "测试地块",
            "version": "1.0.0",
            "required_zoom_levels": [14, 15, 16]
        },
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [116.397, 39.908],
                    [116.407, 39.908],
                    [116.407, 39.918],
                    [116.397, 39.918],
                    [116.397, 39.908]
                ]
            ]
        }
    }


class TestUtils:
    """工具函数测试"""

    def test_calculate_string_hash(self):
        """测试字符串哈希计算"""
        content = "test content"
        hash1 = calculate_string_hash(content)
        hash2 = calculate_string_hash(content)
        assert hash1 == hash2
        assert len(hash1) == 64  # SHA256

    def test_calculate_file_hash(self, temp_dir):
        """测试文件哈希计算"""
        test_file = temp_dir / "test.txt"
        test_file.write_text("test file content")
        hash_value = calculate_file_hash(test_file)
        assert len(hash_value) == 64

    def test_save_and_load_json(self, temp_dir):
        """测试JSON保存和加载"""
        test_data = {"key": "value", "list": [1, 2, 3]}
        test_file = temp_dir / "test.json"
        save_json(test_data, test_file)
        loaded = load_json(test_file)
        assert loaded == test_data

    def test_get_file_size_str(self):
        """测试文件大小格式化"""
        from offline_sync_repair.utils import get_file_size_str
        assert get_file_size_str(1024) == "1.00 KB"
        assert get_file_size_str(1024 * 1024) == "1.00 MB"
        assert get_file_size_str(512) == "512.00 B"


class TestTileIndex:
    """瓦片索引测试"""

    def test_tile_info(self):
        """测试瓦片信息数据类"""
        tile = TileInfo(z=14, x=13713, y=6589, hash="abc123", size=1024)
        assert tile.key == (14, 13713, 6589)
        assert tile.tile_id == "14/13713/6589"

    def test_parcel_info(self):
        """测试地块信息数据类"""
        parcel = ParcelInfo(
            parcel_id="P001",
            name="测试地块",
            version="1.0.0",
            geojson_path=Path("/tmp/test.geojson"),
            hash="abc123",
            bounding_box=(116.0, 39.0, 117.0, 40.0),
            geometry={}
        )
        assert parcel.parcel_key == "P001_v1.0.0"

    def test_tile_index_manager_init(self, temp_dir):
        """测试瓦片索引管理器初始化"""
        manager = TileIndexManager(temp_dir)
        assert manager.work_dir == temp_dir
        assert len(manager.tile_cache) == 0
        assert len(manager.parcels) == 0

    def test_scan_parcels(self, temp_dir, sample_geojson):
        """测试扫描地块"""
        parcels_dir = temp_dir / "parcels"
        parcels_dir.mkdir()
        
        from offline_sync_repair.utils import save_json
        save_json(sample_geojson, parcels_dir / "test.geojson")
        
        manager = TileIndexManager(temp_dir)
        count = manager.scan_parcels(parcels_dir)
        
        assert count == 1
        assert len(manager.parcels) == 1

    def test_calculate_required_tiles(self):
        """测试计算所需瓦片"""
        parcel = ParcelInfo(
            parcel_id="P001",
            name="测试",
            version="1.0.0",
            geojson_path=Path("/tmp/test.geojson"),
            hash="abc123",
            bounding_box=(116.397, 39.908, 116.407, 39.918),
            geometry={},
            required_zoom_levels=[14]
        )
        
        manager = TileIndexManager(Path("/tmp"))
        tiles = manager.calculate_required_tiles(parcel)
        
        assert len(tiles) > 0


class TestLogParser:
    """日志解析器测试"""

    def test_log_event_type(self):
        """测试日志事件类型枚举"""
        assert LogEventType.ERROR.value == "error"
        assert LogEventType.TILE_DOWNLOAD_SUCCESS.value == "tile_download_success"

    def test_terminal_status(self):
        """测试终端状态数据类"""
        status = TerminalStatus(
            terminal_id="T001",
            status="online",
            assigned_tasks=["TASK_001"],
            completed_tasks=["TASK_002"]
        )
        assert status.terminal_id == "T001"
        assert len(status.assigned_tasks) == 1

    def test_log_parser_init(self, temp_dir):
        """测试日志解析器初始化"""
        parser = LogParser(temp_dir)
        assert parser.work_dir == temp_dir
        assert len(parser.events) == 0

    def test_parse_line(self, temp_dir):
        """测试解析单行日志"""
        parser = LogParser(temp_dir)
        
        line = "2024-03-15 08:00:00 [INFO] terminal T001: 终端启动"
        event = parser._parse_line(line, 1, None)
        
        assert event is not None
        assert event.terminal_id == "T001"

    def test_build_terminal_status(self, temp_dir):
        """测试构建终端状态"""
        parser = LogParser(temp_dir)
        
        event = LogEvent(
            timestamp=datetime.now(),
            terminal_id="T001",
            event_type=LogEventType.TERMINAL_STARTUP,
            message="终端启动",
            raw_line="test"
        )
        parser.events.append(event)
        
        terminals = parser.build_terminal_status()
        
        assert "T001" in terminals
        assert terminals["T001"].status == "online"


class TestRulesEngine:
    """规则引擎测试"""

    def test_check_severity(self):
        """测试检查严重程度枚举"""
        assert CheckSeverity.CRITICAL.value == "critical"
        assert CheckSeverity.ERROR.value == "error"
        assert CheckSeverity.WARNING.value == "warning"
        assert CheckSeverity.INFO.value == "info"

    def test_check_category(self):
        """测试检查类别枚举"""
        assert CheckCategory.TILE_COVERAGE.value == "tile_coverage"
        assert CheckCategory.VERSION.value == "version"
        assert CheckCategory.TASK.value == "task"

    def test_check_result(self):
        """测试检查结果数据类"""
        result = CheckResult(
            check_id="test_001",
            category=CheckCategory.TILE_COVERAGE,
            severity=CheckSeverity.ERROR,
            title="测试问题",
            message="测试消息",
            recommendation="测试建议"
        )
        assert result.check_id == "test_001"
        assert result.severity == CheckSeverity.ERROR

    def test_rules_engine_init(self, temp_dir):
        """测试规则引擎初始化"""
        manager = TileIndexManager(temp_dir)
        parser = LogParser(temp_dir)
        engine = RulesEngine(manager, parser)
        
        assert engine.tile_manager == manager
        assert engine.log_parser == parser


class TestPatchPlan:
    """修补计划测试"""

    def test_patch_action_type(self):
        """测试修补操作类型枚举"""
        assert PatchActionType.ADD_TILE.value == "add_tile"
        assert PatchActionType.UPDATE_PARCEL.value == "update_parcel"

    def test_patch_priority(self):
        """测试修补优先级枚举"""
        assert PatchPriority.CRITICAL.value == "critical"
        assert PatchPriority.HIGH.value == "high"

    def test_patch_action(self):
        """测试修补操作数据类"""
        action = PatchAction(
            action_id="act_001",
            action_type=PatchActionType.ADD_TILE,
            priority=PatchPriority.HIGH,
            target_terminal="T001",
            description="添加瓦片"
        )
        assert action.action_id == "act_001"
        assert action.target_terminal == "T001"


class TestExecutor:
    """演练执行器测试"""

    def test_execution_status(self):
        """测试执行状态枚举"""
        assert ExecutionStatus.SUCCESS.value == "success"
        assert ExecutionStatus.FAILED.value == "failed"

    def test_journal_entry(self):
        """测试日志条目数据类"""
        entry = JournalEntry(
            timestamp=datetime.now(),
            action_id="act_001",
            action_type="add_tile",
            status=ExecutionStatus.SUCCESS,
            message="执行成功"
        )
        assert entry.action_id == "act_001"
        assert entry.status == ExecutionStatus.SUCCESS

    def test_executor_init(self, temp_dir):
        """测试执行器初始化"""
        executor = DryRunExecutor(temp_dir, temp_dir)
        assert executor.work_dir == temp_dir
        assert executor.source_dir == temp_dir


class TestReporter:
    """报告生成器测试"""

    def test_reporter_init(self, temp_dir):
        """测试报告生成器初始化"""
        reporter = Reporter(temp_dir)
        assert reporter.work_dir == temp_dir

    def test_report_package(self):
        """测试报告包数据类"""
        package = ReportPackage(
            report_id="rep_001",
            generated_at=datetime.now(),
            output_dir=Path("/tmp")
        )
        assert package.report_id == "rep_001"
        assert len(package.files) == 0


class TestIntegration:
    """集成测试"""

    def test_full_workflow_simulation(self, temp_dir):
        """测试完整工作流程模拟"""
        source_dir = temp_dir / "source"
        work_dir = temp_dir / "work"
        
        (source_dir / "parcels").mkdir(parents=True)
        (source_dir / "tiles").mkdir(parents=True)
        (source_dir / "tasks").mkdir(parents=True)
        (source_dir / "logs").mkdir(parents=True)
        
        parcel_data = {
            "type": "Feature",
            "properties": {
                "parcel_id": "INT_001",
                "name": "集成测试地块",
                "version": "1.0.0"
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [
                    [[116.397, 39.908], [116.407, 39.908],
                     [116.407, 39.918], [116.397, 39.918],
                     [116.397, 39.908]]
                ]
            }
        }
        
        from offline_sync_repair.utils import save_json
        save_json(parcel_data, source_dir / "parcels" / "parcel_001.geojson")
        
        tile_dir = source_dir / "tiles" / "14" / "13713"
        tile_dir.mkdir(parents=True)
        (tile_dir / "6589.png").write_text("test tile")
        
        manager = TileIndexManager(work_dir)
        tile_count = manager.scan_tiles(source_dir / "tiles")
        parcel_count = manager.scan_parcels(source_dir / "parcels")
        
        assert tile_count == 1
        assert parcel_count == 1
        
        manager.save_index()
        
        loaded_manager = TileIndexManager(work_dir)
        assert loaded_manager.load_index() == True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
