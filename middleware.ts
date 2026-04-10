// middleware.ts  (place at project root, same level as /app)
//
// Protects all role-specific routes.
// Reads the Supabase session from the request cookies and checks the
// user's role from the profiles table before allowing access.
//
// Flow:
//   1. Public routes (/login, /register, /) pass through with no check.
//   2. Protected routes read the session cookie.
//   3. No session → redirect to /login.
//   4. Wrong role for the requested route → redirect to their correct dashboard.

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// ─────────────────────────────────────────────────────────────────────────────
// Role → allowed path prefixes
// A user may access any route that starts with one of their allowed prefixes.
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_ALLOWED_PREFIXES: Record<string, string[]> = {
  SUPER_ADMIN: ["/super-admin"],
  ADMIN:       ["/admin"],
  DRIVER:      ["/driver"],
  LGU:         ["/lgu"],
  CITIZEN:     ["/citizen"],
};

// Where to send each role after a wrong-route redirect
const ROLE_HOME: Record<string, string> = {
  SUPER_ADMIN: "/super-admin/dashboard",
  ADMIN:       "/admin/dashboard",
  DRIVER:      "/driver/dashboard",
  LGU:         "/lgu/dashboard",
  CITIZEN:     "/citizen/schedule",
};

// Routes that never need a session check
const PUBLIC_PATHS = ["/login", "/register", "/", "/_next", "/icons", "/favicon"];

// All protected route prefixes (anything under these requires a session)
const PROTECTED_PREFIXES = [
  "/super-admin",
  "/admin",
  "/driver",
  "/lgu",
  "/citizen",
];

// ─────────────────────────────────────────────────────────────────────────────
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── 1. Always allow public paths ──────────────────────────────────────────
  const isPublic = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + "/"));
  if (isPublic) return NextResponse.next();

  // ── 2. Only intercept protected routes ────────────────────────────────────
  const isProtected = PROTECTED_PREFIXES.some(p => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  // ── 3. Build Supabase server client (reads cookies, writes refreshed tokens)
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  // ── 4. Verify user with Supabase Auth server ──────────────────────────────
  // getUser() contacts the Supabase Auth server to validate the JWT,
  // unlike getSession() which only reads the cookie without verification.
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // No authenticated user → send to login, preserve the intended destination
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("message", "Please sign in to continue.");
    return NextResponse.redirect(loginUrl);
  }

  // ── 5. Fetch role from profiles ────────────────────────────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_archived")
    .eq("id", user.id)
    .single();

  // No profile or archived → sign out and redirect
  if (!profile || profile.is_archived) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("message", "Your account is not accessible.");
    // Clear the session cookie so they're fully signed out
    response = NextResponse.redirect(loginUrl);
    response.cookies.delete("sb-access-token");
    response.cookies.delete("sb-refresh-token");
    return response;
  }

  const role: string = profile.role ?? "CITIZEN";

  // ── 6. Check role is allowed on this path ─────────────────────────────────
  const allowedPrefixes = ROLE_ALLOWED_PREFIXES[role] ?? ["/citizen"];
  const isAllowed = allowedPrefixes.some(prefix => pathname.startsWith(prefix));

  if (!isAllowed) {
    // Wrong section → redirect to their correct home
    const correctHome = ROLE_HOME[role] ?? "/citizen/schedule";
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = correctHome;
    return NextResponse.redirect(redirectUrl);
  }

  // ── 7. All good — pass through with refreshed cookies ─────────────────────
  return response;
}

// ─────────────────────────────────────────────────────────────────────────────
// Matcher: run middleware on all routes except static files and API
// ─────────────────────────────────────────────────────────────────────────────

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static  (static files)
     * - _next/image   (image optimization)
     * - favicon.ico
     * - /icons/       (PWA icons)
     * - /api/         (API routes handle their own auth)
     */
    "/((?!_next/static|_next/image|favicon.ico|icons|api).*)",
  ],
};