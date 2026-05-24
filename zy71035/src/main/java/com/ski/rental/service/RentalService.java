package com.ski.rental.service;

import com.ski.rental.dto.*;
import com.ski.rental.enums.AuditAction;
import com.ski.rental.enums.DamageLevel;
import com.ski.rental.enums.RentalStatus;
import com.ski.rental.model.*;
import com.ski.rental.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class RentalService {
    private final RentalOrderRepository rentalOrderRepository;
    private final SnowboardRepository snowboardRepository;
    private final CustomerRepository customerRepository;
    private final ReturnInspectionRepository returnInspectionRepository;
    private final RentalStateMachine stateMachine;
    private final BindingValidationService validationService;
    private final AuditService auditService;

    public RentalService(RentalOrderRepository rentalOrderRepository,
                         SnowboardRepository snowboardRepository,
                         CustomerRepository customerRepository,
                         ReturnInspectionRepository returnInspectionRepository,
                         RentalStateMachine stateMachine,
                         BindingValidationService validationService,
                         AuditService auditService) {
        this.rentalOrderRepository = rentalOrderRepository;
        this.snowboardRepository = snowboardRepository;
        this.customerRepository = customerRepository;
        this.returnInspectionRepository = returnInspectionRepository;
        this.stateMachine = stateMachine;
        this.validationService = validationService;
        this.auditService = auditService;
    }

    private static final DateTimeFormatter ORDER_NO_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    @Transactional
    public ApiResponse<Map<String, Object>> batchSubmit(BatchSubmitRequest request) {
        String batchNo = request.getBatchNo() != null ? request.getBatchNo() :
            "BATCH" + LocalDateTime.now().format(ORDER_NO_FORMAT);

        List<Map<String, Object>> successResults = new ArrayList<>();
        List<Map<String, Object>> exceptionResults = new ArrayList<>();

        for (RentalSubmitRequest rental : request.getRentals()) {
            try {
                ApiResponse<RentalOrder> result = submitSingleRental(rental, batchNo, request.getOperator());
                if (result.isSuccess()) {
                    successResults.add(Map.of(
                        "orderNo", result.getData().getOrderNo(),
                        "status", result.getData().getStatus(),
                        "paramsValidated", result.getData().getParamsValidated()
                    ));
                } else {
                    exceptionResults.add(Map.of(
                        "customerId", rental.getCustomerId(),
                        "boardCode", rental.getBoardCode(),
                        "error", result.getMessage()
                    ));
                }
            } catch (Exception e) {
                exceptionResults.add(Map.of(
                    "customerId", rental.getCustomerId(),
                    "boardCode", rental.getBoardCode(),
                    "error", e.getMessage()
                ));
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("batchNo", batchNo);
        result.put("totalCount", request.getRentals().size());
        result.put("successCount", successResults.size());
        result.put("exceptionCount", exceptionResults.size());
        result.put("successOrders", successResults);
        result.put("exceptionOrders", exceptionResults);

        return ApiResponse.ok("批次提交完成", result);
    }

    @Transactional
    public ApiResponse<RentalOrder> submitSingleRental(RentalSubmitRequest request, String batchNo, String operator) {
        Customer customer = customerRepository.findByCustomerId(request.getCustomerId())
            .orElseThrow(() -> new RuntimeException("租客不存在: " + request.getCustomerId()));

        Snowboard snowboard = snowboardRepository.findByBoardCode(request.getBoardCode())
            .orElseThrow(() -> new RuntimeException("雪板不存在: " + request.getBoardCode()));

        if (isBoardCurrentlyRented(request.getBoardCode())) {
            auditService.logDuplicateAttempt(null, batchNo, AuditAction.DUPLICATE_ATTEMPT,
                operator, "雪板 " + request.getBoardCode() + " 重复出租拦截");
            return ApiResponse.error("雪板 " + request.getBoardCode() + " 正在出租中，无法重复出租");
        }

        if (!snowboard.getIsAvailable()) {
            return ApiResponse.error("雪板 " + request.getBoardCode() + " 当前不可用");
        }

        RentalOrder order = new RentalOrder();
        order.setOrderNo("ORD" + LocalDateTime.now().format(ORDER_NO_FORMAT) +
            String.format("%04d", new Random().nextInt(10000)));
        order.setBatchNo(batchNo);
        order.setCustomer(customer);
        order.setSnowboard(snowboard);
        order.setActualReleaseValue(request.getActualReleaseValue());
        order.setRentalFee(request.getRentalFee() != null ? request.getRentalFee() : BigDecimal.ZERO);
        order.setExpectedReturnTime(request.getExpectedReturnTime());
        order.setOperator(operator);
        order.setStatus(RentalStatus.PENDING_SUBMIT);

        order = rentalOrderRepository.save(order);

        auditService.logAudit(order.getOrderNo(), batchNo, AuditAction.SUBMIT,
            operator, RentalStatus.PENDING_SUBMIT.name(), RentalStatus.PENDING_SUBMIT.name(),
            "租赁单提交");

        return validateAndProcessOrder(order, operator);
    }

    private boolean isBoardCurrentlyRented(String boardCode) {
        List<RentalStatus> activeStatuses = Arrays.asList(
            RentalStatus.RENTED, RentalStatus.RETURN_PENDING,
            RentalStatus.RETURN_INSPECTING, RentalStatus.DAMAGE_FOUND,
            RentalStatus.DAMAGE_REVIEWING, RentalStatus.DAMAGE_CONFIRMED,
            RentalStatus.FEE_CHARGED
        );
        return rentalOrderRepository.existsBySnowboardBoardCodeAndStatusIn(boardCode, activeStatuses);
    }

    @Transactional
    public ApiResponse<RentalOrder> validateAndProcessOrder(RentalOrder order, String operator) {
        if (!stateMachine.canTransition(order.getStatus(), RentalStatus.PARAMS_VALIDATING)) {
            return ApiResponse.error(stateMachine.getInvalidTransitionMessage(
                order.getStatus(), RentalStatus.PARAMS_VALIDATING));
        }

        String beforeState = order.getStatus().name();
        order.setStatus(RentalStatus.PARAMS_VALIDATING);
        rentalOrderRepository.save(order);

        BindingSpec bindingSpec = order.getSnowboard().getBindingSpec();
        BindingValidationService.ValidationResult validationResult =
            validationService.validateBindingParams(
                order.getCustomer(), bindingSpec, order.getActualReleaseValue());

        order.setParamsValidated(validationResult.isValid());
        order.setParamsValidationNote(validationResult.getSummary());

        if (validationResult.isValid()) {
            order.setStatus(RentalStatus.RENTAL_READY);
        } else {
            order.setStatus(RentalStatus.PARAMS_MISMATCH);
            order.setIsException(true);
            order.setExceptionType("PARAMS_MISMATCH");
            order.setExceptionNote(validationResult.getSummary());
        }

        order = rentalOrderRepository.save(order);

        auditService.logAudit(order.getOrderNo(), order.getBatchNo(), AuditAction.PARAMS_CHECK,
            operator, beforeState, order.getStatus().name(), validationResult.getSummary());

        return ApiResponse.ok(order);
    }

    @Transactional
    public ApiResponse<RentalOrder> rentOut(String orderNo, String operator) {
        RentalOrder order = rentalOrderRepository.findByOrderNo(orderNo)
            .orElseThrow(() -> new RuntimeException("订单不存在: " + orderNo));

        if (order.getStatus() == RentalStatus.RENTED) {
            auditService.logDuplicateAttempt(orderNo, order.getBatchNo(), AuditAction.RENT_OUT,
                operator, "重复出租操作拦截");
            return ApiResponse.error("该订单已完成出租，重复操作已记录审计");
        }

        if (!stateMachine.canTransition(order.getStatus(), RentalStatus.RENTED)) {
            return ApiResponse.error(stateMachine.getInvalidTransitionMessage(
                order.getStatus(), RentalStatus.RENTED));
        }

        String beforeState = order.getStatus().name();
        order.setStatus(RentalStatus.RENTED);
        order.setRentalTime(LocalDateTime.now());
        order.getSnowboard().setIsAvailable(false);
        order = rentalOrderRepository.save(order);

        auditService.logAudit(orderNo, order.getBatchNo(), AuditAction.RENT_OUT,
            operator, beforeState, order.getStatus().name(), "完成出租");

        return ApiResponse.ok("出租完成", order);
    }

    @Transactional
    public ApiResponse<ReturnInspection> submitReturnInspection(ReturnInspectionRequest request) {
        RentalOrder order = rentalOrderRepository.findByOrderNo(request.getOrderNo())
            .orElseThrow(() -> new RuntimeException("订单不存在: " + request.getOrderNo()));

        Optional<ReturnInspection> existing = returnInspectionRepository.findByRentalOrderOrderNo(request.getOrderNo());
        if (existing.isPresent()) {
            auditService.logDuplicateAttempt(request.getOrderNo(), order.getBatchNo(), AuditAction.RETURN_CHECK,
                request.getInspector(), "重复归还检查拦截");
            return ApiResponse.error("该订单已提交归还检查，重复操作已记录审计");
        }

        if (!stateMachine.canTransition(order.getStatus(), RentalStatus.RETURN_INSPECTING)) {
            return ApiResponse.error(stateMachine.getInvalidTransitionMessage(
                order.getStatus(), RentalStatus.RETURN_INSPECTING));
        }

        String beforeState = order.getStatus().name();
        order.setStatus(RentalStatus.RETURN_INSPECTING);
        order.setActualReturnTime(LocalDateTime.now());
        rentalOrderRepository.save(order);

        ReturnInspection inspection = new ReturnInspection();
        inspection.setRentalOrder(order);
        inspection.setOverallDamageLevel(request.getOverallDamageLevel() != null ?
            request.getOverallDamageLevel() : DamageLevel.NONE);
        inspection.setInspectionItems(request.getInspectionItems() != null ?
            request.getInspectionItems() : new ArrayList<>());
        inspection.setEstimatedDamageFee(request.getEstimatedDamageFee());
        inspection.setInspectorNote(request.getInspectorNote());
        inspection.setInspector(request.getInspector());
        inspection = returnInspectionRepository.save(inspection);

        boolean hasDamage = request.getOverallDamageLevel() != null &&
            request.getOverallDamageLevel() != DamageLevel.NONE;

        RentalStatus newStatus = hasDamage ? RentalStatus.DAMAGE_FOUND : RentalStatus.COMPLETED;
        order.setStatus(newStatus);

        if (hasDamage) {
            order.setIsException(true);
            order.setExceptionType("DAMAGE_FOUND");
            order.setExceptionNote("发现损伤等级: " + request.getOverallDamageLevel());
        } else {
            order.setTotalFee(order.getRentalFee());
            order.setFeePaid(true);
        }

        order = rentalOrderRepository.save(order);

        auditService.logAudit(order.getOrderNo(), order.getBatchNo(), AuditAction.RETURN_CHECK,
            request.getInspector(), beforeState, newStatus.name(),
            hasDamage ? "发现损伤: " + request.getOverallDamageLevel() : "无损伤");

        if (!hasDamage) {
            order.getSnowboard().setIsAvailable(true);
            rentalOrderRepository.save(order);
        }

        return ApiResponse.ok("归还检查完成", inspection);
    }

    @Transactional
    public ApiResponse<Map<String, Object>> splitExceptions(String batchNo) {
        List<RentalOrder> batchOrders = rentalOrderRepository.findByBatchNo(batchNo);
        if (batchOrders.isEmpty()) {
            return ApiResponse.error("批次不存在: " + batchNo);
        }

        List<RentalOrder> exceptionOrders = new ArrayList<>();
        List<RentalOrder> normalOrders = new ArrayList<>();

        for (RentalOrder order : batchOrders) {
            if (order.getIsException()) {
                exceptionOrders.add(order);
            } else {
                normalOrders.add(order);
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("batchNo", batchNo);
        result.put("exceptionCount", exceptionOrders.size());
        result.put("normalCount", normalOrders.size());
        result.put("exceptionOrders", exceptionOrders.stream().map(o -> Map.of(
            "orderNo", o.getOrderNo(),
            "status", o.getStatus(),
            "exceptionType", o.getExceptionType(),
            "exceptionNote", o.getExceptionNote()
        )).toList());
        result.put("normalOrders", normalOrders.stream().map(o -> Map.of(
            "orderNo", o.getOrderNo(),
            "status", o.getStatus()
        )).toList());

        return ApiResponse.ok("异常拆分完成", result);
    }

    @Transactional
    public ApiResponse<RentalOrder> reviewDamage(DamageReviewRequest request) {
        RentalOrder order = rentalOrderRepository.findByOrderNo(request.getOrderNo())
            .orElseThrow(() -> new RuntimeException("订单不存在: " + request.getOrderNo()));

        ReturnInspection inspection = returnInspectionRepository.findByRentalOrderOrderNo(request.getOrderNo())
            .orElseThrow(() -> new RuntimeException("归还检查不存在"));

        if (inspection.getReviewed()) {
            auditService.logDuplicateAttempt(request.getOrderNo(), order.getBatchNo(), AuditAction.DAMAGE_REVIEW,
                request.getReviewer(), "重复损伤复核拦截");
            return ApiResponse.error("该损伤已完成复核，重复操作已记录审计");
        }

        if (!stateMachine.canTransition(order.getStatus(), RentalStatus.DAMAGE_REVIEWING)) {
            return ApiResponse.error(stateMachine.getInvalidTransitionMessage(
                order.getStatus(), RentalStatus.DAMAGE_REVIEWING));
        }

        String beforeState = order.getStatus().name();
        order.setStatus(RentalStatus.DAMAGE_REVIEWING);
        rentalOrderRepository.save(order);

        inspection.setReviewed(true);
        inspection.setReviewer(request.getReviewer());
        inspection.setReviewNote(request.getReviewNote());
        inspection.setReviewTime(LocalDateTime.now());
        inspection.setFinalDamageFee(request.getFinalDamageFee());
        returnInspectionRepository.save(inspection);

        if (request.getDamageConfirmed() && request.getFinalDamageFee().compareTo(BigDecimal.ZERO) > 0) {
            order.setStatus(RentalStatus.DAMAGE_CONFIRMED);
            order.setDamageFee(request.getFinalDamageFee());
            order.setTotalFee(order.getRentalFee().add(request.getFinalDamageFee()));
        } else {
            order.setStatus(RentalStatus.COMPLETED);
            order.setDamageFee(BigDecimal.ZERO);
            order.setTotalFee(order.getRentalFee());
            order.setFeePaid(true);
            order.setIsException(false);
            order.getSnowboard().setIsAvailable(true);
        }

        order.setReviewer(request.getReviewer());
        order.setReviewNote(request.getReviewNote());
        order.setReviewTime(LocalDateTime.now());
        order = rentalOrderRepository.save(order);

        auditService.logAudit(order.getOrderNo(), order.getBatchNo(), AuditAction.DAMAGE_REVIEW,
            request.getReviewer(), beforeState, order.getStatus().name(),
            request.getDamageConfirmed() ? "损伤确认，费用: " + request.getFinalDamageFee() : "损伤不成立");

        return ApiResponse.ok("损伤复核完成", order);
    }

    @Transactional
    public ApiResponse<RentalOrder> chargeFee(String orderNo, String operator) {
        RentalOrder order = rentalOrderRepository.findByOrderNo(orderNo)
            .orElseThrow(() -> new RuntimeException("订单不存在: " + orderNo));

        if (order.getFeePaid()) {
            auditService.logDuplicateAttempt(orderNo, order.getBatchNo(), AuditAction.CHARGE_FEE,
                operator, "重复收费拦截");
            return ApiResponse.error("该订单已完成收费，重复操作已记录审计");
        }

        if (!stateMachine.canTransition(order.getStatus(), RentalStatus.FEE_CHARGED)) {
            return ApiResponse.error(stateMachine.getInvalidTransitionMessage(
                order.getStatus(), RentalStatus.FEE_CHARGED));
        }

        String beforeState = order.getStatus().name();
        order.setStatus(RentalStatus.FEE_CHARGED);
        order.setFeePaid(true);
        order = rentalOrderRepository.save(order);

        auditService.logAudit(orderNo, order.getBatchNo(), AuditAction.CHARGE_FEE,
            operator, beforeState, RentalStatus.FEE_CHARGED.name(),
            "收费完成，总费用: " + order.getTotalFee());

        return completeOrder(order, operator);
    }

    @Transactional
    public ApiResponse<RentalOrder> completeOrder(RentalOrder order, String operator) {
        if (!stateMachine.canTransition(order.getStatus(), RentalStatus.COMPLETED)) {
            return ApiResponse.error(stateMachine.getInvalidTransitionMessage(
                order.getStatus(), RentalStatus.COMPLETED));
        }

        String beforeState = order.getStatus().name();
        order.setStatus(RentalStatus.COMPLETED);
        order.getSnowboard().setIsAvailable(true);
        order = rentalOrderRepository.save(order);

        auditService.logAudit(order.getOrderNo(), order.getBatchNo(), AuditAction.COMPLETE,
            operator, beforeState, RentalStatus.COMPLETED.name(), "订单结案");

        return ApiResponse.ok("订单结案完成", order);
    }

    @Transactional
    public ApiResponse<RentalOrder> archiveOrder(String orderNo, String operator) {
        RentalOrder order = rentalOrderRepository.findByOrderNo(orderNo)
            .orElseThrow(() -> new RuntimeException("订单不存在: " + orderNo));

        if (order.getArchived()) {
            auditService.logDuplicateAttempt(orderNo, order.getBatchNo(), AuditAction.ARCHIVE,
                operator, "重复归档拦截");
            return ApiResponse.error("该订单已归档，重复操作已记录审计");
        }

        if (!stateMachine.canTransition(order.getStatus(), RentalStatus.ARCHIVED)) {
            return ApiResponse.error(stateMachine.getInvalidTransitionMessage(
                order.getStatus(), RentalStatus.ARCHIVED));
        }

        String beforeState = order.getStatus().name();
        order.setStatus(RentalStatus.ARCHIVED);
        order.setArchived(true);
        order.setArchivedAt(LocalDateTime.now());
        order = rentalOrderRepository.save(order);

        auditService.logAudit(orderNo, order.getBatchNo(), AuditAction.ARCHIVE,
            operator, beforeState, RentalStatus.ARCHIVED.name(), "订单归档");

        return ApiResponse.ok("归档完成", order);
    }

    @Transactional
    public ApiResponse<RentalOrder> modifyOrder(String orderNo, RentalSubmitRequest request, String operator) {
        RentalOrder order = rentalOrderRepository.findByOrderNo(orderNo)
            .orElseThrow(() -> new RuntimeException("订单不存在: " + orderNo));

        if (!stateMachine.canModify(order.getStatus())) {
            return ApiResponse.error("当前状态不允许修改: " + order.getStatus());
        }

        String beforeState = "MODIFY_BEFORE";
        if (request.getActualReleaseValue() != null) {
            order.setActualReleaseValue(request.getActualReleaseValue());
        }
        if (request.getRentalFee() != null) {
            order.setRentalFee(request.getRentalFee());
        }

        order = rentalOrderRepository.save(order);

        auditService.logAudit(orderNo, order.getBatchNo(), AuditAction.MODIFY,
            operator, beforeState, order.getStatus().name(), "订单参数修改");

        if (order.getStatus() == RentalStatus.PARAMS_MISMATCH) {
            return validateAndProcessOrder(order, operator);
        }

        return ApiResponse.ok("修改完成", order);
    }

    public ApiResponse<RentalOrder> getOrder(String orderNo) {
        return rentalOrderRepository.findByOrderNo(orderNo)
            .map(ApiResponse::ok)
            .orElse(ApiResponse.error("订单不存在: " + orderNo));
    }

    public ApiResponse<List<RentalOrder>> getBatchOrders(String batchNo) {
        return ApiResponse.ok(rentalOrderRepository.findByBatchNo(batchNo));
    }

    public ApiResponse<List<RentalOrder>> getExceptionOrders() {
        return ApiResponse.ok(rentalOrderRepository.findByIsExceptionTrue());
    }
}
