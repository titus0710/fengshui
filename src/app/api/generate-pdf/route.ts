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
      <p style="color:#b8860b; margin:8px 0;">建议：${p.suggestion}</p>
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
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap');
  @page { size: A4; margin: 20mm; }
  body { font-family: "Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "SimHei", sans-serif; color: #3d3226; background: #fdf6e3; padding: 0; margin: 0; -webkit-font-smoothing: antialiased; }
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
  * { -webkit-font-smoothing: antialiased; }
</style>
</head>
<body>
  <div class="cover">
    <h1>Yang Zhai Feng Shui Report</h1>
    <p class="subtitle">-- ${geo.address || 'Unknown Address'} --</p>
    <div class="divider"></div>
    <div class="info">
      <p>Facing: ${floorplan.direction}</p>
      <p>Layout: ${floorplan.overallShape}</p>
      <p>Score: ${fengshui.overview.overallScore || '-'} / 100</p>
      <p>Date: ${new Date().toLocaleDateString('en-US')}</p>
    </div>
  </div>

  <div class="page-break">
    <h2 class="section-title">I. Layout Overview</h2>
    <p style="color:#3d3226; line-height:1.8;">This layout faces <strong>${floorplan.direction}</strong>, with an overall shape of <strong>${floorplan.overallShape}</strong>. A total of ${floorplan.rooms.length} functional areas were identified: ${floorplan.rooms.map(r => r.name).join(', ')}.</p>
    <p style="color:#3d3226; line-height:1.8;">${fengshui.overview.summary}</p>
  </div>

  <div class="page-break">
    <h2 class="section-title">II. Ba Gua Analysis</h2>
    <p style="color:#3d3226; line-height:1.8;">${fengshui.overview.bagua}</p>
  </div>

  <div class="page-break">
    <h2 class="section-title">III. Surrounding Analysis</h2>
    <table>
      <thead><tr><th>Type</th><th>Description</th><th>Judgment</th></tr></thead>
      <tbody>${surroundingsHtml}</tbody>
    </table>
  </div>

  <div class="page-break">
    <h2 class="section-title">IV. Detailed Feng Shui Analysis</h2>
    <div style="line-height:1.8;">${reportHtml}</div>
  </div>

  <div class="page-break">
    <h2 class="section-title">V. Key Feng Shui Points</h2>
    ${pointsHtml}
  </div>

  <div class="page-break">
    <h2 class="section-title">VI. AI Q&A History</h2>
    ${qaHtml}
  </div>

  <div class="footer">
    <p>Generated by AI Feng Shui Assessment System</p>
    <p>© ${new Date().getFullYear()} Yang Zhai Feng Shui</p>
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
