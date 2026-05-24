package com.bus.notify.repository;

import com.bus.notify.entity.NotificationRecord;
import com.bus.notify.enums.NotificationChannel;
import com.bus.notify.enums.NotificationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface NotificationRecordRepository extends JpaRepository<NotificationRecord, Long> {
    List<NotificationRecord> findByRouteChangeId(Long routeChangeId);
    
    List<NotificationRecord> findByRouteChangeIdAndStatus(Long routeChangeId, NotificationStatus status);
    
    List<NotificationRecord> findByPassengerId(Long passengerId);
    
    @Query("SELECT n FROM NotificationRecord n WHERE n.routeChange.id = :routeChangeId AND n.passenger.id = :passengerId AND n.channel = :channel AND n.isRecoveryNotify = :isRecoveryNotify")
    List<NotificationRecord> findDuplicateNotifications(Long routeChangeId, Long passengerId, NotificationChannel channel, boolean isRecoveryNotify);
    
    @Query("SELECT COUNT(n) > 0 FROM NotificationRecord n WHERE n.routeChange.id = :routeChangeId AND n.recipient = :recipient AND n.channel = :channel AND n.status NOT IN ('FAILED', 'SKIPPED')")
    boolean existsSuccessfulNotification(Long routeChangeId, String recipient, NotificationChannel channel);
    
    List<NotificationRecord> findByStatusIn(List<NotificationStatus> statuses);
    
    List<NotificationRecord> findByRouteChangeIdAndIsRecoveryNotify(Long routeChangeId, boolean isRecoveryNotify);
    
    @Query("SELECT n FROM NotificationRecord n WHERE n.routeChange.id = :routeChangeId AND n.passenger.needPhoneCall = true AND n.channel = 'PHONE_CALL'")
    List<NotificationRecord> findPhoneCallNotificationsByRouteChangeId(Long routeChangeId);
    
    long countByRouteChangeIdAndStatus(Long routeChangeId, NotificationStatus status);
    
    List<NotificationRecord> findByCreatedAtAfter(LocalDateTime dateTime);
}
