---
name: "recording-studio-automation"
description: "配音棚自动化工具，整合台词改动CSV、演员档期JSON、WAV元数据和客户清单，判断今日可录音段落，导出Markdown日程和JSON明细。Invoke when user needs to manage recording studio scheduling, check availability, or generate recording schedules."
---

# 录音棚自动化工具 (Recording Studio Automation)

## 概述

本工具为小型配音棚设计，整合多种数据源，自动化判断录音可行性，生成录音日程单和明细报表。

## 核心功能

1. **多数据源整合**
   - 导演台词改动 CSV
   - 演员档期 JSON
   - 录音文件夹 WAV 元数据
   - 客户交付清单

2. **智能判断**
   - 今日可录音段落识别
   - 缺人/文件错误检测
   - 命名规范验证

3. **数据持久化**
   - 保存人工备注
   - 重跑不丢失历史数据
   - 增量更新支持

4. **多格式导出**
   - Markdown 录音日程单
   - JSON 明细数据

## 数据结构定义

### 1. 台词改动 CSV 格式
```csv
episode_id,scene_id,line_id,character_name,original_text,modified_text,status,modified_date,notes
EP01,SC01,L001,张三,你好,您好,modified,2026-05-04,导演调整语气
EP01,SC01,L002,李四,再见,后会有期,pending,2026-05-05,待确认
EP01,SC02,L003,王五,请进,请进来,approved,2026-05-03,已确认
```

### 2. 演员档期 JSON 格式
```json
{
  "actors": [
    {
      "actor_id": "A001",
      "name": "张三",
      "character_name": "张三",
      "availability": [
        {
          "date": "2026-05-05",
          "time_slots": ["09:00-12:00", "14:00-18:00"],
          "status": "available"
        },
        {
          "date": "2026-05-06",
          "time_slots": [],
          "status": "unavailable",
          "reason": "外出拍摄"
        }
      ],
      "contact": {
        "phone": "13800138000",
        "email": "zhangsan@example.com"
      }
    }
  ],
  "last_updated": "2026-05-04T18:00:00Z"
}
```

### 3. WAV 文件元数据规范
- **命名格式**: `{episode_id}_{scene_id}_{line_id}_{character_name}_{take_number}.wav`
- **示例**: `EP01_SC01_L001_张三_01.wav`
- **元数据字段**:
  - 采样率 (Sample Rate): 48000 Hz
  - 位深度 (Bit Depth): 24 bit
  - 声道 (Channels): 1 (Mono) 或 2 (Stereo)
  - 时长 (Duration): 自动计算

### 4. 客户交付清单 JSON 格式
```json
{
  "project_id": "PJ2026001",
  "project_name": "某动画第1季",
  "client": "某动画公司",
  "delivery_deadline": "2026-06-30",
  "episodes": [
    {
      "episode_id": "EP01",
      "episode_name": "第一集：相遇",
      "deadline": "2026-05-15",
      "status": "in_progress",
      "scenes": [
        {
          "scene_id": "SC01",
          "lines_required": 10,
          "lines_completed": 5,
          "priority": "high"
        }
      ]
    }
  ]
}
```

## 工作流程

### 1. 初始化项目
```bash
studio-recording init --project-dir ./my-project
```

创建以下目录结构：
```
my-project/
├── config/
│   └── settings.json
├── data/
│   ├── script_changes/      # CSV 文件
│   ├── actor_schedules/      # JSON 文件
│   ├── audio_files/          # WAV 文件
│   └── delivery_lists/       # JSON 文件
├── output/
│   ├── schedules/            # Markdown 日程
│   ├── reports/              # JSON 明细
│   └── logs/                 # 运行日志
├── notes/                    # 人工备注
└── .state/                   # 状态持久化
```

### 2. 配置设置
编辑 `config/settings.json`：
```json
{
  "project_name": "我的配音项目",
  "today_date": "auto",  // 自动使用系统日期
  "wav_naming_pattern": "{episode_id}_{scene_id}_{line_id}_{character_name}_{take_number}.wav",
  "required_audio_specs": {
    "sample_rate": 48000,
    "bit_depth": 24,
    "channels": [1, 2]
  },
  "output_formats": ["markdown", "json"]
}
```

### 3. 运行完整检查
```bash
studio-recording check --all
```

执行以下步骤：
1. **加载数据源**
   - 读取所有台词改动 CSV
   - 读取演员档期 JSON
   - 扫描录音文件夹获取 WAV 元数据
   - 读取客户交付清单

