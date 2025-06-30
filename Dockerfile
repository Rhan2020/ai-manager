# 多阶段构建 - 前端构建阶段
FROM node:18-alpine AS frontend-builder

WORKDIR /app

# 复制前端相关文件
COPY package*.json ./
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY tailwind.config.js ./
COPY postcss.config.js ./
COPY eslint.config.js ./
COPY index.html ./

# 安装依赖
RUN npm ci --only=production

# 复制源代码
COPY src/ ./src/
COPY public/ ./public/ 2>/dev/null || true

# 构建前端
RUN npm run build:web

# 生产运行阶段
FROM node:18-alpine AS production

WORKDIR /app

# 创建非root用户
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# 安装必要的系统依赖
RUN apk add --no-cache \
    dumb-init \
    && rm -rf /var/cache/apk/*

# 复制package文件
COPY package*.json ./

# 安装生产依赖
RUN npm ci --only=production && npm cache clean --force

# 复制后端代码
COPY server/ ./server/
COPY desktop/ ./desktop/

# 从构建阶段复制前端构建产物
COPY --from=frontend-builder /app/dist ./dist

# 创建数据目录
RUN mkdir -p /app/data && \
    chown -R appuser:appgroup /app

# 切换到非root用户
USER appuser

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "http.get('http://localhost:3000/api/stats', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# 使用dumb-init处理信号
ENTRYPOINT ["dumb-init", "--"]

# 启动命令
CMD ["npm", "start"]