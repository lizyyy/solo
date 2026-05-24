package com.factory.gauge.service;

import com.factory.gauge.entity.MeasuringTool;
import com.factory.gauge.entity.ProductBatch;
import com.factory.gauge.entity.enums.BatchStatus;
import com.factory.gauge.entity.enums.GaugeStatus;
import com.factory.gauge.exception.BusinessException;
import org.springframework.stereotype.Service;

@Service
public class StateMachineService {

    public void validateGaugeStatusTransition(MeasuringTool gauge, GaugeStatus targetStatus) {
        GaugeStatus currentStatus = gauge.getStatus();
        
        switch (currentStatus) {
            case NORMAL:
                if (targetStatus != GaugeStatus.EXPIRED && 
                    targetStatus != GaugeStatus.DEACTIVATED && 
                    targetStatus != GaugeStatus.CALIBRATING) {
                    throw new BusinessException("正常状态只能转为过期、停用或校准中");
                }
                break;
            case EXPIRED:
                if (targetStatus != GaugeStatus.NORMAL && 
                    targetStatus != GaugeStatus.DEACTIVATED && 
                    targetStatus != GaugeStatus.CALIBRATING) {
                    throw new BusinessException("过期状态只能转为正常、停用或校准中");
                }
                break;
            case DEACTIVATED:
                if (targetStatus != GaugeStatus.NORMAL && targetStatus != GaugeStatus.CALIBRATING) {
                    throw new BusinessException("停用状态只能转为正常或校准中");
                }
                break;
            case CALIBRATING:
                if (targetStatus != GaugeStatus.NORMAL && targetStatus != GaugeStatus.DEACTIVATED) {
                    throw new BusinessException("校准中状态只能转为正常或停用");
                }
                break;
        }
    }

    public void validateBatchStatusTransition(ProductBatch batch, BatchStatus targetStatus) {
        BatchStatus currentStatus = batch.getStatus();
        
        switch (currentStatus) {
            case NORMAL:
                if (targetStatus != BatchStatus.LOCKED && targetStatus != BatchStatus.CLOSED) {
                    throw new BusinessException("正常状态只能转为锁定或关闭");
                }
                break;
            case LOCKED:
                if (targetStatus != BatchStatus.REINSPECTED && targetStatus != BatchStatus.UNLOCKED) {
                    throw new BusinessException("锁定状态只能转为已复检或已解锁");
                }
                break;
            case REINSPECTED:
                if (targetStatus != BatchStatus.UNLOCKED && targetStatus != BatchStatus.LOCKED && targetStatus != BatchStatus.REINSPECTED) {
                    throw new BusinessException("已复检状态只能转为已解锁、重新锁定或再次复检");
                }
                break;
            case UNLOCKED:
                if (targetStatus != BatchStatus.LOCKED && targetStatus != BatchStatus.CLOSED) {
                    throw new BusinessException("已解锁状态只能转为重新锁定或关闭");
                }
                break;
            case CLOSED:
                throw new BusinessException("已关闭状态不能再变更");
        }
    }

    public MeasuringTool transitionGaugeStatus(MeasuringTool gauge, GaugeStatus targetStatus, String operator) {
        validateGaugeStatusTransition(gauge, targetStatus);
        gauge.setStatus(targetStatus);
        gauge.setUpdatedBy(operator);
        return gauge;
    }

    public ProductBatch transitionBatchStatus(ProductBatch batch, BatchStatus targetStatus, String operator) {
        validateBatchStatusTransition(batch, targetStatus);
        batch.setStatus(targetStatus);
        batch.setUpdatedBy(operator);
        return batch;
    }
}
