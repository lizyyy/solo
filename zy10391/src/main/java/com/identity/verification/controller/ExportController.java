package com.identity.verification.controller;

import com.identity.verification.dto.ApiResponse;
import com.identity.verification.service.ExportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/export")
@RequiredArgsConstructor
public class ExportController {

    private final ExportService exportService;

    @GetMapping("/{taskId}/data")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getExportData(@PathVariable Long taskId) {
        return exportService.getExportData(taskId);
    }

    @GetMapping("/{taskId}/excel")
    public ResponseEntity<byte[]> exportExcel(@PathVariable Long taskId) throws Exception {
        byte[] excelData = exportService.exportToExcel(taskId);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
        headers.setContentDispositionFormData("attachment", "verification-" + taskId + ".xlsx");
        return ResponseEntity.ok()
                .headers(headers)
                .body(excelData);
    }
}
