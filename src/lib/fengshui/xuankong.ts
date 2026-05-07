import type { FlyingStarChart, FlyingStarPalace, TwentyFourMountain } from '@/lib/types'

/** 洛书九宫：以洛书数(1-9)到[行,列]的映射，行为 y(0-2)，列为 x(0-2) */
const LUOSHU_TO_GRID: Record<number, [number, number]> = {
  9: [0, 0], 2: [0, 2], // 离9(上中) 坤2(右上)
  3: [1, 0], 5: [1, 1], 7: [1, 2], // 震3(左中) 中5 兑7(右中)
  8: [2, 0], 1: [2, 1], 4: [2, 2], // 艮8(左下) 坎1(下中) 巽4(右下)
}

/** 顺飞路径：从中宫开始依次飞到的洛书宫位 */
const FLY_ASCENDING: number[] = [5, 6, 7, 8, 9, 1, 2, 3, 4]

/** 逆飞路径：从中宫开始依次飞到的洛书宫位 */
const FLY_DESCENDING: number[] = [5, 4, 3, 2, 1, 9, 8, 7, 6]

/** 各宫位对应的八卦、方位名、五行 */
const PALACE_META: Record<number, { trigram: string; direction: string; wuxing: string }> = {
  1: { trigram: '坎', direction: '正北', wuxing: '水' },
  2: { trigram: '坤', direction: '西南', wuxing: '土' },
  3: { trigram: '震', direction: '正东', wuxing: '木' },
  4: { trigram: '巽', direction: '东南', wuxing: '木' },
  5: { trigram: '中', direction: '中央', wuxing: '土' },
  6: { trigram: '乾', direction: '西北', wuxing: '金' },
  7: { trigram: '兑', direction: '正西', wuxing: '金' },
  8: { trigram: '艮', direction: '东北', wuxing: '土' },
  9: { trigram: '离', direction: '正南', wuxing: '火' },
}

/** 二十四山 → 所属宫位 + 阴阳(顺飞=true, 逆飞=false) */
const MOUNTAIN_MAP: Record<TwentyFourMountain, { palace: number; yang: boolean; degree: number }> = {
  // 坎宫（壬 子 癸）正北
  '壬': { palace: 1, yang: true, degree: 345 },
  '子': { palace: 1, yang: false, degree: 0 },
  '癸': { palace: 1, yang: false, degree: 15 },
  // 艮宫（丑 艮 寅）东北
  '丑': { palace: 8, yang: false, degree: 30 },
  '艮': { palace: 8, yang: true, degree: 45 },
  '寅': { palace: 8, yang: true, degree: 60 },
  // 震宫（甲 卯 乙）正东
  '甲': { palace: 3, yang: true, degree: 75 },
  '卯': { palace: 3, yang: false, degree: 90 },
  '乙': { palace: 3, yang: false, degree: 105 },
  // 巽宫（辰 巽 巳）东南
  '辰': { palace: 4, yang: false, degree: 120 },
  '巽': { palace: 4, yang: true, degree: 135 },
  '巳': { palace: 4, yang: true, degree: 150 },
  // 离宫（丙 午 丁）正南
  '丙': { palace: 9, yang: true, degree: 165 },
  '午': { palace: 9, yang: false, degree: 180 },
  '丁': { palace: 9, yang: false, degree: 195 },
  // 坤宫（未 坤 申）西南
  '未': { palace: 2, yang: false, degree: 210 },
  '坤': { palace: 2, yang: true, degree: 225 },
  '申': { palace: 2, yang: true, degree: 240 },
  // 兑宫（庚 酉 辛）正西
  '庚': { palace: 7, yang: true, degree: 255 },
  '酉': { palace: 7, yang: false, degree: 270 },
  '辛': { palace: 7, yang: false, degree: 285 },
  // 乾宫（戌 乾 亥）西北
  '戌': { palace: 6, yang: false, degree: 300 },
  '乾': { palace: 6, yang: true, degree: 315 },
  '亥': { palace: 6, yang: true, degree: 330 },
}

