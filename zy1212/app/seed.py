from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.database import SessionLocal, engine, Base
from app.models import (
    Project,
    Interface,
    TrafficModel,
    LoadTestBatch,
    MachineCapacity,
    MonitoringSnapshot,
    OptimizationAction,
)
from app.schemas.common import (
    TestTypeEnum,
    EnvironmentEnum,
    HTTPMethodEnum,
    DistributionPatternEnum,
    OptimizationActionTypeEnum,
    OptimizationStatusEnum,
)


def create_sample_project(db: Session) -> Project:
    project = Project(
        name="订单服务压测项目",
        description="订单服务的性能压测与复盘项目，用于评估系统在高并发场景下的表现",
        service_name="order-service",
        environment=EnvironmentEnum.PRODUCTION.value,
        is_active=True,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def create_sample_interfaces(db: Session, project_id: int):
    interfaces = [
        Interface(
            project_id=project_id,
            name="创建订单",
            path="/api/v1/orders",
            method=HTTPMethodEnum.POST.value,
            description="用户创建新订单",
            tags=["order", "create"],
            expected_qps=500,
            expected_avg_latency_ms=100,
        ),
        Interface(
            project_id=project_id,
            name="查询订单详情",
            path="/api/v1/orders/{id}",
            method=HTTPMethodEnum.GET.value,
            description="根据订单ID查询详情",
            tags=["order", "read"],
            expected_qps=1000,
            expected_avg_latency_ms=50,
        ),
        Interface(
            project_id=project_id,
            name="取消订单",
            path="/api/v1/orders/{id}/cancel",
            method=HTTPMethodEnum.PUT.value,
            description="取消待支付订单",
            tags=["order", "update"],
            expected_qps=200,
            expected_avg_latency_ms=80,
        ),
        Interface(
            project_id=project_id,
            name="订单列表",
            path="/api/v1/orders",
            method=HTTPMethodEnum.GET.value,
            description="分页查询订单列表",
            tags=["order", "list"],
            expected_qps=800,
            expected_avg_latency_ms=150,
        ),
    ]
    for iface in interfaces:
        db.add(iface)
    db.commit()


def create_sample_traffic_model(db: Session, project_id: int) -> TrafficModel:
    traffic_model = TrafficModel(
        project_id=project_id,
        name="标准峰值流量模型",
        description="模拟电商大促场景下的典型流量分布",
        total_users=1000,
        concurrent_users=200,
        test_duration_seconds=1800,
        ramp_up_seconds=300,
        distribution_pattern=DistributionPatternEnum.RAMP_UP.value,
        peak_qps=800,
        think_time_min_ms=1000,
        think_time_max_ms=3000,
        weight_distribution={"create_order": 0.3, "get_order": 0.4, "list_orders": 0.2, "cancel_order": 0.1},
    )
    db.add(traffic_model)
    db.commit()
    db.refresh(traffic_model)
    return traffic_model


def create_sample_load_test_batches(db: Session, project_id: int, traffic_model_id: int):
    base_time = datetime.now() - timedelta(days=7)
    
    batch1 = LoadTestBatch(
        project_id=project_id,
        traffic_model_id=traffic_model_id,
        name="V1.0.0 基线压测",
        description="第一轮基线压测，优化前的性能数据",
        test_type=TestTypeEnum.BASELINE.value,
        status="completed",
        start_time=base_time,
        end_time=base_time + timedelta(minutes=30),
        duration_seconds=1800,
        total_requests=864000,
        total_errors=8640,
        error_rate=0.01,
        qps=480.0,
        tps=480.0,
        avg_response_time_ms=245.0,
        p50_response_time_ms=180.0,
        p90_response_time_ms=420.0,
        p95_response_time_ms=580.0,
        p99_response_time_ms=1250.0,
        min_response_time_ms=15.0,
        max_response_time_ms=3500.0,
        throughput_kbps=2450.0,
        bytes_sent=5600000000,
        bytes_received=12400000000,
        is_baseline=True,
        commit_hash="a1b2c3d",
        environment=EnvironmentEnum.PRODUCTION.value,
        notes="优化前的基线数据，响应时间较长，P99 超过 1s",
    )
    db.add(batch1)
    
    batch2 = LoadTestBatch(
        project_id=project_id,
        traffic_model_id=traffic_model_id,
        name="V1.1.0 优化后压测",
        description="数据库连接池优化 + Redis 缓存引入后的压测",
        test_type=TestTypeEnum.REGRESSION.value,
        status="completed",
        start_time=base_time + timedelta(days=3),
        end_time=base_time + timedelta(days=3, minutes=30),
        duration_seconds=1800,
        total_requests=1296000,
        total_errors=1296,
        error_rate=0.001,
        qps=720.0,
        tps=720.0,
        avg_response_time_ms=85.0,
        p50_response_time_ms=50.0,
        p90_response_time_ms=140.0,
        p95_response_time_ms=180.0,
        p99_response_time_ms=320.0,
        min_response_time_ms=8.0,
        max_response_time_ms=850.0,
        throughput_kbps=3800.0,
        bytes_sent=6200000000,
        bytes_received=15600000000,
        is_baseline=False,
        commit_hash="e5f6g7h",
        environment=EnvironmentEnum.PRODUCTION.value,
        notes="优化后数据，P99 降低约 75%，QPS 提升约 50%",
    )
    db.add(batch2)
    
    db.commit()
    db.refresh(batch1)
    db.refresh(batch2)
    return batch1, batch2


def create_sample_machine_capacities(db: Session, project_id: int):
    capacities = [
        MachineCapacity(
            project_id=project_id,
            hostname="app-server-01",
            ip_address="192.168.1.10",
            role="application",
            cpu_cores=8,
            cpu_ghz=3.2,
            memory_gb=32,
            memory_speed_mhz=3200,
            disk_type="nvme_ssd",
            disk_size_gb=500,
            disk_iops_read=350000,
            disk_iops_write=300000,
            network_bandwidth_gbps=10,
            os_version="Ubuntu 22.04 LTS",
            description="应用服务器 1 号",
        ),
        MachineCapacity(
            project_id=project_id,
            hostname="app-server-02",
            ip_address="192.168.1.11",
            role="application",
            cpu_cores=8,
            cpu_ghz=3.2,
            memory_gb=32,
            memory_speed_mhz=3200,
            disk_type="nvme_ssd",
            disk_size_gb=500,
            disk_iops_read=350000,
            disk_iops_write=300000,
            network_bandwidth_gbps=10,
            os_version="Ubuntu 22.04 LTS",
            description="应用服务器 2 号",
        ),
        MachineCapacity(
            project_id=project_id,
            hostname="db-master-01",
            ip_address="192.168.1.20",
            role="database",
            cpu_cores=16,
            cpu_ghz=3.5,
            memory_gb=128,
            memory_speed_mhz=2933,
            disk_type="nvme_ssd",
            disk_size_gb=2000,
            disk_iops_read=500000,
            disk_iops_write=450000,
            network_bandwidth_gbps=25,
            os_version="CentOS 8",
            description="MySQL 主库",
        ),
        MachineCapacity(
            project_id=project_id,
            hostname="redis-cluster-01",
            ip_address="192.168.1.30",
            role="cache",
            cpu_cores=4,
            cpu_ghz=3.2,
            memory_gb=64,
            memory_speed_mhz=3200,
            disk_type="ssd",
            disk_size_gb=200,
            disk_iops_read=100000,
            disk_iops_write=80000,
            network_bandwidth_gbps=10,
            os_version="Ubuntu 22.04 LTS",
            description="Redis 集群节点 1",
        ),
    ]
    for cap in capacities:
        db.add(cap)
    db.commit()


def create_sample_monitoring_snapshots(db: Session, project_id: int, batch1_id: int, batch2_id: int):
    base_time = datetime.now() - timedelta(days=7)
    
    snapshots_batch1 = [
        MonitoringSnapshot(
            project_id=project_id,
            load_test_batch_id=batch1_id,
            snapshot_time=base_time + timedelta(minutes=15),
            hostname="app-server-01",
            cpu_utilization_percent=78.5,
            cpu_load_avg=5.2,
            memory_utilization_percent=62.0,
            memory_used_gb=19.8,
            disk_utilization_percent=35.0,
            disk_read_iops=1200,
            disk_write_iops=800,
            network_rx_mbps=120.0,
            network_tx_mbps=95.0,
            jvm_heap_used_gb=8.5,
            jvm_heap_max_gb=16.0,
            jvm_gc_count=1250,
            jvm_gc_time_ms=8500,
            db_active_connections=120,
            db_query_latency_ms=45.0,
            cache_hit_rate=72.0,
            notes="压测中期监控数据，CPU 较高",
        ),
        MonitoringSnapshot(
            project_id=project_id,
            load_test_batch_id=batch1_id,
            snapshot_time=base_time + timedelta(minutes=25),
            hostname="db-master-01",
            cpu_utilization_percent=85.0,
            cpu_load_avg=12.8,
            memory_utilization_percent=78.0,
            memory_used_gb=99.8,
            disk_utilization_percent=45.0,
            disk_read_iops=8500,
            disk_write_iops=6200,
            network_rx_mbps=250.0,
            network_tx_mbps=280.0,
            db_active_connections=150,
            db_query_latency_ms=120.0,
            notes="数据库压力大，CPU 接近瓶颈",
        ),
    ]
    
    snapshots_batch2 = [
        MonitoringSnapshot(
            project_id=project_id,
            load_test_batch_id=batch2_id,
            snapshot_time=base_time + timedelta(days=3, minutes=15),
            hostname="app-server-01",
            cpu_utilization_percent=55.0,
            cpu_load_avg=3.8,
            memory_utilization_percent=55.0,
            memory_used_gb=17.6,
            disk_utilization_percent=36.0,
            disk_read_iops=800,
            disk_write_iops=500,
            network_rx_mbps=180.0,
            network_tx_mbps=150.0,
            jvm_heap_used_gb=6.2,
            jvm_heap_max_gb=16.0,
            jvm_gc_count=680,
            jvm_gc_time_ms=3200,
            db_active_connections=65,
            db_query_latency_ms=22.0,
            cache_hit_rate=92.0,
            notes="优化后，CPU 压力降低，缓存命中率提升",
        ),
        MonitoringSnapshot(
            project_id=project_id,
            load_test_batch_id=batch2_id,
            snapshot_time=base_time + timedelta(days=3, minutes=25),
            hostname="db-master-01",
            cpu_utilization_percent=45.0,
            cpu_load_avg=5.2,
            memory_utilization_percent=72.0,
            memory_used_gb=92.2,
            disk_utilization_percent=46.0,
            disk_read_iops=3200,
            disk_write_iops=2100,
            network_rx_mbps=120.0,
            network_tx_mbps=140.0,
            db_active_connections=72,
            db_query_latency_ms=35.0,
            notes="数据库压力大幅降低，连接池优化生效",
        ),
    ]
    
    for snap in snapshots_batch1 + snapshots_batch2:
        db.add(snap)
    db.commit()


def create_sample_optimization_actions(db: Session, project_id: int, batch1_id: int, batch2_id: int):
    actions = [
        OptimizationAction(
            project_id=project_id,
            related_batch_id=batch1_id,
            title="优化数据库连接池配置",
            description="当前数据库连接池配置过小，导致大量请求等待连接",
            action_type=OptimizationActionTypeEnum.CONFIGURATION.value,
            priority="high",
            status=OptimizationStatusEnum.VERIFIED.value,
            root_cause="连接池 max_size 仅 50，压测时连接不足",
            solution="将连接池 max_size 调整为 200，增加超时时间配置",
            expected_impact="QPS 提升 20-30%，响应时间降低",
            actual_impact="QPS 提升约 15%，数据库连接等待减少 80%",
            implemented_by="张三",
            implemented_at=datetime.now() - timedelta(days=5),
            verified_by="李四",
            verified_at=datetime.now() - timedelta(days=2),
            notes="需要配合应用重启",
        ),
        OptimizationAction(
            project_id=project_id,
            related_batch_id=batch1_id,
            title="引入 Redis 缓存热点数据",
            description="订单详情查询每次都查数据库，且重复查询较多",
            action_type=OptimizationActionTypeEnum.CACHING.value,
            priority="high",
            status=OptimizationStatusEnum.VERIFIED.value,
            root_cause="热点订单重复查询，数据库压力大",
            solution="对订单详情查询加入 5 分钟 Redis 缓存",
            expected_impact="订单查询 QPS 提升 50%，数据库负载降低",
            actual_impact="缓存命中率 92%，订单查询响应时间降低 60%",
            implemented_by="王五",
            implemented_at=datetime.now() - timedelta(days=4),
            verified_by="李四",
            verified_at=datetime.now() - timedelta(days=2),
            notes="需要处理缓存一致性",
        ),
        OptimizationAction(
            project_id=project_id,
            related_batch_id=batch2_id,
            title="优化 SQL 查询语句",
            description="部分慢查询需要优化，新增索引",
            action_type=OptimizationActionTypeEnum.DATABASE.value,
            priority="medium",
            status=OptimizationStatusEnum.IN_PROGRESS.value,
            root_cause="订单列表查询缺少组合索引，导致全表扫描",
            solution="在 orders 表上添加 (user_id, created_at) 组合索引",
            expected_impact="订单列表查询速度提升 30-40%",
            actual_impact=None,
            implemented_by="赵六",
            implemented_at=None,
            verified_by=None,
            verified_at=None,
            notes="已在测试环境验证，待上线",
        ),
        OptimizationAction(
            project_id=project_id,
            related_batch_id=batch1_id,
            title="增加应用服务器数量",
            description="应用服务器 CPU 在高并发下接近瓶颈",
            action_type=OptimizationActionTypeEnum.SCALING.value,
            priority="medium",
            status=OptimizationStatusEnum.PENDING.value,
            root_cause="2 台应用服务器在 800 QPS 时 CPU 达到 80%",
            solution="扩展至 4 台应用服务器，或增加单台配置",
            expected_impact="系统吞吐量提升 80-100%",
            actual_impact=None,
            implemented_by=None,
            implemented_at=None,
            verified_by=None,
            verified_at=None,
            notes="需要评估成本",
        ),
    ]
    
    for action in actions:
        db.add(action)
    db.commit()


def seed_data():
    print("开始创建种子数据...")
    
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    try:
        project = create_sample_project(db)
        print(f"✓ 创建项目: {project.name} (ID: {project.id})")
        
        create_sample_interfaces(db, project.id)
        print("✓ 创建接口清单 (4 个接口)")
        
        traffic_model = create_sample_traffic_model(db, project.id)
        print(f"✓ 创建流量模型: {traffic_model.name}")
        
        batch1, batch2 = create_sample_load_test_batches(db, project.id, traffic_model.id)
        print(f"✓ 创建压测批次: {batch1.name}, {batch2.name}")
        
        create_sample_machine_capacities(db, project.id)
        print("✓ 创建机器容量信息 (4 台服务器)")
        
        create_sample_monitoring_snapshots(db, project.id, batch1.id, batch2.id)
        print("✓ 创建监控快照 (4 条记录)")
        
        create_sample_optimization_actions(db, project.id, batch1.id, batch2.id)
        print("✓ 创建调优动作 (4 个动作，不同状态)")
        
        print("\n种子数据创建完成！")
        print(f"\n项目 ID: {project.id}")
        print(f"基线批次 ID: {batch1.id} (优化前)")
        print(f"对比批次 ID: {batch2.id} (优化后)")
        
    except Exception as e:
        print(f"创建种子数据时出错: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_data()
