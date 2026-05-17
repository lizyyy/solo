const ProtoParser = require("./src/proto-parser");
const MatrixBuilder = require("./src/matrix-builder");
const ReportGenerator = require("./src/report-generator");
const fs = require("fs");
const path = require("path");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log("✅ PASS:", name);
    passed++;
  } catch (err) {
    console.log("❌ FAIL:", name);
    console.log("   错误:", err.message);
    failed++;
  }
}

console.log("=".repeat(60));
console.log("           gRPC 错误码矩阵 - 轻量自检");
console.log("=".repeat(60));
console.log();

// ===== 1. ProtoParser 解析测试 =====
console.log("📦 第1部分: ProtoParser 解析测试\n");

test("ProtoParser 应能正确加载", () => {
  const parser = new ProtoParser();
  if (!parser) throw new Error("ProtoParser 实例创建失败");
});

test("ProtoParser 应能解析有效proto文件", () => {
  const parser = new ProtoParser();
  const result = parser.parse("./examples/error_codes.proto");
  if (!result || !result.errorCodes || result.errorCodes.length === 0) {
    throw new Error("未能解析出错误码");
  }
});

test("ProtoParser 应能正确获取错误码数值", () => {
  const parser = new ProtoParser();
  const result = parser.parse("./examples/error_codes.proto");
  const okCode = result.errorCodes.find(ec => ec.name === "OK");
  if (!okCode || okCode.code !== 0) {
    throw new Error("OK 错误码解析错误，期望 0，实际 " + (okCode?.code));
  }
});

// ===== 2. 边界样本测试 =====
console.log("\n🔍 第2部分: 边界样本测试\n");

// 创建临时测试目录
const testDir = "./test-temp";
if (!fs.existsSync(testDir)) fs.mkdirSync(testDir);

// 边界测试1: 空proto文件
test("边界测试: 空proto文件应优雅处理", () => {
  const emptyProto = path.join(testDir, "empty.proto");
  fs.writeFileSync(emptyProto, "");
  const parser = new ProtoParser();
  const result = parser.parse(emptyProto);
  if (!result) throw new Error("空proto返回null");
});

// 边界测试2: 只有enum但没有值
test("边界测试: 只有enum定义但无值", () => {
  const protoPath = path.join(testDir, "no-values.proto");
  fs.writeFileSync(protoPath, "syntax = \"proto3\";\nenum EmptyEnum {}");
  const parser = new ProtoParser();
  const result = parser.parse(protoPath);
  if (!result) throw new Error("空enum解析崩溃");
});

// 边界测试3: 不存在的文件
test("边界测试: 不存在的proto文件", () => {
  const parser = new ProtoParser();
  const result = parser.parse("./non-existent.proto");
  if (!result) throw new Error("不存在文件处理失败");
});

// ===== 3. MatrixBuilder 验证 =====
console.log("\n🏗️  第3部分: MatrixBuilder 验证\n");

test("MatrixBuilder 应能正确构建矩阵", () => {
  const parser = new ProtoParser();
  const pr = parser.parse("./examples/error_codes.proto");
  
  const sdkData = {
    languages: {
      go: { codes: { 
        OK: { grpcCode: 0, retry: "nonRetriable" },
        NOT_FOUND: { grpcCode: 5, retry: "nonRetriable" },
        UNAVAILABLE: { grpcCode: 14, retry: "retriable" }
      }},
      java: { codes: {
        OK: { grpcCode: 0, retry: "nonRetriable" },
        NOT_FOUND: { grpcCode: 5, retry: "nonRetriable" },
        UNAVAILABLE: { grpcCode: 14, retry: "retriable" }
      }}
    }
  };

  const builder = new MatrixBuilder();
  const matrix = builder
    .loadProtoErrorCodes(pr.errorCodes)
    .loadSdkDefinitions(sdkData)
    .buildMatrix();

  if (!matrix.summary) throw new Error("summary 字段缺失");
  if (typeof matrix.summary.totalCodes !== "number") throw new Error("totalCodes 不是数字");
});

test("MatrixBuilder 应能处理空SDK数据", () => {
  const parser = new ProtoParser();
  const pr = parser.parse("./examples/error_codes.proto");
  
  const builder = new MatrixBuilder();
  const matrix = builder
    .loadProtoErrorCodes(pr.errorCodes)
    .loadSdkDefinitions({ languages: {} })
    .buildMatrix();
  
  if (!matrix) throw new Error("空SDK导致崩溃");
});

