#include "benchmark.h"
#include "utils.h"
#include <memory>
#include <cstring>

namespace cache_lab {

BenchmarkResult BenchmarkEngine::RunBenchmark(const std::string& test_name, const BenchmarkConfig& config) {
    if (test_name == "sequential_access") {
        SequentialAccessBenchmark bm(config);
        return bm.Run();
    } else if (test_name == "stride_access") {
        StrideAccessBenchmark bm(config);
        return bm.Run();
    } else if (test_name == "random_access") {
        RandomAccessBenchmark bm(config);
        return bm.Run();
    } else if (test_name == "false_sharing") {
        FalseSharingBenchmark bm(config);
        return bm.Run();
#ifdef HAS_NUMA
    } else if (test_name == "numa_test") {
        NUMATestBenchmark bm(config);
        return bm.Run();
#endif
    }
    throw std::runtime_error("Unknown benchmark: " + test_name);
}

std::vector<std::string> BenchmarkEngine::GetAvailableTests() const {
    std::vector<std::string> tests = {
        "sequential_access",
        "stride_access", 
        "random_access",
        "false_sharing"
    };
#ifdef HAS_NUMA
    tests.push_back("numa_test");
#endif
    return tests;
}

BenchmarkEngine& BenchmarkEngine::Instance() {
    static BenchmarkEngine instance;
    return instance;
}

}
