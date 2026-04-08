/**
 * IP Geolocation API Proxy
 * Price: 0.001 USDC per call
 */

import { NextRequest, NextResponse } from 'next/server'
import { withX402Payment } from '@/lib/x402/middleware'

const API_NAME = 'Geolocation'
const API_ID = 'geolocation'
const PRICE_USDC = 0.001

// IPInfo API
const IPINFO_API_KEY = process.env.IPINFO_API_KEY
const IPINFO_BASE_URL = 'https://ipinfo.io'

async function geolocationHandler(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  let ip = searchParams.get('ip')

  // If no IP provided, get the requester's IP
  if (!ip) {
    ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
         request.headers.get('x-real-ip') ||
         '8.8.8.8' // Default for testing
  }

  // Validate IP format (basic check)
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    return NextResponse.json(
      { error: 'Invalid IP address format' },
      { status: 400 }
    )
  }

  // If no API key, return mock data
  if (!IPINFO_API_KEY) {
    return NextResponse.json(getMockGeolocationData(ip))
  }

  try {
    const response = await fetch(
      `${IPINFO_BASE_URL}/${ip}?token=${IPINFO_API_KEY}`
    )

    if (!response.ok) {
      throw new Error(`IPInfo API error: ${response.status}`)
    }

    const data = await response.json()
    const [lat, lon] = (data.loc || '0,0').split(',').map(Number)

    return NextResponse.json({
      ip: data.ip,
      city: data.city || 'Unknown',
      region: data.region || 'Unknown',
      country: data.country || 'Unknown',
      countryCode: data.country || 'XX',
      lat,
      lon,
      timezone: data.timezone || 'UTC',
      isp: data.org || 'Unknown',
      org: data.org || 'Unknown',
    })
  } catch (error) {
    console.error('Geolocation API error:', error)
    return NextResponse.json(getMockGeolocationData(ip))
  }
}

function getMockGeolocationData(ip: string) {
  // Mock data for common IPs
  const mockData: Record<string, { city: string; country: string; lat: number; lon: number }> = {
    '8.8.8.8': { city: 'Mountain View', country: 'US', lat: 37.386, lon: -122.084 },
    '1.1.1.1': { city: 'Sydney', country: 'AU', lat: -33.868, lon: 151.207 },
  }

  const data = mockData[ip] || { city: 'Unknown', country: 'XX', lat: 0, lon: 0 }

  return {
    ip,
    city: data.city,
    region: data.city,
    country: data.country,
    countryCode: data.country,
    lat: data.lat,
    lon: data.lon,
    timezone: 'UTC',
    isp: 'Unknown ISP',
    org: 'Unknown Org',
  }
}

export const GET = withX402Payment(API_NAME, API_ID, PRICE_USDC, geolocationHandler)
