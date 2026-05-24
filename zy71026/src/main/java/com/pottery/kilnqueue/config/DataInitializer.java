package com.pottery.kilnqueue.config;

import com.pottery.kilnqueue.entity.Glaze;
import com.pottery.kilnqueue.repository.GlazeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);
    private final GlazeRepository glazeRepository;

    public DataInitializer(GlazeRepository glazeRepository) {
        this.glazeRepository = glazeRepository;
    }

    @Override
    public void run(String... args) {
        if (glazeRepository.count() == 0) {
            log.info("初始化釉料数据...");

            createGlaze("G001", "透明釉", "标准", "G005,G008", 1200, 1250);
            createGlaze("G002", "青瓷釉", "标准", "G005", 1230, 1280);
            createGlaze("G003", "钧釉", "高温", "G007", 1250, 1300);
            createGlaze("G004", "汝釉", "高温", "", 1200, 1250);
            createGlaze("G005", "铜红釉", "颜色", "G001,G002,G006", 1280, 1320);
            createGlaze("G006", "钴蓝釉", "颜色", "G005", 1250, 1280);
            createGlaze("G007", "铁锈花釉", "结晶", "G003", 1220, 1260);
            createGlaze("G008", "裂纹釉", "特殊", "G001", 1200, 1240);
            createGlaze("G009", "无光釉", "哑光", "", 1230, 1270);
            createGlaze("G010", "结晶釉", "特殊", "", 1260, 1300);

            log.info("釉料数据初始化完成");
        }
    }

    private void createGlaze(String code, String name, String brand, String conflicts, Integer minTemp, Integer maxTemp) {
        Glaze glaze = new Glaze();
        glaze.setCode(code);
        glaze.setName(name);
        glaze.setBrand(brand);
        glaze.setConflictGlazes(conflicts);
        glaze.setMinTemp(minTemp);
        glaze.setMaxTemp(maxTemp);
        glaze.setActive(true);
        glazeRepository.save(glaze);
    }
}
