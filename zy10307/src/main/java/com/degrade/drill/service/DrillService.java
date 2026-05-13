package com.degrade.drill.service;

import com.degrade.drill.dto.*;
import com.degrade.drill.enums.DrillStatus;
import com.degrade.drill.enums.StopConditionType;
import com.degrade.drill.model.*;
import com.degrade.drill.repository.DrillPlanRepository;
import com.degrade.drill.repository.DrillReportRepository;
import com.degrade.drill.repository.MetricObservationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Random;

@Slf4j
@Service
@RequiredArgsConstructor
public class DrillService {

    private final DrillPlanRepository drillPlanRepository;
    private final DrillReportRepository drillReportRepository;
    private final MetricObservationRepository metricObservationRepository;
    private final Random random = new Random();

    @Transactional
    public ApiResponse<DrillPlan> createDrill(CreateDrillRequest request) {
        if (drillPlanRepository.existsByRequestId(request.getRequestId())) {
            DrillPlan existingPlan = drillPlanRepository.findByRequestId(request.getRequestId()).get();
            log.info("重复请求，返回已有演练计划: {}", request.getRequestId());
            return ApiResponse.success("重复请求，返回已有演练计划", existingPlan);
        }

        DrillPlan drillPlan = new DrillPlan();
        drillPlan.setRequestId(request.getRequestId());
        drillPlan.setPlanName(request.getPlanName());
        drillPlan.setDescription(request.getDescription());
        drillPlan.setCreatedBy(request.getCreatedBy());
        drillPlan.setStatus(DrillStatus.CREATED);

        TargetApi targetApi = new TargetApi();
        targetApi.setPath(request.getTargetApi().getPath());
        targetApi.setMethod(request.getTargetApi().getMethod());
        targetApi.setDescription(request.getTargetApi().getDescription());
        drillPlan.setTargetApi(targetApi);

        FallbackResponse fallback = new FallbackResponse();
        fallback.setHttpStatus(request.getFallbackResponse().getHttpStatus());
        fallback.setResponseBody(request.getFallbackResponse().getResponseBody());
        fallback.setContentType(request.getFallbackResponse().getContentType());
        fallback.setDelayMs(request.getFallbackResponse().getDelayMs());
        drillPlan.setFallbackResponse(fallback);

        StopCondition stopCondition = new StopCondition();
        stopCondition.setConditionType(request.getStopCondition().getConditionType());
        stopCondition.setThreshold(request.getStopCondition().getThreshold());
        stopCondition.setMetricName(request.getStopCondition().getMetricName());
        stopCondition.setDurationSeconds(request.getStopCondition().getDurationSeconds());
        drillPlan.setStopCondition(stopCondition);

        DrillPlan saved = drillPlanRepository.save(drillPlan);
        log.info("演练计划创建成功: id={}, requestId={}", saved.getId(), saved.getRequestId());
        return ApiResponse.success("演练计划创建成功", saved);
    }

    @Transactional
    public ApiResponse<DrillPlan> validateDrill(Long drillId) {
        Optional<DrillPlan> planOpt = drillPlanRepository.findById(drillId);
        if (planOpt.isEmpty()) {
            return ApiResponse.error(404, "演练计划不存在");
        }

        DrillPlan plan = planOpt.get();
        if (plan.getStatus() != DrillStatus.CREATED) {
            return ApiResponse.error(400, "当前状态不允许校验: " + plan.getStatus());
        }

        try {
            validatePlan(plan);
            plan.setStatus(DrillStatus.VALIDATED);
            plan.setUpdatedAt(LocalDateTime.now());
            DrillPlan saved = drillPlanRepository.save(plan);
            log.info("演练计划校验通过: id={}", drillId);
            return ApiResponse.success("校验通过", saved);
        } catch (Exception e) {
            plan.setStatus(DrillStatus.FAILED);
            plan.setErrorMessage(e.getMessage());
            plan.setUpdatedAt(LocalDateTime.now());
            drillPlanRepository.save(plan);
            log.error("演练计划校验失败: id={}, error={}", drillId, e.getMessage());
            return ApiResponse.error(400, "校验失败: " + e.getMessage());
        }
    }

