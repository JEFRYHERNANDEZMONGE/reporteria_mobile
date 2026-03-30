import { NextResponse } from "next/server";
import { isAllowedAppRole } from "@/lib/auth/roles";
import { sanitizeListSearchQuery } from "@/lib/list-search.mjs";
import { parsePaginationParams } from "@/lib/pagination";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRegistrosPage } from "@/app/registros/data";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("user_profile")
    .select("user_id, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile?.user_id || !isAllowedAppRole(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const { offset, limit } = parsePaginationParams(url.searchParams);
  const query = sanitizeListSearchQuery(url.searchParams.get("query"));

  const page = await getRegistrosPage({
    supabase,
    profileUserId: profile.user_id,
    profileRole: profile.role,
    offset,
    limit,
    query,
  });

  return NextResponse.json(page);
}
