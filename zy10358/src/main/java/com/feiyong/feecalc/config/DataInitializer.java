package com.feiyong.feecalc.config;

import com.feiyong.feecalc.entity.DiscountItem;
import com.feiyong.feecalc.entity.ExpirationStrategy;
import com.feiyong.feecalc.entity.PriceRule;
import com.feiyong.feecalc.enums.DiscountType;
import com.feiyong.feecalc.repository.DiscountItemRepository;
import com.feiyong.feecalc.repository.ExpirationStrategyRepository;
import com.feiyong.feecalc.repository.PriceRuleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
public class DataInitializer implements CommandLineRunner {

    @Autowired
    private PriceRuleRepository priceRuleRepository;

    @Autowired
    private DiscountItemRepository discountItemRepository;

    @Autowired
    private ExpirationStrategyRepository expirationStrategyRepository;

    @Override
    public void run(String... args) {
        if (priceRuleRepository.count() == 0) {
            PriceRule rule1 = new PriceRule();
            rule1.setRuleCode("VIP_MEMBERSHIP");
            rule1.setRuleName("VIP会员订阅");
            rule1.setDescription("月度VIP会员订阅费用");
            rule1.setBasePrice(BigDecimal.ZERO);
            rule1.setUnitPrice(new BigDecimal("99.00"));
            rule1.setUnit("月");
            rule1.setEnabled(true);
            priceRuleRepository.save(rule1);

            PriceRule rule2 = new PriceRule();
            rule2.setRuleCode("CLOUD_STORAGE");
            rule2.setRuleName("云存储服务");
            rule2.setDescription("按使用量计费的云存储服务");
            rule2.setBasePrice(new BigDecimal("10.00"));
            rule2.setUnitPrice(new BigDecimal("0.50"));
            rule2.setUnit("GB");
            rule2.setEnabled(true);
            priceRuleRepository.save(rule2);
        }

        if (discountItemRepository.count() == 0) {
            DiscountItem discount1 = new DiscountItem();
            discount1.setDiscountCode("NEW_USER_10");
            discount1.setDiscountName("新用户9折");
            discount1.setDiscountType(DiscountType.PERCENTAGE);
            discount1.setPercentage(new BigDecimal("10"));
            discount1.setPriority(100);
            discount1.setEnabled(true);
            discountItemRepository.save(discount1);

            DiscountItem discount2 = new DiscountItem();
            discount2.setDiscountCode("COUPON_50");
            discount2.setDiscountName("50元优惠券");
            discount2.setDiscountType(DiscountType.FIXED_AMOUNT);
            discount2.setFixedAmount(new BigDecimal("50"));
            discount2.setMinAmount(new BigDecimal("100"));
            discount2.setPriority(50);
            discount2.setEnabled(true);
            discountItemRepository.save(discount2);
        }

        if (expirationStrategyRepository.count() == 0) {
            ExpirationStrategy strategy = new ExpirationStrategy();
            strategy.setStrategyCode("DEFAULT");
            strategy.setStrategyName("默认过期策略");
            strategy.setTtlMinutes(30);
            strategy.setEnabled(true);
            expirationStrategyRepository.save(strategy);
        }
    }
}
