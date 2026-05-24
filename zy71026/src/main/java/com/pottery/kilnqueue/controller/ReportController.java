package com.pottery.kilnqueue.controller;

import com.pottery.kilnqueue.entity.FiringReport;
import com.pottery.kilnqueue.service.ReportService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @PostMapping("/batch/{batchNo}/generate")
    public ResponseEntity<Void> generateBatchReports(@PathVariable String batchNo) {
        reportService.generateBatchReports(batchNo);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/batch/{batchNo}")
    public ResponseEntity<List<FiringReport>> getBatchReports(@PathVariable String batchNo) {
        return ResponseEntity.ok(reportService.getBatchReports(batchNo));
    }

    @GetMapping("/work/{workNo}")
    public ResponseEntity<List<FiringReport>> getWorkReports(@PathVariable String workNo) {
        return ResponseEntity.ok(reportService.getWorkReports(workNo));
    }

    @GetMapping("/student/{studentNo}")
    public ResponseEntity<List<FiringReport>> getStudentReports(@PathVariable String studentNo) {
        return ResponseEntity.ok(reportService.getStudentReports(studentNo));
    }

    @GetMapping("/batch/{batchNo}/statistics")
    public ResponseEntity<Map<String, Object>> getBatchStatistics(@PathVariable String batchNo) {
        return ResponseEntity.ok(reportService.getBatchStatistics(batchNo));
    }

    @GetMapping("/batch/{batchNo}/export")
    public ResponseEntity<String> exportBatchAsCsv(
            @PathVariable String batchNo,
            @RequestParam(required = false) String operator) {
        String csv = reportService.exportBatchAsCsv(batchNo, operator);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv; charset=UTF-8"));
        headers.setContentDispositionFormData("attachment", batchNo + "-reports.csv");
        return ResponseEntity.ok()
                .headers(headers)
                .body(new String(csv.getBytes(StandardCharsets.UTF_8), StandardCharsets.ISO_8859_1));
    }
}