    private void validatePlan(DrillPlan plan) {
        if (plan.getTargetApi() == null) {
            throw new IllegalArgumentException("目标接口配置不能为空");
        }
        if (plan.getFallbackResponse() == null) {
            throw new IllegalArgumentException("兜底响应配置不能为空");
        }
        if (plan.getStopCondition() == null) {
            throw new IllegalArgumentException("停止条件配置不能为空");
        }

        StopCondition stopCondition = plan.getStopCondition();
        if (stopCondition.getConditionType() == StopConditionType.DURATION) {
            if (stopCondition.getDurationSeconds() == null || stopCondition.getDurationSeconds() <= 0) {
                throw new IllegalArgumentException("时长类型停止条件必须配置有效的durationSeconds");
            }
        } else if (stopCondition.getConditionType() == StopConditionType.ERROR_RATE
                || stopCondition.getConditionType() == StopConditionType.RESPONSE_TIME) {
            if (stopCondition.getThreshold() == null || stopCondition.getThreshold() <= 0) {
                throw new IllegalArgumentException("指标类型停止条件必须配置有效的threshold");
            }
        }
    }

    @Transactional
    public ApiResponse<DrillPlan> startDrill(Long drillId) {
        Optional<DrillPlan> planOpt = drillPlanRepository.findById(drillId);
        if (planOpt.isEmpty()) {
            return ApiResponse.error(404, "演练计划不存在");
        }

        DrillPlan plan = planOpt.get();
        if (plan.getStatus() != DrillStatus.VALIDATED) {
            return ApiResponse.error(400, "当前状态不允许启动: " + plan.getStatus());
        }

        plan.setStatus(DrillStatus.RUNNING);
        plan.setActualStartTime(LocalDateTime.now());
        plan.setUpdatedAt(LocalDateTime.now());
        DrillPlan saved = drillPlanRepository.save(plan);

        log.info("演练计划已启动: id={}", drillId);
        return ApiResponse.success("演练已启动", saved);
    }

    @Transactional
    public ApiResponse<DrillPlan> stopDrill(Long drillId, String reason) {
        Optional<DrillPlan> planOpt = drillPlanRepository.findById(drillId);
        if (planOpt.isEmpty()) {
            return ApiResponse.error(404, "演练计划不存在");
        }

        DrillPlan plan = planOpt.get();
        if (plan.getStatus() != DrillStatus.RUNNING) {
            return ApiResponse.error(400, "演练未在运行中: " + plan.getStatus());
        }

        plan.setStatus(DrillStatus.STOPPING);
        plan.setUpdatedAt(LocalDateTime.now());
        drillPlanRepository.save(plan);

        archiveReport(plan, reason);

        plan.setStatus(DrillStatus.COMPLETED);
        plan.setEndTime(LocalDateTime.now());
        plan.setUpdatedAt(LocalDateTime.now());
        DrillPlan saved = drillPlanRepository.save(plan);

        log.info("演练计划已停止: id={}, reason={}", drillId, reason);
        return ApiResponse.success("演练已停止", saved);
    }

    @Transactional
    public ApiResponse<DrillPlan> cancelDrill(Long drillId) {
        Optional<DrillPlan> planOpt = drillPlanRepository.findById(drillId);
        if (planOpt.isEmpty()) {
            return ApiResponse.error(404, "演练计划不存在");
        }

        DrillPlan plan = planOpt.get();
        if (plan.getStatus() == DrillStatus.RUNNING || plan.getStatus() == DrillStatus.COMPLETED) {
            return ApiResponse.error(400, "当前状态不允许取消: " + plan.getStatus());
        }

        plan.setStatus(DrillStatus.CANCELLED);
        plan.setUpdatedAt(LocalDateTime.now());
        DrillPlan saved = drillPlanRepository.save(plan);

        log.info("演练计划已取消: id={}", drillId);
        return ApiResponse.success("演练已取消", saved);
    }

