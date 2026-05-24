package com.bus.notify.service;

import com.bus.notify.entity.NotificationRecord;
import com.bus.notify.entity.RouteChange;
import com.bus.notify.entity.StationChange;
import com.bus.notify.enums.NotificationStatus;
import com.bus.notify.repository.NotificationRecordRepository;
import com.bus.notify.repository.RouteChangeRepository;
import com.bus.notify.repository.StationChangeRepository;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class ReportService {
    private final RouteChangeRepository routeChangeRepository;
    private final StationChangeRepository stationChangeRepository;
    private final NotificationRecordRepository notificationRecordRepository;
    
    public ReportService(RouteChangeRepository routeChangeRepository,
                         StationChangeRepository stationChangeRepository,
                         NotificationRecordRepository notificationRecordRepository) {
        this.routeChangeRepository = routeChangeRepository;
        this.stationChangeRepository = stationChangeRepository;
        this.notificationRecordRepository = notificationRecordRepository;
    }
    
    public Map<String, Object> generateRouteChangeReport(Long routeChangeId) {
        RouteChange routeChange = routeChangeRepository.findById(routeChangeId)
                .orElseThrow(() -> new IllegalArgumentException("改线记录不存在"));
        
        Map<String, Object> report = new HashMap<>();
        
        Map<String, Object> basicInfo = new HashMap<>();
        basicInfo.put("changeNo", routeChange.getChangeNo());
        basicInfo.put("routeNo", routeChange.getRouteNo());
        basicInfo.put("routeName", routeChange.getRouteName());
        basicInfo.put("changeReason", routeChange.getChangeReason());
        basicInfo.put("changeDetail", routeChange.getChangeDetail());
        basicInfo.put("effectiveDate", routeChange.getEffectiveDate());
        basicInfo.put("expectedEndDate", routeChange.getExpectedEndDate());
        basicInfo.put("status", routeChange.getStatus());
        basicInfo.put("statusDisplayName", routeChange.getStatus().getDisplayName());
        basicInfo.put("statusDescription", routeChange.getStatus().getDescription());
        basicInfo.put("statusReason", routeChange.getStatusReason());
        report.put("basicInfo", basicInfo);
        
        List<StationChange> stations = stationChangeRepository.findByRouteChangeId(routeChangeId);
        List<Map<String, Object>> stationList = stations.stream().map(station -> {
            Map<String, Object> s = new HashMap<>();
            s.put("stationName", station.getStationName());
            s.put("stationCode", station.getStationCode());
            s.put("status", station.getStatus());
            s.put("statusDisplayName", station.getStatus().getDisplayName());
            s.put("statusReason", station.getStatusReason());
            s.put("isTemporary", station.getIsTemporary());
            s.put("notified", station.getNotified());
            s.put("notifiedAt", station.getNotifiedAt());
            s.put("recoveryNotified", station.getRecoveryNotified());
            s.put("recoveryNotifiedAt", station.getRecoveryNotifiedAt());
            s.put("alternativeRoute", station.getAlternativeRoute());
            return s;
        }).collect(Collectors.toList());
        report.put("stations", stationList);
        
        long totalStations = stations.size();
        long notifiedStations = stations.stream().filter(StationChange::getNotified).count();
        long unnotifiedStations = totalStations - notifiedStations;
        long recoveryNotified = stations.stream().filter(StationChange::getRecoveryNotified).count();
        
        Map<String, Object> stationStats = new HashMap<>();
        stationStats.put("total", totalStations);
        stationStats.put("notified", notifiedStations);
        stationStats.put("unnotified", unnotifiedStations);
        stationStats.put("recoveryNotified", recoveryNotified);
        report.put("stationStats", stationStats);
        
        List<NotificationRecord> notifications = notificationRecordRepository.findByRouteChangeId(routeChangeId);
        
        Map<String, Object> notificationStats = new HashMap<>();
        notificationStats.put("total", notifications.size());
        notificationStats.put("pending", countByStatus(notifications, NotificationStatus.PENDING));
        notificationStats.put("sent", countByStatus(notifications, NotificationStatus.SENT));
        notificationStats.put("delivered", countByStatus(notifications, NotificationStatus.DELIVERED));
        notificationStats.put("confirmed", countByStatus(notifications, NotificationStatus.CONFIRMED));
        notificationStats.put("failed", countByStatus(notifications, NotificationStatus.FAILED));
        notificationStats.put("skipped", countByStatus(notifications, NotificationStatus.SKIPPED));
        notificationStats.put("duplicates", notifications.stream().filter(NotificationRecord::getIsDuplicate).count());
        notificationStats.put("phoneCalls", notifications.stream()
                .filter(n -> n.getChannel().name().equals("PHONE_CALL")).count());
        notificationStats.put("recoveryNotify", notifications.stream()
                .filter(NotificationRecord::getIsRecoveryNotify).count());
        report.put("notificationStats", notificationStats);
        
        List<Map<String, Object>> phoneCallList = notifications.stream()
                .filter(n -> n.getChannel().name().equals("PHONE_CALL"))
                .map(n -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("passengerName", n.getPassenger() != null ? n.getPassenger().getPassengerName() : null);
                    m.put("cardNo", n.getPassenger() != null ? n.getPassenger().getCardNo() : null);
                    m.put("phone", n.getRecipient());
                    m.put("stationName", n.getStationName());
                    m.put("status", n.getStatus());
                    m.put("statusDisplayName", n.getStatus().getDisplayName());
                    m.put("statusReason", n.getStatusReason());
                    m.put("sentAt", n.getSentAt());
                    m.put("confirmedAt", n.getConfirmedAt());
                    return m;
                }).collect(Collectors.toList());
        report.put("phoneCallList", phoneCallList);
        
        return report;
    }
    
    private long countByStatus(List<NotificationRecord> notifications, NotificationStatus status) {
        return notifications.stream().filter(n -> n.getStatus() == status).count();
    }
    
    public String exportAsCSV(Long routeChangeId) {
        Map<String, Object> report = generateRouteChangeReport(routeChangeId);
        
        StringBuilder csv = new StringBuilder();
        csv.append("公交改线乘客通知报告\n");
        csv.append("\n一、基本信息\n");
        Map<String, Object> basicInfo = (Map<String, Object>) report.get("basicInfo");
        csv.append("改线编号,线路编号,线路名称,改线原因,生效日期,当前状态,状态说明\n");
        csv.append(basicInfo.get("changeNo")).append(",")
                .append(basicInfo.get("routeNo")).append(",")
                .append(basicInfo.get("routeName")).append(",")
                .append(basicInfo.get("changeReason")).append(",")
                .append(basicInfo.get("effectiveDate")).append(",")
                .append(basicInfo.get("statusDisplayName")).append(",")
                .append(basicInfo.get("statusReason")).append("\n");
        
        csv.append("\n二、站点通知情况\n");
        csv.append("站点名称,站点状态,是否临时,是否已通知,通知时间,恢复是否通知,恢复通知时间\n");
        List<Map<String, Object>> stations = (List<Map<String, Object>>) report.get("stations");
        for (Map<String, Object> station : stations) {
            csv.append(station.get("stationName")).append(",")
                    .append(station.get("statusDisplayName")).append(",")
                    .append(station.get("isTemporary")).append(",")
                    .append(station.get("notified")).append(",")
                    .append(station.get("notifiedAt")).append(",")
                    .append(station.get("recoveryNotified")).append(",")
                    .append(station.get("recoveryNotifiedAt")).append("\n");
        }
        
        csv.append("\n三、需电话提醒的老人卡用户\n");
        csv.append("乘客姓名,卡号,联系电话,涉及站点,通知状态,状态说明,拨打时间,确认时间\n");
        List<Map<String, Object>> phoneCalls = (List<Map<String, Object>>) report.get("phoneCallList");
        for (Map<String, Object> call : phoneCalls) {
            csv.append(call.get("passengerName")).append(",")
                    .append(call.get("cardNo")).append(",")
                    .append(call.get("phone")).append(",")
                    .append(call.get("stationName")).append(",")
                    .append(call.get("statusDisplayName")).append(",")
                    .append(call.get("statusReason")).append(",")
                    .append(call.get("sentAt")).append(",")
                    .append(call.get("confirmedAt")).append("\n");
        }
        
        return csv.toString();
    }
}
