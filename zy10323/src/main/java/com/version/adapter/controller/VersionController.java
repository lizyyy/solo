package com.version.adapter.controller;

import com.version.adapter.dto.AdaptRequest;
import com.version.adapter.dto.AdaptResponse;
import com.version.adapter.entity.ClientVersion;
import com.version.adapter.entity.enums.VersionStatus;
import com.version.adapter.service.ClientVersionService;
import com.version.adapter.service.ResponseAdapterService;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/versions")
@RequiredArgsConstructor
@Slf4j
public class VersionController {

    private final ClientVersionService clientVersionService;
    private final ResponseAdapterService responseAdapterService;

    @PostMapping
    public ResponseEntity<ClientVersion> createVersion(
            @RequestBody ClientVersion version,
            @RequestHeader(value = "X-Operator", defaultValue = "system") String operator) {
        ClientVersion created = clientVersionService.createClientVersion(version, operator);
        return ResponseEntity.ok(created);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ClientVersion> getVersionById(@PathVariable Long id) {
        ClientVersion version = clientVersionService.getById(id);
        return ResponseEntity.ok(version);
    }

    @GetMapping("/number/{versionNumber}")
    public ResponseEntity<ClientVersion> getVersionByNumber(@PathVariable String versionNumber) {
        ClientVersion version = clientVersionService.getByVersionNumber(versionNumber);
        return ResponseEntity.ok(version);
    }

    @GetMapping
    public ResponseEntity<List<ClientVersion>> getAllVersions() {
        List<ClientVersion> versions = clientVersionService.getAllVersions();
        return ResponseEntity.ok(versions);
    }

    @GetMapping("/status/{status}")
    public ResponseEntity<List<ClientVersion>> getVersionsByStatus(@PathVariable VersionStatus status) {
        List<ClientVersion> versions = clientVersionService.getVersionsByStatus(status);
        return ResponseEntity.ok(versions);
    }

    @GetMapping("/deprecated")
    public ResponseEntity<List<ClientVersion>> getDeprecatedVersions() {
        List<ClientVersion> versions = clientVersionService.getDeprecatedVersions();
        return ResponseEntity.ok(versions);
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<ClientVersion> updateStatus(
            @PathVariable Long id,
            @RequestParam VersionStatus status,
            @RequestParam(required = false) String remarks,
            @RequestHeader(value = "X-Operator", defaultValue = "system") String operator) {
        ClientVersion updated = clientVersionService.updateStatus(id, status, operator, remarks);
        return ResponseEntity.ok(updated);
    }

    @PutMapping("/{id}/deprecate")
    public ResponseEntity<ClientVersion> deprecateVersion(
            @PathVariable Long id,
            @RequestParam String reason,
            @RequestHeader(value = "X-Operator", defaultValue = "system") String operator) {
        ClientVersion updated = clientVersionService.deprecateVersion(id, reason, operator);
        return ResponseEntity.ok(updated);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ClientVersion> updateVersion(
            @PathVariable Long id,
            @RequestBody ClientVersion updateRequest,
            @RequestHeader(value = "X-Operator", defaultValue = "system") String operator) {
        ClientVersion updated = clientVersionService.updateVersion(id, updateRequest, operator);
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/adapt")
    public ResponseEntity<AdaptResponse> adaptResponse(@Valid @RequestBody AdaptRequest request) {
        log.info("收到适配请求: 版本={}, 端点={} {}",
                request.getClientVersion(), request.getHttpMethod(), request.getApiEndpoint());
        AdaptResponse response = responseAdapterService.adaptResponse(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/validate")
    public ResponseEntity<Map<String, Object>> validateVersion(
            @RequestParam String versionNumber,
            @RequestParam String apiEndpoint,
            @RequestParam String httpMethod) {
        try {
            ClientVersion version = clientVersionService.getByVersionNumber(versionNumber);
            Map<String, Object> result = new java.util.HashMap<>();
            result.put("valid", true);
            result.put("versionExists", true);
            result.put("isDeprecated", version.getIsDeprecated());
            result.put("status", version.getStatus());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> result = new java.util.HashMap<>();
            result.put("valid", false);
            result.put("versionExists", false);
            result.put("error", e.getMessage());
            return ResponseEntity.ok(result);
        }
    }
}
