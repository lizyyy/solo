package com.tokenexchange.config;

import com.tokenexchange.entity.UserToken;
import com.tokenexchange.repository.ServiceIdentityRepository;
import com.tokenexchange.repository.UserTokenRepository;
import com.tokenexchange.service.TokenExchangeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {
    private final TokenExchangeService tokenExchangeService;
    private final ServiceIdentityRepository serviceIdentityRepository;
    private final UserTokenRepository userTokenRepository;

    @Override
    public void run(String... args) {
        if (serviceIdentityRepository.count() == 0) {
            log.info("Initializing test data...");

            tokenExchangeService.createServiceIdentity(
                    "service-auth",
                    "认证服务",
                    "系统核心认证服务",
                    "read,write,admin"
            );

            tokenExchangeService.createServiceIdentity(
                    "service-user",
                    "用户服务",
                    "用户信息管理服务",
                    "read,write"
            );

            tokenExchangeService.createServiceIdentity(
                    "service-order",
                    "订单服务",
                    "订单管理服务",
                    "read,write"
            );

            tokenExchangeService.createServiceIdentity(
                    "service-payment",
                    "支付服务",
                    "支付处理服务",
                    "read"
            );

            tokenExchangeService.createExchangeScenario(
                    "USER_TO_ORDER",
                    "用户访问订单",
                    "用户服务访问订单服务的标准场景",
                    "service-user",
                    "service-order",
                    "read,write",
                    30
            );

            tokenExchangeService.createExchangeScenario(
                    "ORDER_TO_PAYMENT",
                    "订单访问支付",
                    "订单服务调用支付服务",
                    "service-order",
                    "service-payment",
                    "read",
                    15
            );

            UserToken userToken1 = tokenExchangeService.createUserToken(
                    "user-001",
                    "read,write,admin",
                    30
            );

            UserToken userToken2 = tokenExchangeService.createUserToken(
                    "user-002",
                    "read,write",
                    30
            );

            log.info("Test user token 1: {}", userToken1.getTokenValue());
            log.info("Test user token 2: {}", userToken2.getTokenValue());
            log.info("Test data initialization completed!");
        }
    }
}
