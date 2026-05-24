package com.school.canteen.service;

import com.school.canteen.dto.ReplacementRequestDto;
import com.school.canteen.dto.ValidationResult;
import com.school.canteen.entity.*;
import com.school.canteen.exception.BusinessException;
import com.school.canteen.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ReplacementService {

    private static final Logger log = LoggerFactory.getLogger(ReplacementService.class);

    private final ReplacementRequestRepository replacementRepository;
    private final DishRepository dishRepository;
    private final StudentRepository studentRepository;
    private final ParentConfirmationRepository confirmationRepository;

    @Autowired
    public ReplacementService(ReplacementRequestRepository replacementRepository,
                              DishRepository dishRepository,
                              StudentRepository studentRepository,
                              ParentConfirmationRepository confirmationRepository) {
        this.replacementRepository = replacementRepository;
        this.dishRepository = dishRepository;
        this.studentRepository = studentRepository;
        this.confirmationRepository = confirmationRepository;
    }

    @Transactional
    public ReplacementRequest createReplacement(ReplacementRequestDto dto) {
        log.info("创建替换请求: {}", dto);

        Dish originalDish = dishRepository.findById(dto.getOriginalDishId())
            .orElseThrow(() -> new BusinessException("原菜品不存在", "DISH_NOT_FOUND"));

        Dish replacementDish = dishRepository.findById(dto.getReplacementDishId())
            .orElseThrow(() -> new BusinessException("替换菜品不存在", "DISH_NOT_FOUND"));

        if (dto.getOriginalDishId().equals(dto.getReplacementDishId())) {
            throw new BusinessException("原菜品和替换菜品不能相同", "SAME_DISH");
        }

        String requestNo = generateRequestNo();

        ReplacementRequest request = new ReplacementRequest();
        request.setRequestNo(requestNo);
        request.setMealDate(dto.getMealDate());
        request.setMealType(dto.getMealType());
        request.setOriginalDish(originalDish);
        request.setReplacementDish(replacementDish);
        request.setReason(dto.getReason());
        request.setStatus(ReplacementStatus.DRAFT);
        request.setCreatedBy(dto.getCreatedBy() != null ? dto.getCreatedBy() : "system");
        request.setCreatedAt(LocalDateTime.now());
        request.setLocked(false);

        return replacementRepository.save(request);
    }

    @Transactional(readOnly = true)
    public ValidationResult validateReplacement(Long replacementId) {
        log.info("校验替换请求: {}", replacementId);

        ReplacementRequest request = replacementRepository.findById(replacementId)
            .orElseThrow(() -> new BusinessException("替换请求不存在", "REPLACEMENT_NOT_FOUND"));

        ValidationResult result = new ValidationResult();

        validateMealLock(request, result);

        validateDuplicateReplacement(request, result);

        validateAllergenConflict(request, result);

        return result;
    }

    private void validateMealLock(ReplacementRequest request, ValidationResult result) {
        List<ReplacementRequest> locked = replacementRepository.findLockedReplacements(
            request.getMealDate(), request.getMealType());

        if (!locked.isEmpty()) {
            result.setMealLocked(true);
            result.addError("该餐次已被锁定，无法修改");
        }
    }

    private void validateDuplicateReplacement(ReplacementRequest request, ValidationResult result) {
        List<ReplacementStatus> excludedStatuses = Arrays.asList(
            ReplacementStatus.REVOKED, ReplacementStatus.REJECTED);

        boolean exists = replacementRepository.existsDuplicateReplacement(
            request.getMealDate(),
            request.getMealType(),
            request.getOriginalDish().getId(),
            excludedStatuses,
            request.getId()
        );

        if (exists) {
            result.setHasDuplicateReplacement(true);
            result.addError("该餐次的此菜品已有进行中的替换请求");
        }
    }

    private void validateAllergenConflict(ReplacementRequest request, ValidationResult result) {
        Set<Allergen> originalAllergens = request.getOriginalDish().getAllergens();
        Set<Allergen> replacementAllergens = request.getReplacementDish().getAllergens();

        Set<Allergen> commonAllergens = new HashSet<>(originalAllergens);
        commonAllergens.retainAll(replacementAllergens);

        Set<Allergen> newAllergens = new HashSet<>(replacementAllergens);
        newAllergens.removeAll(originalAllergens);

        if (!newAllergens.isEmpty()) {
            result.setHasAllergenConflict(true);
            result.addWarning("替换菜品含有原菜品没有的过敏原: " +
                newAllergens.stream().map(Allergen::getName).collect(Collectors.joining(", ")));

            List<Long> newAllergenIds = newAllergens.stream()
                .map(Allergen::getId)
                .collect(Collectors.toList());

            Set<Student> affectedStudents = studentRepository.findByAllergenIds(newAllergenIds);

            ValidationResult.AllergenConflictDetail detail = new ValidationResult.AllergenConflictDetail();
            detail.setCommonAllergens(commonAllergens.stream()
                .map(Allergen::getName).collect(Collectors.toList()));
            detail.setAffectedCount(affectedStudents.size());

            List<ValidationResult.AffectedStudentInfo> studentInfos = affectedStudents.stream()
                .map(s -> {
                    ValidationResult.AffectedStudentInfo info = new ValidationResult.AffectedStudentInfo();
                    info.setStudentNo(s.getStudentNo());
                    info.setStudentName(s.getName());
                    info.setGrade(s.getGrade());
                    info.setClassName(s.getClassName());
                    info.setAllergens(s.getAllergens().stream()
                        .map(Allergen::getName).collect(Collectors.toList()));
                    info.setParentPhone(s.getParentPhone());
                    info.setParentEmail(s.getParentEmail());
                    return info;
                }).collect(Collectors.toList());

            detail.setAffectedStudents(studentInfos);
            result.setConflictDetail(detail);
        }

        if (!commonAllergens.isEmpty()) {
            result.addWarning("替换菜品与原菜品含有相同过敏原: " +
                commonAllergens.stream().map(Allergen::getName).collect(Collectors.joining(", ")));
        }
    }

    @Transactional
    public ReplacementRequest processValidation(Long replacementId, ValidationResult validationResult) {
        ReplacementRequest request = replacementRepository.findById(replacementId)
            .orElseThrow(() -> new BusinessException("替换请求不存在", "REPLACEMENT_NOT_FOUND"));

        if (!Arrays.asList(ReplacementStatus.DRAFT, ReplacementStatus.VALIDATING).contains(request.getStatus())) {
            throw new BusinessException("当前状态不允许执行校验", "INVALID_STATUS");
        }

        request.setStatus(ReplacementStatus.VALIDATING);
        request.setUpdatedAt(LocalDateTime.now());

        StringBuilder validationNotes = new StringBuilder();
        validationNotes.append("校验时间: ").append(LocalDateTime.now()).append("\n");

        if (!validationResult.getErrors().isEmpty()) {
            validationNotes.append("错误: ").append(String.join("; ", validationResult.getErrors())).append("\n");
        }
        if (!validationResult.getWarnings().isEmpty()) {
            validationNotes.append("警告: ").append(String.join("; ", validationResult.getWarnings())).append("\n");
        }

        request.setValidationNotes(validationNotes.toString());

        if (validationResult.isHasAllergenConflict()) {
            request.setStatus(ReplacementStatus.CONFLICT_DETECTED);
            request.setConflictDetails("检测到过敏原冲突，影响学生数: " +
                validationResult.getConflictDetail().getAffectedCount());

            if (validationResult.getConflictDetail().getAffectedStudents() != null) {
                Set<Student> affectedStudents = validationResult.getConflictDetail().getAffectedStudents().stream()
                    .map(info -> studentRepository.findByStudentNo(info.getStudentNo()).orElse(null))
                    .filter(Objects::nonNull)
                    .collect(Collectors.toSet());
                request.setAffectedStudents(affectedStudents);
            }
        } else if (validationResult.isValid()) {
            request.setStatus(ReplacementStatus.VALIDATED);
        }

        return replacementRepository.save(request);
    }

    @Transactional
    public ReplacementRequest startConfirmation(Long replacementId, String operator) {
        ReplacementRequest request = replacementRepository.findById(replacementId)
            .orElseThrow(() -> new BusinessException("替换请求不存在", "REPLACEMENT_NOT_FOUND"));

        if (!Arrays.asList(ReplacementStatus.VALIDATED, ReplacementStatus.CONFLICT_DETECTED)
            .contains(request.getStatus())) {
            throw new BusinessException("当前状态不允许发起家长确认", "INVALID_STATUS");
        }

        request.setStatus(ReplacementStatus.PENDING_CONFIRMATION);
        request.setUpdatedBy(operator);
        request.setUpdatedAt(LocalDateTime.now());

        for (Student student : request.getAffectedStudents()) {
            if (!confirmationRepository.existsByReplacementIdAndStudentId(replacementId, student.getId())) {
                ParentConfirmation confirmation = new ParentConfirmation();
                confirmation.setReplacement(request);
                confirmation.setStudent(student);
                confirmation.setConfirmationStatus("PENDING");
                confirmation.setCreatedBy(operator);
                confirmation.setCreatedAt(LocalDateTime.now());
                confirmationRepository.save(confirmation);
            }
        }

        return replacementRepository.save(request);
    }

    @Transactional
    public ParentConfirmation submitConfirmation(Long replacementId, Long studentId,
                                                  String status, String comment, String operator) {
        if (!Arrays.asList("CONFIRMED", "REJECTED").contains(status)) {
            throw new BusinessException("回执状态必须是 CONFIRMED 或 REJECTED", "INVALID_CONFIRMATION_STATUS");
        }

        if (confirmationRepository.existsByReplacementIdAndStudentId(replacementId, studentId)) {
            ParentConfirmation existing = confirmationRepository
                .findByReplacementIdAndStudentId(replacementId, studentId).get();
            if (!"PENDING".equals(existing.getConfirmationStatus())) {
                throw new BusinessException("该学生的回执已提交，不可重复提交", "DUPLICATE_CONFIRMATION");
            }
            existing.setConfirmationStatus(status);
            existing.setParentComment(comment);
            existing.setConfirmedBy(operator);
            existing.setConfirmedAt(LocalDateTime.now());
            existing.setUpdatedBy(operator);
            existing.setUpdatedAt(LocalDateTime.now());
            return confirmationRepository.save(existing);
        }

        throw new BusinessException("确认记录不存在", "CONFIRMATION_NOT_FOUND");
    }

    @Transactional
    public ReplacementRequest completeReplacement(Long replacementId, String operator) {
        ReplacementRequest request = replacementRepository.findById(replacementId)
            .orElseThrow(() -> new BusinessException("替换请求不存在", "REPLACEMENT_NOT_FOUND"));

        if (request.getStatus() != ReplacementStatus.PENDING_CONFIRMATION) {
            throw new BusinessException("当前状态不允许完成替换", "INVALID_STATUS");
        }

        long totalCount = confirmationRepository.countByReplacementId(replacementId);
        long confirmedCount = confirmationRepository.countByReplacementIdAndStatus(replacementId, "CONFIRMED");

        if (totalCount > 0 && confirmedCount != totalCount) {
            long pendingCount = confirmationRepository.countByReplacementIdAndStatus(replacementId, "PENDING");
            long rejectedCount = confirmationRepository.countByReplacementIdAndStatus(replacementId, "REJECTED");

            if (pendingCount > 0) {
                throw new BusinessException("存在 " + pendingCount + " 份待确认回执，请先完成所有家长确认", "PENDING_CONFIRMATIONS_EXIST");
            }

            if (rejectedCount > 0) {
                throw new BusinessException("存在 " + rejectedCount + " 份已拒绝回执，需人工复核后才能完成", "REJECTED_CONFIRMATIONS_EXIST");
            }

            long unknownCount = totalCount - confirmedCount - pendingCount - rejectedCount;
            if (unknownCount > 0) {
                throw new BusinessException("存在 " + unknownCount + " 份状态异常的回执", "INVALID_CONFIRMATION_STATUS");
            }
        }

        request.setStatus(ReplacementStatus.CONFIRMED);
        request.setUpdatedBy(operator);
        request.setUpdatedAt(LocalDateTime.now());

        request.setStatus(ReplacementStatus.PROCESSING);
        request.setStatus(ReplacementStatus.COMPLETED);

        return replacementRepository.save(request);
    }

    @Transactional
    public ReplacementRequest revokeReplacement(Long replacementId, String reason, String operator) {
        ReplacementRequest request = replacementRepository.findById(replacementId)
            .orElseThrow(() -> new BusinessException("替换请求不存在", "REPLACEMENT_NOT_FOUND"));

        if (request.getLocked()) {
            throw new BusinessException("该替换已锁定，无法撤销", "LOCKED");
        }

        if (Arrays.asList(ReplacementStatus.REVOKED, ReplacementStatus.COMPLETED).contains(request.getStatus())) {
            throw new BusinessException("当前状态不允许撤销", "INVALID_STATUS");
        }

        request.setStatus(ReplacementStatus.REVOKING);
        request.setUpdatedBy(operator);
        request.setUpdatedAt(LocalDateTime.now());

        request.setStatus(ReplacementStatus.REVOKED);
        request.setRevokedBy(operator);
        request.setRevokedAt(LocalDateTime.now());
        request.setReason(request.getReason() + " [撤销原因: " + reason + "]");

        return replacementRepository.save(request);
    }

    @Transactional
    public ReplacementRequest reviewReplacement(Long replacementId, boolean approved,
                                            String reviewNotes, String reviewer) {
        ReplacementRequest request = replacementRepository.findById(replacementId)
            .orElseThrow(() -> new BusinessException("替换请求不存在", "REPLACEMENT_NOT_FOUND"));

        if (!Arrays.asList(ReplacementStatus.CONFLICT_DETECTED, ReplacementStatus.VALIDATED)
            .contains(request.getStatus())) {
            throw new BusinessException("当前状态不允许复核", "INVALID_STATUS");
        }

        if (approved) {
            request.setStatus(ReplacementStatus.VALIDATED);
        } else {
            request.setStatus(ReplacementStatus.REJECTED);
        }

        request.setReviewedBy(reviewer);
        request.setReviewedAt(LocalDateTime.now());
        request.setValidationNotes(request.getValidationNotes() +
            "\n复核意见: " + reviewNotes +
            "\n复核人: " + reviewer);

        return replacementRepository.save(request);
    }

    @Transactional
    public ReplacementRequest lockReplacement(Long replacementId, String operator) {
        ReplacementRequest request = replacementRepository.findById(replacementId)
            .orElseThrow(() -> new BusinessException("替换请求不存在", "REPLACEMENT_NOT_FOUND"));

        if (request.getStatus() != ReplacementStatus.COMPLETED) {
            throw new BusinessException("只有已完成的替换可以锁定", "INVALID_STATUS");
        }

        request.setLocked(true);
        request.setStatus(ReplacementStatus.LOCKED);
        request.setUpdatedBy(operator);
        request.setUpdatedAt(LocalDateTime.now());

        return replacementRepository.save(request);
    }

    @Transactional(readOnly = true)
    public ReplacementRequest getReplacement(Long id) {
        return replacementRepository.findById(id)
            .orElseThrow(() -> new BusinessException("替换请求不存在", "REPLACEMENT_NOT_FOUND"));
    }

    @Transactional(readOnly = true)
    public List<ReplacementRequest> getAllReplacements() {
        return replacementRepository.findAll();
    }

    @Transactional(readOnly = true)
    public List<ParentConfirmation> getConfirmations(Long replacementId) {
        return confirmationRepository.findByReplacementId(replacementId);
    }

    private String generateRequestNo() {
        return "REP" + System.currentTimeMillis();
    }
}
