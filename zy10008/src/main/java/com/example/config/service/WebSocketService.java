package com.example.config.service;

import com.example.config.domain.ClientRegistry;
import com.example.config.domain.ClientRegistry.ConnectionStatus;
import com.example.config.repository.ClientRegistryRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class WebSocketService extends TextWebSocketHandler {

    private final ClientRegistryRepository clientRegistryRepository;
    private final EventLogService eventLogService;
    private final ObjectMapper objectMapper;

    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private final Map<String, String> sessionToInstanceId = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String sessionId = session.getId();
        log.info("WebSocket连接建立: sessionId={}", sessionId);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();
        log.debug("收到消息: sessionId={}, payload={}", session.getId(), payload);

        try {
            Map<String, Object> msg = objectMapper.readValue(payload, Map.class);
            String type = (String) msg.get("type");

            switch (type) {
                case "REGISTER":
                    handleRegister(session, msg);
                    break;
                case "HEARTBEAT":
                    handleHeartbeat(session, msg);
                    break;
                case "SUBSCRIBE":
                    handleSubscribe(session, msg);
                    break;
                case "UNSUBSCRIBE":
                    handleUnsubscribe(session, msg);
                    break;
                case "ACK":
                    handleAck(session, msg);
                    break;
                default:
                    log.warn("未知消息类型: {}", type);
            }
        } catch (Exception e) {
            log.error("处理消息失败: {}", e.getMessage(), e);
            sendError(session, "INVALID_MESSAGE", e.getMessage());
        }
    }

    private void handleRegister(WebSocketSession session, Map<String, Object> msg) {
        String instanceId = (String) msg.get("instanceId");
        String serviceName = (String) msg.get("serviceName");
        String environment = (String) msg.getOrDefault("environment", "default");
        String ipAddress = (String) msg.get("ipAddress");
        Integer port = msg.get("port") != null ? ((Number) msg.get("port")).intValue() : null;

        if (instanceId == null || serviceName == null) {
            sendError(session, "MISSING_PARAMS", "instanceId 和 serviceName 必填");
            return;
        }

        sessions.put(instanceId, session);
        sessionToInstanceId.put(session.getId(), instanceId);

        ClientRegistry registry = clientRegistryRepository.findByInstanceId(instanceId)
                .orElse(new ClientRegistry());

        registry.setInstanceId(instanceId);
        registry.setServiceName(serviceName);
        registry.setEnvironment(environment);
        registry.setIpAddress(ipAddress);
        registry.setPort(port);
        registry.setSessionId(session.getId());
        registry.setStatus(ConnectionStatus.CONNECTED);
        registry.setLastHeartbeatAt(LocalDateTime.now());

        if (registry.getConnectedAt() == null) {
            registry.setConnectedAt(LocalDateTime.now());
        }

        clientRegistryRepository.save(registry);
        eventLogService.logClientConnect(instanceId, serviceName);

        sendResponse(session, "REGISTER_ACK", Map.of(
                "instanceId", instanceId,
                "status", "OK"
        ));
    }

    private void handleHeartbeat(WebSocketSession session, Map<String, Object> msg) {
        String instanceId = sessionToInstanceId.get(session.getId());
        if (instanceId == null) {
            sendError(session, "NOT_REGISTERED", "请先注册");
            return;
        }

        clientRegistryRepository.findByInstanceId(instanceId).ifPresent(registry -> {
            registry.setLastHeartbeatAt(LocalDateTime.now());
            registry.setStatus(ConnectionStatus.CONNECTED);
            clientRegistryRepository.save(registry);
        });

        sendResponse(session, "HEARTBEAT_ACK", Map.of("timestamp", System.currentTimeMillis()));
    }

    private void handleSubscribe(WebSocketSession session, Map<String, Object> msg) {
        String instanceId = sessionToInstanceId.get(session.getId());
        if (instanceId == null) {
            sendError(session, "NOT_REGISTERED", "请先注册");
            return;
        }

        String namespace = (String) msg.get("namespace");
        if (namespace == null) {
            sendError(session, "MISSING_PARAMS", "namespace 必填");
            return;
        }

        clientRegistryRepository.findByInstanceId(instanceId).ifPresent(registry -> {
            if (registry.getSubscriptions() == null) {
                registry.setSubscriptions(new HashSet<>());
            }
            registry.getSubscriptions().add(namespace);
            clientRegistryRepository.save(registry);
            log.info("客户端订阅: instanceId={}, namespace={}", instanceId, namespace);
            eventLogService.logEvent(
                    com.example.config.domain.ConfigEventLog.EventType.CLIENT_SUBSCRIBE,
                    com.example.config.domain.ConfigEventLog.EventLevel.INFO,
                    instanceId, "ClientRegistry",
                    "客户端订阅: " + namespace,
                    Map.of("namespace", namespace), null
            );
        });

        sendResponse(session, "SUBSCRIBE_ACK", Map.of("namespace", namespace, "status", "OK"));
    }

    private void handleUnsubscribe(WebSocketSession session, Map<String, Object> msg) {
        String instanceId = sessionToInstanceId.get(session.getId());
        if (instanceId == null) {
            sendError(session, "NOT_REGISTERED", "请先注册");
            return;
        }

        String namespace = (String) msg.get("namespace");
        if (namespace == null) {
            sendError(session, "MISSING_PARAMS", "namespace 必填");
            return;
        }

        clientRegistryRepository.findByInstanceId(instanceId).ifPresent(registry -> {
            if (registry.getSubscriptions() != null) {
                registry.getSubscriptions().remove(namespace);
                clientRegistryRepository.save(registry);
            }
            eventLogService.logEvent(
                    com.example.config.domain.ConfigEventLog.EventType.CLIENT_UNSUBSCRIBE,
                    com.example.config.domain.ConfigEventLog.EventLevel.INFO,
                    instanceId, "ClientRegistry",
                    "客户端取消订阅: " + namespace,
                    Map.of("namespace", namespace), null
            );
        });

        sendResponse(session, "UNSUBSCRIBE_ACK", Map.of("namespace", namespace, "status", "OK"));
    }

    private void handleAck(WebSocketSession session, Map<String, Object> msg) {
        String instanceId = sessionToInstanceId.get(session.getId());
        String releaseId = (String) msg.get("releaseId");
        String status = (String) msg.get("status");

        if (releaseId != null) {
            log.info("收到推送确认: instanceId={}, releaseId={}, status={}", instanceId, releaseId, status);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        String sessionId = session.getId();
        String instanceId = sessionToInstanceId.remove(sessionId);

        if (instanceId != null) {
            sessions.remove(instanceId);

            clientRegistryRepository.findByInstanceId(instanceId).ifPresent(registry -> {
                registry.setStatus(ConnectionStatus.DISCONNECTED);
                registry.setDisconnectedAt(LocalDateTime.now());
                clientRegistryRepository.save(registry);
            });

            eventLogService.logClientDisconnect(instanceId, "连接关闭: " + status);
        }

        log.info("WebSocket连接关闭: sessionId={}, instanceId={}, status={}", sessionId, instanceId, status);
    }

    public boolean pushToClient(String instanceId, Map<String, Object> message) {
        WebSocketSession session = sessions.get(instanceId);
        if (session == null || !session.isOpen()) {
            log.warn("客户端不在线: {}", instanceId);
            return false;
        }

        try {
            String json = objectMapper.writeValueAsString(message);
            session.sendMessage(new TextMessage(json));
            log.debug("推送消息到客户端: instanceId={}, messageType={}", instanceId, message.get("type"));
            return true;
        } catch (IOException e) {
            log.error("推送消息失败: instanceId={}, error={}", instanceId, e.getMessage());
            return false;
        }
    }

    public List<ClientRegistry> getSubscribedClients(String namespace) {
        return clientRegistryRepository.findSubscribedClients(namespace, ConnectionStatus.CONNECTED);
    }

    public Optional<ClientRegistry> getClientRegistry(String instanceId) {
        return clientRegistryRepository.findByInstanceId(instanceId);
    }

    public long getConnectedClientCount() {
        return clientRegistryRepository.countByStatus(ConnectionStatus.CONNECTED);
    }

    public boolean isClientConnected(String instanceId) {
        WebSocketSession session = sessions.get(instanceId);
        return session != null && session.isOpen();
    }

    private void sendResponse(WebSocketSession session, String type, Map<String, Object> data) {
        try {
            Map<String, Object> message = new HashMap<>();
            message.put("type", type);
            message.put("timestamp", System.currentTimeMillis());
            message.put("data", data);
            String json = objectMapper.writeValueAsString(message);
            session.sendMessage(new TextMessage(json));
        } catch (IOException e) {
            log.error("发送响应失败: {}", e.getMessage());
        }
    }

    private void sendError(WebSocketSession session, String code, String message) {
        try {
            Map<String, Object> errorMsg = new HashMap<>();
            errorMsg.put("type", "ERROR");
            errorMsg.put("code", code);
            errorMsg.put("message", message);
            errorMsg.put("timestamp", System.currentTimeMillis());
            String json = objectMapper.writeValueAsString(errorMsg);
            session.sendMessage(new TextMessage(json));
        } catch (IOException e) {
            log.error("发送错误响应失败: {}", e.getMessage());
        }
    }
}
