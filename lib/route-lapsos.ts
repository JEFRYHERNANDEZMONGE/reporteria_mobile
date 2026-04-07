export type RouteLapsoStatus = "en_curso" | "completado" | "incompleto" | "vencido";

export type ResolvedLapso = {
  lapsoId: number;
  lapsoUserId: number;
};

/**
 * Finds the active lapso for a route.
 * For admin/editor: first tries the assigned user, then falls back to any active lapso
 * for the route (same logic used when creating records).
 * For rutero: only returns the lapso belonging to that user.
 */
export async function resolveActiveLapso(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  params: {
    routeId: number;
    assignedUser: number | null;
    profileUserId: number;
    role: string;
  },
): Promise<ResolvedLapso | null> {
  const { routeId, assignedUser, profileUserId, role } = params;

  if (role === "rutero") {
    const { data } = await supabase
      .from("route_lapso")
      .select("lapso_id, user_id")
      .eq("route_id", routeId)
      .eq("user_id", profileUserId)
      .eq("status", "en_curso")
      .order("start_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    return { lapsoId: data.lapso_id, lapsoUserId: data.user_id };
  }

  // admin / editor: try assigned user first, then any active lapso for the route
  const candidateUserId = assignedUser ?? null;

  let query = supabase
    .from("route_lapso")
    .select("lapso_id, user_id")
    .eq("route_id", routeId)
    .eq("status", "en_curso")
    .order("start_at", { ascending: false })
    .limit(1);

  if (typeof candidateUserId === "number") {
    query = query.eq("user_id", candidateUserId);
  }

  let { data } = await query.maybeSingle();

  if (!data && typeof candidateUserId === "number") {
    // fallback: any active lapso for the route (admin created it under a different user)
    const { data: fallback } = await supabase
      .from("route_lapso")
      .select("lapso_id, user_id")
      .eq("route_id", routeId)
      .eq("status", "en_curso")
      .order("start_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    data = fallback ?? null;
  }

  if (!data) return null;
  return { lapsoId: data.lapso_id, lapsoUserId: data.user_id };
}

export function getDurationDaysFromVisitPeriod(visitPeriod: string | null | undefined) {
  if (!visitPeriod) return 7;

  const match = visitPeriod.match(/\d+/);
  if (!match) return 7;

  const parsed = Number(match[0]);
  if (!Number.isFinite(parsed) || parsed < 1) return 7;
  return Math.floor(parsed);
}

export function getLapsoProgress(
  startAt: string,
  endAt: string,
  nowDate: Date = new Date(),
) {
  const start = new Date(startAt);
  const end = new Date(endAt);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return {
      elapsedDay: 1,
      totalDays: 1,
      percent: 0,
    };
  }

  const totalMs = end.getTime() - start.getTime();
  const elapsedMsRaw = nowDate.getTime() - start.getTime();
  const elapsedMs = Math.min(Math.max(elapsedMsRaw, 0), totalMs);

  const totalDays = Math.max(1, Math.ceil(totalMs / (1000 * 60 * 60 * 24)));
  const elapsedDay = Math.min(
    totalDays,
    Math.max(1, Math.floor(elapsedMs / (1000 * 60 * 60 * 24)) + 1),
  );
  const percent = Math.round((elapsedMs / totalMs) * 100);

  return { elapsedDay, totalDays, percent };
}
