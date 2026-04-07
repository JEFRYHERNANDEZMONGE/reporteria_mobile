import { NextResponse } from "next/server";
import { isAllowedAppRole } from "@/lib/auth/roles";
import { sanitizeListSearchQuery } from "@/lib/list-search.mjs";
import { parsePaginationParams } from "@/lib/pagination";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveActiveLapso } from "@/lib/route-lapsos";
import { getZonaItemsPage } from "@/app/mis-rutas/[routeId]/zona-data";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ routeId: string }> },
) {
  const { routeId } = await params;
  const routeIdNumber = Number(routeId);

  if (!Number.isFinite(routeIdNumber)) {
    return NextResponse.json({ error: "Invalid route" }, { status: 400 });
  }

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

  const { data: routeRow } = await supabase
    .from("route")
    .select("route_id, assigned_user")
    .eq("route_id", routeIdNumber)
    .maybeSingle();

  if (
    !routeRow ||
    (profile.role === "rutero" && routeRow.assigned_user !== profile.user_id)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const lapso = await resolveActiveLapso(supabase, {
    routeId: routeIdNumber,
    assignedUser: routeRow.assigned_user ?? null,
    profileUserId: profile.user_id,
    role: profile.role,
  });

  const url = new URL(request.url);
  const { offset, limit } = parsePaginationParams(url.searchParams);
  const query = sanitizeListSearchQuery(url.searchParams.get("query"));

  const page = await getZonaItemsPage({
    supabase,
    routeId: routeIdNumber,
    lapsoUserId: lapso?.lapsoUserId ?? (routeRow.assigned_user ?? profile.user_id),
    lapsoId: lapso?.lapsoId ?? null,
    source: "completadas",
    offset,
    limit,
    query,
  });

  return NextResponse.json(page);
}
