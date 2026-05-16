package com.statuspage.config;

import com.statuspage.dto.*;
import com.statuspage.model.IncidentStatus;
import com.statuspage.model.ServiceStatus;
import com.statuspage.service.IncidentService;
import com.statuspage.service.SubscriberService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class DataInitializer {
    private final SubscriberService subscriberService;
    private final IncidentService incidentService;

    @Bean
    public CommandLineRunner initData() {
        return args -> {
            log.info("开始初始化样例数据...");

            try {
                subscriberService.createSubscriber("ops-001", "运维团队A", "ops-a@example.com", "13800138001", "技术部");
                subscriberService.createSubscriber("ops-002", "运维团队B", "ops-b@example.com", "13800138002", "技术部");
                subscriberService.createSubscriber("dev-001", "开发团队A", "dev-a@example.com", "13800138003", "产品部");
                subscriberService.createSubscriber("biz-001", "业务团队A", "biz-a@example.com", "13800138004", "运营部");
                log.info("订阅方数据初始化完成");
            } catch (Exception e) {
                log.warn("订阅方数据已存在，跳过");
            }

            try {
                CreateIncidentRequest incident1 = new CreateIncidentRequest();
                incident1.setIncidentNumber("INC-2024-001");
                incident1.setTitle("支付系统响应缓慢");
                incident1.setDescription("监控发现支付接口平均响应时间超过5秒，影响用户支付体验");
                incident1.setServiceStatus(ServiceStatus.DEGRADED_PERFORMANCE);
                incident1.setAffectedServices("支付网关,订单系统");
                incident1.setCreatedBy("admin");
                incident1.setAnnouncementTitle("【通知】支付系统性能下降");
                incident1.setAnnouncementContent("目前检测到支付系统响应缓慢，技术团队正在排查原因。后续进展将及时通知。");
                incidentService.createIncident(incident1);
                log.info("事故1创建完成");

                CreateAnnouncementRequest ann1 = new CreateAnnouncementRequest();
                ann1.setTitle("【更新】已定位问题原因");
                ann1.setContent("经排查，问题原因为数据库连接池耗尽。正在执行连接池扩容操作。");
                ann1.setServiceStatus(ServiceStatus.DEGRADED_PERFORMANCE);
                ann1.setIncidentStatus(IncidentStatus.IDENTIFIED);
                ann1.setCreatedBy("admin");
                ann1.setPublishImmediately(true);
                incidentService.createAnnouncement("INC-2024-001", ann1);

                CreateAnnouncementRequest ann2 = new CreateAnnouncementRequest();
                ann2.setTitle("【更新】问题已修复");
                ann2.setContent("连接池扩容已完成，系统正在恢复中。请各团队验证业务是否正常。");
                ann2.setServiceStatus(ServiceStatus.OPERATIONAL);
                ann2.setIncidentStatus(IncidentStatus.MONITORING);
                ann2.setCreatedBy("admin");
                ann2.setPublishImmediately(true);
                incidentService.createAnnouncement("INC-2024-001", ann2);
            } catch (Exception e) {
                log.warn("事故1已存在，跳过");
            }

            try {
                CreateIncidentRequest incident2 = new CreateIncidentRequest();
                incident2.setIncidentNumber("INC-2024-002");
                incident2.setTitle("用户中心服务中断");
                incident2.setDescription("用户登录、注册功能不可用，正在紧急排查");
                incident2.setServiceStatus(ServiceStatus.MAJOR_OUTAGE);
                incident2.setAffectedServices("用户中心,认证服务");
                incident2.setCreatedBy("admin");
                incident2.setAnnouncementTitle("【紧急通知】用户中心服务中断");
                incident2.setAnnouncementContent("用户中心服务出现严重中断，登录、注册功能暂时不可用。技术团队正在全力抢修，预计30分钟内恢复。");
                incidentService.createIncident(incident2);
                log.info("事故2创建完成");
            } catch (Exception e) {
                log.warn("事故2已存在，跳过");
            }

            try {
                ConfirmationRequest conf1 = new ConfirmationRequest();
                conf1.setAnnouncementId(1L);
                conf1.setSubscriberId("ops-001");
                conf1.setSubscriberName("运维团队A");
                conf1.setNote("收到，已通知团队成员");
                conf1.setConfirmedBy("ops-001");
                incidentService.confirmAnnouncement("INC-2024-001", conf1);

                ConfirmationRequest conf2 = new ConfirmationRequest();
                conf2.setAnnouncementId(1L);
                conf2.setSubscriberId("biz-001");
                conf2.setSubscriberName("业务团队A");
                conf2.setNote("已收到，正在关注客服反馈");
                conf2.setConfirmedBy("biz-001");
                incidentService.confirmAnnouncement("INC-2024-001", conf2);
                log.info("确认记录初始化完成");
            } catch (Exception e) {
                log.warn("确认记录已存在，跳过");
            }

            log.info("样例数据初始化完成!");
            log.info("H2控制台: http://localhost:8080/h2-console");
            log.info("JDBC URL: jdbc:h2:file:./data/statuspage");
            log.info("用户名: sa, 密码: (空)");
        };
    }
}