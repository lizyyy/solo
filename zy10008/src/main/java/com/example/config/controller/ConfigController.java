package com.example.config.controller;

import com.example.config.domain.ConfigItem;
import com.example.config.domain.ConfigRelease;
import com.example.config.service.ConfigService;
import com.example.config.service.EventLogService;
import com.example.config.service.PushService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/config")
@RequiredArgsConstructor
public class ConfigController {

    private final ConfigService configService;
    private final PushService pushService;
    private final EventLogService eventLogService;

    @GetMapping("/{namespace}/{key}")
    public ResponseEntity<ConfigItem> getConfig(@PathVariable String namespace, @PathVariable String key) {
        return configService.getConfig(namespace, key)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{namespace}")
    public ResponseEntity<List<ConfigItem>> getConfigsByNamespace(@PathVariable String namespace) {
        return ResponseEntity.ok(configService.getConfigsByNamespace(namespace));
    }

    @PostMapping("")
    public ResponseEntity<ConfigItem> createConfig(@Valid @RequestBody CreateConfigRequest request) {
        ConfigItem config = configService.createConfig(
                request.getNamespace(),
                request.getKey(),
                request.getValue(),
                request.getDescription(),
                request.getOperator()
        );
        return ResponseEntity.ok(config);
    }

    @PutMapping("/{namespace}/{key}")
    public ResponseEntity<ConfigItem> updateConfig(
            @PathVariable String namespace,
            @PathVariable String key,
            @Valid @RequestBody UpdateConfigRequest request) {
        ConfigItem config = configService.updateConfig(
                namespace,
                key,
                request.getValue(),
                request.getDescription(),
                request.getOperator()
        );
        return ResponseEntity.ok(config);
    }

    @PostMapping("/{namespace}/{key}/publish")
    public ResponseEntity<ConfigRelease> publishConfig(
            @PathVariable String namespace,
            @PathVariable String key,
            @RequestBody(required = false) Map<String, String> body) {
        String operator = body != null ? body.get("operator") : "system";
        ConfigRelease release = configService.publishConfig(namespace, key, operator);
        pushService.startPush(release.getReleaseId());
        return ResponseEntity.ok(release);
    }

    @GetMapping("/releases/{releaseId}")
    public ResponseEntity<ConfigRelease> getRelease(@PathVariable String releaseId) {
        return configService.getRelease(releaseId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/releases")
    public ResponseEntity<List<ConfigRelease>> getReleases(
            @RequestParam(required = false) String namespace,
            @RequestParam(required = false) String key,
            @RequestParam(required = false) LocalDateTime from,
            @RequestParam(required = false) LocalDateTime to) {

        if (from != null && to != null) {
            return ResponseEntity.ok(configService.getReleasesByTimeRange(from, to));
        }
        if (namespace != null && key != null) {
            return ResponseEntity.ok(configService.getReleasesByConfig(namespace, key));
        }
        return ResponseEntity.ok(configService.getPendingOrInProgressReleases());
    }

    @GetMapping("/releases/{releaseId}/push-status")
    public ResponseEntity<List<?>> getPushStatuses(@PathVariable String releaseId) {
        return ResponseEntity.ok(pushService.getPushStatusesByRelease(releaseId));
    }

    @lombok.Data
    public static class CreateConfigRequest {
        @NotBlank
        private String namespace;
        @NotBlank
        private String key;
        @NotBlank
        private String value;
        private String description;
        private String operator = "system";
    }

    @lombok.Data
    public static class UpdateConfigRequest {
        @NotBlank
        private String value;
        private String description;
        private String operator = "system";
    }
}