2. **数据验证**
   - 检查 CSV 格式正确性
   - 验证演员档期冲突
   - 校验 WAV 文件名规范
   - 检查音频技术规格

3. **智能分析**
   - 匹配台词与演员
   - 判断今日可录音段落
   - 识别缺人/缺文件情况
   - 标记命名错误文件

4. **生成报告**
   - 输出 Markdown 录音日程单
   - 输出 JSON 明细数据
   - 保存运行状态

### 4. 保存人工备注
```bash
studio-recording note add --line-id L001 --content "演员迟到，改到下午"
studio-recording note list
```

### 5. 导出报告
```bash
studio-recording export --format markdown --output ./output/schedule.md
studio-recording export --format json --output ./output/details.json
```

## 状态持久化机制

### 状态文件格式 (.state/state.json)
```json
{
  "last_run": "2026-05-05T10:30:00Z",
  "checksum": {
    "script_changes": "abc123...",
    "actor_schedules": "def456...",
    "audio_files": "ghi789..."
  },
  "notes": [
    {
      "id": "N001",
      "line_id": "L001",
      "content": "演员迟到，改到下午",
      "created_at": "2026-05-05T09:00:00Z",
      "updated_at": "2026-05-05T09:00:00Z"
    }
  ],
  "history": [
    {
      "run_id": "RUN20260505001",
      "timestamp": "2026-05-05T10:30:00Z",
      "summary": {
        "total_lines": 100,
        "recordable_today": 45,
        "missing_actors": 3,
        "naming_errors": 2
      }
    }
  ]
}
```

### 增量更新策略
- 仅重新处理有变化的数据源
- 使用文件校验和检测变更
- 保留历史运行记录
- 人工备注永不丢失

## 输出格式

### Markdown 录音日程单示例
```markdown
# 录音日程单 - 2026年5月5日

## 项目信息
- 项目名称：某动画第1季
- 今日日期：2026-05-05
- 生成时间：2026-05-05 10:30:00

---

## 🎯 今日可录音段落 (45段)

### EP01 - 第一集：相遇

#### SC01 - 开场
| 台词ID | 角色 | 演员 | 状态 | 备注 |
|--------|------|------|------|------|
| L001 | 张三 | 张三 | ✅ 可录音 | 导演调整语气 |
| L002 | 李四 | 李四 | ⏳ 待确认 | 演员档期待定 |
| L003 | 王五 | 王五 | ✅ 可录音 | 已确认 |

#### SC02 - 对话
...

---

## ⚠️ 问题段落

### 缺人 (3人)
| 角色 | 演员 | 原因 |
|------|------|------|
| 赵六 | 赵六 | 今日无档期 |
| 孙七 | 孙七 | 联系不上 |
| 周八 | 周八 | 外出拍摄 |

### 命名错误 (2个文件)
| 文件名 | 错误原因 | 建议修正 |
|--------|----------|----------|
| EP01_SC01_L001_zhangsan_01.wav | 角色名应为中文 | EP01_SC01_L001_张三_01.wav |
| EP01_SC01_L002.wav | 缺少角色名和 take 号 | EP01_SC01_L002_李四_01.wav |

---

## 📋 客户交付进度
| 集数 | 状态 | 已完成 | 总计 | 截止日期 |
|------|------|--------|------|----------|
| EP01 | 进行中 | 5/10 | 10 | 2026-05-15 |
| EP02 | 未开始 | 0/15 | 15 | 2026-05-20 |

---

## 📝 人工备注
1. **L001**: 演员迟到，改到下午 (2026-05-05 09:00)

---

*报告生成时间：2026-05-05 10:30:00*
```

