package com.mold.service.controller;

import com.mold.service.common.ApiResponse;
import com.mold.service.domain.dto.StrokeRecordRequest;
import com.mold.service.domain.entity.StrokeRecord;
import com.mold.service.service.StrokeRecordService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/stroke-records")
@RequiredArgsConstructor
public class StrokeRecordController {
    
    private final StrokeRecordService strokeRecordService;
    
    @PostMapping
    public ApiResponse<StrokeRecord> recordStrokes(
            @Valid @RequestBody StrokeRecordRequest request,
            @RequestHeader(value = "X-Operator", defaultValue = "system") String operator) {
        return ApiResponse.success(strokeRecordService.recordStrokes(request, operator));
    }
    
    @GetMapping("/batch/{batchId}")
    public ApiResponse<StrokeRecord> getByBatchId(@PathVariable String batchId) {
        StrokeRecord record = strokeRecordService.getByBatchId(batchId);
        return record != null ? ApiResponse.success(record) : ApiResponse.error(404, "记录不存在");
    }
    
    @PostMapping("/{batchId}/compensate")
    public ApiResponse<StrokeRecord> compensateRecord(
            @PathVariable String batchId,
            @RequestParam Long newStrokeCount,
            @RequestParam String newBatchId,
            @RequestParam String reason,
            @RequestHeader(value = "X-Operator", defaultValue = "system") String operator) {
        return ApiResponse.success(
                strokeRecordService.compensateRecord(batchId, newStrokeCount, newBatchId, operator, reason));
    }
    
    @PostMapping("/{batchId}/revoke")
    public ApiResponse<Void> revokeRecord(
            @PathVariable String batchId,
            @RequestParam String reason,
            @RequestHeader(value = "X-Operator", defaultValue = "system") String operator) {
        strokeRecordService.revokeRecord(batchId, operator, reason);
        return ApiResponse.success(null);
    }
}
