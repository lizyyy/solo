package com.crossborder.approval.service;

import com.crossborder.approval.exception.BusinessException;
import com.crossborder.approval.model.dto.CreateApplicationRequest;
import com.crossborder.approval.model.entity.DataAccessApplication;
import com.crossborder.approval.model.entity.DataDomain;
import com.crossborder.approval.model.enums.ApplicationStatus;
import com.crossborder.approval.model.enums.RegionType;
import com.crossborder.approval.repository.DataAccessApplicationRepository;
import com.crossborder.approval.repository.DataDomainRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ApplicationService {

    private final DataAccessApplicationRepository applicationRepository;
    private final DataDomainRepository dataDomainRepository;
    private final AuditService auditService;

    @Transactional
    public DataAccessApplication createApplication(CreateApplicationRequest request) {
        DataDomain dataDomain = dataDomainRepository.findByCode(request.getDataDomainCode())
                .orElseThrow(() -> new BusinessException("数据域不存在: " + request.getDataDomainCode()));

        List<DataAccessApplication> duplicates = applicationRepository.findDuplicateApplications(
                request.getApplicantId(),
                dataDomain.getId(),
                request.getTargetRegion()
        );

        if (!duplicates.isEmpty()) {
            throw new BusinessException("存在相同申请人、数据域和目标地区的活跃申请，申请编号: " 
                    + duplicates.get(0).getApplicationNo());
        }

        DataAccessApplication application = new DataAccessApplication();
        application.setApplicationNo(generateApplicationNo());
        application.setApplicantId(request.getApplicantId());
        application.setApplicantName(request.getApplicantName());
        application.setDataDomain(dataDomain);
        application.setTargetRegion(request.getTargetRegion());
        application.setAccessReason(request.getAccessReason());
        application.setAccessStartTime(request.getAccessStartTime());
        application.setAccessEndTime(request.getAccessEndTime());
        application.setStatus(ApplicationStatus.DRAFT);
        application.setRegionValidated(false);

        application = applicationRepository.save(application);

        auditService.logAction(application, "CREATE_APPLICATION",
                request.getApplicantId(), request.getApplicantName(),
                "创建跨境数据访问申请，数据域: " + dataDomain.getName());

        log.info("申请创建成功: {}", application.getApplicationNo());
        return application;
    }

    @Transactional
    public DataAccessApplication submitForRegionValidation(Long applicationId, String operatorId, String operatorName) {
        DataAccessApplication application = getApplication(applicationId);

        if (application.getStatus() != ApplicationStatus.DRAFT) {
            throw new BusinessException("只有草稿状态的申请可以提交地区校验");
        }

        application.setStatus(ApplicationStatus.PENDING_REGION_VALIDATION);
        application = applicationRepository.save(application);

        auditService.logAction(application, "SUBMIT_REGION_VALIDATION",
                operatorId, operatorName, "提交地区校验");

        return application;
    }

    @Transactional
    public DataAccessApplication validateRegion(Long applicationId, boolean approved, 
                                                String rejectReason, String operatorId, String operatorName) {
        DataAccessApplication application = getApplication(applicationId);

        if (application.getStatus() != ApplicationStatus.PENDING_REGION_VALIDATION) {
            throw new BusinessException("只有待地区校验状态的申请可以进行地区校验");
        }

        if (approved) {
            application.setRegionValidated(true);
            application.setStatus(ApplicationStatus.REGION_VALIDATED);
            auditService.logAction(application, "REGION_VALIDATION_PASS",
                    operatorId, operatorName, "地区校验通过，地区: " + application.getTargetRegion());
        } else {
            application.setStatus(ApplicationStatus.REJECTED);
            application.setRejectReason(rejectReason);
            auditService.logAction(application, "REGION_VALIDATION_REJECT",
                    operatorId, operatorName, "地区校验被拒绝: " + rejectReason);
        }

        return applicationRepository.save(application);
    }

    @Transactional
    public DataAccessApplication submitForApproval(Long applicationId, String operatorId, String operatorName) {
        DataAccessApplication application = getApplication(applicationId);

        if (application.getStatus() != ApplicationStatus.REGION_VALIDATED) {
            throw new BusinessException("只有地区校验通过的申请可以提交审批");
        }

        application.setStatus(ApplicationStatus.PENDING_APPROVAL);
        application.setCurrentApprovalLevel(1);
        application = applicationRepository.save(application);

        auditService.logAction(application, "SUBMIT_APPROVAL",
                operatorId, operatorName, "提交审批流程");

        return application;
    }

    public DataAccessApplication getApplication(Long applicationId) {
        return applicationRepository.findById(applicationId)
                .orElseThrow(() -> new BusinessException("申请不存在: " + applicationId));
    }

    public DataAccessApplication getApplicationByNo(String applicationNo) {
        return applicationRepository.findByApplicationNo(applicationNo)
                .orElseThrow(() -> new BusinessException("申请不存在: " + applicationNo));
    }

    public List<DataAccessApplication> getApplicationsByApplicant(String applicantId) {
        return applicationRepository.findByApplicantId(applicantId);
    }

    public List<DataAccessApplication> getApplicationsByStatus(ApplicationStatus status) {
        return applicationRepository.findByStatus(status);
    }

    private String generateApplicationNo() {
        String dateStr = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String uuid = UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        return "CB-" + dateStr + "-" + uuid;
    }

    public List<RegionType> getRestrictedRegions() {
        return List.of(
                RegionType.UNITED_STATES,
                RegionType.EUROPEAN_UNION,
                RegionType.HONG_KONG
        );
    }
}
