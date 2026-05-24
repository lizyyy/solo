package com.warehouse.charging.config;

import com.warehouse.charging.enums.StationStatus;
import com.warehouse.charging.model.ChargingStation;
import com.warehouse.charging.model.Robot;
import com.warehouse.charging.repository.ChargingStationRepository;
import com.warehouse.charging.repository.RobotRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer implements CommandLineRunner {

    private final ChargingStationRepository stationRepository;
    private final RobotRepository robotRepository;

    public DataInitializer(ChargingStationRepository stationRepository, RobotRepository robotRepository) {
        this.stationRepository = stationRepository;
        this.robotRepository = robotRepository;
    }

    @Override
    public void run(String... args) {
        initStations();
        initRobots();
    }

    private void initStations() {
        if (stationRepository.count() == 0) {
            createStation("STATION-001", "A区充电位1", "A区东北角", StationStatus.AVAILABLE, 100);
            createStation("STATION-002", "A区充电位2", "A区东南角", StationStatus.AVAILABLE, 100);
            createStation("STATION-003", "B区充电位1", "B区西北角", StationStatus.AVAILABLE, 100);
            createStation("STATION-004", "B区充电位2", "B区西南角", StationStatus.AVAILABLE, 100);
            createStation("STATION-005", "C区充电位1", "C区中央", StationStatus.MAINTENANCE, 0);
        }
    }

    private void initRobots() {
        if (robotRepository.count() == 0) {
            createRobot("ROBOT-001", "拣货机器人1号", 85, "拣货任务A-123", "A区货架3");
            createRobot("ROBOT-002", "拣货机器人2号", 45, "拣货任务B-456", "B区货架7");
            createRobot("ROBOT-003", "搬运机器人1号", 15, "搬运任务C-789", "C区过道");
            createRobot("ROBOT-004", "夜间巡逻机器人", 8, "夜间巡逻", "仓库外围");
        }
    }

    private void createStation(String code, String name, String location, StationStatus status, int powerLevel) {
        ChargingStation station = new ChargingStation();
        station.setStationCode(code);
        station.setName(name);
        station.setLocation(location);
        station.setStatus(status);
        station.setPowerLevel(powerLevel);
        stationRepository.save(station);
    }

    private void createRobot(String code, String name, int battery, String task, String location) {
        Robot robot = new Robot();
        robot.setRobotCode(code);
        robot.setName(name);
        robot.setCurrentBattery(battery);
        robot.setBatteryCapacity(100);
        robot.setCurrentTask(task);
        robot.setLocation(location);
        robot.setIsOnline(true);
        robot.setLastHeartbeat(java.time.LocalDateTime.now());
        robotRepository.save(robot);
    }
}
