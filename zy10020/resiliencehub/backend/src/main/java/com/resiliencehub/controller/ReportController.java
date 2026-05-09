package com.resiliencehub.controller;

import com.resiliencehub.common.Result;
import com.resiliencehub.report.ReportService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@RestController
@RequestMapping("/api/v1/report")
public class ReportController {
    
    private final ReportService reportService;
    
    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }
    
    @GetMapping
    public Result<ReportService.SystemReport> getReport() {
        return Result.success(reportService.generateReport());
    }
    
    @GetMapping("/export")
    public ResponseEntity<byte[]> exportReport() {
        byte[] content = reportService.exportReportAsMarkdown();
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
        String filename = "resilience_report_" + timestamp + ".md";
        
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, 
                "attachment; filename=" + filename)
            .contentType(new MediaType("text", "markdown", StandardCharsets.UTF_8))
            .body(content);
    }
    
    @GetMapping("/problems")
    public Result<List<ReportService.ProblemEvent>> getRecentProblems(
            @RequestParam(defaultValue = "50") int limit) {
        return Result.success(reportService.getRecentProblems(limit));
    }
    
    @GetMapping("/problems/type/{type}")
    public Result<List<ReportService.ProblemEvent>> getProblemsByType(@PathVariable String type) {
        return Result.success(reportService.getProblemsByType(type));
    }
    
    @GetMapping("/problems/severity/{severity}")
    public Result<List<ReportService.ProblemEvent>> getProblemsBySeverity(
            @PathVariable ReportService.ProblemEvent.Severity severity) {
        return Result.success(reportService.getProblemsBySeverity(severity));
    }
    
    @PostMapping("/problems")
    public Result<?> recordProblem(@RequestBody ReportService.ProblemEvent event) {
        reportService.recordProblem(event);
        return Result.success("Problem recorded: " + event.getId());
    }
    
    @DeleteMapping("/problems/old/{hours}")
    public Result<?> clearOldProblems(@PathVariable int hours) {
        reportService.clearOldProblems(hours);
        return Result.success("Cleared problems older than " + hours + " hours");
    }
}
