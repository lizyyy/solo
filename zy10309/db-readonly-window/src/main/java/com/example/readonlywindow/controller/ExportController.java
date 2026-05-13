package com.example.readonlywindow.controller;

import com.example.readonlywindow.dto.WindowSummaryDTO;
import com.example.readonlywindow.service.ExportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/export")
@RequiredArgsConstructor
public class ExportController {
    private final ExportService exportService;

    @GetMapping("/window/{windowCode}/summary")
    public ResponseEntity<WindowSummaryDTO> exportWindowSummary(@PathVariable String windowCode) {
        return ResponseEntity.ok(exportService.exportWindowSummary(windowCode));
    }

    @GetMapping("/audit-report")
    public ResponseEntity<Map<String, Object>> exportFullAuditReport() {
        return ResponseEntity.ok(exportService.exportFullAuditReport());
    }
}
