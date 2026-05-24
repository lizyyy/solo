package com.dormitory.maintenance.controller;

import com.dormitory.maintenance.entity.ConstructionTeam;
import com.dormitory.maintenance.entity.DormBuilding;
import com.dormitory.maintenance.entity.QuietPeriod;
import com.dormitory.maintenance.service.MasterDataService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/master")
public class MasterDataController {

    @Autowired
    private MasterDataService masterDataService;

    @PostMapping("/buildings")
    public ResponseEntity<DormBuilding> createBuilding(@RequestBody DormBuilding building) {
        return ResponseEntity.ok(masterDataService.createBuilding(building));
    }

    @PutMapping("/buildings/{id}")
    public ResponseEntity<DormBuilding> updateBuilding(
            @PathVariable Long id,
            @RequestBody DormBuilding building) {
        return ResponseEntity.ok(masterDataService.updateBuilding(id, building));
    }

    @GetMapping("/buildings/{id}")
    public ResponseEntity<DormBuilding> getBuilding(@PathVariable Long id) {
        return ResponseEntity.ok(masterDataService.getBuilding(id));
    }

    @GetMapping("/buildings/code/{code}")
    public ResponseEntity<DormBuilding> getBuildingByCode(@PathVariable String code) {
        return ResponseEntity.ok(masterDataService.getBuildingByCode(code));
    }

    @GetMapping("/buildings")
    public ResponseEntity<List<DormBuilding>> getAllBuildings() {
        return ResponseEntity.ok(masterDataService.getAllBuildings());
    }

    @PostMapping("/teams")
    public ResponseEntity<ConstructionTeam> createTeam(@RequestBody ConstructionTeam team) {
        return ResponseEntity.ok(masterDataService.createTeam(team));
    }

    @PutMapping("/teams/{id}")
    public ResponseEntity<ConstructionTeam> updateTeam(
            @PathVariable Long id,
            @RequestBody ConstructionTeam team) {
        return ResponseEntity.ok(masterDataService.updateTeam(id, team));
    }

    @GetMapping("/teams/{id}")
    public ResponseEntity<ConstructionTeam> getTeam(@PathVariable Long id) {
        return ResponseEntity.ok(masterDataService.getTeam(id));
    }

    @GetMapping("/teams/code/{code}")
    public ResponseEntity<ConstructionTeam> getTeamByCode(@PathVariable String code) {
        return ResponseEntity.ok(masterDataService.getTeamByCode(code));
    }

    @GetMapping("/teams")
    public ResponseEntity<List<ConstructionTeam>> getAllTeams() {
        return ResponseEntity.ok(masterDataService.getAllTeams());
    }

    @PostMapping("/quiet-periods")
    public ResponseEntity<QuietPeriod> createQuietPeriod(@RequestBody QuietPeriod period) {
        return ResponseEntity.ok(masterDataService.createQuietPeriod(period));
    }

    @PutMapping("/quiet-periods/{id}")
    public ResponseEntity<QuietPeriod> updateQuietPeriod(
            @PathVariable Long id,
            @RequestBody QuietPeriod period) {
        return ResponseEntity.ok(masterDataService.updateQuietPeriod(id, period));
    }

    @DeleteMapping("/quiet-periods/{id}")
    public ResponseEntity<Void> deleteQuietPeriod(@PathVariable Long id) {
        masterDataService.deleteQuietPeriod(id);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/quiet-periods/{id}")
    public ResponseEntity<QuietPeriod> getQuietPeriod(@PathVariable Long id) {
        return ResponseEntity.ok(masterDataService.getQuietPeriod(id));
    }

    @GetMapping("/quiet-periods")
    public ResponseEntity<List<QuietPeriod>> getAllQuietPeriods() {
        return ResponseEntity.ok(masterDataService.getAllQuietPeriods());
    }
}
