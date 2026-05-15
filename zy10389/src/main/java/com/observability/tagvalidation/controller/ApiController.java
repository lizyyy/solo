package com.observability.tagvalidation.controller;

import com.observability.tagvalidation.dto.ApiResponse;
import com.observability.tagvalidation.dto.CreateApiRequest;
import com.observability.tagvalidation.dto.ReportSampleRequest;
import com.observability.tagvalidation.dto.ValidationResultDto;
import com.observability.tagvalidation.entity.ApiInfo;
import com.observability.tagvalidation.entity.ReportSample;
import com.observability.tagvalidation.entity.ViolationRecord;
import com.observability.tagvalidation.service.ApiService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ApiController {

    private final ApiService apiService;

    @PostMapping("/create")
    public ApiResponse<ApiInfo> createApi(@Valid @RequestBody CreateApiRequest request) {
        ApiInfo apiInfo = apiService.createApi(request);
        return ApiResponse.success(apiInfo);
    }

    @GetMapping("/{requestId}")
    public ApiResponse<ApiInfo> getApi(@PathVariable String requestId) {
        return apiService.findByRequestId(requestId)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error(404, "API 不存在: " + requestId));
    }

    @GetMapping("/list")
    public ApiResponse<List<ApiInfo>> listApis() {
        return ApiResponse.success(apiService.findAll());
    }

    @PostMapping("/report")
    public ApiResponse<ValidationResultDto> reportSample(@Valid @RequestBody ReportSampleRequest request) {
        try {
            ValidationResultDto result = apiService.reportSample(request);
            return ApiResponse.success(result);
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(400, e.getMessage());
        }
    }

    @GetMapping("/{requestId}/samples")
    public ApiResponse<List<ReportSample>> getSamples(@PathVariable String requestId) {
        try {
            return ApiResponse.success(apiService.getSamplesByRequestId(requestId));
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(400, e.getMessage());
        }
    }

    @GetMapping("/{requestId}/violations")
    public ApiResponse<List<ViolationRecord>> getViolations(@PathVariable String requestId) {
        try {
            return ApiResponse.success(apiService.getViolationsByRequestId(requestId));
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(400, e.getMessage());
        }
    }

    @PostMapping("/{requestId}/advance")
    public ApiResponse<ApiInfo> advanceStatus(@PathVariable String requestId) {
        try {
            ApiInfo apiInfo = apiService.advanceStatus(requestId);
            return ApiResponse.success(apiInfo);
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(400, e.getMessage());
        }
    }

    @PostMapping("/{requestId}/revoke")
    public ApiResponse<ApiInfo> revoke(@PathVariable String requestId) {
        try {
            ApiInfo apiInfo = apiService.revoke(requestId);
            return ApiResponse.success(apiInfo);
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(400, e.getMessage());
        }
    }

    @PostMapping("/violations/{violationId}/resolve")
    public ApiResponse<ViolationRecord> resolveViolation(@PathVariable Long violationId) {
        try {
            ViolationRecord violation = apiService.resolveViolation(violationId);
            return ApiResponse.success(violation);
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(400, e.getMessage());
        }
    }

    @GetMapping("/{requestId}/export")
    public ResponseEntity<byte[]> export(@PathVariable String requestId) {
        try {
            byte[] csvContent = apiService.export(requestId);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType("text/csv; charset=UTF-8"));
            headers.setContentDispositionFormData("attachment", requestId + "_validation_report.csv");
            return ResponseEntity.ok().headers(headers).body(csvContent);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(null);
        }
    }
}
