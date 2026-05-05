package com.performancereview.parser;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.performancereview.entity.Incident;
import com.performancereview.entity.NetworkRtt;
import com.performancereview.enums.BottleneckSeverity;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
@Slf4j
public class NetworkRttParser implements FileParser {

    private static final Pattern PING_PATTERN = 
            Pattern.compile("(\\d{4}-\\d{2}-\\d{2}\\s+\\d{2}:\\d{2}:\\d{2})?.*?PING\\s+([^\\s]+).*?time[=<]([\\d.]+)ms");
    
    private static final Pattern TRACEROUTE_PATTERN = 
            Pattern.compile("(\\d+)\\s+([^\\s]+).*?([\\d.]+)ms");
    
    private static final Pattern NETWORK_LOG_PATTERN = 
            Pattern.compile("(\\d{4}-\\d{2}-\\d{2}\\s+\\d{2}:\\d{2}:\\d{2})\\s+([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)");
    
    private static final DateTimeFormatter[] DATE_FORMATTERS = {
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"),
            DateTimeFormatter.ISO_LOCAL_DATE_TIME
    };

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public String getSupportedFileType() {
        return "network-rtt";
    }

    @Override
    public boolean canParse(String fileName) {
        if (fileName == null) return false;
        String lowerName = fileName.toLowerCase();
        return lowerName.contains("network") && lowerName.contains("rtt") ||
               lowerName.contains("network") && lowerName.contains("latency") ||
               lowerName.contains("rtt") && lowerName.endsWith(".log") ||
               lowerName.contains("network") && lowerName.endsWith(".log") ||
               lowerName.contains("ping") && lowerName.endsWith(".log") ||
               lowerName.contains("traceroute") && lowerName.endsWith(".log") ||
               lowerName.contains("network") && lowerName.endsWith(".json");
    }

    @Override
    public void parse(File file, Incident incident) throws IOException, IllegalArgumentException {
        log.info("开始解析网络 RTT 文件: {}", file.getName());

        List<NetworkRtt> networkRtts = new ArrayList<>();

        String fileName = file.getName().toLowerCase();
        if (fileName.endsWith(".json")) {
            parseJsonFile(file, incident, networkRtts);
        } else {
            parseLogFile(file, incident, networkRtts);
        }

        if (networkRtts.isEmpty()) {
            log.warn("网络 RTT 文件中未解析到有效数据: {}", file.getName());
            throw new IllegalArgumentException("网络 RTT 文件格式不正确，无法解析到有效数据");
        }

        incident.getNetworkRtts().addAll(networkRtts);
        log.info("成功解析网络 RTT 文件: {}, 共解析到 {} 条网络 RTT 记录", file.getName(), networkRtts.size());
    }

    private void parseJsonFile(File file, Incident incident, List<NetworkRtt> networkRtts) throws IOException {
        JsonNode root = objectMapper.readTree(file);

        if (root.isArray()) {
            for (JsonNode node : root) {
                NetworkRtt networkRtt = parseJsonNetworkRtt(node);
                if (networkRtt != null) {
                    networkRtt.setIncident(incident);
                    networkRtts.add(networkRtt);
                }
            }
        } else {
            NetworkRtt networkRtt = parseJsonNetworkRtt(root);
            if (networkRtt != null) {
                networkRtt.setIncident(incident);
                networkRtts.add(networkRtt);
            }
        }
    }

