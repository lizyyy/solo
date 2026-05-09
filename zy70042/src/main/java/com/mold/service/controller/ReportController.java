package com.mold.service.controller;

import com.mold.service.common.ApiResponse;
import com.mold.service.service.ReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {
    
    private final ReportService reportService;
    
    @GetMapping("/mold-life-summary")
    public ApiResponse<ReportService.MoldLifeSummary> getMoldLifeSummary() {
        return ApiResponse.success(reportService.getMoldLifeSummary());
    }
    
    @GetMapping("/schedule-impact")
    public ApiResponse<ReportService.ScheduleImpactReport> getScheduleImpactReport() {
        return ApiResponse.success(reportService.getScheduleImpactReport());
    }
    
    @GetMapping("/history-trace/{moldCode}")
    public ApiResponse<ReportService.HistoryTraceReport> getHistoryTrace(@PathVariable String moldCode) {
        ReportService.HistoryTraceReport report = reportService.getHistoryTraceReport(moldCode);
        return report != null 
                ? ApiResponse.success(report)
                : ApiResponse.error(404, "模具不存在: " + moldCode);
    }
}
