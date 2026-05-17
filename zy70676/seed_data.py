from sqlalchemy.orm import Session
from database import engine, SamplingPoint, Unit, Parameter, Threshold, FieldRecord, LabResult
from datetime import datetime


def seed_database():
    db = Session(bind=engine)

    try:
        print("开始初始化测试数据...")

        units = [
            {"unit_code": "MG_L", "unit_name": "毫克/升", "dimension": "浓度", "conversion_factor": 1000.0},
            {"unit_code": "UG_L", "unit_name": "微克/升", "dimension": "浓度", "conversion_factor": 1.0},
            {"unit_code": "NG_L", "unit_name": "纳克/升", "dimension": "浓度", "conversion_factor": 0.001},
            {"unit_code": "PH", "unit_name": "pH值", "dimension": "pH", "conversion_factor": 1.0},
        ]
        for unit_data in units:
            if not db.query(Unit).filter(Unit.unit_code == unit_data["unit_code"]).first():
                db.add(Unit(**unit_data))
        db.commit()
        print("单位数据初始化完成")

        mg_l = db.query(Unit).filter(Unit.unit_code == "MG_L").first().id
        ug_l = db.query(Unit).filter(Unit.unit_code == "UG_L").first().id
        ph_unit = db.query(Unit).filter(Unit.unit_code == "PH").first().id

        parameters = [
            {"param_code": "PH", "param_name": "pH值", "default_unit_id": ph_unit},
            {"param_code": "DO", "param_name": "溶解氧", "default_unit_id": mg_l},
            {"param_code": "COD", "param_name": "化学需氧量", "default_unit_id": mg_l},
            {"param_code": "NH3N", "param_name": "氨氮", "default_unit_id": mg_l},
            {"param_code": "TP", "param_name": "总磷", "default_unit_id": mg_l},
        ]
        for param_data in parameters:
            if not db.query(Parameter).filter(Parameter.param_code == param_data["param_code"]).first():
                db.add(Parameter(**param_data))
        db.commit()
        print("参数数据初始化完成")

        ph_param = db.query(Parameter).filter(Parameter.param_code == "PH").first().id
        do_param = db.query(Parameter).filter(Parameter.param_code == "DO").first().id
        cod_param = db.query(Parameter).filter(Parameter.param_code == "COD").first().id
        nh3n_param = db.query(Parameter).filter(Parameter.param_code == "NH3N").first().id
        tp_param = db.query(Parameter).filter(Parameter.param_code == "TP").first().id

        thresholds = [
            {"parameter_id": ph_param, "water_grade": "Ⅰ类", "min_value": 6.0, "max_value": 9.0, "unit_id": ph_unit},
            {"parameter_id": do_param, "water_grade": "Ⅰ类", "min_value": 7.5, "max_value": None, "unit_id": mg_l},
            {"parameter_id": do_param, "water_grade": "Ⅱ类", "min_value": 6.0, "max_value": 7.5, "unit_id": mg_l},
            {"parameter_id": do_param, "water_grade": "Ⅲ类", "min_value": 5.0, "max_value": 6.0, "unit_id": mg_l},
            {"parameter_id": do_param, "water_grade": "Ⅳ类", "min_value": 3.0, "max_value": 5.0, "unit_id": mg_l},
            {"parameter_id": do_param, "water_grade": "Ⅴ类", "min_value": 2.0, "max_value": 3.0, "unit_id": mg_l},
            {"parameter_id": cod_param, "water_grade": "Ⅰ类", "min_value": None, "max_value": 15.0, "unit_id": mg_l},
            {"parameter_id": cod_param, "water_grade": "Ⅱ类", "min_value": 15.0, "max_value": 15.0, "unit_id": mg_l},
            {"parameter_id": cod_param, "water_grade": "Ⅲ类", "min_value": 15.0, "max_value": 20.0, "unit_id": mg_l},
            {"parameter_id": cod_param, "water_grade": "Ⅳ类", "min_value": 20.0, "max_value": 30.0, "unit_id": mg_l},
            {"parameter_id": cod_param, "water_grade": "Ⅴ类", "min_value": 30.0, "max_value": 40.0, "unit_id": mg_l},
            {"parameter_id": nh3n_param, "water_grade": "Ⅰ类", "min_value": None, "max_value": 0.15, "unit_id": mg_l},
            {"parameter_id": nh3n_param, "water_grade": "Ⅱ类", "min_value": 0.15, "max_value": 0.5, "unit_id": mg_l},
            {"parameter_id": nh3n_param, "water_grade": "Ⅲ类", "min_value": 0.5, "max_value": 1.0, "unit_id": mg_l},
            {"parameter_id": nh3n_param, "water_grade": "Ⅳ类", "min_value": 1.0, "max_value": 1.5, "unit_id": mg_l},
            {"parameter_id": nh3n_param, "water_grade": "Ⅴ类", "min_value": 1.5, "max_value": 2.0, "unit_id": mg_l},
            {"parameter_id": tp_param, "water_grade": "Ⅰ类", "min_value": None, "max_value": 0.02, "unit_id": mg_l},
            {"parameter_id": tp_param, "water_grade": "Ⅱ类", "min_value": 0.02, "max_value": 0.1, "unit_id": mg_l},
            {"parameter_id": tp_param, "water_grade": "Ⅲ类", "min_value": 0.1, "max_value": 0.2, "unit_id": mg_l},
            {"parameter_id": tp_param, "water_grade": "Ⅳ类", "min_value": 0.2, "max_value": 0.3, "unit_id": mg_l},
            {"parameter_id": tp_param, "water_grade": "Ⅴ类", "min_value": 0.3, "max_value": 0.4, "unit_id": mg_l},
        ]
        for threshold_data in thresholds:
            db.add(Threshold(**threshold_data))
        db.commit()
        print("阈值数据初始化完成")

        points = [
            {"point_code": "W001", "point_name": "长江入海口", "location": "上海市", "river_basin": "长江"},
            {"point_code": "W002", "point_name": "黄河中游", "location": "河南省郑州市", "river_basin": "黄河"},
            {"point_code": "W003", "point_name": "珠江广州段", "location": "广东省广州市", "river_basin": "珠江"},
            {"point_code": "W004", "point_name": "松花江哈尔滨段", "location": "黑龙江省哈尔滨市", "river_basin": "松花江"},
        ]
        for point_data in points:
            if not db.query(SamplingPoint).filter(SamplingPoint.point_code == point_data["point_code"]).first():
                db.add(SamplingPoint(**point_data))
        db.commit()
        print("采样点数据初始化完成")

        w001 = db.query(SamplingPoint).filter(SamplingPoint.point_code == "W001").first().id
        w002 = db.query(SamplingPoint).filter(SamplingPoint.point_code == "W002").first().id
        w003 = db.query(SamplingPoint).filter(SamplingPoint.point_code == "W003").first().id

        field_records = [
            {"record_code": "FR202401001", "sampling_point_id": w001, "sampling_time": datetime(2024, 1, 15, 9, 0), "collector": "张三", "weather": "晴", "temperature": 15.5, "status": "pending"},
            {"record_code": "FR202401002", "sampling_point_id": w002, "sampling_time": datetime(2024, 1, 15, 10, 30), "collector": "李四", "weather": "多云", "temperature": 12.0, "status": "pending"},
            {"record_code": "FR202401003", "sampling_point_id": w003, "sampling_time": datetime(2024, 1, 15, 14, 0), "collector": "王五", "weather": "阴", "temperature": 18.5, "status": "pending"},
        ]
        for record_data in field_records:
            if not db.query(FieldRecord).filter(FieldRecord.record_code == record_data["record_code"]).first():
                db.add(FieldRecord(**record_data))
        db.commit()
        print("现场记录数据初始化完成")

        fr1 = db.query(FieldRecord).filter(FieldRecord.record_code == "FR202401001").first().id
        fr2 = db.query(FieldRecord).filter(FieldRecord.record_code == "FR202401002").first().id
        fr3 = db.query(FieldRecord).filter(FieldRecord.record_code == "FR202401003").first().id

        lab_results = [
            {"field_record_id": fr1, "parameter_id": ph_param, "raw_value": 7.2, "raw_unit_id": ph_unit, "analyst": "赵六", "is_approved": False},
            {"field_record_id": fr1, "parameter_id": do_param, "raw_value": 6500.0, "raw_unit_id": ug_l, "analyst": "赵六", "is_approved": False},
            {"field_record_id": fr1, "parameter_id": cod_param, "raw_value": 18.0, "raw_unit_id": mg_l, "analyst": "赵六", "is_approved": False},
            {"field_record_id": fr1, "parameter_id": nh3n_param, "raw_value": 0.8, "raw_unit_id": mg_l, "analyst": "赵六", "is_approved": False},
            {"field_record_id": fr1, "parameter_id": tp_param, "raw_value": 0.15, "raw_unit_id": mg_l, "analyst": "赵六", "is_approved": False},

            {"field_record_id": fr2, "parameter_id": ph_param, "raw_value": 8.1, "raw_unit_id": ph_unit, "analyst": "钱七", "is_approved": True, "approver": "审核员A"},
            {"field_record_id": fr2, "parameter_id": do_param, "raw_value": 5.5, "raw_unit_id": mg_l, "analyst": "钱七", "is_approved": True, "approver": "审核员A"},
            {"field_record_id": fr2, "parameter_id": cod_param, "raw_value": 25.0, "raw_unit_id": mg_l, "analyst": "钱七", "is_approved": True, "approver": "审核员A"},
            {"field_record_id": fr2, "parameter_id": nh3n_param, "raw_value": 1.2, "raw_unit_id": mg_l, "analyst": "钱七", "is_approved": True, "approver": "审核员A"},

            {"field_record_id": fr3, "parameter_id": ph_param, "raw_value": 6.8, "raw_unit_id": ph_unit, "analyst": "孙八", "is_approved": False},
            {"field_record_id": fr3, "parameter_id": do_param, "raw_value": 4.2, "raw_unit_id": mg_l, "analyst": "孙八", "is_approved": False},
            {"field_record_id": fr3, "parameter_id": cod_param, "raw_value": 35.0, "raw_unit_id": mg_l, "analyst": "孙八", "is_approved": False},
        ]
        for result_data in lab_results:
            db.add(LabResult(**result_data))
        db.commit()
        print("实验室结果数据初始化完成")

        print("\n测试数据初始化成功！")
        print(f"- 采样点: {db.query(SamplingPoint).count()} 个")
        print(f"- 单位: {db.query(Unit).count()} 个")
        print(f"- 参数: {db.query(Parameter).count()} 个")
        print(f"- 阈值: {db.query(Threshold).count()} 个")
        print(f"- 现场记录: {db.query(FieldRecord).count()} 条")
        print(f"- 实验室结果: {db.query(LabResult).count()} 条")

    except Exception as e:
        db.rollback()
        print(f"初始化失败: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
