package com.port.reefer.config;

import com.port.reefer.entity.Inspector;
import com.port.reefer.entity.PowerSocket;
import com.port.reefer.entity.ReeferContainer;
import com.port.reefer.entity.enums.SocketStatus;
import com.port.reefer.repository.InspectorRepository;
import com.port.reefer.repository.PowerSocketRepository;
import com.port.reefer.repository.ReeferContainerRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
public class DataInitializer implements CommandLineRunner {
    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);
    
    private final InspectorRepository inspectorRepository;
    private final PowerSocketRepository powerSocketRepository;
    private final ReeferContainerRepository reeferContainerRepository;

    public DataInitializer(InspectorRepository inspectorRepository,
                          PowerSocketRepository powerSocketRepository,
                          ReeferContainerRepository reeferContainerRepository) {
        this.inspectorRepository = inspectorRepository;
        this.powerSocketRepository = powerSocketRepository;
        this.reeferContainerRepository = reeferContainerRepository;
    }

    @Override
    public void run(String... args) {
        initInspectors();
        initSockets();
        initContainers();
        log.info("=== 初始化数据完成 ===");
    }

    private void initInspectors() {
        if (inspectorRepository.count() > 0) {
            return;
        }

        String[][] inspectorsData = {
                {"INS001", "张三", "13800138001"},
                {"INS002", "李四", "13800138002"},
                {"INS003", "王五", "13800138003"}
        };

        for (String[] data : inspectorsData) {
            Inspector inspector = new Inspector();
            inspector.setBadgeNumber(data[0]);
            inspector.setName(data[1]);
            inspector.setPhone(data[2]);
            inspectorRepository.save(inspector);
        }
        log.info("初始化巡检人数据完成，共 {} 条", inspectorsData.length);
    }

    private void initSockets() {
        if (powerSocketRepository.count() > 0) {
            return;
        }

        String[] areas = {"A", "B", "C"};
        int[] rows = {1, 2, 3};
        int[] cols = {1, 2, 3, 4};

        int count = 0;
        for (String area : areas) {
            for (int row : rows) {
                for (int col : cols) {
                    PowerSocket socket = new PowerSocket();
                    socket.setSocketCode(String.format("%s-%02d-%02d", area, row, col));
                    socket.setLocation(String.format("%s区 第%d排 第%d列", area, row, col));
                    socket.setStatus(SocketStatus.AVAILABLE);
                    powerSocketRepository.save(socket);
                    count++;
                }
            }
        }
        log.info("初始化插座数据完成，共 {} 个", count);
    }

    private void initContainers() {
        if (reeferContainerRepository.count() > 0) {
            return;
        }

        Object[][] containersData = {
                {"CBHU1234567", new BigDecimal("-18"), "中远海运", "COS001", "上海"},
                {"MSKU7654321", new BigDecimal("-20"), "马士基", "MAE002", "宁波"},
                {"OOLU9876543", new BigDecimal("-15"), "东方海外", "OOL003", "深圳"}
        };

        for (Object[] data : containersData) {
            ReeferContainer container = new ReeferContainer();
            container.setContainerNumber((String) data[0]);
            container.setTargetTemperature((BigDecimal) data[1]);
            container.setVesselName((String) data[2]);
            container.setVoyageNumber((String) data[3]);
            container.setDestination((String) data[4]);
            reeferContainerRepository.save(container);
        }
        log.info("初始化冷藏箱数据完成，共 {} 个", containersData.length);
    }
}
