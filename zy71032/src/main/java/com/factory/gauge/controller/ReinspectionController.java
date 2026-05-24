package com.factory.gauge.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.factory.gauge.common.Result;
import com.factory.gauge.dto.request.ReinspectionRequest;
import com.factory.gauge.entity.ReinspectionRecord;
import com.factory.gauge.service.ReinspectionService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/reinspections")
public class ReinspectionController {


    private static final Logger log = LoggerFactory.getLogger(ReinspectionController.class);
    private final ReinspectionService reinspectionService;


    public ReinspectionController(ReinspectionService reinspectionService) {
        this.reinspectionService = reinspectionService;
    }
    @PostMapping("/record")
    public Result<ReinspectionRecord> recordReinspection(@Valid @RequestBody ReinspectionRequest request) {
        ReinspectionRecord record = reinspectionService.recordReinspection(request);
        return Result.success("复检记录创建成功", record);
    }

    @GetMapping("/{id}")
    public Result<ReinspectionRecord> getRecord(@PathVariable Long id) {
        ReinspectionRecord record = reinspectionService.getRecordById(id);
        return Result.success(record);
    }

    @GetMapping
    public Result<List<ReinspectionRecord>> getAllRecords() {
        List<ReinspectionRecord> records = reinspectionService.getAllRecords();
        return Result.success(records);
    }

    @GetMapping("/batch/{batchNo}")
    public Result<List<ReinspectionRecord>> getRecordsByBatchNo(@PathVariable String batchNo) {
        List<ReinspectionRecord> records = reinspectionService.getRecordsByBatchNo(batchNo);
        return Result.success(records);
    }

    @GetMapping("/gauge/{toolNo}")
    public Result<List<ReinspectionRecord>> getRecordsByToolNo(@PathVariable String toolNo) {
        List<ReinspectionRecord> records = reinspectionService.getRecordsByToolNo(toolNo);
        return Result.success(records);
    }

    @PostMapping("/{id}/correct")
    public Result<ReinspectionRecord> correctRecord(
            @PathVariable Long id,
            @RequestParam String correctedBy,
            @RequestParam(required = false) String correctionRemark) {
        ReinspectionRecord record = reinspectionService.correctRecord(id, correctedBy, correctionRemark);
        return Result.success("记录修正成功", record);
    }

    @PostMapping("/unlock-batch")
    public Result<Void> unlockBatchAfterReinspection(
            @RequestParam String batchNo,
            @RequestParam(defaultValue = "system") String operator) {
        reinspectionService.unlockBatchAfterReinspection(batchNo, operator);
        return Result.success("批次已根据复检结果解锁", null);
    }
}
