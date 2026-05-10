package com.example.config.performance;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

public class ConfigLoadTester {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    public static void main(String[] args) throws Exception {
        String baseUrl = args.length > 0 ? args[0] : "http://localhost:8080";
        int configCount = args.length > 1 ? Integer.parseInt(args[1]) : 100;
        int concurrentUsers = args.length > 2 ? Integer.parseInt(args[2]) : 50;
        int iterationsPerUser = args.length > 3 ? Integer.parseInt(args[3]) : 10;

        System.out.println("=== 配置热更新系统压测 ===");
        System.out.println("目标地址: " + baseUrl);
        System.out.println("配置数量: " + configCount);
        System.out.println("并发用户: " + concurrentUsers);
        System.out.println("每用户迭代: " + iterationsPerUser);
        System.out.println();

        System.out.println("步骤1: 初始化测试配置...");
        List<String> configKeys = createTestConfigs(baseUrl, configCount);
        System.out.println("已创建 " + configKeys.size() + " 个测试配置");
        System.out.println();

        System.out.println("步骤2: 执行并发读取测试...");
        LoadTestResult readResult = runConcurrentReadTest(baseUrl, configKeys, concurrentUsers, iterationsPerUser);
        printResult("读取测试", readResult);
        System.out.println();

        System.out.println("步骤3: 执行并发写入测试...");
        LoadTestResult writeResult = runConcurrentWriteTest(baseUrl, configKeys, concurrentUsers, iterationsPerUser);
        printResult("写入测试", writeResult);
        System.out.println();

        System.out.println("步骤4: 执行混合读写测试...");
        LoadTestResult mixedResult = runMixedLoadTest(baseUrl, configKeys, concurrentUsers, iterationsPerUser);
        printResult("混合读写测试", mixedResult);
        System.out.println();

        System.out.println("=== 压测完成 ===");
    }

    private static List<String> createTestConfigs(String baseUrl, int count) throws Exception {
        final List<String> keys = Collections.synchronizedList(new ArrayList<String>());
        ExecutorService executor = Executors.newFixedThreadPool(20);
        final CountDownLatch latch = new CountDownLatch(count);
        final AtomicInteger successCount = new AtomicInteger(0);

        for (int i = 0; i < count; i++) {
            final int idx = i;
            executor.submit(new Runnable() {
                public void run() {
                    try {
                        String namespace = "stress-test";
                        String key = "test.config." + idx;
                        Map<String, Object> body = new HashMap<String, Object>();
                        body.put("namespace", namespace);
                        body.put("key", key);
                        body.put("value", "initial-value-" + idx);
                        body.put("description", "压测配置 " + idx);
                        body.put("operator", "load-tester");

                        int statusCode = sendHttpRequest("POST", baseUrl + "/api/config", body);
                        if (statusCode >= 200 && statusCode < 300) {
                            keys.add(namespace + ":" + key);
                            successCount.incrementAndGet();
                        }
                    } catch (Exception ignored) {
                    } finally {
                        latch.countDown();
                    }
                }
            });
        }

        latch.await(60, TimeUnit.SECONDS);
        executor.shutdown();
        return keys;
    }

    private static LoadTestResult runConcurrentReadTest(String baseUrl, List<String> configKeys,
                                                         int concurrentUsers, int iterations) throws Exception {
        final List<String> safeKeys = new ArrayList<String>(configKeys);
        return runTest(concurrentUsers, iterations, new RequestExecutor() {
            public RequestResult execute(int userIdx, int iterIdx, Random random) throws Exception {
                String configKey = safeKeys.get(random.nextInt(safeKeys.size()));
                String[] parts = configKey.split(":");
                String namespace = parts[0];
                String key = parts[1];

                long start = System.nanoTime();
                int statusCode = sendHttpRequest("GET", baseUrl + "/api/config/" + namespace + "/" + key, null);
                long end = System.nanoTime();

                return new RequestResult(statusCode >= 200 && statusCode < 300, (end - start) / 1000000L);
            }
        });
    }

    private static LoadTestResult runConcurrentWriteTest(String baseUrl, List<String> configKeys,
                                                          int concurrentUsers, int iterations) throws Exception {
        final List<String> safeKeys = new ArrayList<String>(configKeys);
        final AtomicInteger versionCounter = new AtomicInteger(0);
        return runTest(concurrentUsers, iterations, new RequestExecutor() {
            public RequestResult execute(int userIdx, int iterIdx, Random random) throws Exception {
                String configKey = safeKeys.get(random.nextInt(safeKeys.size()));
                String[] parts = configKey.split(":");
                String namespace = parts[0];
                String key = parts[1];

                Map<String, Object> body = new HashMap<String, Object>();
                body.put("value", "updated-value-" + versionCounter.incrementAndGet());
                body.put("operator", "load-tester-user-" + userIdx);

                long start = System.nanoTime();
                int statusCode = sendHttpRequest("PUT", baseUrl + "/api/config/" + namespace + "/" + key, body);
                long end = System.nanoTime();

                return new RequestResult(statusCode >= 200 && statusCode < 300, (end - start) / 1000000L);
            }
        });
    }

