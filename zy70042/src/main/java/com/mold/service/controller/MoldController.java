package com.mold.service.controller;

import com.mold.service.common.ApiResponse;
import com.mold.service.domain.entity.Mold;
import com.mold.service.domain.repository.MoldRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/molds")
@RequiredArgsConstructor
public class MoldController {
    
    private final MoldRepository moldRepository;
    
    @GetMapping
    public ApiResponse<List<Mold>> getAllMolds() {
        return ApiResponse.success(moldRepository.findAll());
    }
    
    @GetMapping("/{moldCode}")
    public ApiResponse<Mold> getMoldByCode(@PathVariable String moldCode) {
        return moldRepository.findByMoldCode(moldCode)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error(404, "模具不存在: " + moldCode));
    }
    
    @GetMapping("/status/warning")
    public ApiResponse<List<Mold>> getWarningMolds() {
        return ApiResponse.success(moldRepository.findWarningMolds());
    }
    
    @GetMapping("/status/expired")
    public ApiResponse<List<Mold>> getExpiredMolds() {
        return ApiResponse.success(moldRepository.findExpiredMolds());
    }
    
    @PostMapping
    public ApiResponse<Mold> createMold(@RequestBody Mold mold) {
        mold.setId(null);
        return ApiResponse.success(moldRepository.save(mold));
    }
    
    @PutMapping("/{moldCode}/threshold")
    public ApiResponse<Mold> updateThreshold(
            @PathVariable String moldCode,
            @RequestParam Long lifeThreshold,
            @RequestParam(required = false) Long warningThreshold) {
        return moldRepository.findByMoldCode(moldCode)
                .map(mold -> {
                    mold.setLifeThreshold(lifeThreshold);
                    if (warningThreshold != null) {
                        mold.setWarningThreshold(warningThreshold);
                    } else {
                        mold.setWarningThreshold((long) (lifeThreshold * 0.9));
                    }
                    return ApiResponse.success(moldRepository.save(mold));
                })
                .orElse(ApiResponse.error(404, "模具不存在: " + moldCode));
    }
    
    @PutMapping("/{moldCode}/status")
    public ApiResponse<Mold> updateStatus(
            @PathVariable String moldCode,
            @RequestParam Mold.MoldStatus status) {
        return moldRepository.findByMoldCode(moldCode)
                .map(mold -> {
                    mold.setStatus(status);
                    return ApiResponse.success(moldRepository.save(mold));
                })
                .orElse(ApiResponse.error(404, "模具不存在: " + moldCode));
    }
}
