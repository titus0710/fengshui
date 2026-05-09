# 阳宅风水评估

基于 AI 的阳宅风水分析工具。上传户型图，结合玄空飞星、地理环境与 AI 推理，自动生成风水评估报告。

## 功能

- **户型图识别** — 上传户型图，AI 自动识别房间布局、门窗位置与整体朝向
- **户型编辑** — 在识别的户型图上添加房间、修改房间名、调整形状
- **玄空飞星排盘** — 根据二十四山朝向自动排盘，生成九宫飞星图
- **地理环境分析** — 输入小区地址，自动获取周边道路、水系、建筑环境数据
- **风水评估** — 综合户型、飞星、环境三维度，AI 生成详细风水解读与调理建议
- **AI 问答** — 针对当前评估结果自由提问
- **PDF 报告** — 一键生成仿古书风格的专业风水评估报告，含户型图、九宫盘与方位罗盘
- **打赏支持** — 右下角浮动打赏入口

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Next.js 16 (App Router) + React 19 |
| 样式 | Tailwind CSS 4 |
| 语言 | TypeScript |
| 户型图识别 | 通义千问 Qwen3-VL |
| 风水推理 | DeepSeek V4 Pro |
| 地图服务 | 高德地图 API |
| PDF 生成 | Puppeteer |
| 部署平台 | 腾讯云轻量服务器 + 宝塔面板 |

## 本地开发

### 环境要求
- Node.js 20+
- npm

### 环境变量

在项目根目录创建 `.env.local`：

```env
DASHSCOPE_API_KEY=你的通义千问API密钥
DEEPSEEK_API_KEY=你的DeepSeek API密钥
AMAP_SERVICE_KEY=你的高德Web服务Key
```

### 启动

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

> 注意：本地开发端口可能为 3100（当 3000 被占用时自动递增）。

## 部署

### 腾讯云轻量服务器 + 宝塔 + PM2

```bash
# 服务器上
cd /www/wwwroot/fengshui
git pull origin main
npm install
npm run build
pm2 restart fengshui
```

### 字体安装（PDF 中文支持）

```bash
yum install -y google-noto-sans-cjk-fonts
```

### Nginx 配置要点

- 反向代理到 `127.0.0.1:3001`
- `/api/analyze` 路径建议单独设置 `proxy_read_timeout 300s`（AI 调用耗时较长）
- 不建议缓存 HTML 页面，避免更新后前端不刷新

## 项目结构

```
src/
├── app/
│   ├── page.tsx                  # 首页：上传户型图 + 选择地址
│   ├── explore/page.tsx          # 结果页：户型图、分析面板、AI 问答、PDF 导出
│   ├── layout.tsx                # 全局布局
│   └── api/
│       ├── recognize/route.ts    # Qwen3-VL 户型图识别
│       ├── analyze/route.ts      # 风水分析主流程（地理→飞星→AI）
│       ├── chat/route.ts         # AI 问答
│       ├── districts/route.ts    # 省市区级联数据
│       └── generate-pdf/route.ts # PDF 报告生成
├── components/
│   ├── AddressSelector.tsx       # 省市区选择器
│   ├── InteractiveFloorplan.tsx  # 可编辑户型图（添加/修改房间、确认朝向）
│   ├── FloorplanViewer.tsx       # 户型图查看器（图层切换、点位标注）
│   ├── AnalysisPanel.tsx         # 分析结果面板
│   ├── ChatPanel.tsx             # AI 问答面板
│   ├── PointDetail.tsx           # 风水点位详情弹窗
│   └── DonateFloating.tsx        # 浮动打赏组件
└── lib/
    ├── types.ts                  # 全局类型定义
    ├── ai/
    │   ├── qwen.ts               # Qwen3-VL 调用封装
    │   └── deepseek.ts           # DeepSeek 调用封装
    ├── fengshui/
    │   ├── xuankong.ts           # 玄空飞星排盘算法
    │   └── mapper.ts             # 房间宫位映射
    ├── floorplan/
    │   └── editable.ts           # 户型图编辑数据结构
    ├── geo/
    │   └── amap.ts               # 高德地图 API（地理编码 + POI 搜索）
    └── http/
        └── json.ts               # 安全 JSON 响应解析
```

## 数据流

```
用户上传户型图
  → /api/recognize (Qwen3-VL 识别)
  → 返回房间列表 + 朝向 + 户型图

用户编辑户型 + 确认朝向 + 填写地址
  → /api/analyze
    → 高德地理编码 (地址 → 坐标)
    → 高德周边搜索 (水系/道路/建筑)
    → 玄空飞星排盘 (朝向 → 九宫飞星)
    → DeepSeek 风水推理 (综合户型+环境+飞星)
  → 返回完整分析结果

用户提问
  → /api/chat
    → DeepSeek (结合分析上下文)

用户点击生成 PDF
  → /api/generate-pdf
    → Puppeteer 渲染 HTML → PDF
```
