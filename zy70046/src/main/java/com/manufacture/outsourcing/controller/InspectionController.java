package com.manufacture.outsourcing.controller;

import com.manufacture.outsourcing.common.Result;
import com.manufacture.outsourcing.dto.InspectionResultRequest;
import com.manufacture.outsourcing.entity.InspectionResult;
import com.manufacture.outsourcing.service.InspectionService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/inspections")
public class InspectionController {

    private final InspectionService inspectionService;

    public InspectionController(InspectionService inspectionService) {
        this.inspectionService = inspectionService;
    }

    @PostMapping
    public Result<InspectionResult> create(@Valid @RequestBody InspectionResultRequest request) {
        return Result.success(inspectionService.createInspection(request));
    }

    @GetMapping("/{id}")
    public Result<InspectionResult> getById(@PathVariable Long id) {
        return Result.success(inspectionService.getById(id));
    }

    @GetMapping("/no/{resultNo}")
    public Result<InspectionResult> getByResultNo(@PathVariable String resultNo) {
        return Result.success(inspectionService.getByResultNo(resultNo));
    }

    @GetMapping("/batch/{batchId}")
    public Result<List<InspectionResult>> findByBatchId(@PathVariable Long batchId) {
        return Result.success(inspectionService.findByBatchId(batchId));
    }

    @PostMapping("/{id}/confirm")
    public Result<InspectionResult> confirm(@PathVariable Long id) {
        return Result.success(inspectionService.confirmInspection(id));
    }

    @PostMapping("/{id}/retry-compensation")
    public Result<InspectionResult> retryCompensation(@PathVariable Long id) {
        return Result.success(inspectionService.retryCompensation(id));
    }

    @GetMapping("/failed-compensation")
    public Result<List<InspectionResult>> findFailedCompensation() {
        return Result.success(inspectionService.findFailedCompensation());
    }
}
