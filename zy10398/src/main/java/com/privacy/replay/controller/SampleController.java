package com.privacy.replay.controller;

import com.privacy.replay.dto.ApiResponse;
import com.privacy.replay.model.UserSample;
import com.privacy.replay.service.UserSampleService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sample")
@RequiredArgsConstructor
public class SampleController {

    private final UserSampleService userSampleService;

    @GetMapping("/{sampleId}")
    public ApiResponse<UserSample> getSample(@PathVariable String sampleId) {
        UserSample result = userSampleService.getSampleBySampleId(sampleId);
        return ApiResponse.success(result);
    }

    @GetMapping("/user/{userId}")
    public ApiResponse<List<UserSample>> getUserSamples(@PathVariable String userId) {
        List<UserSample> result = userSampleService.getSamplesByUserId(userId);
        return ApiResponse.success(result);
    }

    @PostMapping("/create")
    public ApiResponse<UserSample> createSample(
            @RequestParam String userId,
            @RequestParam String dataType,
            @RequestParam String sampleData,
            @RequestParam(defaultValue = "50") Integer sensitivityScore) {
        UserSample result = userSampleService.createSample(userId, dataType, sampleData, sensitivityScore);
        return ApiResponse.success(result);
    }
}
