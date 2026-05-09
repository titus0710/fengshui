# CLAUDE.md — 阳宅风水评估 项目技术手册

## 项目概述

阳宅风水评估 Web 应用。用户上传户型图 → AI 识别房间布局 → 结合玄空飞星与地理环境 → 生成风水评估报告与 PDF。

- **线上地址**: `https://www.rsbranch.cn`
- **本地端口**: `:3000`（默认，冲突时递增至 `:3100`）
- **服务器端口**: `:3001`（`pm2 start npm -- start -- -p 3001`）

## 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 框架 | Next.js (App Router) | 16.2.4 |
| 前端 | React + Tailwind CSS | 19 / 4 |
| 语言 | TypeScript | 5 |
| AI 户型识别 | 通义千问 Qwen3-VL | DashScope API |
| AI 风水推理 | DeepSeek | API |
| 地图 | 高德 Web 服务 API | — |
| PDF | Puppeteer | 24 |
| 部署 | 腾讯云轻量 (OpenCloudOS) + 宝塔 + PM2 | — |

## 环境变量

`.env.local` 中的必填变量：

| 变量 | 用途 |
|------|------|
| `DASHSCOPE_API_KEY` | 通义千问 Qwen3-VL，户型图识别 |
| `DEEPSEEK_API_KEY` | DeepSeek V4 Pro，风水推理 + AI 问答 |
| `AMAP_SERVICE_KEY` | 高德地图，地理编码 + POI 搜索 |

`PUPPETEER_EXECUTABLE_PATH` 可选，服务器上不设置则使用默认路径。

## 项目结构

```
src/
├── app/
│   ├── page.tsx                    # 首页：步骤式流程（上传→编辑户型→选择朝向→开始评估）
│   ├── explore/page.tsx            # 结果页：户型查看器 + 分析面板 + AI 问答 + PDF 导出
│   ├── layout.tsx                  # 全局布局（nav + footer）
│   ├── globals.css                 # Tailwind + 自定义主题变量
│   └── api/
│       ├── recognize/route.ts      # POST multipart: 图片 → Qwen3-VL 识别 → 房间/朝向
│       ├── analyze/route.ts        # POST form: 地址+朝向+户型 → 高德→飞星→DeepSeek
│       ├── chat/route.ts           # POST json: 消息列表 → DeepSeek 流式/非流式回复
│       ├── districts/route.ts      # GET: 省市区级联数据
│       └── generate-pdf/route.ts   # POST json: 结果数据 → Puppeteer HTML→PDF
├── components/
│   ├── AddressSelector.tsx         # 省市区三级联动选择器（高德 district API）
│   ├── InteractiveFloorplan.tsx    # 可编辑户型：选择/矩形/异型，添加房间，重命名，确认朝向
│   ├── FloorplanViewer.tsx         # 结果查看：图层切换（结构/八卦/飞星/形煞/财位），点位标注
│   ├── AnalysisPanel.tsx           # 分析总览：评分、八卦解读、周边环境、风水详解
│   ├── ChatPanel.tsx               # AI 对话：基于当前分析上下文自由提问
│   ├── PointDetail.tsx             # 点位弹窗：风水点详情 + 调理建议
│   └── DonateFloating.tsx          # 打赏浮动框：5 分钟冷却，localStorage 记录关闭时间
└── lib/
    ├── types.ts                    # 所有接口定义：Room, FengshuiPoint, FlyingStarChart 等
    ├── ai/
    │   ├── qwen.ts                 # fetch Qwen3-VL，多模态户型识别
    │   └── deepseek.ts             # fetch DeepSeek，风水推理 + 问答
    ├── fengshui/
    │   ├── xuankong.ts             # 玄空飞星排盘算法：朝向→二十四山→九宫飞星
    │   └── mapper.ts               # 房间→宫位映射
    ├── floorplan/
    │   └── editable.ts             # 户型编辑：点/矩形/异型，碰撞检测，相邻边检测
    ├── geo/
    │   └── amap.ts                 # 高德 API：地理编码、周边 POI 搜索（水/路/建筑）
    └── http/
        └── json.ts                 # readJsonResponse：安全解析 fetch 响应，检测 HTML/非 JSON
```

## 核心数据流

