import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // 1. Initialize the response early
  let supabaseResponse = NextResponse.next({
    request,
  });

  // 2. Setup Supabase Client
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

  // 3. Get the authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  // FETCH ROLE: Check metadata first, fallback to Profiles table
  let userRole = user?.user_metadata?.role;

  if (user && !userRole) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    userRole = profile?.role;
  }

  // --- SECURITY HEADERS ---
  supabaseResponse.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');

  // 4. Redirect authenticated users away from Auth pages (/login, /register)
  if (user && (pathname === "/login" || pathname === "/register")) {
    let dashPath = "/citizen/schedule";
    if (userRole === "ADMIN") dashPath = "/admin/dashboard";
    if (userRole === "DRIVER") dashPath = "/driver/dashboard";
    
    return NextResponse.redirect(new URL(dashPath, request.url));
  }

  // 5. PROTECTED ROUTE LOGIC
  const isAdminPath = pathname.startsWith("/admin");
  const isDriverPath = pathname.startsWith("/driver");
  const isCitizenPath = pathname.startsWith("/citizen");

  if (isAdminPath || isDriverPath || isCitizenPath) {
    // If not logged in at all, go to login
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // ADMIN ROUTE PROTECTION
    if (isAdminPath && userRole !== "ADMIN") {
      // If they are logged in but NOT an admin, send them to their rightful dashboard
      const fallback = userRole === "DRIVER" ? "/driver/dashboard" : "/citizen/schedule";
      return NextResponse.redirect(new URL(fallback, request.url));
    }

    // DRIVER ROUTE PROTECTION
    if (isDriverPath && userRole !== "DRIVER") {
      const fallback = userRole === "ADMIN" ? "/admin/dashboard" : "/citizen/schedule";
      return NextResponse.redirect(new URL(fallback, request.url));
    }

    // CITIZEN ROUTE PROTECTION (Strict)
    // We allow ADMINS to see citizen paths for management/testing
    if (isCitizenPath && userRole !== "CITIZEN" && userRole !== "ADMIN") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};