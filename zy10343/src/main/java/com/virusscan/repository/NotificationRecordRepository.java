package com.virusscan.repository;

import com.virusscan.entity.NotificationRecord;
import com.virusscan.enums.NotificationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface NotificationRecordRepository extends JpaRepository<NotificationRecord, Long> {
    Optional<NotificationRecord> findByNotificationId(String notificationId);
    List<NotificationRecord> findByTaskId(String taskId);
    List<NotificationRecord> findByFileId(String fileId);
    List<NotificationRecord> findByStatus(NotificationStatus status);
    List<NotificationRecord> findByRecipient(String recipient);
    List<NotificationRecord> findByCreateTimeBetween(LocalDateTime start, LocalDateTime end);
    boolean existsByNotificationId(String notificationId);
}