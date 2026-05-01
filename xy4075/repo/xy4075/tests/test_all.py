import pytest
import tempfile
import os
from pathlib import Path
from datetime import datetime

from serial_diagnostic.models import (
    ProtocolConfig, ProtocolType, ParsedFrame, ParsedSession,
    FrameDirection, FrameValidationResult, RegisterType,
    RegisterDefinition, FrameFormat
)
from serial_diagnostic.parser import (
    LogParserFactory, ModbusRTUParser, ModbusASCIIParser,
    CustomSerialParser, LogParserError
)
from serial_diagnostic.state_machine import (
    State, StateMachine, ModbusStateMachine, StateTransition,
    TransitionRule, StateStatus, TransitionType
)
from serial_diagnostic.fault_injection import (
    FaultInjectionManager, FaultInjectionConfig, FaultType,
    InjectionTriggerType, DropFrameInjector, DuplicateFrameInjector,
    CorruptCRCInjector, FaultInjectorFactory
)
from serial_diagnostic.analyzer import (
    ProtocolAnalyzer, TimeoutAnalyzer, OutOfOrderAnalyzer,
    DuplicateFrameAnalyzer, FrameValidationAnalyzer,
    AnomalyType, AnomalySeverity, Anomaly
)
from serial_diagnostic.replay import (
    ReplayScheduler, Breakpoint, BreakpointType, ReplayStatus
)
from serial_diagnostic.exporter import (
    MarkdownExporter, CSVExporter, JSONExporter, ReportExporter
)


class TestProtocolConfig:
    def test_default_config(self):
        config = ProtocolConfig()
        assert config.name == "default"
        assert config.protocol_type == ProtocolType.MODBUS_RTU
        assert config.baud_rate == 9600
        assert config.timeout_ms == 1000
    
    def test_custom_config(self):
        config = ProtocolConfig(
            name="test_config",
            protocol_type=ProtocolType.CUSTOM_SERIAL,
            baud_rate=19200,
            timeout_ms=500,
            slave_address_range=(1, 10),
            register_range=(0, 1000)
        )
        assert config.name == "test_config"
        assert config.protocol_type == ProtocolType.CUSTOM_SERIAL
        assert config.baud_rate == 19200
        assert config.slave_address_range == (1, 10)
        assert config.register_range == (0, 1000)
    
    def test_register_definition(self):
        reg = RegisterDefinition(
            address=100,
            name="Temperature",
            type=RegisterType.HOLDING_REGISTER,
            description="Temperature sensor",
            scale=0.1,
            unit="°C"
        )
        assert reg.address == 100
        assert reg.name == "Temperature"
        assert reg.type == RegisterType.HOLDING_REGISTER
        assert reg.scale == 0.1
    
    def test_frame_format(self):
        fmt = FrameFormat(
            name="test_pattern",
            pattern=r"^(\d+)\s+([0-9A-F]+)$",
            description="Test pattern"
        )
        assert fmt.name == "test_pattern"
        assert fmt.pattern == r"^(\d+)\s+([0-9A-F]+)$"
    
    def test_to_dict_from_dict(self):
        config = ProtocolConfig(
            name="test",
            protocol_type=ProtocolType.MODBUS_RTU,
            registers=[
                RegisterDefinition(address=0, name="Reg0", type=RegisterType.HOLDING_REGISTER)
            ]
        )
        data = config.to_dict()
        restored = ProtocolConfig.from_dict(data)
        assert restored.name == config.name
        assert restored.protocol_type == config.protocol_type


class TestParsedFrame:
    def test_create_frame(self):
        frame = ParsedFrame(
            raw_data=bytes([0x01, 0x03, 0x00, 0x00, 0x00, 0x02, 0xC4, 0x0B]),
            timestamp=100.0,
            direction=FrameDirection.REQUEST,
            slave_address=1,
            function_code="03",
            register_address=0,
            register_count=2,
            crc=0x0BC4
        )
        assert frame.slave_address == 1
        assert frame.function_code == "03"
        assert frame.register_address == 0
        assert frame.direction == FrameDirection.REQUEST
    
    def test_crc_calculation(self):
        frame = ParsedFrame(
            raw_data=bytes([0x01, 0x03, 0x00, 0x00, 0x00, 0x02, 0xC4, 0x0B]),
            timestamp=100.0,
            direction=FrameDirection.REQUEST
        )
        crc = frame.calculate_crc16()
        assert crc == 0x0BC4


