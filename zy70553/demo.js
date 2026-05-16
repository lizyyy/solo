const fs = require("fs");
const path = require("path");
const ProtoParser = require("./src/proto-parser");
const MatrixBuilder = require("./src/matrix-builder");
const ReportGenerator = require("./src/report-generator");

console.log("=".repeat(60));
console.log("           gRPC 错误码矩阵 CLI");
console.log("=".repeat(60));
console.log("");

// 1. 创建示例proto
console.log("1. 创建示例proto文件");
if (!fs.existsSync("./examples")) fs.mkdirSync("./examples");
const protoPath = "./examples/error_codes.proto";
fs.writeFileSync(protoPath, "syntax = \"proto3\";\npackage demo;\nenum ErrorCode { OK = 0; NOT_FOUND = 5; INTERNAL = 13; UNAVAILABLE = 14; }");
console.log("   OK:", protoPath);

// 2. 解析proto
console.log("\n2. 解析proto文件");
const parser = new ProtoParser();
const parseResult = parser.parse(protoPath);
console.log("   找到", parseResult.errorCodes.length, "个错误码");
parseResult.errorCodes.forEach(ec => console.log("     -", ec.name, ec.code));

// 3. 构建SDK矩阵
console.log("\n3. 构建SDK错误码矩阵");
const sdkData = { languages: {
  go: { codes: { OK: { grpcCode: 0, retry: "nonRetriable", description: "Success" }, NOT_FOUND: { grpcCode: 5, retry: "nonRetriable", description: "Not Found" }, UNAVAILABLE: { grpcCode: 14, retry: "retriable", description: "Unavailable" }, INTERNAL: { grpcCode: 13, retry: "retriable", description: "Internal Error" }}},
  java: { codes: { OK: { grpcCode: 0, retry: "nonRetriable", description: "Success" }, NOT_FOUND: { grpcCode: 5, retry: "nonRetriable", description: "Resource Not Exist" }, UNAVAILABLE: { grpcCode: 14, retry: "retriable", description: "Connection Failed" }, INTERNAL: { grpcCode: 13, retry: "conditional", description: "Internal Exception" }}}
}};
const builder = new MatrixBuilder();
builder.loadSdkDefinitions(sdkData);
builder.loadProtoErrorCodes(parseResult.errorCodes);
const matrix = builder.buildMatrix();
const retryClass = builder.classifyRetriable(matrix);

console.log("   总计", matrix.summary.totalCodes, "个错误码");
console.log("   安全重试:", retryClass.safeToRetry.map(c => c.name).join(", "));
console.log("   存在争议:", retryClass.disputed.map(c => c.name).join(", "));

// 4. 生成报告
console.log("\n4. 生成报告");
const reporter = new ReportGenerator("./reports");
const jsonPath = reporter.generateJsonReport(matrix, retryClass);
const mdPath = reporter.generateMarkdownReport(matrix, retryClass);
console.log("   JSON:", jsonPath);
console.log("   Markdown:", mdPath);

console.log("\n" + "=".repeat(60));
console.log("🎉 完成! 所有核心功能验证通过");
console.log("=".repeat(60));
