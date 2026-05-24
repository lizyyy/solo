package com.hospital.oxygen.config;

import com.hospital.oxygen.entity.*;
import com.hospital.oxygen.enums.PortStatus;
import com.hospital.oxygen.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    private final BedRepository bedRepository;
    private final PatientRepository patientRepository;
    private final OxygenPortRepository oxygenPortRepository;
    private final EquipmentRepository equipmentRepository;

    public DataInitializer(BedRepository bedRepository, PatientRepository patientRepository, OxygenPortRepository oxygenPortRepository, EquipmentRepository equipmentRepository) {
        this.bedRepository = bedRepository;
        this.patientRepository = patientRepository;
        this.oxygenPortRepository = oxygenPortRepository;
        this.equipmentRepository = equipmentRepository;
    }

    @Override
    public void run(String... args) {
        log.info("开始初始化基础数据...");

        initBeds();
        initPatients();
        initOxygenPorts();
        initEquipments();

        log.info("基础数据初始化完成");
    }

    private void initBeds() {
        if (bedRepository.count() > 0) return;

        String[] wards = {"呼吸一科", "呼吸二科", "ICU"};
        String[] rooms = {"101", "102", "103", "201", "202"};

        for (String ward : wards) {
            for (int i = 1; i <= 6; i++) {
                Bed bed = new Bed();
                bed.setBedNumber(ward + "-" + String.format("%02d", i));
                bed.setWard(ward);
                bed.setRoomNumber(rooms[(i - 1) % rooms.length]);
                bed.setIsActive(true);
                bedRepository.save(bed);
            }
        }
        log.info("初始化床位: {} 张", bedRepository.count());
    }

    private void initPatients() {
        if (patientRepository.count() > 0) return;

        String[][] patientsData = {
            {"P001", "张三", "65", "男", "呼吸一科", "慢性阻塞性肺疾病", "高流量"},
            {"P002", "李四", "58", "女", "呼吸一科", "肺炎", "中流量"},
            {"P003", "王五", "72", "男", "呼吸二科", "呼吸衰竭", "高流量"},
            {"P004", "赵六", "45", "男", "呼吸二科", "哮喘", "低流量"},
            {"P005", "钱七", "80", "女", "ICU", "急性呼吸窘迫综合征", "呼吸机"}
        };

        for (String[] data : patientsData) {
            Patient patient = new Patient();
            patient.setPatientId(data[0]);
            patient.setName(data[1]);
            patient.setAge(Integer.parseInt(data[2]));
            patient.setGender(data[3]);
            patient.setCurrentWard(data[4]);
            patient.setDiagnosis(data[5]);
            patient.setOxygenRequirement(data[6]);
            patient.setIsActive(true);
            patientRepository.save(patient);
        }
        log.info("初始化患者: {} 人", patientRepository.count());
    }

    private void initOxygenPorts() {
        if (oxygenPortRepository.count() > 0) return;

        String[] wards = {"呼吸一科", "呼吸二科", "ICU"};
        String[] types = {"墙式", "吊塔", "移动式"};

        for (String ward : wards) {
            for (int i = 1; i <= 8; i++) {
                OxygenPort port = new OxygenPort();
                port.setPortCode(ward + "-PORT-" + String.format("%02d", i));
                port.setWard(ward);
                port.setLocation(types[(i - 1) % types.length]);
                port.setStatus(PortStatus.AVAILABLE);
                port.setIsActive(true);
                oxygenPortRepository.save(port);
            }
        }
        log.info("初始化氧气接口: {} 个", oxygenPortRepository.count());
    }

    private void initEquipments() {
        if (equipmentRepository.count() > 0) return;

        String[][] equipmentsData = {
            {"E001", "呼吸机", "呼吸治疗", "PB840", "呼吸一科"},
            {"E002", "高流量湿化仪", "呼吸治疗", "AIRVO2", "呼吸一科"},
            {"E003", "监护仪", "监护", "MP70", "呼吸一科"},
            {"E004", "呼吸机", "呼吸治疗", "Servo-s", "呼吸二科"},
            {"E005", "高流量湿化仪", "呼吸治疗", "AIRVO2", "呼吸二科"},
            {"E006", "监护仪", "监护", "MP70", "呼吸二科"},
            {"E007", "有创呼吸机", "重症治疗", "PB980", "ICU"},
            {"E008", "ECMO", "生命支持", "CardioHelp", "ICU"}
        };

        for (String[] data : equipmentsData) {
            Equipment equipment = new Equipment();
            equipment.setEquipmentCode(data[0]);
            equipment.setName(data[1]);
            equipment.setType(data[2]);
            equipment.setModel(data[3]);
            equipment.setWard(data[4]);
            equipment.setIsAvailable(true);
            equipment.setIsActive(true);
            equipmentRepository.save(equipment);
        }
        log.info("初始化设备: {} 台", equipmentRepository.count());
    }
}