    private NetworkRtt parseJsonNetworkRtt(JsonNode node) {
        try {
            NetworkRtt networkRtt = new NetworkRtt();

            if (node.has("timestamp")) {
                networkRtt.setTimestamp(parseDateTime(node.get("timestamp").asText()));
            } else {
                networkRtt.setTimestamp(LocalDateTime.now());
            }

            if (node.has("sourceAddress")) {
                networkRtt.setSourceAddress(node.get("sourceAddress").asText());
            } else if (node.has("source")) {
                networkRtt.setSourceAddress(node.get("source").asText());
            }

            if (node.has("sourcePort")) {
                networkRtt.setSourcePort(node.get("sourcePort").asInt());
            }

            if (node.has("destinationAddress")) {
                networkRtt.setDestinationAddress(node.get("destinationAddress").asText());
            } else if (node.has("destination")) {
                networkRtt.setDestinationAddress(node.get("destination").asText());
            } else if (node.has("host")) {
                networkRtt.setDestinationAddress(node.get("host").asText());
            }

            if (node.has("destinationPort")) {
                networkRtt.setDestinationPort(node.get("destinationPort").asInt());
            }

            if (node.has("protocol")) {
                networkRtt.setProtocol(node.get("protocol").asText().toUpperCase());
            }

            if (node.has("rtt")) {
                networkRtt.setRttMs(node.get("rtt").asDouble());
            } else if (node.has("rttMs")) {
                networkRtt.setRttMs(node.get("rttMs").asDouble());
            } else if (node.has("latency")) {
                networkRtt.setRttMs(node.get("latency").asDouble());
            } else if (node.has("time")) {
                networkRtt.setRttMs(node.get("time").asDouble());
            }

            if (node.has("rttMin")) {
                networkRtt.setRttMinMs(node.get("rttMin").asDouble());
            } else if (node.has("min")) {
                networkRtt.setRttMinMs(node.get("min").asDouble());
            }

            if (node.has("rttMax")) {
                networkRtt.setRttMaxMs(node.get("rttMax").asDouble());
            } else if (node.has("max")) {
                networkRtt.setRttMaxMs(node.get("max").asDouble());
            }

            if (node.has("rttAvg")) {
                networkRtt.setRttAvgMs(node.get("rttAvg").asDouble());
            } else if (node.has("avg")) {
                networkRtt.setRttAvgMs(node.get("avg").asDouble());
            } else if (node.has("average")) {
                networkRtt.setRttAvgMs(node.get("average").asDouble());
            }

            if (node.has("rttStddev")) {
                networkRtt.setRttStddevMs(node.get("rttStddev").asDouble());
            } else if (node.has("stddev")) {
                networkRtt.setRttStddevMs(node.get("stddev").asDouble());
            } else if (node.has("mdev")) {
                networkRtt.setRttStddevMs(node.get("mdev").asDouble());
            }

            if (node.has("packetLoss")) {
                networkRtt.setPacketLossPercent(node.get("packetLoss").asDouble());
            } else if (node.has("packetLossPercent")) {
                networkRtt.setPacketLossPercent(node.get("packetLossPercent").asDouble());
            } else if (node.has("loss")) {
                networkRtt.setPacketLossPercent(node.get("loss").asDouble());
            }

            if (node.has("retransmissionCount")) {
                networkRtt.setRetransmissionCount(node.get("retransmissionCount").asInt());
            } else if (node.has("retransmissions")) {
                networkRtt.setRetransmissionCount(node.get("retransmissions").asInt());
            }

            if (node.has("connectionEstablished")) {
                networkRtt.setConnectionEstablishedMs(node.get("connectionEstablished").asDouble());
            }

            if (node.has("sslHandshake")) {
                networkRtt.setSslHandshakeMs(node.get("sslHandshake").asDouble());
            }

            if (node.has("dnsResolution")) {
                networkRtt.setDnsResolutionMs(node.get("dnsResolution").asDouble());
            }

            setSeverity(networkRtt);

            networkRtt.setEvidenceSnippet(node.toString().substring(0, Math.min(node.toString().length(), 500)));

            return networkRtt;
        } catch (Exception e) {
            log.warn("解析 JSON 网络 RTT 时出错: {}", e.getMessage());
            return null;
        }
    }

    private void parseLogFile(File file, Incident incident, List<NetworkRtt> networkRtts) throws IOException {
        try (BufferedReader reader = new BufferedReader(new FileReader(file))) {
            String line;
            int lineNumber = 0;

            while ((line = reader.readLine()) != null) {
                lineNumber++;

                try {
                    NetworkRtt networkRtt = parseLogLine(line, lineNumber);
                    if (networkRtt != null) {
                        networkRtt.setIncident(incident);
                        networkRtts.add(networkRtt);
                    }
                } catch (Exception e) {
                    log.warn("解析网络 RTT 日志第 {} 行时出错: {}", lineNumber, e.getMessage());
                }
            }
        }
    }

