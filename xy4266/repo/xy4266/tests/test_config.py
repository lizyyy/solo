"""测试配置模型"""

import pytest
from datetime import date
from drip_salinity.config import (
    ProjectConfig, CropConfig, SubstrateConfig, 
    ThresholdConfig, BedConfig, CropType, SubstrateType, ECUnit
)


class TestCropConfig:
    """测试作物配置"""
    
    def test_create_default(self):
        """测试创建默认作物配置"""
        config = CropConfig(
            crop_type=CropType.TOMATO,
            planting_date=date(2024, 1, 15)
        )
        
        assert config.crop_type == CropType.TOMATO
        assert config.planting_date == date(2024, 1, 15)
        assert config.expected_ec_range == (2.0, 3.5)
        assert config.max_tolerated_ec == 5.0
    
    def test_custom_ec_range(self):
        """测试自定义EC范围"""
        config = CropConfig(
            crop_type=CropType.CUCUMBER,
            planting_date=date(2024, 1, 15),
            expected_ec_range=(1.8, 3.0),
            max_tolerated_ec=4.5
        )
        
        assert config.expected_ec_range == (1.8, 3.0)
        assert config.max_tolerated_ec == 4.5


class TestSubstrateConfig:
    """测试基质配置"""
    
    def test_create_default(self):
        """测试创建默认基质配置"""
        config = SubstrateConfig(
            substrate_type=SubstrateType.COCO_PEAT,
            volume_per_bed=100.0
        )
        
        assert config.substrate_type == SubstrateType.COCO_PEAT
        assert config.volume_per_bed == 100.0
        assert config.initial_water_content == 60.0
        assert config.field_capacity == 70.0


class TestThresholdConfig:
    """测试阈值配置"""
    
    def test_default_thresholds(self):
        """测试默认阈值"""
        config = ThresholdConfig()
        
        assert config.max_drainage_ratio == 0.4
        assert config.min_drainage_ratio == 0.1
        assert config.ec_warning_threshold == 4.0
        assert config.ec_danger_threshold == 5.0
    
    def test_custom_thresholds(self):
        """测试自定义阈值"""
        config = ThresholdConfig(
            ec_warning_threshold=3.5,
            ec_danger_threshold=4.5,
            max_drainage_ratio=0.5,
            min_drainage_ratio=0.15
        )
        
        assert config.ec_warning_threshold == 3.5
        assert config.ec_danger_threshold == 4.5
        assert config.max_drainage_ratio == 0.5
        assert config.min_drainage_ratio == 0.15


class TestBedConfig:
    """测试畦配置"""
    
    def test_create_bed(self):
        """测试创建畦配置"""
        bed = BedConfig(
            bed_id="A01",
            plant_count=100,
            row_number=1,
            location="东区第一行"
        )
        
        assert bed.bed_id == "A01"
        assert bed.plant_count == 100
        assert bed.row_number == 1
        assert bed.location == "东区第一行"


class TestProjectConfig:
    """测试项目配置"""
    
    def test_create_full_config(self):
        """测试创建完整配置"""
        crop = CropConfig(
            crop_type=CropType.TOMATO,
            planting_date=date(2024, 1, 15)
        )
        
        substrate = SubstrateConfig(
            substrate_type=SubstrateType.COCO_PEAT,
            volume_per_bed=100.0
        )
        
        thresholds = ThresholdConfig()
        
        beds = [
            BedConfig(bed_id="A01"),
            BedConfig(bed_id="A02"),
            BedConfig(bed_id="A03")
        ]
        
        project = ProjectConfig(
            project_name="番茄种植示范区",
            crop=crop,
            substrate=substrate,
            thresholds=thresholds,
            beds=beds
        )
        
        assert project.project_name == "番茄种植示范区"
        assert project.crop.crop_type == CropType.TOMATO
        assert project.substrate.volume_per_bed == 100.0
        assert len(project.beds) == 3
    
    def test_duplicate_bed_ids(self):
        """测试重复畦号校验"""
        crop = CropConfig(
            crop_type=CropType.TOMATO,
            planting_date=date(2024, 1, 15)
        )
        
        substrate = SubstrateConfig(
            substrate_type=SubstrateType.COCO_PEAT,
            volume_per_bed=100.0
        )
        
        # 重复畦号
        beds = [
            BedConfig(bed_id="A01"),
            BedConfig(bed_id="A01")  # 重复
        ]
        
        with pytest.raises(ValueError, match="畦号不能重复"):
            ProjectConfig(
                project_name="测试项目",
                crop=crop,
                substrate=substrate,
                beds=beds
            )
    
    def test_json_serialization(self):
        """测试JSON序列化"""
        crop = CropConfig(
            crop_type=CropType.TOMATO,
            planting_date=date(2024, 1, 15)
        )
        
        substrate = SubstrateConfig(
            substrate_type=SubstrateType.COCO_PEAT,
            volume_per_bed=100.0
        )
        
        project = ProjectConfig(
            project_name="测试项目",
            crop=crop,
            substrate=substrate,
            beds=[BedConfig(bed_id="A01")]
        )
        
        # 测试序列化
        json_str = project.model_dump_json()
        assert '"番茄"' in json_str
        assert '"椰糠"' in json_str
        assert '"A01"' in json_str
        
        # 测试反序列化
        loaded = ProjectConfig.model_validate_json(json_str)
        assert loaded.project_name == "测试项目"
        assert loaded.crop.crop_type == CropType.TOMATO
