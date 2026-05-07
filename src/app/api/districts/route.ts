const AMAP_KEY = process.env.AMAP_SERVICE_KEY

interface AmapDistrict {
  name: string
  adcode: string
  districts?: AmapDistrict[]
}

function extractDistricts(data: { districts?: AmapDistrict[] }): { name: string; adcode: string }[] {
  if (!data.districts?.length) return []
  const first = data.districts[0]
  return (first.districts || []).map((d: AmapDistrict) => ({ name: d.name, adcode: d.adcode }))
}

async function fetchDistricts(keywords?: string): Promise<{ name: string; adcode: string }[]> {
  const params = new URLSearchParams({ key: AMAP_KEY!, subdistrict: '1' })
  if (keywords) params.set('keywords', keywords)
  const url = `https://restapi.amap.com/v3/config/district?${params.toString()}`
  const res = await fetch(url)
  const data = await res.json()
  if (data.status !== '1') return []
  return extractDistricts(data)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const level = searchParams.get('level')
  const adcode = searchParams.get('adcode')

  if (!AMAP_KEY) {
    return Response.json({ districts: [] })
  }

  try {
    if (!level) {
      const districts = await fetchDistricts()
      return Response.json({ districts })
    }

    if (level === 'city' && adcode) {
      const districts = await fetchDistricts(adcode)
      return Response.json({ districts })
    }

    if (level === 'district' && adcode) {
      const districts = await fetchDistricts(adcode)
      return Response.json({ districts })
    }

    return Response.json({ districts: [] })
  } catch {
    return Response.json({ districts: [] })
  }
}
