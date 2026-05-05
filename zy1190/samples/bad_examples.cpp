/*
 * 坏样例展示 - 这些代码展示了各种缓存性能问题
 * 
 * 这些示例仅供教学使用，展示什么是"坏"的做法
 */

#include <iostream>
#include <vector>
#include <thread>
#include <atomic>
#include <chrono>

// ============================================================
// 坏样例 1: 伪共享
// ============================================================
namespace bad_example_1 {

// 坏布局：多个原子变量共享同一缓存行
struct BadCounter {
    std::atomic<uint64_t> count1;  // 线程 1 用
    std::atomic<uint64_t> count2;  // 线程 2 用
    std::atomic<uint64_t> count3;  // 线程 3 用
    std::atomic<uint64_t> count4;  // 线程 4 用
};

void run() {
    std::cout << "\n=== 坏样例 1: 伪共享 ===\n";
    std::cout << "问题：多个线程修改同一缓存行的不同变量\n";
    std::cout << "后果：缓存一致性协议导致大量无效化和同步开销\n\n";

    BadCounter counter;
    counter.count1 = 0;
    counter.count2 = 0;
    counter.count3 = 0;
    counter.count4 = 0;

    const size_t iterations = 1000000;

    auto start = std::chrono::high_resolution_clock::now();

    std::vector<std::thread> threads;
    threads.emplace_back([&]() {
        for (size_t i = 0; i < iterations; ++i) {
            counter.count1.fetch_add(1);
        }
    });
    threads.emplace_back([&]() {
        for (size_t i = 0; i < iterations; ++i) {
            counter.count2.fetch_add(1);
        }
    });
    threads.emplace_back([&]() {
        for (size_t i = 0; i < iterations; ++i) {
            counter.count3.fetch_add(1);
        }
    });
    threads.emplace_back([&]() {
        for (size_t i = 0; i < iterations; ++i) {
            counter.count4.fetch_add(1);
        }
    });

    for (auto& t : threads) {
        t.join();
    }

    auto end = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration<double, std::milli>(end - start).count();

    std::cout << "执行时间: " << duration << " ms\n";
    std::cout << "每个线程执行 " << iterations << " 次操作\n";
    std::cout << "\n问题分析:\n";
    std::cout << "- 四个 std::atomic 变量在内存中连续存放\n";
    std::cout << "- 它们很可能共享同一个 64 字节缓存行\n";
    std::cout << "- 当线程 1 修改 count1 时，该缓存行被标记为"独占"\n";
    std::cout << "- 其他 CPU 核心上的线程需要等待缓存一致性同步\n";
    std::cout << "- 即使线程之间没有数据依赖，也会有性能损失\n";
}

}  // namespace bad_example_1

// ============================================================
// 好样例 1: 避免伪共享
// ============================================================
namespace good_example_1 {

// 好布局：每个变量独占缓存行
struct GoodCounter {
    alignas(64) std::atomic<uint64_t> count1;  // 独占缓存行
    alignas(64) std::atomic<uint64_t> count2;  // 独占缓存行
    alignas(64) std::atomic<uint64_t> count3;  // 独占缓存行
    alignas(64) std::atomic<uint64_t> count4;  // 独占缓存行
};

void run() {
    std::cout << "\n=== 好样例 1: 避免伪共享 ===\n";
    std::cout << "解决方案：使用 alignas(64) 让每个变量独占缓存行\n\n";

    GoodCounter counter;
    counter.count1 = 0;
    counter.count2 = 0;
    counter.count3 = 0;
    counter.count4 = 0;

    const size_t iterations = 1000000;

    auto start = std::chrono::high_resolution_clock::now();

    std::vector<std::thread> threads;
    threads.emplace_back([&]() {
        for (size_t i = 0; i < iterations; ++i) {
            counter.count1.fetch_add(1);
        }
    });
    threads.emplace_back([&]() {
        for (size_t i = 0; i < iterations; ++i) {
            counter.count2.fetch_add(1);
        }
    });
    threads.emplace_back([&]() {
        for (size_t i = 0; i < iterations; ++i) {
            counter.count3.fetch_add(1);
        }
    });
    threads.emplace_back([&]() {
        for (size_t i = 0; i < iterations; ++i) {
            counter.count4.fetch_add(1);
        }
    });

    for (auto& t : threads) {
        t.join();
    }

    auto end = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration<double, std::milli>(end - start).count();

    std::cout << "执行时间: " << duration << " ms\n";
    std::cout << "每个线程执行 " << iterations << " 次操作\n";
    std::cout << "\n优化分析:\n";
    std::cout << "- 使用 alignas(64) 确保每个变量独占一个缓存行\n";
    std::cout << "- 线程之间没有缓存行竞争\n";
    std::cout << "- 性能应该比坏样例好很多\n";
}

}  // namespace good_example_1

// ============================================================
// 坏样例 2: 大跨步访问
// ============================================================
namespace bad_example_2 {

void run() {
    std::cout << "\n=== 坏样例 2: 大跨步访问 ===\n";
    std::cout << "问题：步长等于或大于缓存行大小\n";
    std::cout << "后果：每次访问都是 Cache Miss\n\n";

    const size_t size = 67108864;  // 64 MB
    const size_t stride = 16;       // 每次跳过 16 个元素 (128 字节)
    const size_t iterations = 10;

    std::vector<uint64_t> data(size / sizeof(uint64_t), 0);

    auto start = std::chrono::high_resolution_clock::now();

    for (size_t iter = 0; iter < iterations; ++iter) {
        // 坏访问模式：大跨步
        for (size_t i = 0; i < data.size(); i += stride) {
            data[i] = i;
        }
    }

    auto end = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration<double, std::milli>(end - start).count();

    std::cout << "数组大小: " << size / (1024 * 1024) << " MB\n";
    std::cout << "访问步长: " << stride << " 个元素\n";
    std::cout << "执行时间: " << duration << " ms\n";
    std::cout << "\n问题分析:\n";
    std::cout << "- 缓存行大小通常是 64 字节 = 8 个 uint64_t\n";
    std::cout << "- 步长 = 16 意味着每次访问都跳过一个完整缓存行\n";
    std::cout << "- CPU 无法利用空间局部性\n";
    std::cout << "- 几乎每次访问都是 Cache Miss\n";
}

}  // namespace bad_example_2

