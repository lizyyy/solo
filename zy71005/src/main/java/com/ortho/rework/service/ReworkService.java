package com.ortho.rework.service;

import com.ortho.rework.dto.*;
import com.ortho.rework.entity.*;
import com.ortho.rework.enums.OperationType;
import com.ortho.rework.enums.ReworkStatus;
import com.ortho.rework.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ReworkService {

    @Autowired
    private ReworkOrderRepository reworkOrderRepository;

    @Autowired
    private PatientRepository patientRepository;

    @Autowired
    private ImpressionBatchRepository impressionBatchRepository;

    @Autowired
    private ExpressOrderRepository expressOrderRepository;

    @Autowired
    private ReworkReportRepository reworkReportRepository;

    @Autowired
    private AuditService auditService;

    @Autowired
    private ReworkStateMachine stateMachine;

    @Transactional
    public ReworkDetailDTO createReworkOrder(CreateReworkRequest request) {
        Patient patient = patientRepository.findByPatientId(request.getPatientId())
                .orElseGet(() -> {
                    Patient newPatient = new Patient();
                    newPatient.setPatientId(request.getPatientId());
                    newPatient.setName(request.getPatientName());
                    newPatient.setPhone(request.getPatientPhone());
                    return patientRepository.save(newPatient);
                });

        ImpressionBatch batch = impressionBatchRepository.findByBatchNumber(request.getBatchNumber())
                .orElseGet(() -> {
                    ImpressionBatch newBatch = new ImpressionBatch();
                    newBatch.setBatchNumber(request.getBatchNumber());
                    newBatch.setPatient(patient);
                    return impressionBatchRepository.save(newBatch);
                });

        ReworkOrder reworkOrder = new ReworkOrder();
        reworkOrder.setOrderNumber("RW" + System.currentTimeMillis());
        reworkOrder.setBatch(batch);
        reworkOrder.setStatus(ReworkStatus.PENDING_REVIEW);
        reworkOrder.setReworkReason(request.getReworkReason());
        reworkOrder = reworkOrderRepository.save(reworkOrder);

        auditService.logCreate(reworkOrder.getId(), "system");

        return convertToDetailDTO(reworkOrder, patient);
    }

    public ReworkDetailDTO getReworkOrder(Long id) {
        ReworkOrder reworkOrder = reworkOrderRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Rework order not found"));
        Patient patient = reworkOrder.getBatch().getPatient();
        return convertToDetailDTO(reworkOrder, patient);
    }

    public List<ReworkDetailDTO> getAllReworkOrders() {
        return reworkOrderRepository.findAll().stream()
                .map(order -> convertToDetailDTO(order, order.getBatch().getPatient()))
                .collect(Collectors.toList());
    }

    @Transactional
    public ReworkDetailDTO startReview(Long id, ReviewRequest request) {
        ReworkOrder reworkOrder = reworkOrderRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Rework order not found"));

        validateTransition(reworkOrder.getStatus(), ReworkStatus.TECHNICIAN_REVIEW);
        ReworkStatus fromStatus = reworkOrder.getStatus();
        reworkOrder.setStatus(ReworkStatus.TECHNICIAN_REVIEW);
        reworkOrder = reworkOrderRepository.save(reworkOrder);

        auditService.logStatusChange(id, fromStatus, ReworkStatus.TECHNICIAN_REVIEW, 
                request.getRemark(), request.getOperator());

        return convertToDetailDTO(reworkOrder, reworkOrder.getBatch().getPatient());
    }

    @Transactional
    public ReworkDetailDTO addTechnicianNote(Long id, TechnicianNoteRequest request) {
        ReworkOrder reworkOrder = reworkOrderRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Rework order not found"));

        reworkOrder.setTechnicianNote(request.getNote());

        if (request.getNote() != null && !request.getNote().isEmpty()) {
            validateTransition(reworkOrder.getStatus(), ReworkStatus.DOCTOR_CONFIRM);
            ReworkStatus fromStatus = reworkOrder.getStatus();
            reworkOrder.setStatus(ReworkStatus.DOCTOR_CONFIRM);
            reworkOrder = reworkOrderRepository.save(reworkOrder);
            auditService.logStatusChange(id, fromStatus, ReworkStatus.DOCTOR_CONFIRM, 
                    "Technician note added", request.getOperator());
        } else {
            reworkOrder = reworkOrderRepository.save(reworkOrder);
        }

        return convertToDetailDTO(reworkOrder, reworkOrder.getBatch().getPatient());
    }

    @Transactional
    public ReworkDetailDTO doctorConfirm(Long id, DoctorConfirmRequest request) {
        ReworkOrder reworkOrder = reworkOrderRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Rework order not found"));

        reworkOrder.setDoctorNote(request.getNote());

        if (Boolean.TRUE.equals(request.getConfirmed())) {
            validateTransition(reworkOrder.getStatus(), ReworkStatus.READY_TO_SHIP);
            ReworkStatus fromStatus = reworkOrder.getStatus();
            reworkOrder.setStatus(ReworkStatus.READY_TO_SHIP);
            reworkOrder = reworkOrderRepository.save(reworkOrder);
            auditService.logStatusChange(id, fromStatus, ReworkStatus.READY_TO_SHIP, 
                    "Doctor confirmed", request.getOperator());
        } else {
            validateTransition(reworkOrder.getStatus(), ReworkStatus.TECHNICIAN_REVIEW);
            ReworkStatus fromStatus = reworkOrder.getStatus();
            reworkOrder.setStatus(ReworkStatus.TECHNICIAN_REVIEW);
            reworkOrder = reworkOrderRepository.save(reworkOrder);
            auditService.logStatusChange(id, fromStatus, ReworkStatus.TECHNICIAN_REVIEW, 
                    "Doctor rejected, sent back to technician", request.getOperator());
        }

        return convertToDetailDTO(reworkOrder, reworkOrder.getBatch().getPatient());
    }

    @Transactional
    public ReworkDetailDTO ship(Long id, ShipRequest request) {
        ReworkOrder reworkOrder = reworkOrderRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Rework order not found"));

        validateTransition(reworkOrder.getStatus(), ReworkStatus.SHIPPED);

        ExpressOrder expressOrder = new ExpressOrder();
        expressOrder.setReworkOrder(reworkOrder);
        expressOrder.setTrackingNumber(request.getTrackingNumber());
        expressOrder.setCourier(request.getCourier());
        expressOrder.setSender(request.getSender());
        expressOrder.setReceiver(request.getReceiver());
        expressOrder.setShippedAt(LocalDateTime.now());
        expressOrderRepository.save(expressOrder);

        ReworkStatus fromStatus = reworkOrder.getStatus();
        reworkOrder.setStatus(ReworkStatus.SHIPPED);
        reworkOrder = reworkOrderRepository.save(reworkOrder);

        auditService.logStatusChange(id, fromStatus, ReworkStatus.SHIPPED, 
                "Tracking: " + request.getTrackingNumber(), request.getOperator());

        return convertToDetailDTO(reworkOrder, reworkOrder.getBatch().getPatient());
    }

    @Transactional
    public ReworkDetailDTO receive(Long id, ReceiveRequest request) {
        ReworkOrder reworkOrder = reworkOrderRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Rework order not found"));

        validateTransition(reworkOrder.getStatus(), ReworkStatus.RECEIVED);

        List<ExpressOrder> expressOrders = expressOrderRepository.findByReworkOrderId(id);
        if (!expressOrders.isEmpty()) {
            ExpressOrder expressOrder = expressOrders.get(0);
            expressOrder.setReceivedAt(LocalDateTime.now());
            expressOrderRepository.save(expressOrder);
        }

        ReworkStatus fromStatus = reworkOrder.getStatus();
        reworkOrder.setStatus(ReworkStatus.RECEIVED);
        reworkOrder = reworkOrderRepository.save(reworkOrder);

        auditService.logStatusChange(id, fromStatus, ReworkStatus.RECEIVED, 
                request.getRemark(), request.getOperator());

        return convertToDetailDTO(reworkOrder, reworkOrder.getBatch().getPatient());
    }

    @Transactional
    public ReworkDetailDTO inspect(Long id, InspectionRequest request) {
        ReworkOrder reworkOrder = reworkOrderRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Rework order not found"));

        validateTransition(reworkOrder.getStatus(), ReworkStatus.INSPECTION);

        ReworkReport report = new ReworkReport();
        report.setReworkOrder(reworkOrder);
        report.setInspectionResult(request.getInspectionResult());
        report.setConclusion(request.getConclusion());
        report.setReporter(request.getReporter());
        reworkReportRepository.save(report);

        ReworkStatus fromStatus = reworkOrder.getStatus();
        reworkOrder.setStatus(ReworkStatus.INSPECTION);
        reworkOrder = reworkOrderRepository.save(reworkOrder);

        auditService.logStatusChange(id, fromStatus, ReworkStatus.INSPECTION, 
                "Inspection completed", request.getReporter());

        return convertToDetailDTO(reworkOrder, reworkOrder.getBatch().getPatient());
    }

    @Transactional
    public ReworkDetailDTO close(Long id, CloseRequest request) {
        ReworkOrder reworkOrder = reworkOrderRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Rework order not found"));

        validateTransition(reworkOrder.getStatus(), ReworkStatus.CLOSED);

        ReworkStatus fromStatus = reworkOrder.getStatus();
        reworkOrder.setStatus(ReworkStatus.CLOSED);
        reworkOrder = reworkOrderRepository.save(reworkOrder);

        auditService.logStatusChange(id, fromStatus, ReworkStatus.CLOSED, 
                request.getRemark(), request.getOperator());

        return convertToDetailDTO(reworkOrder, reworkOrder.getBatch().getPatient());
    }

    @Transactional
    public ReworkDetailDTO markLost(Long id, MarkLostRequest request) {
        ReworkOrder reworkOrder = reworkOrderRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Rework order not found"));

        validateTransition(reworkOrder.getStatus(), ReworkStatus.LOST);

        ReworkStatus fromStatus = reworkOrder.getStatus();
        reworkOrder.setStatus(ReworkStatus.LOST);
        reworkOrder = reworkOrderRepository.save(reworkOrder);

        auditService.logStatusChange(id, fromStatus, ReworkStatus.LOST, 
                request.getRemark(), request.getOperator());

        return convertToDetailDTO(reworkOrder, reworkOrder.getBatch().getPatient());
    }

    private void validateTransition(ReworkStatus from, ReworkStatus to) {
        if (!stateMachine.canTransition(from, to)) {
            throw new RuntimeException("Invalid status transition from " + from + " to " + to);
        }
    }

    private ReworkDetailDTO convertToDetailDTO(ReworkOrder reworkOrder, Patient patient) {
        ReworkDetailDTO dto = new ReworkDetailDTO();
        dto.setId(reworkOrder.getId());
        dto.setOrderNumber(reworkOrder.getOrderNumber());
        dto.setBatchNumber(reworkOrder.getBatch().getBatchNumber());
        dto.setPatientId(patient.getPatientId());
        dto.setPatientName(patient.getName());
        dto.setStatus(reworkOrder.getStatus());
        dto.setReworkReason(reworkOrder.getReworkReason());
        dto.setTechnicianNote(reworkOrder.getTechnicianNote());
        dto.setDoctorNote(reworkOrder.getDoctorNote());
        dto.setCreatedAt(reworkOrder.getCreatedAt());
        dto.setUpdatedAt(reworkOrder.getUpdatedAt());

        List<ExpressOrder> expressOrders = expressOrderRepository.findByReworkOrderId(reworkOrder.getId());
        if (!expressOrders.isEmpty()) {
            dto.setTrackingNumber(expressOrders.get(0).getTrackingNumber());
        }

        List<AuditLogDTO> auditLogs = auditService.getAuditLogsByReworkOrderId(reworkOrder.getId())
                .stream().map(log -> {
                    AuditLogDTO logDTO = new AuditLogDTO();
                    logDTO.setId(log.getId());
                    logDTO.setOperationType(log.getOperationType());
                    logDTO.setFromStatus(log.getFromStatus());
                    logDTO.setToStatus(log.getToStatus());
                    logDTO.setRemark(log.getRemark());
                    logDTO.setOperator(log.getOperator());
                    logDTO.setCreatedAt(log.getCreatedAt());
                    return logDTO;
                }).collect(Collectors.toList());
        dto.setAuditLogs(auditLogs);

        return dto;
    }
}
