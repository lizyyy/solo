package com.hazardous.waste.controller;

import com.hazardous.waste.dto.ApiResponse;
import com.hazardous.waste.entity.DisposalReport;
import com.hazardous.waste.entity.WasteRecord;
import com.hazardous.waste.enums.WasteStatus;
import com.hazardous.waste.service.ReportService;
import com.hazardous.waste.service.WasteRecordService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private ReportService reportService;
    private WasteRecordService wasteRecordService;

    @PostMapping("/disposal/generate")
    public ApiResponse<DisposalReport> generateDisposalReport(
            @RequestParam String transferFormNo,
            @RequestParam(defaultValue = "SYSTEM") String operator) {
        return ApiResponse.success(reportService.generateDisposalReport(transferFormNo, operator));
    }

    @PostMapping("/disposal/{reportNo}/approve")
    public ApiResponse<DisposalReport> approveReport(
            @PathVariable String reportNo,
            @RequestBody Map<String, Object> request) {
        String approver = (String) request.getOrDefault("approver", "SYSTEM");
        Boolean approved = (Boolean) request.getOrDefault("approved", true);
        String remark = (String) request.get("remark");
        return ApiResponse.success(reportService.approveReport(reportNo, approver, approved, remark));
    }

    @GetMapping
    public ApiResponse<List<DisposalReport>> getAllReports() {
        return ApiResponse.success(reportService.getAllReports());
    }

    @GetMapping("/{reportNo}")
    public ApiResponse<DisposalReport> getReportByNo(@PathVariable String reportNo) {
        return ApiResponse.success(reportService.getReportByNo(reportNo));
    }

    @GetMapping("/export/waste-records")
    public ResponseEntity<byte[]> exportWasteRecords(
            @RequestParam(required = false) WasteStatus status) throws IOException {
        List<WasteRecord> records = status != null
                ? wasteRecordService.getRecordsByStatus(status)
                : wasteRecordService.getAllRecords();

        byte[] excelData = reportService.exportWasteRecordsToExcel(records);

        String filename = "危废记录_" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd")) + ".xlsx";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(excelData);
    }

    @GetMapping("/export/disposal/{reportNo}")
    public ResponseEntity<byte[]> exportDisposalReport(@PathVariable String reportNo) throws IOException {
        DisposalReport report = reportService.getReportByNo(reportNo);
        byte[] excelData = reportService.exportDisposalReportToExcel(report);

        String filename = "处置报告_" + reportNo + ".xlsx";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(excelData);
    }
}
