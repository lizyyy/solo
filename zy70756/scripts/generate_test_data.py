#!/usr/bin/env python3
import os
import csv
import random

TEST_DATA_DIR = "test_data"
os.makedirs(TEST_DATA_DIR, exist_ok=True)


def generate_normal_csv():
    filepath = os.path.join(TEST_DATA_DIR, "normal.csv")
    headers = ["ID", "User Name", "Email", "Age", "Sign Up Date"]

    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)

        for i in range(1, 101):
            writer.writerow([
                i,
                f"User_{i}",
                f"user{i}@example.com",
                random.randint(18, 65),
                f"2024-{random.randint(1,12):02d}-{random.randint(1,28):02d}"
            ])
    print(f"Generated: {filepath}")


def generate_gbk_encoded_csv():
    filepath = os.path.join(TEST_DATA_DIR, "gbk_encoded.csv")
    headers = ["编号", "姓名", "邮箱", "年龄"]

    with open(filepath, "w", newline="", encoding="gbk") as f:
        writer = csv.writer(f)
        writer.writerow(headers)

        names = ["张三", "李四", "王五", "赵六", "钱七", "孙八", "周九", "吴十"]
        for i in range(1, 51):
            writer.writerow([
                i,
                random.choice(names),
                f"user{i}@example.com",
                random.randint(18, 65)
            ])
    print(f"Generated: {filepath} (GBK encoding)")


def generate_csv_with_bad_rows():
    filepath = os.path.join(TEST_DATA_DIR, "with_bad_rows.csv")
    headers = ["ID", "Name", "Email", "Value"]

    with open(filepath, "w", newline="", encoding="utf-8") as f:
        f.write(",".join(headers) + "\n")

        for i in range(1, 21):
            if i == 5:
                f.write(f"{i},User_{i},user{i}@example.com\n")
            elif i == 10:
                f.write(f"{i},User_{i},user{i}@example.com,100,extra_column\n")
            elif i == 15:
                f.write(f",,,\n")
            else:
                f.write(f"{i},User_{i},user{i}@example.com,{i * 10}\n")

    print(f"Generated: {filepath} (with bad rows at 5, 10, 15)")


def generate_chinese_columns_csv():
    filepath = os.path.join(TEST_DATA_DIR, "chinese_columns.csv")
    headers = ["用户ID", "用户姓名", "电子邮箱", "注册日期", "所在城市"]

    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)

        cities = ["北京", "上海", "广州", "深圳", "杭州", "成都"]
        names = ["张三", "李四", "王五", "赵六", "钱七", "孙八", "周九", "吴十"]

        for i in range(1, 31):
            writer.writerow([
                i,
                random.choice(names),
                f"user{i}@example.com",
                f"2024-{random.randint(1,12):02d}-{random.randint(1,28):02d}",
                random.choice(cities)
            ])
    print(f"Generated: {filepath}")


def generate_special_chars_csv():
    filepath = os.path.join(TEST_DATA_DIR, "special_chars.csv")
    headers = ["ID", "User-Name", "Email@Address", "Full Name", "NA-Value"]

    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)

        for i in range(1, 21):
            writer.writerow([
                i,
                f"User-{i}",
                f"user{i}@example.com",
                f"First Last {i}",
                "NA" if i % 3 == 0 else i * 10
            ])
    print(f"Generated: {filepath}")


if __name__ == "__main__":
    generate_normal_csv()
    generate_gbk_encoded_csv()
    generate_csv_with_bad_rows()
    generate_chinese_columns_csv()
    generate_special_chars_csv()
    print("\nAll test data files generated successfully!")