class TestParsedSession:
    def test_create_session(self):
        frames = [
            ParsedFrame(raw_data=b'\x01', timestamp=1.0, direction=FrameDirection.REQUEST),
            ParsedFrame(raw_data=b'\x02', timestamp=2.0, direction=FrameDirection.RESPONSE),
        ]
        session = ParsedSession(
            session_id="test_session",
            start_time=1.0,
            end_time=2.0,
            frames=frames
        )
        assert session.frame_count == 2
        assert session.duration == 1.0
    
    def test_get_frames_by_slave(self):
        frames = [
            ParsedFrame(raw_data=b'\x01', timestamp=1.0, direction=FrameDirection.REQUEST, slave_address=1),
            ParsedFrame(raw_data=b'\x02', timestamp=2.0, direction=FrameDirection.RESPONSE, slave_address=2),
            ParsedFrame(raw_data=b'\x03', timestamp=3.0, direction=FrameDirection.REQUEST, slave_address=1),
        ]
        session = ParsedSession(session_id="test", frames=frames)
        slave_1_frames = session.get_frames_by_slave(1)
        assert len(slave_1_frames) == 2


class TestLogParser:
    def test_modbus_rtu_parser(self):
        config = ProtocolConfig(protocol_type=ProtocolType.MODBUS_RTU)
        parser = ModbusRTUParser(config)
        
        line = "2026-05-02 10:00:00.100 T 01 03 00 00 00 02 C4 0B"
        frame = parser.parse_line(line)
        
        assert frame is not None
        assert frame.slave_address == 1
        assert frame.function_code == "03"
        assert frame.direction == FrameDirection.REQUEST
    
    def test_parse_timestamp(self):
        config = ProtocolConfig()
        parser = ModbusRTUParser(config)
        
        ts1 = parser.parse_timestamp("2026-05-02 10:00:00.123456")
        ts2 = parser.parse_timestamp("10:00:00.123")
        ts3 = parser.parse_timestamp("1714644000.123")
        
        assert isinstance(ts1, float)
        assert isinstance(ts2, float)
        assert isinstance(ts3, float)
    
    def test_parse_hex_string(self):
        config = ProtocolConfig()
        parser = ModbusRTUParser(config)
        
        result = parser.parse_hex_string("01 03 00 00 00 02 C4 0B")
        assert result == bytes([0x01, 0x03, 0x00, 0x00, 0x00, 0x02, 0xC4, 0x0B])
    
    def test_parse_file(self, tmp_path):
        config = ProtocolConfig(protocol_type=ProtocolType.MODBUS_RTU)
        parser = ModbusRTUParser(config)
        
        log_content = """2026-05-02 10:00:00.100 T 01 03 00 00 00 02 C4 0B
2026-05-02 10:00:00.150 R 01 03 04 00 01 00 02 79 79
"""
        
        log_file = tmp_path / "test_log.txt"
        log_file.write_text(log_content)
        
        session = parser.parse_file(log_file)
        assert session.frame_count == 2


class TestStateMachine:
    def test_modbus_state_machine_initial_state(self):
        sm = ModbusStateMachine()
        current = sm.get_current_state()
        assert current is not None
        assert current.name == "IDLE"
    
    def test_state_transition(self):
        sm = ModbusStateMachine()
        
        success = sm.trigger("send_request")
        assert success is True
        
        current = sm.get_current_state()
        assert current.name == "REQUEST_SENT"
        
        success = sm.trigger("valid_response")
        assert success is True
        
        current = sm.get_current_state()
        assert current.name == "RESPONSE_RECEIVED"
    
    def test_invalid_transition(self):
        sm = ModbusStateMachine()
        
        success = sm.trigger("unknown_trigger")
        assert success is False
        
        history = sm.get_history()
        assert len(history) >= 1
        assert history[-1].is_valid is False
    
    def test_get_valid_transitions(self):
        sm = ModbusStateMachine()
        
        transitions = sm.get_valid_transitions("send_request")
        assert len(transitions) == 1
        
        sm.trigger("send_request")
        transitions = sm.get_valid_transitions("valid_response")
        assert len(transitions) == 1


