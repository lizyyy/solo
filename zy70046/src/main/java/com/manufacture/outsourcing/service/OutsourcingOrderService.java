package com.manufacture.outsourcing.service;

import com.manufacture.outsourcing.dto.OutsourcingOrderRequest;
import com.manufacture.outsourcing.entity.OperationLog;
import com.manufacture.outsourcing.entity.OutsourcingOrder;
import com.manufacture.outsourcing.entity.Supplier;
import com.manufacture.outsourcing.exception.BusinessException;
import com.manufacture.outsourcing.repository.OutsourcingOrderRepository;
import com.manufacture.outsourcing.repository.SupplierRepository;
import com.manufacture.outsourcing.util.NoGenerator;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Service
public class OutsourcingOrderService {

    private final OutsourcingOrderRepository orderRepository;
    private final SupplierRepository supplierRepository;
    private final OperationLogService logService;

    public OutsourcingOrderService(OutsourcingOrderRepository orderRepository,
                                    SupplierRepository supplierRepository,
                                    OperationLogService logService) {
        this.orderRepository = orderRepository;
        this.supplierRepository = supplierRepository;
        this.logService = logService;
    }

    @Transactional
    public OutsourcingOrder create(OutsourcingOrderRequest request) {
        Supplier supplier = supplierRepository.findById(request.getSupplierId())
                .orElseThrow(() -> BusinessException.notFound("供应商不存在"));

        OutsourcingOrder order = new OutsourcingOrder();
        order.setOrderNo(NoGenerator.generateOrderNo());
        order.setSupplier(supplier);
        order.setProductCode(request.getProductCode());
        order.setProductName(request.getProductName());
        order.setOrderQuantity(request.getOrderQuantity());
        order.setUnitPrice(request.getUnitPrice());
        order.setTotalAmount(request.getOrderQuantity().multiply(request.getUnitPrice()));
        order.setOrderDate(request.getOrderDate());
        order.setDeliveryDeadline(request.getDeliveryDeadline());
        order.setRemark(request.getRemark());
        order.setOrderStatus(OutsourcingOrder.STATUS_DRAFT);
        order.setDeliveredQuantity(BigDecimal.ZERO);
        order.setQualifiedQuantity(BigDecimal.ZERO);
        order.setUnqualifiedQuantity(BigDecimal.ZERO);
        order.setReplenishmentQuantity(BigDecimal.ZERO);
        order.setDeductionAmount(BigDecimal.ZERO);

        OutsourcingOrder saved = orderRepository.save(order);

        logService.logSuccess(
                OperationLog.ENTITY_ORDER,
                saved.getId(),
                saved.getOrderNo(),
                OperationLog.ACTION_CREATE,
                null,
                saved.getOrderStatus(),
                "创建外协订单 " + saved.getOrderNo(),
                null,
                saved
        );

        return saved;
    }

    @Transactional
    public OutsourcingOrder confirm(Long id) {
        OutsourcingOrder order = getById(id);
        String oldStatus = order.getOrderStatus();

        if (!OutsourcingOrder.STATUS_DRAFT.equals(oldStatus)) {
            throw BusinessException.badRequest("只有草稿状态的订单才能确认");
        }

        order.setOrderStatus(OutsourcingOrder.STATUS_CONFIRMED);
        OutsourcingOrder saved = orderRepository.save(order);

        logService.logSuccess(
                OperationLog.ENTITY_ORDER,
                saved.getId(),
                saved.getOrderNo(),
                OperationLog.ACTION_CONFIRM,
                oldStatus,
                saved.getOrderStatus(),
                "确认外协订单 " + saved.getOrderNo(),
                null,
                saved
        );

        return saved;
    }

    @Transactional
    public OutsourcingOrder close(Long id) {
        OutsourcingOrder order = getById(id);
        String oldStatus = order.getOrderStatus();

        if (OutsourcingOrder.STATUS_CLOSED.equals(oldStatus)) {
            throw BusinessException.badRequest("订单已经结案");
        }

        order.setOrderStatus(OutsourcingOrder.STATUS_CLOSED);
        OutsourcingOrder saved = orderRepository.save(order);

        logService.logSuccess(
                OperationLog.ENTITY_ORDER,
                saved.getId(),
                saved.getOrderNo(),
                OperationLog.ACTION_COMPLETE,
                oldStatus,
                saved.getOrderStatus(),
                "结案外协订单 " + saved.getOrderNo(),
                null,
                saved
        );

        return saved;
    }

    public OutsourcingOrder getById(Long id) {
        return orderRepository.findById(id)
                .orElseThrow(() -> BusinessException.notFound("外协订单不存在"));
    }

    public OutsourcingOrder getByOrderNo(String orderNo) {
        return orderRepository.findByOrderNo(orderNo)
                .orElseThrow(() -> BusinessException.notFound("外协订单不存在"));
    }

    public Page<OutsourcingOrder> findAll(Pageable pageable) {
        return orderRepository.findAll(pageable);
    }

    @Transactional
    public void updateOrderStatistics(Long orderId) {
        OutsourcingOrder order = getById(orderId);
        orderRepository.save(order);
    }
}
