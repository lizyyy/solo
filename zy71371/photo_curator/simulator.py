import os
import uuid
import random
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional

from PIL import Image, ImageDraw, ImageFont

from .models import PhotoRecord, PhotoMetadata, PhotoStatus, DuplicateGroup


def create_simulated_photos(count: int = 100, key_persons: Optional[List[str]] = None, 
                          output_dir: str = "./simulated_photos") -> List[PhotoRecord]:
    """创建模拟照片记录和对应的测试图片"""
    key_persons = key_persons or []
    photos = []
    
    os.makedirs(output_dir, exist_ok=True)
    
    base_time = datetime.now() - timedelta(hours=count)
    
    for i in range(count):
        photo_id = str(uuid.uuid4())
        file_name = f"IMG_{i+1:04d}.jpg"
        file_path = os.path.join(output_dir, file_name)
        
        width = random.choice([3000, 4000, 5000, 6000])
        height = int(width * 0.667)
        
        _create_simulated_image(file_path, width, height, i, key_persons)
        
        capture_time = base_time + timedelta(seconds=i * random.randint(1, 30))
        
        metadata = PhotoMetadata(
            file_path=file_path,
            file_name=file_name,
            file_size=random.randint(1, 10) * 1024 * 1024,
            capture_time=capture_time,
            camera_model=random.choice(["Canon EOS R5", "Nikon Z7", "Sony A7IV"]),
            iso=random.choice([100, 200, 400, 800, 1600]),
            aperture=round(random.uniform(1.8, 8.0), 1),
            shutter_speed=f"1/{random.choice([60, 125, 250, 500, 1000])}s",
            focal_length=round(random.uniform(24, 200), 1),
            width=width,
            height=height
        )
        
        record = PhotoRecord(
            photo_id=photo_id,
            metadata=metadata,
            perceptual_hash=_generate_simulated_hash(i)
        )
        
        photos.append(record)
    
    return photos


