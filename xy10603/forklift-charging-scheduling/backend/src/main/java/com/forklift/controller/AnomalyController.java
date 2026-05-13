package com.forklift.controller;

import com.forklift.common.Result;
import com.forklift.entity.AnomalyRecord;
import com.forklift.service.AnomalyService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/anomalies")
public class AnomalyController {

    @Autowired
    private AnomalyService anomalyService;

    @GetMapping
    public Result<List<AnomalyRecord>> getAllAnomalies() {
        return Result.success(anomalyService.getAllAnomalies());
    }

    @GetMapping("/pending")
    public Result<List<AnomalyRecord>> getPendingAnomalies() {
        return Result.success(anomalyService.getPendingAnomalies());
    }

    @GetMapping("/type/{type}")
    public Result<List<AnomalyRecord>> getAnomaliesByType(@PathVariable String type) {
        return Result.success(anomalyService.getAnomaliesByType(type));
    }

    @GetMapping("/handler/{handler}")
    public Result<List<AnomalyRecord>> getAnomaliesByHandler(@PathVariable String handler) {
        return Result.success(anomalyService.getAnomaliesByHandler(handler));
    }

    @GetMapping("/{id}")
    public Result<AnomalyRecord> getById(@PathVariable Long id) {
        return Result.success(anomalyService.getById(id));
    }

    @PostMapping
    public Result<AnomalyRecord> create(@RequestBody AnomalyRecord anomaly) {
        return Result.success(anomalyService.createAnomaly(anomaly));
    }

    @PostMapping("/{id}/handle")
    public Result<AnomalyRecord> handleAnomaly(@PathVariable Long id,
                                               @RequestParam String notes,
                                               @RequestHeader(value = "X-Operator", defaultValue = "admin") String handler) {
        return Result.success(anomalyService.handleAnomaly(id, handler, notes));
    }

    @PostMapping("/{id}/assign")
    public Result<AnomalyRecord> assignAnomaly(@PathVariable Long id,
                                               @RequestParam String assignee,
                                               @RequestHeader(value = "X-Operator", defaultValue = "admin") String operator) {
        return Result.success(anomalyService.assignAnomaly(id, assignee, operator));
    }
}
