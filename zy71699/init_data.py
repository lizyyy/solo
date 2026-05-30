from app import create_app
from models import db, Instrument, FaultRecord, SparePart, SparePartOrder, Performance, PerformanceInstrument, Technician, TechnicianSchedule, RepairException, ExceptionStatus, Reminder, RepairOrder
from datetime import date, timedelta, datetime
import json

def dt_time(h, m):
    return datetime(2000, 1, 1, h, m).time()

app = create_app()

def init_data():
    with app.app_context():
        db.drop_all()
        db.create_all()

        print("=== 开始初始化基础数据 ===")

        erhu1 = Instrument(
            name="专业二胡",
            category="弓弦乐器",
            brand="敦煌",
            model="09A",
            serial_number="EH-2024-001",
            purchase_date=date(2022, 3, 15),
            purchase_price=8500.00,
            status="可用",
            location="民乐排练厅A区",
            remarks="一级演奏员专用"
        )
        erhu2 = Instrument(
            name="演奏级二胡",
            category="弓弦乐器",
            brand="敦煌",
            model="10A",
            serial_number="EH-2024-002",
            purchase_date=date(2023, 5, 20),
            purchase_price=12800.00,
            status="可用",
            location="民乐排练厅A区",
            remarks="首席专用"
        )
        dizi = Instrument(
            name="竹笛套笛",
            category="吹奏乐器",
            brand="董雪华",
            model="8883",
            serial_number="DZ-2024-001",
            purchase_date=date(2023, 8, 10),
            purchase_price=3200.00,
            status="可用",
            location="民乐排练厅B区",
            remarks="C/D/E/F/G调各一支"
        )
        yangqin = Instrument(
            name="402扬琴",
            category="弹拨乐器",
            brand="星海",
            model="8621L",
            serial_number="YQ-2024-001",
            purchase_date=date(2021, 11, 5),
            purchase_price=15600.00,
            status="可用",
            location="民乐排练厅C区",
            remarks="需要定期调音"
        )
        yangqin2 = Instrument(
            name="402扬琴",
            category="弹拨乐器",
            brand="乐海",
            model="T624",
            serial_number="YQ-2024-002",
            purchase_date=date(2022, 6, 18),
            purchase_price=9800.00,
            status="可用",
            location="民乐排练厅C区",
            remarks="备用乐器"
        )
        db.session.add_all([erhu1, erhu2, dizi, yangqin, yangqin2])
        db.session.flush()
        print(f"✓ 创建了 {Instrument.query.count()} 件乐器")

        fault1 = FaultRecord(
            instrument_id=erhu1.id,
            fault_date=date.today() - timedelta(days=5),
            reporter="张演奏员",
            fault_type="琴弓问题",
            description="琴弓马尾脱落严重，演奏时出现杂音，需要更换马尾",
            severity="一般",
            fault_location="琴弓"
        )
        fault2 = FaultRecord(
            instrument_id=dizi.id,
            fault_date=date.today() - timedelta(days=3),
            reporter="李演奏员",
            fault_type="笛膜问题",
            description="E调笛笛膜频繁松动，且笛塞有漏气现象，需要检查调整",
            severity="严重",
            fault_location="笛膜/笛塞"
        )
        fault3 = FaultRecord(
            instrument_id=yangqin.id,
            fault_date=date.today() - timedelta(days=10),
            reporter="王演奏员",
            fault_type="琴弦问题",
            description="高音区多根琴弦氧化严重，音准不稳定，需要整套更换琴弦",
            severity="严重",
            fault_location="高音区琴弦"
        )
        fault4 = FaultRecord(
            instrument_id=erhu2.id,
            fault_date=date.today() - timedelta(days=2),
            reporter="刘首席",
            fault_type="琴筒问题",
            description="琴筒蟒皮有轻微松垮，音色发闷，需要专业保养调整",
            severity="一般",
            fault_location="琴筒"
        )
        db.session.add_all([fault1, fault2, fault3, fault4])
        db.session.flush()
        print(f"✓ 创建了 {FaultRecord.query.count()} 条故障记录")

        sp1 = SparePart(
            name="二胡琴弓",
            sku="SP-EH-001",
            category="二胡配件",
            compatible_instruments="所有二胡",
            unit="支",
            stock_quantity=3,
            safety_stock=5,
            unit_price=180.00,
            supplier="北京民乐配件厂"
        )
        sp2 = SparePart(
            name="二胡马尾",
            sku="SP-EH-002",
            category="二胡配件",
            compatible_instruments="所有二胡",
            unit="束",
            stock_quantity=0,
            safety_stock=10,
            unit_price=45.00,
            supplier="上海民乐配件厂"
        )
        sp3 = SparePart(
            name="笛膜套装",
            sku="SP-DZ-001",
            category="笛子配件",
            compatible_instruments="所有竹笛",
            unit="套",
            stock_quantity=15,
            safety_stock=20,
            unit_price=28.00,
            supplier="安徽五河笛膜厂"
        )
        sp4 = SparePart(
            name="扬琴琴弦402全套",
            sku="SP-YQ-001",
            category="扬琴配件",
            compatible_instruments="402型扬琴",
            unit="套",
            stock_quantity=1,
            safety_stock=3,
            unit_price=320.00,
            supplier="北京星海乐器配件"
        )
        sp5 = SparePart(
            name="扬琴琴竹",
            sku="SP-YQ-002",
            category="扬琴配件",
            compatible_instruments="所有扬琴",
            unit="副",
            stock_quantity=8,
            safety_stock=6,
            unit_price=85.00,
            supplier="苏州民族乐器一厂"
        )
        sp6 = SparePart(
            name="二胡松香",
            sku="SP-EH-003",
            category="二胡配件",
            compatible_instruments="所有弓弦乐器",
            unit="块",
            stock_quantity=2,
            safety_stock=10,
            unit_price=35.00,
            supplier="天津乐器配件厂"
        )
        db.session.add_all([sp1, sp2, sp3, sp4, sp5, sp6])
        db.session.flush()
        print(f"✓ 创建了 {SparePart.query.count()} 种备件")

        perf1 = Performance(
            name="《新春音乐会》",
            performance_date=date.today() + timedelta(days=12),
            performance_time=dt_time(19, 30),
            venue="国家大剧院音乐厅",
            city="北京",
            program="春节序曲、二泉映月、扬鞭催马运粮忙等",
            conductor="陈首席指挥"
        )
        perf2 = Performance(
            name="全国巡演上海站",
            performance_date=date.today() + timedelta(days=28),
            performance_time=dt_time(19, 0),
            venue="上海东方艺术中心",
            city="上海",
            program="经典民族管弦乐作品专场",
            conductor="陈首席指挥"
        )
        perf3 = Performance(
            name="全国巡演广州站",
            performance_date=date.today() + timedelta(days=40),
            performance_time=dt_time(20, 0),
            venue="广州大剧院",
            city="广州",
            program="经典民族管弦乐作品专场",
            conductor="陈首席指挥"
        )
        db.session.add_all([perf1, perf2, perf3])
        db.session.flush()

        pi1 = PerformanceInstrument(performance_id=perf1.id, instrument_id=erhu1.id, player="张演奏员", call_time=dt_time(17, 0))
        pi2 = PerformanceInstrument(performance_id=perf1.id, instrument_id=erhu2.id, player="刘首席", call_time=dt_time(17, 0))
        pi3 = PerformanceInstrument(performance_id=perf1.id, instrument_id=dizi.id, player="李演奏员", call_time=dt_time(17, 0))
        pi4 = PerformanceInstrument(performance_id=perf1.id, instrument_id=yangqin.id, player="王演奏员", call_time=dt_time(17, 0))
        pi5 = PerformanceInstrument(performance_id=perf2.id, instrument_id=erhu1.id, player="张演奏员", call_time=dt_time(16, 30))
        pi6 = PerformanceInstrument(performance_id=perf2.id, instrument_id=yangqin.id, player="王演奏员", call_time=dt_time(16, 30))
        pi7 = PerformanceInstrument(performance_id=perf3.id, instrument_id=yangqin2.id, player="王演奏员", call_time=dt_time(17, 0))
        db.session.add_all([pi1, pi2, pi3, pi4, pi5, pi6, pi7])
        db.session.flush()
        print(f"✓ 创建了 {Performance.query.count()} 场演出，{PerformanceInstrument.query.count()} 条演出乐器关联")

        tech1 = Technician(
            name="王师傅",
            phone="13800138001",
            email="wangshifu@minyue.com",
            specialty="二胡、小提琴等弓弦乐器维修",
            skill_level="高级",
            is_active=True
        )
        tech2 = Technician(
            name="李师傅",
            phone="13800138002",
            email="lishifu@minyue.com",
            specialty="笛子、笙、箫等吹奏乐器维修",
            skill_level="高级",
            is_active=True
        )
        tech3 = Technician(
            name="赵师傅",
            phone="13800138003",
            email="zhaoshifu@minyue.com",
            specialty="扬琴、古筝等弹拨乐器维修",
            skill_level="高级",
            is_active=True
        )
        tech4 = Technician(
            name="周师傅",
            phone="13800138004",
            email="zhoushifu@minyue.com",
            specialty="综合乐器维修保养",
            skill_level="中级",
            is_active=True
        )
        db.session.add_all([tech1, tech2, tech3, tech4])
        db.session.flush()

        for i in range(14):
            d = date.today() + timedelta(days=i)
            if d.weekday() < 5:
                for tech in [tech1, tech2, tech3]:
                    sched = TechnicianSchedule(
                        technician_id=tech.id,
                        schedule_date=d,
                        shift_type="白班",
                        start_time=dt_time(9, 0),
                        end_time=dt_time(17, 0)
                    )
                    db.session.add(sched)
                sched4 = TechnicianSchedule(
                    technician_id=tech4.id,
                    schedule_date=d,
                    shift_type="晚班",
                    start_time=dt_time(13, 0),
                    end_time=dt_time(21, 0)
                )
                db.session.add(sched4)
        db.session.flush()
        print(f"✓ 创建了 {Technician.query.count()} 名维修师，{TechnicianSchedule.query.count()} 条排班")

        db.session.commit()
        print("\n=== 基础数据初始化完成 ===")

        from datetime import time
        db.session.commit()

        print("\n=== 开始创建测试业务数据（包含例外场景） ===")

        from services.repair_service import RepairService
        from services.status_service import StatusService
        from services.exception_service import ExceptionService
        from services.confirmation_service import ConfirmationService
        from services.reminder_service import ReminderService
        from datetime import datetime

        print("\n--- 场景1：正常维修流程（二胡琴弓更换） ---")
        order1_data = {
            'instrument_id': erhu1.id,
            'fault_record_id': fault1.id,
            'priority': '普通',
            'description': '更换二胡琴弓马尾，调整琴弓弧度',
            'repair_type': '常规保养',
            'estimated_hours': 2.0,
            'scheduled_start_date': date.today().isoformat(),
            'scheduled_complete_date': (date.today() + timedelta(days=1)).isoformat(),
            'operated_by': '张管理员'
        }
        order1 = RepairService.create_repair_order(order1_data, created_by='张管理员')
        order1 = RepairService.assign_technician(order1.id, tech1.id,
                                                  date.today(), date.today() + timedelta(days=1),
                                                  operated_by='张管理员')
        order1 = RepairService.start_repair(order1.id, operated_by='王师傅')
        RepairService.add_spare_part_usage(order1.id, sp1.id, 1, used_by='王师傅', remarks='更换全新琴弓')
        conf1 = ConfirmationService.confirm_repair_completion(order1.id, '质检李主任', quality_check_note='琴弓更换完成，音色测试通过')
        conf2 = ConfirmationService.confirm_instrument_return(order1.id, '张管理员', return_note='乐器已归还，演奏员验收通过')
        print(f"✓ 工单 {order1.order_no} 已完成全部流程，状态：{order1.status.value}")
        print(f"  - 维修完成确认ID：{conf1.id}，确认人：{conf1.confirmed_by}")
        print(f"  - 归还确认ID：{conf2.id}，确认人：{conf2.confirmed_by}")

        print("\n--- 场景2：维修中发现需采购备件（扬琴换弦），会触发备件匹配 ---")
        order2_data = {
            'instrument_id': yangqin.id,
            'fault_record_id': fault3.id,
            'priority': '高',
            'description': '更换扬琴全套琴弦，调音',
            'repair_type': '故障维修',
            'estimated_hours': 4.0,
            'scheduled_start_date': (date.today() + timedelta(days=1)).isoformat(),
            'scheduled_complete_date': (date.today() + timedelta(days=3)).isoformat(),
            'operated_by': '张管理员'
        }
        order2 = RepairService.create_repair_order(order2_data, created_by='张管理员')
        order2 = RepairService.assign_technician(order2.id, tech3.id,
                                                  date.today() + timedelta(days=1),
                                                  date.today() + timedelta(days=3),
                                                  operated_by='张管理员')
        order2 = RepairService.start_repair(order2.id, operated_by='赵师傅')
        print(f"✓ 工单 {order2.order_no} 已派工开始维修")

        past_date = date.today() - timedelta(days=5)
        spo1 = RepairService.create_spare_part_order_for_repair(
            order2.id, sp4.id, 2,
            expected_arrival_date=date.today() - timedelta(days=2),
            supplier='北京星海乐器配件',
            operated_by='赵师傅'
        )
        print(f"✓ 创建备件订单 {spo1.order_no}，预计到货日期设为过去（模拟备件晚到）")

        delay_exc = ExceptionService.detect_spare_part_delay(spo1.id)
        print(f"✓ 检测到备件晚到例外：{delay_exc.description[:60]}..." if delay_exc else "✗ 未检测到例外")

        print("\n--- 场景3：重复派修（同一乐器创建多个未完成工单） ---")
        order3_data = {
            'instrument_id': erhu2.id,
            'fault_record_id': fault4.id,
            'priority': '普通',
            'description': '琴筒蟒皮保养调整',
            'repair_type': '常规保养',
            'estimated_hours': 3.0,
            'scheduled_start_date': (date.today() + timedelta(days=2)).isoformat(),
            'scheduled_complete_date': (date.today() + timedelta(days=4)).isoformat(),
            'operated_by': '张管理员'
        }
        order3 = RepairService.create_repair_order(order3_data, created_by='张管理员')
        order3 = RepairService.assign_technician(order3.id, tech1.id,
                                                  date.today() + timedelta(days=2),
                                                  date.today() + timedelta(days=4),
                                                  operated_by='张管理员')
        print(f"✓ 创建第一个工单 {order3.order_no} 并派工")

        order4_data = {
            'instrument_id': erhu2.id,
            'priority': '高',
            'description': '二胡琴轴松动，需要重新打磨固定',
            'repair_type': '故障维修',
            'estimated_hours': 1.5,
            'scheduled_start_date': (date.today() + timedelta(days=1)).isoformat(),
            'scheduled_complete_date': (date.today() + timedelta(days=2)).isoformat(),
            'operated_by': '李助理（重复录入）'
        }
        order4 = RepairService.create_repair_order(order4_data, created_by='李助理（重复录入）')
        print(f"✓ 创建第二个工单 {order4.order_no}（同一乐器，未派工）")

        dup_exc = ExceptionService.detect_duplicate_repair(erhu2.id, new_repair_order_id=order4.id)
        print(f"✓ 检测到重复派修例外：{len(dup_exc)} 个工单存在冲突" if dup_exc else "✗ 未检测到例外")

        print("\n--- 场景4：演出前未归还检测 ---")
        order5_data = {
            'instrument_id': dizi.id,
            'fault_record_id': fault2.id,
            'priority': '紧急',
            'description': '检查维修笛塞漏气问题，更换笛膜',
            'repair_type': '故障维修',
            'estimated_hours': 2.5,
            'scheduled_start_date': (date.today() + timedelta(days=1)).isoformat(),
            'scheduled_complete_date': (date.today() + timedelta(days=15)).isoformat(),
            'operated_by': '张管理员'
        }
        order5 = RepairService.create_repair_order(order5_data, created_by='张管理员')
        order5 = RepairService.assign_technician(order5.id, tech2.id,
                                                  date.today() + timedelta(days=1),
                                                  date.today() + timedelta(days=15),
                                                  operated_by='张管理员')
        order5 = RepairService.start_repair(order5.id, operated_by='李师傅')
        print(f"✓ 创建笛子维修工单 {order5.order_no}，预计完工日期（{order5.scheduled_complete_date}）晚于演出日期（{perf1.performance_date}）")

        perf_excs = ExceptionService.detect_not_returned_before_performance()
        print(f"✓ 检测到演出前未归还风险：{len(perf_excs)} 条")

        print("\n--- 场景5：补录历史故障记录 ---")
        fault5 = FaultRecord(
            instrument_id=yangqin2.id,
            fault_date=date.today() - timedelta(days=60),
            reporter="王演奏员",
            fault_type="琴码问题",
            description="琴码高度不合适，导致高音区音量不足，已临时调整",
            severity="一般",
            fault_location="琴码",
            is_resolved=True,
            resolution_note="2024年3月15日已打磨琴码调整高度，问题解决"
        )
        fault6 = FaultRecord(
            instrument_id=erhu1.id,
            fault_date=date.today() - timedelta(days=45),
            reporter="张演奏员",
            fault_type="千斤问题",
            description="千斤线磨损，需要更换",
            severity="一般",
            fault_location="千斤",
            is_resolved=True,
            resolution_note="已更换千斤线并调整角度"
        )
        db.session.add_all([fault5, fault6])
        db.session.flush()
        print(f"✓ 补录了 2 条历史故障记录（已解决）")

        print("\n--- 场景6：人工确认例外 ---")
        if delay_exc:
            conf_delay = ConfirmationService.confirm_exception(
                delay_exc.id,
                confirmed_by='维修主管孙主任',
                confirmation_note='已知悉备件延误情况，已与供应商确认，预计明天到货',
                resolve_exception=False
            )
            print(f"✓ 已确认备件延误例外 #{delay_exc.id}，确认人：{conf_delay.confirmed_by}")

        if dup_exc:
            first_exc = RepairException.query.filter_by(
                exception_type='重复派修',
                repair_order_id=order3.id
            ).first()
            if first_exc:
                RepairService.cancel_repair_order(order4.id, '重复工单，保留第一个工单处理', operated_by='张管理员')
                conf_dup = ConfirmationService.confirm_exception(
                    first_exc.id,
                    confirmed_by='维修主管孙主任',
                    confirmation_note='已核实为重复录入，已取消第二个工单',
                    resolve_exception=True,
                    resolution_note='取消重复工单 RO-xxx，保留原工单继续处理'
                )
                print(f"✓ 已确认并解决重复派修例外 #{first_exc.id}")

        perf_exc = perf_excs[0] if perf_excs else None
        if perf_exc:
            conf_perf = ConfirmationService.confirm_exception(
                perf_exc.id,
                confirmed_by='团长特批',
                confirmation_note='李师傅承诺加班赶工，演出前一定完成',
                resolve_exception=False
            )
            print(f"✓ 已确认演出前未归还风险例外 #{perf_exc.id}，确认人：{conf_perf.confirmed_by}")

        print("\n--- 场景7：创建提醒 ---")
        ReminderService.check_and_create_return_deadline_reminders()
        ReminderService.check_and_create_spare_arrival_reminders()
        print(f"✓ 已创建提醒，共 {Reminder.query.count()} 条")

        db.session.commit()
        print("\n=== 所有测试数据创建完成 ===")

        ids = {
            'instruments': {i.name: i.id for i in Instrument.query.all()},
            'fault_records': {i.description[:30]: i.id for i in FaultRecord.query.all()},
            'spare_parts': {i.name: i.id for i in SparePart.query.all()},
            'spare_orders': {i.order_no: i.id for i in SparePartOrder.query.all()},
            'performances': {p.name: p.id for p in Performance.query.all()},
            'technicians': {t.name: t.id for t in Technician.query.all()},
            'repair_orders': {r.order_no: r.id for r in RepairOrder.query.all()},
            'exceptions': {e.id: e.exception_type.value for e in RepairException.query.all()}
        }

        with open('test_ids.json', 'w', encoding='utf-8') as f:
            json.dump(ids, f, ensure_ascii=False, indent=2)
        print(f"\n✓ ID映射已保存到 test_ids.json")

        return ids


if __name__ == '__main__':
    ids = init_data()
    print("\n=== 测试场景总结 ===")
    print("✓ 正常流程：二胡琴弓更换（完整生命周期+两次人工确认）")
    print("✓ 备件匹配：扬琴换弦（库存不足→采购→晚到→例外检测）")
    print("✓ 重复派修：二胡两个同时存在的工单→例外检测→人工确认→取消重复工单")
    print("✓ 日程冲突：笛子维修预计完工晚于演出→例外检测→人工确认")
    print("✓ 补录记录：两条历史故障记录补录")
    print("✓ 状态历史：所有状态变更均有留痕")
    print("✓ 人工确认：所有确认动作均保存前后快照")
    print("✓ 提醒留痕：自动创建归还期限和备件延误提醒")