// ===== 4. 报告导出测试 =====
console.log("\n📄 第4部分: 报告导出测试\n");

test("ReportGenerator 应能生成终端报告", () => {
  const parser = new ProtoParser();
  const pr = parser.parse("./examples/error_codes.proto");
  
  const sdkData = {
    languages: {
      go: { codes: { OK: { grpcCode: 0, retry: "nonRetriable" } } },
      java: { codes: { OK: { grpcCode: 0, retry: "nonRetriable" } } }
    }
  };

  const builder = new MatrixBuilder();
  const matrix = builder
    .loadProtoErrorCodes(pr.errorCodes)
    .loadSdkDefinitions(sdkData)
    .buildMatrix();

  const reporter = new ReportGenerator();
  const consoleReport = reporter.generateConsoleReport(matrix);
  if (!consoleReport || consoleReport.length === 0) {
    throw new Error("终端报告生成失败");
  }
});

test("ReportGenerator 应能生成JSON报告文件", () => {
  const parser = new ProtoParser();
  const pr = parser.parse("./examples/error_codes.proto");
  
  const sdkData = {
    languages: {
      go: { codes: { OK: { grpcCode: 0, retry: "nonRetriable" } } }
    }
  };

  const builder = new MatrixBuilder();
  const matrix = builder
    .loadProtoErrorCodes(pr.errorCodes)
    .loadSdkDefinitions(sdkData)
    .buildMatrix();

  const reporter = new ReportGenerator();
  const outputPath = path.join(testDir, "test-report.json");
  reporter.generateJsonReport(matrix, outputPath);
  
  if (!fs.existsSync(outputPath)) {
    throw new Error("JSON报告文件未生成: " + outputPath);
  }
  
  const content = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  if (!content.summary) throw new Error("生成的JSON缺少summary字段");
});

test("ReportGenerator 应能生成Markdown报告文件", () => {
  const parser = new ProtoParser();
  const pr = parser.parse("./examples/error_codes.proto");
  
  const sdkData = {
    languages: {
      go: { codes: { OK: { grpcCode: 0, retry: "nonRetriable" } } }
    }
  };

  const builder = new MatrixBuilder();
  const matrix = builder
    .loadProtoErrorCodes(pr.errorCodes)
    .loadSdkDefinitions(sdkData)
    .buildMatrix();

  const reporter = new ReportGenerator();
  const outputPath = path.join(testDir, "test-report.md");
  reporter.generateMarkdownReport(matrix, outputPath);
  
  if (!fs.existsSync(outputPath)) {
    throw new Error("Markdown报告文件未生成: " + outputPath);
  }
  
  const content = fs.readFileSync(outputPath, "utf8");
  if (!content.includes("#")) throw new Error("生成的Markdown格式不正确");
});

test("ReportGenerator 应能生成所有报告", () => {
  const parser = new ProtoParser();
  const pr = parser.parse("./examples/error_codes.proto");
  
  const sdkData = JSON.parse(fs.readFileSync("./examples/sdk-definitions.json", "utf8"));

  const builder = new MatrixBuilder();
  const matrix = builder
    .loadProtoErrorCodes(pr.errorCodes)
    .loadSdkDefinitions(sdkData)
    .buildMatrix();

  const reporter = new ReportGenerator();
  const reports = reporter.generateAllReports(matrix, testDir);
  
  if (!reports.console) throw new Error("缺少console报告");
  if (!reports.jsonPath || !fs.existsSync(reports.jsonPath)) throw new Error("缺少JSON报告文件");
  if (!reports.markdownPath || !fs.existsSync(reports.markdownPath)) throw new Error("缺少Markdown报告文件");
});

// ===== 5. 完整端到端测试 =====
console.log("\n🔗 第5部分: 完整端到端测试\n");

