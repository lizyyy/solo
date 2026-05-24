package com.factory.gauge.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.factory.gauge.common.Result;
import com.factory.gauge.dto.request.GaugeRegisterRequest;
import com.factory.gauge.entity.MeasuringTool;
import com.factory.gauge.service.DataValidationService;
import com.factory.gauge.service.MeasuringToolService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/gauges")
public class MeasuringToolController {


    private static final Logger log = LoggerFactory.getLogger(MeasuringToolController.class);
    private final MeasuringToolService measuringToolService;

    public MeasuringToolController(MeasuringToolService measuringToolService, DataValidationService dataValidationService) {
        this.measuringToolService = measuringToolService;
        this.dataValidationService = dataValidationService;
    }
    private final DataValidationService dataValidationService;

    @PostMapping("/register")
    public Result<MeasuringTool> registerGauge(@Valid @RequestBody GaugeRegisterRequest request) {
        MeasuringTool gauge = measuringToolService.registerGauge(request);
        return Result.success("量具登记成功", gauge);
    }

    @GetMapping("/{toolNo}")
    public Result<MeasuringTool> getGauge(@PathVariable String toolNo) {
        MeasuringTool gauge = measuringToolService.getGaugeByToolNo(toolNo);
        return Result.success(gauge);
    }

    @GetMapping
    public Result<List<MeasuringTool>> getAllGauges() {
        List<MeasuringTool> gauges = measuringToolService.getAllGauges();
        return Result.success(gauges);
    }

    @GetMapping("/status/expired")
    public Result<List<MeasuringTool>> getExpiredGauges() {
        List<MeasuringTool> gauges = measuringToolService.getExpiredGauges();
        return Result.success(gauges);
    }

    @GetMapping("/status/deactivated")
    public Result<List<MeasuringTool>> getDeactivatedGauges() {
        List<MeasuringTool> gauges = measuringToolService.getDeactivatedGauges();
        return Result.success(gauges);
    }

    @GetMapping("/status/expiring")
    public Result<List<MeasuringTool>> getExpiringGauges(@RequestParam(defaultValue = "7") int days) {
        List<MeasuringTool> gauges = measuringToolService.getExpiringGauges(days);
        return Result.success(gauges);
    }

    @GetMapping("/{toolNo}/usable")
    public Result<Boolean> isGaugeUsable(@PathVariable String toolNo) {
        boolean usable = measuringToolService.isGaugeUsable(toolNo);
        return Result.success(usable);
    }

    @GetMapping("/{toolNo}/traceability")
    public Result<Map<String, Object>> getGaugeTraceability(@PathVariable String toolNo) {
        Map<String, Object> traceability = dataValidationService.validateGaugeTraceability(toolNo);
        return Result.success(traceability);
    }

    @PostMapping("/check-expired")
    public Result<Void> checkExpiredStatus() {
        measuringToolService.checkAndUpdateExpiredStatus();
        return Result.success("过期状态检查完成", null);
    }
}
