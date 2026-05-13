package com.forklift.controller;

import com.forklift.common.Result;
import com.forklift.entity.ChangeHistory;
import com.forklift.entity.ImportBatch;
import com.forklift.service.ChangeHistoryService;
import com.forklift.service.ReportService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/reports")
public class ReportController {

    @Autowired
    private ReportService reportService;

    @Autowired
    private ChangeHistoryService changeHistoryService;

    @GetMapping("/charge-history")
    public Result<List<Map<String, Object>>> getChargeHistory(
            @RequestParam(required = false) String assignedOperator,
            @RequestParam(required = false) String handledBy,
            @RequestParam(required = false) String startTime,
            @RequestParam(required = false) String endTime,
            @RequestParam(required = false) String taskStatus) {
        Map<String, Object> filters = new HashMap<>();
        if (assignedOperator != null && !assignedOperator.isEmpty()) {
            filters.put("assignedOperator", assignedOperator);
        }
        if (handledBy != null && !handledBy.isEmpty()) {
            filters.put("handledBy", handledBy);
        }
        if (startTime != null && !startTime.isEmpty()) {
            filters.put("startTime", startTime);
        }
        if (endTime != null && !endTime.isEmpty()) {
            filters.put("endTime", endTime);
        }
        if (taskStatus != null && !taskStatus.isEmpty()) {
            filters.put("taskStatus", taskStatus);
        }
        return Result.success(reportService.getChargeHistory(filters));
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> exportToExcel(
            @RequestParam(required = false) String assignedOperator,
            @RequestParam(required = false) String handledBy,
            @RequestParam(required = false) String startTime,
            @RequestParam(required = false) String endTime,
            @RequestParam(required = false) String taskStatus) throws Exception {
        Map<String, Object> filters = new HashMap<>();
        if (assignedOperator != null && !assignedOperator.isEmpty()) {
            filters.put("assignedOperator", assignedOperator);
        }
        if (handledBy != null && !handledBy.isEmpty()) {
            filters.put("handledBy", handledBy);
        }
        if (startTime != null && !startTime.isEmpty()) {
            filters.put("startTime", startTime);
        }
        if (endTime != null && !endTime.isEmpty()) {
            filters.put("endTime", endTime);
        }
        if (taskStatus != null && !taskStatus.isEmpty()) {
            filters.put("taskStatus", taskStatus);
        }
        
        byte[] data = reportService.exportToExcel(filters);
        
        String fileName = "充电记录报表_" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss")) + ".xlsx";
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
        headers.setContentDispositionFormData("attachment", fileName);
        
        return ResponseEntity.ok()
                .headers(headers)
                .body(data);
    }

    @GetMapping("/import-history")
    public Result<List<Map<String, Object>>> getImportHistory() {
        return Result.success(reportService.getImportHistory());
    }

    @GetMapping("/change-history")
    public Result<List<ChangeHistory>> getChangeHistory(
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) String operator,
            @RequestParam(required = false) String startTime,
            @RequestParam(required = false) String endTime) {
        Map<String, Object> filters = new HashMap<>();
        if (entityType != null && !entityType.isEmpty()) {
            filters.put("entityType", entityType);
        }
        if (operator != null && !operator.isEmpty()) {
            filters.put("operator", operator);
        }
        if (startTime != null && !startTime.isEmpty()) {
            filters.put("startTime", startTime);
        }
        if (endTime != null && !endTime.isEmpty()) {
            filters.put("endTime", endTime);
        }
        return Result.success(reportService.getChangeHistory(filters));
    }

    @GetMapping("/change-history/entity/{entityType}/{entityId}")
    public Result<List<ChangeHistory>> getHistoryByEntity(
            @PathVariable String entityType,
            @PathVariable Long entityId) {
        return Result.success(changeHistoryService.getHistoryByEntity(entityType, entityId));
    }

    @GetMapping("/change-history/operator/{operator}")
    public Result<List<ChangeHistory>> getHistoryByOperator(@PathVariable String operator) {
        return Result.success(changeHistoryService.getHistoryByOperator(operator));
    }
}
