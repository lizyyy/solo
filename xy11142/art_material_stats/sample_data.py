from pathlib import Path
import pandas as pd
from datetime import datetime, timedelta


def generate_sample_data(output_dir: Path):
    """生成美术培训室画材缺料统计的示例数据"""
    
    today = datetime.now()
    
    class_rename_data = {
        "原班级名称": [
            "素描初级班",
            "色彩基础班",
            "国画入门班",
            "儿童画启蒙班",
            "速写提高班"
        ],
        "新班级名称": [
            "素描基础班(2024春季)",
            "色彩班(2024春季)",
            "国画基础班",
            "儿童创意画班",
            "速写进阶班"
        ]
    }
    df_rename = pd.DataFrame(class_rename_data)
    
    set_split_data = {
        "套装名称": [
            "素描工具套装",
            "水彩画套装",
            "国画工具套装",
            "油画棒套装"
        ],
        "包含画材": [
            "素描铅笔;橡皮;素描纸;美工刀",
            "水彩颜料;水彩笔;调色盘;水彩纸",
            "毛笔;墨汁;宣纸;国画颜料",
            "油画棒;素描纸;勾线笔"
        ],
        "拆分数量": [
            "1;1;1;1",
            "1;2;1;2",
            "2;1;10;1",
            "1;1;1"
        ]
    }
    df_split = pd.DataFrame(set_split_data)
    
    rules_path = output_dir / "处理规则.xlsx"
    with pd.ExcelWriter(rules_path, engine="openpyxl") as writer:
        df_rename.to_excel(writer, sheet_name="班级改名", index=False)
        df_split.to_excel(writer, sheet_name="套装拆分", index=False)
    
    input_data1 = {
        "班级": [
            "素描初级班",
            "色彩基础班",
            "国画入门班",
            "素描基础班(2024春季)",
            "儿童画启蒙班",
            "水彩班",
            "速写提高班",
            "油画班",
            "",
            "素描初级班"
        ],
        "画材名称": [
            "素描工具套装",
            "水彩颜料",
            "毛笔",
            "素描铅笔",
            "油画棒套装",
            "水彩画套装",
            "速写本",
            "油画颜料",
            "素描纸",
            "水彩笔"
        ],
        "缺料数量": [
            "1",
            "2",
            "3",
            "5",
            "1",
            "2",
            "10",
            "0",
            "5",
            "abc"
        ],
        "学生姓名": [
            "张三",
            "李四",
            "王五",
            "赵六",
            "小明",
            "小红",
            "小华",
            "小刚",
            "小丽",
            "小强"
        ],
        "申请日期": [
            (today - timedelta(days=i)).strftime("%Y-%m-%d")
            for i in range(10)
        ]
    }
    df_input1 = pd.DataFrame(input_data1)
    input_path1 = output_dir / "输入数据"
    if not input_path1.exists():
        input_path1.mkdir()
    
    df_input1.to_excel(input_path1 / "2024年5月第一周缺料统计.xlsx", index=False)
    
    input_data2 = {
        "班级": [
            "素描初级班",
            "色彩基础班",
            "油画班",
            "速写提高班"
        ],
        "画材名称": [
            "国画工具套装",
            "水彩画套装",
            "油画布",
            "速写铅笔"
        ],
        "缺料数量": [
            "1",
            "1",
            "3",
            "6"
        ],
        "学生姓名": [
            "小林",
            "小方",
            "小雨",
            "小雷"
        ],
        "申请日期": [
            (today - timedelta(days=i)).strftime("%Y-%m-%d")
            for i in range(4)
        ]
    }
    df_input2 = pd.DataFrame(input_data2)
    df_input2.to_excel(input_path1 / "2024年5月第二周缺料统计.xlsx", index=False)
    
    print(f"示例数据已生成到: {output_dir.absolute()}")
    print(f"  - 处理规则.xlsx")
    print(f"  - 输入数据/2024年5月第一周缺料统计.xlsx")
    print(f"  - 输入数据/2024年5月第二周缺料统计.xlsx")
