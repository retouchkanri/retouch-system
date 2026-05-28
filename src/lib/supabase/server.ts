import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

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

export function createSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: fetchWithTimeout },
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Called from a Server Component where cookies cannot be set.
            // Middleware handles token refresh so this is safe to ignore.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            /* ignored: readonly context */
          }
        },
      },
    },
  );
}
