package com.mold.service.service;

import com.mold.service.common.BusinessException;
import com.mold.service.domain.dto.StrokeRecordRequest;
import com.mold.service.domain.entity.*;
import com.mold.service.domain.repository.MoldRepository;
import com.mold.service.domain.repository.StrokeRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class StrokeRecordService {
    
    private final StrokeRecordRepository strokeRecordRepository;
    private final MoldRepository moldRepository;
    private final MoldLifeService moldLifeService;
    private final OperationHistoryService historyService;
    
    @Transactional
    public StrokeRecord recordStrokes(StrokeRecordRequest request, String operator) {
        Optional<StrokeRecord> existingRecord = strokeRecordRepository.findByBatchId(request.getBatchId());
        if (existingRecord.isPresent()) {
            log.info("批次 {} 已存在，返回已有记录（幂等处理）", request.getBatchId());
            return existingRecord.get();
        }
        
        Mold mold = moldRepository.findByMoldCode(request.getMoldCode())
                .orElseThrow(() -> new BusinessException("模具不存在: " + request.getMoldCode()));
        
        if (mold.getStatus() == Mold.MoldStatus.ARCHIVED) {
            throw new BusinessException("模具已归档，无法记录冲压");
        }
        
        Long currentAccumulated = getCurrentAccumulatedStrokes(mold);
        Long newAccumulated = currentAccumulated + request.getStrokeCount();
        
        StrokeRecord record = new StrokeRecord();
        record.setBatchId(request.getBatchId());
        record.setMoldId(mold.getId());
        record.setMoldCode(mold.getMoldCode());
        record.setStrokeCount(request.getStrokeCount());
        record.setAccumulatedStrokes(newAccumulated);
        record.setRecordTime(request.getRecordTime());
        record.setProductionLine(request.getProductionLine() != null ? request.getProductionLine() : mold.getProductionLine());
        record.setProductCode(request.getProductCode());
        record.setOperator(request.getOperator() != null ? request.getOperator() : operator);
        record.setRemark(request.getRemark());
        record.setStatus(StrokeRecord.RecordStatus.ACTIVE);
        record.setSource(StrokeRecord.RecordSource.valueOf(request.getSource()));
        record.setIsCompensated(false);
        record.setCreatedBy(operator);
        record.setUpdatedBy(operator);
        
        strokeRecordRepository.save(record);
        
        mold.setTotalStrokes(newAccumulated);
        mold.setUpdatedBy(operator);
        if (request.getProductionLine() != null) {
            mold.setProductionLine(request.getProductionLine());
        }
        if (request.getProductCode() != null) {
            mold.setCurrentProduct(request.getProductCode());
        }
        moldRepository.save(mold);
        
        historyService.recordSimpleHistory(
                "StrokeRecord", record.getId(), record.getBatchId(),
                OperationHistory.OperationType.CREATE,
                String.format("新增冲压记录: 批次=%s, 次数=%d, 累计=%d", 
                        record.getBatchId(), record.getStrokeCount(), record.getAccumulatedStrokes()),
                "冲压记录录入", operator, "operator"
        );
        
        log.info("冲压记录创建成功: 批次={}, 模具={}, 冲压次数={}, 累计次数={}",
                record.getBatchId(), mold.getMoldCode(), request.getStrokeCount(), newAccumulated);
        
        moldLifeService.checkMoldLifeAndCreateTask(mold, record, operator);
        
        return record;
    }
    
    @Transactional
    public StrokeRecord compensateRecord(String originalBatchId, Long newStrokeCount, 
                                          String newBatchId, String operator, String reason) {
        StrokeRecord originalRecord = strokeRecordRepository.findByBatchId(originalBatchId)
                .orElseThrow(() -> new BusinessException("原始记录不存在: " + originalBatchId));
        
        if (originalRecord.getStatus() != StrokeRecord.RecordStatus.ACTIVE) {
            throw new BusinessException("原始记录状态不允许补录");
        }
        
        originalRecord.setStatus(StrokeRecord.RecordStatus.COMPENSATED);
        originalRecord.setUpdatedBy(operator);
        strokeRecordRepository.save(originalRecord);
        
        Mold mold = moldRepository.findById(originalRecord.getMoldId())
                .orElseThrow(() -> new BusinessException("模具不存在"));
        
        Long difference = newStrokeCount - originalRecord.getStrokeCount();
        Long newAccumulated = mold.getTotalStrokes() + difference;
        
        StrokeRecord newRecord = new StrokeRecord();
        newRecord.setBatchId(newBatchId);
        newRecord.setMoldId(mold.getId());
        newRecord.setMoldCode(mold.getMoldCode());
        newRecord.setStrokeCount(newStrokeCount);
        newRecord.setAccumulatedStrokes(newAccumulated);
        newRecord.setRecordTime(originalRecord.getRecordTime());
        newRecord.setProductionLine(originalRecord.getProductionLine());
        newRecord.setProductCode(originalRecord.getProductCode());
        newRecord.setOperator(operator);
        newRecord.setRemark("补录记录，原批次: " + originalBatchId + "，原因: " + reason);
        newRecord.setStatus(StrokeRecord.RecordStatus.ACTIVE);
        newRecord.setSource(StrokeRecord.RecordSource.COMPENSATION);
        newRecord.setIsCompensated(true);
        newRecord.setOriginalBatchId(originalRecord.getId());
        newRecord.setCreatedBy(operator);
        newRecord.setUpdatedBy(operator);
        
        strokeRecordRepository.save(newRecord);
        
        mold.setTotalStrokes(newAccumulated);
        mold.setUpdatedBy(operator);
        moldRepository.save(mold);
        
        historyService.recordSimpleHistory(
                "StrokeRecord", originalRecord.getId(), originalRecord.getBatchId(),
                OperationHistory.OperationType.COMPENSATE,
                String.format("记录补录: 原批次=%s, 原次数=%d, 新批次=%s, 新次数=%d",
                        originalBatchId, originalRecord.getStrokeCount(), newBatchId, newStrokeCount),
                reason, operator, "operator"
        );
        
        if (difference > 0) {
            moldLifeService.checkMoldLifeAndCreateTask(mold, newRecord, operator);
        }
        
        log.info("冲压记录补录完成: 原批次={}, 新批次={}, 差异次数={}", 
                originalBatchId, newBatchId, difference);
        
        return newRecord;
    }
    
    @Transactional
    public void revokeRecord(String batchId, String operator, String reason) {
        StrokeRecord record = strokeRecordRepository.findByBatchId(batchId)
                .orElseThrow(() -> new BusinessException("记录不存在: " + batchId));
        
        if (record.getStatus() != StrokeRecord.RecordStatus.ACTIVE) {
            throw new BusinessException("只有活跃状态的记录可以撤回");
        }
        
        Mold mold = moldRepository.findById(record.getMoldId())
                .orElseThrow(() -> new BusinessException("模具不存在"));
        
        Long newAccumulated = mold.getTotalStrokes() - record.getStrokeCount();
        if (newAccumulated < 0) {
            newAccumulated = 0L;
        }
        
        record.setStatus(StrokeRecord.RecordStatus.REVOKED);
        record.setUpdatedBy(operator);
        strokeRecordRepository.save(record);
        
        mold.setTotalStrokes(newAccumulated);
        mold.setUpdatedBy(operator);
        moldRepository.save(mold);
        
        historyService.recordSimpleHistory(
                "StrokeRecord", record.getId(), record.getBatchId(),
                OperationHistory.OperationType.REVOKE,
                String.format("记录撤回: 批次=%s, 撤回次数=%d, 累计调整为=%d",
                        batchId, record.getStrokeCount(), newAccumulated),
                reason, operator, "operator"
        );
        
        log.info("冲压记录撤回完成: 批次={}, 撤回次数={}, 累计调整为={}",
                batchId, record.getStrokeCount(), newAccumulated);
    }
    
    private Long getCurrentAccumulatedStrokes(Mold mold) {
        Long maxFromRecords = strokeRecordRepository.findMaxAccumulatedStrokesByMoldId(mold.getId())
                .orElse(0L);
        
        Long maxFromMold = mold.getTotalStrokes() != null ? mold.getTotalStrokes() : 0L;
        
        return Math.max(maxFromRecords, maxFromMold);
    }
    
    public StrokeRecord getByBatchId(String batchId) {
        return strokeRecordRepository.findByBatchId(batchId).orElse(null);
    }
}
