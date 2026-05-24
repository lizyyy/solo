package com.factory.gauge.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.factory.gauge.common.Result;
import com.factory.gauge.dto.request.DeactivationRequest;
import com.factory.gauge.entity.DeactivationRecord;
import com.factory.gauge.service.DeactivationService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/deactivations")
public class DeactivationController {


    private static final Logger log = LoggerFactory.getLogger(DeactivationController.class);
    private final DeactivationService deactivationService;


    public DeactivationController(DeactivationService deactivationService) {
        this.deactivationService = deactivationService;
    }
    @PostMapping("/apply")
    public Result<DeactivationRecord> applyDeactivation(@Valid @RequestBody DeactivationRequest request) {
        DeactivationRecord record = deactivationService.deactivateGauge(request);
        return Result.success("量具停用成功", record);
    }

    @PostMapping("/reactivate")
    public Result<DeactivationRecord> reactivateGauge(
            @RequestParam String toolNo,
            @RequestParam(required = false) String reactivationRemark,
            @RequestParam(defaultValue = "system") String operator) {
        DeactivationRecord record = deactivationService.reactivateGauge(toolNo, reactivationRemark, operator);
        return Result.success("量具重新启用成功", record);
    }

    @GetMapping
    public Result<List<DeactivationRecord>> getAllRecords() {
        List<DeactivationRecord> records = deactivationService.getAllRecords();
        return Result.success(records);
    }

    @GetMapping("/gauge/{toolNo}")
    public Result<List<DeactivationRecord>> getRecordsByToolNo(@PathVariable String toolNo) {
        List<DeactivationRecord> records = deactivationService.getRecordsByToolNo(toolNo);
        return Result.success(records);
    }
}
