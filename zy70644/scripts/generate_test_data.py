#!/usr/bin/env python3
import pandas as pd
import random
from datetime import datetime, timedelta


def generate_name():
    surnames = ['张', '李', '王', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡']
    names = ['伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '军', '洋', '勇', '艳', '杰', '涛', '明', '超', '秀', '霞', '平', '刚']
    return random.choice(surnames) + ''.join(random.sample(names, random.randint(1, 2)))


def generate_passport():
    letter = random.choice('ABCDEFGH')
    numbers = ''.join([str(random.randint(0, 9)) for _ in range(8)])
    return letter + numbers


def generate_phone():
    return '1' + str(random.randint(3, 9)) + ''.join([str(random.randint(0, 9)) for _ in range(9)])


def generate_birth_date():
    start = datetime(2010, 1, 1)
    end = datetime(2018, 12, 31)
    delta = end - start
    random_days = random.randint(0, delta.days)
    return (start + timedelta(days=random_days)).strftime('%Y-%m-%d')


def generate_school():
    schools = ['北京市第一中学', '上海市实验小学', '广州市第二中学', '深圳市南山外国语学校',
               '杭州市第一中学', '南京市外国语学校', '武汉市第一中学', '成都市实验外国语学校']
    return random.choice(schools)


def generate_grade():
    grades = ['初一', '初二', '初三', '高一', '高二', '高三', '小学五年级', '小学六年级']
    return random.choice(grades)


def generate_guardian_name():
    return generate_name()


def generate_diet_restriction():
    restrictions = ['', '花生过敏', '海鲜过敏', '牛奶过敏', '鸡蛋过敏', '素食', '清真', '不吃辣', '糖尿病饮食', ' gluten-free']
    return random.choice(restrictions)


def generate_normal_data(count=10):
    data = []
    for _ in range(count):
        row = {
            '学生姓名': generate_name(),
            '护照号': generate_passport(),
            '性别': random.choice(['男', '女']),
            '出生日期': generate_birth_date(),
            '学校': generate_school(),
            '年级': generate_grade(),
            '监护人姓名': generate_guardian_name(),
            '监护人电话': generate_phone(),
            '监护人关系': random.choice(['父亲', '母亲', '祖父', '祖母', '其他']),
            '饮食禁忌': generate_diet_restriction()
        }
        data.append(row)
    return pd.DataFrame(data)


def generate_exception_data(count=5):
    data = []
    
    for _ in range(count):
        error_type = random.randint(1, 4)
        
        if error_type == 1:
            phone = '1234'
        elif error_type == 2:
            phone = ''
        elif error_type == 3:
            phone = '021-12345678'
        else:
            phone = generate_phone()[:-2] + 'xx'
        
        row = {
            '学生姓名': generate_name(),
            '护照号': '12345' if random.randint(0, 1) else generate_passport(),
            '性别': random.choice(['男', '女']),
            '出生日期': generate_birth_date(),
            '学校': generate_school(),
            '年级': generate_grade(),
            '监护人姓名': generate_guardian_name(),
            '监护人电话': phone,
            '监护人关系': random.choice(['父亲', '母亲', '祖父', '祖母', '其他']),
            '饮食禁忌': generate_diet_restriction()
        }
        data.append(row)
    
    return pd.DataFrame(data)


def generate_duplicate_data(dup_count=2):
    data = []
    base_passport = generate_passport()
    base_phone = generate_phone()
    base_name = generate_name()
    
    for i in range(dup_count):
        row = {
            '学生姓名': base_name if i == 0 else generate_name(),
            '护照号': base_passport,
            '性别': random.choice(['男', '女']),
            '出生日期': generate_birth_date(),
            '学校': generate_school(),
            '年级': generate_grade(),
            '监护人姓名': generate_guardian_name(),
            '监护人电话': base_phone,
            '监护人关系': random.choice(['父亲', '母亲', '祖父', '祖母', '其他']),
            '饮食禁忌': generate_diet_restriction()
        }
        data.append(row)
    
    return pd.DataFrame(data)


def main():
    print("生成测试数据...")
    
    normal_df = generate_normal_data(15)
    normal_df.to_excel('test_data_normal.xlsx', index=False)
    print(f"已生成 test_data_normal.xlsx，共 {len(normal_df)} 条正常数据")
    
    exception_df = generate_exception_data(5)
    exception_df.to_excel('test_data_exception.xlsx', index=False)
    print(f"已生成 test_data_exception.xlsx，共 {len(exception_df)} 条异常数据")
    
    dup_df = generate_duplicate_data(3)
    dup_df.to_excel('test_data_duplicate.xlsx', index=False)
    print(f"已生成 test_data_duplicate.xlsx，共 {len(dup_df)} 条重复数据")
    
    combined_df = pd.concat([normal_df, exception_df, dup_df])
    combined_df.to_excel('test_data_combined.xlsx', index=False)
    print(f"已生成 test_data_combined.xlsx，共 {len(combined_df)} 条混合数据")
    
    combined_df.to_csv('test_data_combined.csv', index=False, encoding='utf-8-sig')
    print(f"已生成 test_data_combined.csv，共 {len(combined_df)} 条CSV格式数据")
    
    print("\n测试数据生成完成！")


if __name__ == '__main__':
    main()
