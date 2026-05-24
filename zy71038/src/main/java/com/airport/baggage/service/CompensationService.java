package com.airport.baggage.service;

import com.airport.baggage.common.enums.CompensationStatus;
import com.airport.baggage.common.enums.ErrorCode;
import com.airport.baggage.common.exception.BusinessException;
import com.airport.baggage.config.CompensationRulesConfig;
import com.airport.baggage.dto.request.*;
import com.airport.baggage.dto.response.CompensationDetailResponse;
import com.airport.baggage.entity.*;
import com.airport.baggage.repository.*;
import jakarta.persistence.criteria.Predicate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class CompensationService {
    private static final Logger log = LoggerFactory.getLogger(CompensationService.class);

    private final CompensationOrderRepository compensationOrderRepository;
    private final PassengerRepository passengerRepository;
    private final FlightRepository flightRepository;
    private final BaggageTagRepository baggageTagRepository;
    private final BaggageArrivalRepository baggageArrivalRepository;
    private final ClosingReportRepository closingReportRepository;
    private final CompensationStateMachine stateMachine;
    private final CompensationRulesConfig rulesConfig;
    private final AuditService auditService;

    public CompensationService(CompensationOrderRepository compensationOrderRepository,
                               PassengerRepository passengerRepository,
                               FlightRepository flightRepository,
                               BaggageTagRepository baggageTagRepository,
                               BaggageArrivalRepository baggageArrivalRepository,
                               ClosingReportRepository closingReportRepository,
                               CompensationStateMachine stateMachine,
                               CompensationRulesConfig rulesConfig,
                               AuditService auditService) {
        this.compensationOrderRepository = compensationOrderRepository;
        this.passengerRepository = passengerRepository;
        this.flightRepository = flightRepository;
        this.baggageTagRepository = baggageTagRepository;
        this.baggageArrivalRepository = baggageArrivalRepository;
        this.closingReportRepository = closingReportRepository;
        this.stateMachine = stateMachine;
        this.rulesConfig = rulesConfig;
        this.auditService = auditService;
    }

    @Transactional
    public CompensationDetailResponse createCompensation(CreateCompensationRequest request) {
        validateAmount(request.getAmount());

        Passenger passenger = getOrCreatePassenger(request);
        Flight flight = getOrCreateFlight(request);
        BaggageTag baggage = getOrCreateBaggage(request, passenger, flight);

        checkDuplicateCompensation(passenger.getPassengerId(), baggage.getId());

        String orderNo = generateOrderNo();

        CompensationOrder order = new CompensationOrder();
        order.setOrderNo(orderNo);
        order.setPassenger(passenger);
        order.setFlight(flight);
        order.setBaggage(baggage);
        order.setSourceType(request.getSourceType());
        order.setSourceDetail(request.getSourceDetail());
        order.setStatus(CompensationStatus.CREATED);
        order.setAmount(request.getAmount());
        order.setReason(request.getReason());
        order.setDisposalReason("初始登记");
        order.setCreatedBy(request.getOperator());
        order.setBaggageArrived(false);
        order.setPickedUp(false);
        order.setRemark(request.getRemark());

        order = compensationOrderRepository.save(order);

        auditService.logChange("CompensationOrder", order.getId(), "CREATE",
                null, order, "创建补偿单", request.getOperator());

        log.info("创建补偿单成功: orderNo={}, passengerId={}", orderNo, passenger.getPassengerId());

        return convertToDetailResponse(order);
    }

    @Transactional
    public CompensationDetailResponse transitionStatus(Long orderId, StatusTransitionRequest request) {
        CompensationOrder order = getOrderById(orderId);

        CompensationStatus oldStatus = order.getStatus();
        CompensationStatus newStatus = request.getTargetStatus();

        stateMachine.validateTransition(oldStatus, newStatus);

        order.setStatus(newStatus);
        order.setDisposalReason(request.getDisposalReason());
        order.setReviewComment(request.getReviewComment());

        if (newStatus == CompensationStatus.PAID) {
            order.setPaidAt(LocalDateTime.now());
        }

        if (newStatus == CompensationStatus.APPROVED) {
            order.setApprovedBy(request.getOperator());
        }

        order = compensationOrderRepository.save(order);

        auditService.logChange("CompensationOrder", order.getId(), "STATUS_CHANGE",
                oldStatus.getDescription(), newStatus.getDescription(),
                request.getDisposalReason(), request.getOperator());

        log.info("状态转换成功: orderNo={}, {} -> {}", order.getOrderNo(), oldStatus, newStatus);

        return convertToDetailResponse(order);
    }

    @Transactional
    public CompensationDetailResponse recordBaggageArrival(String orderNo, BaggageArrivalRequest request) {
        CompensationOrder order = compensationOrderRepository.findByOrderNo(orderNo)
                .orElseThrow(() -> new BusinessException(ErrorCode.COMPENSATION_NOT_FOUND));

        if (order.getBaggageArrived()) {
            throw new BusinessException(ErrorCode.INVALID_STATUS, "该行李已登记到件");
        }

        BaggageTag baggage = baggageTagRepository.findByTagNumber(request.getTagNumber())
                .orElseThrow(() -> new BusinessException(ErrorCode.BAGGAGE_NOT_FOUND));

        if (!order.getBaggage().getId().equals(baggage.getId())) {
            throw new BusinessException(ErrorCode.INVALID_PARAMETER, "该行李牌不属于当前补偿单");
        }

        BaggageArrival arrival = new BaggageArrival();
        arrival.setCompensationOrder(order);
        arrival.setBaggage(baggage);
        arrival.setArrivalTime(request.getArrivalTime());
        arrival.setArrivalLocation(request.getArrivalLocation());
        arrival.setTransportFlight(request.getTransportFlight());
        arrival.setRemark(request.getRemark());
        arrival.setRecordedBy(request.getOperator());
        baggageArrivalRepository.save(arrival);

        order.setBaggageArrived(true);
        if (order.getStatus() == CompensationStatus.PAID) {
            order.setStatus(CompensationStatus.BAGGAGE_ARRIVED);
        }
        order = compensationOrderRepository.save(order);

        auditService.logChange("CompensationOrder", order.getId(), "BAGGAGE_ARRIVAL",
                null, request.getArrivalTime(), request.getRemark(), request.getOperator());

        log.info("行李到件登记成功: orderNo={}, tagNumber={}", orderNo, request.getTagNumber());

        return convertToDetailResponse(order);
    }

    @Transactional
    public CompensationDetailResponse confirmPickup(Long orderId, String operator) {
        CompensationOrder order = getOrderById(orderId);

        if (!order.getBaggageArrived()) {
            throw new BusinessException(ErrorCode.INVALID_STATUS, "行李尚未到件，无法签收");
        }

        if (order.getPickedUp()) {
            throw new BusinessException(ErrorCode.INVALID_STATUS, "该行李已签收");
        }

        order.setPickedUp(true);
        if (order.getStatus() == CompensationStatus.BAGGAGE_ARRIVED) {
            order.setStatus(CompensationStatus.PICKED_UP);
        }

        order = compensationOrderRepository.save(order);

        auditService.logChange("CompensationOrder", order.getId(), "PICKUP",
                null, "已签收", null, operator);

        log.info("行李签收成功: orderNo={}", order.getOrderNo());

        return convertToDetailResponse(order);
    }

    @Transactional
    public ClosingReport closeCase(Long orderId, CloseCaseRequest request) {
        CompensationOrder order = getOrderById(orderId);

        if (order.getStatus() != CompensationStatus.PICKED_UP && order.getStatus() != CompensationStatus.DISPUTED) {
            throw new BusinessException(ErrorCode.INVALID_STATUS, "当前状态不允许结案");
        }

        if (!order.getBaggageArrived() || !order.getPickedUp()) {
            throw new BusinessException(ErrorCode.INVALID_STATUS, "行李未到件或未签收，无法结案");
        }

        ClosingReport report = new ClosingReport();
        report.setCompensationOrder(order);
        report.setReportNo(generateReportNo());
        report.setTotalAmount(request.getTotalAmount() != null ? request.getTotalAmount() : order.getAmount());
        report.setCaseSummary(request.getCaseSummary());
        report.setDisposalMeasure(request.getDisposalMeasure());
        report.setPassengerFeedback(request.getPassengerFeedback());
        report.setClosedBy(request.getOperator());
        report.setClosedAt(LocalDateTime.now());
        report.setRemark(request.getRemark());
        report = closingReportRepository.save(report);

        order.setStatus(CompensationStatus.CLOSED);
        compensationOrderRepository.save(order);

        auditService.logChange("CompensationOrder", order.getId(), "CLOSE_CASE",
                order.getStatus().getDescription(), "已结案", request.getCaseSummary(), request.getOperator());

        log.info("案件结案成功: orderNo={}, reportNo={}", order.getOrderNo(), report.getReportNo());

        return report;
    }

    public Page<CompensationDetailResponse> queryCompensations(CompensationQueryRequest request) {
        PageRequest pageRequest = PageRequest.of(request.getPage(), request.getSize());
        Specification<CompensationOrder> spec = buildSpecification(request);
        return compensationOrderRepository.findAll(spec, pageRequest)
                .map(this::convertToDetailResponse);
    }

    public CompensationDetailResponse getOrderDetail(Long orderId) {
        CompensationOrder order = getOrderById(orderId);
        return convertToDetailResponse(order);
    }

    public CompensationDetailResponse getOrderDetailByOrderNo(String orderNo) {
        CompensationOrder order = compensationOrderRepository.findByOrderNo(orderNo)
                .orElseThrow(() -> new BusinessException(ErrorCode.COMPENSATION_NOT_FOUND));
        return convertToDetailResponse(order);
    }

    public List<CompensationOrder> findOrdersForExport(CompensationQueryRequest request) {
        Specification<CompensationOrder> spec = buildSpecification(request);
        return compensationOrderRepository.findAll(spec);
    }

    private void validateAmount(BigDecimal amount) {
        if (amount == null) {
            throw new BusinessException(ErrorCode.MISSING_REQUIRED_FIELD, "补偿金额不能为空");
        }
        if (amount.compareTo(rulesConfig.getMinAmount()) < 0) {
            throw new BusinessException(ErrorCode.AMOUNT_EXCEEDS_LIMIT,
                    String.format("补偿金额不能低于%s元", rulesConfig.getMinAmount()));
        }
        if (amount.compareTo(rulesConfig.getMaxAmount()) > 0) {
            throw new BusinessException(ErrorCode.AMOUNT_EXCEEDS_LIMIT,
                    String.format("补偿金额不能超过%s元", rulesConfig.getMaxAmount()));
        }
    }

    private void checkDuplicateCompensation(String passengerId, Long baggageId) {
        LocalDateTime startTime = LocalDateTime.now().minusDays(rulesConfig.getDuplicateCheckDays());
        List<CompensationOrder> recentOrders = compensationOrderRepository
                .findOrdersByPassengerAndTime(passengerId, startTime);

        if (!recentOrders.isEmpty()) {
            throw new BusinessException(ErrorCode.DUPLICATE_REQUEST,
                    String.format("该旅客在%d天内已有临赔记录，请复核", rulesConfig.getDuplicateCheckDays()));
        }

        List<CompensationStatus> activeStatuses = List.of(
                CompensationStatus.CREATED,
                CompensationStatus.PENDING_REVIEW,
                CompensationStatus.APPROVED,
                CompensationStatus.PAID,
                CompensationStatus.BAGGAGE_ARRIVED,
                CompensationStatus.PICKED_UP,
                CompensationStatus.DISPUTED
        );

        if (compensationOrderRepository.existsByBaggageIdAndStatusIn(baggageId, activeStatuses)) {
            throw new BusinessException(ErrorCode.DUPLICATE_REQUEST, "该行李牌已有有效补偿单");
        }
    }

    private Passenger getOrCreatePassenger(CreateCompensationRequest request) {
        return passengerRepository.findByPassengerId(request.getPassengerId())
                .orElseGet(() -> {
                    Passenger p = new Passenger();
                    p.setPassengerId(request.getPassengerId());
                    p.setName(request.getPassengerName());
                    p.setPhone(request.getPassengerPhone());
                    p.setIdCard(request.getIdCard());
                    return passengerRepository.save(p);
                });
    }

    private Flight getOrCreateFlight(CreateCompensationRequest request) {
        if (request.getScheduledDeparture() != null) {
            return flightRepository
                    .findByFlightNoAndScheduledDeparture(request.getFlightNo(), request.getScheduledDeparture())
                    .orElseGet(() -> createFlight(request));
        }
        return createFlight(request);
    }

    private Flight createFlight(CreateCompensationRequest request) {
        Flight f = new Flight();
        f.setFlightNo(request.getFlightNo());
        f.setDeparture(request.getDepartureAirport());
        f.setArrival(request.getArrivalAirport());
        f.setScheduledDeparture(request.getScheduledDeparture());
        return flightRepository.save(f);
    }

    private BaggageTag getOrCreateBaggage(CreateCompensationRequest request, Passenger passenger, Flight flight) {
        return baggageTagRepository.findByTagNumber(request.getTagNumber())
                .orElseGet(() -> {
                    BaggageTag b = new BaggageTag();
                    b.setTagNumber(request.getTagNumber());
                    b.setPassenger(passenger);
                    b.setFlight(flight);
                    b.setWeight(request.getBaggageWeight());
                    b.setDescription(request.getBaggageDesc());
                    b.setStatus("DELAYED");
                    return baggageTagRepository.save(b);
                });
    }

    private CompensationOrder getOrderById(Long orderId) {
        return compensationOrderRepository.findById(orderId)
                .orElseThrow(() -> new BusinessException(ErrorCode.COMPENSATION_NOT_FOUND));
    }

    private Specification<CompensationOrder> buildSpecification(CompensationQueryRequest request) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (request.getOrderNo() != null && !request.getOrderNo().isBlank()) {
                predicates.add(cb.like(root.get("orderNo"), "%" + request.getOrderNo() + "%"));
            }
            if (request.getPassengerId() != null && !request.getPassengerId().isBlank()) {
                predicates.add(cb.equal(root.get("passenger").get("passengerId"), request.getPassengerId()));
            }
            if (request.getPassengerName() != null && !request.getPassengerName().isBlank()) {
                predicates.add(cb.like(root.get("passenger").get("name"), "%" + request.getPassengerName() + "%"));
            }
            if (request.getFlightNo() != null && !request.getFlightNo().isBlank()) {
                predicates.add(cb.like(root.get("flight").get("flightNo"), "%" + request.getFlightNo() + "%"));
            }
            if (request.getTagNumber() != null && !request.getTagNumber().isBlank()) {
                predicates.add(cb.like(root.get("baggage").get("tagNumber"), "%" + request.getTagNumber() + "%"));
            }
            if (request.getStatuses() != null && !request.getStatuses().isEmpty()) {
                predicates.add(root.get("status").in(request.getStatuses()));
            }
            if (request.getSourceTypes() != null && !request.getSourceTypes().isEmpty()) {
                predicates.add(root.get("sourceType").in(request.getSourceTypes()));
            }
            if (request.getStartTime() != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), request.getStartTime()));
            }
            if (request.getEndTime() != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), request.getEndTime()));
            }
            if (request.getBaggageArrived() != null) {
                predicates.add(cb.equal(root.get("baggageArrived"), request.getBaggageArrived()));
            }
            if (request.getPickedUp() != null) {
                predicates.add(cb.equal(root.get("pickedUp"), request.getPickedUp()));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private CompensationDetailResponse convertToDetailResponse(CompensationOrder order) {
        CompensationDetailResponse response = new CompensationDetailResponse();
        response.setId(order.getId());
        response.setOrderNo(order.getOrderNo());
        response.setPassengerId(order.getPassenger().getPassengerId());
        response.setPassengerName(order.getPassenger().getName());
        response.setPassengerPhone(order.getPassenger().getPhone());
        response.setFlightNo(order.getFlight().getFlightNo());
        response.setDepartureAirport(order.getFlight().getDeparture());
        response.setArrivalAirport(order.getFlight().getArrival());
        response.setScheduledDeparture(order.getFlight().getScheduledDeparture());
        response.setTagNumber(order.getBaggage().getTagNumber());
        response.setBaggageWeight(order.getBaggage().getWeight());
        response.setBaggageDesc(order.getBaggage().getDescription());
        response.setSourceType(order.getSourceType());
        response.setSourceDetail(order.getSourceDetail());
        response.setStatus(order.getStatus());
        response.setStatusDesc(order.getStatus().getDescription());
        response.setAmount(order.getAmount());
        response.setReason(order.getReason());
        response.setDisposalReason(order.getDisposalReason());
        response.setReviewComment(order.getReviewComment());
        response.setCreatedBy(order.getCreatedBy());
        response.setApprovedBy(order.getApprovedBy());
        response.setPaidAt(order.getPaidAt());
        response.setBaggageArrived(order.getBaggageArrived());
        response.setPickedUp(order.getPickedUp());
        response.setRemark(order.getRemark());
        response.setCreatedAt(order.getCreatedAt());
        response.setUpdatedAt(order.getUpdatedAt());
        return response;
    }

    private String generateOrderNo() {
        String dateStr = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String uuid = UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
        return "BC" + dateStr + uuid;
    }

    private String generateReportNo() {
        String dateStr = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String uuid = UUID.randomUUID().toString().replace("-", "").substring(0, 6).toUpperCase();
        return "CR" + dateStr + uuid;
    }
}
