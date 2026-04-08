/**
 * News API Proxy
 * Price: 0.002 USDC per call
 */

import { NextRequest, NextResponse } from 'next/server'
import { withX402Payment } from '@/lib/x402/middleware'

const API_NAME = 'News'
const API_ID = 'news'
const PRICE_USDC = 0.002

// NewsAPI
const NEWS_API_KEY = process.env.NEWSAPI_API_KEY
const NEWS_API_BASE_URL = 'https://newsapi.org/v2'

async function newsHandler(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const topic = searchParams.get('topic') || searchParams.get('q')
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50)

  if (!topic) {
    return NextResponse.json(
      { error: 'Missing required parameter: topic' },
      { status: 400 }
    )
  }

  // If no API key, return mock data
  if (!NEWS_API_KEY) {
    return NextResponse.json(getMockNewsData(topic, limit))
  }

  try {
    const response = await fetch(
      `${NEWS_API_BASE_URL}/everything?q=${encodeURIComponent(topic)}&pageSize=${limit}&sortBy=publishedAt&apiKey=${NEWS_API_KEY}`
    )

    if (!response.ok) {
      throw new Error(`NewsAPI error: ${response.status}`)
    }

    const data = await response.json()

    return NextResponse.json({
      articles: data.articles.map((article: Record<string, unknown>) => ({
        title: article.title,
        source: (article.source as Record<string, string>)?.name || 'Unknown',
        author: article.author || null,
        description: article.description || null,
        url: article.url,
        imageUrl: article.urlToImage || null,
        publishedAt: article.publishedAt,
      })),
      totalResults: data.totalResults,
      query: topic,
    })
  } catch (error) {
    console.error('News API error:', error)
    return NextResponse.json(getMockNewsData(topic, limit))
  }
}

function getMockNewsData(topic: string, limit: number) {
  const mockArticles = [
    {
      title: `Latest developments in ${topic}: What you need to know`,
      source: 'Tech News Daily',
      author: 'John Smith',
      description: `An in-depth look at recent developments in ${topic} and their implications.`,
      url: 'https://example.com/article1',
      imageUrl: null,
      publishedAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      title: `${topic} industry sees major breakthrough`,
      source: 'Industry Insider',
      author: 'Jane Doe',
      description: `Experts weigh in on the latest breakthrough in ${topic}.`,
      url: 'https://example.com/article2',
      imageUrl: null,
      publishedAt: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      title: `How ${topic} is changing the world`,
      source: 'Global Report',
      author: 'Alex Johnson',
      description: `A comprehensive analysis of ${topic}'s global impact.`,
      url: 'https://example.com/article3',
      imageUrl: null,
      publishedAt: new Date(Date.now() - 10800000).toISOString(),
    },
    {
      title: `The future of ${topic}: Predictions for 2025`,
      source: 'Future Trends',
      author: 'Sarah Williams',
      description: `Industry leaders share their predictions for ${topic}.`,
      url: 'https://example.com/article4',
      imageUrl: null,
      publishedAt: new Date(Date.now() - 14400000).toISOString(),
    },
    {
      title: `${topic} startups to watch this year`,
      source: 'Startup Weekly',
      author: 'Michael Brown',
      description: `A roundup of the most promising ${topic} startups.`,
      url: 'https://example.com/article5',
      imageUrl: null,
      publishedAt: new Date(Date.now() - 18000000).toISOString(),
    },
  ]

  return {
    articles: mockArticles.slice(0, limit),
    totalResults: mockArticles.length,
    query: topic,
  }
}

export const GET = withX402Payment(API_NAME, API_ID, PRICE_USDC, newsHandler)
