import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  // 0.0.0.0 is not a valid browser URL, replace with localhost
  const origin = url.origin.replace("0.0.0.0", "localhost");
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.redirect(
        `${origin}/auth?error=${encodeURIComponent("Auth not configured")}`,
      );
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: Record<string, unknown>;
          }[],
        ) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocal = process.env.NODE_ENV === "development";
      const redirectBase =
        isLocal || !forwardedHost ? origin : `https://${forwardedHost}`;

      let destination = next;
      if (destination === "/") {
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("role")
              .eq("id", user.id)
              .single();
            if (profile?.role === "admin" || profile?.role === "super_admin") {
              destination = "/admin";
            }
          }
        } catch {
          // fall through to default destination
        }
      }

      return NextResponse.redirect(`${redirectBase}${destination}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/auth?error=${encodeURIComponent("Could not authenticate")}`,
  );
}
