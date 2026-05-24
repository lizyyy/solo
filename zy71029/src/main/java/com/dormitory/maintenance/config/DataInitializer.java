package com.dormitory.maintenance.config;

import com.dormitory.maintenance.entity.ConstructionTeam;
import com.dormitory.maintenance.entity.DormBuilding;
import com.dormitory.maintenance.entity.QuietPeriod;
import com.dormitory.maintenance.enums.QuietPeriodType;
import com.dormitory.maintenance.repository.ConstructionTeamRepository;
import com.dormitory.maintenance.repository.DormBuildingRepository;
import com.dormitory.maintenance.repository.QuietPeriodRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
public class DataInitializer implements CommandLineRunner {

    @Autowired
    private DormBuildingRepository buildingRepository;

    @Autowired
    private ConstructionTeamRepository teamRepository;

    @Autowired
    private QuietPeriodRepository quietPeriodRepository;

    @Override
    public void run(String... args) {
        if (buildingRepository.count() == 0) {
            initBuildings();
        }
        if (teamRepository.count() == 0) {
            initTeams();
        }
        if (quietPeriodRepository.count() == 0) {
            initQuietPeriods();
        }
    }

    private void initBuildings() {
        DormBuilding b1 = new DormBuilding();
        b1.setBuildingCode("BLD001");
        b1.setBuildingName("1号宿舍楼");
        b1.setFloorCount(6);
        b1.setRoomCount(120);
        b1.setLocation("东区");
        b1.setManager("张管理");
        b1.setManagerPhone("13800138001");
        buildingRepository.save(b1);

        DormBuilding b2 = new DormBuilding();
        b2.setBuildingCode("BLD002");
        b2.setBuildingName("2号宿舍楼");
        b2.setFloorCount(6);
        b2.setRoomCount(120);
        b2.setLocation("东区");
        b2.setManager("李管理");
        b2.setManagerPhone("13800138002");
        buildingRepository.save(b2);

        DormBuilding b3 = new DormBuilding();
        b3.setBuildingCode("BLD003");
        b3.setBuildingName("3号宿舍楼");
        b3.setFloorCount(8);
        b3.setRoomCount(160);
        b3.setLocation("西区");
        b3.setManager("王管理");
        b3.setManagerPhone("13800138003");
        buildingRepository.save(b3);

        System.out.println("初始化宿舍楼数据完成");
    }

    private void initTeams() {
        ConstructionTeam t1 = new ConstructionTeam();
        t1.setTeamCode("TEAM001");
        t1.setTeamName("水电维修一队");
        t1.setLeader("陈队长");
        t1.setLeaderPhone("13900139001");
        t1.setQualification("水电维修三级资质");
        t1.setMemberCount(5);
        t1.setSpecialty("水电维修");
        teamRepository.save(t1);

        ConstructionTeam t2 = new ConstructionTeam();
        t2.setTeamCode("TEAM002");
        t2.setTeamName("土木维修二队");
        t2.setLeader("刘队长");
        t2.setLeaderPhone("13900139002");
        t2.setQualification("土木维修二级资质");
        t2.setMemberCount(8);
        t2.setSpecialty("土木维修");
        teamRepository.save(t2);

        ConstructionTeam t3 = new ConstructionTeam();
        t3.setTeamCode("TEAM003");
        t3.setTeamName("综合维修三队");
        t3.setLeader("赵队长");
        t3.setLeaderPhone("13900139003");
        t3.setQualification("综合维修一级资质");
        t3.setMemberCount(10);
        t3.setSpecialty("综合维修");
        teamRepository.save(t3);

        System.out.println("初始化施工队数据完成");
    }

    private void initQuietPeriods() {
        LocalDateTime now = LocalDateTime.now();

        QuietPeriod examWeek = new QuietPeriod();
        examWeek.setPeriodType(QuietPeriodType.EXAM_WEEK);
        examWeek.setPeriodName("期末考试周");
        examWeek.setAllBuildings(true);
        examWeek.setStartDate(now.plusDays(7));
        examWeek.setEndDate(now.plusDays(14));
        examWeek.setReason("期末考试期间，禁止噪音施工");
        examWeek.setCreatedBy("system");
        quietPeriodRepository.save(examWeek);

        QuietPeriod holiday = new QuietPeriod();
        holiday.setPeriodType(QuietPeriodType.HOLIDAY);
        holiday.setPeriodName("元旦假期");
        holiday.setAllBuildings(true);
        holiday.setStartDate(LocalDateTime.of(now.getYear(), 1, 1, 0, 0));
        holiday.setEndDate(LocalDateTime.of(now.getYear(), 1, 3, 23, 59));
        holiday.setReason("法定节假日");
        holiday.setCreatedBy("system");
        quietPeriodRepository.save(holiday);

        System.out.println("初始化静音时段数据完成");
    }
}
