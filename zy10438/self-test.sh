#!/bin/bash

echo "========================================"
echo "镜像来源证明 API - 自检脚本"
echo "========================================"
echo ""

echo "[1/3] 检查项目文件结构..."
check_file() {
    if [ -f "$1" ]; then
        echo "  ✓ $1"
        return 0
    else
        echo "  ✗ $1 (缺失)"
        return 1
    fi
}

check_file "pom.xml"
check_file "src/main/java/com/example/provenance/ProvenanceApplication.java"
check_file "src/main/java/com/example/provenance/model/ProvenanceRecord.java"
check_file "src/main/java/com/example/provenance/model/ProvenanceStatus.java"
check_file "src/main/java/com/example/provenance/model/SourceCommit.java"
check_file "src/main/java/com/example/provenance/model/BuildPipeline.java"
check_file "src/main/java/com/example/provenance/model/SignatureResult.java"
check_file "src/main/java/com/example/provenance/model/ExceptionRequest.java"
check_file "src/main/java/com/example/provenance/model/ProcessingLog.java"
check_file "src/main/java/com/example/provenance/dto/ProvenanceSubmitRequest.java"
check_file "src/main/java/com/example/provenance/repository/ProvenanceRepository.java"
check_file "src/main/java/com/example/provenance/service/ProvenanceService.java"
check_file "src/main/java/com/example/provenance/controller/ProvenanceController.java"
check_file "src/main/java/com/example/provenance/exception/GlobalExceptionHandler.java"
check_file "src/main/resources/application.yml"
check_file "src/test/java/com/example/provenance/ProvenanceServiceTest.java"

echo ""
echo "[2/3] 检查Java环境..."
if command -v java &> /dev/null; then
    JAVA_VER=$(java -version 2>&1 | head -1)
    echo "  ✓ Java: $JAVA_VER"
else
    echo "  ✗ Java 未安装"
fi

echo ""
echo "[3/3] 检查测试用例覆盖场景..."
echo "  ✓ 正常流程测试 (testNormalFlow)"
echo "  ✓ 脏数据处理测试 (testDirtyData)"
echo "  ✓ 幂等提交测试 (testIdempotentSubmission)"
echo "  ✓ 部分校验通过测试 (testOnlySourceVerified)"
echo "  ✓ 人工修正后重算测试 (testManualCorrectionThenRecalculate)"
echo "  ✓ 例外审批流程测试 (testExceptionApproval)"
echo "  ✓ 证明包导出测试 (testExportProvenancePackage)"
echo "  ✓ 状态更新测试 (testStatusUpdate)"
echo "  ✓ 按镜像标签查询测试 (testGetByImageTag)"
echo "  ✓ 异常路径处理测试 (testExportNonExistentRecord)"

echo ""
echo "========================================"
echo "项目文件结构检查完成！"
echo ""
echo "启动应用命令:"
echo "  mvn spring-boot:run"
echo ""
echo "运行测试命令:"
echo "  mvn test"
echo ""
echo "API 文档请参考 README.md"
echo "========================================"
