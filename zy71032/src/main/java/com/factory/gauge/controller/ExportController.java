package com.factory.gauge.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.factory.gauge.service.ExportService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/export")
public class ExportController {


    private static final Logger log = LoggerFactory.getLogger(ExportController.class);
    private final ExportService exportService;


    public ExportController(ExportService exportService) {
        this.exportService = exportService;
    }
    @GetMapping("/gauges")
    public ResponseEntity<byte[]> exportGauges() throws IOException {
        byte[] data = exportService.exportGauges();
        String fileName = exportService.generateExportFileName("量具清单");
        return createExcelResponse(data, fileName);
    }

    @GetMapping("/batches/gauge/{toolNo}")
    public ResponseEntity<byte[]> exportBatchesByToolNo(@PathVariable String toolNo) throws IOException {
        byte[] data = exportService.exportBatchesByToolNo(toolNo);
        String fileName = exportService.generateExportFileName("批次记录_" + toolNo);
        return createExcelResponse(data, fileName);
    }

    @GetMapping("/reinspections")
    public ResponseEntity<byte[]> exportReinspectionRecords(
            @RequestParam(required = false) String toolNo) throws IOException {
        byte[] data = exportService.exportReinspectionRecords(toolNo);
        String suffix = toolNo != null && !toolNo.isEmpty() ? "_" + toolNo : "";
        String fileName = exportService.generateExportFileName("复检记录" + suffix);
        return createExcelResponse(data, fileName);
    }

    @GetMapping("/traceability")
    public ResponseEntity<byte[]> exportFullTraceability(
            @RequestParam(required = false) String toolNo) throws IOException {
        byte[] data = exportService.exportFullTraceability(toolNo);
        String suffix = toolNo != null && !toolNo.isEmpty() ? "_" + toolNo : "";
        String fileName = exportService.generateExportFileName("全量追溯" + suffix);
        return createExcelResponse(data, fileName);
    }

    private ResponseEntity<byte[]> createExcelResponse(byte[] data, String fileName) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        String encodedFileName = new String(fileName.getBytes(StandardCharsets.UTF_8), StandardCharsets.ISO_8859_1);
        headers.setContentDispositionFormData("attachment", encodedFileName);
        return ResponseEntity.ok()
                .headers(headers)
                .body(data);
    }
}
