package com.factory.gauge.service;

import com.factory.gauge.dto.request.BatchRegisterRequest;
import com.factory.gauge.entity.MeasuringTool;
import com.factory.gauge.entity.ProductBatch;
import com.factory.gauge.entity.enums.BatchStatus;
import com.factory.gauge.entity.enums.GaugeStatus;
import com.factory.gauge.exception.BusinessException;
import com.factory.gauge.repository.ProductBatchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProductBatchService {

    private final ProductBatchRepository productBatchRepository;
    private final MeasuringToolService measuringToolService;
    private final StateMachineService stateMachineService;

    @Transactional
    public ProductBatch registerBatch(BatchRegisterRequest request) {
        if (productBatchRepository.existsByBatchNo(request.getBatchNo())) {
            throw new BusinessException("批次号已存在: " + request.getBatchNo());
        }

        MeasuringTool gauge = measuringToolService.getGaugeByToolNo(request.getToolNo());

        if (!gauge.isUsable()) {
            String reason = gauge.getStatus() == GaugeStatus.EXPIRED ? 
                    "量具已过期" : 
                    "量具状态异常: " + gauge.getStatus().getDisplayName();
            throw new BusinessException(reason + "，无法登记新批次");
        }

        ProductBatch batch = new ProductBatch();
        batch.setBatchNo(request.getBatchNo());
        batch.setProductName(request.getProductName());
        batch.setToolId(gauge.getId());
        batch.setToolNo(gauge.getToolNo());
        batch.setQuantity(request.getQuantity());
        batch.setProductionLine(request.getProductionLine());
        batch.setRemarks(request.getRemarks());
        batch.setCreatedBy(request.getOperator());
        batch.setUpdatedBy(request.getOperator());
        batch.setStatus(BatchStatus.NORMAL);

        return productBatchRepository.save(batch);
    }

    @Transactional
    public ProductBatch lockBatch(String batchNo, String lockReason, String operator) {
        ProductBatch batch = getBatchByBatchNo(batchNo);
        
        if (batch.getStatus() == BatchStatus.LOCKED) {
            throw new BusinessException("批次已处于锁定状态");
        }

        batch.setLockReason(lockReason);
        batch = stateMachineService.transitionBatchStatus(batch, BatchStatus.LOCKED, operator);
        return productBatchRepository.save(batch);
    }

    @Transactional
    public ProductBatch unlockBatch(String batchNo, String operator) {
        ProductBatch batch = getBatchByBatchNo(batchNo);
        
        if (batch.getStatus() != BatchStatus.REINSPECTED && batch.getStatus() != BatchStatus.LOCKED) {
            throw new BusinessException("只有已锁定或已复检状态才能解锁");
        }

        batch = stateMachineService.transitionBatchStatus(batch, BatchStatus.UNLOCKED, operator);
        return productBatchRepository.save(batch);
    }

    @Transactional
    public ProductBatch closeBatch(String batchNo, String operator) {
        ProductBatch batch = getBatchByBatchNo(batchNo);
        
        if (batch.getStatus() != BatchStatus.NORMAL && batch.getStatus() != BatchStatus.UNLOCKED) {
            throw new BusinessException("只有正常或已解锁状态才能关闭");
        }

        batch = stateMachineService.transitionBatchStatus(batch, BatchStatus.CLOSED, operator);
        return productBatchRepository.save(batch);
    }

    @Transactional
    public void lockBatchesByExpiredTool(String toolNo, String lockReason, String operator) {
        MeasuringTool gauge = measuringToolService.getGaugeByToolNo(toolNo);
        List<ProductBatch> batches = productBatchRepository.findByToolId(gauge.getId());

        for (ProductBatch batch : batches) {
            if (batch.getStatus() == BatchStatus.NORMAL || batch.getStatus() == BatchStatus.UNLOCKED) {
                batch.setLockReason(lockReason);
                batch = stateMachineService.transitionBatchStatus(batch, BatchStatus.LOCKED, operator);
                productBatchRepository.save(batch);
                log.info("批次 {} 因量具过期已被锁定", batch.getBatchNo());
            }
        }
    }

    public ProductBatch getBatchByBatchNo(String batchNo) {
        return productBatchRepository.findByBatchNo(batchNo)
                .orElseThrow(() -> new BusinessException("批次不存在: " + batchNo));
    }

    public List<ProductBatch> getAllBatches() {
        return productBatchRepository.findAll();
    }

    public List<ProductBatch> getBatchesByToolNo(String toolNo) {
        return productBatchRepository.findByToolNo(toolNo);
    }

    public List<ProductBatch> getLockedBatches() {
        return productBatchRepository.findByStatus(BatchStatus.LOCKED);
    }

    public List<ProductBatch> getLockedBatchesByToolId(Long toolId) {
        return productBatchRepository.findLockedBatchesByToolId(toolId);
    }
}
