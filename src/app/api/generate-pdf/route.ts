import type { AnalysisResult, ChatMessage } from '@/lib/types'

async function getBrowser() {
  const puppeteer = (await import('puppeteer')).default
  return puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  })
}

function renderStar(val: number, base: number): string {
  const display = val === base ? String(val) : `${val}（替）`
  return String(display)
}

function renderMarkdown(md: string): string {
  return md
    .split('\n\n')
    .map(block => {
      const trimmed = block.trim()
      if (!trimmed) return ''

      if (/^### /.test(trimmed)) {
        return `<h3 class="md-h3">${trimmed.replace(/^### /, '')}</h3>`
      }
      if (/^## /.test(trimmed)) {
        return `<h2 class="md-h2">${trimmed.replace(/^## /, '')}</h2>`
      }
      if (/^# /.test(trimmed)) {
        return `<h1 class="md-h1">${trimmed.replace(/^# /, '')}</h1>`
      }

      const lines = trimmed.split('\n')
      if (lines.every(l => /^- /.test(l.trim()))) {
        const items = lines.map(l => `<li>${l.trim().replace(/^- /, '')}</li>`).join('')
        return `<ul class="md-ul">${items}</ul>`
      }

      const html = trimmed
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>')
      return `<p class="md-p">${html}</p>`
    })
    .filter(Boolean)
    .join('\n')
}

