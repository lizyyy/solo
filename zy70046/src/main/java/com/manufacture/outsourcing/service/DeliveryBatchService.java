package com.manufacture.outsourcing.service;

import com.manufacture.outsourcing.dto.DeliveryBatchRequest;
import com.manufacture.outsourcing.entity.DeliveryBatch;
import com.manufacture.outsourcing.entity.OperationLog;
import com.manufacture.outsourcing.entity.OutsourcingOrder;
import com.manufacture.outsourcing.exception.BusinessException;
import com.manufacture.outsourcing.repository.DeliveryBatchRepository;
import com.manufacture.outsourcing.repository.OutsourcingOrderRepository;
import com.manufacture.outsourcing.util.NoGenerator;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Slf4j
@Service
public class DeliveryBatchService {

    private final DeliveryBatchRepository batchRepository;
    private final OutsourcingOrderRepository orderRepository;
    private final OperationLogService logService;

    public DeliveryBatchService(DeliveryBatchRepository batchRepository,
                                 OutsourcingOrderRepository orderRepository,
                                 OperationLogService logService) {
        this.batchRepository = batchRepository;
        this.orderRepository = orderRepository;
        this.logService = logService;
    }

    @Transactional
    public DeliveryBatch create(DeliveryBatchRequest request) {
        OutsourcingOrder order = orderRepository.findById(request.getOrderId())
                .orElseThrow(() -> BusinessException.notFound("外协订单不存在"));

        if (OutsourcingOrder.STATUS_DRAFT.equals(order.getOrderStatus())) {
            throw BusinessException.badRequest("订单处于草稿状态，请先确认订单");
        }

        if (OutsourcingOrder.STATUS_CLOSED.equals(order.getOrderStatus())) {
            throw BusinessException.badRequest("订单已结案，不能再到货");
        }

        DeliveryBatch batch = new DeliveryBatch();
        batch.setBatchNo(NoGenerator.generateBatchNo());
        batch.setOrder(order);
        batch.setDeliveryQuantity(request.getDeliveryQuantity());
        batch.setDeliveryDate(request.getDeliveryDate());
        batch.setDeliveryPerson(request.getDeliveryPerson());
        batch.setWaybillNo(request.getWaybillNo());
        batch.setRemark(request.getRemark());
        batch.setBatchStatus(DeliveryBatch.STATUS_PENDING);
        batch.setQualifiedQuantity(BigDecimal.ZERO);
        batch.setUnqualifiedQuantity(BigDecimal.ZERO);
        batch.setDeductionAmount(BigDecimal.ZERO);
        batch.setReplenishmentQuantity(BigDecimal.ZERO);

        DeliveryBatch saved = batchRepository.save(batch);

        updateOrderAfterDelivery(order, request.getDeliveryQuantity());

        logService.logSuccess(
                OperationLog.ENTITY_BATCH,
                saved.getId(),
                saved.getBatchNo(),
                OperationLog.ACTION_CREATE,
                null,
                saved.getBatchStatus(),
                "登记到货批次 " + saved.getBatchNo() + "，到货数量：" + request.getDeliveryQuantity(),
                null,
                saved
        );

        return saved;
    }

    @Transactional
    public void updateOrderAfterDelivery(OutsourcingOrder order, BigDecimal deliveryQuantity) {
        BigDecimal newDelivered = order.getDeliveredQuantity().add(deliveryQuantity);
        order.setDeliveredQuantity(newDelivered);

        if (newDelivered.compareTo(order.getOrderQuantity()) < 0) {
            order.setOrderStatus(OutsourcingOrder.STATUS_PARTIAL_DELIVERY);
        } else {
            order.setOrderStatus(OutsourcingOrder.STATUS_INSPECTION);
        }

        orderRepository.save(order);
    }

    @Transactional
    public DeliveryBatch startInspection(Long batchId) {
        DeliveryBatch batch = getById(batchId);
        String oldStatus = batch.getBatchStatus();

        if (!DeliveryBatch.STATUS_PENDING.equals(oldStatus) && 
            !DeliveryBatch.STATUS_INSPECTION_FAILED.equals(oldStatus)) {
            throw BusinessException.badRequest("当前批次状态不允许开始验收，当前状态：" + oldStatus);
        }

        batch.setBatchStatus(DeliveryBatch.STATUS_INSPECTION);
        DeliveryBatch saved = batchRepository.save(batch);

        logService.logSuccess(
                OperationLog.ENTITY_BATCH,
                saved.getId(),
                saved.getBatchNo(),
                "开始验收",
                oldStatus,
                saved.getBatchStatus(),
                "开始验收批次 " + saved.getBatchNo(),
                null,
                saved
        );

        return saved;
    }