def _create_simulated_image(file_path: str, width: int, height: int, index: int, 
                           key_persons: List[str]):
    """创建一张模拟图片"""
    img = Image.new('RGB', (width, height), color=_get_random_color(index))
    draw = ImageDraw.Draw(img)
    
    num_faces = random.choices([0, 1, 2, 3, 4], weights=[0.2, 0.4, 0.25, 0.1, 0.05])[0]
    
    for i in range(num_faces):
        face_x = random.randint(100, width - 200)
        face_y = random.randint(100, height - 200)
        face_size = random.randint(100, 200)
        
        draw.ellipse([face_x, face_y, face_x + face_size, face_y + face_size], 
                    fill=(255, 200, 150), outline=(100, 50, 0))
        
        eye_y = face_y + int(face_size * 0.35)
        eye_spacing = int(face_size * 0.3)
        eye_size = int(face_size * 0.12)
        
        draw.ellipse([face_x + int(face_size * 0.25) - eye_size, eye_y - eye_size,
                     face_x + int(face_size * 0.25) + eye_size, eye_y + eye_size],
                    fill=(0, 0, 0))
        draw.ellipse([face_x + int(face_size * 0.75) - eye_size, eye_y - eye_size,
                     face_x + int(face_size * 0.75) + eye_size, eye_y + eye_size],
                    fill=(0, 0, 0))
    
    try:
        font = ImageFont.truetype("/System/Library/Fonts/PingFang.ttc", 80)
    except:
        font = ImageFont.load_default()
    
    draw.text((width // 2 - 100, 50), f"Sim Photo {index+1}", fill=(255, 255, 255), font=font)
    
    img.save(file_path, 'JPEG', quality=85)


def _get_random_color(seed: int) -> tuple:
    random.seed(seed)
    return (
        random.randint(50, 200),
        random.randint(50, 200),
        random.randint(50, 200)
    )


def _generate_simulated_hash(seed: int) -> str:
    """生成模拟的感知哈希"""
    random.seed(seed)
    return ''.join(random.choice('0123456789abcdef') for _ in range(32))


def create_simulated_duplicates(photos: List[PhotoRecord], num_groups: int = 10) -> List[DuplicateGroup]:
    """为模拟照片创建重复组"""
    if len(photos) < 20:
        return []
    
    groups = []
    used_indices = set()
    
    for group_idx in range(min(num_groups, len(photos) // 3)):
        available = [i for i in range(len(photos)) if i not in used_indices]
        if len(available) < 3:
            break
        
        group_size = random.randint(2, 5)
        selected_indices = random.sample(available, group_size)
        used_indices.update(selected_indices)
        
        group_photos = [photos[i] for i in selected_indices]
        
        common_hash = _generate_simulated_hash(group_idx * 1000)
        for photo in group_photos:
            photo.perceptual_hash = common_hash
        
        group_id = f"dup_group_{group_idx:03d}"
        group = DuplicateGroup(group_id=group_id, photos=group_photos)
        groups.append(group)
    
    return groups


def create_sample_config(output_path: str = "./config.yaml"):
    """创建示例配置文件"""
    config_content = """# 摄影选片去重CLI配置文件

# 输入输出配置
input_dir: ./photos
output_dir: ./output

# 重点人物配置
key_persons:
  - 新郎
  - 新娘
  - 父亲
  - 母亲

# 去重配置
duplicate_detection:
  hash_size: 16
  similarity_threshold: 5
  burst_time_window_seconds: 2

# 评分配置
scoring:
  min_score: 50.0
  reject_closed_eyes: true
  closed_eyes_threshold: 1
  key_person_bonus: 20.0
  face_count_bonus: 5.0

# 人脸检测配置
face_detection:
  tolerance: 0.6
  min_face_size: 20

# 报告配置
report:
  formats:
    - summary_md
    - details_csv
    - details_json
    - duplicates_md
    - key_persons_md
"""
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(config_content)
    
    return output_path


def create_readme(output_path: str = "./README.md"):
    """创建README文件"""
    readme_content = """# 摄影选片去重CLI

一个用于婚礼摄影师批量筛选照片的命令行工具，支持图片去重、人脸分组、评分筛选、人工确认和报告导出。

## 功能特点

- 📷 **图片去重**: 基于感知哈希算法检测重复照片和连拍照片
- 👤 **人脸分析**: 自动识别人脸并分组，支持重点人物标记
- 😊 **闭眼检测**: 自动检测闭眼照片并标记
- ⭐ **智能评分**: 基于人物、构图、质量等多维度评分
- 👆 **人工审核**: 交互式人工确认流程
- 📊 **报告导出**: 生成摘要报告、详细明细、CSV/JSON导出

## 安装

```bash
# 使用 pip 安装
pip install -e .

# 或使用 poetry
poetry install
```

## 快速开始

### 演示模式（无需真实照片）

```bash
# 使用模拟数据演示完整流程
photo-curator demo --count 100 --key-persons 新郎 --key-persons 新娘 --auto-confirm

# 查看生成的报告
ls output/
```

### 真实照片处理

```bash
# 完整选片流程
photo-curator curate ./photos --key-persons 新郎 --key-persons 新娘

# 自动确认模式（跳过人工审核）
photo-curator curate ./photos --key-persons 新郎 --auto-confirm

# 仅去重检测
photo-curator dedupe ./photos

# 仅人脸分析
photo-curator faces ./photos --key-persons 新郎

# 仅评分
photo-curator score ./photos --min-score 60

# 列出并筛选照片
photo-curator list ./photos --status keep --min-score 80
```

## 命令说明

| 命令 | 说明 |
|------|------|
| `curate` | 执行完整的选片流程 |
| `dedupe` | 仅执行去重检测 |
| `faces` | 仅执行人脸分析 |
| `score` | 仅执行评分 |
| `demo` | 使用模拟数据演示 |
| `list` | 列出并筛选照片 |

## 输出文件

运行后会在输出目录生成以下文件：

- `summary_*.md`: 选片摘要报告
- `details_*.csv`: 详细明细CSV
- `details_*.json`: 详细明细JSON
- `duplicates_*.md`: 重复照片组明细
- `keypersons_*.md`: 重点人物照片明细

## 评分规则

照片评分基于以下因素：

- 重点人物: +20分/人
- 人脸数量: +5分/人（最多5人）
- 高分辨率: +10分
- 中高分辨率: +5分
- 文件大小正常: +3分

## 状态说明

- `keep`: 保留
- `remove_duplicate`: 重复照片
- `remove_closed_eyes`: 闭眼照片
- `remove_low_score`: 低评分
- `remove_manual`: 手动删除
- `pending`: 待审核

## 项目结构

```
photo_curator/
├── __init__.py          # 包初始化
├── models.py            # 数据模型定义
├── cli.py               # CLI入口
├── duplicate_detector.py # 去重检测模块
├── face_analyzer.py     # 人脸分析模块
├── scorer.py            # 评分和筛选模块
├── manual_review.py     # 人工审核模块
├── report_exporter.py   # 报告导出模块
└── simulator.py         # 模拟数据生成器
```

## 注意事项

1. 首次运行人脸分析可能较慢，取决于照片数量和硬件性能
2. face_recognition 库需要额外安装 dlib，如无法安装将使用模拟模式
3. 建议在正式处理前先使用 `demo` 命令熟悉流程
"""
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(readme_content)
    
    return output_path
