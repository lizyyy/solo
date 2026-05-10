#!/usr/bin/env python3
"""生成样例数据，包含各种场景和边界值"""
import os
import shutil
from perfume_sample_manager.storage import DataStorage
from perfume_sample_manager.logic import SampleManager


def cleanup_data():
    """清理旧数据"""
    data_dir = 'data'
    if os.path.exists(data_dir):
        shutil.rmtree(data_dir)
        print('✓ 已清理旧数据')


def create_sample_data():
    """创建样例数据"""
    cleanup_data()
    
    storage = DataStorage()
    manager = SampleManager(storage)
    
    print('\n' + '=' * 60)
    print('创建样例数据 - 跨店调香样品管理')
    print('=' * 60)
    
    print('\n[1] 创建样品批次...')
    
    batch1 = manager.create_batch(
        batch_id='B001',
        fragrance_name='东方玫瑰',
        total_quantity=100,
        production_date='2024-12-01',
        notes='经典玫瑰香型，适合冬季推广'
    )
    print(f'  ✓ {batch1.batch_id}: {batch1.fragrance_name} ({batch1.total_quantity}个)')
    
    batch2 = manager.create_batch(
        batch_id='B002',
        fragrance_name='清新柑橘',
        total_quantity=50,
        production_date='2024-12-15',
        notes='夏季爆款，清爽提神'
    )
    print(f'  ✓ {batch2.batch_id}: {batch2.fragrance_name} ({batch2.total_quantity}个)')
    
    batch3 = manager.create_batch(
        batch_id='B003',
        fragrance_name='木质檀香',
        total_quantity=30,
        production_date='2025-01-01',
        notes='新品试香，需重点关注反馈'
    )
    print(f'  ✓ {batch3.batch_id}: {batch3.fragrance_name} ({batch3.total_quantity}个)')
    
    batch4 = manager.create_batch(
        batch_id='B004',
        fragrance_name='甜美花果',
        total_quantity=20,
        production_date='2025-01-10',
        notes='测试批次，小批量生产'
    )
    print(f'  ✓ {batch4.batch_id}: {batch4.fragrance_name} ({batch4.total_quantity}个)')
    
    print('\n[2] 发样到各门店（含边界值场景）...')
    
    ship1 = manager.ship(
        shipment_id='S001',
        batch_id='B001',
        store_name='上海恒隆广场店',
        quantity=20,
        shipment_date='2024-12-05',
        responsible_person='李经理',
        notes='首批试香，重点推荐'
    )
    print(f'  ✓ {ship1.shipment_id}: {ship1.store_name} ({ship1.quantity}个) - 正常发样')
    
    ship2 = manager.ship(
        shipment_id='S002',
        batch_id='B001',
        store_name='北京三里屯店',
        quantity=30,
        shipment_date='2024-12-06',
        responsible_person='王店长',
        notes='周末活动用'
    )
    print(f'  ✓ {ship2.shipment_id}: {ship2.store_name} ({ship2.quantity}个) - 时间跨天')
    
    ship3 = manager.ship(
        shipment_id='S003',
        batch_id='B002',
        store_name='深圳万象城店',
        quantity=15,
        shipment_date='2024-12-20',
        responsible_person=None,
        notes='负责人临时空缺'
    )
    print(f'  ✓ {ship3.shipment_id}: {ship3.store_name} ({ship3.quantity}个) - 负责人缺失')
    
    ship4 = manager.ship(
        shipment_id='S004',
        batch_id='B002',
        store_name='杭州湖滨银泰店',
        quantity=20,
        shipment_date='2024-12-21',
        responsible_person='张主管',
        notes='圣诞活动'
    )
    print(f'  ✓ {ship4.shipment_id}: {ship4.store_name} ({ship4.quantity}个) - 正常发样')
    
    ship5 = manager.ship(
        shipment_id='S005',
        batch_id='B003',
        store_name='成都IFS店',
        quantity=10,
        shipment_date='2025-01-05',
        responsible_person='刘店长',
        notes='新品试香'
    )
    print(f'  ✓ {ship5.shipment_id}: {ship5.store_name} ({ship5.quantity}个) - 正常发样')
    
    ship6 = manager.ship(
        shipment_id='S006',
        batch_id='B004',
        store_name='广州天河城店',
        quantity=10,
        shipment_date='2025-01-15',
        responsible_person='陈经理',
        notes='测试批次发样'
    )
    print(f'  ✓ {ship6.shipment_id}: {ship6.store_name} ({ship6.quantity}个) - 正常发样')
    
    print('\n[3] 登记试香反馈（含好评和一般评价）...')
    
    fb1 = manager.register_feedback(
        feedback_id='F001',
        shipment_id='S001',
        rating=5,
        comments='客户反馈非常好，留香持久，多人询问购买',
        feedback_date='2024-12-10',
        tester_name='小美'
    )
    print(f'  ✓ {fb1.feedback_id}: 好评 ({fb1.rating}/5) - 东方玫瑰')
    
    fb2 = manager.register_feedback(
        feedback_id='F002',
        shipment_id='S002',
        rating=4,
        comments='整体不错，略感浓郁，适合秋冬',
        feedback_date='2024-12-15',
        tester_name='阿杰'
    )
    print(f'  ✓ {fb2.feedback_id}: 较好 ({fb2.rating}/5) - 东方玫瑰')
    
    fb3 = manager.register_feedback(
        feedback_id='F003',
        shipment_id='S004',
        rating=2,
        comments='前调太冲，后调可以接受',
        feedback_date='2024-12-28',
        tester_name='莉莉'
    )
    print(f'  ✓ {fb3.feedback_id}: 一般 ({fb3.rating}/5) - 清新柑橘')
    
    fb4 = manager.register_feedback(
        feedback_id='F004',
        shipment_id='S005',
        rating=5,
        comments='新品表现超出预期，木质调很高级',
        feedback_date='2025-01-10',
        tester_name='大卫'
    )
    print(f'  ✓ {fb4.feedback_id}: 好评 ({fb4.rating}/5) - 木质檀香')
    
    print('\n[4] 登记样品回收（含各种场景和边界值）...')
    
    rc1 = manager.recover(
        recovery_id='R001',
        shipment_id='S001',
        quantity_recovered=8,
        recovery_date='2024-12-15',
        lost_quantity=0,
        notes='活动结束，剩余样品全部回收'
    )
    print(f'  ✓ {rc1.recovery_id}: 回收{rc1.quantity_recovered}个，丢失0个 - 正常回收（发样20个，试香12个，剩余8个）')
    
    rc2 = manager.recover(
        recovery_id='R002',
        shipment_id='S002',
        quantity_recovered=5,
        recovery_date='2024-12-20',
        lost_quantity=3,
        notes='部分丢失，已登记'
    )
    print(f'  ✓ {rc2.recovery_id}: 回收{rc2.quantity_recovered}个，丢失{rc2.lost_quantity}个 - 丢失未赔付')
    
    rc3 = manager.recover(
        recovery_id='R003',
        shipment_id='S004',
        quantity_recovered=0,
        recovery_date='2025-01-05',
        lost_quantity=5,
        notes='全部试香使用完毕，无剩余回收'
    )
    print(f'  ✓ {rc3.recovery_id}: 回收{rc3.quantity_recovered}个，丢失{rc3.lost_quantity}个 - 数量为零边界值')
    
    rc4 = manager.recover(
        recovery_id='R004',
        shipment_id='S006',
        quantity_recovered=3,
        recovery_date='2025-01-20',
        lost_quantity=2,
        notes='部分完成，待赔付'
    )
    print(f'  ✓ {rc4.recovery_id}: 回收{rc4.quantity_recovered}个，丢失{rc4.lost_quantity}个 - 部分完成')
    
    print('\n[5] 登记丢失赔付（含已赔付场景）...')
    
    cmp1 = manager.compensate(
        compensation_id='C001',
        recovery_id='R003',
        amount=500.00,
        compensation_date='2025-01-10',
        responsible_person='财务小李',
        notes='正常赔付流程'
    )
    print(f'  ✓ {cmp1.compensation_id}: ¥{cmp1.amount:.2f} - 已赔付')
    
    print('\n[6] 创建异常场景...')
    
    print('  异常场景已包含在样例数据中：')
    print('  • S003: 反馈缺失（已发样，未登记反馈）')
    print('  • S006: 反馈缺失（已发样、已回收，未登记反馈）')
    print('  • R002: 样品丢失未赔付（S002的回收记录，丢失3个未赔付）')
    print('  • R004: 样品丢失未赔付（S006的回收记录，丢失2个未赔付）')
    print('  • S003: 负责人缺失')
    print('  • R003: 数量为零（回收0个）')
    print('  • S001→R001: 时间跨天（发样2024-12-05，回收2024-12-15）')
    
    print('\n' + '=' * 60)
    print('样例数据创建完成！')
    print('=' * 60)
    print('\n可运行以下命令查看数据：')
    print('  python main.py batch list      - 查看批次列表')
    print('  python main.py shipment list   - 查看发样列表')
    print('  python main.py feedback list   - 查看反馈列表')
    print('  python main.py report          - 生成完整报告')
    print('  python main.py remaining B001  - 查看B001批次剩余量')
    print('  python main.py export          - 导出JSON报告')
    print('\n可运行以下命令测试异常场景：')
    print('  python main.py shipment send --id TEST --batch B001 --store "上海恒隆广场店" --quantity 5 --date 2025-01-01')
    print('    - 测试重复发样同一批次到同一门店')


if __name__ == '__main__':
    create_sample_data()
