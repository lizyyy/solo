package com.cityops.batterydispatch.controller;

import com.cityops.batterydispatch.dto.ApiResponse;
import com.cityops.batterydispatch.entity.*;
import com.cityops.batterydispatch.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/master")
@RequiredArgsConstructor
public class MasterDataController {
    private final AreaRepository areaRepository;
    private final ForbiddenLocationRepository forbiddenLocationRepository;
    private final VehicleRepository vehicleRepository;
    private final BatteryRepository batteryRepository;
    private final DispatcherRepository dispatcherRepository;

    @GetMapping("/areas")
    public ApiResponse<List<Area>> getAllAreas() {
        return ApiResponse.success(areaRepository.findAll());
    }

    @PostMapping("/areas")
    public ApiResponse<Area> createArea(@RequestBody Area area) {
        return ApiResponse.success(areaRepository.save(area));
    }

    @GetMapping("/forbidden-locations")
    public ApiResponse<List<ForbiddenLocation>> getAllForbiddenLocations() {
        return ApiResponse.success(forbiddenLocationRepository.findAll());
    }

    @PostMapping("/forbidden-locations")
    public ApiResponse<ForbiddenLocation> createForbiddenLocation(@RequestBody ForbiddenLocation location) {
        return ApiResponse.success(forbiddenLocationRepository.save(location));
    }

    @GetMapping("/vehicles")
    public ApiResponse<List<Vehicle>> getAllVehicles() {
        return ApiResponse.success(vehicleRepository.findAll());
    }

    @PostMapping("/vehicles")
    public ApiResponse<Vehicle> createVehicle(@RequestBody Vehicle vehicle) {
        return ApiResponse.success(vehicleRepository.save(vehicle));
    }

    @GetMapping("/batteries")
    public ApiResponse<List<Battery>> getAllBatteries() {
        return ApiResponse.success(batteryRepository.findAll());
    }

    @PostMapping("/batteries")
    public ApiResponse<Battery> createBattery(@RequestBody Battery battery) {
        return ApiResponse.success(batteryRepository.save(battery));
    }

    @GetMapping("/dispatchers")
    public ApiResponse<List<Dispatcher>> getAllDispatchers() {
        return ApiResponse.success(dispatcherRepository.findAll());
    }

    @PostMapping("/dispatchers")
    public ApiResponse<Dispatcher> createDispatcher(@RequestBody Dispatcher dispatcher) {
        return ApiResponse.success(dispatcherRepository.save(dispatcher));
    }
}
