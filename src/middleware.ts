import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { safeGetUser } from "@/lib/supabase/safe-auth";

const fetchWithTimeout = async (input: RequestInfo | URL, init?: RequestInit) => {
  const timeoutPromise = new Promise<Response>((resolve) => {
    setTimeout(() => {
      resolve(
        new Response(
          JSON.stringify({
            error: "timeout",
            error_description: "Supabase request timed out",
          }),
          {
            status: 504,
            headers: { "content-type": "application/json" },
          },
        ),
      );
    }, 3000);
  });

  return Promise.race([fetch(input, init), timeoutPromise]);
};

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    global: { fetch: fetchWithTimeout },
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
  });

  await safeGetUser(supabase);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|favicon.png|icons|manifest.json|sw.js|workbox|api/stripe/webhook).*)",
  ],
};
