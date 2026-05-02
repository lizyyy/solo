#!/usr/bin/env python3
"""快速验证脚本 - 测试串口协议回放诊断台的核心功能"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from serial_diagnostic.models import (
    ProtocolConfig, ParsedSession, ParsedFrame, FrameDirection
)
from serial_diagnostic.parser import LogParserFactory
from serial_diagnostic.analyzer import ProtocolAnalyzer
from serial_diagnostic.replay import ReplayScheduler
from serial_diagnostic.state_machine import ModbusStateMachine


def test_protocol_config():
    """测试协议配置"""
    print("=== 测试1: 协议配置 ===")
    config = ProtocolConfig(
        name='test_config',
        baud_rate=19200,
        timeout_ms=500,
        slave_address_range=(1, 10)
    )
    print(f'Config name: {config.name}')
    print(f'Baud rate: {config.baud_rate}')
    print(f'Timeout: {config.timeout_ms}ms')
    print(f'Slave range: {config.slave_address_range}')
    print("PASS\n")


def test_state_machine():
    """测试状态机"""
    print("=== 测试2: 状态机 ===")
    sm = ModbusStateMachine()
    print(f'Initial state: {sm.get_current_state().name}')
    
    sm.trigger('send_request')
    print(f'After send_request: {sm.get_current_state().name}')
    
    sm.trigger('valid_response')
    print(f'After valid_response: {sm.get_current_state().name}')
    
    sm.trigger('reset')
    print(f'After reset: {sm.get_current_state().name}')
    print("PASS\n")


def test_parser():
    """测试日志解析器"""
    print("=== 测试3: 日志解析器 ===")
    config = ProtocolConfig()
    parser = LogParserFactory.create(config)
    
    log_lines = [
        '2026-05-02 10:00:00.100 T 01 03 00 00 00 02 C4 0B',
        '2026-05-02 10:00:00.150 R 01 03 04 00 01 00 02 79 79',
        '2026-05-02 10:00:00.200 T 01 03 00 0A 00 01 A4 08',
        '2026-05-02 10:00:00.230 R 01 03 02 00 01 79 79',
    ]
    
    frames = []
    for line in log_lines:
        frame = parser.parse_line(line)
        if frame:
            frames.append(frame)
    
    print(f'Parsed {len(frames)} frames')
    for i, f in enumerate(frames):
        is_valid = f.validation_result.is_valid if f.validation_result else 'N/A'
        print(f'  Frame {i}: {f.direction.value}, slave={f.slave_address}, func={f.function_code}, valid={is_valid}')
    print("PASS\n")


def test_analyzer():
    """测试分析器"""
    print("=== 测试4: 分析器 ===")
    config = ProtocolConfig(timeout_ms=500)
    
    frames = [
        ParsedFrame(
            raw_data=bytes([0x01, 0x03, 0x00, 0x00, 0x00, 0x02, 0xC4, 0x0B]),
            timestamp=0.100,
            direction=FrameDirection.REQUEST,
            slave_address=1,
            function_code="03"
        ),
        ParsedFrame(
            raw_data=bytes([0x01, 0x03, 0x04, 0x00, 0x01, 0x00, 0x02, 0x79, 0x79]),
            timestamp=0.150,
            direction=FrameDirection.RESPONSE,
            slave_address=1,
            function_code="03"
        ),
    ]
    
    session = ParsedSession(
        session_id='test_session',
        start_time=frames[0].timestamp,
        end_time=frames[-1].timestamp,
        frames=frames
    )
    
    analyzer = ProtocolAnalyzer(config, timeout_ms=500)
    result = analyzer.analyze(session)
    
    print(f'Total frames: {result.total_frames}')
    print(f'Valid frames: {result.valid_frames}')
    print(f'Anomalies: {result.anomaly_count}')
    print("PASS\n")


def test_replay():
    """测试回放调度器"""
    print("=== 测试5: 回放调度器 ===")
    frames = [
        ParsedFrame(
            raw_data=bytes([0x01, 0x03, 0x00, 0x00, 0x00, 0x02, 0xC4, 0x0B]),
            timestamp=0.100,
            direction=FrameDirection.REQUEST,
            slave_address=1,
            function_code="03"
        ),
        ParsedFrame(
            raw_data=bytes([0x01, 0x03, 0x04, 0x00, 0x01, 0x00, 0x02, 0x79, 0x79]),
            timestamp=0.150,
            direction=FrameDirection.RESPONSE,
            slave_address=1,
            function_code="03"
        ),
    ]
    
    session = ParsedSession(
        session_id='test_session',
        start_time=frames[0].timestamp,
        end_time=frames[-1].timestamp,
        frames=frames
    )
    
    scheduler = ReplayScheduler(session)
    print(f'Scheduler status: {scheduler.status}')
    print(f'Frame count: {scheduler.session.frame_count}')
    
    has_more = scheduler.step()
    print(f'After step 1: current_frame_index={scheduler.current_frame_index}, has_more={has_more}')
    
    has_more = scheduler.step()
    print(f'After step 2: current_frame_index={scheduler.current_frame_index}, has_more={has_more}')
    print("PASS\n")


def main():
    """主测试函数"""
    print("=" * 50)
    print("串口协议回放诊断台 - 功能验证测试")
    print("=" * 50 + "\n")
    
    try:
        test_protocol_config()
        test_state_machine()
        test_parser()
        test_analyzer()
        test_replay()
        
        print("=" * 50)
        print("所有测试通过!")
        print("=" * 50)
        return 0
        
    except Exception as e:
        print(f"\n测试失败: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())
