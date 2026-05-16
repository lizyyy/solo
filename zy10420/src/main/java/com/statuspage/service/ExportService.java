package com.statuspage.service;

import com.statuspage.dto.ExportResult;
import com.statuspage.exception.BusinessException;
import com.statuspage.exception.ErrorCode;
import com.statuspage.model.*;
import com.statuspage.repository.AnnouncementRepository;
import com.statuspage.repository.ConfirmationRepository;
import com.statuspage.repository.IncidentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExportService {
    private final IncidentRepository incidentRepository;
    private final AnnouncementRepository announcementRepository;
    private final ConfirmationRepository confirmationRepository;

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    public ExportResult exportIncidentSummary(String incidentNumber) {
        Incident incident = incidentRepository.findByIncidentNumber(incidentNumber)
                .orElseThrow(() -> new BusinessException(ErrorCode.INCIDENT_NOT_FOUND.getCode(), ErrorCode.INCIDENT_NOT_FOUND.getMessage()));

        List<Announcement> announcements = announcementRepository.findByIncidentIdOrderByVersionDesc(incident.getId());
        List<Confirmation> confirmations = confirmationRepository.findByIncidentIdOrderByConfirmedAtDesc(incident.getId());

        StringBuilder markdown = generateMarkdownSummary(incident, announcements, confirmations);

        ExportResult result = new ExportResult();
        result.setIncidentNumber(incidentNumber);
        result.setTitle(incident.getTitle());
        result.setContentType("text/markdown");
        result.setContent(markdown);
        result.setGeneratedAt(LocalDateTime.now());
        result.setFileName(String.format("incident-%s-summary.md", incidentNumber));
        result.setAnnouncementCount(announcements.size());
        result.setConfirmationCount(confirmations.size());

        return result;
    }

    private String generateMarkdownSummary(Incident incident, List<Announcement> announcements, List<Confirmation> confirmations) {
        StringBuilder sb = new StringBuilder();

        sb.append("# 事故复盘摘要\n\n");
        sb.append("## 基本信息\n\n");
        sb.append("- **事故编号**: ").append(incident.getIncidentNumber()).append("\n");
        sb.append("- **标题**: ").append(incident.getTitle()).append("\n");
        sb.append("- **状态**: ").append(incident.getStatus().getDescription()).append("\n");
        sb.append("- **服务状态**: ").append(incident.getServiceStatus().getDescription()).append("\n");
        sb.append("- **影响服务**: ").append(incident.getAffectedServices() != null ? incident.getAffectedServices() : "无").append("\n");
        sb.append("- **开始时间**: ").append(incident.getStartTime() != null ? incident.getStartTime().format(FORMATTER) : "未知").append("\n");
        sb.append("- **结束时间**: ").append(incident.getEndTime() != null ? incident.getEndTime().format(FORMATTER) : "进行中").append("\n");

        if (incident.getStartTime() != null && incident.getEndTime() != null) {
            Duration duration = Duration.between(incident.getStartTime(), incident.getEndTime());
            sb.append("- **持续时间**: ").append(formatDuration(duration)).append("\n");
        }
        sb.append("\n");

        sb.append("## 描述\n\n");
        sb.append(incident.getDescription() != null ? incident.getDescription() : "无").append("\n\n");

        sb.append("## 公告历史\n\n");
        if (announcements.isEmpty()) {
            sb.append("无公告记录\n\n");
        } else {
            for (Announcement ann : announcements) {
                sb.append("### 公告 v").append(ann.getVersion()).append("\n\n");
                sb.append("- **标题**: ").append(ann.getTitle()).append("\n");
                sb.append("- **创建人**: ").append(ann.getCreatedBy()).append("\n");
                sb.append("- **创建时间**: ").append(ann.getCreatedAt().format(FORMATTER)).append("\n");
                sb.append("- **服务状态**: ").append(ann.getServiceStatus().getDescription()).append("\n");
                if (ann.getIncidentStatus() != null) {
                    sb.append("- **事故状态**: ").append(ann.getIncidentStatus().getDescription()).append("\n");
                }
                sb.append("- **发布状态**: ").append(ann.getPublished() ? "已发布" : "草稿").append("\n\n");
                sb.append("**内容**:\n\n");
                sb.append(ann.getContent()).append("\n\n");

                long confCount = confirmations.stream().filter(c -> c.getAnnouncement().getId().equals(ann.getId())).count();
                sb.append("- **确认数**: ").append(confCount).append("\n\n");
                sb.append("---\n\n");
            }
        }

        sb.append("## 订阅方确认\n\n");
        if (confirmations.isEmpty()) {
            sb.append("无确认记录\n\n");
        } else {
            sb.append("| 订阅方ID | 订阅方名称 | 确认时间 | 备注 | 确认人 |\n");
            sb.append("|----------|------------|----------|------|--------|\n");
            for (Confirmation conf : confirmations) {
                sb.append("| ").append(conf.getSubscriberId()).append(" | ");
                sb.append(conf.getSubscriberName() != null ? conf.getSubscriberName() : "-").append(" | ");
                sb.append(conf.getConfirmedAt().format(FORMATTER)).append(" | ");
                sb.append(conf.getNote() != null ? conf.getNote() : "-").append(" | ");
                sb.append(conf.getConfirmedBy() != null ? conf.getConfirmedBy() : "-").append(" |\n");
            }
            sb.append("\n");
        }

        sb.append("## 复盘总结\n\n");
        sb.append(incident.getReviewSummary() != null ? incident.getReviewSummary() : "暂无复盘总结").append("\n\n");

        sb.append("---\n");
        sb.append("*此报告由状态页公告API自动生成于 ").append(LocalDateTime.now().format(FORMATTER)).append("*\n");

        return sb.toString();
    }

    private String formatDuration(Duration duration) {
        long hours = duration.toHours();
        long minutes = duration.toMinutes() % 60;
        if (hours > 0) {
            return String.format("%d小时%d分钟", hours, minutes);
        } else {
            return String.format("%d分钟", minutes);
        }
    }
}