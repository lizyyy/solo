package com.agri.dronespray.controller;

import com.agri.dronespray.entity.*;
import com.agri.dronespray.service.MasterDataService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/master")
public class MasterDataController {

    @Autowired
    private MasterDataService masterDataService;

    private static final String DEFAULT_OPERATOR = "admin";

    @PostMapping("/plots")
    public ResponseEntity<Plot> createPlot(@RequestBody Plot plot) {
        return ResponseEntity.ok(masterDataService.createPlot(plot, DEFAULT_OPERATOR));
    }

    @PutMapping("/plots/{id}/approve")
    public ResponseEntity<Plot> approvePlot(@PathVariable Long id) {
        return ResponseEntity.ok(masterDataService.approvePlot(id, DEFAULT_OPERATOR));
    }

    @GetMapping("/plots")
    public ResponseEntity<List<Plot>> getAllPlots() {
        return ResponseEntity.ok(masterDataService.getAllPlots());
    }

    @GetMapping("/plots/{id}")
    public ResponseEntity<Plot> getPlot(@PathVariable Long id) {
        Plot plot = masterDataService.getPlot(id);
        return plot != null ? ResponseEntity.ok(plot) : ResponseEntity.notFound().build();
    }

    @GetMapping("/plots/approved")
    public ResponseEntity<List<Plot>> getApprovedPlots() {
        return ResponseEntity.ok(masterDataService.getApprovedPlots());
    }

    @GetMapping("/plots/unapproved")
    public ResponseEntity<List<Plot>> getUnapprovedPlots() {
        return ResponseEntity.ok(masterDataService.getUnapprovedPlots());
    }

    @PostMapping("/drones")
    public ResponseEntity<Drone> createDrone(@RequestBody Drone drone) {
        return ResponseEntity.ok(masterDataService.createDrone(drone, DEFAULT_OPERATOR));
    }

    @GetMapping("/drones")
    public ResponseEntity<List<Drone>> getAllDrones() {
        return ResponseEntity.ok(masterDataService.getAllDrones());
    }

    @GetMapping("/drones/{id}")
    public ResponseEntity<Drone> getDrone(@PathVariable Long id) {
        Drone drone = masterDataService.getDrone(id);
        return drone != null ? ResponseEntity.ok(drone) : ResponseEntity.notFound().build();
    }

    @GetMapping("/drones/available")
    public ResponseEntity<List<Drone>> getAvailableDrones() {
        return ResponseEntity.ok(masterDataService.getAvailableDrones());
    }

    @PostMapping("/pesticides")
    public ResponseEntity<Pesticide> createPesticide(@RequestBody Pesticide pesticide) {
        return ResponseEntity.ok(masterDataService.createPesticide(pesticide, DEFAULT_OPERATOR));
    }

    @GetMapping("/pesticides")
    public ResponseEntity<List<Pesticide>> getAllPesticides() {
        return ResponseEntity.ok(masterDataService.getAllPesticides());
    }

    @GetMapping("/pesticides/{id}")
    public ResponseEntity<Pesticide> getPesticide(@PathVariable Long id) {
        Pesticide pesticide = masterDataService.getPesticide(id);
        return pesticide != null ? ResponseEntity.ok(pesticide) : ResponseEntity.notFound().build();
    }

    @PostMapping("/pesticide-batches")
    public ResponseEntity<PesticideBatch> createPesticideBatch(@RequestBody PesticideBatch batch) {
        return ResponseEntity.ok(masterDataService.createPesticideBatch(batch, DEFAULT_OPERATOR));
    }

    @GetMapping("/pesticide-batches")
    public ResponseEntity<List<PesticideBatch>> getAllPesticideBatches() {
        return ResponseEntity.ok(masterDataService.getAllPesticideBatches());
    }

    @GetMapping("/pesticide-batches/{id}")
    public ResponseEntity<PesticideBatch> getPesticideBatch(@PathVariable Long id) {
        PesticideBatch batch = masterDataService.getPesticideBatch(id);
        return batch != null ? ResponseEntity.ok(batch) : ResponseEntity.notFound().build();
    }

    @PostMapping("/weather-windows")
    public ResponseEntity<WeatherWindow> createWeatherWindow(@RequestBody WeatherWindow window) {
        return ResponseEntity.ok(masterDataService.createWeatherWindow(window, DEFAULT_OPERATOR));
    }

    @GetMapping("/weather-windows")
    public ResponseEntity<List<WeatherWindow>> getAllWeatherWindows() {
        return ResponseEntity.ok(masterDataService.getAllWeatherWindows());
    }

    @GetMapping("/weather-windows/{id}")
    public ResponseEntity<WeatherWindow> getWeatherWindow(@PathVariable Long id) {
        WeatherWindow window = masterDataService.getWeatherWindow(id);
        return window != null ? ResponseEntity.ok(window) : ResponseEntity.notFound().build();
    }

    @GetMapping("/weather-windows/area/{area}")
    public ResponseEntity<List<WeatherWindow>> getWeatherWindowsByArea(@PathVariable String area) {
        return ResponseEntity.ok(masterDataService.getWeatherWindowsByArea(area));
    }

    @PostMapping("/pilots")
    public ResponseEntity<Pilot> createPilot(@RequestBody Pilot pilot) {
        return ResponseEntity.ok(masterDataService.createPilot(pilot, DEFAULT_OPERATOR));
    }

    @GetMapping("/pilots")
    public ResponseEntity<List<Pilot>> getAllPilots() {
        return ResponseEntity.ok(masterDataService.getAllPilots());
    }

    @GetMapping("/pilots/{id}")
    public ResponseEntity<Pilot> getPilot(@PathVariable Long id) {
        Pilot pilot = masterDataService.getPilot(id);
        return pilot != null ? ResponseEntity.ok(pilot) : ResponseEntity.notFound().build();
    }

    @GetMapping("/pilots/active")
    public ResponseEntity<List<Pilot>> getActivePilots() {
        return ResponseEntity.ok(masterDataService.getActivePilots());
    }
}
