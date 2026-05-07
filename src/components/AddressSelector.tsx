'use client'

import { useState, useEffect, useCallback } from 'react'

interface District {
  name: string
  adcode: string
}

interface AddressSelectorProps {
  onAddressChange: (address: string) => void
}

export default function AddressSelector({ onAddressChange }: AddressSelectorProps) {
  const [provinces, setProvinces] = useState<District[]>([])
  const [cities, setCities] = useState<District[]>([])
  const [districts, setDistricts] = useState<District[]>([])

  const [selectedProvince, setSelectedProvince] = useState('')
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedDistrict, setSelectedDistrict] = useState('')
  const [community, setCommunity] = useState('')

  const [loadingProvinces, setLoadingProvinces] = useState(true)
  const [loadingCities, setLoadingCities] = useState(false)
  const [loadingDistricts, setLoadingDistricts] = useState(false)

  const fetchDistricts = useCallback(async (level: string, adcode?: string) => {
    const params = new URLSearchParams()
    if (level) params.set('level', level)
    if (adcode) params.set('adcode', adcode)
    const res = await fetch(`/api/districts?${params.toString()}`)
    const data = await res.json()
    return data.districts as District[]
  }, [])

  // 获取省份
  useEffect(() => {
    fetchDistricts('').then(d => { setProvinces(d); setLoadingProvinces(false) })
  }, [fetchDistricts])

  // 省变化 → 获取城市
  useEffect(() => {
    if (!selectedProvince) return
    setSelectedCity('')
    setSelectedDistrict('')
    setCities([])
    setDistricts([])
    setLoadingCities(true)
    fetchDistricts('city', selectedProvince).then(d => { setCities(d); setLoadingCities(false) })
  }, [selectedProvince, fetchDistricts])

  // 市变化 → 获取区县
  useEffect(() => {
    if (!selectedCity) return
    setSelectedDistrict('')
    setDistricts([])
    setLoadingDistricts(true)
    fetchDistricts('district', selectedCity).then(d => { setDistricts(d); setLoadingDistricts(false) })
  }, [selectedCity, fetchDistricts])

  // 拼接完整地址
  useEffect(() => {
    const provinceName = provinces.find(p => p.adcode === selectedProvince)?.name || ''
    const cityName = cities.find(c => c.adcode === selectedCity)?.name || ''
    const districtName = districts.find(d => d.adcode === selectedDistrict)?.name || ''
    const parts = [provinceName, cityName, districtName, community].filter(Boolean)
    onAddressChange(parts.join(''))
  }, [selectedProvince, selectedCity, selectedDistrict, community, provinces, cities, districts, onAddressChange])

  const selectClass = "w-full px-4 py-3 bg-paper text-ink border border-border rounded-lg focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors appearance-none cursor-pointer"

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* 省 */}
        <div>
          <label className="block text-xs font-medium ink-light mb-1">省份</label>
          <select
            value={selectedProvince}
            onChange={(e) => setSelectedProvince(e.target.value)}
            className={selectClass}
            disabled={loadingProvinces}
          >
            <option value="">{loadingProvinces ? '加载中...' : '请选择省份'}</option>
            {provinces.map(p => (
              <option key={p.adcode} value={p.adcode}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* 市 */}
        <div>
          <label className="block text-xs font-medium ink-light mb-1">城市</label>
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className={selectClass}
            disabled={!selectedProvince || loadingCities}
          >
            <option value="">{loadingCities ? '加载中...' : '请选择城市'}</option>
            {cities.map(c => (
              <option key={c.adcode} value={c.adcode}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* 区 */}
        <div>
          <label className="block text-xs font-medium ink-light mb-1">区县</label>
          <select
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            className={selectClass}
            disabled={!selectedCity || loadingDistricts}
          >
            <option value="">{loadingDistricts ? '加载中...' : '请选择区县'}</option>
            {districts.map(d => (
              <option key={d.adcode} value={d.adcode}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* 小区/街道 */}
        <div>
          <label className="block text-xs font-medium ink-light mb-1">小区或街道</label>
          <input
            type="text"
            value={community}
            onChange={(e) => setCommunity(e.target.value)}
            placeholder="如：XX小区、XX路XX号"
            className="w-full px-4 py-3 bg-paper text-ink border border-border rounded-lg focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
          />
        </div>
      </div>
    </div>
  )
}
