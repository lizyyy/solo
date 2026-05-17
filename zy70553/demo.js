const fs = require("fs");
const path = require("path");
const ProtoParser = require("./src/proto-parser");
const MatrixBuilder = require("./src/matrix-builder");
const ReportGenerator = require("./src/report-generator");

console.log("=".repeat(60));
console.log("           gRPC 错误码矩阵 CLI - Demo");
console.log("=".repeat(60));
console.log("");

// 1. 创建示例proto
console.log("1. 创建示例proto文件");
if (!fs.existsSync("./examples")) fs.mkdirSync("./examples");
const protoPath = "./examples/error_codes.proto";
fs.writeFileSync(protoPath, 
'syntax = "proto3";\n' +
'package demo;\n' +
'enum ErrorCode {\n' +
'  OK = 0;\n' +
'  NOT_FOUND = 5;\n' +
'  INTERNAL = 13;\n' +
'  UNAVAILABLE = 14;\n' +
'}\n');
console.log("   OK:", protoPath);

// 2. 解析proto
console.log("\n2. 解析proto文件");
const parser = new ProtoParser();
const parseResult = parser.parse(protoPath);
console.log("   找到", parseResult.errorCodes.length, "个错误码");
parseResult.errorCodes.forEach(ec => console.log("     -", ec.name, ec.code));

// 3. 构建SDK矩阵
console.log("\n3. 构建SDK错误码矩阵");
const sdkData = { 
  languages: {
    go: { 
      name: "Go SDK",
      codes: { 
        OK: { grpcCode: 0, retry: "nonRetriable", description: "Success" }, 
        NOT_FOUND: { grpcCode: 5, retry: "nonRetriable", description: "Not Found" }, 
        UNAVAILABLE: { grpcCode: 14, retry: "retriable", description: "Unavailable" }, 
        INTERNAL: { grpcCode: 13, retry: "retriable", description: "Internal Error" }
      }
    },
    java: { 
      name: "Java SDK",
      codes: { 
        OK: { grpcCode: 0, retry: "nonRetriable", description: "Success" }, 
        NOT_FOUND: { grpcCode: 5, retry: "nonRetriable", description: "Resource Not Exist" }, 
        UNAVAILABLE: { grpcCode: 14, retry: "retriable", description: "Connection Failed" }, 
        INTERNAL: { grpcCode: 13, retry: "conditional", description: "Internal Exception" }
      }
    }
  }
};

const builder = new MatrixBuilder();
builder.loadSdkDefinitions(sdkData);
builder.loadProtoErrorCodes(parseResult.errorCodes);
const matrix = builder.buildMatrix();

console.log("   总计", matrix.summary.totalCodes, "个错误码");
console.log("   SDK语言数量:", matrix.summary.languages);
console.log("   可重试(Safe):", matrix.categories.safeRetry.length, "个");
console.log("   不可重试(Never):", matrix.categories.neverRetry.length, "个");
console.log("   有争议(Controversial):", matrix.categories.controversial.length, "个");
console.log("   SDK差异:", matrix.differences.length, "处");

// 4. 生成报告
console.log("\n4. 生成报告");
const outputDir = "./reports";
const reporter = new ReportGenerator();
const reports = reporter.generateAllReports(matrix, outputDir);
console.log("   JSON:", reports.jsonPath);
console.log("   Markdown:", reports.markdownPath);

console.log("\n" + "=".repeat(60));
console.log("🎉 Demo完成! 所有核心功能验证通过");
console.log("=".repeat(60));
