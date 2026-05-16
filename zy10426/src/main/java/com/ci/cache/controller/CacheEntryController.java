package com.ci.cache.controller;

import com.ci.cache.dto.ApiResponse;
import com.ci.cache.model.CacheEntry;
import com.ci.cache.service.CacheEntryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/cache")
public class CacheEntryController {

    @Autowired
    private CacheEntryService cacheEntryService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<CacheEntry>>> getAllCacheEntries() {
        return ResponseEntity.ok(ApiResponse.success(cacheEntryService.getAllCacheEntries()));
    }

    @GetMapping("/active")
    public ResponseEntity<ApiResponse<List<CacheEntry>>> getActiveCacheEntries() {
        return ResponseEntity.ok(ApiResponse.success(cacheEntryService.getActiveCacheEntries()));
    }

    @GetMapping("/{cacheKey}")
    public ResponseEntity<ApiResponse<CacheEntry>> getCacheEntryByKey(@PathVariable String cacheKey) {
        return cacheEntryService.getCacheEntryByKey(cacheKey)
                .map(entry -> ResponseEntity.ok(ApiResponse.success(entry)))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/project/{projectName}")
    public ResponseEntity<ApiResponse<List<CacheEntry>>> getCacheEntriesByProject(@PathVariable String projectName) {
        return ResponseEntity.ok(ApiResponse.success(cacheEntryService.getCacheEntriesByProject(projectName)));
    }

    @GetMapping("/sorted/size")
    public ResponseEntity<ApiResponse<List<CacheEntry>>> getCacheEntriesSortedBySize() {
        return ResponseEntity.ok(ApiResponse.success(cacheEntryService.getCacheEntriesSortedBySize()));
    }

    @GetMapping("/sorted/hitcount")
    public ResponseEntity<ApiResponse<List<CacheEntry>>> getCacheEntriesSortedByHitCount() {
        return ResponseEntity.ok(ApiResponse.success(cacheEntryService.getCacheEntriesSortedByHitCount()));
    }

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getCacheStats() {
        long totalSize = cacheEntryService.getTotalActiveCacheSize();
        int count = cacheEntryService.getActiveCacheEntries().size();

        Map<String, Object> stats = Map.of(
                "totalActiveEntries", count,
                "totalSizeInBytes", totalSize,
                "totalSizeInMB", String.format("%.2f", totalSize / (1024.0 * 1024.0))
        );
        return ResponseEntity.ok(ApiResponse.success(stats));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<CacheEntry>> createCacheEntry(@RequestBody Map<String, Object> request) {
        String cacheKey = (String) request.get("cacheKey");
        String projectName = (String) request.get("projectName");
        Long sizeInBytes = Long.valueOf(request.get("sizeInBytes").toString());
        String description = (String) request.getOrDefault("description", "");

        CacheEntry entry = cacheEntryService.createCacheEntry(cacheKey, projectName, sizeInBytes, description);
        return ResponseEntity.ok(ApiResponse.success("Cache entry created", entry));
    }

    @PostMapping("/{cacheKey}/hit")
    public ResponseEntity<ApiResponse<Void>> recordCacheHit(@PathVariable String cacheKey) {
        cacheEntryService.recordCacheHit(cacheKey);
        return ResponseEntity.ok(ApiResponse.success("Cache hit recorded", null));
    }
}
