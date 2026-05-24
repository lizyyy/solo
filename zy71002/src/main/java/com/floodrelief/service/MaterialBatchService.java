package com.floodrelief.service;

import com.floodrelief.dto.ApiResponse;
import com.floodrelief.entity.MaterialBatch;
import com.floodrelief.repository.MaterialBatchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class MaterialBatchService {
    private final MaterialBatchRepository materialBatchRepository;

    public ApiResponse<List<MaterialBatch>> getAllMaterialBatches() {
        List<MaterialBatch> batches = materialBatchRepository.findAll();
        return ApiResponse.success(batches);
    }

    public ApiResponse<List<MaterialBatch>> getMaterialBatchesByType(String type) {
        List<MaterialBatch> batches = materialBatchRepository.findByMaterialType(type);
        return ApiResponse.success(batches);
    }

    public ApiResponse<MaterialBatch> getMaterialBatchById(Long id) {
        return materialBatchRepository.findById(id)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error("物资批次不存在"));
    }

    public ApiResponse<MaterialBatch> createMaterialBatch(MaterialBatch batch) {
        if (batch.getBatchNo() == null || batch.getBatchNo().isEmpty()) {
            return ApiResponse.error("批次号不能为空");
        }
        if (materialBatchRepository.findByBatchNo(batch.getBatchNo()).isPresent()) {
            return ApiResponse.error("批次号已存在");
        }

        batch = materialBatchRepository.save(batch);
        log.info("创建物资批次: batchNo={}, materialName={}", batch.getBatchNo(), batch.getMaterialName());
        return ApiResponse.success("物资批次创建成功", batch);
    }
}
