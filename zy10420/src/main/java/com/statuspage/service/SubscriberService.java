package com.statuspage.service;

import com.statuspage.exception.BusinessException;
import com.statuspage.exception.ErrorCode;
import com.statuspage.model.Subscriber;
import com.statuspage.repository.SubscriberRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class SubscriberService {
    private final SubscriberRepository subscriberRepository;

    @Transactional
    public Subscriber createSubscriber(String subscriberId, String name, String email, String phone, String organization) {
        if (subscriberRepository.existsBySubscriberId(subscriberId)) {
            throw new BusinessException("SUBSCRIBER_002", "订阅方ID已存在");
        }

        Subscriber subscriber = new Subscriber();
        subscriber.setSubscriberId(subscriberId);
        subscriber.setName(name);
        subscriber.setEmail(email);
        subscriber.setPhone(phone);
        subscriber.setOrganization(organization);
        subscriber.setActive(true);
        subscriber.setCreatedAt(LocalDateTime.now());

        return subscriberRepository.save(subscriber);
    }

    public Subscriber getSubscriber(String subscriberId) {
        return subscriberRepository.findBySubscriberId(subscriberId)
                .orElseThrow(() -> new BusinessException(ErrorCode.SUBSCRIBER_NOT_FOUND.getCode(), ErrorCode.SUBSCRIBER_NOT_FOUND.getMessage()));
    }

    public List<Subscriber> getAllSubscribers() {
        return subscriberRepository.findAll();
    }

    public List<Subscriber> getActiveSubscribers() {
        return subscriberRepository.findByActiveTrue();
    }

    @Transactional
    public Subscriber updateSubscriber(String subscriberId, String name, String email, String phone, String organization, Boolean active) {
        Subscriber subscriber = getSubscriber(subscriberId);

        if (name != null) {
            subscriber.setName(name);
        }
        if (email != null) {
            subscriber.setEmail(email);
        }
        if (phone != null) {
            subscriber.setPhone(phone);
        }
        if (organization != null) {
            subscriber.setOrganization(organization);
        }
        if (active != null) {
            subscriber.setActive(active);
        }
        subscriber.setUpdatedAt(LocalDateTime.now());

        return subscriberRepository.save(subscriber);
    }

    @Transactional
    public void deleteSubscriber(String subscriberId) {
        Subscriber subscriber = getSubscriber(subscriberId);
        subscriberRepository.delete(subscriber);
    }
}