/** 将用户朝向文字映射到二十四山 */
function directionToMountain(direction: string): TwentyFourMountain {
  const dir = direction.trim()
  const mapping: Record<string, TwentyFourMountain> = {
    '子': '子', '正北': '子', '北': '子', '坐北朝南': '子',
    '癸': '癸', '丑': '丑', '艮': '艮', '东北': '艮', '寅': '寅',
    '卯': '卯', '正东': '卯', '东': '卯', '甲': '甲', '乙': '乙',
    '辰': '辰', '巽': '巽', '东南': '巽', '巳': '巳',
    '午': '午', '正南': '午', '南': '午', '坐南朝北': '午',
    '丙': '丙', '丁': '丁', '未': '未', '坤': '坤', '西南': '坤', '申': '申',
    '酉': '酉', '正西': '酉', '西': '酉', '庚': '庚', '辛': '辛',
    '戌': '戌', '乾': '乾', '西北': '乾', '亥': '亥',
  }
  return mapping[dir] || '子'
}

/** 坐向分离：给定朝向，返回[坐山, 向方] */
function getSittingFacing(facingMountain: TwentyFourMountain): { sitting: TwentyFourMountain; facing: TwentyFourMountain } {
  const mountains: TwentyFourMountain[] = [
    '壬','子','癸','丑','艮','寅','甲','卯','乙',
    '辰','巽','巳','丙','午','丁','未','坤','申',
    '庚','酉','辛','戌','乾','亥',
  ]
  const idx = mountains.indexOf(facingMountain)
  const sittingIdx = (idx + 12) % 24
  return {
    sitting: mountains[sittingIdx],
    facing: facingMountain,
  }
}

/** 星数飞布：从某起始宫中宫星出发，按阴阳飞九宫 */
function flyStars(
  centerStar: number,
  yang: boolean
): Record<number, number> {
  const path = yang ? FLY_ASCENDING : FLY_DESCENDING
  const result: Record<number, number> = {}
  // 找到中宫星在 1-9 循环中的起始偏移
  // centerStar 放在第一个位置（中宫=5）
  const startOffset = centerStar - 1
  for (let i = 0; i < 9; i++) {
    const star = ((startOffset + i) % 9) + 1
    result[path[i]] = star
  }
  return result
}

/** 生成星组解读 */
function interpretStars(period: number, mountain: number, water: number): string {
  const combos: Record<string, string> = {
    '1_4': '文昌桃花，利学业姻缘',
    '1_6': '金水相生，官贵之兆',
    '1_8': '土克水，宜化解',
    '2_5': '二五交加，病灾重',
    '2_8': '土土比和，旺财运',
    '2_9': '火土相生，次吉',
    '3_4': '木木比和，旺文昌但防桃花劫',
    '4_9': '木火通明，利文书考试',
    '5_9': '火土相生，宜化解五黄',
    '6_8': '土生金，旺财旺官',
    '6_9': '火克金，宜调和',
    '7_9': '火克金，口舌是非',
    '8_9': '火土相生，喜庆财运',
  }
  const key1 = `${Math.min(mountain, water)}_${Math.max(mountain, water)}`
  return combos[key1] || (mountain === water ? '双星会合，力量加倍' : '需要结合实际布局判断')
}

/** 生成调理建议 */
function suggestPalace(trigram: string, wuxing: string, mountain: number, water: number): string {
  const suggestions: Record<string, Record<number, string>> = {
    '坎': { 1: '可置水景、鱼缸催旺', 5: '宜放金属摆件化解', 8: '可置水晶、黄玉招财' },
    '坤': { 2: '宜放红色饰品生旺', 8: '天然黄水晶旺财', 5: '宜放铜铃、六帝钱化解' },
    '震': { 3: '宜放绿植、文昌塔', 4: '放四支毛笔旺文昌', 1: '水养植物旺人缘' },
    '巽': { 4: '可置文昌笔、绿植', 1: '宜放鱼缸、水景', 6: '金属风水轮调和' },
    '离': { 9: '宜用黄色饰品泄火', 4: '绿色植物催旺文昌', 1: '水景可调和火气' },
    '乾': { 6: '金属摆件、铜器旺官运', 8: '黄水晶、玉石旺财', 2: '宜放红色饰品化解' },
    '兑': { 7: '宜用水景泄金气', 8: '水晶摆件调和', 9: '宜放黄水晶化解' },
    '艮': { 8: '黄玉、陶瓷旺财', 5: '金属风铃化解', 2: '红色饰品调和' },
    '中': { 5: '宜安静不宜动土', 1: '可放水景调和', 8: '放置黄水晶' },
  }

  const s = suggestions[trigram]
  if (!s) return '保持整洁明亮，避免堆放杂物'

  const starOrder = [mountain, water].sort((a, b) => b - a)
  for (const star of starOrder) {
    if (s[star]) return s[star]
  }
  return '保持整洁明亮，避免堆放杂物'
}

