import { readJsonResponse } from '@/lib/http/json'

function isValidAddress(addr: string): boolean {
  if (!addr || addr.length > 200) return false
  if (/^https?:\/\//i.test(addr)) return false
  if (/[<>{}|\\^~[\]]/.test(addr)) return false
  return true
}

function getAmapKey(): string | undefined {
  return process.env.AMAP_SERVICE_KEY?.trim()
}

export interface GeoData {
  address: string
  lng: number
  lat: number
  satelliteUrl: string
  terrain: TerrainInfo
  waterFeatures: FengshuiFeature[]
  roadFeatures: FengshuiFeature[]
  buildingFeatures: FengshuiFeature[]
  specialFeatures: FengshuiFeature[]
}

export interface FengshuiFeature {
  name: string
  type: string
  description: string
  direction: string
  distance: number
  severity: 'good' | 'neutral' | 'warning' | 'danger'
  fengshuiImpact: string
}

export interface TerrainInfo {
  description: string
  elevation?: string
  hasWaterNearby: boolean
  hasMountainNearby: boolean
  hasHighwayNearby: boolean
  buildingDensity: string
}

async function geocode(address: string): Promise<{ lng: number; lat: number; formattedAddress: string }> {
  if (!isValidAddress(address)) {
    throw new Error(`地址格式无效：${address}`)
  }
  const amapKey = getAmapKey()
  if (!amapKey) {
    throw new Error('未配置 AMAP_SERVICE_KEY 环境变量')
  }
  const url = `https://restapi.amap.com/v3/geocode/geo?key=${amapKey}&address=${encodeURIComponent(address)}`
  const res = await fetch(url)
  const data = await readJsonResponse<{ status?: string; geocodes?: { location: string; formatted_address: string }[] }>(res, '高德地理编码 API')
  if (data.status !== '1' || !data.geocodes?.length) {
    throw new Error(`地址解析失败：${address}`)
  }
  const { location, formatted_address } = data.geocodes[0]
  const [lng, lat] = location.split(',').map(Number)
  return { lng, lat, formattedAddress: formatted_address }
}

function getDirection(dir: string): string {
  if (!dir || dir === '[]') return '未知'
  const d = dir.replace(/[\[\]]/g, '')
  const num = parseFloat(d)
  if (isNaN(num)) return d
  if (num >= 337.5 || num < 22.5) return '北'
  if (num < 67.5) return '东北'
  if (num < 112.5) return '东'
  if (num < 157.5) return '东南'
  if (num < 202.5) return '南'
  if (num < 247.5) return '西南'
  if (num < 292.5) return '西'
  return '西北'
}

/** 搜索周边指定类型 POI */
async function searchPOI(
  lng: number, lat: number, typeCode: string, radius: number, keyword?: string
): Promise<{ name: string; type: string; distance: number; direction: string; address: string }[]> {
  try {
    const amapKey = getAmapKey()
    if (!amapKey) return []
    let url = `https://restapi.amap.com/v3/place/around?key=${amapKey}&location=${lng},${lat}&radius=${radius}&types=${typeCode}&offset=10&extensions=all`
    if (keyword) {
      url = `https://restapi.amap.com/v3/place/around?key=${amapKey}&location=${lng},${lat}&radius=${radius}&keywords=${encodeURIComponent(keyword)}&offset=10&extensions=all`
    }
    const res = await fetch(url)
    const data = await readJsonResponse<{ status?: string; pois?: { name: string; type: string; distance: string; direction: string; address: string }[] }>(res, '高德周边搜索 API')
    if (data.status !== '1' || !data.pois?.length) return []

    return data.pois.map((poi: { name: string; type: string; distance: string; direction: string; address: string }) => ({
      name: poi.name,
      type: poi.type,
      distance: parseInt(poi.distance) || 0,
      direction: getDirection(poi.direction),
      address: poi.address || '',
    }))
  } catch {
    return []
  }
}

/** 分析水体 */
async function analyzeWaterFeatures(lng: number, lat: number): Promise<FengshuiFeature[]> {
  const results: FengshuiFeature[] = []
  const waterPOIs = await searchPOI(lng, lat, '110000|110100|110200', 2000)

  for (const poi of waterPOIs) {
    const isRiver = poi.type.includes('河流') || poi.name.includes('河') || poi.name.includes('江')
    const isLake = poi.type.includes('湖泊') || poi.name.includes('湖')
    const isPond = poi.name.includes('池') || poi.name.includes('塘')

    let impact = ''
    let severity: FengshuiFeature['severity'] = 'neutral'
    const dir = poi.direction

    if (isRiver || isLake) {
      if (dir === '东' || dir === '东南' || dir === '南') {
        impact = '水聚明堂，藏风聚气。若水势平缓清澈则大吉，旺财旺丁'
        severity = 'good'
      } else if (dir === '北' || dir === '西北') {
        impact = '水在玄武方，若为反弓则主破财退运，需筑墙植树化解'
        severity = 'warning'
      } else if (dir === '西') {
        impact = '白虎位见水，若水清则利女主人，浊则有口舌是非'
        severity = 'neutral'
      } else {
        impact = '水势需结合具体形状判断。玉带环抱为吉，反弓直冲为凶'
        severity = 'neutral'
      }
    } else {
      impact = '小型水体，宜保持清澈流动，死水潭不利风水'
      severity = 'neutral'
    }

    results.push({
      name: poi.name,
      type: isRiver ? '河流' : isLake ? '湖泊' : '水体',
      description: `${poi.name}（约${poi.distance}米，${dir}方）`,
      direction: dir,
      distance: poi.distance,
      severity,
      fengshuiImpact: impact,
    })
  }

  return results
}

/** 分析道路形煞 */
async function analyzeRoadFeatures(lng: number, lat: number): Promise<FengshuiFeature[]> {
  const results: FengshuiFeature[] = []
  const roadPOIs = await searchPOI(lng, lat, '190300', 500)
  const highwayPOIs = await searchPOI(lng, lat, '190300', 1000, '高速')

  for (const poi of [...highwayPOIs, ...roadPOIs].slice(0, 8)) {
    const dist = poi.distance
    const dir = poi.direction
    let impact = ''
    let severity: FengshuiFeature['severity'] = 'neutral'
    const isHighway = poi.name.includes('高速') || poi.name.includes('快速路')
    const type = isHighway ? '高速公路/快速路' : '主干道'

    if (dist < 100) {
      impact = '道路紧贴，形成路冲之势。主意外灾祸、血光之患，需设屏风、石敢当化解'
      severity = 'danger'
    } else if (dist < 200) {
      impact = '临近道路，气流直冲不聚。宜种植绿篱、设置围墙缓冲气流量'
      severity = 'warning'
    } else {
      impact = '距离适中，虽有道路但气流可缓。注意窗户朝向勿正对路心'
      severity = 'neutral'
    }

    results.push({
      name: poi.name,
      type,
      description: `${poi.name}（约${dist}米，${dir}方）`,
      direction: dir,
      distance: dist,
      severity,
      fengshuiImpact: impact,
    })
  }

  return results
}

/** 分析大型建筑形煞 */
async function analyzeBuildingFeatures(lng: number, lat: number): Promise<FengshuiFeature[]> {
  const results: FengshuiFeature[] = []
  const tallBuildings = await searchPOI(lng, lat, '120300', 800)

  for (const poi of tallBuildings.slice(0, 8)) {
    const dist = poi.distance
    const dir = poi.direction
    let impact = ''
    let severity: FengshuiFeature['severity'] = 'neutral'

    if (dist < 100) {
      impact = '建筑物迫近，若高度远高于本宅则成逼压煞，压制家运，居住者易感压抑'
      severity = 'danger'
    } else if (dist < 300) {
      impact = '有高大建筑在侧，注意是否遮挡阳光与通风。若形成天斩（两楼夹缝对冲）则主血光'
      severity = 'warning'
    } else {
      impact = '距离适中，可作为天然屏障，但需注意其外立面是否有反光玻璃（光煞）'
      severity = 'neutral'
    }

    results.push({
      name: poi.name,
      type: '大型建筑',
      description: `${poi.name}（约${dist}米，${dir}方）`,
      direction: dir,
      distance: dist,
      severity,
      fengshuiImpact: impact,
    })
  }

  return results
}

/** 分析特殊场所：寺庙、医院、政府机关、变电站等 */
async function analyzeSpecialFeatures(lng: number, lat: number): Promise<FengshuiFeature[]> {
  const results: FengshuiFeature[] = []

  const specialSearches = [
    { keyword: '变电站', type: '电力设施', impact: '电磁煞，长期居住不利健康。宜远离或摆放水晶、仙人掌化解' },
    { keyword: '高压线', type: '电力设施', impact: '高压电磁场影响人体气场，是严重的形煞之一' },
    { keyword: '寺庙', type: '宗教场所', impact: '庙宇气场特殊，阴阳交接之地。近者家宅不安，宜保持距离或设泰山石敢当', severity: 'warning' as const },
    { keyword: '教堂', type: '宗教场所', impact: '建筑风格尖锐者（哥特式尖顶）在风水上属火形煞', severity: 'warning' as const },
    { keyword: '医院', type: '医疗场所', impact: '医院阴气病气聚集，不宜太近。可在朝向医院方向放置八卦镜或种植高大绿植', severity: 'warning' as const },
    { keyword: '殡仪馆', type: '殡葬场所', impact: '此为极阴之地，附近气场沉重。建议请专业风水师实地勘测', severity: 'danger' as const },
    { keyword: '垃圾处理', type: '污秽场所', impact: '污秽之气冲射，不利健康和财运。宜在其方向筑墙或种植茂密绿植遮挡', severity: 'danger' as const },
  ]

  for (const s of specialSearches) {
    const pois = await searchPOI(lng, lat, '', 1500, s.keyword)
    for (const poi of pois.slice(0, 3)) {
      results.push({
        name: poi.name,
        type: s.type,
        description: `${poi.name}（约${poi.distance}米，${poi.direction}方）`,
        direction: poi.direction,
        distance: poi.distance,
        severity: (s as { severity?: FengshuiFeature['severity'] }).severity || 'neutral',
        fengshuiImpact: s.impact,
      })
    }
  }

  // 政府机关
  const govPOIs = await searchPOI(lng, lat, '130000', 1500)
  for (const poi of govPOIs.slice(0, 3)) {
    results.push({
      name: poi.name,
      type: '政府机关',
      description: `${poi.name}（约${poi.distance}米，${poi.direction}方）`,
      direction: poi.direction,
      distance: poi.distance,
      severity: 'good',
      fengshuiImpact: '政府机关阳气旺盛，且建筑讲究方正，对周边气场有稳定作用',
    })
  }

  // 化工厂
  const factoryPOIs = await searchPOI(lng, lat, '', 2000, '化工厂')
  for (const poi of factoryPOIs.slice(0, 3)) {
    results.push({
      name: poi.name,
      type: '工业设施',
      description: `${poi.name}（约${poi.distance}米，${poi.direction}方）`,
      direction: poi.direction,
      distance: poi.distance,
      severity: 'danger',
      fengshuiImpact: '工业污染之气直冲，严重影响居住风水。若不可避免，需在朝向工厂方设置密植绿墙',
    })
  }

  return results
}

/** 评估地形地貌 */
function assessTerrain(
  waterFeatures: FengshuiFeature[],
  buildingFeatures: FengshuiFeature[],
  roadFeatures: FengshuiFeature[]
): TerrainInfo {
  const hasWater = waterFeatures.length > 0
  const hasMountain = false // 高德 POI 无可靠山体数据
  const hasHighway = roadFeatures.some(r => r.distance < 200 && r.severity !== 'neutral')

  const buildingCount = buildingFeatures.length
  let buildingDensity = '低'
  let densityDesc = '建筑密度较低，气场流通性好'
  if (buildingCount > 6) {
    buildingDensity = '高'
    densityDesc = '周边高楼林立，气流动受阻，易形成回风返气'
  } else if (buildingCount > 3) {
    buildingDensity = '中'
    densityDesc = '建筑密度适中，需观察主要建筑物高度是否对本宅形成遮挡'
  }

  const terrainDescriptions: string[] = []
  if (hasWater) terrainDescriptions.push('附近有水体，水为财，具体吉凶取决于水流方向和形态')
  if (hasHighway) terrainDescriptions.push('周边有快速道路，需注意路冲和噪音对气场的影响')
  terrainDescriptions.push(densityDesc)
  if (!hasWater && !hasHighway && buildingCount <= 3) {
    terrainDescriptions.push('整体外部环境较为平和，无明显形煞')
  }

  return {
    description: terrainDescriptions.join('；'),
    hasWaterNearby: hasWater,
    hasMountainNearby: hasMountain,
    hasHighwayNearby: hasHighway,
    buildingDensity,
  }
}

function getSatelliteUrl(lng: number, lat: number): string {
  const amapKey = getAmapKey()
  if (!amapKey) return ''
  return `https://restapi.amap.com/v3/staticmap?key=${amapKey}&location=${lng},${lat}&zoom=16&size=800*600&scale=2&markers=mid,,A:${lng},${lat}&hybrid=1`
}

export async function analyzeGeo(address: string): Promise<GeoData> {
  const amapKey = getAmapKey()
  if (!amapKey) {
    return {
      address,
      lng: 0,
      lat: 0,
      satelliteUrl: '',
      terrain: { description: '', hasWaterNearby: false, hasMountainNearby: false, hasHighwayNearby: false, buildingDensity: '未知' },
      waterFeatures: [],
      roadFeatures: [],
      buildingFeatures: [],
      specialFeatures: [],
    }
  }

  const { lng, lat, formattedAddress } = await geocode(address)

  const [waterFeatures, roadFeatures, buildingFeatures, specialFeatures] = await Promise.all([
    analyzeWaterFeatures(lng, lat),
    analyzeRoadFeatures(lng, lat),
    analyzeBuildingFeatures(lng, lat),
    analyzeSpecialFeatures(lng, lat),
  ])

  const terrain = assessTerrain(waterFeatures, buildingFeatures, roadFeatures)
  const satelliteUrl = getSatelliteUrl(lng, lat)

  return {
    address: formattedAddress,
    lng,
    lat,
    satelliteUrl,
    terrain,
    waterFeatures,
    roadFeatures,
    buildingFeatures,
    specialFeatures,
  }
}

/** 生成给 AI 的地理风水描述 */
export function geoToFengshuiText(geo: GeoData): string {
  const lines: string[] = []

  lines.push(`地址：${geo.address}，坐标：(${geo.lng}, ${geo.lat})`)
  lines.push('')
  lines.push('地形地貌评估：')
  lines.push(geo.terrain.description)

  if (geo.waterFeatures.length > 0) {
    lines.push('')
    lines.push('周边水系：')
    for (const w of geo.waterFeatures) {
      lines.push(`  ${w.description}`)
      lines.push(`  → 风水影响：${w.fengshuiImpact}`)
    }
  }

  if (geo.roadFeatures.length > 0) {
    lines.push('')
    lines.push('周边道路：')
    for (const r of geo.roadFeatures) {
      lines.push(`  ${r.description}`)
      lines.push(`  → 风水影响：${r.fengshuiImpact}`)
    }
  }

  if (geo.buildingFeatures.length > 0) {
    lines.push('')
    lines.push('大型建筑：')
    for (const b of geo.buildingFeatures) {
      lines.push(`  ${b.description}`)
      lines.push(`  → 风水影响：${b.fengshuiImpact}`)
    }
  }

  if (geo.specialFeatures.length > 0) {
    lines.push('')
    lines.push('需关注的特殊场所：')
    for (const s of geo.specialFeatures) {
      lines.push(`  [${s.severity === 'danger' ? '⚠️ 重大' : '⚠ 注意'}] ${s.description}`)
      lines.push(`  → 风水影响：${s.fengshuiImpact}`)
    }
  }

  return lines.join('\n')
}
