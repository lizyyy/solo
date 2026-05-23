import sys
import os
from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models
import crud
import schemas
from datetime import datetime

models.Base.metadata.create_all(bind=engine)


def init_sample_data():
    db = SessionLocal()
    try:
        print("开始初始化样例数据...")

        categories = [
            {"code": "TOPS001", "name": "上衣", "description": "包括T恤、衬衫、卫衣等", "sort_order": 1},
            {"code": "PANT001", "name": "裤子", "description": "包括长裤、短裤、牛仔裤等", "sort_order": 2},
            {"code": "DRES001", "name": "连衣裙", "description": "各类连衣裙、裙子", "sort_order": 3},
            {"code": "OUTE001", "name": "外套", "description": "夹克、大衣、羽绒服等", "sort_order": 4},
            {"code": "UNDW001", "name": "内衣", "description": "内衣、睡衣等", "sort_order": 5},
            {"code": "ACCE001", "name": "配饰", "description": "围巾、帽子、手套等", "sort_order": 6},
        ]
        created_cats = 0
        for cat in categories:
            existing = db.query(models.ClothingCategory).filter(models.ClothingCategory.code == cat["code"]).first()
            if not existing:
                crud.create_clothing_category(db, schemas.ClothingCategoryCreate(**cat))
                created_cats += 1
                print(f"创建分类: {cat['name']}")
        if created_cats == 0:
            print(f"分类已存在，跳过创建")

        orgs = [
            {"code": "ORG001", "name": "希望小学", "contact_person": "张老师", "contact_phone": "13800138001", "address": "北京市朝阳区希望路1号", "description": "贫困地区小学"},
            {"code": "ORG002", "name": "阳光敬老院", "contact_person": "李院长", "contact_phone": "13800138002", "address": "上海市浦东新区阳光路2号", "description": "社区敬老院"},
            {"code": "ORG003", "name": "山区扶贫站", "contact_person": "王站长", "contact_phone": "13800138003", "address": "云南省昆明市山区路3号", "description": "偏远山区扶贫点"},
        ]
        created_orgs = 0
        for org in orgs:
            existing = db.query(models.DonationOrganization).filter(models.DonationOrganization.code == org["code"]).first()
            if not existing:
                crud.create_donation_organization(db, schemas.DonationOrganizationCreate(**org))
                created_orgs += 1
                print(f"创建机构: {org['name']}")
        if created_orgs == 0:
            print(f"机构已存在，跳过创建")

        reasons = [
            {"code": "REJ001", "name": "破损严重", "description": "衣物有明显破损、破洞", "sort_order": 1},
            {"code": "REJ002", "name": "污渍严重", "description": "有无法清洗的污渍", "sort_order": 2},
            {"code": "REJ003", "name": "发霉变质", "description": "衣物发霉有异味", "sort_order": 3},
            {"code": "REJ004", "name": "款式过时", "description": "过于老旧不适合捐赠", "sort_order": 4},
            {"code": "REJ005", "name": "特殊衣物", "description": "内衣等不适合二次捐赠的衣物", "sort_order": 5},
        ]
        created_reasons = 0
        for reason in reasons:
            existing = db.query(models.RejectionReason).filter(models.RejectionReason.code == reason["code"]).first()
            if not existing:
                crud.create_rejection_reason(db, schemas.RejectionReasonCreate(**reason))
                created_reasons += 1
                print(f"创建原因: {reason['name']}")
        if created_reasons == 0:
            print(f"淘汰原因已存在，跳过创建")

        timestamp = datetime.now().strftime("%H%M%S")
        batch1 = crud.create_donation_batch(db, schemas.DonationBatchCreate(
            batch_no=f"SAMPLE-BATCH1-{timestamp}",
            donor_name="张三",
            donor_phone="13900139001",
            donor_address="广东省广州市天河区",
            total_count=5,
            remark="个人捐赠衣物"
        ))
        print(f"创建批次: {batch1.batch_no}")

        batch2 = crud.create_donation_batch(db, schemas.DonationBatchCreate(
            batch_no=f"SAMPLE-BATCH2-{timestamp}",
            donor_name="李四",
            donor_phone="13900139002",
            donor_address="深圳市南山区",
            total_count=3,
            remark="公司集体捐赠"
        ))
        print(f"创建批次: {batch2.batch_no}")

        cats = db.query(models.ClothingCategory).all()
        cat_map = {c.name: c.id for c in cats}

        items_batch1 = [
            {"batch_id": batch1.id, "name": "白色T恤", "brand": "优衣库", "color": "白色", "size": "L", "material": "纯棉", "quality_level": 2, "estimated_value": 59.0, "category_id": cat_map.get("上衣")},
            {"batch_id": batch1.id, "name": "蓝色牛仔裤", "brand": "李维斯", "color": "蓝色", "size": "32", "material": "牛仔布", "quality_level": 1, "estimated_value": 299.0, "category_id": cat_map.get("裤子")},
            {"batch_id": batch1.id, "name": "黑色羽绒服", "brand": "波司登", "color": "黑色", "size": "XL", "material": "羽绒", "quality_level": 1, "estimated_value": 599.0, "category_id": cat_map.get("外套")},
            {"batch_id": batch1.id, "name": "红色围巾", "brand": "无印良品", "color": "红色", "size": "均码", "material": "羊毛", "quality_level": 2, "estimated_value": 99.0, "category_id": cat_map.get("配饰")},
            {"batch_id": batch1.id, "name": "旧内衣", "brand": "某品牌", "color": "肤色", "size": "M", "material": "棉", "quality_level": 3, "estimated_value": 0, "category_id": cat_map.get("内衣")},
        ]
        created_items = []
        for item in items_batch1:
            created = crud.create_clothing_item(db, schemas.ClothingItemCreate(**item))
            created_items.append(created)
            print(f"创建衣物: {item['name']} - {created.item_no}")

        items_batch2 = [
            {"batch_id": batch2.id, "name": "灰色卫衣", "brand": "耐克", "color": "灰色", "size": "M", "material": "棉质", "quality_level": 2, "estimated_value": 199.0, "category_id": cat_map.get("上衣")},
            {"batch_id": batch2.id, "name": "运动短裤", "brand": "阿迪达斯", "color": "黑色", "size": "L", "material": "涤纶", "quality_level": 2, "estimated_value": 129.0, "category_id": cat_map.get("裤子")},
            {"batch_id": batch2.id, "name": "羊毛大衣", "brand": "恒源祥", "color": "驼色", "size": "XL", "material": "羊毛", "quality_level": 1, "estimated_value": 899.0, "category_id": cat_map.get("外套")},
        ]
        for item in items_batch2:
            created = crud.create_clothing_item(db, schemas.ClothingItemCreate(**item))
            created_items.append(created)
            print(f"创建衣物: {item['name']} - {created.item_no}")

        orgs_list = db.query(models.DonationOrganization).all()
        org_map = {o.name: o.id for o in orgs_list}

        reasons_list = db.query(models.RejectionReason).all()
        reason_map = {r.name: r.id for r in reasons_list}

        for item in created_items[:3]:
            crud.create_sterilization_record(db, schemas.SterilizationRecordCreate(
                clothing_item_id=item.id,
                method="高温消毒",
                temperature=121.0,
                duration=30,
                operator="张分拣员",
                result="合格",
                remark="标准消毒流程"
            ))
            print(f"衣物 {item.name} 消毒完成")

        if len(created_items) >= 2:
            crud.create_donation_record(db, schemas.DonationRecordCreate(
                clothing_item_id=created_items[0].id,
                organization_id=org_map.get("希望小学"),
                operator="王管理员",
                receiver="李老师",
                remark="捐赠给希望小学学生"
            ))
            print(f"衣物 {created_items[0].name} 完成转赠")

        if len(created_items) >= 5:
            crud.create_rejection_record(db, schemas.RejectionRecordCreate(
                clothing_item_id=created_items[4].id,
                reason_id=reason_map.get("特殊衣物"),
                operator="张分拣员",
                remark="内衣不适合捐赠，已淘汰"
            ))
            print(f"衣物 {created_items[4].name} 已淘汰")

        crud.create_processing_exception(db, schemas.ProcessingExceptionCreate(
            batch_id=batch1.id,
            clothing_item_id=created_items[2].id if len(created_items) > 2 else None,
            original_input='{"name": "羽绒服", "brand": "波司登", "color": "黑色"}',
            error_message="品牌名称匹配异常",
            processing_step="衣物分类",
            conclusion="需要人工确认品牌信息",
            operator="系统自动检测"
        ))
        print("创建异常处理记录")

        report = crud.generate_sorting_report(db, batch1.id, operator="系统", summary="第一批捐赠衣物分拣完成，共5件，其中4件合格，1件淘汰")
        print(f"生成分拣报告: {report.report_no}")

        total_items_count = db.query(models.ClothingItem).count()

        print("\n样例数据初始化完成!")
        print(f"衣物分类: {len(categories)} 个（本次创建 {created_cats} 个")
        print(f"转赠机构: {len(orgs)} 个（本次创建 {created_orgs} 个")
        print(f"淘汰原因: {len(reasons)} 个（本次创建 {created_reasons} 个")
        print(f"本次创建捐赠批次: 2 个")
        print(f"本次创建衣物记录: {len(created_items)} 件")
        print(f"数据库总衣物数: {total_items_count} 件")
        print(f"包含消毒记录、转赠记录、淘汰记录、异常处理")

    except Exception as e:
        print(f"初始化失败: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    init_sample_data()
