package com.floodrelief.controller;

import com.floodrelief.dto.ApiResponse;
import com.floodrelief.entity.MaterialBatch;
import com.floodrelief.service.MaterialBatchService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/material-batches")
@RequiredArgsConstructor
public class MaterialBatchController {
    private final MaterialBatchService materialBatchService;

    @GetMapping
    public ApiResponse<List<MaterialBatch>> getAllMaterialBatches() {
        return materialBatchService.getAllMaterialBatches();
    }

    @GetMapping("/type/{type}")
    public ApiResponse<List<MaterialBatch>> getMaterialBatchesByType(@PathVariable String type) {
        return materialBatchService.getMaterialBatchesByType(type);
    }

    @GetMapping("/{id}")
    public ApiResponse<MaterialBatch> getMaterialBatchById(@PathVariable Long id) {
        return materialBatchService.getMaterialBatchById(id);
    }

    @PostMapping
    public ApiResponse<MaterialBatch> createMaterialBatch(@Valid @RequestBody MaterialBatch batch) {
        return materialBatchService.createMaterialBatch(batch);
    }
}
