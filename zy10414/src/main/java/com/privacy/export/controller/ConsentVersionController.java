package com.privacy.export.controller;

import com.privacy.export.dto.ApiResponse;
import com.privacy.export.entity.ConsentVersion;
import com.privacy.export.service.ConsentVersionService;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/v1/consent-versions")
@RequiredArgsConstructor
public class ConsentVersionController {

    private final ConsentVersionService consentVersionService;

    @PostMapping
    public ApiResponse<ConsentVersion> createConsentVersion(@Valid @RequestBody ConsentVersion request) {
        log.info("Received create consent version request: {}", request.getVersionCode());
        ConsentVersion result = consentVersionService.createConsentVersion(request);
        return ApiResponse.success(result);
    }

    @GetMapping("/{versionCode}")
    public ApiResponse<ConsentVersion> getConsentVersion(@PathVariable String versionCode) {
        log.info("Received get consent version request: {}", versionCode);
        ConsentVersion result = consentVersionService.getConsentVersion(versionCode);
        return ApiResponse.success(result);
    }

    @GetMapping("/active")
    public ApiResponse<List<ConsentVersion>> getActiveVersions() {
        log.info("Received get active consent versions request");
        List<ConsentVersion> result = consentVersionService.getAllActiveVersions();
        return ApiResponse.success(result);
    }

    @GetMapping
    public ApiResponse<List<ConsentVersion>> getAllVersions() {
        log.info("Received get all consent versions request");
        List<ConsentVersion> result = consentVersionService.getAllVersions();
        return ApiResponse.success(result);
    }
}
