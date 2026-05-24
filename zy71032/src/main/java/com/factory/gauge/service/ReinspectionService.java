package com.factory.gauge.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.factory.gauge.dto.request.ReinspectionRequest;
import com.factory.gauge.entity.ProductBatch;
import com.factory.gauge.entity.ReinspectionRecord;
import com.factory.gauge.entity.enums.BatchStatus;
import com.factory.gauge.entity.enums.ReinspectionResult;
import com.factory.gauge.exception.BusinessException;
import com.factory.gauge.repository.ReinspectionRecordRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class ReinspectionService {


    private static final Logger log = LoggerFactory.getLogger(ReinspectionService.class);
    private final ReinspectionRecordRepository reinspectionRecordRepository;

    public ReinspectionService(ReinspectionRecordRepository reinspectionRecordRepository, ProductBatchService productBatchService, StateMachineService stateMachineService) {
        this.reinspectionRecordRepository = reinspectionRecordRepository;
        this.productBatchService = productBatchService;
        this.stateMachineService = stateMachineService;
    }
    private final ProductBatchService productBatchService;
    private final StateMachineService stateMachineService;

    @Transactional
    public ReinspectionRecord recordReinspection(ReinspectionRequest request) {
        ProductBatch batch = productBatchService.getBatchByBatchNo(request.getBatchNo());

        if (batch.getStatus() != BatchStatus.LOCKED && batch.getStatus() != BatchStatus.REINSPECTED) {
            throw new BusinessException("只有锁定或已复检状态的批次才能进行复检");
        }

        ReinspectionRecord record = new ReinspectionRecord();
        record.setBatchId(batch.getId());
        record.setBatchNo(batch.getBatchNo());
        record.setToolId(batch.getToolId());
        record.setToolNo(batch.getToolNo());
        record.setResult(request.getResult());
        record.setInspectionDetail(request.getInspectionDetail());
        record.setDefectDescription(request.getDefectDescription());
        record.setInspector(request.getInspector());
        record.setRemarks(request.getRemarks());
        record.setCreatedBy(request.getOperator());
        record.setUpdatedBy(request.getOperator());

        stateMachineService.transitionBatchStatus(batch, BatchStatus.REINSPECTED, request.getOperator());

        return reinspectionRecordRepository.save(record);
    }

    @Transactional
    public ReinspectionRecord correctRecord(Long recordId, String correctedBy, String correctionRemark) {
        ReinspectionRecord record = reinspectionRecordRepository.findById(recordId)
                .orElseThrow(() -> new BusinessException("复检记录不存在"));

        if (record.getIsCorrected()) {
            throw new BusinessException("该记录已被修正过");
        }

        record.setCorrectedBy(correctedBy);
        record.setCorrectionTime(LocalDateTime.now());
        record.setCorrectionRemark(correctionRemark);
        record.setIsCorrected(true);
        record.setUpdatedBy(correctedBy);

        return reinspectionRecordRepository.save(record);
    }

    @Transactional
    public void unlockBatchAfterReinspection(String batchNo, String operator) {
        ProductBatch batch = productBatchService.getBatchByBatchNo(batchNo);
        
        Optional<ReinspectionRecord> latestRecord = reinspectionRecordRepository.findTopByBatchIdOrderByCreatedAtDesc(batch.getId());
        
        if (latestRecord.isEmpty()) {
            throw new BusinessException("该批次没有复检记录，不能解锁");
        }

        ReinspectionResult result = latestRecord.get().getResult();
        if (result == ReinspectionResult.FAILED) {
            throw new BusinessException("复检结果为不合格，不能解锁批次");
        }

        productBatchService.unlockBatch(batchNo, operator);
    }

    public ReinspectionRecord getRecordById(Long id) {
        return reinspectionRecordRepository.findById(id)
                .orElseThrow(() -> new BusinessException("复检记录不存在"));
    }

    public List<ReinspectionRecord> getRecordsByBatchNo(String batchNo) {
        return reinspectionRecordRepository.findByBatchNo(batchNo);
    }

    public List<ReinspectionRecord> getRecordsByToolNo(String toolNo) {
        return reinspectionRecordRepository.findByToolNo(toolNo);
    }

    public List<ReinspectionRecord> getAllRecords() {
        return reinspectionRecordRepository.findAll();
    }

    public Optional<ReinspectionRecord> getLatestRecordByBatchId(Long batchId) {
        return reinspectionRecordRepository.findTopByBatchIdOrderByCreatedAtDesc(batchId);
    }

    public Long countCorrectedRecordsByBatchId(Long batchId) {
        return reinspectionRecordRepository.countCorrectedRecordsByBatchId(batchId);
    }
}