### JSON 明细数据示例
```json
{
  "meta": {
    "project_name": "某动画第1季",
    "generated_at": "2026-05-05T10:30:00Z",
    "today_date": "2026-05-05"
  },
  "summary": {
    "total_lines": 100,
    "recordable_today": 45,
    "missing_actors": 3,
    "naming_errors": 2,
    "progress_percentage": 45
  },
  "recordable_lines": [
    {
      "line_id": "L001",
      "episode_id": "EP01",
      "scene_id": "SC01",
      "character_name": "张三",
      "actor": {
        "actor_id": "A001",
        "name": "张三",
        "available_slots": ["09:00-12:00", "14:00-18:00"]
      },
      "status": "recordable",
      "has_audio": false,
      "notes": ["导演调整语气"]
    }
  ],
  "issues": {
    "missing_actors": [
      {
        "character_name": "赵六",
        "actor_name": "赵六",
        "reason": "今日无档期",
        "affected_lines": ["L010", "L011", "L012"]
      }
    ],
    "naming_errors": [
      {
        "file_path": "./data/audio_files/EP01_SC01_L001_zhangsan_01.wav",
        "error": "角色名应为中文",
        "suggested_name": "EP01_SC01_L001_张三_01.wav",
        "extracted_info": {
          "episode_id": "EP01",
          "scene_id": "SC01",
          "line_id": "L001",
          "character_name": "zhangsan",
          "take_number": "01"
        }
      }
    ]
  },
  "delivery_progress": [
    {
      "episode_id": "EP01",
      "episode_name": "第一集：相遇",
      "status": "in_progress",
      "lines_completed": 5,
      "lines_total": 10,
      "deadline": "2026-05-15",
      "days_remaining": 10
    }
  ],
  "notes": [
    {
      "id": "N001",
      "line_id": "L001",
      "content": "演员迟到，改到下午",
      "created_at": "2026-05-05T09:00:00Z"
    }
  ]
}
```

## 实现技术栈建议

### 编程语言
- **Python**: 丰富的数据处理库，适合 CLI 工具开发

### 核心依赖
- **pandas**: CSV 数据处理
- **pydub/mutagen**: WAV 元数据读取
- **click/typer**: 命令行界面
- **pydantic**: 数据验证
- **rich**: 终端输出美化
- **json-schema**: JSON 验证
- **watchdog**: 文件监控（可选）

### 项目结构
```
recording_studio/
├── __init__.py
├── __main__.py              # 命令行入口
├── cli/
│   ├── __init__.py
│   ├── commands.py          # CLI 命令定义
│   └── formatters.py        # 输出格式化
├── core/
│   ├── __init__.py
│   ├── models.py            # 数据模型
│   ├── validators.py        # 数据验证
│   ├── analyzers.py         # 逻辑分析
│   └── state_manager.py     # 状态管理
├── loaders/
│   ├── __init__.py
│   ├── csv_loader.py        # CSV 加载
│   ├── json_loader.py       # JSON 加载
│   └── wav_loader.py        # WAV 元数据加载
├── exporters/
│   ├── __init__.py
│   ├── markdown_exporter.py # Markdown 导出
│   └── json_exporter.py     # JSON 导出
└── config/
    ├── __init__.py
    └── settings.py          # 配置管理
```

## 关键实现要点

### 1. 文件名解析与验证
```python
import re
from typing import Dict, Optional

def parse_wav_filename(filename: str) -> Optional[Dict]:
    """
    解析 WAV 文件名，提取信息并验证格式
    期望格式: {episode_id}_{scene_id}_{line_id}_{character_name}_{take_number}.wav
    """
    pattern = r'^([A-Z0-9]+)_([A-Z0-9]+)_([A-Z0-9]+)_(.+)_([0-9]+)\.wav$'
    match = re.match(pattern, filename, re.IGNORECASE)
    
    if not match:
        return None
    
    return {
        'episode_id': match.group(1),
        'scene_id': match.group(2),
        'line_id': match.group(3),
        'character_name': match.group(4),
        'take_number': match.group(5),
        'original_filename': filename
    }
```

### 2. 演员档期检查
```python
from datetime import datetime
from typing import List, Dict

def check_actor_availability(actor_schedule: Dict, check_date: str = None) -> Dict:
    """
    检查演员在指定日期的档期可用性
    """
    if check_date is None:
        check_date = datetime.now().strftime('%Y-%m-%d')
    
    availability = actor_schedule.get('availability', [])
    today_schedule = next(
        (s for s in availability if s.get('date') == check_date),
        None
    )
    
    if today_schedule is None:
        return {
            'available': False,
            'status': 'unknown',
            'reason': '无档期记录',
            'time_slots': []
        }
    
    return {
        'available': today_schedule.get('status') == 'available',
        'status': today_schedule.get('status'),
        'reason': today_schedule.get('reason', ''),
        'time_slots': today_schedule.get('time_slots', [])
    }
```

