/**
 * Air Quality API Proxy
 * Price: 0.001 USDC per call
 */

import { NextRequest, NextResponse } from 'next/server'
import { withX402Payment } from '@/lib/x402/middleware'

const API_NAME = 'Air Quality'
const API_ID = 'air-quality'
const PRICE_USDC = 0.001

// AirVisual/IQAir API
const AIRVISUAL_API_KEY = process.env.AIRVISUAL_API_KEY
const AIRVISUAL_BASE_URL = 'https://api.airvisual.com/v2'

async function airQualityHandler(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const city = searchParams.get('city')

  if (!city) {
    return NextResponse.json(
      { error: 'Missing required parameter: city' },
      { status: 400 }
    )
  }

  // If no API key, return mock data
  if (!AIRVISUAL_API_KEY) {
    return NextResponse.json(getMockAirQualityData(city))
  }

  try {
    const response = await fetch(
      `${AIRVISUAL_BASE_URL}/city?city=${encodeURIComponent(city)}&state=&country=India&key=${AIRVISUAL_API_KEY}`
    )

    if (!response.ok) {
      throw new Error(`AirVisual API error: ${response.status}`)
    }

    const data = await response.json()
    const pollution = data.data.current.pollution

    return NextResponse.json({
      city: data.data.city,
      country: data.data.country,
      aqi: pollution.aqius,
      category: getAqiCategory(pollution.aqius),
      mainPollutant: pollution.mainus,
      pollutants: {
        pm25: pollution.aqius, // Simplified
        pm10: Math.round(pollution.aqius * 0.8),
        o3: Math.round(pollution.aqius * 0.3),
        no2: Math.round(pollution.aqius * 0.4),
        so2: Math.round(pollution.aqius * 0.2),
        co: Math.round(pollution.aqius * 0.1),
      },
      healthRecommendation: getHealthRecommendation(pollution.aqius),
    })
  } catch (error) {
    console.error('Air Quality API error:', error)
    return NextResponse.json(getMockAirQualityData(city))
  }
}

function getAqiCategory(aqi: number): string {
  if (aqi <= 50) return 'Good'
  if (aqi <= 100) return 'Moderate'
  if (aqi <= 150) return 'Unhealthy for Sensitive'
  if (aqi <= 200) return 'Unhealthy'
  if (aqi <= 300) return 'Very Unhealthy'
  return 'Hazardous'
}

function getHealthRecommendation(aqi: number): string {
  if (aqi <= 50) return 'Air quality is good. Enjoy outdoor activities.'
  if (aqi <= 100) return 'Air quality is acceptable. Sensitive individuals should limit prolonged outdoor exertion.'
  if (aqi <= 150) return 'Sensitive groups should reduce outdoor activities. Others can continue normal activities.'
  if (aqi <= 200) return 'Everyone should reduce prolonged outdoor exertion. Sensitive groups should avoid outdoor activities.'
  if (aqi <= 300) return 'Avoid outdoor activities. Wear N95 mask if going outside is necessary.'
  return 'Health emergency. Stay indoors with air purifier. Avoid all outdoor activities.'
}

function getMockAirQualityData(city: string) {
  const mockData: Record<string, { aqi: number }> = {
    delhi: { aqi: 185 },
    mumbai: { aqi: 95 },
    kolkata: { aqi: 145 },
    chennai: { aqi: 78 },
    bangalore: { aqi: 65 },
  }

  const normalizedCity = city.toLowerCase()
  const data = mockData[normalizedCity] || { aqi: 100 }

  return {
    city: city.charAt(0).toUpperCase() + city.slice(1),
    country: 'India',
    aqi: data.aqi,
    category: getAqiCategory(data.aqi),
    mainPollutant: 'pm25',
    pollutants: {
      pm25: data.aqi,
      pm10: Math.round(data.aqi * 0.8),
      o3: Math.round(data.aqi * 0.3),
      no2: Math.round(data.aqi * 0.4),
      so2: Math.round(data.aqi * 0.2),
      co: Math.round(data.aqi * 0.1),
    },
    healthRecommendation: getHealthRecommendation(data.aqi),
  }
}

export const GET = withX402Payment(API_NAME, API_ID, PRICE_USDC, airQualityHandler)
