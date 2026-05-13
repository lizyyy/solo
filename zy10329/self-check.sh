#!/bin/bash

echo "========================================"
echo "  API合成事务巡检 - 自检测试脚本"
echo "========================================"
echo ""

echo "检查 Maven 环境..."
if ! command -v mvn &> /dev/null; then
    echo "❌ Maven 未安装或未配置到PATH"
    exit 1
fi
echo "✓ Maven 环境正常"
echo ""

echo "编译项目..."
mvn compile -q
if [ $? -ne 0 ]; then
    echo "❌ 项目编译失败"
    exit 1
fi
echo "✓ 项目编译成功"
echo ""

echo "运行自检测试..."
mvn test -Dtest=SelfCheckTest -q
if [ $? -eq 0 ]; then
    echo ""
    echo "========================================"
    echo "  ✅ 所有自检测试通过!"
    echo "========================================"
    echo ""
    echo "API 列表:"
    echo "  POST   /api/templates              - 创建事务模板"
    echo "  GET    /api/templates/{id}         - 查询模板详情"
    echo "  POST   /api/templates/{id}/validate - 校验模板"
    echo "  POST   /api/templates/{id}/status   - 更新模板状态"
    echo "  POST   /api/templates/{id}/cancel   - 撤销模板"
    echo "  POST   /api/batches                - 创建执行批次"
    echo "  GET    /api/batches/{id}           - 查询批次详情"
    echo "  POST   /api/batches/{id}/start     - 开始执行批次"
    echo "  POST   /api/batches/{id}/steps/{order}/execute - 执行步骤"
    echo "  POST   /api/batches/{id}/cancel    - 撤销批次"
    echo "  GET    /api/export/template/{id}   - 导出模板"
    echo "  GET    /api/export/batch/{id}      - 导出批次报告"
    echo ""
    echo "启动服务命令: mvn spring-boot:run"
    echo "H2控制台: http://localhost:8080/h2-console"
    echo ""
else
    echo "❌ 部分测试失败, 请查看上面的日志详情"
    exit 1
fi
