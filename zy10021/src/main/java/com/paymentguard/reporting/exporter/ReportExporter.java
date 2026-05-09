package com.paymentguard.reporting.exporter;

import com.paymentguard.reporting.detector.IssueDetector;
import com.paymentguard.reporting.detector.IssueDetector.IssueReport;
import com.paymentguard.common.util.JsonUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReportExporter {

    private final IssueDetector issueDetector;
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    public byte[] exportToJson(String reportId) {
        IssueReport report = issueDetector.getReport(reportId);
        if (report == null) {
            throw new IllegalArgumentException("Report not found: " + reportId);
        }
        return JsonUtil.toJson(report).getBytes(StandardCharsets.UTF_8);
    }

    public byte[] exportToMarkdown(String reportId) {
        IssueReport report = issueDetector.getReport(reportId);
        if (report == null) {
            throw new IllegalArgumentException("Report not found: " + reportId);
        }
        
        StringBuilder sb = new StringBuilder();
        
        sb.append("# 支付平台问题检测报告\n\n");
        sb.append("## 报告摘要\n\n");
        sb.append(String.format("- **报告ID**: %s\n", report.getReportId()));
        sb.append(String.format("- **订单ID**: %s\n", report.getOrderId()));
        sb.append(String.format("- **生成时间**: %s\n", formatDateTime(report.getGeneratedAt())));
        sb.append(String.format("- **问题总数**: %d\n", report.getIssues().size()));
        sb.append(String.format("- **严重问题**: %d\n", report.getCriticalIssues()));
        sb.append(String.format("- **高危问题**: %d\n", report.getHighIssues()));
        sb.append("\n");
        
        if (report.getOrderDetails() != null) {
            sb.append("## 订单信息\n\n");
            sb.append("| 项目 | 值 |\n");
            sb.append("|------|-----|\n");
            sb.append(String.format("| 订单号 | %s |\n", report.getOrderDetails().getOrderId()));
            sb.append(String.format("| 商品 | %s |\n", report.getOrderDetails().getProductName()));
            sb.append(String.format("| 金额 | %s %s |\n", 
                    report.getOrderDetails().getCurrency(),
                    report.getOrderDetails().getAmount()));
            sb.append(String.format("| 状态 | %s |\n", report.getOrderDetails().getStatus().getDescription()));
            sb.append(String.format("| 支付次数 | %d |\n", report.getOrderDetails().getPaymentCount()));
            sb.append(String.format("| 交易数 | %d |\n", report.getTransactionCount()));
            sb.append(String.format("| 回调数 | %d |\n", report.getCallbackCount()));
            sb.append("\n");
        }
        
        if (report.hasIssues()) {
            sb.append("## 问题详情\n\n");
            
            for (IssueReport.IssueDetail issue : report.getIssues()) {
                sb.append(String.format("### %s [%s]\n\n", 
                        issue.getTitle(), issue.getSeverity().name()));
                sb.append(String.format("- **问题类型**: %s\n", issue.getIssueType().getDescription()));
                sb.append(String.format("- **严重程度**: %s\n", formatSeverity(issue.getSeverity())));
                sb.append(String.format("- **发生时间**: %s\n", formatDateTime(issue.getOccurredAt())));
                sb.append(String.format("- **影响对象**: %s\n", issue.getAffectedEntity()));
                sb.append("\n");
                sb.append("**问题描述**:\n");
                sb.append(issue.getDescription());
                sb.append("\n\n");
                
                if (issue.getRelatedData() != null && !issue.getRelatedData().isEmpty()) {
                    sb.append("**相关数据**:\n\n");
                    sb.append("```json\n");
                    sb.append(JsonUtil.toJson(issue.getRelatedData()));
                    sb.append("\n```\n\n");
                }
                
                sb.append("**建议操作**:\n");
                sb.append(issue.getSuggestedAction());
                sb.append("\n\n---\n\n");
            }
        } else {
            sb.append("## 检测结果\n\n");
            sb.append("✅ **未发现问题**\n\n");
            sb.append("订单状态和支付记录均正常。\n\n");
        }
        
        sb.append("---\n\n");
        sb.append(String.format("*报告由 PaymentGuard 生成于 %s*\n", 
                formatDateTime(LocalDateTime.now())));
        
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    public byte[] exportToHtml(String reportId) {
        IssueReport report = issueDetector.getReport(reportId);
        if (report == null) {
            throw new IllegalArgumentException("Report not found: " + reportId);
        }
        
        StringBuilder sb = new StringBuilder();
        
        sb.append("<!DOCTYPE html>\n");
        sb.append("<html lang=\"zh-CN\">\n");
        sb.append("<head>\n");
        sb.append("    <meta charset=\"UTF-8\">\n");
        sb.append("    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n");
        sb.append("    <title>PaymentGuard 问题检测报告</title>\n");
        sb.append("    <style>\n");
        sb.append("        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; max-width: 900px; margin-left: auto; margin-right: auto; }\n");
        sb.append("        h1 { color: #1a1a1a; border-bottom: 2px solid #3498db; padding-bottom: 10px; }\n");
        sb.append("        h2 { color: #2c3e50; margin-top: 30px; }\n");
        sb.append("        h3 { color: #34495e; }\n");
        sb.append("        .summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }\n");
        sb.append("        .issue { background: white; border-left: 4px solid; margin: 15px 0; padding: 15px 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-radius: 0 4px 4px 0; }\n");
        sb.append("        .issue.CRITICAL { border-left-color: #e74c3c; background: #fdf2f2; }\n");
        sb.append("        .issue.HIGH { border-left-color: #e67e22; background: #fef8f0; }\n");
        sb.append("        .issue.MEDIUM { border-left-color: #f39c12; background: #fefcf4; }\n");
        sb.append("        .issue.LOW { border-left-color: #3498db; background: #f4f8fb; }\n");
        sb.append("        .severity-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }\n");
        sb.append("        .severity.CRITICAL { background: #e74c3c; color: white; }\n");
        sb.append("        .severity.HIGH { background: #e67e22; color: white; }\n");
        sb.append("        .severity.MEDIUM { background: #f39c12; color: white; }\n");
        sb.append("        .severity.LOW { background: #3498db; color: white; }\n");
        sb.append("        table { width: 100%; border-collapse: collapse; margin: 10px 0; }\n");
        sb.append("        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }\n");
        sb.append("        th { background: #f8f9fa; font-weight: bold; }\n");
        sb.append("        pre { background: #2c3e50; color: #ecf0f1; padding: 15px; border-radius: 4px; overflow-x: auto; }\n");
        sb.append("        .success { color: #27ae60; }\n");
        sb.append("        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #7f8c8d; font-size: 14px; }\n");
        sb.append("    </style>\n");
        sb.append("</head>\n");
        sb.append("<body>\n");
        
        sb.append("    <h1>🛡️ PaymentGuard 问题检测报告</h1>\n");
        
        sb.append("    <div class=\"summary\">\n");
        sb.append("        <h2>📊 报告摘要</h2>\n");
        sb.append(String.format("        <p><strong>报告ID:</strong> %s</p>\n", report.getReportId()));
        sb.append(String.format("        <p><strong>订单ID:</strong> %s</p>\n", report.getOrderId()));
        sb.append(String.format("        <p><strong>生成时间:</strong> %s</p>\n", formatDateTime(report.getGeneratedAt())));
        sb.append(String.format("        <p><strong>问题总数:</strong> %d | 严重: %d | 高危: %d</p>\n",
                report.getIssues().size(), report.getCriticalIssues(), report.getHighIssues()));
        sb.append("    </div>\n");
        
        if (report.getOrderDetails() != null) {
            sb.append("    <h2>📋 订单信息</h2>\n");
            sb.append("    <table>\n");
            sb.append("        <tr><th>项目</th><th>值</th></tr>\n");
            sb.append(String.format("        <tr><td>订单号</td><td>%s</td></tr>\n", report.getOrderDetails().getOrderId()));
            sb.append(String.format("        <tr><td>商品</td><td>%s</td></tr>\n", report.getOrderDetails().getProductName()));
            sb.append(String.format("        <tr><td>金额</td><td>%s %s</td></tr>\n",
                    report.getOrderDetails().getCurrency(), report.getOrderDetails().getAmount()));
            sb.append(String.format("        <tr><td>状态</td><td>%s</td></tr>\n", report.getOrderDetails().getStatus().getDescription()));
            sb.append(String.format("        <tr><td>支付次数</td><td>%d</td></tr>\n", report.getOrderDetails().getPaymentCount()));
            sb.append(String.format("        <tr><td>交易数</td><td>%d</td></tr>\n", report.getTransactionCount()));
            sb.append(String.format("        <tr><td>回调数</td><td>%d</td></tr>\n", report.getCallbackCount()));
            sb.append("    </table>\n");
        }
        
        if (report.hasIssues()) {
            sb.append("    <h2>⚠️ 问题详情</h2>\n");
            
            for (IssueReport.IssueDetail issue : report.getIssues()) {
                sb.append(String.format("    <div class=\"issue %s\">\n", issue.getSeverity().name()));
                sb.append(String.format("        <h3>%s <span class=\"severity-badge severity %s\">%s</span></h3>\n",
                        issue.getTitle(), issue.getSeverity().name(), issue.getSeverity().name()));
                sb.append(String.format("        <p><strong>问题类型:</strong> %s</p>\n", issue.getIssueType().getDescription()));
                sb.append(String.format("        <p><strong>发生时间:</strong> %s</p>\n", formatDateTime(issue.getOccurredAt())));
                if (issue.getAffectedEntity() != null) {
                    sb.append(String.format("        <p><strong>影响对象:</strong> %s</p>\n", issue.getAffectedEntity()));
                }
                sb.append(String.format("        <p><strong>描述:</strong> %s</p>\n", issue.getDescription()));
                
                if (issue.getRelatedData() != null && !issue.getRelatedData().isEmpty()) {
                    sb.append("        <p><strong>相关数据:</strong></p>\n");
                    sb.append("        <pre>");
                    sb.append(JsonUtil.toJson(issue.getRelatedData()));
                    sb.append("</pre>\n");
                }
                
                sb.append(String.format("        <p><strong>💡 建议操作:</strong> %s</p>\n", issue.getSuggestedAction()));
                sb.append("    </div>\n");
            }
        } else {
            sb.append("    <h2>✅ 检测结果</h2>\n");
            sb.append("    <div class=\"issue LOW\">\n");
            sb.append("        <h3>未发现问题 <span class=\"severity-badge severity LOW\">OK</span></h3>\n");
            sb.append("        <p class=\"success\">订单状态和支付记录均正常。</p>\n");
            sb.append("    </div>\n");
        }
        
        sb.append("    <div class=\"footer\">\n");
        sb.append(String.format("        <p>报告由 PaymentGuard 生成于 %s</p>\n", formatDateTime(LocalDateTime.now())));
        sb.append("    </div>\n");
        
        sb.append("</body>\n");
        sb.append("</html>\n");
        
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    public byte[] exportSummaryToCsv(List<IssueReport> reports) {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        PrintWriter writer = new PrintWriter(baos, true, StandardCharsets.UTF_8);
        
        writer.println("报告ID,订单ID,生成时间,问题总数,严重问题,高危问题,中危问题,低危问题");
        
        for (IssueReport report : reports) {
            int critical = 0, high = 0, medium = 0, low = 0;
            for (IssueReport.IssueDetail issue : report.getIssues()) {
                switch (issue.getSeverity()) {
                    case CRITICAL -> critical++;
                    case HIGH -> high++;
                    case MEDIUM -> medium++;
                    case LOW, INFO -> low++;
                }
            }
            
            writer.printf("%s,%s,%s,%d,%d,%d,%d,%d%n",
                    report.getReportId(),
                    report.getOrderId(),
                    formatDateTime(report.getGeneratedAt()),
                    report.getIssues().size(),
                    critical, high, medium, low);
        }
        
        writer.flush();
        return baos.toByteArray();
    }

    private String formatDateTime(LocalDateTime dateTime) {
        return dateTime != null ? dateTime.format(DATE_FORMAT) : "N/A";
    }

    private String formatSeverity(IssueDetector.IssueSeverity severity) {
        return switch (severity) {
            case CRITICAL -> "严重 🔴";
            case HIGH -> "高危 🟠";
            case MEDIUM -> "中危 🟡";
            case LOW -> "低危 🔵";
            case INFO -> "信息 ℹ️";
        };
    }
}
