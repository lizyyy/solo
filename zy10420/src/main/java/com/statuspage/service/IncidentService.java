package com.statuspage.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.statuspage.dto.*;
import com.statuspage.exception.BusinessException;
import com.statuspage.exception.ErrorCode;
import com.statuspage.model.*;
import com.statuspage.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class IncidentService {
    private final IncidentRepository incidentRepository;
    private final AnnouncementRepository announcementRepository;
    private final ConfirmationRepository confirmationRepository;
    private final ExceptionLogRepository exceptionLogRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public Incident createIncident(CreateIncidentRequest request) {
        if (incidentRepository.existsByIncidentNumber(request.getIncidentNumber())) {
            throw new BusinessException(ErrorCode.INCIDENT_ALREADY_EXISTS.getCode(), ErrorCode.INCIDENT_ALREADY_EXISTS.getMessage(), request);
        }

        Incident incident = new Incident();
        incident.setIncidentNumber(request.getIncidentNumber());
        incident.setTitle(request.getTitle());
        incident.setDescription(request.getDescription());
        incident.setServiceStatus(request.getServiceStatus());
        incident.setAffectedServices(request.getAffectedServices());
        incident.setStartTime(LocalDateTime.now());

        incident = incidentRepository.save(incident);

        if (request.getAnnouncementContent() != null) {
            Announcement announcement = new Announcement();
            announcement.setIncident(incident);
            announcement.setVersion(1);
            announcement.setTitle(request.getAnnouncementTitle() != null ? request.getAnnouncementTitle() : request.getTitle());
            announcement.setContent(request.getAnnouncementContent());
            announcement.setServiceStatus(request.getServiceStatus());
            announcement.setIncidentStatus(IncidentStatus.INVESTIGATING);
            announcement.setCreatedBy(request.getCreatedBy());
            announcement.setPublished(true);
            announcement.setPublishedAt(LocalDateTime.now());
            announcementRepository.save(announcement);
        }

        return incident;
    }

    public Incident getIncident(String incidentNumber) {
        return incidentRepository.findByIncidentNumber(incidentNumber)
                .orElseThrow(() -> new BusinessException(ErrorCode.INCIDENT_NOT_FOUND.getCode(), ErrorCode.INCIDENT_NOT_FOUND.getMessage()));
    }

    public List<Incident> getAllIncidents() {
        return incidentRepository.findAllByOrderByCreatedAtDesc();
    }

    public List<Incident> getActiveIncidents() {
        return incidentRepository.findByStatusNot(IncidentStatus.POST_MORTEM);
    }

    @Transactional
    public Announcement createAnnouncement(String incidentNumber, CreateAnnouncementRequest request) {
        Incident incident = getIncident(incidentNumber);

        Integer nextVersion = announcementRepository.countByIncidentId(incident.getId()) + 1;

        Announcement announcement = new Announcement();
        announcement.setIncident(incident);
        announcement.setVersion(nextVersion);
        announcement.setTitle(request.getTitle());
        announcement.setContent(request.getContent());
        announcement.setServiceStatus(request.getServiceStatus());
        announcement.setIncidentStatus(request.getIncidentStatus());
        announcement.setCreatedBy(request.getCreatedBy());

        if (Boolean.TRUE.equals(request.getPublishImmediately())) {
            announcement.setPublished(true);
            announcement.setPublishedAt(LocalDateTime.now());
        }

        if (request.getIncidentStatus() != null && incident.getStatus().canTransitionTo(request.getIncidentStatus())) {
            incident.setStatus(request.getIncidentStatus());
            if (request.getIncidentStatus() == IncidentStatus.RESOLVED || request.getIncidentStatus() == IncidentStatus.POST_MORTEM) {
                incident.setEndTime(LocalDateTime.now());
            }
        }
        incident.setServiceStatus(request.getServiceStatus());

        return announcementRepository.save(announcement);
    }

    public List<Announcement> getAnnouncements(String incidentNumber) {
        Incident incident = getIncident(incidentNumber);
        return announcementRepository.findByIncidentIdOrderByVersionDesc(incident.getId());
    }

    @Transactional
    public Confirmation confirmAnnouncement(String incidentNumber, ConfirmationRequest request) {
        Incident incident = getIncident(incidentNumber);

        Announcement announcement = announcementRepository.findById(request.getAnnouncementId())
                .orElseThrow(() -> new BusinessException(ErrorCode.ANNOUNCEMENT_NOT_FOUND.getCode(), ErrorCode.ANNOUNCEMENT_NOT_FOUND.getMessage()));

        if (!announcement.getIncident().getId().equals(incident.getId())) {
            throw new BusinessException(ErrorCode.ANNOUNCEMENT_NOT_FOUND.getCode(), "公告不属于该事故");
        }

        if (confirmationRepository.existsByIncidentIdAndAnnouncementIdAndSubscriberId(
                incident.getId(), request.getAnnouncementId(), request.getSubscriberId())) {
            throw new BusinessException(ErrorCode.CONFIRMATION_DUPLICATE.getCode(), ErrorCode.CONFIRMATION_DUPLICATE.getMessage(), request);
        }

        Confirmation confirmation = new Confirmation();
        confirmation.setIncident(incident);
        confirmation.setAnnouncement(announcement);
        confirmation.setSubscriberId(request.getSubscriberId());
        confirmation.setSubscriberName(request.getSubscriberName());
        confirmation.setNote(request.getNote());
        confirmation.setConfirmedBy(request.getConfirmedBy() != null ? request.getConfirmedBy() : request.getSubscriberId());

        return confirmationRepository.save(confirmation);
    }

    public List<Confirmation> getConfirmations(String incidentNumber) {
        Incident incident = getIncident(incidentNumber);
        return confirmationRepository.findByIncidentIdOrderByConfirmedAtDesc(incident.getId());
    }

    public List<Confirmation> getAnnouncementConfirmations(Long announcementId) {
        return confirmationRepository.findByAnnouncementIdOrderByConfirmedAtDesc(announcementId);
    }

    @Transactional
    public Incident transitionStatus(String incidentNumber, StatusTransitionRequest request) {
        Incident incident = getIncident(incidentNumber);

        if (request.getIncidentStatus() != null) {
            if (!incident.getStatus().canTransitionTo(request.getIncidentStatus())) {
                logException(incidentNumber, "STATUS_TRANSITION", ErrorCode.INVALID_STATUS_TRANSITION.getCode(),
                        String.format("无法从 %s 转换到 %s", incident.getStatus(), request.getIncidentStatus()),
                        request);
                throw new BusinessException(ErrorCode.INVALID_STATUS_TRANSITION.getCode(),
                        String.format("无法从 %s 转换到 %s", incident.getStatus().getDescription(), request.getIncidentStatus().getDescription()),
                        request);
            }
            incident.setStatus(request.getIncidentStatus());

            if (request.getIncidentStatus() == IncidentStatus.RESOLVED || request.getIncidentStatus() == IncidentStatus.POST_MORTEM) {
                incident.setEndTime(LocalDateTime.now());
            }
        }

        if (request.getServiceStatus() != null) {
            incident.setServiceStatus(request.getServiceStatus());
        }

        return incidentRepository.save(incident);
    }

    @Transactional
    public Incident manualCorrect(String incidentNumber, ManualCorrectionRequest request) {
        Incident incident = getIncident(incidentNumber);

        if (request.getTitle() != null) {
            incident.setTitle(request.getTitle());
        }
        if (request.getDescription() != null) {
            incident.setDescription(request.getDescription());
        }
        if (request.getIncidentStatus() != null) {
            incident.setStatus(request.getIncidentStatus());
        }
        if (request.getServiceStatus() != null) {
            incident.setServiceStatus(request.getServiceStatus());
        }
        if (request.getAffectedServices() != null) {
            incident.setAffectedServices(request.getAffectedServices());
        }
        if (request.getReviewSummary() != null) {
            incident.setReviewSummary(request.getReviewSummary());
        }

        return incidentRepository.save(incident);
    }

    private void logException(String incidentNumber, String operation, String errorCode, String errorMessage, Object originalInput) {
        try {
            ExceptionLog log = new ExceptionLog();
            log.setIncidentNumber(incidentNumber);
            log.setOperation(operation);
            log.setErrorCode(errorCode);
            log.setErrorMessage(errorMessage);
            log.setOriginalInput(objectMapper.writeValueAsString(originalInput));
            log.setProcessingConclusion("操作被拒绝，请检查参数或联系管理员");
            exceptionLogRepository.save(log);
        } catch (Exception e) {
            log.error("记录异常日志失败", e);
        }
    }

    public List<ExceptionLog> getExceptionLogs(String incidentNumber) {
        return exceptionLogRepository.findByIncidentNumberOrderByCreatedAtDesc(incidentNumber);
    }

    public List<ExceptionLog> getAllExceptionLogs() {
        return exceptionLogRepository.findAllByOrderByCreatedAtDesc();
    }

    @Transactional
    public ExceptionLog resolveExceptionLog(Long exceptionLogId, String conclusion, String resolvedBy) {
        ExceptionLog log = exceptionLogRepository.findById(exceptionLogId)
                .orElseThrow(() -> new BusinessException(ErrorCode.EXCEPTION_LOG_NOT_FOUND.getCode(), ErrorCode.EXCEPTION_LOG_NOT_FOUND.getMessage()));
        log.setResolved(true);
        log.setResolvedAt(LocalDateTime.now());
        log.setResolvedBy(resolvedBy);
        if (conclusion != null) {
            log.setProcessingConclusion(conclusion);
        }
        return exceptionLogRepository.save(log);
    }
}