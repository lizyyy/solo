package com.hazardous.waste.controller;

import com.hazardous.waste.dto.ApiResponse;
import com.hazardous.waste.entity.AlertRecord;
import com.hazardous.waste.service.AlertService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/alerts")
@RequiredArgsConstructor
public class AlertController {

    private final AlertService alertService;

    @GetMapping
    public ApiResponse<List<AlertRecord>> getAllAlerts() {
        return ApiResponse.success(alertService.getAllAlerts());
    }

    @GetMapping("/unhandled")
    public ApiResponse<List<AlertRecord>> getUnhandledAlerts() {
        return ApiResponse.success(alertService.getUnhandledAlerts());
    }

    @PostMapping("/{alertId}/handle")
    public ApiResponse<AlertRecord> handleAlert(
            @PathVariable Long alertId,
            @RequestBody Map<String, String> request) {
        String handler = request.getOrDefault("handler", "SYSTEM");
        String remark = request.get("remark");
        return ApiResponse.success(alertService.handleAlert(alertId, handler, remark));
    }

    @PostMapping("/{alertId}/read")
    public ApiResponse<Void> markAsRead(@PathVariable Long alertId) {
        alertService.markAsRead(alertId);
        return ApiResponse.success();
    }

    @PostMapping("/trigger-check")
    public ApiResponse<Void> triggerOverdueCheck() {
        alertService.checkOverdueWaste();
        return ApiResponse.success();
    }
}
