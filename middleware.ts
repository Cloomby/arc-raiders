// NOTE: In Next.js 16, 'middleware.ts' is deprecated in favor of 'proxy.ts'.
// We keep it here for next-auth v4 compatibility (withAuth uses middleware internals).
// Migrate to proxy.ts once next-auth adds Next.js 16 support.
import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    if (path.startsWith('/admin') && token?.role !== 'admin') {
      return NextResponse.redirect(new URL('/', req.url))
    }
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Admin routes require authentication
        if (req.nextUrl.pathname.startsWith('/admin')) {
          return !!token
        }
        return true
      },
    },
  }
)

export const config = {
  matcher: ['/admin/:path*'],
}
