package com.dns.preplay.controller;

import com.dns.preplay.model.dto.*;
import com.dns.preplay.service.DnsPreplayService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/preplays")
@RequiredArgsConstructor
public class DnsPreplayController {

    private final DnsPreplayService dnsPreplayService;

    @PostMapping
    public ResponseEntity<ApiResponse<PreplayResponse>> createPreplay(
            @Valid @RequestBody CreatePreplayRequest request) {
        log.info("创建DNS预演请求: {}", request.getPreplayName());
        PreplayResponse response = dnsPreplayService.createPreplay(request);
        return ResponseEntity.ok(ApiResponse.success("创建成功", response));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<PreplayResponse>> getPreplay(@PathVariable Long id) {
        log.info("查询DNS预演: id={}", id);
        PreplayResponse response = dnsPreplayService.getPreplay(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<PreplayResponse>>> getAllPreplays() {
        log.info("查询所有DNS预演");
        List<PreplayResponse> responses = dnsPreplayService.getAllPreplays();
        return ResponseEntity.ok(ApiResponse.success(responses));
    }

    @GetMapping("/name/{name}")
    public ResponseEntity<ApiResponse<PreplayResponse>> getPreplayByName(@PathVariable String name) {
        log.info("按名称查询DNS预演: name={}", name);
        PreplayResponse response = dnsPreplayService.getPreplayByName(name);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/{id}/diff")
    public ResponseEntity<ApiResponse<PreplayResponse>> calculateDiff(@PathVariable Long id) {
        log.info("计算差异: id={}", id);
        PreplayResponse response = dnsPreplayService.calculateDiff(id);
        return ResponseEntity.ok(ApiResponse.success("差异计算完成", response));
    }

    @PostMapping("/{id}/ttl-check")
    public ResponseEntity<ApiResponse<PreplayResponse>> checkTtlRisk(@PathVariable Long id) {
        log.info("TTL风险检查: id={}", id);
        PreplayResponse response = dnsPreplayService.checkTtlRisk(id);
        return ResponseEntity.ok(ApiResponse.success("TTL风险检查完成", response));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<ApiResponse<PreplayResponse>> updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody StatusUpdateRequest request) {
        log.info("更新状态: id={}, target={}", id, request.getTargetStatus());
        PreplayResponse response = dnsPreplayService.updateStatus(id, request);
        return ResponseEntity.ok(ApiResponse.success("状态更新成功", response));
    }

    @PutMapping("/{id}/correction")
    public ResponseEntity<ApiResponse<PreplayResponse>> applyManualCorrection(
            @PathVariable Long id,
            @Valid @RequestBody ManualCorrectionRequest request) {
        log.info("应用人工修正: id={}", id);
        PreplayResponse response = dnsPreplayService.applyManualCorrection(id, request);
        return ResponseEntity.ok(ApiResponse.success("人工修正已应用，状态已重置", response));
    }

    @GetMapping("/{id}/report")
    public ResponseEntity<String> exportPreplayReport(@PathVariable Long id) {
        log.info("导出预演报告: id={}", id);
        String report = dnsPreplayService.exportPreplayReport(id);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.TEXT_PLAIN);
        headers.setContentDispositionFormData("attachment", "preplay-report-" + id + ".txt");
        return ResponseEntity.ok()
                .headers(headers)
                .body(report);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deletePreplay(@PathVariable Long id) {
        log.info("删除DNS预演: id={}", id);
        dnsPreplayService.deletePreplay(id);
        return ResponseEntity.ok(ApiResponse.success("删除成功", null));
    }
}
