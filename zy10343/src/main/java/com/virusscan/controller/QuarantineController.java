package com.virusscan.controller;

import com.virusscan.dto.ApiResponse;
import com.virusscan.dto.ReleaseFileRequest;
import com.virusscan.entity.Quarantine;
import com.virusscan.entity.ReleaseCertificate;
import com.virusscan.service.ScanTaskService;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/quarantines")
@RequiredArgsConstructor
public class QuarantineController {

    private final ScanTaskService scanTaskService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<Quarantine>>> getQuarantinedFiles() {
        List<Quarantine> quarantines = scanTaskService.getQuarantinedFiles();
        return ResponseEntity.ok(ApiResponse.success(quarantines));
    }

    @GetMapping("/{quarantineId}")
    public ResponseEntity<ApiResponse<Quarantine>> getQuarantineById(@PathVariable String quarantineId) {
        Quarantine quarantine = scanTaskService.getQuarantineByQuarantineId(quarantineId);
        return ResponseEntity.ok(ApiResponse.success(quarantine));
    }

    @PostMapping("/release")
    public ResponseEntity<ApiResponse<ReleaseCertificate>> releaseFile(
            @Valid @RequestBody ReleaseFileRequest request) {
        log.info("放行隔离文件: fileId={}, quarantineId={}", request.getFileId(), request.getQuarantineId());
        ReleaseCertificate certificate = scanTaskService.releaseFile(request);
        return ResponseEntity.ok(ApiResponse.success("放行成功", certificate));
    }
}