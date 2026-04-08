'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const navLinks = [
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/demo', label: 'Demo' },
  { href: '/providers', label: 'For Providers' },
  { href: '/docs', label: 'Docs' },
]

export function Header() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg blur opacity-40 group-hover:opacity-60 transition-opacity" />
            <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-xl px-3 py-1.5 rounded-lg">
              AM
            </div>
          </div>
          <span className="font-bold text-xl hidden sm:block">AgentMarket</span>
          <Badge variant="stellar" className="hidden md:flex">
            Stellar x402
          </Badge>
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                pathname === link.href
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="hidden sm:flex">
            Connect Wallet
          </Button>
          <Button variant="stellar" size="sm">
            Try Demo
          </Button>
        </div>
      </div>
    </header>
  )
}