// ============================================================
// 好样例 2: 顺序访问
// ============================================================
namespace good_example_2 {

void run() {
    std::cout << "\n=== 好样例 2: 顺序访问 ===\n";
    std::cout << "解决方案：顺序遍历数组，利用空间局部性\n\n";

    const size_t size = 67108864;  // 64 MB
    const size_t stride = 1;        // 顺序访问
    const size_t iterations = 10;

    std::vector<uint64_t> data(size / sizeof(uint64_t), 0);

    auto start = std::chrono::high_resolution_clock::now();

    for (size_t iter = 0; iter < iterations; ++iter) {
        // 好访问模式：顺序
        for (size_t i = 0; i < data.size(); i += stride) {
            data[i] = i;
        }
    }

    auto end = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration<double, std::milli>(end - start).count();

    std::cout << "数组大小: " << size / (1024 * 1024) << " MB\n";
    std::cout << "访问步长: " << stride << " 个元素\n";
    std::cout << "执行时间: " << duration << " ms\n";
    std::cout << "\n优化分析:\n";
    std::cout << "- 顺序访问利用了空间局部性\n";
    std::cout << "- CPU 预取器会提前加载下一个缓存行\n";
    std::cout << "- 每次加载一个缓存行可以访问 8 个元素\n";
    std::cout << "- 命中率接近 100%\n";
}

}  // namespace good_example_2

// ============================================================
// 坏样例 3: 结构体布局问题
// ============================================================
namespace bad_example_3 {

// 坏布局：热数据和冷数据混合
struct BadVertex {
    float x, y, z;           // 热数据：渲染时需要
    uint32_t id;              // 热数据
    char name[64];            // 冷数据：很少访问
    float uv[8];              // 冷数据
    uint32_t flags;           // 冷数据
    char reserved[128];       // 冷数据
};

void run() {
    std::cout << "\n=== 坏样例 3: 结构体布局问题 ===\n";
    std::cout << "问题：热数据和冷数据混合存放\n";
    std::cout << "后果：加载热数据时也加载了不需要的冷数据，浪费缓存\n\n";

    const size_t count = 100000;
    std::cout << "结构体大小: " << sizeof(BadVertex) << " 字节\n";
    std::cout << "实际需要的热数据: ~20 字节\n";
    std::cout << "浪费的缓存空间: " << sizeof(BadVertex) - 20 << " 字节/元素\n";
    std::cout << "总浪费: " << (sizeof(BadVertex) - 20) * count / 1024 << " KB\n";
    
    std::cout << "\n问题分析:\n";
    std::cout << "- 渲染时只需要 x, y, z 和 id\n";
    std::cout << "- 但每次加载缓存行都会把冷数据也带进来\n";
    std::cout << "- 缓存利用率极低\n";
    std::cout << "- 更多的 Cache Miss\n";
}

}  // namespace bad_example_3

// ============================================================
// 好样例 3: 数据结构优化
// ============================================================
namespace good_example_3 {

// 好布局：结构体内存排列 (SoA)
struct PositionData {
    std::vector<float> x;
    std::vector<float> y;
    std::vector<float> z;
    std::vector<uint32_t> id;
};

// 或者：热数据和冷数据分离
struct HotVertex {
    float x, y, z;
    uint32_t id;
};

struct ColdVertex {
    char name[64];
    float uv[8];
    uint32_t flags;
    char reserved[128];
};

void run() {
    std::cout << "\n=== 好样例 3: 数据结构优化 ===\n";
    std::cout << "解决方案：结构体内存排列 (SoA) 或热数据分离\n\n";

    std::cout << "热数据结构体大小: " << sizeof(HotVertex) << " 字节\n";
    std::cout << "冷数据结构体大小: " << sizeof(ColdVertex) << " 字节\n";
    
    std::cout << "\n优化分析:\n";
    std::cout << "- 方案 1: 结构体内存排列 (SoA)\n";
    std::cout << "  把所有 x 放在一起，所有 y 放在一起，等等\n";
    std::cout << "  顺序访问时缓存预取效率最高\n";
    std::cout << "- 方案 2: 热数据/冷数据分离\n";
    std::cout << "  只把热数据放入缓存\n";
    std::cout << "  冷数据只在需要时访问\n";
}

}  // namespace good_example_3

int main() {
    std::cout << "============================================\n";
    std::cout << "    Cache Lab - 坏样例与好样例展示\n";
    std::cout << "============================================\n";

    // 伪共享对比
    bad_example_1::run();
    good_example_1::run();

    // 跨步访问对比
    bad_example_2::run();
    good_example_2::run();

    // 结构体布局
    bad_example_3::run();
    good_example_3::run();

    std::cout << "\n============================================\n";
    std::cout << "              关键要点总结\n";
    std::cout << "============================================\n";
    std::cout << "1. 伪共享：使用 alignas(64) 隔离频繁修改的共享变量\n";
    std::cout << "2. 访问模式：优先顺序访问，避免随机和大跨步\n";
    std::cout << "3. 数据结构：考虑 SoA 或热/冷数据分离\n";
    std::cout << "4. 缓存行：始终考虑 64 字节边界的影响\n";

    return 0;
}