test("完整链路: 构建完整proto -> 矩阵构建 -> 报告生成", () => {
  // 1. 创建完整的测试proto文件 (17个错误码)
  const e2eProtoPath = path.join(testDir, "e2e-test.proto");
  const fullProtoContent = `
syntax = "proto3";
package grpc.status;
enum StatusCode {
  OK = 0;
  CANCELLED = 1;
  UNKNOWN = 2;
  INVALID_ARGUMENT = 3;
  DEADLINE_EXCEEDED = 4;
  NOT_FOUND = 5;
  ALREADY_EXISTS = 6;
  PERMISSION_DENIED = 7;
  RESOURCE_EXHAUSTED = 8;
  FAILED_PRECONDITION = 9;
  ABORTED = 10;
  OUT_OF_RANGE = 11;
  UNIMPLEMENTED = 12;
  INTERNAL = 13;
  UNAVAILABLE = 14;
  DATA_LOSS = 15;
  UNAUTHENTICATED = 16;
}
`;
  fs.writeFileSync(e2eProtoPath, fullProtoContent);

  // 2. 解析
  const parser = new ProtoParser();
  const pr = parser.parse(e2eProtoPath);
  if (pr.errorCodes.length < 10) throw new Error("错误码数量不足，可能解析失败，实际: " + pr.errorCodes.length);

  // 3. 创建完整SDK数据
  const sdkData = {
    languages: {
      go: {
        name: "Go SDK",
        codes: {
          OK: { grpcCode: 0, retry: "nonRetriable" },
          CANCELLED: { grpcCode: 1, retry: "nonRetriable" },
          UNKNOWN: { grpcCode: 2, retry: "conditional" },
          DEADLINE_EXCEEDED: { grpcCode: 4, retry: "retriable" },
          INTERNAL: { grpcCode: 13, retry: "conditional" },
          UNAVAILABLE: { grpcCode: 14, retry: "retriable" }
        }
      },
      java: {
        name: "Java SDK",
        codes: {
          OK: { grpcCode: 0, retry: "nonRetriable" },
          CANCELLED: { grpcCode: 1, retry: "nonRetriable" },
          UNKNOWN: { grpcCode: 2, retry: "conditional" },
          DEADLINE_EXCEEDED: { grpcCode: 4, retry: "retriable" },
          INTERNAL: { grpcCode: 13, retry: "conditional" },
          UNAVAILABLE: { grpcCode: 14, retry: "retriable" }
        }
      },
      python: {
        name: "Python SDK",
        codes: {
          OK: { grpcCode: 0, retry: "nonRetriable" },
          CANCELLED: { grpcCode: 1, retry: "nonRetriable" },
          UNKNOWN: { grpcCode: 2, retry: "retriable" },
          DEADLINE_EXCEEDED: { grpcCode: 4, retry: "retriable" },
          INTERNAL: { grpcCode: 13, retry: "retriable" },
          UNAVAILABLE: { grpcCode: 14, retry: "retriable" }
        }
      }
    }
  };

  // 4. 构建矩阵
  const builder = new MatrixBuilder();
  const matrix = builder
    .loadProtoErrorCodes(pr.errorCodes)
    .loadSdkDefinitions(sdkData)
    .buildMatrix();

  // 5. 验证分类
  if (!matrix.categories.safeRetry || !matrix.categories.neverRetry || !matrix.categories.controversial) {
    throw new Error("分类数据缺失");
  }

  // 6. 验证差异检测
  if (!matrix.differences) throw new Error("差异数据缺失");
  
  // 7. 生成所有报告
  const reporter = new ReportGenerator();
  const e2eOutputDir = path.join(testDir, "e2e-output");
  const reports = reporter.generateAllReports(matrix, e2eOutputDir);
  
  if (!reports.console) throw new Error("终端报告缺失");
  if (!fs.existsSync(reports.jsonPath)) throw new Error("JSON报告未生成");
  if (!fs.existsSync(reports.markdownPath)) throw new Error("Markdown报告未生成");
});

test("验证示例数据独立性: examples目录文件不被覆盖", () => {
  // 验证examples目录的原始数据仍然完整
  const parser = new ProtoParser();
  const pr = parser.parse("./examples/error_codes.proto");
  if (pr.errorCodes.length < 15) throw new Error("示例文件错误码数量异常，可能被覆盖，实际: " + pr.errorCodes.length);
});

// ===== 清理和总结 =====
console.log("\n" + "=".repeat(60));
console.log("📊 测试总结");
console.log("=".repeat(60));
console.log("总测试数:", passed + failed);
console.log("✅ 通过:", passed);
console.log("❌ 失败:", failed);

// 清理临时文件
try {
  fs.rmSync(testDir, { recursive: true, force: true });
} catch (e) {}

if (failed > 0) {
  console.log("\n❌ 部分测试失败，请修复后重试");
  process.exit(1);
} else {
  console.log("\n🎉 所有测试通过!");
  console.log("   ✓ Proto解析测试");
  console.log("   ✓ 边界样本测试");
  console.log("   ✓ 矩阵构建验证");
  console.log("   ✓ JSON/Markdown报告导出");
  console.log("   ✓ 完整端到端链路");
  process.exit(0);
}
