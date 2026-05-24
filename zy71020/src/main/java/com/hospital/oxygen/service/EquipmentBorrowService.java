package com.hospital.oxygen.service;

import com.hospital.oxygen.common.BusinessException;
import com.hospital.oxygen.dto.BorrowRequest;
import com.hospital.oxygen.entity.Equipment;
import com.hospital.oxygen.entity.EquipmentBorrow;
import com.hospital.oxygen.enums.BorrowStatus;
import com.hospital.oxygen.repository.EquipmentBorrowRepository;
import com.hospital.oxygen.repository.EquipmentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class EquipmentBorrowService {

    private static final Logger log = LoggerFactory.getLogger(EquipmentBorrowService.class);

    private final EquipmentBorrowRepository borrowRepository;
    private final EquipmentRepository equipmentRepository;
    private final RuleEngineService ruleEngineService;
    private final AuditService auditService;

    public EquipmentBorrowService(EquipmentBorrowRepository borrowRepository, EquipmentRepository equipmentRepository, RuleEngineService ruleEngineService, AuditService auditService) {
        this.borrowRepository = borrowRepository;
        this.equipmentRepository = equipmentRepository;
        this.ruleEngineService = ruleEngineService;
        this.auditService = auditService;
    }

    @Transactional
    public EquipmentBorrow requestBorrow(BorrowRequest request) {
        log.info("创建设备借用申请: 设备={}, 患者={}", request.getEquipmentCode(), request.getPatientId());

        RuleEngineService.RuleResult ruleResult = ruleEngineService.validateBorrow(
                request.getEquipmentCode(), request.getPatientId());

        String borrowNumber = "BR" + System.currentTimeMillis();

        EquipmentBorrow borrow = new EquipmentBorrow();
        borrow.setBorrowNumber(borrowNumber);
        borrow.setEquipmentCode(request.getEquipmentCode());
        borrow.setPatientId(request.getPatientId());
        borrow.setBorrower(request.getBorrower());
        borrow.setBorrowWard(request.getBorrowWard());
        borrow.setExpectedReturnTime(request.getExpectedReturnTime());
        borrow.setRemarks(request.getRemarks());
        borrow.setOperator(request.getOperator());
        borrow.setStatus(BorrowStatus.REQUESTED);

        if (!ruleResult.isPassed()) {
            borrow.setStatus(BorrowStatus.CANCELLED);
            borrow = borrowRepository.save(borrow);
            auditService.logOperation("CREATE_REJECTED", "BORROW", borrowNumber, null, borrow, request.getOperator(), String.join(";", ruleResult.getViolations()));
            log.info("借用申请被拒绝: {}, 原因: {}", borrowNumber, ruleResult.getViolations());
            return borrow;
        }

        borrow = borrowRepository.save(borrow);

        auditService.logOperation("CREATE", "BORROW", borrowNumber, null, borrow, request.getOperator(), "借用申请创建");

        return borrow;
    }

    @Transactional
    public EquipmentBorrow approveBorrow(String borrowNumber, String operator) {
        EquipmentBorrow borrow = getBorrow(borrowNumber);

        if (borrow.getStatus() != BorrowStatus.REQUESTED) {
            if (borrow.getStatus() == BorrowStatus.APPROVED) {
                auditService.logDuplicateOperation("APPROVE", "BORROW", borrowNumber, borrowNumber, operator);
                return borrow;
            }
            throw new BusinessException("借用申请状态不允许审批");
        }

        EquipmentBorrow before = copyBorrow(borrow);
        borrow.setStatus(BorrowStatus.APPROVED);
        borrow.setApproveTime(LocalDateTime.now());
        borrow = borrowRepository.save(borrow);

        auditService.logOperation("APPROVE", "BORROW", borrowNumber, before, borrow, operator, "借用申请已批准");

        return borrow;
    }

    @Transactional
    public EquipmentBorrow borrowEquipment(String borrowNumber, String operator) {
        EquipmentBorrow borrow = getBorrow(borrowNumber);

        if (borrow.getStatus() != BorrowStatus.APPROVED) {
            if (borrow.getStatus() == BorrowStatus.BORROWED) {
                auditService.logDuplicateOperation("BORROW", "BORROW", borrowNumber, borrowNumber, operator);
                return borrow;
            }
            throw new BusinessException("借用申请状态不允许借出");
        }

        Equipment equipment = equipmentRepository.findByEquipmentCode(borrow.getEquipmentCode())
                .orElseThrow(() -> new BusinessException("设备不存在"));

        if (!equipment.getIsAvailable()) {
            throw new BusinessException("设备当前不可用");
        }

        EquipmentBorrow before = copyBorrow(borrow);
        borrow.setStatus(BorrowStatus.BORROWED);
        borrow.setBorrowTime(LocalDateTime.now());
        borrow = borrowRepository.save(borrow);

        equipment.setIsAvailable(false);
        equipmentRepository.save(equipment);

        auditService.logOperation("BORROW", "BORROW", borrowNumber, before, borrow, operator, "设备已借出");

        return borrow;
    }

    @Transactional
    public EquipmentBorrow returnEquipment(String borrowNumber, String operator) {
        EquipmentBorrow borrow = getBorrow(borrowNumber);

        if (borrow.getStatus() != BorrowStatus.BORROWED && borrow.getStatus() != BorrowStatus.OVERDUE) {
            if (borrow.getStatus() == BorrowStatus.RETURNED) {
                auditService.logDuplicateOperation("RETURN", "BORROW", borrowNumber, borrowNumber, operator);
                return borrow;
            }
            throw new BusinessException("借用申请状态不允许归还");
        }

        EquipmentBorrow before = copyBorrow(borrow);
        borrow.setStatus(BorrowStatus.RETURNED);
        borrow.setActualReturnTime(LocalDateTime.now());
        borrow = borrowRepository.save(borrow);

        equipmentRepository.findByEquipmentCode(borrow.getEquipmentCode()).ifPresent(equipment -> {
            equipment.setIsAvailable(true);
            equipmentRepository.save(equipment);
        });

        auditService.logOperation("RETURN", "BORROW", borrowNumber, before, borrow, operator, "设备已归还");

        return borrow;
    }

    @Transactional
    public void checkOverdueBorrows() {
        List<EquipmentBorrow> overdueList = borrowRepository.findOverdueBorrows(LocalDateTime.now());
        for (EquipmentBorrow borrow : overdueList) {
            if (borrow.getStatus() == BorrowStatus.BORROWED) {
                EquipmentBorrow before = copyBorrow(borrow);
                borrow.setStatus(BorrowStatus.OVERDUE);
                borrowRepository.save(borrow);
                auditService.logOperation("MARK_OVERDUE", "BORROW", borrow.getBorrowNumber(), before, borrow, "SYSTEM", "设备借用超时");
                log.warn("设备借用已超时: {}", borrow.getBorrowNumber());
            }
        }
    }

    @Transactional
    public EquipmentBorrow overrideBorrow(String borrowNumber, String reason, String operator, BorrowStatus newStatus) {
        EquipmentBorrow borrow = getBorrow(borrowNumber);

        EquipmentBorrow before = copyBorrow(borrow);
        borrow.setStatus(newStatus);
        borrow.setIsOverridden(true);
        borrow.setOverrideReason(reason);
        borrow.setOverrideOperator(operator);

        if (newStatus == BorrowStatus.RETURNED || newStatus == BorrowStatus.CANCELLED) {
            equipmentRepository.findByEquipmentCode(borrow.getEquipmentCode()).ifPresent(equipment -> {
                equipment.setIsAvailable(true);
                equipmentRepository.save(equipment);
            });
        } else if (newStatus == BorrowStatus.BORROWED) {
            equipmentRepository.findByEquipmentCode(borrow.getEquipmentCode()).ifPresent(equipment -> {
                equipment.setIsAvailable(false);
                equipmentRepository.save(equipment);
            });
        }

        borrow = borrowRepository.save(borrow);

        auditService.logOperation("OVERRIDE", "BORROW", borrowNumber, before, borrow, operator, reason);

        return borrow;
    }

    public EquipmentBorrow getBorrow(String borrowNumber) {
        return borrowRepository.findByBorrowNumber(borrowNumber)
                .orElseThrow(() -> new BusinessException("借用申请不存在"));
    }

    public List<EquipmentBorrow> getBorrowsByPatient(String patientId) {
        return borrowRepository.findByPatientId(patientId);
    }

    public List<EquipmentBorrow> getBorrowsByEquipment(String equipmentCode) {
        return borrowRepository.findByEquipmentCode(equipmentCode);
    }

    public List<EquipmentBorrow> getOverdueBorrows() {
        return borrowRepository.findOverdueBorrows(LocalDateTime.now());
    }

    public List<EquipmentBorrow> getAllBorrows() {
        return borrowRepository.findAll();
    }

    private EquipmentBorrow copyBorrow(EquipmentBorrow source) {
        EquipmentBorrow copy = new EquipmentBorrow();
        copy.setStatus(source.getStatus());
        copy.setIsOverridden(source.getIsOverridden());
        return copy;
    }
}
