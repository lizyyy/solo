package com.bus.notify.config;

import com.bus.notify.entity.Operator;
import com.bus.notify.entity.SpecialPassenger;
import com.bus.notify.repository.OperatorRepository;
import com.bus.notify.repository.SpecialPassengerRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer implements CommandLineRunner {
    private final OperatorRepository operatorRepository;
    private final SpecialPassengerRepository passengerRepository;
    
    public DataInitializer(OperatorRepository operatorRepository, SpecialPassengerRepository passengerRepository) {
        this.operatorRepository = operatorRepository;
        this.passengerRepository = passengerRepository;
    }
    
    @Override
    public void run(String... args) {
        if (operatorRepository.count() == 0) {
            Operator op1 = new Operator();
            op1.setUsername("admin");
            op1.setName("系统管理员");
            op1.setPhone("13800000000");
            op1.setDepartment("客服中心");
            op1.setActive(true);
            operatorRepository.save(op1);
            
            Operator op2 = new Operator();
            op2.setUsername("kefu01");
            op2.setName("张客服");
            op2.setPhone("13800000001");
            op2.setDepartment("客服中心");
            op2.setActive(true);
            operatorRepository.save(op2);
            
            Operator op3 = new Operator();
            op3.setUsername("kefu02");
            op3.setName("李客服");
            op3.setPhone("13800000002");
            op3.setDepartment("客服中心");
            op3.setActive(true);
            operatorRepository.save(op3);
        }
        
        if (passengerRepository.count() == 0) {
            SpecialPassenger p1 = new SpecialPassenger();
            p1.setPassengerName("王大爷");
            p1.setCardNo("LD20240001");
            p1.setCardType("老人卡");
            p1.setPhone("13900000001");
            p1.setAddress("朝阳区XX小区");
            p1.setEmergencyContact("王小宝");
            p1.setEmergencyPhone("13900000002");
            p1.setCommonRoute("1路,5路");
            p1.setCommonStation("人民广场,市政府");
            p1.setNeedPhoneCall(true);
            p1.setActive(true);
            p1.setRemark("听力一般，需要大声说话");
            passengerRepository.save(p1);
            
            SpecialPassenger p2 = new SpecialPassenger();
            p2.setPassengerName("刘奶奶");
            p2.setCardNo("LD20240002");
            p2.setCardType("老人卡");
            p2.setPhone("13900000003");
            p2.setAddress("海淀区XX小区");
            p2.setEmergencyContact("刘小明");
            p2.setEmergencyPhone("13900000004");
            p2.setCommonRoute("1路");
            p2.setCommonStation("人民广场");
            p2.setNeedPhoneCall(true);
            p2.setActive(true);
            passengerRepository.save(p2);
            
            SpecialPassenger p3 = new SpecialPassenger();
            p3.setPassengerName("陈大爷");
            p3.setCardNo("LD20240003");
            p3.setCardType("老人卡");
            p3.setPhone("13900000005");
            p3.setCommonRoute("5路");
            p3.setCommonStation("市政府,火车站");
            p3.setNeedPhoneCall(false);
            p3.setActive(true);
            passengerRepository.save(p3);
            
            SpecialPassenger p4 = new SpecialPassenger();
            p4.setPassengerName("赵阿姨");
            p4.setCardNo("LD20240004");
            p4.setCardType("老人卡");
            p4.setPhone("13900000006");
            p4.setCommonRoute("10路");
            p4.setCommonStation("医院");
            p4.setNeedPhoneCall(true);
            p4.setActive(true);
            passengerRepository.save(p4);
        }
    }
}
