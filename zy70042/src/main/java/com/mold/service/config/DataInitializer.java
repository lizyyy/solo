package com.mold.service.config;

import com.mold.service.domain.entity.Mold;
import com.mold.service.domain.entity.ProductionSchedule;
import com.mold.service.domain.repository.MoldRepository;
import com.mold.service.domain.repository.ProductionScheduleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {
    
    private final MoldRepository moldRepository;
    private final ProductionScheduleRepository scheduleRepository;
    
    @Override
    public void run(String... args) {
        initDemoData();
    }
    
    private void initDemoData() {
        log.info("初始化演示数据...");
        
        Mold mold1 = createMold("MOLD-001", "汽车前盖模具-A", 100000L, 90000L, 85000L, "LINE-01", "PROD-A001", Mold.MoldStatus.IN_USE);
        Mold mold2 = createMold("MOLD-002", "汽车后盖模具-B", 80000L, 72000L, 45000L, "LINE-02", "PROD-B002", Mold.MoldStatus.IN_USE);
        Mold mold3 = createMold("MOLD-003", "门板模具-C", 60000L, 54000L, 58000L, "LINE-01", "PROD-C003", Mold.MoldStatus.WARNING);
        Mold mold4 = createMold("MOLD-004", "保险杠模具-D", 50000L, 45000L, 52000L, "LINE-03", "PROD-D004", Mold.MoldStatus.EXPIRED);
        Mold mold5 = createMold("MOLD-005", "仪表板模具-E", 120000L, 108000L, 20000L, "LINE-02", "PROD-E005", Mold.MoldStatus.IN_USE);
        
        createSchedule("SCH-001", "LINE-01", "PROD-A001", mold1, 1000L, 
                LocalDateTime.now().minusHours(2), LocalDateTime.now().plusHours(6),
                ProductionSchedule.ScheduleStatus.IN_PROGRESS);
        
        createSchedule("SCH-002", "LINE-01", "PROD-C003", mold3, 800L,
                LocalDateTime.now().plusHours(8), LocalDateTime.now().plusHours(16),
                ProductionSchedule.ScheduleStatus.PLANNED);
        
        createSchedule("SCH-003", "LINE-02", "PROD-B002", mold2, 1500L,
                LocalDateTime.now().minusHours(4), LocalDateTime.now().plusHours(4),
                ProductionSchedule.ScheduleStatus.IN_PROGRESS);
        
        createSchedule("SCH-004", "LINE-03", "PROD-D004", mold4, 500L,
                LocalDateTime.now().minusHours(1), LocalDateTime.now().plusHours(3),
                ProductionSchedule.ScheduleStatus.IN_PROGRESS);
        
        log.info("演示数据初始化完成: 5个模具, 4个排程");
    }
    
    private Mold createMold(String code, String name, Long lifeThreshold, Long warningThreshold, 
                            Long totalStrokes, String line, String product, Mold.MoldStatus status) {
        Mold mold = new Mold();
        mold.setMoldCode(code);
        mold.setMoldName(name);
        mold.setLifeThreshold(lifeThreshold);
        mold.setWarningThreshold(warningThreshold);
        mold.setTotalStrokes(totalStrokes);
        mold.setProductionLine(line);
        mold.setCurrentProduct(product);
        mold.setStatus(status);
        mold.setCreatedBy("SYSTEM");
        mold.setUpdatedBy("SYSTEM");
        return moldRepository.save(mold);
    }
    
    private ProductionSchedule createSchedule(String no, String line, String product, Mold mold,
                                              Long qty, LocalDateTime start, LocalDateTime end,
                                              ProductionSchedule.ScheduleStatus status) {
        ProductionSchedule schedule = new ProductionSchedule();
        schedule.setScheduleNo(no);
        schedule.setProductionLine(line);
        schedule.setProductCode(product);
        schedule.setMoldId(mold != null ? mold.getId() : null);
        schedule.setMoldCode(mold != null ? mold.getMoldCode() : null);
        schedule.setPlannedQuantity(qty);
        schedule.setPlannedStartTime(start);
        schedule.setPlannedEndTime(end);
        schedule.setStatus(status);
        schedule.setCreatedBy("SYSTEM");
        schedule.setUpdatedBy("SYSTEM");
        return scheduleRepository.save(schedule);
    }
}