class TestFaultInjection:
    def test_drop_frame_injector(self):
        frame = ParsedFrame(
            raw_data=b'\x01\x03\x00\x00\x00\x02\xC4\x0B',
            timestamp=1.0,
            direction=FrameDirection.REQUEST
        )
        config = FaultInjectionConfig(
            fault_type=FaultType.DROP_FRAME,
            trigger_type=InjectionTriggerType.FRAME_INDEX,
            trigger_value=0
        )
        
        injector = DropFrameInjector()
        result = injector.apply(frame, config)
        
        assert len(result) == 0
    
    def test_duplicate_frame_injector(self):
        frame = ParsedFrame(
            raw_data=b'\x01\x03\x00\x00\x00\x02\xC4\x0B',
            timestamp=1.0,
            direction=FrameDirection.REQUEST
        )
        config = FaultInjectionConfig(
            fault_type=FaultType.DUPLICATE_FRAME,
            trigger_type=InjectionTriggerType.FRAME_INDEX,
            trigger_value=0,
            parameters={'count': 3}
        )
        
        injector = DuplicateFrameInjector()
        result = injector.apply(frame, config)
        
        assert len(result) == 3
        assert all(f.metadata.get('is_duplicate') for f in result)
    
    def test_corrupt_crc_injector(self):
        frame = ParsedFrame(
            raw_data=b'\x01\x03\x00\x00\x00\x02\xC4\x0B',
            timestamp=1.0,
            direction=FrameDirection.REQUEST,
            crc=0x0BC4
        )
        config = FaultInjectionConfig(
            fault_type=FaultType.CORRUPT_CRC,
            trigger_type=InjectionTriggerType.FRAME_INDEX,
            trigger_value=0
        )
        
        injector = CorruptCRCInjector()
        result = injector.apply(frame, config)
        
        assert len(result) == 1
        assert result[0].metadata.get('crc_corrupted') is True
        assert result[0].raw_data != frame.raw_data
    
    def test_fault_injection_manager(self):
        manager = FaultInjectionManager()
        
        config = FaultInjectionConfig(
            fault_type=FaultType.DROP_FRAME,
            trigger_type=InjectionTriggerType.FRAME_INDEX,
            trigger_value=5
        )
        manager.add_config(config)
        
        frame = ParsedFrame(
            raw_data=b'\x01\x03\x00\x00\x00\x02\xC4\x0B',
            timestamp=1.0,
            direction=FrameDirection.REQUEST
        )
        
        result = manager.process_frame(frame, 0, 1.0, 1.0)
        assert len(result) == 1
        
        result = manager.process_frame(frame, 5, 1.0, 1.0)
        assert len(result) == 0


