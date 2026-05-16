package com.dns.preplay.config;

import com.dns.preplay.model.dto.CreatePreplayRequest;
import com.dns.preplay.model.dto.DnsRecordDTO;
import com.dns.preplay.model.enums.RecordType;
import com.dns.preplay.service.DnsPreplayService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class DataInitializer {

    private final DnsPreplayService dnsPreplayService;

    @Bean
    public CommandLineRunner initSampleData() {
        return args -> {
            if (dnsPreplayService.getAllPreplays().isEmpty()) {
                log.info("正在初始化样例数据...");

                CreatePreplayRequest sample1 = CreatePreplayRequest.builder()
                        .preplayName("生产环境域名切换预演")
                        .description("api.example.com 从旧服务器迁移到新服务器")
                        .createdBy("admin")
                        .records(List.of(
                                DnsRecordDTO.builder()
                                        .domainName("api.example.com")
                                        .recordType(RecordType.A)
                                        .oldTarget("192.168.1.100")
                                        .newTarget("10.0.0.50")
                                        .ttl(3600)
                                        .expectedTtl(300)
                                        .ttlStrategy("切换前降低到300秒")
                                        .build(),
                                DnsRecordDTO.builder()
                                        .domainName("www.example.com")
                                        .recordType(RecordType.CNAME)
                                        .oldTarget("old-lb.example.com")
                                        .newTarget("new-lb.example.com")
                                        .ttl(7200)
                                        .expectedTtl(300)
                                        .ttlStrategy("需要先降低TTL")
                                        .build()
                        ))
                        .build();

                CreatePreplayRequest sample2 = CreatePreplayRequest.builder()
                        .preplayName("测试环境DNS更新")
                        .description("测试环境多个子域名批量更新")
                        .createdBy("tester")
                        .records(List.of(
                                DnsRecordDTO.builder()
                                        .domainName("test.example.com")
                                        .recordType(RecordType.A)
                                        .oldTarget("172.16.0.10")
                                        .newTarget("172.16.0.10")
                                        .ttl(300)
                                        .expectedTtl(300)
                                        .build(),
                                DnsRecordDTO.builder()
                                        .domainName("dev.example.com")
                                        .recordType(RecordType.A)
                                        .oldTarget("172.16.0.20")
                                        .newTarget("172.16.0.21")
                                        .ttl(120)
                                        .expectedTtl(300)
                                        .build()
                        ))
                        .build();

                dnsPreplayService.createPreplay(sample1);
                dnsPreplayService.createPreplay(sample2);

                log.info("样例数据初始化完成!");
            }
        };
    }
}
