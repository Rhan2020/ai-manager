#!/bin/bash

# AI任务管理器监控脚本
# 监控应用状态、资源使用情况和日志

set -e

PROJECT_NAME="ai-manager"
DEPLOY_DIR="/opt/${PROJECT_NAME}"
LOG_DIR="${DEPLOY_DIR}/logs"

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
    echo -e "${BLUE}[DEBUG]${NC} $1"
}

# 检查服务状态
check_service_status() {
    log_info "检查服务状态..."
    cd ${DEPLOY_DIR}
    
    echo "═══════════════════════════════════════"
    echo "           服务状态概览"
    echo "═══════════════════════════════════════"
    
    if docker-compose ps | grep -q "Up"; then
        log_info "✅ 服务正在运行"
        docker-compose ps
    else
        log_error "❌ 服务未运行或存在问题"
        docker-compose ps
        return 1
    fi
}

# 检查健康状态
check_health() {
    log_info "检查应用健康状态..."
    
    local health_endpoint="http://localhost:3000/api/stats"
    local max_retries=3
    local retry_count=0
    
    while [ $retry_count -lt $max_retries ]; do
        if curl -f -s "$health_endpoint" > /dev/null; then
            log_info "✅ 应用健康检查通过"
            
            # 获取详细状态信息
            local response=$(curl -s "$health_endpoint")
            echo "应用统计信息:"
            echo "$response" | jq '.' 2>/dev/null || echo "$response"
            return 0
        else
            retry_count=$((retry_count + 1))
            log_warn "健康检查失败，重试 $retry_count/$max_retries..."
            sleep 5
        fi
    done
    
    log_error "❌ 应用健康检查失败"
    return 1
}

# 检查资源使用情况
check_resources() {
    log_info "检查系统资源使用情况..."
    
    echo "═══════════════════════════════════════"
    echo "           系统资源使用"
    echo "═══════════════════════════════════════"
    
    # CPU和内存使用情况
    echo "CPU和内存使用情况:"
    free -h
    echo ""
    
    # 磁盘使用情况
    echo "磁盘使用情况:"
    df -h | grep -E "/$|/opt"
    echo ""
    
    # Docker容器资源使用
    echo "Docker容器资源使用:"
    cd ${DEPLOY_DIR}
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
}

# 检查日志
check_logs() {
    log_info "检查应用日志..."
    
    cd ${DEPLOY_DIR}
    
    echo "═══════════════════════════════════════"
    echo "           最近日志 (最后50行)"
    echo "═══════════════════════════════════════"
    
    # 应用日志
    if docker-compose ps | grep -q "ai-manager.*Up"; then
        echo "AI Manager 日志:"
        docker-compose logs --tail=20 ai-manager
        echo ""
    fi
    
    # Nginx日志
    if docker-compose ps | grep -q "nginx.*Up"; then
        echo "Nginx 错误日志:"
        docker-compose logs --tail=10 nginx
        echo ""
    fi
    
    # Redis日志
    if docker-compose ps | grep -q "redis.*Up"; then
        echo "Redis 日志:"
        docker-compose logs --tail=10 redis
        echo ""
    fi
}

# 检查网络连接
check_network() {
    log_info "检查网络连接..."
    
    echo "═══════════════════════════════════════"
    echo "           网络连接状态"
    echo "═══════════════════════════════════════"
    
    # 检查端口监听状态
    echo "端口监听状态:"
    netstat -tlnp | grep -E ":80|:443|:3000|:6379" || echo "未发现相关端口监听"
    echo ""
    
    # 检查Docker网络
    echo "Docker网络:"
    docker network ls | grep ai-manager || echo "未发现ai-manager网络"
}

