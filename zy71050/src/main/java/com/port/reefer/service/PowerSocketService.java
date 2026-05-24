package com.port.reefer.service;

import com.port.reefer.dto.PluginRequest;
import com.port.reefer.dto.UnplugRequest;
import com.port.reefer.entity.*;
import com.port.reefer.entity.enums.SocketStatus;
import com.port.reefer.exception.BusinessException;
import com.port.reefer.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class PowerSocketService {
    private static final Logger log = LoggerFactory.getLogger(PowerSocketService.class);
    
    private final PowerSocketRepository powerSocketRepository;
    private final ReeferContainerRepository reeferContainerRepository;
    private final InspectorRepository inspectorRepository;
    private final PluginReportRepository pluginReportRepository;
    private final AuditService auditService;

    public PowerSocketService(PowerSocketRepository powerSocketRepository,
                             ReeferContainerRepository reeferContainerRepository,
                             InspectorRepository inspectorRepository,
                             PluginReportRepository pluginReportRepository,
                             AuditService auditService) {
        this.powerSocketRepository = powerSocketRepository;
        this.reeferContainerRepository = reeferContainerRepository;
        this.inspectorRepository = inspectorRepository;
        this.pluginReportRepository = pluginReportRepository;
        this.auditService = auditService;
    }

    @Transactional
    public PluginReport plugin(PluginRequest request) {
        Inspector inspector = inspectorRepository.findByBadgeNumber(request.getInspectorBadge())
                .orElseThrow(() -> new BusinessException("巡检人不存在"));

        PowerSocket socket = powerSocketRepository.findWithLockById(
                powerSocketRepository.findBySocketCode(request.getSocketCode())
                        .orElseThrow(() -> new BusinessException("插座不存在")).getId()
        ).orElseThrow(() -> new BusinessException("插座不存在"));

        if (socket.getStatus() == SocketStatus.OCCUPIED) {
            throw new BusinessException("SOCKET_OCCUPIED", "插座已被占用，箱号: " + socket.getOccupiedByContainerId());
        }

        if (socket.getStatus() == SocketStatus.MAINTENANCE) {
            throw new BusinessException("SOCKET_MAINTENANCE", "插座正在维护中");
        }

        ReeferContainer container = reeferContainerRepository.findByContainerNumber(request.getContainerNumber())
                .orElseGet(() -> {
                    ReeferContainer newContainer = new ReeferContainer();
                    newContainer.setContainerNumber(request.getContainerNumber());
                    newContainer.setTargetTemperature(request.getTargetTemperature());
                    newContainer.setVesselName(request.getVesselName());
                    newContainer.setVoyageNumber(request.getVoyageNumber());
                    return reeferContainerRepository.save(newContainer);
                });

        PowerSocket beforeSocket = new PowerSocket();
        beforeSocket.setId(socket.getId());
        beforeSocket.setStatus(socket.getStatus());
        beforeSocket.setOccupiedByContainerId(socket.getOccupiedByContainerId());

        socket.setStatus(SocketStatus.OCCUPIED);
        socket.setOccupiedByContainerId(container.getId());
        socket.setOccupiedAt(request.getPluginTime() != null ? request.getPluginTime() : LocalDateTime.now());
        socket.setPowerOffAt(null);
        socket.setPowerOffReason(null);
        powerSocketRepository.save(socket);

        PluginReport report = new PluginReport();
        report.setReportNumber("RPT-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        report.setContainerId(container.getId());
        report.setSocketId(socket.getId());
        report.setInspectorId(inspector.getId());
        report.setPluginTime(socket.getOccupiedAt());
        report.setStatus("PLUGGED_IN");
        report.setTotalAlarms(0);
        report.setResolvedAlarms(0);
        report.setRemarks(request.getRemarks());
        pluginReportRepository.save(report);

        auditService.logOperation("PLUGIN", "PowerSocket", socket.getId(),
                inspector.getId(), beforeSocket, socket, "插电成功，报告号: " + report.getReportNumber());

        log.info("插电成功: 插座={}, 箱号={}, 巡检人={}", socket.getSocketCode(), container.getContainerNumber(), inspector.getName());
        return report;
    }

    @Transactional
    public PluginReport unplug(UnplugRequest request) {
        Inspector inspector = inspectorRepository.findByBadgeNumber(request.getInspectorBadge())
                .orElseThrow(() -> new BusinessException("巡检人不存在"));

        PowerSocket socket = powerSocketRepository.findWithLockById(
                powerSocketRepository.findBySocketCode(request.getSocketCode())
                        .orElseThrow(() -> new BusinessException("插座不存在")).getId()
        ).orElseThrow(() -> new BusinessException("插座不存在"));

        if (socket.getStatus() != SocketStatus.OCCUPIED) {
            auditService.logDuplicateOperation("UNPLUG", "PowerSocket", socket.getId(),
                    inspector.getId(), "重复断电操作，插座当前状态: " + socket.getStatus());
            throw new BusinessException("插座当前状态为" + socket.getStatus() + "，无需断电");
        }

        PluginReport report = pluginReportRepository.findBySocketIdOrderByPluginTimeDesc(socket.getId())
                .stream()
                .filter(r -> r.getUnplugTime() == null)
                .findFirst()
                .orElseThrow(() -> new BusinessException("未找到有效的插电报告"));

        PowerSocket beforeSocket = new PowerSocket();
        beforeSocket.setId(socket.getId());
        beforeSocket.setStatus(socket.getStatus());
        beforeSocket.setOccupiedByContainerId(socket.getOccupiedByContainerId());

        socket.setStatus(SocketStatus.AVAILABLE);
        socket.setOccupiedByContainerId(null);
        socket.setOccupiedAt(null);
        powerSocketRepository.save(socket);

        LocalDateTime unplugTime = request.getUnplugTime() != null ? request.getUnplugTime() : LocalDateTime.now();
        report.setUnplugTime(unplugTime);
        report.setStatus("UNPLUGGED");
        report.setRemarks(request.getRemarks());
        pluginReportRepository.save(report);

        auditService.logOperation("UNPLUG", "PowerSocket", socket.getId(),
                inspector.getId(), beforeSocket, socket, "断电成功，报告号: " + report.getReportNumber());

        log.info("断电成功: 插座={}, 报告号={}, 巡检人={}", socket.getSocketCode(), report.getReportNumber(), inspector.getName());
        return report;
    }

    @Transactional
    public PowerSocket setMaintenance(String socketCode, String inspectorBadge, String reason) {
        Inspector inspector = inspectorRepository.findByBadgeNumber(inspectorBadge)
                .orElseThrow(() -> new BusinessException("巡检人不存在"));

        PowerSocket socket = powerSocketRepository.findWithLockById(
                powerSocketRepository.findBySocketCode(socketCode)
                        .orElseThrow(() -> new BusinessException("插座不存在")).getId()
        ).orElseThrow(() -> new BusinessException("插座不存在"));

        if (socket.getStatus() == SocketStatus.MAINTENANCE) {
            auditService.logDuplicateOperation("SET_MAINTENANCE", "PowerSocket", socket.getId(),
                    inspector.getId(), "重复设置维护状态");
            return socket;
        }

        PowerSocket beforeSocket = new PowerSocket();
        beforeSocket.setId(socket.getId());
        beforeSocket.setStatus(socket.getStatus());

        socket.setStatus(SocketStatus.MAINTENANCE);
        socket.setPowerOffReason(reason);
        powerSocketRepository.save(socket);

        auditService.logOperation("SET_MAINTENANCE", "PowerSocket", socket.getId(),
                inspector.getId(), beforeSocket, socket, reason);

        return socket;
    }

    public List<PowerSocket> getAllSockets() {
        return powerSocketRepository.findAll();
    }

    public PowerSocket getSocketByCode(String socketCode) {
        return powerSocketRepository.findBySocketCode(socketCode)
                .orElseThrow(() -> new BusinessException("插座不存在"));
    }

    public List<PowerSocket> getAvailableSockets() {
        return powerSocketRepository.findByStatus(SocketStatus.AVAILABLE);
    }
}
