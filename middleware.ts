// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // For now, we are just checking if a cookie exists. 
  // We will set this cookie in the Login page next.
  const userRole = request.cookies.get('user-role')?.value;
  const { pathname } = request.nextUrl;

  // 1. If trying to access Admin pages without Admin role
  if (pathname.startsWith('/admin') && userRole !== 'ADMIN') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 2. If trying to access Driver pages without Driver role
  if (pathname.startsWith('/driver') && userRole !== 'DRIVER') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

// Only run middleware on these specific paths
export const config = {
  matcher: ['/admin/:path*', '/driver/:path*'],
};