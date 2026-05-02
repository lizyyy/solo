#!/usr/bin/env python3
"""验证所有模块的导入"""

import sys
from pathlib import Path

project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

def test_imports():
    errors = []
    successes = []
    
    tests = [
        ("event_simulator.__version__", "from event_simulator import __version__"),
        ("models.Camera", "from event_simulator.models import Camera, Area, Event, EventType, EventSeverity, EventTemplate, JitterRule, Scenario, AppConfig, InitConfig"),
        ("models.Camera.to_dict", "from event_simulator.models.camera import Camera; c = Camera(id='test', name='Test', location='Test'); d = c.to_dict()"),
        ("scenario_parser.ScenarioParser", "from event_simulator.scenario_parser import ScenarioParser"),
        ("replay_scheduler.ReplayScheduler", "from event_simulator.replay_scheduler import ReplayScheduler, ReplayStatus, ReplayState"),
        ("validation.Validator", "from event_simulator.validation import Validator, ValidationResult, OutOfOrderRule, DuplicateRule, MissingFieldRule, RuleConflictRule"),
        ("state_storage.StateStorage", "from event_simulator.state_storage import StateStorage, ReplayCheckpoint"),
        ("reporter.ReportGenerator", "from event_simulator.reporter import ReportGenerator"),
        ("test_data.samples", """
from typing import List, Optional
from datetime import datetime, timedelta
from event_simulator.test_data.samples import create_sample_event_stream
events = create_sample_event_stream(duration_minutes=1)
"""),
    ]
    
    for name, code in tests:
        try:
            exec(code)
            successes.append(name)
            print(f"✅ {name}")
        except Exception as e:
            errors.append((name, str(e)))
            print(f"❌ {name}: {e}")
    
    print("\n" + "="*50)
    print(f"成功: {len(successes)}/{len(tests)}")
    print(f"失败: {len(errors)}/{len(tests)}")
    
    if errors:
        print("\n错误详情:")
        for name, error in errors:
            print(f"  - {name}: {error}")
        sys.exit(1)
    else:
        print("\n🎉 所有模块导入成功!")
        sys.exit(0)

if __name__ == "__main__":
    test_imports()
