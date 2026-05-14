package com.feiyong.feecalc.service;

import com.feiyong.feecalc.entity.CalculationRequest;
import com.feiyong.feecalc.entity.PriceLockCertificate;
import com.feiyong.feecalc.enums.CalculationStatus;
import com.feiyong.feecalc.repository.CalculationRequestRepository;
import com.feiyong.feecalc.repository.PriceLockCertificateRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
public class ExpirationCleanupService {

    @Autowired
    private PriceLockCertificateRepository lockCertificateRepository;

    @Autowired
    private CalculationRequestRepository requestRepository;

    @Autowired
    private TimelineService timelineService;

    @Scheduled(fixedRate = 60000)
    @Transactional
    public void cleanupExpiredCertificates() {
        log.debug("开始清理过期锁价凭证...");

        LocalDateTime now = LocalDateTime.now();
        List<PriceLockCertificate> expiredCerts = lockCertificateRepository.findByValidTrueAndExpiredAtBefore(now);

        for (PriceLockCertificate cert : expiredCerts) {
            log.info("锁价凭证已过期, 标记为无效, certificateNo={}", cert.getCertificateNo());
            cert.setValid(false);
            lockCertificateRepository.save(cert);

            CalculationRequest request = requestRepository.findByRequestNo(cert.getRequestNo()).orElse(null);
            if (request != null && request.getStatus() == CalculationStatus.LOCKED) {
                request.setStatus(CalculationStatus.EXPIRED);
                requestRepository.save(request);
                timelineService.recordAction(request.getRequestNo(), "EXPIRED", "锁价过期", null, null, "SYSTEM");
            }
        }

        if (!expiredCerts.isEmpty()) {
            log.info("清理完成, 共处理 {} 个过期凭证", expiredCerts.size());
        }
    }
}