class TestAnalyzer:
    def test_timeout_analyzer(self):
        config = ProtocolConfig(timeout_ms=500)
        analyzer = TimeoutAnalyzer(timeout_ms=500)
        
        frames = [
            ParsedFrame(
                raw_data=b'\x01\x03\x00\x00\x00\x02\xC4\x0B',
                timestamp=0.0,
                direction=FrameDirection.REQUEST,
                slave_address=1,
                function_code="03"
            ),
            ParsedFrame(
                raw_data=b'\x01\x03\x04\x00\x01\x00\x02\x79\x79',
                timestamp=1.0,
                direction=FrameDirection.RESPONSE,
                slave_address=1,
                function_code="03"
            ),
        ]
        
        session = ParsedSession(session_id="test", frames=frames)
        anomalies = analyzer.analyze(session, config)
        
        assert len(anomalies) >= 1
        assert any(a.anomaly_type == AnomalyType.TIMEOUT for a in anomalies)
    
    def test_out_of_order_analyzer(self):
        config = ProtocolConfig()
        analyzer = OutOfOrderAnalyzer()
        
        frames = [
            ParsedFrame(raw_data=b'\x01', timestamp=2.0, direction=FrameDirection.REQUEST),
            ParsedFrame(raw_data=b'\x02', timestamp=1.0, direction=FrameDirection.RESPONSE),
        ]
        
        session = ParsedSession(session_id="test", frames=frames)
        anomalies = analyzer.analyze(session, config)
        
        assert len(anomalies) >= 1
        assert anomalies[0].anomaly_type == AnomalyType.OUT_OF_ORDER
    
    def test_duplicate_frame_analyzer(self):
        config = ProtocolConfig()
        analyzer = DuplicateFrameAnalyzer(time_window_ms=1000)
        
        frame_data = b'\x01\x03\x00\x00\x00\x02\xC4\x0B'
        frames = [
            ParsedFrame(
                raw_data=frame_data,
                timestamp=0.0,
                direction=FrameDirection.REQUEST,
                slave_address=1,
                function_code="03"
            ),
            ParsedFrame(
                raw_data=frame_data,
                timestamp=0.05,
                direction=FrameDirection.REQUEST,
                slave_address=1,
                function_code="03"
            ),
        ]
        
        session = ParsedSession(session_id="test", frames=frames)
        anomalies = analyzer.analyze(session, config)
        
        assert len(anomalies) >= 1
        assert anomalies[0].anomaly_type == AnomalyType.DUPLICATE_FRAME
    
    def test_protocol_analyzer(self):
        config = ProtocolConfig(timeout_ms=500)
        analyzer = ProtocolAnalyzer(config, timeout_ms=500)
        
        frames = [
            ParsedFrame(
                raw_data=b'\x01\x03\x00\x00\x00\x02\xC4\x0B',
                timestamp=0.0,
                direction=FrameDirection.REQUEST,
                slave_address=1,
                function_code="03"
            ),
            ParsedFrame(
                raw_data=b'\x01\x03\x04\x00\x01\x00\x02\x79\x79',
                timestamp=0.1,
                direction=FrameDirection.RESPONSE,
                slave_address=1,
                function_code="03"
            ),
        ]
        
        session = ParsedSession(session_id="test", frames=frames)
        result = analyzer.analyze(session)
        
        assert result.session_id == "test"
        assert result.total_frames == 2


class TestReplayScheduler:
    def test_scheduler_initialization(self):
        frames = [
            ParsedFrame(raw_data=b'\x01', timestamp=1.0, direction=FrameDirection.REQUEST),
            ParsedFrame(raw_data=b'\x02', timestamp=2.0, direction=FrameDirection.RESPONSE),
        ]
        session = ParsedSession(session_id="test", frames=frames)
        
        scheduler = ReplayScheduler(session)
        
        assert scheduler.status == ReplayStatus.IDLE
        assert scheduler.current_frame_index == 0
        assert scheduler.speed_multiplier == 1.0
    
    def test_speed_multiplier(self):
        session = ParsedSession(session_id="test", frames=[])
        scheduler = ReplayScheduler(session)
        
        scheduler.speed_multiplier = 2.0
        assert scheduler.speed_multiplier == 2.0
        
        with pytest.raises(ValueError):
            scheduler.speed_multiplier = 0.0
    
    def test_add_breakpoint(self):
        session = ParsedSession(session_id="test", frames=[])
        scheduler = ReplayScheduler(session)
        
        bp = Breakpoint(
            breakpoint_type=BreakpointType.FRAME_INDEX,
            value=5,
            name="Test BP"
        )
        scheduler.add_breakpoint(bp)
        
        assert len(scheduler._breakpoints) == 1
    
    def test_step(self):
        frames = [
            ParsedFrame(raw_data=b'\x01', timestamp=1.0, direction=FrameDirection.REQUEST),
            ParsedFrame(raw_data=b'\x02', timestamp=2.0, direction=FrameDirection.RESPONSE),
            ParsedFrame(raw_data=b'\x03', timestamp=3.0, direction=FrameDirection.REQUEST),
        ]
        session = ParsedSession(session_id="test", frames=frames)
        
        scheduler = ReplayScheduler(session)
        
        assert scheduler.current_frame_index == 0
        
        result = scheduler.step()
        assert result is True
        assert scheduler.current_frame_index == 1
        
        result = scheduler.step()
        assert result is True
        assert scheduler.current_frame_index == 2
        
        result = scheduler.step()
        assert result is False
    
    def test_reset(self):
        frames = [
            ParsedFrame(raw_data=b'\x01', timestamp=1.0, direction=FrameDirection.REQUEST),
        ]
        session = ParsedSession(session_id="test", frames=frames)
        
        scheduler = ReplayScheduler(session)
        scheduler.step()
        
        assert scheduler.current_frame_index == 1
        
        scheduler.reset()
        
        assert scheduler.current_frame_index == 0
        assert scheduler.status == ReplayStatus.IDLE


