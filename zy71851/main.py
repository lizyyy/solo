from chemistry_demo import ChemistryDemoProcessor, load_records

EXPECTED_STEPS = [
    "检查护目镜",
    "取用烧杯",
    "量取盐酸",
    "倾倒试剂",
    "搅拌混合",
    "观察反应",
    "记录实验结果",
    "清理实验台",
]


def main():
    import sys
    data_path = sys.argv[1] if len(sys.argv) > 1 else "sample_data.json"
    records = load_records(data_path)
    processor = ChemistryDemoProcessor()
    report = processor.process(records, expected_steps=EXPECTED_STEPS)
    print(report.to_text())


if __name__ == "__main__":
    main()
