package com.forklift.controller;

import com.forklift.common.Result;
import com.forklift.entity.WorkWave;
import com.forklift.service.WorkWaveService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/waves")
public class WorkWaveController {

    @Autowired
    private WorkWaveService waveService;

    @GetMapping
    public Result<List<WorkWave>> getAllWaves() {
        return Result.success(waveService.getAllWaves());
    }

    @GetMapping("/active")
    public Result<List<WorkWave>> getActiveWaves() {
        return Result.success(waveService.getActiveWaves());
    }

    @GetMapping("/{id}")
    public Result<WorkWave> getById(@PathVariable Long id) {
        return Result.success(waveService.getById(id));
    }

    @GetMapping("/code/{code}")
    public Result<WorkWave> getByCode(@PathVariable String code) {
        return Result.success(waveService.getByWaveCode(code));
    }

    @PostMapping
    public Result<WorkWave> create(@RequestBody WorkWave wave) {
        return Result.success(waveService.create(wave));
    }

    @PutMapping("/{id}")
    public Result<WorkWave> update(@PathVariable Long id, 
                                   @RequestBody WorkWave wave,
                                   @RequestHeader(value = "X-Operator", defaultValue = "admin") String operator) {
        return Result.success(waveService.update(id, wave, operator));
    }

    @PostMapping("/{id}/status")
    public Result<Void> updateStatus(@PathVariable Long id,
                                     @RequestParam String status,
                                     @RequestParam String reason,
                                     @RequestHeader(value = "X-Operator", defaultValue = "admin") String operator) {
        waveService.updateStatus(id, status, operator, reason);
        return Result.success();
    }
}
