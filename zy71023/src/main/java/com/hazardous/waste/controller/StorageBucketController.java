package com.hazardous.waste.controller;

import com.hazardous.waste.dto.ApiResponse;
import com.hazardous.waste.entity.StorageBucket;
import com.hazardous.waste.service.StorageBucketService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/buckets")
public class StorageBucketController {

    private StorageBucketService storageBucketService;

    @PostMapping
    public ApiResponse<StorageBucket> createBucket(@RequestBody StorageBucket bucket) {
        return ApiResponse.success(storageBucketService.createBucket(bucket));
    }

    @GetMapping
    public ApiResponse<List<StorageBucket>> getAllBuckets() {
        return ApiResponse.success(storageBucketService.getAllBuckets());
    }

    @GetMapping("/active")
    public ApiResponse<List<StorageBucket>> getActiveBuckets() {
        return ApiResponse.success(storageBucketService.getActiveBuckets());
    }

    @GetMapping("/category/{category}")
    public ApiResponse<List<StorageBucket>> getBucketsByCategory(@PathVariable String category) {
        return ApiResponse.success(storageBucketService.getBucketsByCategory(category));
    }

    @GetMapping("/{bucketCode}")
    public ApiResponse<StorageBucket> getBucketByCode(@PathVariable String bucketCode) {
        return ApiResponse.success(storageBucketService.getBucketByCode(bucketCode));
    }

    @PutMapping("/{bucketCode}")
    public ApiResponse<StorageBucket> updateBucket(
            @PathVariable String bucketCode,
            @RequestBody StorageBucket bucket) {
        return ApiResponse.success(storageBucketService.updateBucket(bucketCode, bucket));
    }

    @PostMapping("/{bucketCode}/deactivate")
    public ApiResponse<Void> deactivateBucket(@PathVariable String bucketCode) {
        storageBucketService.deactivateBucket(bucketCode);
        return ApiResponse.success();
    }
}
