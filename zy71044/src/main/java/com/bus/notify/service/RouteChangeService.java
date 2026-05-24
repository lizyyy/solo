package com.bus.notify.service;

import com.bus.notify.dto.RouteChangeCreateDTO;
import com.bus.notify.dto.StationChangeDTO;
import com.bus.notify.entity.Operator;
import com.bus.notify.entity.RouteChange;
import com.bus.notify.entity.StationChange;
import com.bus.notify.enums.RouteChangeEvent;
import com.bus.notify.enums.RouteChangeStatus;
import com.bus.notify.enums.StationStatus;
import com.bus.notify.repository.OperatorRepository;
import com.bus.notify.repository.RouteChangeRepository;
import com.bus.notify.repository.StationChangeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class RouteChangeService {
    private final RouteChangeRepository routeChangeRepository;
    private final StationChangeRepository stationChangeRepository;
    private final OperatorRepository operatorRepository;
    private final AuditService auditService;
    private final NotificationService notificationService;
    
    private final Map<RouteChangeStatus, Map<RouteChangeEvent, RouteChangeStatus>> stateMachine = new HashMap<>();
    
    public RouteChangeService(RouteChangeRepository routeChangeRepository,
                              StationChangeRepository stationChangeRepository,
                              OperatorRepository operatorRepository,
                              AuditService auditService,
                              NotificationService notificationService) {
        this.routeChangeRepository = routeChangeRepository;
        this.stationChangeRepository = stationChangeRepository;
        this.operatorRepository = operatorRepository;
        this.auditService = auditService;
        this.notificationService = notificationService;
        initStateMachine();
    }
    
    private void initStateMachine() {
        for (RouteChangeStatus status : RouteChangeStatus.values()) {
            stateMachine.put(status, new HashMap<>());
        }
        
        stateMachine.get(RouteChangeStatus.DRAFT).put(RouteChangeEvent.VERIFY_PASS, RouteChangeStatus.VERIFIED);
        stateMachine.get(RouteChangeStatus.DRAFT).put(RouteChangeEvent.CANCEL, RouteChangeStatus.CANCELLED);
        
        stateMachine.get(RouteChangeStatus.VERIFIED).put(RouteChangeEvent.START_PROCESS, RouteChangeStatus.PROCESSING);
        stateMachine.get(RouteChangeStatus.VERIFIED).put(RouteChangeEvent.VERIFY_REJECT, RouteChangeStatus.DRAFT);
        stateMachine.get(RouteChangeStatus.VERIFIED).put(RouteChangeEvent.CANCEL, RouteChangeStatus.CANCELLED);
        
        stateMachine.get(RouteChangeStatus.PROCESSING).put(RouteChangeEvent.COMPLETE_PROCESS, RouteChangeStatus.REVIEWING);
        stateMachine.get(RouteChangeStatus.PROCESSING).put(RouteChangeEvent.CANCEL, RouteChangeStatus.CANCELLED);
        
        stateMachine.get(RouteChangeStatus.REVIEWING).put(RouteChangeEvent.CLOSE, RouteChangeStatus.COMPLETED);
        stateMachine.get(RouteChangeStatus.REVIEWING).put(RouteChangeEvent.REVIEW_REJECT, RouteChangeStatus.PROCESSING);
        stateMachine.get(RouteChangeStatus.REVIEWING).put(RouteChangeEvent.CANCEL, RouteChangeStatus.CANCELLED);
    }
    
    private RouteChangeStatus transition(RouteChangeStatus current, RouteChangeEvent event) {
        Map<RouteChangeEvent, RouteChangeStatus> transitions = stateMachine.get(current);
        if (transitions == null) {
            return null;
        }
        return transitions.get(event);
    }
    
    @Transactional
    public RouteChange createRouteChange(RouteChangeCreateDTO dto) {
        RouteChange routeChange = new RouteChange();
        routeChange.setChangeNo(generateChangeNo());
        routeChange.setRouteNo(dto.getRouteNo());
        routeChange.setRouteName(dto.getRouteName());
        routeChange.setChangeReason(dto.getChangeReason());
        routeChange.setChangeDetail(dto.getChangeDetail());
        routeChange.setEffectiveDate(dto.getEffectiveDate());
        routeChange.setExpectedEndDate(dto.getExpectedEndDate());
        routeChange.setStatus(RouteChangeStatus.DRAFT);
        routeChange.setStatusReason("新建改线申请，待核验");
        
        if (dto.getOperatorUsername() != null) {
            Operator operator = operatorRepository.findByUsername(dto.getOperatorUsername()).orElse(null);
            routeChange.setCreator(operator);
            routeChange.setCurrentHandler(operator);
        }
        
        routeChange = routeChangeRepository.save(routeChange);
        
        if (dto.getStations() != null) {
            for (StationChangeDTO stationDTO : dto.getStations()) {
                StationChange station = new StationChange();
                station.setRouteChange(routeChange);
                station.setStationName(stationDTO.getStationName());
                station.setStationCode(stationDTO.getStationCode());
                station.setStatus(StationStatus.valueOf(stationDTO.getStatus()));
                station.setStatusReason(stationDTO.getStatusReason());
                station.setIsTemporary(stationDTO.getIsTemporary());
                station.setAlternativeRoute(stationDTO.getAlternativeRoute());
                station.setNotified(false);
                station.setRecoveryNotified(false);
                stationChangeRepository.save(station);
            }
        }
        
        auditService.logStatusChange(routeChange, "收件", "改线信息已录入系统",
                null, RouteChangeStatus.DRAFT, dto.getOperatorUsername());
        
        return routeChange;
    }
    
    private String generateChangeNo() {
        String dateStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String uuid = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        return "RC" + dateStr + uuid;
    }
    
    @Transactional
    public RouteChange verifyRouteChange(Long id, boolean passed, String reason, String operatorUsername) {
        RouteChange routeChange = routeChangeRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("改线记录不存在"));
        
        if (routeChange.getStatus() != RouteChangeStatus.DRAFT) {
            throw new IllegalStateException("当前状态不允许核验操作");
        }
        
        RouteChangeStatus oldStatus = routeChange.getStatus();
        RouteChangeEvent event = passed ? RouteChangeEvent.VERIFY_PASS : RouteChangeEvent.VERIFY_REJECT;
        
        RouteChangeStatus newStatus = transition(oldStatus, event);
        if (newStatus == null) {
            throw new IllegalStateException("状态转换失败");
        }
        
        routeChange.setStatus(newStatus);
        routeChange.setStatusReason(passed ? "核验通过，待处理" : "核验驳回：" + reason);
        
        Operator operator = operatorRepository.findByUsername(operatorUsername).orElse(null);
        routeChange.setCurrentHandler(operator);
        
        routeChange = routeChangeRepository.save(routeChange);
        
        auditService.logStatusChange(routeChange, "核验", reason, oldStatus, newStatus, operatorUsername);
        
        return routeChange;
    }
    
    @Transactional
    public RouteChange startProcessing(Long id, String operatorUsername) {
        RouteChange routeChange = routeChangeRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("改线记录不存在"));
        
        if (routeChange.getStatus() != RouteChangeStatus.VERIFIED) {
            throw new IllegalStateException("当前状态不允许开始处理");
        }
        
        RouteChangeStatus oldStatus = routeChange.getStatus();
        RouteChangeStatus newStatus = transition(oldStatus, RouteChangeEvent.START_PROCESS);
        
        if (newStatus == null) {
            throw new IllegalStateException("状态转换失败");
        }
        
        routeChange.setStatus(newStatus);
        routeChange.setStatusReason("正在进行乘客通知处理");
        
        Operator operator = operatorRepository.findByUsername(operatorUsername).orElse(null);
        routeChange.setCurrentHandler(operator);
        
        routeChange = routeChangeRepository.save(routeChange);
        
        notificationService.generateNotifications(routeChange, operatorUsername);
        
        auditService.logStatusChange(routeChange, "处理", "开始生成并发送乘客通知",
                oldStatus, newStatus, operatorUsername);
        
        return routeChange;
    }
    
    @Transactional
    public RouteChange completeProcessing(Long id, String operatorUsername) {
        RouteChange routeChange = routeChangeRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("改线记录不存在"));
        
        if (routeChange.getStatus() != RouteChangeStatus.PROCESSING) {
            throw new IllegalStateException("当前状态不允许完成处理");
        }
        
        RouteChangeStatus oldStatus = routeChange.getStatus();
        RouteChangeStatus newStatus = transition(oldStatus, RouteChangeEvent.COMPLETE_PROCESS);
        
        if (newStatus == null) {
            throw new IllegalStateException("状态转换失败");
        }
        
        routeChange.setStatus(newStatus);
        routeChange.setStatusReason("通知处理完成，待复查确认");
        
        routeChange = routeChangeRepository.save(routeChange);
        
        auditService.logStatusChange(routeChange, "处理完成", "乘客通知处理完毕，进入复查阶段",
                oldStatus, newStatus, operatorUsername);
        
        return routeChange;
    }
    
    @Transactional
    public RouteChange reviewRouteChange(Long id, boolean passed, String reason, String operatorUsername) {
        RouteChange routeChange = routeChangeRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("改线记录不存在"));
        
        if (routeChange.getStatus() != RouteChangeStatus.REVIEWING) {
            throw new IllegalStateException("当前状态不允许复查操作");
        }
        
        RouteChangeStatus oldStatus = routeChange.getStatus();
        RouteChangeEvent event = passed ? RouteChangeEvent.CLOSE : RouteChangeEvent.REVIEW_REJECT;
        
        RouteChangeStatus newStatus = transition(oldStatus, event);
        if (newStatus == null) {
            throw new IllegalStateException("状态转换失败");
        }
        
        if (passed) {
            routeChange.setStatus(newStatus);
            routeChange.setStatusReason("复查通过，已结案");
            routeChange.setCompletedAt(LocalDateTime.now());
        } else {
            routeChange.setStatus(newStatus);
            routeChange.setStatusReason("复查驳回：" + reason);
        }
        
        routeChange = routeChangeRepository.save(routeChange);
        
        auditService.logStatusChange(routeChange, "复查", reason, oldStatus, newStatus, operatorUsername);
        
        return routeChange;
    }
    
    @Transactional
    public RouteChange correctConclusion(Long id, String oldConclusion, String newConclusion, String remark, String operatorUsername) {
        RouteChange routeChange = routeChangeRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("改线记录不存在"));
        
        auditService.logCorrection(routeChange, "人工修正", "人工修正处理结论",
                oldConclusion, newConclusion, operatorUsername, remark);
        
        return routeChange;
    }
    
    @Transactional
    public void sendRecoveryNotifications(Long id, String operatorUsername) {
        RouteChange routeChange = routeChangeRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("改线记录不存在"));
        
        notificationService.generateRecoveryNotifications(routeChange, operatorUsername);
    }
    
    public RouteChange getRouteChange(Long id) {
        return routeChangeRepository.findById(id).orElse(null);
    }
    
    public RouteChange getRouteChangeByNo(String changeNo) {
        return routeChangeRepository.findByChangeNo(changeNo).orElse(null);
    }
    
    public List<RouteChange> getAllRouteChanges() {
        return routeChangeRepository.findAll();
    }
    
    public List<RouteChange> getRouteChangesByStatus(RouteChangeStatus status) {
        return routeChangeRepository.findByStatus(status);
    }
}
