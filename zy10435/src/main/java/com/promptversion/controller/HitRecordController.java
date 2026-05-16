package com.promptversion.controller;

import com.promptversion.dto.ApiResponse;
import com.promptversion.dto.HitRecordRequest;
import com.promptversion.entity.HitRecord;
import com.promptversion.service.HitRecordService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/hits")
public class HitRecordController {

    @Autowired
    private HitRecordService hitRecordService;

    @PostMapping
    public ApiResponse<HitRecord> recordHit(@Valid @RequestBody HitRecordRequest request) {
        return ApiResponse.success(hitRecordService.recordHit(request));
    }

    @GetMapping("/version/{versionId}")
    public ApiResponse<List<HitRecord>> getHitRecordsByVersion(@PathVariable Long versionId) {
        return ApiResponse.success(hitRecordService.getHitRecordsByVersion(versionId));
    }

    @GetMapping("/template/{templateId}")
    public ApiResponse<List<HitRecord>> getHitRecordsByTemplate(@PathVariable Long templateId) {
        return ApiResponse.success(hitRecordService.getHitRecordsByTemplate(templateId));
    }

    @GetMapping("/template/{templateId}/range")
    public ApiResponse<List<HitRecord>> getHitRecordsByTimeRange(
            @PathVariable Long templateId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime) {
        return ApiResponse.success(hitRecordService.getHitRecordsByTimeRange(templateId, startTime, endTime));
    }
}