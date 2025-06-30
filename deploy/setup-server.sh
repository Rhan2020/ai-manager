#!/bin/bash

# 服务器初始化脚本
# 用于在新服务器上配置基础环境

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_blue() {
    echo -e "${BLUE}[SETUP]${NC} $1"
}

# 检查是否为root用户
check_root() {
    if [ "$EUID" -eq 0 ]; then
        log_warn "正在以root用户运行，建议创建普通用户"
    fi
}

# 更新系统
update_system() {
    log_info "更新系统包..."
    
    if [ -f /etc/debian_version ]; then
        # Ubuntu/Debian
        sudo apt-get update
        sudo apt-get upgrade -y
        sudo apt-get install -y curl wget git vim htop tree unzip
    elif [ -f /etc/redhat-release ]; then
        # CentOS/RHEL
        sudo yum update -y
        sudo yum install -y curl wget git vim htop tree unzip epel-release
    else
        log_error "不支持的操作系统"
        exit 1
    fi
    
    log_info "系统更新完成"
}

# 配置时区
setup_timezone() {
    log_info "配置时区为亚洲/上海..."
    sudo timedatectl set-timezone Asia/Shanghai
    log_info "当前时间: $(date)"
}

# 配置swap
setup_swap() {
    log_info "配置swap空间..."
    
    # 检查是否已有swap
    if [ $(swapon --show | wc -l) -gt 0 ]; then
        log_warn "Swap已存在，跳过配置"
        return
    fi
    
    # 创建2GB swap文件
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    
    # 添加到fstab
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    
    # 优化swap设置
    echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
    echo 'vm.vfs_cache_pressure=50' | sudo tee -a /etc/sysctl.conf
    
    log_info "Swap配置完成"
}

# 配置防火墙
setup_firewall() {
    log_info "配置防火墙..."
    
    if command -v ufw >/dev/null 2>&1; then
        # Ubuntu/Debian
        sudo ufw --force reset
        sudo ufw default deny incoming
        sudo ufw default allow outgoing
        sudo ufw allow ssh
        sudo ufw allow 80/tcp
        sudo ufw allow 443/tcp
        sudo ufw --force enable
        log_info "UFW防火墙配置完成"
    elif command -v firewalld >/dev/null 2>&1; then
        # CentOS/RHEL with firewalld
        sudo systemctl enable firewalld
        sudo systemctl start firewalld
        sudo firewall-cmd --permanent --add-service=ssh
        sudo firewall-cmd --permanent --add-service=http
        sudo firewall-cmd --permanent --add-service=https
        sudo firewall-cmd --reload
        log_info "Firewalld防火墙配置完成"
    fi
}

# 创建部署用户
create_deploy_user() {
    local username="deploy"
    
    log_info "创建部署用户: $username"
    
    if id "$username" &>/dev/null; then
        log_warn "用户 $username 已存在，跳过创建"
        return
    fi
    
    # 创建用户
    sudo useradd -m -s /bin/bash $username
    
    # 添加到sudo组
    sudo usermod -aG sudo $username
    
    # 配置SSH
    sudo mkdir -p /home/$username/.ssh
    sudo chmod 700 /home/$username/.ssh
    
    # 复制当前用户的authorized_keys (如果存在)
    if [ -f ~/.ssh/authorized_keys ]; then
        sudo cp ~/.ssh/authorized_keys /home/$username/.ssh/
        sudo chmod 600 /home/$username/.ssh/authorized_keys
        sudo chown -R $username:$username /home/$username/.ssh
    fi
    
    log_info "部署用户创建完成"
    log_warn "请设置用户密码: sudo passwd $username"
}

# 优化SSH配置
optimize_ssh() {
    log_info "优化SSH配置..."
    
    # 备份原配置
    sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup
    
    # 应用安全配置
    sudo tee -a /etc/ssh/sshd_config.d/security.conf > /dev/null << 'EOF'
# AI Manager SSH Security Configuration

# 禁用root直接登录 (可选)
# PermitRootLogin no

# 禁用密码认证 (启用密钥认证后)
# PasswordAuthentication no

# 其他安全设置
PermitEmptyPasswords no
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
MaxSessions 10

# 限制用户和组
AllowUsers ubuntu deploy
# AllowGroups ssh-users

# 协议版本
Protocol 2
EOF
    
    # 重启SSH服务
    sudo systemctl restart sshd
    
    log_info "SSH配置优化完成"
}