    private NetworkRtt parseLogLine(String line, int lineNumber) {
        if (line.trim().isEmpty() || line.startsWith("#") || line.startsWith("PING") && !line.contains("time")) {
            return null;
        }

        NetworkRtt networkRtt = new NetworkRtt();
        networkRtt.setEvidenceSnippet("Line " + lineNumber + ": " + line.substring(0, Math.min(line.length(), 200)));
        networkRtt.setTimestamp(LocalDateTime.now());

        Matcher networkMatcher = NETWORK_LOG_PATTERN.matcher(line);
        if (networkMatcher.find()) {
            String timeStr = networkMatcher.group(1);
            String rttStr = networkMatcher.group(2);
            String minStr = networkMatcher.group(3);
            String maxStr = networkMatcher.group(4);
            String avgStr = networkMatcher.group(5);
            String stddevStr = networkMatcher.group(6);
            String lossStr = networkMatcher.group(7);
            String retransStr = networkMatcher.group(8);

            try {
                networkRtt.setTimestamp(parseDateTime(timeStr));
            } catch (Exception e) {
                // ignore
            }

            try {
                networkRtt.setRttMs(Double.parseDouble(rttStr));
            } catch (NumberFormatException e) {
                // ignore
            }

            try {
                networkRtt.setRttMinMs(Double.parseDouble(minStr));
            } catch (NumberFormatException e) {
                // ignore
            }

            try {
                networkRtt.setRttMaxMs(Double.parseDouble(maxStr));
            } catch (NumberFormatException e) {
                // ignore
            }

            try {
                networkRtt.setRttAvgMs(Double.parseDouble(avgStr));
            } catch (NumberFormatException e) {
                // ignore
            }

            try {
                networkRtt.setRttStddevMs(Double.parseDouble(stddevStr));
            } catch (NumberFormatException e) {
                // ignore
            }

            try {
                networkRtt.setPacketLossPercent(Double.parseDouble(lossStr));
            } catch (NumberFormatException e) {
                // ignore
            }

            try {
                networkRtt.setRetransmissionCount(Integer.parseInt(retransStr));
            } catch (NumberFormatException e) {
                // ignore
            }

            setSeverity(networkRtt);
            return networkRtt;
        }

        Matcher pingMatcher = PING_PATTERN.matcher(line);
        if (pingMatcher.find()) {
            String timeStr = pingMatcher.group(1);
            String host = pingMatcher.group(2);
            String rttStr = pingMatcher.group(3);

            networkRtt.setDestinationAddress(host);

            if (timeStr != null) {
                try {
                    networkRtt.setTimestamp(parseDateTime(timeStr));
                } catch (Exception e) {
                    // ignore
                }
            }

            try {
                networkRtt.setRttMs(Double.parseDouble(rttStr));
            } catch (NumberFormatException e) {
                // ignore
            }

            setSeverity(networkRtt);
            return networkRtt;
        }

        return null;
    }

    private void setSeverity(NetworkRtt networkRtt) {
        Double rtt = networkRtt.getRttMs();
        if (rtt == null) {
            rtt = networkRtt.getRttAvgMs();
        }
        if (rtt == null) {
            networkRtt.setSeverity(BottleneckSeverity.MEDIUM);
            return;
        }

        if (rtt > 1000) {
            networkRtt.setSeverity(BottleneckSeverity.CRITICAL);
        } else if (rtt > 500) {
            networkRtt.setSeverity(BottleneckSeverity.HIGH);
        } else if (rtt > 200) {
            networkRtt.setSeverity(BottleneckSeverity.MEDIUM);
        } else if (rtt > 100) {
            networkRtt.setSeverity(BottleneckSeverity.LOW);
        } else {
            networkRtt.setSeverity(BottleneckSeverity.INFO);
        }

        Double packetLoss = networkRtt.getPacketLossPercent();
        if (packetLoss != null && packetLoss > 0) {
            if (packetLoss > 10) {
                networkRtt.setSeverity(BottleneckSeverity.CRITICAL);
            } else if (packetLoss > 5) {
                networkRtt.setSeverity(BottleneckSeverity.HIGH);
            } else if (packetLoss > 1) {
                networkRtt.setSeverity(BottleneckSeverity.MEDIUM);
            }
        }
    }

    private LocalDateTime parseDateTime(String timeStr) {
        for (DateTimeFormatter formatter : DATE_FORMATTERS) {
            try {
                return LocalDateTime.parse(timeStr, formatter);
            } catch (DateTimeParseException e) {
                // 继续尝试下一个格式
            }
        }
        log.warn("无法解析时间格式: {}, 使用当前时间", timeStr);
        return LocalDateTime.now();
    }
}
