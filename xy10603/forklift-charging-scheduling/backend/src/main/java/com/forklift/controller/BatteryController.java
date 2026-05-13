package com.forklift.controller;

import com.forklift.common.Result;
import com.forklift.entity.Battery;
import com.forklift.service.BatteryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/batteries")
public class BatteryController {

    @Autowired
    private BatteryService batteryService;

    @GetMapping
    public Result<List<Battery>> getAllBatteries() {
        return Result.success(batteryService.getAllBatteries());
    }

    @GetMapping("/low")
    public Result<List<Battery>> getLowBatteries() {
        return Result.success(batteryService.getLowBatteries());
    }

    @GetMapping("/low-health")
    public Result<List<Battery>> getLowHealthBatteries() {
        return Result.success(batteryService.getLowHealthBatteries());
    }

    @GetMapping("/{id}")
    public Result<Battery> getById(@PathVariable Long id) {
        return Result.success(batteryService.getById(id));
    }

    @GetMapping("/code/{code}")
    public Result<Battery> getByCode(@PathVariable String code) {
        return Result.success(batteryService.getByBatteryCode(code));
    }

    @PostMapping
    public Result<Battery> create(@RequestBody Battery battery) {
        return Result.success(batteryService.create(battery));
    }

    @PutMapping("/{id}")
    public Result<Battery> update(@PathVariable Long id, 
                                  @RequestBody Battery battery,
                                  @RequestHeader(value = "X-Operator", defaultValue = "admin") String operator) {
        return Result.success(batteryService.update(id, battery, operator));
    }

    @PostMapping("/{id}/update-soc")
    public Result<Void> updateSoc(@PathVariable Long id,
                                  @RequestParam Integer newSoc,
                                  @RequestHeader(value = "X-Operator", defaultValue = "admin") String operator) {
        batteryService.updateSoc(id, newSoc, operator);
        return Result.success();
    }

    @PostMapping("/{id}/update-health")
    public Result<Void> updateHealthStatus(@PathVariable Long id,
                                           @RequestParam(required = false) String status,
                                           @RequestParam(required = false) Integer score,
                                           @RequestParam String reason,
                                           @RequestHeader(value = "X-Operator", defaultValue = "admin") String operator) {
        batteryService.updateHealthStatus(id, status, score, operator, reason);
        return Result.success();
    }
}
