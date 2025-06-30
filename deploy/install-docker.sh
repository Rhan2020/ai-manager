#!/bin/bash

# Docker和Docker Compose安装脚本
# 支持 Ubuntu/Debian/CentOS/RHEL

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检测操作系统
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$NAME
        VER=$VERSION_ID
    elif type lsb_release >/dev/null 2>&1; then
        OS=$(lsb_release -si)
        VER=$(lsb_release -sr)
    elif [ -f /etc/redhat-release ]; then
        OS="CentOS"
        VER=$(cat /etc/redhat-release | sed 's/.*release \([0-9]\).*/\1/')
    else
        log_error "无法检测操作系统"
        exit 1
    fi
    
    log_info "检测到操作系统: $OS $VER"
}

# 安装Docker (Ubuntu/Debian)
install_docker_ubuntu() {
    log_info "在Ubuntu/Debian上安装Docker..."
    
    # 更新包索引
    sudo apt-get update
    
    # 安装必要的包
    sudo apt-get install -y \
        apt-transport-https \
        ca-certificates \
        curl \
        gnupg \
        lsb-release
    
    # 添加Docker官方GPG密钥
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # 设置稳定版仓库
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # 更新包索引
    sudo apt-get update
    
    # 安装Docker Engine
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io
}

# 安装Docker (CentOS/RHEL)
install_docker_centos() {
    log_info "在CentOS/RHEL上安装Docker..."
    
    # 安装必要的包
    sudo yum install -y yum-utils
    
    # 设置稳定版仓库
    sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
    
    # 安装Docker Engine
    sudo yum install -y docker-ce docker-ce-cli containerd.io
}

# 安装Docker Compose
install_docker_compose() {
    log_info "安装Docker Compose..."
    
    # 下载最新版本的Docker Compose
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
    sudo curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    
    # 添加执行权限
    sudo chmod +x /usr/local/bin/docker-compose
    
    # 创建符号链接
    sudo ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
    
    log_info "Docker Compose ${COMPOSE_VERSION} 安装完成"
}

# 配置Docker
configure_docker() {
    log_info "配置Docker..."
    
    # 启动Docker服务
    sudo systemctl start docker
    sudo systemctl enable docker
    
    # 将当前用户添加到docker组
    sudo usermod -aG docker $USER
    
    # 配置Docker守护进程
    sudo mkdir -p /etc/docker
    sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
    "log-driver": "json-file",
    "log-opts": {
        "max-size": "10m",
        "max-file": "3"
    },
    "storage-driver": "overlay2",
    "registry-mirrors": [
        "https://docker.mirrors.ustc.edu.cn",
        "https://registry.docker-cn.com"
    ]
}
EOF
    
    # 重启Docker服务
    sudo systemctl restart docker
    
    log_info "Docker配置完成"
}

# 主函数
main() {
    log_info "开始安装Docker和Docker Compose..."
    
    # 检查是否已安装Docker
    if command -v docker &> /dev/null; then
        log_warn "Docker已安装，版本: $(docker --version)"
    else
        detect_os
        
        case "$OS" in
            "Ubuntu"|"Debian"*)
                install_docker_ubuntu
                ;;
            "CentOS"*|"Red Hat"*)
                install_docker_centos
                ;;
            *)
                log_error "不支持的操作系统: $OS"
                exit 1
                ;;
        esac
        
        configure_docker
    fi
    
    # 检查是否已安装Docker Compose
    if command -v docker-compose &> /dev/null; then
        log_warn "Docker Compose已安装，版本: $(docker-compose --version)"
    else
        install_docker_compose
    fi
    
    # 验证安装
    log_info "验证安装..."
    docker --version
    docker-compose --version
    
    log_info "✅ Docker和Docker Compose安装完成！"
    log_warn "请注销并重新登录以使用户组更改生效，或运行: newgrp docker"
}

# 执行主函数
main "$@"