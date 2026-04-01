import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
	const { searchParams, origin } = new URL(request.url);
	const code = searchParams.get("code");
	const next = searchParams.get("next") ?? "/";

	if (code) {
		const cookieStore = await cookies();
		const supabase = createServerClient(
			process.env.NEXT_PUBLIC_SUPABASE_URL!,
			process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
			{
				cookies: {
					getAll() {
						return cookieStore.getAll();
					},
					setAll(cookiesToSet) {
						for (const { name, value, options } of cookiesToSet) {
							cookieStore.set(name, value, options);
						}
					},
				},
			},
		);

		const { error } = await supabase.auth.exchangeCodeForSession(code);

		if (!error) {
			const forwardedHost = request.headers.get("x-forwarded-host");
			const isLocal = process.env.NODE_ENV === "development";
			const redirectBase =
				isLocal || !forwardedHost
					? origin
					: `https://${forwardedHost}`;
			return NextResponse.redirect(`${redirectBase}${next}`);
		}
	}

	return NextResponse.redirect(
		`${origin}/auth?error=${encodeURIComponent("Could not authenticate")}`,
	);
}
