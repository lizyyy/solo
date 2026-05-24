package com.floodrelief.controller;

import com.floodrelief.dto.ApiResponse;
import com.floodrelief.entity.Shelter;
import com.floodrelief.service.ShelterService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/shelters")
@RequiredArgsConstructor
public class ShelterController {
    private final ShelterService shelterService;

    @GetMapping
    public ApiResponse<List<Shelter>> getAllShelters() {
        return shelterService.getAllShelters();
    }

    @GetMapping("/{id}")
    public ApiResponse<Shelter> getShelterById(@PathVariable Long id) {
        return shelterService.getShelterById(id);
    }

    @PostMapping
    public ApiResponse<Shelter> createShelter(@Valid @RequestBody Shelter shelter) {
        return shelterService.createShelter(shelter);
    }

    @PutMapping("/{id}")
    public ApiResponse<Shelter> updateShelter(@PathVariable Long id, @Valid @RequestBody Shelter shelter) {
        return shelterService.updateShelter(id, shelter);
    }
}
