import { recognizeFloorplan } from '@/lib/ai/qwen'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const imageFile = formData.get('image') as File | null

    if (!imageFile) {
      return Response.json({ error: '请上传户型图' }, { status: 400 })
    }

    const imageBytes = await imageFile.arrayBuffer()
    const imageBase64 = Buffer.from(imageBytes).toString('base64')

    const floorplanData = await recognizeFloorplan({ imageBase64 })

    return Response.json(floorplanData)
  } catch (error) {
    console.error('户型图识别失败:', error)
    const message = error instanceof Error ? error.message : '识别服务异常'
    return Response.json({ error: message }, { status: 500 })
  }
}
