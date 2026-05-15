package com.apidiff.controller;

import com.apidiff.dto.*;
import com.apidiff.entity.OperationLog;
import com.apidiff.service.ApiDiffService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/diffs")
@RequiredArgsConstructor
public class ApiDiffController {

    private final ApiDiffService apiDiffService;

    @PostMapping
    public ResponseEntity<ApiResponse<ApiDiffResponse>> createDiffRecord(
            @Valid @RequestBody ApiDiffRequest request) {
        ApiDiffResponse response = apiDiffService.createDiffRecord(request);
        return ResponseEntity.ok(ApiResponse.success("创建成功", response));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ApiDiffResponse>> getDiffRecord(@PathVariable Long id) {
        ApiDiffResponse response = apiDiffService.getDiffRecord(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/query")
    public ResponseEntity<ApiResponse<Page<ApiDiffResponse>>> queryDiffRecords(
            @RequestBody DiffQueryRequest request) {
        Page<ApiDiffResponse> response = apiDiffService.queryDiffRecords(request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<ApiResponse<ApiDiffResponse>> updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody StatusUpdateRequest request) {
        ApiDiffResponse response = apiDiffService.updateStatus(id, request);
        return ResponseEntity.ok(ApiResponse.success("状态更新成功", response));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteDiffRecord(
            @PathVariable Long id,
            @RequestParam(required = false) String operatedBy) {
        apiDiffService.deleteDiffRecord(id, operatedBy);
        return ResponseEntity.ok(ApiResponse.success("删除成功", null));
    }

    @GetMapping("/{id}/logs")
    public ResponseEntity<ApiResponse<List<OperationLog>>> getOperationLogs(@PathVariable Long id) {
        List<OperationLog> logs = apiDiffService.getOperationLogs(id);
        return ResponseEntity.ok(ApiResponse.success(logs));
    }

    @PostMapping("/export")
    public ResponseEntity<byte[]> exportToCsv(@RequestBody DiffQueryRequest request) {
        byte[] csvData = apiDiffService.exportToCsv(request);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv; charset=UTF-8"));
        headers.setContentDispositionFormData("attachment", "api_diff_records.csv");
        headers.setContentLength(csvData.length);

        return ResponseEntity.ok()
                .headers(headers)
                .body(csvData);
    }

    @GetMapping("/{id}/fields")
    public ResponseEntity<ApiResponse<List<DiffFieldDTO>>> getDiffFields(@PathVariable Long id) {
        List<DiffFieldDTO> fields = apiDiffService.getDiffFieldsByRecordId(id);
        return ResponseEntity.ok(ApiResponse.success(fields));
    }

    @PutMapping("/{id}/fields/attribution")
    public ResponseEntity<ApiResponse<DiffFieldDTO>> updateFieldAttribution(
            @PathVariable Long id,
            @Valid @RequestBody FieldAttributionRequest request) {
        DiffFieldDTO response = apiDiffService.updateFieldAttribution(id, request);
        return ResponseEntity.ok(ApiResponse.success("字段归因更新成功", response));
    }

    @PutMapping("/{id}/fields/attribution/batch")
    public ResponseEntity<ApiResponse<List<DiffFieldDTO>>> batchUpdateFieldAttribution(
            @PathVariable Long id,
            @Valid @RequestBody BatchFieldAttributionRequest request) {
        List<DiffFieldDTO> response = apiDiffService.batchUpdateFieldAttribution(id, request);
        return ResponseEntity.ok(ApiResponse.success("批量字段归因更新成功", response));
    }
}
