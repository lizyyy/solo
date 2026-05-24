package com.warehouse.charging.controller;

import com.warehouse.charging.dto.ApiResponse;
import com.warehouse.charging.dto.ScheduleReportDTO;
import com.warehouse.charging.service.ReportService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping("/schedule")
    public ApiResponse<ScheduleReportDTO> generateReport(
            @RequestParam(required = false) String startTime,
            @RequestParam(required = false) String endTime) {

        LocalDateTime start = parseTime(startTime, LocalDateTime.now().minusDays(7));
        LocalDateTime end = parseTime(endTime, LocalDateTime.now());

        return ApiResponse.success(reportService.generateReport(start, end));
    }

    @GetMapping("/schedule/export")
    public ResponseEntity<byte[]> exportReportCsv(
            @RequestParam(required = false) String startTime,
            @RequestParam(required = false) String endTime) {

        LocalDateTime start = parseTime(startTime, LocalDateTime.now().minusDays(7));
        LocalDateTime end = parseTime(endTime, LocalDateTime.now());

        byte[] csvData = reportService.exportReportAsCsv(start, end);
        String fileName = "charging_report_" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss")) + ".csv";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(csvData);
    }

    private LocalDateTime parseTime(String timeStr, LocalDateTime defaultValue) {
        if (timeStr == null || timeStr.isEmpty()) {
            return defaultValue;
        }
        try {
            return LocalDateTime.parse(timeStr, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        } catch (Exception e) {
            try {
                return LocalDateTime.parse(timeStr + "T00:00:00", DateTimeFormatter.ISO_LOCAL_DATE_TIME);
            } catch (Exception e2) {
                return defaultValue;
            }
        }
    }
}
