from demo_data import save_demo_calibration_csv, save_demo_pressure_csv, DEMO_SCENARIO_DESCRIPTION

if __name__ == "__main__":
    save_demo_calibration_csv("demo_data/calibrations.csv")
    save_demo_pressure_csv("demo_data/pressure.csv")
    print(DEMO_SCENARIO_DESCRIPTION)
    print("\n✅ 演示数据已生成:")
    print("   - demo_data/calibrations.csv  (温度校准记录)")
    print("   - demo_data/pressure.csv      (压力数据)")