# 性能测试
performance_test() {
    log_info "执行简单性能测试..."
    
    local api_endpoint="http://localhost:3000/api/stats"
    local test_count=10
    
    echo "═══════════════════════════════════════"
    echo "      API响应时间测试 ($test_count 次)"
    echo "═══════════════════════════════════════"
    
    local total_time=0
    local success_count=0
    
    for i in $(seq 1 $test_count); do
        local start_time=$(date +%s%3N)
        if curl -f -s "$api_endpoint" > /dev/null; then
            local end_time=$(date +%s%3N)
            local response_time=$((end_time - start_time))
            echo "请求 $i: ${response_time}ms"
            total_time=$((total_time + response_time))
            success_count=$((success_count + 1))
        else
            echo "请求 $i: 失败"
        fi
        sleep 1
    done
    
    if [ $success_count -gt 0 ]; then
        local avg_time=$((total_time / success_count))
        echo ""
        echo "成功率: $success_count/$test_count"
        echo "平均响应时间: ${avg_time}ms"
        
        if [ $avg_time -lt 1000 ]; then
            log_info "✅ 响应时间良好"
        elif [ $avg_time -lt 3000 ]; then
            log_warn "⚠️ 响应时间偏慢"
        else
            log_error "❌ 响应时间过慢"
        fi
    else
        log_error "❌ 所有请求都失败了"
    fi
}

# 清理旧日志
cleanup_logs() {
    log_info "清理旧日志文件..."
    
    # 清理超过7天的日志文件
    find ${LOG_DIR} -name "*.log" -mtime +7 -delete 2>/dev/null || true
    
    # 清理Docker日志
    docker system prune -f --filter "until=168h" > /dev/null 2>&1 || true
    
    log_info "日志清理完成"
}

# 生成报告
generate_report() {
    local report_file="${LOG_DIR}/monitor-report-$(date +%Y%m%d_%H%M%S).txt"
    
    log_info "生成监控报告: $report_file"
    
    {
        echo "AI任务管理器监控报告"
        echo "生成时间: $(date)"
        echo "═══════════════════════════════════════"
        echo ""
        
        echo "1. 服务状态"
        echo "───────────────────────────────────────"
        check_service_status 2>&1
        echo ""
        
        echo "2. 健康检查"
        echo "───────────────────────────────────────"
        check_health 2>&1
        echo ""
        
        echo "3. 资源使用"
        echo "───────────────────────────────────────"
        check_resources 2>&1
        echo ""
        
        echo "4. 网络状态"
        echo "───────────────────────────────────────"
        check_network 2>&1
        echo ""
        
        echo "报告生成完成"
    } > "$report_file"
    
    log_info "报告已保存到: $report_file"
}

# 显示帮助信息
show_help() {
    echo "AI任务管理器监控脚本"
    echo ""
    echo "使用方法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  status      检查服务状态"
    echo "  health      检查健康状态"
    echo "  resources   检查资源使用"
    echo "  logs        查看日志"
    echo "  network     检查网络状态"
    echo "  test        执行性能测试"
    echo "  cleanup     清理旧日志"
    echo "  report      生成完整报告"
    echo "  all         执行所有检查"
    echo "  help        显示此帮助信息"
    echo ""
}

# 主函数
main() {
    local action=${1:-"all"}
    
    # 确保在正确的目录
    if [ ! -f "${DEPLOY_DIR}/docker-compose.yml" ]; then
        log_error "未找到部署目录: ${DEPLOY_DIR}"
        log_error "请确保应用已正确部署"
        exit 1
    fi
    
    # 创建日志目录
    mkdir -p ${LOG_DIR}
    
    case "$action" in
        "status")
            check_service_status
            ;;
        "health")
            check_health
            ;;
        "resources")
            check_resources
            ;;
        "logs")
            check_logs
            ;;
        "network")
            check_network
            ;;
        "test")
            performance_test
            ;;
        "cleanup")
            cleanup_logs
            ;;
        "report")
            generate_report
            ;;
        "all")
            echo "执行完整监控检查..."
            check_service_status
            echo ""
            check_health
            echo ""
            check_resources
            echo ""
            check_network
            echo ""
            performance_test
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            log_error "未知选项: $action"
            show_help
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"