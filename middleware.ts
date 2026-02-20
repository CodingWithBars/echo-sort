import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set({ name, value, ...options });
            supabaseResponse.cookies.set({ name, value, ...options });
          });
        },
      },
    }
  );

  // 1. Get the authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  const userRole = user?.user_metadata?.role;
  const { pathname } = request.nextUrl;

  // --- SECURITY HEADERS ---
  // This prevents the browser from storing a "snapshot" of private pages.
  // When the user hits 'Back' after logging out, they will be forced to re-fetch and hit this middleware.
  supabaseResponse.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
  supabaseResponse.headers.set('Pragma', 'no-cache');

  // 2. Redirect authenticated users away from Login/Register
  // Prevents the "Back button to login" confusion
  if (user && (pathname === "/login" || pathname === "/register")) {
    if (userRole === "ADMIN") return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    if (userRole === "DRIVER") return NextResponse.redirect(new URL("/driver/dashboard", request.url));
    return NextResponse.redirect(new URL("/citizen/schedule", request.url));
  }

  // 3. Protect Admin Routes
  if (pathname.startsWith("/admin") && userRole !== "ADMIN") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 4. Protect Driver Routes
  if (pathname.startsWith("/driver") && userRole !== "DRIVER") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 5. Protect Citizen Routes (Optional, but recommended)
  if (pathname.startsWith("/citizen") && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 6. Final catch-all for unauthenticated users on protected paths
  if (!user && (pathname.startsWith("/admin") || pathname.startsWith("/driver") || pathname.startsWith("/citizen"))) {
    const loginUrl = new URL("/login", request.url);
    // Optional: add a "next" param to redirect them back after they log in
    // loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (svg, png, etc)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};