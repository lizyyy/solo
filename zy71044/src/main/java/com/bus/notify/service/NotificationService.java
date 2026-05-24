package com.bus.notify.service;

import com.bus.notify.entity.NotificationRecord;
import com.bus.notify.entity.Operator;
import com.bus.notify.entity.RouteChange;
import com.bus.notify.entity.SpecialPassenger;
import com.bus.notify.entity.StationChange;
import com.bus.notify.enums.NotificationChannel;
import com.bus.notify.enums.NotificationStatus;
import com.bus.notify.repository.NotificationRecordRepository;
import com.bus.notify.repository.OperatorRepository;
import com.bus.notify.repository.SpecialPassengerRepository;
import com.bus.notify.repository.StationChangeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class NotificationService {
    private final NotificationRecordRepository notificationRecordRepository;
    private final SpecialPassengerRepository specialPassengerRepository;
    private final StationChangeRepository stationChangeRepository;
    private final OperatorRepository operatorRepository;
    
    public NotificationService(NotificationRecordRepository notificationRecordRepository,
                               SpecialPassengerRepository specialPassengerRepository,
                               StationChangeRepository stationChangeRepository,
                               OperatorRepository operatorRepository) {
        this.notificationRecordRepository = notificationRecordRepository;
        this.specialPassengerRepository = specialPassengerRepository;
        this.stationChangeRepository = stationChangeRepository;
        this.operatorRepository = operatorRepository;
    }
    
    @Transactional
    public List<NotificationRecord> generateNotifications(RouteChange routeChange, String operatorUsername) {
        List<NotificationRecord> records = new ArrayList<>();
        Operator operator = operatorRepository.findByUsername(operatorUsername).orElse(null);
        
        List<StationChange> stations = stationChangeRepository.findByRouteChangeId(routeChange.getId());
        
        for (StationChange station : stations) {
            records.addAll(generateStationNotifications(routeChange, station, operator));
            records.addAll(generatePassengerNotifications(routeChange, station, operator));
        }
        
        return records;
    }
    
    private List<NotificationRecord> generateStationNotifications(RouteChange routeChange, StationChange station, Operator operator) {
        List<NotificationRecord> records = new ArrayList<>();
        
        NotificationRecord broadcast = createNotification(routeChange, null, station.getStationName(),
                NotificationChannel.STATION_BROADCAST, operator);
        broadcast.setContent(String.format("站点%s因%s临时调整，详情请咨询工作人员",
                station.getStationName(), routeChange.getChangeReason()));
        
        if (!isDuplicate(broadcast)) {
            records.add(notificationRecordRepository.save(broadcast));
        } else {
            broadcast.setIsDuplicate(true);
            broadcast.setDuplicateRemark("该站点广播通知已存在");
            broadcast.setStatus(NotificationStatus.SKIPPED);
            records.add(notificationRecordRepository.save(broadcast));
        }
        
        station.setNotified(true);
        station.setNotifiedAt(LocalDateTime.now());
        station.setNotifyDetail("站点广播通知已生成");
        stationChangeRepository.save(station);
        
        return records;
    }
    
    private List<NotificationRecord> generatePassengerNotifications(RouteChange routeChange, StationChange station, Operator operator) {
        List<NotificationRecord> records = new ArrayList<>();
        
        List<SpecialPassenger> passengers = specialPassengerRepository
                .findAffectedPassengers(routeChange.getRouteNo(), station.getStationName());
        
        for (SpecialPassenger passenger : passengers) {
            if (passenger.getNeedPhoneCall()) {
                NotificationRecord phoneCall = createNotification(routeChange, passenger, station.getStationName(),
                        NotificationChannel.PHONE_CALL, operator);
                phoneCall.setContent(String.format("您好，%s乘客，您常乘坐的%s路公交因%s，站点%s有调整，请留意",
                        passenger.getPassengerName(), routeChange.getRouteNo(),
                        routeChange.getChangeReason(), station.getStationName()));
                
                if (!isDuplicate(phoneCall)) {
                    records.add(notificationRecordRepository.save(phoneCall));
                } else {
                    phoneCall.setIsDuplicate(true);
                    phoneCall.setDuplicateRemark("该乘客电话通知已存在");
                    phoneCall.setStatus(NotificationStatus.SKIPPED);
                    records.add(notificationRecordRepository.save(phoneCall));
                }
            }
            
            if (passenger.getPhone() != null && !passenger.getNeedPhoneCall()) {
                NotificationRecord sms = createNotification(routeChange, passenger, station.getStationName(),
                        NotificationChannel.SMS, operator);
                sms.setRecipient(passenger.getPhone());
                sms.setContent(String.format("【公交通知】%s路因%s，站点%s调整，给您带来不便敬请谅解。详询客服热线",
                        routeChange.getRouteNo(), routeChange.getChangeReason(), station.getStationName()));
                
                if (!isDuplicate(sms)) {
                    records.add(notificationRecordRepository.save(sms));
                } else {
                    sms.setIsDuplicate(true);
                    sms.setDuplicateRemark("该乘客短信通知已存在");
                    sms.setStatus(NotificationStatus.SKIPPED);
                    records.add(notificationRecordRepository.save(sms));
                }
            }
        }
        
        return records;
    }
    
    private NotificationRecord createNotification(RouteChange routeChange, SpecialPassenger passenger,
                                                  String stationName, NotificationChannel channel, Operator operator) {
        NotificationRecord record = new NotificationRecord();
        record.setRouteChange(routeChange);
        record.setPassenger(passenger);
        record.setStationName(stationName);
        record.setChannel(channel);
        record.setStatus(NotificationStatus.PENDING);
        record.setStatusReason("待发送");
        record.setOperator(operator);
        record.setIsDuplicate(false);
        record.setIsRecoveryNotify(false);
        record.setRetryCount(0);
        
        if (passenger != null) {
            record.setRecipient(passenger.getPhone());
        }
        
        return record;
    }
    
    private boolean isDuplicate(NotificationRecord record) {
        if (record.getPassenger() == null) {
            return false;
        }
        
        return notificationRecordRepository.existsSuccessfulNotificationByType(
                record.getRouteChange().getId(),
                record.getRecipient(),
                record.getChannel(),
                record.getIsRecoveryNotify()
        );
    }
    
    @Transactional
    public List<NotificationRecord> generateRecoveryNotifications(RouteChange routeChange, String operatorUsername) {
        List<NotificationRecord> records = new ArrayList<>();
        Operator operator = operatorRepository.findByUsername(operatorUsername).orElse(null);
        
        List<StationChange> stations = stationChangeRepository.findRecoveryPendingStations(routeChange.getId());
        
        for (StationChange station : stations) {
            List<SpecialPassenger> passengers = specialPassengerRepository
                    .findAffectedPassengers(routeChange.getRouteNo(), station.getStationName());
            
            for (SpecialPassenger passenger : passengers) {
                NotificationChannel channel = passenger.getNeedPhoneCall() ?
                        NotificationChannel.PHONE_CALL : NotificationChannel.SMS;
                
                NotificationRecord record = createNotification(routeChange, passenger, station.getStationName(), channel, operator);
                record.setIsRecoveryNotify(true);
                record.setContent(String.format("【恢复通知】%s路公交站点%s已恢复正常运营，感谢您的理解与支持",
                        routeChange.getRouteNo(), station.getStationName()));
                
                if (!isDuplicate(record)) {
                    records.add(notificationRecordRepository.save(record));
                } else {
                    record.setIsDuplicate(true);
                    record.setDuplicateRemark("该乘客恢复通知已存在");
                    record.setStatus(NotificationStatus.SKIPPED);
                    records.add(notificationRecordRepository.save(record));
                }
            }
            
            station.setRecoveryNotified(true);
            station.setRecoveryNotifiedAt(LocalDateTime.now());
            stationChangeRepository.save(station);
        }
        
        return records;
    }
    
    @Transactional
    public NotificationRecord updateNotificationStatus(Long id, NotificationStatus status, String reason, String operatorUsername) {
        NotificationRecord record = notificationRecordRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("通知记录不存在"));
        
        record.setStatus(status);
        record.setStatusReason(reason);
        
        switch (status) {
            case SENT -> record.setSentAt(LocalDateTime.now());
            case DELIVERED -> record.setDeliveredAt(LocalDateTime.now());
            case CONFIRMED -> record.setConfirmedAt(LocalDateTime.now());
            case FAILED -> {
                record.setFailReason(reason);
                record.setRetryCount(record.getRetryCount() + 1);
            }
            default -> {}
        }
        
        if (operatorUsername != null) {
            operatorRepository.findByUsername(operatorUsername).ifPresent(record::setOperator);
        }
        
        return notificationRecordRepository.save(record);
    }
    
    public List<NotificationRecord> getNotificationsByRouteChange(Long routeChangeId) {
        return notificationRecordRepository.findByRouteChangeId(routeChangeId);
    }
    
    public List<NotificationRecord> getPhoneCallNotifications(Long routeChangeId) {
        return notificationRecordRepository.findPhoneCallNotificationsByRouteChangeId(routeChangeId);
    }
}