    @Transactional
    public DeliveryBatch markInspectionFailed(Long batchId, String reason) {
        DeliveryBatch batch = getById(batchId);
        String oldStatus = batch.getBatchStatus();

        if (!DeliveryBatch.STATUS_INSPECTION.equals(oldStatus)) {
            throw BusinessException.badRequest("只有验收中的批次才能标记验收失败");
        }

        batch.setBatchStatus(DeliveryBatch.STATUS_INSPECTION_FAILED);
        batch.setProcessDescription("验收流程中断：" + reason);
        DeliveryBatch saved = batchRepository.save(batch);

        logService.logFailure(
                OperationLog.ENTITY_BATCH,
                saved.getId(),
                saved.getBatchNo(),
                "验收失败",
                oldStatus,
                saved.getBatchStatus(),
                "批次 " + saved.getBatchNo() + " 验收流程中断",
                null,
                saved,
                reason
        );

        return saved;
    }

    @Transactional
    public DeliveryBatch retryInspection(Long batchId) {
        DeliveryBatch batch = getById(batchId);
        String oldStatus = batch.getBatchStatus();

        if (!DeliveryBatch.STATUS_INSPECTION_FAILED.equals(oldStatus)) {
            throw BusinessException.badRequest("只有验收失败的批次才能重试验收");
        }

        batch.setBatchStatus(DeliveryBatch.STATUS_INSPECTION);
        String existingDesc = batch.getProcessDescription() != null ? batch.getProcessDescription() : "";
        batch.setProcessDescription(existingDesc + "；已发起重新验收");
        DeliveryBatch saved = batchRepository.save(batch);

        logService.logSuccess(
                OperationLog.ENTITY_BATCH,
                saved.getId(),
                saved.getBatchNo(),
                OperationLog.ACTION_RETRY,
                oldStatus,
                saved.getBatchStatus(),
                "重试批次 " + saved.getBatchNo() + " 的验收流程",
                null,
                saved
        );

        return saved;
    }

    @Transactional
    public void updateBatchAfterInspection(Long batchId, 
                                            BigDecimal qualifiedQuantity, 
                                            BigDecimal unqualifiedQuantity,
                                            BigDecimal deductionAmount,
                                            BigDecimal replenishmentQuantity) {
        DeliveryBatch batch = getById(batchId);
        
        batch.setQualifiedQuantity(qualifiedQuantity);
        batch.setUnqualifiedQuantity(unqualifiedQuantity);
        batch.setDeductionAmount(deductionAmount);
        batch.setReplenishmentQuantity(replenishmentQuantity);

        if (unqualifiedQuantity.compareTo(BigDecimal.ZERO) == 0) {
            batch.setBatchStatus(DeliveryBatch.STATUS_QUALIFIED);
        } else if (qualifiedQuantity.compareTo(BigDecimal.ZERO) == 0) {
            batch.setBatchStatus(DeliveryBatch.STATUS_UNQUALIFIED);
        } else {
            batch.setBatchStatus(DeliveryBatch.STATUS_PARTIAL_PASS);
        }

        batchRepository.save(batch);

        OutsourcingOrder order = batch.getOrder();
        order.setQualifiedQuantity(order.getQualifiedQuantity().add(qualifiedQuantity));
        order.setUnqualifiedQuantity(order.getUnqualifiedQuantity().add(unqualifiedQuantity));
        order.setDeductionAmount(order.getDeductionAmount().add(deductionAmount));
        orderRepository.save(order);
    }

    public DeliveryBatch getById(Long id) {
        return batchRepository.findById(id)
                .orElseThrow(() -> BusinessException.notFound("到货批次不存在"));
    }

    public List<DeliveryBatch> findByOrderId(Long orderId) {
        return batchRepository.findByOrderIdOrderByCreatedAtDesc(orderId);
    }

    public DeliveryBatch getByBatchNo(String batchNo) {
        return batchRepository.findByBatchNo(batchNo)
                .orElseThrow(() -> BusinessException.notFound("到货批次不存在"));
    }
}