class TestExporter:
    def test_csv_exporter(self, tmp_path):
        anomalies = [
            Anomaly(
                anomaly_type=AnomalyType.TIMEOUT,
                severity=AnomalySeverity.HIGH,
                timestamp=1.0,
                frame_index=0,
                message="Test timeout anomaly"
            )
        ]
        
        result = AnalysisResult(
            session_id="test",
            total_frames=10,
            valid_frames=8,
            invalid_frames=2,
            anomalies=anomalies
        )
        
        exporter = CSVExporter(result)
        output_path = tmp_path / "test.csv"
        exporter.export(output_path)
        
        assert output_path.exists()
        
        with open(output_path, 'r') as f:
            content = f.read()
            assert "timeout" in content.lower()
            assert "Test timeout anomaly" in content
    
    def test_json_exporter(self, tmp_path):
        anomalies = [
            Anomaly(
                anomaly_type=AnomalyType.CRC_ERROR,
                severity=AnomalySeverity.HIGH,
                timestamp=2.0,
                frame_index=1,
                message="Test CRC error"
            )
        ]
        
        result = AnalysisResult(
            session_id="test_export",
            total_frames=20,
            valid_frames=18,
            invalid_frames=2,
            anomalies=anomalies
        )
        
        exporter = JSONExporter(result)
        output_path = tmp_path / "test.json"
        exporter.export(output_path)
        
        assert output_path.exists()
        
        import json
        with open(output_path, 'r') as f:
            data = json.load(f)
            assert data['session_id'] == "test_export"
            assert len(data['analysis']['anomalies']) == 1
    
    def test_markdown_exporter(self, tmp_path):
        anomalies = [
            Anomaly(
                anomaly_type=AnomalyType.DUPLICATE_FRAME,
                severity=AnomalySeverity.MEDIUM,
                timestamp=3.0,
                frame_index=2,
                message="Duplicate frame detected"
            )
        ]
        
        result = AnalysisResult(
            session_id="test_md",
            total_frames=15,
            valid_frames=14,
            invalid_frames=1,
            anomalies=anomalies
        )
        
        exporter = MarkdownExporter(result)
        output_path = tmp_path / "test.md"
        exporter.export(output_path)
        
        assert output_path.exists()
        
        with open(output_path, 'r') as f:
            content = f.read()
            assert "串口协议诊断报告" in content
            assert "test_md" in content
            assert "Duplicate frame detected" in content
    
    def test_report_exporter(self, tmp_path):
        result = AnalysisResult(
            session_id="full_test",
            total_frames=100,
            valid_frames=95,
            invalid_frames=5,
            anomalies=[]
        )
        
        exporter = ReportExporter(analysis_result=result)
        base_path = tmp_path / "report"
        
        paths = exporter.export_all(base_path)
        
        assert 'markdown' in paths
        assert 'csv' in paths
        assert 'json' in paths
        
        for path in paths.values():
            assert path.exists()