### 3. 状态管理与持久化
```python
import json
import hashlib
import os
from pathlib import Path
from typing import Dict, Any

class StateManager:
    """状态管理器，处理持久化和增量更新"""
    
    def __init__(self, state_dir: Path):
        self.state_dir = state_dir
        self.state_file = state_dir / 'state.json'
        self.state = self._load_state()
    
    def _load_state(self) -> Dict:
        if self.state_file.exists():
            with open(self.state_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return self._get_default_state()
    
    def _get_default_state(self) -> Dict:
        return {
            'last_run': None,
            'checksum': {},
            'notes': [],
            'history': []
        }
    
    def save_state(self):
        self.state_dir.mkdir(parents=True, exist_ok=True)
        with open(self.state_file, 'w', encoding='utf-8') as f:
            json.dump(self.state, f, ensure_ascii=False, indent=2)
    
    def calculate_checksum(self, file_path: Path) -> str:
        """计算文件校验和"""
        hasher = hashlib.md5()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                hasher.update(chunk)
        return hasher.hexdigest()
    
    def has_file_changed(self, file_path: Path, file_type: str) -> bool:
        """检查文件是否有变化"""
        if not file_path.exists():
            return False
        
        current_checksum = self.calculate_checksum(file_path)
        stored_checksum = self.state.get('checksum', {}).get(file_type)
        
        return current_checksum != stored_checksum
    
    def add_note(self, line_id: str, content: str) -> Dict:
        """添加人工备注"""
        import time
        note = {
            'id': f'N{int(time.time())}',
            'line_id': line_id,
            'content': content,
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        self.state['notes'].append(note)
        self.save_state()
        return note
    
    def get_notes_for_line(self, line_id: str) -> List[Dict]:
        """获取指定台词的所有备注"""
        return [n for n in self.state['notes'] if n.get('line_id') == line_id]
```

## 使用示例

### 完整工作流示例
```bash
# 1. 初始化项目
studio-recording init --project-dir ./animation-project

# 2. 准备数据文件
# - 将台词改动 CSV 放入 ./animation-project/data/script_changes/
# - 将演员档期 JSON 放入 ./animation-project/data/actor_schedules/
# - 将 WAV 文件放入 ./animation-project/data/audio_files/
# - 将客户交付清单放入 ./animation-project/data/delivery_lists/

# 3. 运行完整检查
studio-recording check --all --project-dir ./animation-project

# 4. 添加人工备注
studio-recording note add \
    --line-id L001 \
    --content "演员张三今天上午有事，改到下午2点" \
    --project-dir ./animation-project

# 5. 重新运行检查（保留备注）
studio-recording check --all --project-dir ./animation-project

# 6. 导出日程单
studio-recording export \
    --format markdown \
    --output ./animation-project/output/schedules/2026-05-05-schedule.md \
    --project-dir ./animation-project

# 7. 导出明细数据
studio-recording export \
    --format json \
    --output ./animation-project/output/reports/2026-05-05-details.json \
    --project-dir ./animation-project
```

## 错误处理与日志

### 日志级别
- **DEBUG**: 详细调试信息
- **INFO**: 常规运行信息
- **WARNING**: 警告信息（如命名错误）
- **ERROR**: 错误信息（如文件缺失）
- **CRITICAL**: 严重错误（如配置损坏）

### 常见错误处理
1. **文件缺失**: 提示用户补充文件，继续处理已有数据
2. **格式错误**: 跳过错误记录，生成错误报告
3. **数据不一致**: 标记冲突，等待人工确认
4. **状态损坏**: 自动备份并重置到默认状态

## 扩展功能建议

1. **文件监控**: 使用 watchdog 监控数据目录变化，自动触发检查
2. **Web 界面**: 添加简单的 Flask/FastAPI 服务，提供可视化界面
3. **通知系统**: 集成邮件/钉钉/企业微信通知，自动发送日程提醒
4. **版本控制**: 集成 Git，自动版本化数据文件
5. **统计分析**: 添加更多统计图表和趋势分析

## 测试要点

1. **单元测试**
   - 文件名解析函数
   - 演员档期检查逻辑
   - 状态持久化功能
   - 数据验证器

2. **集成测试**
   - 完整工作流测试
   - 多数据源整合测试
   - 错误恢复测试

3. **边界测试**
   - 空数据目录
   - 格式错误的输入文件
   - 大型数据集性能测试

## 注意事项

1. **路径处理**: 使用 `pathlib` 处理所有路径，确保跨平台兼容性
2. **编码问题**: 所有文件操作使用 `utf-8` 编码
3. **文件锁定**: 处理并发访问时的文件锁定问题
4. **数据备份**: 重要操作前自动备份状态文件
5. **用户隐私**: 不收集或上传任何用户数据到外部服务
