package com.diagnostic.controller;

import com.diagnostic.dto.*;
import com.diagnostic.entity.ConnectionPoolDiagnostic;
import com.diagnostic.entity.DiagnosticReport;
import com.diagnostic.enums.DiagnosticStatus;
import com.diagnostic.service.DiagnosticService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/diagnostic")
@RequiredArgsConstructor
public class DiagnosticController {
    private final DiagnosticService diagnosticService;

    @PostMapping
    public ApiResponse<ConnectionPoolDiagnostic> create(@Valid @RequestBody DiagnosticCreateRequest request) {
        log.info("创建诊断记录: instanceId={}, poolName={}", request.getInstanceId(), request.getPoolName());
        ConnectionPoolDiagnostic result = diagnosticService.createDiagnostic(request);
        return ApiResponse.success("创建成功", result);
    }

    @PostMapping("/query")
    public ApiResponse<Page<ConnectionPoolDiagnostic>> query(@RequestBody DiagnosticQueryRequest request) {
        log.info("查询诊断记录: {}", request);
        Page<ConnectionPoolDiagnostic> result = diagnosticService.queryDiagnostics(request);
        return ApiResponse.success(result);
    }

    @GetMapping("/{id}")
    public ApiResponse<ConnectionPoolDiagnostic> getById(@PathVariable Long id) {
        return diagnosticService.getDiagnostic(id)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error("记录不存在"));
    }

    @PutMapping("/status")
    public ApiResponse<ConnectionPoolDiagnostic> updateStatus(@Valid @RequestBody StatusUpdateRequest request) {
        log.info("状态推进: id={}, targetStatus={}", request.getId(), request.getTargetStatus());
        ConnectionPoolDiagnostic result = diagnosticService.updateStatus(request);
        return ApiResponse.success("状态更新成功", result);
    }

    @PutMapping("/manual-correction")
    public ApiResponse<ConnectionPoolDiagnostic> manualCorrection(@Valid @RequestBody ManualCorrectionRequest request) {
        log.info("人工修正: id={}, reviewer={}", request.getId(), request.getReviewer());
        ConnectionPoolDiagnostic result = diagnosticService.manualCorrection(request);
        return ApiResponse.success("人工修正成功", result);
    }

    @PostMapping("/report")
    public ApiResponse<DiagnosticReport> generateReport(
            @RequestParam String instanceId,
            @RequestParam String poolName,
            @RequestParam @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss") LocalDateTime startTime,
            @RequestParam @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss") LocalDateTime endTime) {
        log.info("生成诊断报告: instanceId={}, poolName={}, {}~{}", instanceId, poolName, startTime, endTime);
        DiagnosticReport report = diagnosticService.generateReport(instanceId, poolName, startTime, endTime);
        return ApiResponse.success("报告生成成功", report);
    }

    @GetMapping("/report/{reportNo}")
    public ApiResponse<DiagnosticReport> getReport(@PathVariable String reportNo) {
        return diagnosticService.getReport(reportNo)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error("报告不存在"));
    }

    @PostMapping("/export/excel")
    public ResponseEntity<byte[]> exportExcel(@RequestBody DiagnosticQueryRequest request) throws Exception {
        log.info("导出Excel: {}", request);
        byte[] data = diagnosticService.exportToExcel(request);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
        String filename = "diagnostic_" + System.currentTimeMillis() + ".xlsx";
        headers.setContentDispositionFormData("attachment", filename);
        return ResponseEntity.ok().headers(headers).body(data);
    }

    @PostMapping("/export/json")
    public ResponseEntity<String> exportJson(@RequestBody DiagnosticQueryRequest request) {
        log.info("导出JSON: {}", request);
        String json = diagnosticService.exportToJson(request);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String filename = "diagnostic_" + System.currentTimeMillis() + ".json";
        headers.setContentDispositionFormData("attachment", filename);
        return ResponseEntity.ok().headers(headers).body(json);
    }

    @GetMapping("/statuses")
    public ApiResponse<List<DiagnosticStatus>> getAllStatuses() {
        return ApiResponse.success(diagnosticService.getAllStatuses());
    }

    @PostMapping("/archive")
    public ApiResponse<String> archiveOldRecords() {
        log.info("归档旧记录");
        diagnosticService.archiveOldRecords();
        return ApiResponse.success("归档完成", null);
    }
}
