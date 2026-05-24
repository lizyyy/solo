package com.hazardous.waste.service;

import com.hazardous.waste.config.WasteStorageConfig;
import com.hazardous.waste.entity.AlertRecord;
import com.hazardous.waste.entity.WasteRecord;
import com.hazardous.waste.enums.WasteStatus;
import com.hazardous.waste.repository.AlertRecordRepository;
import com.hazardous.waste.repository.WasteRecordRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class AlertService {

    private AlertRecordRepository alertRecordRepository;
    private WasteRecordRepository wasteRecordRepository;
    private WasteStorageConfig storageConfig;

    @Scheduled(cron = "0 0 8 * * ?")
    @Transactional
    public void checkOverdueWaste() {
        LocalDateTime cutoffTime = LocalDateTime.now().minusDays(storageConfig.getMaxStorageDays());
        List<WasteRecord> overdueRecords = wasteRecordRepository.findOverdueRecords(
                WasteStatus.STORING, cutoffTime);

        for (WasteRecord record : overdueRecords) {
            record.setIsOverdue(true);
            record.setStatus(WasteStatus.OVERDUE);
            record.setStorageDays(storageConfig.getMaxStorageDays() + 1);
            record.setDisposalReason(record.getDisposalReason() + " | 超期告警: 暂存超过" + storageConfig.getMaxStorageDays() + "天");
            record.getOperationLogs().add(new WasteRecord.OperationLog(
                    "超期告警",
                    "SYSTEM",
                    "暂存超期，已超过" + storageConfig.getMaxStorageDays() + "天"
            ));
            wasteRecordRepository.save(record);

            createAlert(
                    "OVERDUE",
                    "HIGH",
                    record.getRecordNo(),
                    String.format("危废记录 %s 已超期暂存 %d 天，请尽快转运处置",
                            record.getRecordNo(), record.getStorageDays())
            );
        }
    }

    @Transactional
    public AlertRecord createAlert(String alertType, String alertLevel, String relatedRecordNo, String content) {
        AlertRecord alert = new AlertRecord();
        alert.setAlertType(alertType);
        alert.setAlertLevel(alertLevel);
        alert.setRelatedRecordNo(relatedRecordNo);
        alert.setAlertContent(content);
        return alertRecordRepository.save(alert);
    }

    public List<AlertRecord> getUnhandledAlerts() {
        return alertRecordRepository.findByIsHandled(false);
    }

    public List<AlertRecord> getAllAlerts() {
        return alertRecordRepository.findAll();
    }

    @Transactional
    public AlertRecord handleAlert(Long alertId, String handler, String remark) {
        AlertRecord alert = alertRecordRepository.findById(alertId)
                .orElseThrow(() -> new RuntimeException("告警不存在"));
        alert.setIsHandled(true);
        alert.setIsRead(true);
        alert.setHandler(handler);
        alert.setHandleTime(LocalDateTime.now());
        alert.setHandleRemark(remark);
        return alertRecordRepository.save(alert);
    }

    @Transactional
    public void markAsRead(Long alertId) {
        AlertRecord alert = alertRecordRepository.findById(alertId)
                .orElseThrow(() -> new RuntimeException("告警不存在"));
        alert.setIsRead(true);
        alertRecordRepository.save(alert);
    }
}
