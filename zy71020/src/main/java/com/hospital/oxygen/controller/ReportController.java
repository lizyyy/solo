package com.hospital.oxygen.controller;

import com.hospital.oxygen.common.ApiResponse;
import com.hospital.oxygen.entity.OccupancyReport;
import com.hospital.oxygen.service.ReportService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @PostMapping("/generate")
    public ApiResponse<OccupancyReport> generateReport(@RequestParam String ward, @RequestParam(required = false) String operator) {
        return ApiResponse.success("报告生成成功", reportService.generateReport(ward, operator != null ? operator : "SYSTEM"));
    }

    @GetMapping("/{reportNumber}")
    public ApiResponse<OccupancyReport> getReport(@PathVariable String reportNumber) {
        return ApiResponse.success(reportService.getReport(reportNumber));
    }

    @GetMapping
    public ApiResponse<List<OccupancyReport>> getAllReports() {
        return ApiResponse.success(reportService.getAllReports());
    }

    @GetMapping("/ward/{ward}")
    public ApiResponse<List<OccupancyReport>> getReportsByWard(@PathVariable String ward) {
        return ApiResponse.success(reportService.getReportsByWard(ward));
    }

    @GetMapping("/export/{reportNumber}")
    public ResponseEntity<byte[]> exportReport(@PathVariable String reportNumber) {
        byte[] csvData = reportService.exportReportToCsv(reportNumber);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv; charset=UTF-8"));
        headers.setContentDispositionFormData("attachment", reportNumber + ".csv");

        return ResponseEntity.ok()
                .headers(headers)
                .body(csvData);
    }
}