    private static LoadTestResult runMixedLoadTest(String baseUrl, List<String> configKeys,
                                                    int concurrentUsers, int iterations) throws Exception {
        final List<String> safeKeys = new ArrayList<String>(configKeys);
        final AtomicInteger versionCounter = new AtomicInteger(0);
        return runTest(concurrentUsers, iterations, new RequestExecutor() {
            public RequestResult execute(int userIdx, int iterIdx, Random random) throws Exception {
                boolean isWrite = random.nextDouble() < 0.1;
                String configKey = safeKeys.get(random.nextInt(safeKeys.size()));
                String[] parts = configKey.split(":");
                String namespace = parts[0];
                String key = parts[1];

                long start = System.nanoTime();
                boolean success;

                if (isWrite) {
                    Map<String, Object> body = new HashMap<String, Object>();
                    body.put("value", "mixed-value-" + versionCounter.incrementAndGet());
                    body.put("operator", "mixed-tester");

                    int statusCode = sendHttpRequest("PUT", baseUrl + "/api/config/" + namespace + "/" + key, body);
                    success = statusCode >= 200 && statusCode < 300;
                } else {
                    int statusCode = sendHttpRequest("GET", baseUrl + "/api/config/" + namespace + "/" + key, null);
                    success = statusCode >= 200 && statusCode < 300;
                }

                long end = System.nanoTime();
                return new RequestResult(success, (end - start) / 1000000L);
            }
        });
    }

    private static int sendHttpRequest(String method, String urlString, Map<String, Object> body) throws Exception {
        URL url = new URL(urlString);
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod(method);
        connection.setConnectTimeout(10000);
        connection.setReadTimeout(30000);

        if (body != null) {
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setDoOutput(true);
            String json = OBJECT_MAPPER.writeValueAsString(body);
            OutputStream os = connection.getOutputStream();
            os.write(json.getBytes(StandardCharsets.UTF_8));
            os.flush();
            os.close();
        }

        int statusCode = connection.getResponseCode();

        BufferedReader reader = null;
        try {
            if (statusCode >= 200 && statusCode < 300) {
                reader = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8));
            } else {
                reader = new BufferedReader(new InputStreamReader(connection.getErrorStream(), StandardCharsets.UTF_8));
            }
            StringBuilder response = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                response.append(line);
            }
        } catch (Exception e) {
        } finally {
            if (reader != null) {
                reader.close();
            }
            connection.disconnect();
        }

        return statusCode;
    }

    private static LoadTestResult runTest(int concurrentUsers, int iterations,
                                          RequestExecutor executor) throws Exception {
        ExecutorService threadPool = Executors.newFixedThreadPool(concurrentUsers);
        List<Future<List<RequestResult>>> futures = new ArrayList<Future<List<RequestResult>>>();

        for (int i = 0; i < concurrentUsers; i++) {
            final int userIdx = i;
            final RequestExecutor exec = executor;
            futures.add(threadPool.submit(new Callable<List<RequestResult>>() {
                public List<RequestResult> call() {
                    List<RequestResult> results = new ArrayList<RequestResult>();
                    Random random = new Random(userIdx + System.currentTimeMillis());
                    for (int j = 0; j < iterations; j++) {
                        try {
                            results.add(exec.execute(userIdx, j, random));
                        } catch (Exception e) {
                            results.add(new RequestResult(false, 0L));
                        }
                    }
                    return results;
                }
            }));
        }

        List<RequestResult> allResults = new ArrayList<RequestResult>();
        for (Future<List<RequestResult>> future : futures) {
            allResults.addAll(future.get());
        }

        threadPool.shutdown();

        long totalRequests = allResults.size();
        long successCount = 0;
        for (RequestResult r : allResults) {
            if (r.success) successCount++;
        }
        long failCount = totalRequests - successCount;

        List<Long> latencies = new ArrayList<Long>();
        for (RequestResult r : allResults) {
            if (r.success) latencies.add(r.latencyMs);
        }
        Collections.sort(latencies);

        long p50 = latencies.isEmpty() ? 0 : latencies.get((int) (latencies.size() * 0.5));
        long p95 = latencies.isEmpty() ? 0 : latencies.get((int) (latencies.size() * 0.95));
        long p99 = latencies.isEmpty() ? 0 : latencies.get((int) (latencies.size() * 0.99));
        long avg = 0;
        if (!latencies.isEmpty()) {
            long sum = 0;
            for (Long l : latencies) {
                sum += l;
            }
            avg = sum / latencies.size();
        }

        return new LoadTestResult(totalRequests, successCount, failCount, avg, p50, p95, p99);
    }

    private static void printResult(String testName, LoadTestResult result) {
        System.out.println("--- " + testName + " ---");
        System.out.println("  总请求数: " + result.totalRequests);
        System.out.println("  成功: " + result.successCount + " (" +
                String.format("%.1f%%", result.successCount * 100.0 / result.totalRequests) + ")");
        System.out.println("  失败: " + result.failCount);
        System.out.println("  平均延迟: " + result.avgLatency + "ms");
        System.out.println("  P50: " + result.p50Latency + "ms");
        System.out.println("  P95: " + result.p95Latency + "ms");
        System.out.println("  P99: " + result.p99Latency + "ms");
    }

    interface RequestExecutor {
        RequestResult execute(int userIdx, int iterIdx, Random random) throws Exception;
    }

    static class RequestResult {
        final boolean success;
        final long latencyMs;

        RequestResult(boolean success, long latencyMs) {
            this.success = success;
            this.latencyMs = latencyMs;
        }
    }

    static class LoadTestResult {
        final long totalRequests;
        final long successCount;
        final long failCount;
        final long avgLatency;
        final long p50Latency;
        final long p95Latency;
        final long p99Latency;

        LoadTestResult(long totalRequests, long successCount, long failCount,
                       long avgLatency, long p50Latency, long p95Latency, long p99Latency) {
            this.totalRequests = totalRequests;
            this.successCount = successCount;
            this.failCount = failCount;
            this.avgLatency = avgLatency;
            this.p50Latency = p50Latency;
            this.p95Latency = p95Latency;
            this.p99Latency = p99Latency;
        }
    }
}
