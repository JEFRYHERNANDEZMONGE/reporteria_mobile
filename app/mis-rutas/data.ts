import type { SupabaseClient } from "@supabase/supabase-js";
import type { AllowedAppRole } from "@/lib/auth/roles";
import { getLapsoProgress } from "@/lib/route-lapsos";
import type { RouteListItem } from "./types";

type Params = {
  supabase: SupabaseClient;
  profile: {
    userId: number;
    role: AllowedAppRole;
  };
  offset: number;
  limit: number;
};

export async function getMisRutasPage({
  supabase,
  profile,
  offset,
  limit,
}: Params): Promise<{ items: RouteListItem[]; hasMore: boolean }> {
  let routesQuery = supabase
    .from("route")
    .select("route_id, nombre")
    .eq("is_active", true)
    .order("route_id", { ascending: true })
    .range(offset, offset + limit);

  if (profile.role === "rutero") {
    routesQuery = routesQuery.eq("assigned_user", profile.userId);
  }

  const { data: routeRows } = await routesQuery;
  const rows = routeRows ?? [];
  const hasMore = rows.length > limit;
  const visibleRoutes = hasMore ? rows.slice(0, limit) : rows;

  const routeIds = visibleRoutes
    .map((route) => route.route_id)
    .filter((routeId): routeId is number => typeof routeId === "number");

  const establishmentCountByRoute = new Map<number, number>();
  const activeLapsoByRoute = new Map<
    number,
    { lapsoId: number; dayLabel: string; percent: number }
  >();

  if (routeIds.length > 0) {
    const { data: establishments } = await supabase
      .from("establishment")
      .select("route_id")
      .in("route_id", routeIds);

    for (const establishment of establishments ?? []) {
      const routeId = establishment.route_id;
      if (!routeId) continue;
      establishmentCountByRoute.set(
        routeId,
        (establishmentCountByRoute.get(routeId) ?? 0) + 1,
      );
    }
  }

  if (routeIds.length > 0) {
    let lapsoQuery = supabase
      .from("route_lapso")
      .select("lapso_id, route_id, user_id, start_at, end_at, status")
      .in("route_id", routeIds)
      .eq("status", "en_curso")
      .order("start_at", { ascending: false });

    if (profile.role === "rutero") {
      lapsoQuery = lapsoQuery.eq("user_id", profile.userId);
    }

    const { data: lapsos } = await lapsoQuery;

    for (const lapso of lapsos ?? []) {
      if (activeLapsoByRoute.has(lapso.route_id)) continue;
      const progress = getLapsoProgress(lapso.start_at, lapso.end_at);
      activeLapsoByRoute.set(lapso.route_id, {
        lapsoId: lapso.lapso_id,
        dayLabel: `Lapso activo | Dia ${progress.elapsedDay}/${progress.totalDays}`,
        percent: progress.percent,
      });
    }
  }

  const items: RouteListItem[] = visibleRoutes.map((route) => {
    const total = establishmentCountByRoute.get(route.route_id);
    const activeLapso = activeLapsoByRoute.get(route.route_id);
    return {
      id: route.route_id,
      name: route.nombre,
      supermarketsLabel:
        typeof total === "number" ? `${total} establecimientos` : "Ruta asignada",
      activeLapsoId: activeLapso?.lapsoId ?? null,
      lapsoLabel: activeLapso
        ? `${activeLapso.dayLabel} (${activeLapso.percent}%)`
        : null,
    };
  });

  return { items, hasMore };
}