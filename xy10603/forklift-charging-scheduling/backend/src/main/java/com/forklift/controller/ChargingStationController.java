package com.forklift.controller;

import com.forklift.common.Result;
import com.forklift.entity.ChargingStation;
import com.forklift.service.ChargingStationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/stations")
public class ChargingStationController {

    @Autowired
    private ChargingStationService stationService;

    @GetMapping
    public Result<List<ChargingStation>> getAllStations() {
        return Result.success(stationService.getAllStations());
    }

    @GetMapping("/available")
    public Result<List<ChargingStation>> getAvailableStations() {
        return Result.success(stationService.getAvailableStations());
    }

    @GetMapping("/{id}")
    public Result<ChargingStation> getById(@PathVariable Long id) {
        return Result.success(stationService.getById(id));
    }

    @PostMapping
    public Result<ChargingStation> create(@RequestBody ChargingStation station) {
        return Result.success(stationService.create(station));
    }

    @PutMapping("/{id}")
    public Result<ChargingStation> update(@PathVariable Long id, 
                                          @RequestBody ChargingStation station,
                                          @RequestHeader(value = "X-Operator", defaultValue = "admin") String operator) {
        return Result.success(stationService.update(id, station, operator));
    }

    @PostMapping("/{id}/mark-faulty")
    public Result<Void> markFaulty(@PathVariable Long id,
                                   @RequestParam String reason,
                                   @RequestHeader(value = "X-Operator", defaultValue = "admin") String operator) {
        stationService.markFaulty(id, operator, reason);
        return Result.success();
    }
}
