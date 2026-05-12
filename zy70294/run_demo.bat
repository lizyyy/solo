@echo off
chcp 65001 >nul

echo ============================================
echo  🏪 便利店鲜食报废预测器 - 一键演示
echo ============================================
echo.

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 错误：未检测到Python，请先安装Python 3.8或更高版本
    pause
    exit /b 1
)

echo 📋 步骤1：安装依赖...
pip install -r requirements.txt -q

if %errorlevel% neq 0 (
    echo ⚠️  依赖安装失败，尝试使用国内镜像...
    pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple -q
)

echo ✅ 依赖安装完成
echo.

echo 🚀 步骤2：运行完整演示...
echo.

python main.py --mode demo

if %errorlevel% neq 0 (
    echo ❌ 演示运行失败，请检查错误信息
    pause
    exit /b 1
)

echo.
echo ============================================
echo  ✅ 演示完成！
echo ============================================
echo.
echo 📄 报告已保存到：results\prediction_report.txt
echo.
echo 🔍 查看报告请运行：type results\prediction_report.txt
echo.

pause
