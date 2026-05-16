const fs = require('fs');

const cliCode = `#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { Command } = require("commander");
const ProtoParser = require("./proto-parser");
const MatrixBuilder = require("./matrix-builder");
const ReportGenerator = require("./report-generator");

const program = new Command();
program.name("grpc-error-matrix").version("1.0.0");

program
  .command("analyze")
  .description("分析proto和SDK定义，生成错误码矩阵")
  .option("--proto <path>", "proto文件路径")
  .option("--sdk <path>", "SDK定义JSON路径")
  .option("--output <dir>", "输出目录", "./reports")
  .action((options) => {
    console.log("🔍 开始分析...\\n");
    
    const parser = new ProtoParser();
    let parseResult = { errorCodes: [], parseErrors: [] };
    
    if (options.proto && fs.existsSync(options.proto)) {
      console.log("📄 解析proto文件:", options.proto);
      parseResult = parser.parse(path.resolve(options.proto));
      console.log("  找到", parseResult.errorCodes.length, "个错误码");
    }
    
    const sdkData = getDefaultSdkDefinitions();
    if (options.sdk && fs.existsSync(options.sdk)) {
      const custom = JSON.parse(fs.readFileSync(options.sdk, "utf8"));
      Object.assign(sdkData.languages, custom.languages || {});
    }
    
    const builder = new MatrixBuilder();
    builder.loadSdkDefinitions(sdkData);
    builder.loadProtoErrorCodes(parseResult.errorCodes);
    
    const matrix = builder.buildMatrix();
    const retryClass = builder.classifyRetriable(matrix);
    
    const reporter = new ReportGenerator(options.output);
    reporter.generateConsoleReport(matrix, retryClass);
    console.log("📝 JSON报告:", reporter.generateJsonReport(matrix, retryClass));
    console.log("📝 Markdown报告:", reporter.generateMarkdownReport(matrix, retryClass));
    console.log("\\n✅ 分析完成!");
  });

program
  .command("self-test")
  .description("运行自检")
  .action(() => {
    console.log("🧪 运行自检...\\n");
    let passed = 0;

    try {
      const parser = new ProtoParser();
      const testProto = path.join("/tmp", "test-" + Date.now() + ".proto");
      fs.writeFileSync(testProto, "syntax = \\"proto3\\";\\npackage test;\\nenum ErrorCode { OK = 0; NOT_FOUND = 5; }");
      const result = parser.parse(testProto);
      if (result.errorCodes.length === 2) {
        console.log("✅ 测试1 通过: proto解析正常"); passed++;
      } else {
        console.log("❌ 测试1 失败: 预期2个错误码，实际", result.errorCodes.length);
      }
      fs.unlinkSync(testProto);
    } catch (e) { console.log("❌ 测试1 失败:", e.message); }

    try {
      const builder = new MatrixBuilder();
      builder.loadSdkDefinitions(getDefaultSdkDefinitions());
      builder.loadProtoErrorCodes([]);
      const matrix = builder.buildMatrix();
      if (matrix.summary.totalCodes >= 10) {
        console.log("✅ 测试2 通过: SDK数据加载正常"); passed++;
      } else {
        console.log("❌ 测试2 失败: 预期至少10个错误码，实际", matrix.summary.totalCodes);
      }
    } catch (e) { console.log("❌ 测试2 失败:", e.message); }

    try {
      const builder = new MatrixBuilder();
      builder.loadSdkDefinitions(getDefaultSdkDefinitions());
      const matrix = builder.buildMatrix();
      const retry = builder.classifyRetriable(matrix);
      if (retry.safeToRetry.length > 0 && retry.neverRetry.length > 0) {
        console.log("✅ 测试3 通过: 重试分类正常"); passed++;
      } else {
        console.log("❌ 测试3 失败: 重试分类结果不正确");
      }
    } catch (e) { console.log("❌ 测试3 失败:", e.message); }

    console.log("\\n==================================================");
    console.log("结果:", passed, "通过");
    process.exit(passed === 3 ? 0 : 1);
  });

program
  .command("init")
  .description("创建示例配置")
  .action(() => {
    if (!fs.existsSync("examples")) fs.mkdirSync("examples");
    fs.writeFileSync("examples/error_codes.proto", "syntax = \\"proto3\\";\\npackage example;\\nenum ErrorCode { OK = 0; NOT_FOUND = 5; UNAVAILABLE = 14; }");
    fs.writeFileSync("examples/sdk_definitions.json", JSON.stringify({ languages: { go: { codes: { OK: { grpcCode: 0, retry: "nonRetriable" } } } } }, null, 2));
    console.log("✅ 示例文件已创建在 examples/ 目录");
  });

function getDefaultSdkDefinitions() {
  const codes = {
    OK: { grpcCode: 0, retry: "nonRetriable", description: "成功" },
    CANCELLED: { grpcCode: 1, retry: "conditional", description: "已取消" },
    UNKNOWN: { grpcCode: 2, retry: "conditional", description: "未知错误" },
    INVALID_ARGUMENT: { grpcCode: 3, retry: "nonRetriable", description: "无效参数" },
    DEADLINE_EXCEEDED: { grpcCode: 4, retry: "retriable", description: "超时" },
    NOT_FOUND: { grpcCode: 5, retry: "nonRetriable", description: "未找到" },
    ALREADY_EXISTS: { grpcCode: 6, retry: "nonRetriable", description: "已存在" },
    PERMISSION_DENIED: { grpcCode: 7, retry: "nonRetriable", description: "权限不足" },
    RESOURCE_EXHAUSTED: { grpcCode: 8, retry: "retriable", description: "资源耗尽" },
    FAILED_PRECONDITION: { grpcCode: 9, retry: "nonRetriable", description: "前置条件失败" },
    ABORTED: { grpcCode: 10, retry: "conditional", description: "已中止" },
    OUT_OF_RANGE: { grpcCode: 11, retry: "nonRetriable", description: "超出范围" },
    UNIMPLEMENTED: { grpcCode: 12, retry: "nonRetriable", description: "未实现" },
    INTERNAL: { grpcCode: 13, retry: "retriable", description: "内部错误" },
    UNAVAILABLE: { grpcCode: 14, retry: "retriable", description: "服务不可用" },
    DATA_LOSS: { grpcCode: 15, retry: "conditional", description: "数据丢失" },
    UNAUTHENTICATED: { grpcCode: 16, retry: "nonRetriable", description: "未认证" }
  };
  return {
    languages: {
      go: { name: "Go", codes: { ...codes } },
      java: { name: "Java", codes: { ...codes, INTERNAL: { ...codes.INTERNAL, retry: "conditional" } } },
      python: { name: "Python", codes: { ...codes } }
    }
  };
}

program.parse();
`;

fs.writeFileSync('src/cli.js', cliCode);
console.log("Created src/cli.js successfully");
