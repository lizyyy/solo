# 安装指南

## 环境要求

本项目需要以下环境：
- Python 3.8 或更高版本
- pip 包管理器
- 推荐使用虚拟环境进行安装

## 安装步骤

### 1. 克隆仓库

首先，将代码仓库克隆到本地：

```bash
git clone https://github.com/example/rag-project.git
cd rag-project
```

### 2. 创建虚拟环境

建议使用虚拟环境来隔离项目依赖：

```bash
python3 -m venv venv
source venv/bin/activate  # Linux/macOS
# 或
.\venv\Scripts\activate   # Windows
```

### 3. 安装依赖

使用 pip 安装项目所需的依赖包：

```bash
pip install -r requirements.txt
```

主要依赖包括：
- PyYAML: 用于解析 YAML 配置文件
- scikit-learn: 提供 TF-IDF 向量化能力
- jieba: 中文分词工具
- numpy: 数值计算支持

### 4. 验证安装

安装完成后，可以运行以下命令验证安装是否成功：

```bash
python -c "import yaml, sklearn, jieba, numpy; print('All dependencies installed successfully!')"
```

如果输出 "All dependencies installed successfully!"，则说明安装成功。

## 常见问题

### Q1: pip 安装速度慢怎么办？

A: 可以使用国内镜像源加速安装：

```bash
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
```

### Q2: 缺少系统依赖？

A: 在某些 Linux 系统上，可能需要先安装系统级依赖：

```bash
sudo apt-get install python3-dev python3-pip
```

## 下一步

安装完成后，你可以：
1. 查看 `docs/` 目录下的文档了解项目结构
2. 运行示例程序测试功能
3. 阅读配置指南了解如何自定义参数
