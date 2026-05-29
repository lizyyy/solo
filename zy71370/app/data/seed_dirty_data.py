import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app import models

models.Base.metadata.create_all(bind=engine)


def seed_data():
    db = SessionLocal()

    try:
        if db.query(models.PaintInventory).count() > 0:
            print("数据库已有数据，跳过导入。如需重新导入，请先删除 paint_studio.db 文件。")
            return

        paints = [
            {"name": "钛白", "brand": "温莎牛顿", "l_value": 97.5, "a_value": 0.2, "b_value": 1.8,
             "hex_code": "#FAFAF8", "stock": 15, "price": 28.5,
             "purchase_link": "https://item.jd.com/123456.html", "notes": "老师推荐，常用基础色"},
            {"name": "钛白", "brand": "马利", "l_value": 96.8, "a_value": 0.5, "b_value": 2.1,
             "hex_code": "#F8F8F5", "stock": 8, "price": 18.0,
             "purchase_link": "https://item.taobao.com/item.htm?id=654321", "notes": "性价比高，学生常用"},
            {"name": "钛白", "brand": "温莎牛顿", "l_value": 97.5, "a_value": 0.2, "b_value": 1.8,
             "hex_code": "#FAFAF8", "stock": 5, "price": 28.5,
             "purchase_link": "https://item.jd.com/123456.html", "data_quality": "dirty",
             "notes": "王老师2024.3重复录入，待合并"},
            {"name": "镉黄中黄", "brand": "温莎牛顿", "l_value": 78.2, "a_value": 12.5, "b_value": 85.3,
             "hex_code": "#F5C71A", "stock": 0, "price": 45.0,
             "purchase_link": "https://item.jd.com/234567.html", "notes": "断货中，供应商说下月到货"},
            {"name": "柠檬黄", "brand": "马利", "l_value": 88.1, "a_value": -6.2, "b_value": 95.8,
             "hex_code": "#F9F00B", "stock": 12, "price": 15.5,
             "purchase_link": "https://item.taobao.com/item.htm?id=765432", "notes": ""},
            {"name": "土黄", "brand": "温莎牛顿", "l_value": 58.3, "a_value": 18.7, "b_value": 58.2,
             "hex_code": "#C49A3A", "stock": 6, "price": 32.0,
             "purchase_link": "https://item.jd.com/345678.html", "notes": ""},
            {"name": "大红", "brand": "温莎牛顿", "l_value": 48.5, "a_value": 68.2, "b_value": 45.1,
             "hex_code": "#D92121", "stock": 0, "price": 42.0,
             "purchase_link": "https://item.jd.com/456789.html", "notes": "已停产，建议找替代品"},
            {"name": "朱红", "brand": "马利", "l_value": 52.1, "a_value": 62.5, "b_value": 48.3,
             "hex_code": "#E34234", "stock": 10, "price": 16.0,
             "purchase_link": "https://item.taobao.com/item.htm?id=876543", "notes": "可替代大红"},
            {"name": "玫瑰红", "brand": "樱花", "l_value": 42.8, "a_value": 58.3, "b_value": 12.5,
             "hex_code": "#C21E56", "stock": 7, "price": 25.0,
             "purchase_link": "https://item.jd.com/567890.html", "notes": ""},
            {"name": "群青蓝", "brand": "温莎牛顿", "l_value": 28.5, "a_value": 35.2, "b_value": -78.6,
             "hex_code": "#1C39BB", "stock": 18, "price": 38.0,
             "purchase_link": "https://item.jd.com/678901.html", "notes": "老师强烈推荐"},
            {"name": "普蓝", "brand": "马利", "l_value": 18.2, "a_value": 22.5, "b_value": -65.8,
             "hex_code": "#0A1172", "stock": 4, "price": 14.0,
             "purchase_link": "https://item.taobao.com/item.htm?id=987654", "notes": ""},
            {"name": "湖蓝", "brand": "樱花", "l_value": 52.3, "a_value": -25.6, "b_value": -48.2,
             "hex_code": "#318CE7", "stock": 0, "price": 22.0,
             "purchase_link": "https://item.jd.com/789012.html", "notes": "断货"},
            {"name": "翠绿", "brand": "温莎牛顿", "l_value": 45.2, "a_value": -68.5, "b_value": 35.8,
             "hex_code": "#0B6623", "stock": 9, "price": 40.0,
             "purchase_link": "https://item.jd.com/890123.html", "notes": ""},
            {"name": "草绿", "brand": "马利", "l_value": 55.6, "a_value": -48.2, "b_value": 45.3,
             "hex_code": "#4F7942", "stock": 3, "price": 15.0,
             "purchase_link": "https://item.taobao.com/item.htm?id=112233", "notes": ""},
            {"name": "赭石", "brand": "温莎牛顿", "l_value": 42.5, "a_value": 45.2, "b_value": 48.6,
             "hex_code": "#7C3029", "stock": 11, "price": 35.0,
             "purchase_link": "https://item.jd.com/901234.html", "notes": ""},
            {"name": "熟褐", "brand": "马利", "l_value": 32.1, "a_value": 38.5, "b_value": 42.3,
             "hex_code": "#5C4033", "stock": -2, "price": 16.5,
             "purchase_link": "https://item.taobao.com/item.htm?id=223344", "data_quality": "dirty",
             "notes": "库存负数，待盘点"},
            {"name": "象牙黑", "brand": "温莎牛顿", "l_value": 12.5, "a_value": 1.2, "b_value": 2.5,
             "hex_code": "#121212", "stock": 20, "price": 30.0,
             "purchase_link": "https://item.jd.com/012345.html", "notes": ""},
            {"name": "紫罗兰", "brand": "樱花", "l_value": 35.8, "a_value": 52.3, "b_value": -35.6,
             "hex_code": "#5F259F", "stock": 6, "price": 24.0,
             "purchase_link": "https://item.jd.com/135790.html", "notes": ""},
            {"name": "橙色", "brand": "马利", "l_value": 65.2, "a_value": 48.6, "b_value": 68.9,
             "hex_code": "#FF7F00", "stock": 8, "price": 14.5,
             "purchase_link": "https://item.taobao.com/item.htm?id=334455", "notes": ""},
            {"name": "金色", "brand": "樱花", "l_value": 150.5, "a_value": 200.3, "b_value": 180.2,
             "hex_code": "#FFD700", "stock": 4, "price": 35.0,
             "purchase_link": "https://item.jd.com/246801.html", "data_quality": "dirty",
             "notes": "LAB值超标，李老师随便填的，待测量"},
            {"name": "银色", "brand": "马利", "l_value": -10.2, "a_value": -150.5, "b_value": 50.3,
             "hex_code": "#C0C0C0", "stock": 5, "price": 32.0,
             "purchase_link": "https://item.taobao.com/item.htm?id=445566", "data_quality": "dirty",
             "notes": "LAB值异常，张老师录入错误"},
            {"name": "肉色", "brand": "温莎牛顿", "l_value": 82.5, "a_value": 18.3, "b_value": 25.6,
             "hex_code": "#F5D0C5", "stock": 2, "price": 28.0,
             "purchase_link": "https://item.jd.com/369121.html", "notes": "库存紧张"},
            {"name": "酞青蓝", "brand": "温莎牛顿", "l_value": 30.5, "a_value": 28.3, "b_value": -88.6,
             "hex_code": "#0E4D92", "stock": 7, "price": 36.0,
             "purchase_link": "https://item.jd.com/481216.html", "notes": ""},
            {"name": "拿坡里黄", "brand": "温莎牛顿", "l_value": 85.2, "a_value": 5.6, "b_value": 45.8,
             "hex_code": "#F8E4B8", "stock": 0, "price": 42.0,
             "purchase_link": "https://item.jd.com/510152.html", "notes": "进口颜料，断货中"},
            {"name": "那坡里黄", "brand": "温莎牛顿", "l_value": 85.0, "a_value": 5.8, "b_value": 46.0,
             "hex_code": "#F8E4B8", "stock": 3, "price": 42.0,
             "purchase_link": "https://item.jd.com/510152.html", "data_quality": "dirty",
             "notes": "同一种颜料不同译名，赵老师重复录的"},
        ]

        for paint_data in paints:
            paint = models.PaintInventory(**paint_data)
            db.add(paint)

        students = [
            {"name": "张明", "student_no": "2024001", "budget": 500.0, "grade": "高一", "notes": "素描班"},
            {"name": "李芳", "student_no": "2024002", "budget": 300.0, "grade": "高一", "notes": "色彩班"},
            {"name": "王浩宇", "student_no": "2024003", "budget": 800.0, "grade": "高二", "notes": "冲刺班"},
            {"name": "陈雨婷", "student_no": "2024004", "budget": 450.0, "grade": "高一", "notes": ""},
            {"name": "刘阳", "student_no": "2024005", "budget": 600.0, "grade": "高二", "notes": "复读生"},
            {"name": "赵小敏", "student_no": "2024006", "budget": 350.0, "grade": "高一", "notes": ""},
            {"name": "孙志强", "student_no": "2024007", "budget": 200.0, "grade": "初三", "notes": "兴趣班"},
            {"name": "周梦瑶", "student_no": "2024008", "budget": 1000.0, "grade": "高三", "notes": "集训班"},
            {"name": "吴俊杰", "student_no": "2024009", "budget": 550.0, "grade": "高二", "notes": ""},
            {"name": "郑雨欣", "student_no": "2024010", "budget": 400.0, "grade": "高一", "notes": ""},
            {"name": "黄子轩", "student_no": "2024011", "budget": -50.0, "grade": "高二",
             "notes": "预算负数，待核查", "data_quality": "dirty"},
            {"name": "林诗涵", "student_no": "2024012", "budget": 300.0, "remaining_budget": 450.0,
             "grade": "高一", "notes": "剩余预算大于总预算，数据异常", "data_quality": "dirty"},
        ]

        for student_data in students:
            if "remaining_budget" not in student_data:
                student_data["remaining_budget"] = student_data["budget"]
            student = models.Student(**student_data)
            db.add(student)

        db.commit()

        print(f"✓ 成功导入 {len(paints)} 条颜料记录（含脏数据）")
        print(f"✓ 成功导入 {len(students)} 条学生记录（含脏数据）")
        print("\n脏数据说明：")
        print("  • 颜料 [钛白(温莎牛顿)] 重复录入 3 条")
        print("  • 颜料 [熟褐] 库存为负数 (-2)")
        print("  • 颜料 [金色] [银色] LAB色值超出有效范围")
        print("  • 颜料 [那坡里黄] 与 [拿坡里黄] 为同物异名重复")
        print("  • 颜料 [大红] [湖蓝] [镉黄中黄] [拿坡里黄] 已断货/停产")
        print("  • 学生 [黄子轩] 预算为负数 (-50)")
        print("  • 学生 [林诗涵] 剩余预算(450) > 总预算(300)")
        print("\n可调用 POST /api/data-issues/scan 检测所有数据问题")

    except Exception as e:
        db.rollback()
        print(f"导入失败: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_data()
