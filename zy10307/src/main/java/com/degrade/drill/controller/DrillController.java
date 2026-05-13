package com.degrade.drill.controller;

import com.degrade.drill.dto.*;
import com.degrade.drill.model.DrillPlan;
import com.degrade.drill.model.DrillReport;
import com.degrade.drill.model.MetricObservation;
import com.degrade.drill.service.DrillService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/drill")
@RequiredArgsConstructor
public class DrillController {

    private final DrillService drillService;

    @PostMapping
    public ApiResponse<DrillPlan> createDrill(@Valid @RequestBody CreateDrillRequest request) {
        return drillService.createDrill(request);
    }

    @PostMapping("/{id}/validate")
    public ApiResponse<DrillPlan> validateDrill(@PathVariable Long id) {
        return drillService.validateDrill(id);
    }

    @PostMapping("/{id}/start")
    public ApiResponse<DrillPlan> startDrill(@PathVariable Long id) {
        return drillService.startDrill(id);
    }

    @PostMapping("/{id}/stop")
    public ApiResponse<DrillPlan> stopDrill(@PathVariable Long id, @RequestParam(required = false) String reason) {
        return drillService.stopDrill(id, reason != null ? reason : "人工停止");
    }

    @PostMapping("/{id}/cancel")
    public ApiResponse<DrillPlan> cancelDrill(@PathVariable Long id) {
        return drillService.cancelDrill(id);
    }

    @GetMapping("/{id}")
    public ApiResponse<DrillPlan> getDrillById(@PathVariable Long id) {
        return drillService.getDrillById(id);
    }

    @GetMapping
    public ApiResponse<List<DrillPlan>> getAllDrills() {
        return drillService.getAllDrills();
    }

    @GetMapping("/{id}/metrics")
    public ApiResponse<List<MetricObservation>> getDrillMetrics(@PathVariable Long id) {
        return drillService.getMetricsByDrillId(id);
    }

    @GetMapping("/reports")
    public ApiResponse<List<DrillReport>> getAllReports() {
        return drillService.getAllReports();
    }

    @GetMapping("/reports/{drillId}")
    public ApiResponse<DrillReport> getReportByDrillId(@PathVariable Long drillId) {
        return drillService.getReportByDrillId(drillId);
    }
}