/**
 * 玄空飞星排盘
 * @param period 元运（默认为9，即当前的九运 2024-2043）
 * @param facingDirection 向方描述（如 "坐北朝南" 或 "南"）
 */
export function calculateFlyingStarChart(
  period: number = 9,
  facingDirection: string
): FlyingStarChart {
  const facingMountain = directionToMountain(facingDirection)
  const facingInfo = MOUNTAIN_MAP[facingMountain]
  const { sitting } = getSittingFacing(facingMountain)
  const sittingInfo = MOUNTAIN_MAP[sitting]

  const facingPalace = facingInfo.palace
  const sittingPalace = sittingInfo.palace

  // 1. 运星飞布（永远顺飞）
  const periodStars = flyStars(period, true)

  // 2. 山星基数 = 坐山所处宫的运星，向星基数 = 向方所处宫的运星
  const mountainBase = periodStars[sittingPalace]
  const waterBase = periodStars[facingPalace]

  // 3. 山星飞布（阴阳决定顺逆）
  const mountainStars = flyStars(mountainBase, sittingInfo.yang)
  const waterStars = flyStars(waterBase, facingInfo.yang)

  // 4. 组装九宫
  const palaces: FlyingStarPalace[] = []
  for (let pos = 1; pos <= 9; pos++) {
    const meta = PALACE_META[pos]
    const mStar = mountainStars[pos]
    const wStar = waterStars[pos]
    palaces.push({
      position: pos,
      direction: meta.direction,
      trigram: meta.trigram,
      periodStar: periodStars[pos],
      mountainStar: mStar,
      waterStar: wStar,
      mountainStarBase: mountainBase,
      waterStarBase: waterBase,
      wuxing: meta.wuxing,
      interpretation: interpretStars(period, mStar, wStar),
      suggestion: suggestPalace(meta.trigram, meta.wuxing, mStar, wStar),
    })
  }

  return {
    palaces,
    period,
    facing: facingMountain,
    sitting,
    facingPalace,
    sittingPalace,
  }
}

/**
 * 将飞星盘转为文字描述，供 AI Prompt 使用
 */
export function flyingStarToText(chart: FlyingStarChart): string {
  const lines: string[] = [
    `当前为${chart.period}运（九运：2024-2043年），坐${chart.sitting}向${chart.facing}`,
    '',
    '九宫飞星分布：',
  ]

  const posNames: Record<number, string> = {
    1: '正北(坎)', 2: '西南(坤)', 3: '正东(震)', 4: '东南(巽)',
    5: '中央(中)', 6: '西北(乾)', 7: '正西(兑)', 8: '东北(艮)', 9: '正南(离)',
  }

  for (const p of chart.palaces) {
    lines.push(
      `${posNames[p.position] || p.position}：运星${p.periodStar} 山星${p.mountainStar} 向星${p.waterStar}（${p.interpretation}）`
    )
  }

  return lines.join('\n')
}

/**
 * 将飞星转为户型图覆盖层数据：每个宫位的几何区域
 * 返回按洛书排列的区域列表，bound 为相对比例
 */
export function getPalaceGrid(): {
  position: number
  trigram: string
  label: string
  bounds: { x: number; y: number; width: number; height: number }
}[] {
  const grid: { position: number; col: number; row: number }[] = []
  for (let i = 1; i <= 9; i++) {
    const [row, col] = LUOSHU_TO_GRID[i]
    grid.push({ position: i, col, row })
  }

  return grid.map(({ position, col, row }) => {
    const meta = PALACE_META[position]
    return {
      position,
      trigram: meta.trigram,
      label: `${meta.direction} ${meta.trigram}`,
      bounds: {
        x: col / 3,
        y: row / 3,
        width: 1 / 3,
        height: 1 / 3,
      },
    }
  })
}

/** 从度数匹配二十四山 */
export function degreeToMountain(degrees: number): TwentyFourMountain {
  const normalized = ((degrees % 360) + 360) % 360
  const mountains: TwentyFourMountain[] = [
    '壬','子','癸','丑','艮','寅','甲','卯','乙',
    '辰','巽','巳','丙','午','丁','未','坤','申',
    '庚','酉','辛','戌','乾','亥',
  ]

  let closest: TwentyFourMountain = '子'
  let minDiff = Infinity
  for (const m of mountains) {
    let diff = Math.abs(normalized - MOUNTAIN_MAP[m].degree)
    if (diff > 180) diff = 360 - diff
    if (diff < minDiff) {
      minDiff = diff
      closest = m
    }
  }
  return closest
}
