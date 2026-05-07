export interface Room {
  name: string
  type: 'living' | 'bedroom' | 'kitchen' | 'bathroom' | 'balcony' | 'corridor' | 'study' | 'other'
  bounds: { x: number; y: number; width: number; height: number }
  points?: { x: number; y: number }[]
  doors?: { x: number; y: number; direction: string }[]
  windows?: { x: number; y: number }[]
  notes?: string
}

export interface FengshuiPoint {
  id: string
  type: 'caifang' | 'xiongwei' | 'taohua' | 'wenchang' | 'bingwei' | 'men' | 'chuang' | 'shasource'
  label: string
  x: number
  y: number
  room?: string
  analysis: string
  suggestion: string
  element?: string
  severity: 'good' | 'neutral' | 'warning' | 'danger'
  /** 所属图层 */
  layer?: 'bagua' | 'feixing' | 'xingsha' | 'caifang' | 'jiegou'
}

export interface FengshuiGeoFeature {
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

export interface RoomPalaceMapping {
  roomName: string
  roomType: string
  palacePosition: number
  palaceDirection: string
  palaceTrigram: string
  periodStar: number
  mountainStar: number
  waterStar: number
  interpretation: string
  centerX: number
  centerY: number
}

export interface FloorplanResult {
  imageBase64: string
  canvasWidth: number
  canvasHeight: number
  rooms: Room[]
  direction: string
  overallShape: string
  roomPalaceMappings: RoomPalaceMapping[]
  waterFeatures?: never
  roadFeatures?: never
  buildingFeatures?: never
  specialFeatures?: never
}

export interface GeoResult {
  address: string
  lng: number
  lat: number
  satelliteUrl: string
  terrain: TerrainInfo
  waterFeatures: FengshuiGeoFeature[]
  roadFeatures: FengshuiGeoFeature[]
  buildingFeatures: FengshuiGeoFeature[]
  specialFeatures: FengshuiGeoFeature[]
}

/** 九宫格中某一宫 */
export interface FlyingStarPalace {
  position: number          // 1-9 洛书位置 (1坎,2坤,3震,4巽,5中,6乾,7兑,8艮,9离)
  direction: string         // 八卦方位名 如 正北(坎)
  trigram: string           // 八卦符号 坎/坤/震/巽/中/乾/兑/艮/离
  periodStar: number        // 运星
  mountainStar: number      // 山星
  waterStar: number         // 向星
  mountainStarBase: number  // 山星基数（1-9，用于显示替卦信息）
  waterStarBase: number     // 向星基数
  wuxing: string            // 该宫五行
  interpretation: string    // 星组解读
  suggestion: string        // 调理建议
}

/** 玄空飞星排盘结果 */
export interface FlyingStarChart {
  palaces: FlyingStarPalace[]
  period: number            // 当前运（如 九运=9）
  facing: string            // 朝向（二十四山之一）
  sitting: string           // 坐山（二十四山之一）
  facingPalace: number      // 朝向所在宫位（1-9）
  sittingPalace: number     // 坐山所在宫位（1-9）
}

/** 二十四山方向 */
export type TwentyFourMountain =
  | '壬' | '子' | '癸'
  | '丑' | '艮' | '寅'
  | '甲' | '卯' | '乙'
  | '辰' | '巽' | '巳'
  | '丙' | '午' | '丁'
  | '未' | '坤' | '申'
  | '庚' | '酉' | '辛'
  | '戌' | '乾' | '亥'

export interface FengshuiResult {
  points: FengshuiPoint[]
  reportMarkdown: string
  overview: {
    bagua: string
    overallScore?: number
    summary: string
  }
  flyingStar?: FlyingStarChart
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface AnalysisResult {
  floorplan: FloorplanResult
  geo: GeoResult
  fengshui: FengshuiResult
  chatContext: string
  sessionId: string
}

/** 户型图图层定义 */
export type LayerType = 'jiegou' | 'bagua' | 'feixing' | 'xingsha' | 'caifang'

export interface LayerInfo {
  id: LayerType
  label: string
  color: string
  description: string
}

export type AnalysisStep = 'floorplan' | 'geo' | 'fengshui' | 'done' | 'error'

export interface ProgressState {
  step: AnalysisStep
  message: string
}