function buildPdfHtml(result: AnalysisResult, messages: ChatMessage[]): string {
  const { floorplan, geo, fengshui } = result
  const fs = fengshui.flyingStar

  const now = new Date()
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`

  const score = fengshui.overview.overallScore || 50
  const scoreColor = score >= 80 ? '#2d5016' : score >= 60 ? '#b8860b' : '#c41e3a'

  const severityLabel: Record<string, string> = {
    good: '吉', neutral: '平', warning: '注意', danger: '凶',
  }
  const severityColor: Record<string, string> = {
    good: '#2d5016', neutral: '#6b5d4f', warning: '#b8860b', danger: '#c41e3a',
  }
  const severityBg: Record<string, string> = {
    good: '#e8f5e9', neutral: '#f5f0e8', warning: '#fff8e1', danger: '#fce4ec',
  }

  const palaceOrder = [4, 9, 2, 3, 5, 7, 8, 1, 6]

  const flyingStarGridHtml = fs
    ? `<table class="flying-star-table">
      <tbody>
        ${[0, 1, 2].map(rowIdx => `<tr>
          ${[0, 1, 2].map(colIdx => {
            const pos = palaceOrder[rowIdx * 3 + colIdx]
            const palace = fs.palaces.find(p => p.position === pos)
            if (!palace) return '<td class="fs-cell"></td>'
            const isFacing = pos === fs.facingPalace
            const isSitting = pos === fs.sittingPalace
            const label = isFacing ? '向' : isSitting ? '坐' : ''
            return `<td class="fs-cell ${isFacing ? 'fs-facing' : ''} ${isSitting ? 'fs-sitting' : ''}">
              <div class="fs-dir">${palace.direction}</div>
              <div class="fs-pos">${palace.trigram}</div>
              <div class="fs-stars">
                <span class="fs-period">${palace.periodStar}</span>
                <span class="fs-mountain">${renderStar(palace.mountainStar, palace.mountainStarBase)}</span>
                <span class="fs-water">${renderStar(palace.waterStar, palace.waterStarBase)}</span>
              </div>
              <div class="fs-wuxing">${palace.wuxing}</div>
              ${label ? `<div class="fs-label">${label}</div>` : ''}
            </td>`
          }).join('')}
        </tr>`).join('')}
      </tbody>
    </table>
    <p class="fs-note">运星 · 山星 · 向星　｜　${fs.period}运　｜　坐${fs.sitting}向${fs.facing}</p>`
    : '<p class="text-center text-muted">暂无飞星数据</p>'

  const roomPalaceHtml = floorplan.roomPalaceMappings?.length
    ? `<table class="data-table">
      <thead><tr><th>房间</th><th>宫位</th><th>八卦</th><th>运星</th><th>山星</th><th>向星</th><th>简释</th></tr></thead>
      <tbody>${floorplan.roomPalaceMappings.map(rp => `<tr>
        <td>${rp.roomName}</td>
        <td>${rp.palaceDirection}</td>
        <td>${rp.palaceTrigram}</td>
        <td>${rp.periodStar}</td>
        <td>${rp.mountainStar}</td>
        <td>${rp.waterStar}</td>
        <td class="text-sm">${rp.interpretation}</td>
      </tr>`).join('')}</tbody></table>`
    : ''

  const allGeoFeatures = [
    ...geo.waterFeatures.map(f => ({ ...f, cat: '💧 水' })),
    ...geo.roadFeatures.map(f => ({ ...f, cat: '🛣 路' })),
    ...geo.buildingFeatures.map(f => ({ ...f, cat: '🏢 建筑' })),
    ...geo.specialFeatures.map(f => ({ ...f, cat: '⚡ 特殊' })),
  ]

  const surroundingsHtml = allGeoFeatures.length > 0
    ? allGeoFeatures.map(s => `
      <tr>
        <td>${s.cat}</td>
        <td>${s.direction}方</td>
        <td>${s.description}</td>
        <td><span class="badge" style="background:${severityBg[s.severity]};color:${severityColor[s.severity]}">${severityLabel[s.severity]}</span></td>
      </tr>`).join('')
    : '<tr><td colspan="4" class="text-center text-muted">暂无周边环境数据</td></tr>'

  const pointsHtml = fengshui.points.map(p => `
    <div class="point-card" style="border-left:4px solid ${severityColor[p.severity]}; background:${severityBg[p.severity]}">
      <div class="point-card-header">
        <strong class="point-card-label">${p.label}</strong>
        <span class="badge" style="background:${severityColor[p.severity]};color:#fff">${severityLabel[p.severity]}</span>
      </div>
      <div class="point-card-meta">
        ${p.room ? `<span>📍 ${p.room}</span>` : ''}
        ${p.element ? `<span>🪵 ${p.element}</span>` : ''}
      </div>
      <p class="point-card-body">${p.analysis}</p>
      <p class="point-card-suggestion">💡 建议：${p.suggestion}</p>
    </div>
  `).join('')

  const qaHtml = messages.length > 0
    ? messages.map(m => `
      <div class="qa-item ${m.role}">
        <div class="qa-role">${m.role === 'user' ? '🙋 问' : '🤖 答'}</div>
        <p class="qa-content">${m.content.replace(/\n/g, '<br>')}</p>
      </div>`).join('')
    : '<p class="text-center text-muted">本次未提问</p>'

  const floorplanImgHtml = floorplan.imageBase64
    ? `<div class="floorplan-img-wrap">
      <img src="data:image/png;base64,${floorplan.imageBase64}" class="floorplan-img" />
    </div>`
    : ''

  const scoreBarHtml = `
    <div class="score-bar-wrap">
      <div class="score-bar-track">
        <div class="score-bar-fill" style="width:${score}%; background:${scoreColor}"></div>
      </div>
      <div class="score-bar-value" style="color:${scoreColor}">${score} / 100</div>
    </div>`

  const directionCompassHtml = (() => {
    const dirs = [
      { label: '北', deg: 0 },
      { label: '东北', deg: 45 },
      { label: '东', deg: 90 },
      { label: '东南', deg: 135 },
      { label: '南', deg: 180 },
      { label: '西南', deg: 225 },
      { label: '西', deg: 270 },
      { label: '西北', deg: 315 },
    ]
    const facingMap: Record<string, string> = {
      '子': '北', '午': '南', '卯': '东', '酉': '西',
      '丑': '东北', '寅': '东北', '辰': '东南', '巳': '东南',
      '未': '西南', '申': '西南', '戌': '西北', '亥': '西北',
      '甲': '东', '乙': '东', '丙': '南', '丁': '南',
      '庚': '西', '辛': '西', '壬': '北', '癸': '北',
    }
    const facingLabel = facingMap[floorplan.direction] || floorplan.direction
    return `<div class="compass-wrap">
      ${dirs.map(d => {
        const isFacing = d.label === facingLabel
        return `<div class="compass-dir ${isFacing ? 'compass-active' : ''}" style="color:${isFacing ? '#b8860b' : '#6b5d4f'}">
          ${d.label}${isFacing ? ' ▲' : ''}
        </div>`
      }).join('')}
      <div class="compass-center">${floorplan.direction}<br>${fs ? `坐${fs.sitting}` : ''}</div>
    </div>`
  })()

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap');
  @page { size: A4; margin: 18mm; }
  body {
    font-family: "Noto Sans SC", "WenQuanYi Micro Hei", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "SimHei", sans-serif;
    color: #333;
    background: #fff;
    padding: 0;
    margin: 0;
    font-size: 13px;
    line-height: 1.75;
  }

  .cover { text-align: center; padding: 80px 0 60px; }
  .cover h1 { font-size: 32px; color: #8B6914; letter-spacing: 6px; margin: 0 0 12px; }
  .cover .subtitle { font-size: 16px; color: #6b5d4f; margin: 0 0 36px; }
  .cover .divider { width: 80px; height: 2px; background: #c9a84c; margin: 0 auto 28px; }
  .cover .info { color: #6b5d4f; font-size: 13px; line-height: 2.2; }

  .page-break { page-break-before: always; }

  .section-title {
    font-size: 20px;
    color: #8B6914;
    text-align: center;
    margin: 0 0 20px;
    padding-bottom: 8px;
    border-bottom: 2px double #d4c5a9;
    letter-spacing: 2px;
  }

  .text-center { text-align: center; }
  .text-muted { color: #999; }
  .text-sm { font-size: 12px; }

  .data-table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
  .data-table th { background: #f5ecd7; padding: 8px 6px; text-align: center; color: #5a4a2f; font-weight: 600; border-bottom: 2px solid #d4c5a9; }
  .data-table td { padding: 7px 6px; border-bottom: 1px solid #e8ddc4; text-align: center; }
  .data-table tr:nth-child(even) td { background: #fdfaf2; }

  .badge { display: inline-block; padding: 1px 8px; border-radius: 3px; font-size: 11px; font-weight: 600; }

  .score-bar-wrap { display: flex; align-items: center; gap: 12px; margin: 12px 0; }
  .score-bar-track { flex: 1; height: 14px; background: #f0ebe0; border-radius: 7px; overflow: hidden; }
  .score-bar-fill { height: 100%; border-radius: 7px; transition: width 0.3s; }
  .score-bar-value { font-size: 18px; font-weight: 700; min-width: 70px; text-align: right; }

  .floorplan-img-wrap { text-align: center; margin: 12px 0; }
  .floorplan-img { max-width: 100%; max-height: 320px; border: 1px solid #d4c5a9; border-radius: 6px; }

  .flying-star-table { width: 80%; margin: 16px auto; border-collapse: collapse; }
  .fs-cell {
    border: 2px solid #d4c5a9;
    padding: 10px 6px;
    text-align: center;
    width: 33%;
    background: #fdfaf2;
    vertical-align: top;
  }
  .fs-dir { font-size: 11px; color: #6b5d4f; margin-bottom: 2px; }
  .fs-pos { font-size: 18px; font-weight: 700; color: #5a4a2f; margin-bottom: 6px; }
  .fs-stars { display: flex; gap: 4px; justify-content: center; margin-bottom: 4px; }
  .fs-period { display: inline-block; background: #f5ecd7; color: #8B6914; width: 22px; height: 22px; line-height: 22px; border-radius: 11px; font-size: 11px; font-weight: 700; }
  .fs-mountain { display: inline-block; background: #e8f4ea; color: #2d5016; width: 22px; height: 22px; line-height: 22px; border-radius: 11px; font-size: 11px; font-weight: 700; }
  .fs-water { display: inline-block; background: #e3f2fd; color: #1565c0; width: 22px; height: 22px; line-height: 22px; border-radius: 11px; font-size: 11px; font-weight: 700; }
  .fs-wuxing { font-size: 11px; color: #6b5d4f; }
  .fs-label { font-size: 10px; color: #fff; background: #c41e3a; display: inline-block; padding: 1px 6px; border-radius: 3px; margin-top: 3px; }
  .fs-facing { border-color: #b8860b; border-width: 3px; }
  .fs-sitting { border-color: #1565c0; border-width: 3px; }
  .fs-note { text-align: center; font-size: 12px; color: #8B6914; margin-top: 4px; }

  .compass-wrap {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;
    max-width: 300px; margin: 16px auto; text-align: center;
  }
  .compass-dir { padding: 6px 4px; border: 1px solid #e8ddc4; border-radius: 4px; font-size: 12px; }
  .compass-active { border-color: #b8860b; border-width: 2px; font-weight: 700; background: #fff8e1; }
  .compass-center { grid-column: 1 / -1; padding: 8px; font-size: 16px; font-weight: 700; color: #8B6914; border-top: 2px solid #d4c5a9; }

  .point-card {
    padding: 12px 14px; margin-bottom: 10px; border-radius: 6px;
    break-inside: avoid; page-break-inside: avoid;
  }
  .point-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .point-card-label { font-size: 14px; color: #5a4a2f; }
  .point-card-meta { display: flex; gap: 16px; font-size: 11px; color: #6b5d4f; margin-bottom: 6px; }
  .point-card-body { color: #333; margin: 4px 0; line-height: 1.7; }
  .point-card-suggestion { color: #b8860b; margin: 4px 0 0; font-size: 12px; }

  .qa-item { margin-bottom: 14px; break-inside: avoid; padding: 10px 14px; border-radius: 6px; }
  .qa-item.user { background: #fdfaf2; border-left: 3px solid #c9a84c; }
  .qa-item.assistant { background: #f7f4ea; border-left: 3px solid #8B6914; }
  .qa-role { font-weight: 700; font-size: 13px; color: #8B6914; margin-bottom: 4px; }
  .qa-content { color: #333; margin: 0; line-height: 1.7; white-space: pre-wrap; }

  .md-p { color: #333; margin: 10px 0; line-height: 1.8; text-indent: 2em; }
  .md-p:first-child { text-indent: 0; }
  .md-h1 { color: #8B6914; font-size: 22px; margin: 28px 0 16px; padding-bottom: 6px; border-bottom: 2px solid #d4c5a9; }
  .md-h2 { color: #b8860b; font-size: 18px; margin: 22px 0 12px; padding-left: 8px; border-left: 4px solid #c9a84c; }
  .md-h3 { color: #5a4a2f; font-size: 15px; margin: 16px 0 8px; }
  .md-ul { margin: 8px 0; padding-left: 20px; }
  .md-ul li { color: #333; margin: 4px 0; line-height: 1.7; }

  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0; }
  .info-item { padding: 8px 12px; background: #fdfaf2; border-radius: 4px; border: 1px solid #e8ddc4; }
  .info-item-label { font-size: 11px; color: #6b5d4f; }
  .info-item-value { font-size: 14px; font-weight: 600; color: #5a4a2f; }

  .room-tags { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
  .room-tag { padding: 3px 10px; border-radius: 12px; font-size: 11px; background: #f5ecd7; color: #5a4a2f; }

  .footer { text-align: center; color: #999; font-size: 11px; margin-top: 36px; padding-top: 12px; border-top: 1px solid #e8ddc4; }
</style>
</head>
<body>

  <div class="cover">
    <h1>阳宅风水评估报告</h1>
    <p class="subtitle">${geo.address || '未知地址'}</p>
    <div class="divider"></div>
    <div class="info">
      <p>坐　　向：${floorplan.direction}　${fs ? `（坐${fs.sitting}向${fs.facing}）` : ''}</p>
      <p>户型格局：${floorplan.overallShape}</p>
      <p>综合评分：${score} / 100</p>
      <p>评估日期：${dateStr}</p>
    </div>
    ${scoreBarHtml}
  </div>

  <div class="page-break">
    <h2 class="section-title">一、户型总览</h2>
    ${floorplanImgHtml}
    <div class="info-grid">
      <div class="info-item"><div class="info-item-label">朝向</div><div class="info-item-value">${floorplan.direction}</div></div>
      <div class="info-item"><div class="info-item-label">格局</div><div class="info-item-value">${floorplan.overallShape}</div></div>
      <div class="info-item"><div class="info-item-label">房间数</div><div class="info-item-value">${floorplan.rooms.length}</div></div>
      <div class="info-item"><div class="info-item-label">综合评分</div><div class="info-item-value" style="color:${scoreColor}">${score} / 100</div></div>
    </div>
    <div class="room-tags">${floorplan.rooms.map(r => `<span class="room-tag">${r.name}</span>`).join('')}</div>
    ${directionCompassHtml}
    <p class="md-p">${fengshui.overview.summary}</p>
  </div>

  ${fs ? `
  <div class="page-break">
    <h2 class="section-title">二、玄空飞星 · 九宫盘</h2>
    <p class="text-center" style="font-size:12px;color:#6b5d4f;margin-bottom:8px;">
      运星（米色）· 山星（绿色）· 向星（蓝色）　｜　${fs.period}运　｜　坐${fs.sitting}向${fs.facing}　｜　红色边框为向星宫位
    </p>
    ${flyingStarGridHtml}
    ${roomPalaceHtml}
  </div>
  ` : ''}

  <div class="page-break">
    <h2 class="section-title">${fs ? '三' : '二'}、八卦分析</h2>
    <p class="md-p">${fengshui.overview.bagua}</p>
  </div>

  <div class="page-break">
    <h2 class="section-title">${fs ? '四' : '三'}、周边环境分析</h2>
    <table class="data-table">
      <thead><tr><th>类别</th><th>方位</th><th>描述</th><th>吉凶</th></tr></thead>
      <tbody>${surroundingsHtml}</tbody>
    </table>
  </div>

  <div class="page-break">
    <h2 class="section-title">${fs ? '五' : '四'}、详细风水解读</h2>
    ${renderMarkdown(fengshui.reportMarkdown)}
  </div>

  <div class="page-break">
    <h2 class="section-title">${fs ? '六' : '五'}、关键风水要点</h2>
    ${pointsHtml}
  </div>

  <div class="page-break">
    <h2 class="section-title">${fs ? '七' : '六'}、AI 问答记录</h2>
    ${qaHtml}
  </div>

  <div class="footer">
    <p>本报告由 AI 风水评估系统自动生成，仅供娱乐参考，不构成专业建议</p>
    <p>© ${now.getFullYear()} 阳宅风水评估</p>
  </div>

</body>
</html>`
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { result, messages } = body as {
      result: AnalysisResult
      messages: ChatMessage[]
    }

    if (!result) {
      return Response.json({ error: 'Missing analysis result' }, { status: 400 })
    }

    const html = buildPdfHtml(result, messages || [])

    let browser
    try {
      browser = await getBrowser()
    } catch {
      return Response.json({
        error: 'PDF generation service unavailable'
      }, { status: 503 })
    }

    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
    })

    await browser.close()

    return new Response(pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.byteLength) as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="fengshui_report.pdf"`,
      },
    })
  } catch (error) {
    console.error('PDF generation failed:', error)
    const message = error instanceof Error ? error.message : 'PDF generation failed'
    return Response.json({ error: message }, { status: 500 })
  }
}
