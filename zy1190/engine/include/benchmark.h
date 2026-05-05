#ifndef CACHE_LAB_ENGINE_H
#define CACHE_LAB_ENGINE_H

#include <cstdint>
#include <cstddef>
#include <vector>
#include <thread>
#include <atomic>
#include <chrono>
#include <functional>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

namespace cache_lab {

struct BenchmarkConfig {
    size_t array_size;
    size_t stride;
    size_t thread_count;
    size_t cache_line_size;
    bool use_numa;
    int numa_node;
    int iterations;
    uint64_t seed;
    std::string struct_layout;
};

struct BenchmarkResult {
    std::string test_name;
    double total_time_ms;
    double throughput_mbs;
    double avg_latency_ns;
    size_t cache_hits;
    size_t cache_misses;
    std::vector<double> latency_timeline;
    std::vector<size_t> thread_conflicts;
    json metadata;
};

class BenchmarkBase {
protected:
    BenchmarkConfig config_;
    
public:
    explicit BenchmarkBase(const BenchmarkConfig& config) : config_(config) {}
    virtual ~BenchmarkBase() = default;
    
    virtual BenchmarkResult Run() = 0;
    virtual std::string GetName() const = 0;
    
    void SetConfig(const BenchmarkConfig& config) { config_ = config; }
    const BenchmarkConfig& GetConfig() const { return config_; }
};

class SequentialAccessBenchmark : public BenchmarkBase {
public:
    using BenchmarkBase::BenchmarkBase;
    BenchmarkResult Run() override;
    std::string GetName() const override { return "sequential_access"; }
};

class StrideAccessBenchmark : public BenchmarkBase {
public:
    using BenchmarkBase::BenchmarkBase;
    BenchmarkResult Run() override;
    std::string GetName() const override { return "stride_access"; }
};

class RandomAccessBenchmark : public BenchmarkBase {
public:
    using BenchmarkBase::BenchmarkBase;
    BenchmarkResult Run() override;
    std::string GetName() const override { return "random_access"; }
};

class FalseSharingBenchmark : public BenchmarkBase {
public:
    using BenchmarkBase::BenchmarkBase;
    BenchmarkResult Run() override;
    std::string GetName() const override { return "false_sharing"; }
};

#ifdef HAS_NUMA
class NUMATestBenchmark : public BenchmarkBase {
public:
    using BenchmarkBase::BenchmarkBase;
    BenchmarkResult Run() override;
    std::string GetName() const override { return "numa_test"; }
};
#endif

class BenchmarkEngine {
public:
    static BenchmarkEngine& Instance();
    
    BenchmarkResult RunBenchmark(const std::string& test_name, const BenchmarkConfig& config);
    std::vector<std::string> GetAvailableTests() const;
    
private:
    BenchmarkEngine() = default;
    ~BenchmarkEngine() = default;
    BenchmarkEngine(const BenchmarkEngine&) = delete;
    BenchmarkEngine& operator=(const BenchmarkEngine&) = delete;
};

}

#endif
