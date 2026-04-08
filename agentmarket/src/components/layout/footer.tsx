import Link from 'next/link'

const footerLinks = {
  product: [
    { href: '/marketplace', label: 'Marketplace' },
    { href: '/demo', label: 'Live Demo' },
    { href: '/docs', label: 'Documentation' },
    { href: '/sdk', label: 'SDK' },
  ],
  providers: [
    { href: '/providers/register', label: 'List Your API' },
    { href: '/providers/dashboard', label: 'Dashboard' },
    { href: '/docs/providers', label: 'Provider Guide' },
  ],
  resources: [
    { href: 'https://github.com/agentmarket', label: 'GitHub' },
    { href: 'https://www.npmjs.com/package/agstell-sdk', label: 'npm' },
    { href: 'https://developers.stellar.org', label: 'Stellar Docs' },
    { href: 'https://x402.org', label: 'x402 Protocol' },
  ],
}

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-xl px-3 py-1.5 rounded-lg">
                AM
              </div>
              <span className="font-bold text-xl">AgentMarket</span>
            </Link>
            <p className="text-sm text-muted-foreground mb-4">
              The API marketplace built for AI agents. Payment is authentication.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Powered by</span>
              <span className="text-xs font-semibold bg-gradient-to-r from-[#3E1BDB] to-[#9747FF] text-transparent bg-clip-text">
                Stellar
              </span>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold mb-4">Product</h4>
            <ul className="space-y-2">
              {footerLinks.product.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Providers */}
          <div>
            <h4 className="font-semibold mb-4">For Providers</h4>
            <ul className="space-y-2">
              {footerLinks.providers.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-semibold mb-4">Resources</h4>
            <ul className="space-y-2">
              {footerLinks.resources.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    target={link.href.startsWith('http') ? '_blank' : undefined}
                    rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} AgentMarket. Built for the Stellar Hackathon.
          </p>
          <p className="text-xs text-muted-foreground">
            &quot;Every API on the internet was built assuming a human would set it up. We built the first one assuming nobody will.&quot;
          </p>
        </div>
      </div>
    </footer>
  )
}