# 安装必要的软件
install_essential_software() {
    log_info "安装必要软件..."
    
    if [ -f /etc/debian_version ]; then
        sudo apt-get install -y \
            htop \
            iotop \
            netstat-ng \
            tcpdump \
            nmap \
            fail2ban \
            logrotate \
            cron \
            rsync \
            jq \
            certbot
    elif [ -f /etc/redhat-release ]; then
        sudo yum install -y \
            htop \
            iotop \
            net-tools \
            tcpdump \
            nmap \
            fail2ban \
            logrotate \
            cronie \
            rsync \
            jq \
            certbot
    fi
    
    log_info "必要软件安装完成"
}

# 配置fail2ban
setup_fail2ban() {
    log_info "配置fail2ban..."
    
    sudo tee /etc/fail2ban/jail.local > /dev/null << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3
ignoreip = 127.0.0.1/8 ::1

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 10
EOF
    
    sudo systemctl enable fail2ban
    sudo systemctl start fail2ban
    
    log_info "Fail2ban配置完成"
}

# 配置系统限制
setup_system_limits() {
    log_info "配置系统限制..."
    
    sudo tee -a /etc/security/limits.conf > /dev/null << 'EOF'
# AI Manager system limits
* soft nofile 65536
* hard nofile 65536
* soft nproc 32768
* hard nproc 32768
root soft nofile 65536
root hard nofile 65536
EOF
    
    sudo tee -a /etc/sysctl.conf > /dev/null << 'EOF'
# AI Manager system optimization
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_keepalive_time = 1200
net.ipv4.tcp_max_tw_buckets = 5000
vm.overcommit_memory = 1
fs.file-max = 2097152
EOF
    
    sudo sysctl -p
    
    log_info "系统限制配置完成"
}

# 创建目录结构
create_directories() {
    log_info "创建应用目录结构..."
    
    sudo mkdir -p /opt/ai-manager
    sudo mkdir -p /opt/ai-manager-backups
    sudo mkdir -p /var/log/ai-manager
    sudo mkdir -p /data/ai-manager
    
    # 设置权限
    sudo chown -R $USER:$USER /opt/ai-manager
    sudo chown -R $USER:$USER /opt/ai-manager-backups
    sudo chown -R $USER:$USER /var/log/ai-manager
    sudo chown -R $USER:$USER /data/ai-manager
    
    log_info "目录结构创建完成"
}

# 安装监控工具
install_monitoring() {
    log_info "安装监控工具..."
    
    # 安装Node Exporter (Prometheus监控)
    if ! command -v node_exporter >/dev/null 2>&1; then
        wget https://github.com/prometheus/node_exporter/releases/download/v1.6.1/node_exporter-1.6.1.linux-amd64.tar.gz
        tar xvfz node_exporter-*.tar.gz
        sudo mv node_exporter-*/node_exporter /usr/local/bin/
        rm -rf node_exporter-*
        
        # 创建systemd服务
        sudo tee /etc/systemd/system/node_exporter.service > /dev/null << 'EOF'
[Unit]
Description=Node Exporter
Wants=network-online.target
After=network-online.target

[Service]
User=nobody
Group=nobody
Type=simple
ExecStart=/usr/local/bin/node_exporter

[Install]
WantedBy=multi-user.target
EOF
        
        sudo systemctl daemon-reload
        sudo systemctl enable node_exporter
        sudo systemctl start node_exporter
    fi
    
    log_info "监控工具安装完成"
}

# 显示完成信息
show_completion_info() {
    log_blue "===========================================" 
    log_blue "        服务器初始化完成！"
    log_blue "==========================================="
    echo ""
    log_info "系统信息:"
    echo "  操作系统: $(lsb_release -d 2>/dev/null | cut -f2 || cat /etc/redhat-release 2>/dev/null || echo 'Unknown')"
    echo "  内核版本: $(uname -r)"
    echo "  系统时间: $(date)"
    echo "  磁盘空间: $(df -h / | awk 'NR==2 {print $4 " available of " $2}')"
    echo "  内存信息: $(free -h | awk 'NR==2 {print $7 " available of " $2}')"
    echo ""
    log_info "下一步操作:"
    echo "  1. 安装Docker: curl -fsSL https://get.docker.com | sh"
    echo "  2. 部署应用: git clone <repo> /opt/ai-manager && cd /opt/ai-manager && ./deploy/deploy.sh"
    echo "  3. 配置域名和SSL证书"
    echo ""
    log_warn "重要提醒:"
    echo "  - 请备份SSH密钥"
    echo "  - 确保防火墙配置正确"
    echo "  - 定期更新系统和软件"
    echo ""
}

# 主函数
main() {
    log_blue "开始初始化服务器环境..."
    
    check_root
    update_system
    setup_timezone
    setup_swap
    install_essential_software
    setup_firewall
    create_deploy_user
    optimize_ssh
    setup_fail2ban
    setup_system_limits
    create_directories
    install_monitoring
    
    show_completion_info
}

# 执行主函数
main "$@"