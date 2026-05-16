package com.query.regression.controller;

import com.query.regression.dto.*;
import com.query.regression.entity.RegressionRecord;
import com.query.regression.enums.RegressionStatus;
import com.query.regression.service.ExportService;
import com.query.regression.service.RegressionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/regression")
@RequiredArgsConstructor
public class RegressionController {

    private final RegressionService regressionService;
    private final ExportService exportService;

    @PostMapping
    public ResponseEntity<ApiResponse<RegressionRecord>> createRegression(
            @Valid @RequestBody CreateRegressionRequest request) {
        log.info("创建回归记录: {}", request.getQueryName());
        RegressionRecord record = regressionService.createRegression(request);
        return ResponseEntity.ok(ApiResponse.success("创建成功", record));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<RegressionRecord>>> getAllRegressions() {
        List<RegressionRecord> records = regressionService.getAllRegressions();
        return ResponseEntity.ok(ApiResponse.success(records));
    }

    @GetMapping("/status/{status}")
    public ResponseEntity<ApiResponse<List<RegressionRecord>>> getRegressionsByStatus(
            @PathVariable RegressionStatus status) {
        List<RegressionRecord> records = regressionService.getRegressionsByStatus(status);
        return ResponseEntity.ok(ApiResponse.success(records));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<RegressionDetailDTO>> getRegressionDetail(@PathVariable Long id) {
        RegressionDetailDTO detail = regressionService.getRegressionDetail(id);
        return ResponseEntity.ok(ApiResponse.success(detail));
    }

    @PostMapping("/{id}/confirm")
    public ResponseEntity<ApiResponse<RegressionRecord>> confirmRegression(
            @PathVariable Long id,
            @Valid @RequestBody ConfirmRequest request) {
        log.info("确认回归记录: {} by {}", id, request.getConfirmedBy());
        RegressionRecord record = regressionService.confirmRegression(id, request);
        return ResponseEntity.ok(ApiResponse.success("确认成功", record));
    }

    @PostMapping("/{id}/retry")
    public ResponseEntity<ApiResponse<RegressionRecord>> retryAnalysis(@PathVariable Long id) {
        log.info("重试分析: {}", id);
        RegressionRecord record = regressionService.retryAnalysis(id);
        return ResponseEntity.ok(ApiResponse.success("重试成功", record));
    }

    @PostMapping("/{id}/correct")
    public ResponseEntity<ApiResponse<RegressionRecord>> manualCorrect(
            @PathVariable Long id,
            @RequestBody ManualCorrectionRequest request) {
        log.info("人工修正: {} by {}", id, request.getCorrectedBy());
        RegressionRecord record = regressionService.manualCorrect(id, request);
        return ResponseEntity.ok(ApiResponse.success("修正成功", record));
    }

    @GetMapping("/export/csv")
    public ResponseEntity<byte[]> exportCSV() {
        byte[] csvData = exportService.exportAllToCSV();
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv; charset=UTF-8"));
        headers.setContentDispositionFormData("attachment", 
                "regression_report_" + LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss")) + ".csv");
        return ResponseEntity.ok().headers(headers).body(csvData);
    }

    @GetMapping("/{id}/export/markdown")
    public ResponseEntity<String> exportMarkdown(@PathVariable Long id) {
        String markdown = exportService.exportDetailToMarkdown(id);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/markdown; charset=UTF-8"));
        headers.setContentDispositionFormData("attachment", "regression_" + id + ".md");
        return ResponseEntity.ok().headers(headers).body(markdown);
    }
}
