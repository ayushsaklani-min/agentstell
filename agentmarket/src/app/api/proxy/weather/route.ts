/**
 * Weather API Proxy
 * Price: 0.001 USDC per call
 */

import { NextRequest, NextResponse } from 'next/server'
import { withX402Payment } from '@/lib/x402/middleware'

const API_NAME = 'Weather'
const API_ID = 'weather'
const PRICE_USDC = 0.001

// OpenWeatherMap API
const OPENWEATHER_API_KEY = process.env.OPENWEATHERMAP_API_KEY
const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5'

async function weatherHandler(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const city = searchParams.get('city')

  if (!city) {
    return NextResponse.json(
      { error: 'Missing required parameter: city' },
      { status: 400 }
    )
  }

  // If no API key, return mock data (for demo)
  if (!OPENWEATHER_API_KEY) {
    return NextResponse.json(getMockWeatherData(city))
  }

  try {
    const response = await fetch(
      `${OPENWEATHER_BASE_URL}/weather?q=${encodeURIComponent(city)}&appid=${OPENWEATHER_API_KEY}&units=metric`
    )

    if (!response.ok) {
      throw new Error(`OpenWeatherMap API error: ${response.status}`)
    }

    const data = await response.json()

    // Transform to our standard format
    return NextResponse.json({
      city: data.name,
      country: data.sys.country,
      temp: Math.round(data.main.temp),
      tempMin: Math.round(data.main.temp_min),
      tempMax: Math.round(data.main.temp_max),
      feelsLike: Math.round(data.main.feels_like),
      humidity: data.main.humidity,
      windSpeed: data.wind.speed,
      conditions: data.weather[0].main,
      description: data.weather[0].description,
      icon: data.weather[0].icon,
      sunrise: data.sys.sunrise,
      sunset: data.sys.sunset,
    })
  } catch (error) {
    console.error('Weather API error:', error)
    
    // Fallback to mock data
    return NextResponse.json(getMockWeatherData(city))
  }
}

// Mock data for demo purposes
function getMockWeatherData(city: string) {
  const mockData: Record<string, { temp: number; conditions: string; humidity: number }> = {
    delhi: { temp: 32, conditions: 'Haze', humidity: 65 },
    mumbai: { temp: 29, conditions: 'Cloudy', humidity: 78 },
    kolkata: { temp: 30, conditions: 'Clear', humidity: 72 },
    chennai: { temp: 31, conditions: 'Partly Cloudy', humidity: 80 },
    bangalore: { temp: 25, conditions: 'Clear', humidity: 55 },
  }

  const normalizedCity = city.toLowerCase()
  const data = mockData[normalizedCity] || { temp: 28, conditions: 'Clear', humidity: 60 }

  return {
    city: city.charAt(0).toUpperCase() + city.slice(1),
    country: 'IN',
    temp: data.temp,
    tempMin: data.temp - 3,
    tempMax: data.temp + 4,
    feelsLike: data.temp + 2,
    humidity: data.humidity,
    windSpeed: 3.5,
    conditions: data.conditions,
    description: data.conditions.toLowerCase(),
    icon: '01d',
    sunrise: Math.floor(Date.now() / 1000) - 21600,
    sunset: Math.floor(Date.now() / 1000) + 21600,
  }
}

export const GET = withX402Payment(API_NAME, API_ID, PRICE_USDC, weatherHandler)
