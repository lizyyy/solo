package com.paymentguard.reporting.controller;

import com.paymentguard.common.dto.ApiResponse;
import com.paymentguard.reporting.detector.IssueDetector;
import com.paymentguard.reporting.detector.IssueDetector.IssueReport;
import com.paymentguard.reporting.exporter.ReportExporter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/api/reporting")
@RequiredArgsConstructor
public class ReportingController {

    private final IssueDetector issueDetector;
    private final ReportExporter reportExporter;

    @PostMapping("/detect/{orderId}")
    public ResponseEntity<ApiResponse<IssueReport>> detectIssues(@PathVariable String orderId) {
        IssueReport report = issueDetector.detectIssues(orderId);
        
        if (report == null) {
            return ResponseEntity.status(404)
                    .body(ApiResponse.error("订单不存在或无法检测问题"));
        }
        
        return ResponseEntity.ok(ApiResponse.success(report,
                report.hasIssues() ? "检测到问题" : "未发现问题"));
    }

    @GetMapping("/reports")
    public ResponseEntity<ApiResponse<List<IssueReport>>> getAllReports() {
        List<IssueReport> reports = issueDetector.getAllReports();
        return ResponseEntity.ok(ApiResponse.success(reports));
    }

    @GetMapping("/reports/{reportId}")
    public ResponseEntity<ApiResponse<IssueReport>> getReport(@PathVariable String reportId) {
        IssueReport report = issueDetector.getReport(reportId);
        if (report == null) {
            return ResponseEntity.status(404)
                    .body(ApiResponse.error("报告不存在: " + reportId));
        }
        return ResponseEntity.ok(ApiResponse.success(report));
    }

    @GetMapping("/reports/{reportId}/export")
    public ResponseEntity<byte[]> exportReport(
            @PathVariable String reportId,
            @RequestParam(defaultValue = "markdown") String format) {
        
        byte[] content;
        String filename;
        MediaType mediaType;
        
        String lowerFormat = format.toLowerCase();
        if ("json".equals(lowerFormat)) {
            content = reportExporter.exportToJson(reportId);
            filename = "report-" + reportId + ".json";
            mediaType = MediaType.APPLICATION_JSON;
        } else if ("html".equals(lowerFormat)) {
            content = reportExporter.exportToHtml(reportId);
            filename = "report-" + reportId + ".html";
            mediaType = MediaType.TEXT_HTML;
        } else if ("markdown".equals(lowerFormat) || "md".equals(lowerFormat)) {
            content = reportExporter.exportToMarkdown(reportId);
            filename = "report-" + reportId + ".md";
            mediaType = MediaType.parseMediaType("text/markdown");
        } else {
            return ResponseEntity.badRequest().build();
        }
        
        String encodedFilename = URLEncoder.encode(filename, StandardCharsets.UTF_8)
                .replaceAll("\\+", "%20");
        
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, 
                        "attachment; filename*=UTF-8''" + encodedFilename)
                .contentType(mediaType)
                .contentLength(content.length)
                .body(content);
    }

    @GetMapping("/reports/export/summary")
    public ResponseEntity<byte[]> exportSummary() {
        List<IssueReport> reports = issueDetector.getAllReports();
        byte[] content = reportExporter.exportSummaryToCsv(reports);
        String filename = "reports-summary.csv";
        
        String encodedFilename = URLEncoder.encode(filename, StandardCharsets.UTF_8)
                .replaceAll("\\+", "%20");
        
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, 
                        "attachment; filename*=UTF-8''" + encodedFilename)
                .contentType(MediaType.parseMediaType("text/csv"))
                .contentLength(content.length)
                .body(content);
    }
}
