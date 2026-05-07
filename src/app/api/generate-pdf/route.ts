import type { AnalysisResult, ChatMessage } from '@/lib/types'

const isServerless = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME

async function getBrowser() {
  if (isServerless) {
    // @ts-ignore - @sparticuz/chromium types are incorrect
    const { chromium } = await import('@sparticuz/chromium')
    return chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-web-security'],
      executablePath: await chromium.executablePath(),
    })
  } else {
    const puppeteer = (await import('puppeteer')).default
    return puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    })
  }
}

function buildPdfHtml(result: AnalysisResult, messages: ChatMessage[]): string {
  const { floorplan, geo, fengshui } = result

  const severityLabel: Record<string, string> = {
    good: '吉',
    neutral: '平',
    warning: '注意',
    danger: '凶',
  }

  const severityColor: Record<string, string> = {
    good: '#2d5016',
    neutral: '#6b5d4f',
    warning: '#b8860b',
    danger: '#c41e3a',
  }

  const pointsHtml = fengshui.points.map(p => `
    <div style="border:1px solid #d4c5a9; border-radius:8px; padding:16px; margin-bottom:12px; break-inside:avoid;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <strong style="font-size:16px; color:#3d3226;">${p.label}</strong>
        <span style="color:${severityColor[p.severity]}; font-weight:bold;">${severityLabel[p.severity]}</span>
      </div>
      ${p.room ? `<p style="color:#6b5d4f; margin:4px 0;">位置：${p.room}</p>` : ''}
      ${p.element ? `<p style="color:#6b5d4f; margin:4px 0;">五行：${p.element}</p>` : ''}
      <p style="color:#3d3226; margin:8px 0;">${p.analysis}</p>
      <p style="color:#b8860b; margin:8px 0;">💡 ${p.suggestion}</p>
    </div>
  `).join('')

  const allGeoFeatures = [
    ...geo.waterFeatures,
    ...geo.roadFeatures,
    ...geo.buildingFeatures,
    ...geo.specialFeatures,
  ]

  const surroundingsHtml = allGeoFeatures.length > 0
    ? allGeoFeatures.map(s => `
      <tr>
        <td style="padding:8px; border-bottom:1px solid #d4c5a9;">${s.type}</td>
        <td style="padding:8px; border-bottom:1px solid #d4c5a9;">${s.direction}方 · ${s.description}</td>
        <td style="padding:8px; border-bottom:1px solid #d4c5a9; color:${severityColor[s.severity]}">${severityLabel[s.severity]}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="3" style="padding:16px; text-align:center; color:#6b5d4f;">暂无周边环境数据</td></tr>'

  const qaHtml = messages.length > 0
    ? messages.map(m => `
      <div style="margin-bottom:16px; break-inside:avoid;">
        <p style="color:#b8860b; font-weight:bold; margin:0;">${m.role === 'user' ? '问' : '答'}：</p>
        <p style="color:#3d3226; margin:4px 0 0 0; white-space:pre-wrap;">${m.content}</p>
      </div>
    `).join('')
    : '<p style="color:#6b5d4f; text-align:center;">本次未提问</p>'

  const reportHtml = fengshui.reportMarkdown
    .replace(/^### (.+)$/gm, '<h3 style="color:#3d3226; margin:24px 0 12px; padding-bottom:4px; border-bottom:2px solid #d4c5a9;">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="color:#b8860b; margin:32px 0 16px; font-size:22px;">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="color:#b8860b; margin:0 0 24px; font-size:28px; text-align:center;">$1</h1>')
    .replace(/^- (.+)$/gm, '<li style="color:#3d3226; margin:4px 0;">$1</li>')
    .replace(/\n\n/g, '</p><p style="color:#3d3226; line-height:1.8; margin:8px 0;">')
    .replace(/\n/g, '<br/>')

  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 20mm; }
  body { font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; color: #3d3226; background: #fdf6e3; padding: 0; margin: 0; }
  .cover { text-align: center; padding: 80px 0 60px; }
  .cover h1 { font-size: 36px; color: #b8860b; letter-spacing: 8px; margin: 0 0 16px; }
  .cover .subtitle { font-size: 18px; color: #6b5d4f; margin: 0 0 40px; }
  .cover .divider { width: 100px; height: 2px; background: #b8860b; margin: 0 auto 32px; }
  .cover .info { color: #6b5d4f; font-size: 14px; line-height: 2; }
  .page-break { page-break-before: always; }
  .section-title { font-size: 24px; color: #b8860b; text-align: center; margin: 0 0 24px; padding-bottom: 8px; border-bottom: 3px double #d4c5a9; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th { background: #f5ecd7; padding: 10px; text-align: left; color: #3d3226; }
  .footer { text-align: center; color: #6b5d4f; font-size: 12px; margin-top: 40px; padding-top: 16px; border-top: 1px solid #d4c5a9; }
</style>
</head>
<body>
  <div class="cover">
    <h1>阳宅风水评估报告</h1>
    <p class="subtitle">—— ${geo.address || '未知地址'} ——</p>
    <div class="divider"></div>
    <div class="info">
      <p>朝向：${floorplan.direction}</p>
      <p>户型：${floorplan.overallShape}</p>
      <p>综合评分：${fengshui.overview.overallScore || '—'} 分</p>
      <p>生成时间：${new Date().toLocaleDateString('zh-CN')}</p>
    </div>
  </div>

  <div class="page-break">
    <h2 class="section-title">一、户型综述</h2>
    <p style="color:#3d3226; line-height:1.8;">本户型朝向为 <strong>${floorplan.direction}</strong>，整体形状为 <strong>${floorplan.overallShape}</strong>。共识别出 ${floorplan.rooms.length} 个功能区域：${floorplan.rooms.map(r => r.name).join('、')}。</p>
    <p style="color:#3d3226; line-height:1.8;">${fengshui.overview.summary}</p>
  </div>

  <div class="page-break">
    <h2 class="section-title">二、八卦方位分析</h2>
    <p style="color:#3d3226; line-height:1.8;">${fengshui.overview.bagua}</p>
  </div>

  <div class="page-break">
    <h2 class="section-title">三、周边形煞判断</h2>
    <table>
      <thead><tr><th>类型</th><th>环境描述</th><th>吉凶</th></tr></thead>
      <tbody>${surroundingsHtml}</tbody>
    </table>
  </div>

  <div class="page-break">
    <h2 class="section-title">四、详细风水分析</h2>
    <div style="line-height:1.8;">${reportHtml}</div>
  </div>

  <div class="page-break">
    <h2 class="section-title">五、关键风水点位</h2>
    ${pointsHtml}
  </div>

  <div class="page-break">
    <h2 class="section-title">六、AI 问答记录</h2>
    ${qaHtml}
  </div>

  <div class="footer">
    <p>本报告由 AI 风水评估系统自动生成，仅供娱乐参考</p>
    <p>© ${new Date().getFullYear()} 阳宅风水评估 · 传统智慧 · 现代科技</p>
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
      return Response.json({ error: '缺少分析结果' }, { status: 400 })
    }

    const html = buildPdfHtml(result, messages || [])

    let browser
    try {
      browser = await getBrowser()
    } catch {
      return Response.json({
        error: 'PDF 生成服务启动失败'
      }, { status: 500 })
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
    console.error('PDF 生成失败:', error)
    const message = error instanceof Error ? error.message : 'PDF 生成服务异常'
    return Response.json({ error: message }, { status: 500 })
  }
}
