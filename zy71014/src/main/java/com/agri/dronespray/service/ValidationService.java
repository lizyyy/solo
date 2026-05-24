package com.agri.dronespray.service;

import com.agri.dronespray.entity.*;
import com.agri.dronespray.repository.PermissionRepository;
import com.agri.dronespray.repository.WeatherWindowRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class ValidationService {

    @Autowired
    private PermissionRepository permissionRepository;

    @Autowired
    private WeatherWindowRepository weatherWindowRepository;

    private static final LocalTime NO_FLY_START = LocalTime.of(22, 0);
    private static final LocalTime NO_FLY_END = LocalTime.of(6, 0);
    private static final int DUPLICATE_CHECK_DAYS = 7;
    private static final double MAX_WIND_SPEED = 10.0;
    private static final double MIN_TEMPERATURE = 10.0;
    private static final double MAX_TEMPERATURE = 35.0;
    private static final double MAX_HUMIDITY = 85.0;

    public List<CheckRecord> validatePermission(Permission permission) {
        List<CheckRecord> checkRecords = new ArrayList<>();

        checkRecords.add(validateWeatherWindow(permission));
        checkRecords.add(validateNoFlyTime(permission));
        checkRecords.add(validatePesticideMatch(permission));
        checkRecords.add(validatePlotApproval(permission));
        checkRecords.add(validateDuplicateOperation(permission));
        checkRecords.add(validateDroneStatus(permission));
        checkRecords.add(validatePilotQualification(permission));

        return checkRecords;
    }

    private CheckRecord validateWeatherWindow(Permission permission) {
        CheckRecord record = new CheckRecord();
        record.setCheckType(CheckType.WEATHER_WINDOW);
        record.setCheckedBy("SYSTEM");

        if (permission.getWeatherWindow() == null) {
            record.setCheckResult(CheckResult.FAIL);
            record.setCheckDetail("未选择天气窗口");
            record.setDisposalInstruction("请先选择适宜作业的天气窗口");
            return record;
        }

        WeatherWindow window = permission.getWeatherWindow();
        StringBuilder detail = new StringBuilder();
        List<String> issues = new ArrayList<>();

        if (window.getWindSpeed() != null && window.getWindSpeed() > MAX_WIND_SPEED) {
            issues.add(String.format("风速%.1fm/s超过上限%.1fm/s", window.getWindSpeed(), MAX_WIND_SPEED));
        }
        if (window.getTemperature() != null && (window.getTemperature() < MIN_TEMPERATURE || window.getTemperature() > MAX_TEMPERATURE)) {
            issues.add(String.format("温度%.1f℃超出适宜范围(%.0f-%.0f℃)", window.getTemperature(), MIN_TEMPERATURE, MAX_TEMPERATURE));
        }
        if (window.getHumidity() != null && window.getHumidity() > MAX_HUMIDITY) {
            issues.add(String.format("湿度%.1f%%超过上限%.0f%%", window.getHumidity(), MAX_HUMIDITY));
        }
        if (window.getRainfall() != null && window.getRainfall() > 0) {
            issues.add(String.format("有降雨(%.1fmm)", window.getRainfall()));
        }

        if (issues.isEmpty()) {
            record.setCheckResult(CheckResult.PASS);
            record.setCheckDetail(String.format("天气窗口校验通过：%s，温度%.1f℃，风速%.1fm/s，湿度%.1f%%",
                    window.getWeatherCondition() != null ? window.getWeatherCondition() : "晴",
                    window.getTemperature() != null ? window.getTemperature() : 0,
                    window.getWindSpeed() != null ? window.getWindSpeed() : 0,
                    window.getHumidity() != null ? window.getHumidity() : 0));
            record.setDisposalInstruction("天气条件适宜，可以作业");
        } else {
            record.setCheckResult(CheckResult.FAIL);
            record.setCheckDetail(String.join("；", issues));
            record.setDisposalInstruction("当前天气条件不适合作业，请选择其他天气窗口");
        }

        return record;
    }

    private CheckRecord validateNoFlyTime(Permission permission) {
        CheckRecord record = new CheckRecord();
        record.setCheckType(CheckType.NO_FLY_TIME);
        record.setCheckedBy("SYSTEM");

        LocalDateTime startTime = permission.getPlannedStartTime();
        LocalDateTime endTime = permission.getPlannedEndTime();

        if (startTime == null || endTime == null) {
            record.setCheckResult(CheckResult.FAIL);
            record.setCheckDetail("未设置计划作业时间");
            record.setDisposalInstruction("请设置计划开始和结束时间");
            return record;
        }

        boolean hasNoFlyTime = false;
        LocalDateTime current = startTime;
        while (!current.isAfter(endTime)) {
            LocalTime time = current.toLocalTime();
            if (time.isAfter(NO_FLY_START) || time.isBefore(NO_FLY_END)) {
                hasNoFlyTime = true;
                break;
            }
            current = current.plusHours(1);
        }

        if (hasNoFlyTime) {
            record.setCheckResult(CheckResult.FAIL);
            record.setCheckDetail(String.format("计划作业时间包含禁飞时段(%s-%s)", NO_FLY_START, NO_FLY_END));
            record.setDisposalInstruction("禁飞时段禁止飞行作业，请调整作业时间至白天");
        } else {
            record.setCheckResult(CheckResult.PASS);
            record.setCheckDetail(String.format("计划作业时间(%s - %s)不在禁飞时段内", startTime.toLocalTime(), endTime.toLocalTime()));
            record.setDisposalInstruction("作业时间符合规定");
        }

        return record;
    }

    private CheckRecord validatePesticideMatch(Permission permission) {
        CheckRecord record = new CheckRecord();
        record.setCheckType(CheckType.PESTICIDE_MATCH);
        record.setCheckedBy("SYSTEM");

        if (permission.getItems() == null || permission.getItems().isEmpty()) {
            record.setCheckResult(CheckResult.FAIL);
            record.setCheckDetail("未添加作业地块和药剂");
            record.setDisposalInstruction("请添加作业地块和对应药剂");
            return record;
        }

        List<String> issues = new ArrayList<>();
        List<String> passes = new ArrayList<>();

        for (PermissionItem item : permission.getItems()) {
            Plot plot = item.getPlot();
            Pesticide pesticide = item.getPesticideBatch().getPesticide();

            boolean cropMatch = false;
            boolean pestMatch = false;

            if (pesticide.getApplicableCrops() != null && plot.getCropType() != null) {
                cropMatch = pesticide.getApplicableCrops().contains(plot.getCropType());
            }
            if (pesticide.getTargetPests() != null && plot.getPestType() != null) {
                pestMatch = pesticide.getTargetPests().contains(plot.getPestType());
            }

            if (!cropMatch || !pestMatch) {
                issues.add(String.format("地块[%s]作物[%s]虫害[%s]与药剂[%s]不匹配",
                        plot.getPlotName(), plot.getCropType(), plot.getPestType(), pesticide.getPesticideName()));
            } else {
                passes.add(String.format("地块[%s]药剂匹配通过", plot.getPlotName()));
            }
        }

        if (issues.isEmpty()) {
            record.setCheckResult(CheckResult.PASS);
            record.setCheckDetail(String.join("；", passes));
            record.setDisposalInstruction("所有地块药剂匹配正确");
        } else {
            record.setCheckResult(CheckResult.FAIL);
            record.setCheckDetail(String.join("；", issues));
            record.setDisposalInstruction("请更换适合作物和虫害类型的药剂");
        }

        return record;
    }

    private CheckRecord validatePlotApproval(Permission permission) {
        CheckRecord record = new CheckRecord();
        record.setCheckType(CheckType.PLOT_APPROVAL);
        record.setCheckedBy("SYSTEM");

        if (permission.getItems() == null || permission.getItems().isEmpty()) {
            record.setCheckResult(CheckResult.FAIL);
            record.setCheckDetail("未添加作业地块");
            record.setDisposalInstruction("请添加作业地块");
            return record;
        }

        List<String> unapprovedPlots = new ArrayList<>();
        List<String> approvedPlots = new ArrayList<>();

        for (PermissionItem item : permission.getItems()) {
            Plot plot = item.getPlot();
            if (plot.getApproved() == null || !plot.getApproved()) {
                unapprovedPlots.add(plot.getPlotName());
            } else {
                approvedPlots.add(plot.getPlotName());
            }
        }

        if (!unapprovedPlots.isEmpty()) {
            record.setCheckResult(CheckResult.FAIL);
            record.setCheckDetail(String.format("以下地块未审批：%s", String.join("、", unapprovedPlots)));
            record.setDisposalInstruction("临时添加的地块需先完成审批流程，请联系地块管理员进行审批");
        } else {
            record.setCheckResult(CheckResult.PASS);
            record.setCheckDetail(String.format("所有地块已审批：%s", String.join("、", approvedPlots)));
            record.setDisposalInstruction("地块审批状态正常");
        }

        return record;
    }

    private CheckRecord validateDuplicateOperation(Permission permission) {
        CheckRecord record = new CheckRecord();
        record.setCheckType(CheckType.DUPLICATE_OPERATION);
        record.setCheckedBy("SYSTEM");

        if (permission.getItems() == null || permission.getItems().isEmpty()) {
            record.setCheckResult(CheckResult.WARNING);
            record.setCheckDetail("未添加作业地块，跳过重复作业校验");
            record.setDisposalInstruction("请添加作业地块");
            return record;
        }

        LocalDateTime thresholdTime = LocalDateTime.now().minusDays(DUPLICATE_CHECK_DAYS);
        List<String> duplicatePlots = new ArrayList<>();
        List<String> normalPlots = new ArrayList<>();

        for (PermissionItem item : permission.getItems()) {
            Long plotId = item.getPlot().getId();
            boolean hasRecent = permissionRepository.existsRecentOperationForPlot(plotId, thresholdTime);
            if (hasRecent) {
                duplicatePlots.add(item.getPlot().getPlotName());
            } else {
                normalPlots.add(item.getPlot().getPlotName());
            }
        }

        if (!duplicatePlots.isEmpty()) {
            record.setCheckResult(CheckResult.WARNING);
            record.setCheckDetail(String.format("以下地块近%d天内已有作业记录：%s",
                    DUPLICATE_CHECK_DAYS, String.join("、", duplicatePlots)));
            record.setDisposalInstruction("请注意检查是否为重复作业，确认需要作业请继续提交人工复核");
        } else {
            record.setCheckResult(CheckResult.PASS);
            record.setCheckDetail(String.format("所有地块近%d天内无重复作业：%s",
                    DUPLICATE_CHECK_DAYS, String.join("、", normalPlots)));
            record.setDisposalInstruction("无重复作业风险");
        }

        return record;
    }

    private CheckRecord validateDroneStatus(Permission permission) {
        CheckRecord record = new CheckRecord();
        record.setCheckType(CheckType.DRONE_STATUS);
        record.setCheckedBy("SYSTEM");

        if (permission.getDrone() == null) {
            record.setCheckResult(CheckResult.FAIL);
            record.setCheckDetail("未选择作业无人机");
            record.setDisposalInstruction("请选择可用的无人机");
            return record;
        }

        Drone drone = permission.getDrone();
        if (!"可用".equals(drone.getStatus())) {
            record.setCheckResult(CheckResult.FAIL);
            record.setCheckDetail(String.format("无人机[%s]当前状态：%s", drone.getDroneCode(), drone.getStatus()));
            record.setDisposalInstruction("请选择状态为'可用'的无人机");
        } else {
            record.setCheckResult(CheckResult.PASS);
            record.setCheckDetail(String.format("无人机[%s]状态正常：%s", drone.getDroneCode(), drone.getStatus()));
            record.setDisposalInstruction("无人机可用");
        }

        return record;
    }

    private CheckRecord validatePilotQualification(Permission permission) {
        CheckRecord record = new CheckRecord();
        record.setCheckType(CheckType.PILOT_QUALIFICATION);
        record.setCheckedBy("SYSTEM");

        if (permission.getPilot() == null) {
            record.setCheckResult(CheckResult.FAIL);
            record.setCheckDetail("未指定作业飞手");
            record.setDisposalInstruction("请指定具备资质的飞手");
            return record;
        }

        Pilot pilot = permission.getPilot();
        if (!"在岗".equals(pilot.getStatus())) {
            record.setCheckResult(CheckResult.FAIL);
            record.setCheckDetail(String.format("飞手[%s]当前状态：%s", pilot.getPilotName(), pilot.getStatus()));
            record.setDisposalInstruction("请选择状态为'在岗'的飞手");
        } else if (pilot.getQualificationLevel() == null) {
            record.setCheckResult(CheckResult.MANUAL_REVIEW);
            record.setCheckDetail(String.format("飞手[%s]资质等级待确认", pilot.getPilotName()));
            record.setDisposalInstruction("请人工复核飞手资质");
        } else {
            record.setCheckResult(CheckResult.PASS);
            record.setCheckDetail(String.format("飞手[%s]资质[%s]，状态正常", pilot.getPilotName(), pilot.getQualificationLevel()));
            record.setDisposalInstruction("飞手资质符合要求");
        }

        return record;
    }

    public boolean hasSystemRejection(List<CheckRecord> records) {
        return records.stream().anyMatch(r -> r.getCheckResult() == CheckResult.FAIL);
    }

    public boolean needsManualReview(List<CheckRecord> records) {
        return records.stream().anyMatch(r -> r.getCheckResult() == CheckResult.MANUAL_REVIEW
                || r.getCheckResult() == CheckResult.WARNING);
    }
}
