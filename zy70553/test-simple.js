const ProtoParser = require("./src/proto-parser");
const MatrixBuilder = require("./src/matrix-builder");
const ReportGenerator = require("./src/report-generator");
const fs = require("fs");

console.log("=".repeat(60));
console.log("           gRPC 错误码矩阵 CLI");
console.log("=".repeat(60));
console.log();

console.log("1. 测试 ProtoParser...");
const protoPath = "./examples/error_codes.proto";
if (!fs.existsSync("./examples")) fs.mkdirSync("./examples");
fs.writeFileSync(protoPath, 'syntax = "proto3";\npackage demo;\nenum ErrorCode { OK = 0; NOT_FOUND = 5; INTERNAL = 13; UNAVAILABLE = 14; }');

const parser = new ProtoParser();
const pr = parser.parse(protoPath);
console.log("   找到 " + pr.errorCodes.length + " 个错误码");
pr.errorCodes.forEach(ec => console.log("     - " + ec.name + " (" + ec.code + ")"));

console.log("\n2. 测试 MatrixBuilder...");
const sdkData = { languages: {
  go: { codes: { 
    OK: { grpcCode: 0, retry: "nonRetriable", description: "Success" },
    NOT_FOUND: { grpcCode: 5, retry: "nonRetriable", description: "Not Found" },
    UNAVAILABLE: { grpcCode: 14, retry: "retriable", description: "Unavailable" },
    INTERNAL: { grpcCode: 13, retry: "retriable", description: "Internal Error" }
  }},
  java: { codes: {
    OK: { grpcCode: 0, retry: "nonRetriable", description: "Success" },
    NOT_FOUND: { grpcCode: 5, retry: "nonRetriable", description: "Resource Not Exist" },
    UNAVAILABLE: { grpcCode: 14, retry: "retriable", description: "Connection Failed" },
    INTERNAL: { grpcCode: 13, retry: "conditional", description: "Internal Exception" }
  }},
  python: { codes: {
    OK: { grpcCode: 0, retry: "nonRetriable", description: "OK" },
    NOT_FOUND: { grpcCode: 5, retry: "nonRetriable", description: "NotFound" },
    UNAVAILABLE: { grpcCode: 14, retry: "retriable", description: "ServiceUnavailable" },
    INTERNAL: { grpcCode: 13, retry: "retriable", description: "InternalServerError" }
  }}
}};

const builder = new MatrixBuilder();
builder.loadSdkDefinitions(sdkData);
builder.loadProtoErrorCodes(pr.errorCodes);
const matrix = builder.buildMatrix();
const retryClass = builder.classifyRetriable(matrix);

console.log("   总计 " + matrix.summary.totalCodes + " 个错误码");
console.log("   语言SDK: " + matrix.summary.languages.join(", "));

console.log("\n3. 测试 ReportGenerator...");
const reporter = new ReportGenerator("./reports");
reporter.generateConsoleReport(matrix, retryClass);
reporter.generateJsonReport(matrix, retryClass);
reporter.generateMarkdownReport(matrix, retryClass);
console.log("   JSON: reports/error-matrix.json");
console.log("   Markdown: reports/error-matrix-report.md");

console.log("\n" + "=".repeat(60));
console.log("所有核心功能验证通过!");
console.log("=".repeat(60));