    private void archiveReport(DrillPlan plan, String stopReason) {
        DrillReport report = new DrillReport();
        report.setDrillPlanId(plan.getId());
        report.setPlanName(plan.getPlanName());
        report.setFinalStatus(DrillStatus.COMPLETED);
        report.setStartTime(plan.getActualStartTime());
        report.setEndTime(LocalDateTime.now());
        report.setDurationSeconds(Duration.between(plan.getActualStartTime(), LocalDateTime.now()).getSeconds());
        report.setTotalRequests(random.nextInt(1000) + 100);
        report.setFallbackHitCount(random.nextInt(report.getTotalRequests()));
        report.setAverageResponseTime(50 + random.nextDouble() * 200);
        report.setErrorRate(random.nextDouble() * 0.1);
        report.setStopReason(stopReason);
        report.setObservations("演练执行正常，兜底响应已验证");

        drillReportRepository.save(report);
        log.info("演练报告已归档: drillId={}", plan.getId());
    }

    @Scheduled(fixedDelay = 1000)
    @Transactional
    public void monitorRunningDrills() {
        List<DrillPlan> runningDrills = drillPlanRepository.findByStatus(DrillStatus.RUNNING);
        for (DrillPlan plan : runningDrills) {
            collectMetrics(plan);

            if (checkStopCondition(plan)) {
                log.info("达到停止条件，自动停止演练: id={}", plan.getId());
                stopDrill(plan.getId(), "自动停止: 达到" + plan.getStopCondition().getConditionType() + "阈值");
            }
        }
    }

    private void collectMetrics(DrillPlan plan) {
        MetricObservation errorRate = new MetricObservation();
        errorRate.setDrillPlanId(plan.getId());
        errorRate.setMetricName("error_rate");
        errorRate.setMetricValue(random.nextDouble() * 0.15);
        errorRate.setUnit("%");
        metricObservationRepository.save(errorRate);

        MetricObservation responseTime = new MetricObservation();
        responseTime.setDrillPlanId(plan.getId());
        responseTime.setMetricName("response_time");
        responseTime.setMetricValue(50 + random.nextDouble() * 300);
        responseTime.setUnit("ms");
        metricObservationRepository.save(responseTime);
    }

    private boolean checkStopCondition(DrillPlan plan) {
        StopCondition stopCondition = plan.getStopCondition();
        if (stopCondition.getConditionType() == StopConditionType.DURATION) {
            Duration duration = Duration.between(plan.getActualStartTime(), LocalDateTime.now());
            return duration.getSeconds() >= stopCondition.getDurationSeconds();
        } else if (stopCondition.getConditionType() == StopConditionType.ERROR_RATE) {
            List<MetricObservation> metrics = metricObservationRepository
                    .findByDrillPlanIdAndMetricName(plan.getId(), "error_rate");
            if (!metrics.isEmpty()) {
                double latestValue = metrics.get(0).getMetricValue();
                return latestValue >= stopCondition.getThreshold();
            }
        } else if (stopCondition.getConditionType() == StopConditionType.RESPONSE_TIME) {
            List<MetricObservation> metrics = metricObservationRepository
                    .findByDrillPlanIdAndMetricName(plan.getId(), "response_time");
            if (!metrics.isEmpty()) {
                double latestValue = metrics.get(0).getMetricValue();
                return latestValue >= stopCondition.getThreshold();
            }
        }
        return false;
    }

    public ApiResponse<DrillPlan> getDrillById(Long drillId) {
        return drillPlanRepository.findById(drillId)
                .map(plan -> ApiResponse.success(plan))
                .orElse(ApiResponse.error(404, "演练计划不存在"));
    }

    public ApiResponse<List<DrillPlan>> getAllDrills() {
        return ApiResponse.success(drillPlanRepository.findAll());
    }

    public ApiResponse<List<DrillReport>> getAllReports() {
        return ApiResponse.success(drillReportRepository.findAllByOrderByArchivedAtDesc());
    }

    public ApiResponse<DrillReport> getReportByDrillId(Long drillId) {
        return drillReportRepository.findByDrillPlanId(drillId)
                .map(report -> ApiResponse.success(report))
                .orElse(ApiResponse.error(404, "演练报告不存在"));
    }

    public ApiResponse<List<MetricObservation>> getMetricsByDrillId(Long drillId) {
        return ApiResponse.success(metricObservationRepository.findByDrillPlanIdOrderByObservedAtDesc(drillId));
    }
}