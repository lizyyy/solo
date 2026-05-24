package com.hospital.oxygen.service;

import com.hospital.oxygen.common.BusinessException;
import com.hospital.oxygen.dto.TransferRequestDto;
import com.hospital.oxygen.entity.TransferRequest;
import com.hospital.oxygen.enums.TransferStatus;
import com.hospital.oxygen.repository.TransferRequestRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class TransferService {

    private static final Logger log = LoggerFactory.getLogger(TransferService.class);

    private final TransferRequestRepository transferRepository;
    private final BookingService bookingService;
    private final AuditService auditService;

    public TransferService(TransferRequestRepository transferRepository, BookingService bookingService, AuditService auditService) {
        this.transferRepository = transferRepository;
        this.bookingService = bookingService;
        this.auditService = auditService;
    }

    @Transactional
    public TransferRequest createTransfer(TransferRequestDto request) {
        log.info("创建转科申请: 患者={}, 从={} 到={}", request.getPatientId(), request.getFromWard(), request.getToWard());

        String transferNumber = "TR" + System.currentTimeMillis();

        TransferRequest transfer = new TransferRequest();
        transfer.setTransferNumber(transferNumber);
        transfer.setPatientId(request.getPatientId());
        transfer.setFromWard(request.getFromWard());
        transfer.setToWard(request.getToWard());
        transfer.setFromBed(request.getFromBed());
        transfer.setToBed(request.getToBed());
        transfer.setOxygenPortCode(request.getOxygenPortCode());
        transfer.setRemarks(request.getRemarks());
        transfer.setOperator(request.getOperator());
        transfer.setStatus(TransferStatus.PENDING);
        transfer.setResourcesReleased(false);

        transfer = transferRepository.save(transfer);

        auditService.logOperation("CREATE", "TRANSFER", transferNumber, null, transfer, request.getOperator(), "转科申请创建");

        return transfer;
    }

    @Transactional
    public TransferRequest approveTransfer(String transferNumber, String operator) {
        TransferRequest transfer = getTransfer(transferNumber);

        if (transfer.getStatus() != TransferStatus.PENDING) {
            if (transfer.getStatus() == TransferStatus.APPROVED) {
                auditService.logDuplicateOperation("APPROVE", "TRANSFER", transferNumber, transferNumber, operator);
                return transfer;
            }
            throw new BusinessException("转科申请状态不允许审批");
        }

        TransferRequest before = copyTransfer(transfer);
        transfer.setStatus(TransferStatus.APPROVED);
        transfer.setApproveTime(LocalDateTime.now());
        transfer = transferRepository.save(transfer);

        auditService.logOperation("APPROVE", "TRANSFER", transferNumber, before, transfer, operator, "转科申请已批准");

        return transfer;
    }

    @Transactional
    public TransferRequest startTransfer(String transferNumber, String operator) {
        TransferRequest transfer = getTransfer(transferNumber);

        if (transfer.getStatus() != TransferStatus.APPROVED) {
            if (transfer.getStatus() == TransferStatus.IN_TRANSIT) {
                auditService.logDuplicateOperation("START", "TRANSFER", transferNumber, transferNumber, operator);
                return transfer;
            }
            throw new BusinessException("转科申请状态不允许开始转运");
        }

        TransferRequest before = copyTransfer(transfer);
        transfer.setStatus(TransferStatus.IN_TRANSIT);
        transfer.setTransferTime(LocalDateTime.now());
        transfer = transferRepository.save(transfer);

        auditService.logOperation("START", "TRANSFER", transferNumber, before, transfer, operator, "开始转运");

        return transfer;
    }

    @Transactional
    public TransferRequest completeTransfer(String transferNumber, boolean releaseResources, String operator) {
        TransferRequest transfer = getTransfer(transferNumber);

        if (transfer.getStatus() != TransferStatus.IN_TRANSIT) {
            if (transfer.getStatus() == TransferStatus.COMPLETED) {
                auditService.logDuplicateOperation("COMPLETE", "TRANSFER", transferNumber, transferNumber, operator);
                return transfer;
            }
            throw new BusinessException("转科申请状态不允许完成");
        }

        TransferRequest before = copyTransfer(transfer);
        transfer.setStatus(TransferStatus.COMPLETED);
        transfer.setCompleteTime(LocalDateTime.now());

        final String portCode = transfer.getOxygenPortCode();
        final String patientId = transfer.getPatientId();

        if (releaseResources) {
            transfer.setResourcesReleased(true);
            transfer.setReleaseTime(LocalDateTime.now());
            if (portCode != null) {
                bookingService.getActiveBookings().stream()
                        .filter(b -> b.getOxygenPortCode().equals(portCode)
                                && b.getPatientId().equals(patientId))
                        .findFirst()
                        .ifPresent(b -> bookingService.completeBooking(b.getBookingNumber(), operator));
            }
        }

        transfer = transferRepository.save(transfer);

        auditService.logOperation("COMPLETE", "TRANSFER", transferNumber, before, transfer, operator,
                releaseResources ? "转科完成并释放资源" : "转科完成待释放资源");

        return transfer;
    }

    @Transactional
    public TransferRequest releaseTransferResources(String transferNumber, String operator) {
        TransferRequest transfer = getTransfer(transferNumber);

        if (transfer.getStatus() != TransferStatus.COMPLETED) {
            throw new BusinessException("转科申请未完成，无法释放资源");
        }

        if (transfer.getResourcesReleased()) {
            auditService.logDuplicateOperation("RELEASE", "TRANSFER", transferNumber, transferNumber, operator);
            return transfer;
        }

        TransferRequest before = copyTransfer(transfer);
        transfer.setResourcesReleased(true);
        transfer.setReleaseTime(LocalDateTime.now());

        final String releasePortCode = transfer.getOxygenPortCode();
        final String releasePatientId = transfer.getPatientId();

        if (releasePortCode != null) {
            bookingService.getActiveBookings().stream()
                    .filter(b -> b.getOxygenPortCode().equals(releasePortCode)
                            && b.getPatientId().equals(releasePatientId))
                    .findFirst()
                    .ifPresent(b -> bookingService.completeBooking(b.getBookingNumber(), operator));
        }

        transfer = transferRepository.save(transfer);

        auditService.logOperation("RELEASE", "TRANSFER", transferNumber, before, transfer, operator, "转科资源已释放");

        return transfer;
    }

    @Transactional
    public TransferRequest overrideTransfer(String transferNumber, String reason, String operator, TransferStatus newStatus) {
        TransferRequest transfer = getTransfer(transferNumber);

        TransferRequest before = copyTransfer(transfer);
        transfer.setStatus(newStatus);
        transfer.setIsOverridden(true);
        transfer.setOverrideReason(reason);
        transfer.setOverrideOperator(operator);

        if (newStatus == TransferStatus.COMPLETED) {
            transfer.setResourcesReleased(true);
            transfer.setReleaseTime(LocalDateTime.now());
        }

        transfer = transferRepository.save(transfer);

        auditService.logOperation("OVERRIDE", "TRANSFER", transferNumber, before, transfer, operator, reason);

        return transfer;
    }

    public TransferRequest getTransfer(String transferNumber) {
        return transferRepository.findByTransferNumber(transferNumber)
                .orElseThrow(() -> new BusinessException("转科申请不存在"));
    }

    public List<TransferRequest> getTransfersByPatient(String patientId) {
        return transferRepository.findByPatientId(patientId);
    }

    public List<TransferRequest> getUnreleasedTransfers() {
        return transferRepository.findCompletedTransfersWithUnreleasedResources();
    }

    public List<TransferRequest> getAllTransfers() {
        return transferRepository.findAll();
    }

    private TransferRequest copyTransfer(TransferRequest source) {
        TransferRequest copy = new TransferRequest();
        copy.setStatus(source.getStatus());
        copy.setResourcesReleased(source.getResourcesReleased());
        copy.setIsOverridden(source.getIsOverridden());
        return copy;
    }
}
