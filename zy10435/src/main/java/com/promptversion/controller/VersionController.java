package com.promptversion.controller;

import com.promptversion.dto.ApiResponse;
import com.promptversion.dto.CreateVersionRequest;
import com.promptversion.dto.RollbackRequest;
import com.promptversion.entity.RollbackEvent;
import com.promptversion.entity.TemplateVersion;
import com.promptversion.service.VersionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/versions")
public class VersionController {

    @Autowired
    private VersionService versionService;

    @PostMapping
    public ApiResponse<TemplateVersion> createVersion(@Valid @RequestBody CreateVersionRequest request) {
        return ApiResponse.success(versionService.createVersion(request));
    }

    @PostMapping("/{id}/publish")
    public ApiResponse<TemplateVersion> publishVersion(@PathVariable Long id) {
        return ApiResponse.success(versionService.publishVersion(id));
    }

    @PostMapping("/{id}/activate")
    public ApiResponse<TemplateVersion> activateVersion(@PathVariable Long id) {
        return ApiResponse.success(versionService.activateVersion(id));
    }

    @PutMapping("/{id}/traffic")
    public ApiResponse<TemplateVersion> updateTraffic(@PathVariable Long id, @RequestParam BigDecimal percentage) {
        return ApiResponse.success(versionService.updateTraffic(id, percentage));
    }

    @PostMapping("/rollback")
    public ApiResponse<RollbackEvent> rollback(@Valid @RequestBody RollbackRequest request) {
        return ApiResponse.success(versionService.rollback(request));
    }

    @GetMapping("/template/{templateId}")
    public ApiResponse<List<TemplateVersion>> getVersionsByTemplate(@PathVariable Long templateId) {
        return ApiResponse.success(versionService.getVersionsByTemplateId(templateId));
    }

    @GetMapping("/template/{templateId}/active")
    public ApiResponse<List<TemplateVersion>> getActiveVersions(@PathVariable Long templateId) {
        return ApiResponse.success(versionService.getActiveVersions(templateId));
    }

    @GetMapping("/{id}")
    public ApiResponse<TemplateVersion> getVersionById(@PathVariable Long id) {
        return ApiResponse.success(versionService.getVersionById(id));
    }

    @GetMapping("/template/{templateId}/select")
    public ApiResponse<TemplateVersion> selectVersionByTraffic(
            @PathVariable Long templateId,
            @RequestParam String userId) {
        return ApiResponse.success(versionService.selectVersionByTraffic(templateId, userId));
    }
}