### 1. 户型识别流程
```
用户上传图片 (page.tsx)
  → POST /api/recognize (FormData: image)
  → qwen.ts: 调用 Qwen3-VL 多模态接口
  → 返回: { rooms[], direction, overallShape, imageBase64 }
  → page.tsx: 渲染 InteractiveFloorplan
```

### 2. 风水分析流程
```
用户确认户型 + 选择朝向 + 填写地址 (page.tsx)
  → POST /api/analyze (FormData: address, facing, period, canvas, image)
  → 高德地理编码 (amap.ts: geocode)
  → 高德周边搜索 (amap.ts: searchPoi x4: 水/路/建筑/特殊)
  → 玄空飞星排盘 (xuankong.ts: calculateFlyingStar)
  → DeepSeek 风水推理 (deepseek.ts: analyzeFengshui)
  → 返回: AnalysisResult { floorplan, geo, fengshui }
  → 存入 sessionStorage → 跳转 /explore
```

### 3. PDF 生成
```
用户点击生成 PDF (explore/page.tsx)
  → POST /api/generate-pdf (JSON: result + messages)
  → buildPdfHtml(): 构建 HTML（户型图嵌入、九宫飞星表格、方位罗盘、Markdown 渲染）
  → Puppeteer 启动 headless Chrome
  → page.setContent() → page.pdf()
  → 返回 PDF Buffer
```

## 关键设计决策

1. **AI 调用用原生 fetch，不用 OpenAI SDK**
   - 原因：Next.js 16 构建阶段会执行 SDK 初始化，导致 API key 缺失报错
   - 所有 AI 调用统一在 `lib/ai/*.ts` 中封装

2. **玄空飞星由前端/后端双重计算**
   - `lib/fengshui/xuankong.ts` 做服务端排盘
   - 排盘结果（FlyingStarChart）回传给前端 FloorplanViewer 做可视化

3. **户型编辑用 sessionStorage 而非 URL 参数**
   - 原因：imageBase64 数据量大，不适合 URL 传递
   - explore 页面从 sessionStorage 读取 `analysisResult`

4. **PDF 中文字体方案**
   - Google Fonts `@import` 在线加载（开发/轻量环境）
   - 服务器安装 `google-noto-sans-cjk-fonts`（生产兜底）

## 常用命令

```bash
# 开发
npm run dev          # 启动开发服务器
npm run build        # 生产构建
npm run lint         # ESLint 检查
npx tsc --noEmit    # 纯类型检查

# 服务器部署
cd /www/wwwroot/fengshui
git pull origin main
npm install
npm run build
pm2 restart fengshui

# 查看日志
pm2 logs fengshui
tail -f /www/wwwlogs/fengshui.error.log
```

## Nginx 关键配置

文件位置：`/www/server/panel/vhost/nginx/node_fengshui.conf`

```nginx
location /api/analyze {
    proxy_pass http://127.0.0.1:3001;
    proxy_read_timeout 300s;
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
    # 继承 location / 的 header 设置
}

location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_cache_bypass $http_cache_control $http_upgrade;
    proxy_no_cache $http_cache_control $http_upgrade;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}
```

## 类型体系

核心类型见 `src/lib/types.ts`：

- `Room` — 房间定义（名称、类型、坐标、门窗）
- `FloorplanResult` — 识别结果（图片、房间列表、朝向、宫位映射）
- `GeoResult` — 地理数据（坐标、周边水系/道路/建筑）
- `FengshuiResult` — 风水分析（点位、Markdown 报告、飞星图）
- `FlyingStarChart` — 九宫飞星（9 个宮位、运星/山星/向星）
- `AnalysisResult` — 顶层聚合（floorplan + geo + fengshui）
- `ChatMessage` — 对话消息

## 已知陷阱

- **构建时 API key 问题**：不要在最外层 import 时初始化 OpenAI 等 SDK，用懒加载或原生 fetch
- **Uint8Array → Buffer**：Puppeteer 返回的 pdfBuffer 需要 `.slice(byteOffset)` 转 Buffer
- **params 需要 await**：Next.js 16 Route Handler 中 `params` 是 Promise
- **端口冲突**：本地可能有多份服务占用 3000/3100，确认 `lsof -i :3100`
- **宝塔面板状态**：宝塔 "Node 项目" 状态与 PM2 实际状态可能不同步，以 `pm2 list` 为准
- **Nginx 缓存**：宝塔 Nginx 全局 `proxy_cache` 可能缓存首页 HTML，更新后需清缓存或禁用
