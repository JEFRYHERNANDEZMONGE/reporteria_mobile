import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import AppShell from "@/app/_components/app-shell";
import { logoutAction } from "@/app/home/actions";
import { getLapsoProgress } from "@/lib/route-lapsos";
import { isAllowedAppRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MapMarker, RouteLapsoSummary } from "../types";
import ZonaMapaView from "./zona-mapa-view";

const PROFILE_PHOTO_BUCKET = "profile-photos";
const DEFAULT_CENTER = { lat: 19.4326, lng: -99.1332 };

function getDisplayName(user: User | null) {
  if (!user) return "Juan Perez";

  const metadata = user.user_metadata ?? {};
  const fullName = metadata.full_name ?? metadata.name;
  if (typeof fullName === "string" && fullName.trim()) {
    return fullName.trim();
  }

  return user.email ?? "Usuario";
}

function fallbackMarkers(routeId: number): MapMarker[] {
  const offset = (routeId % 7) * 0.01;
  return [
    {
      id: "fallback-1",
      lat: DEFAULT_CENTER.lat + 0.02 + offset,
      lng: DEFAULT_CENTER.lng - 0.03,
      label: "Punto 1",
    },
    {
      id: "fallback-2",
      lat: DEFAULT_CENTER.lat - 0.015,
      lng: DEFAULT_CENTER.lng + 0.025 + offset,
      label: "Punto 2",
    },
    {
      id: "fallback-3",
      lat: DEFAULT_CENTER.lat - 0.05,
      lng: DEFAULT_CENTER.lng - 0.005,
      label: "Punto 3",
    },
  ];
}

export default async function ZonaMapaPage({
  params,
}: {
  params: Promise<{ routeId: string }>;
}) {
  const { routeId } = await params;
  const routeIdNumber = Number(routeId);

  if (!Number.isFinite(routeIdNumber)) {
    redirect("/mis-rutas");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let profilePhotoUrl: string | null = null;
  let routeName = "Zona mapa";
  let markers: MapMarker[] = fallbackMarkers(routeIdNumber);
  let lapsoSummary: RouteLapsoSummary | null = null;
  let canStartRoute = false;

  const { data: profile } = await supabase
    .from("user_profile")
    .select("user_id, role, photo_path")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile?.user_id || !isAllowedAppRole(profile.role)) {
    redirect("/mis-rutas");
  }

  if (profile?.photo_path) {
    const { data } = await supabase.storage
      .from(PROFILE_PHOTO_BUCKET)
      .createSignedUrl(profile.photo_path, 3600);
    profilePhotoUrl = data?.signedUrl ?? null;
  }

  const { data: routeRow } = await supabase
    .from("route")
    .select("route_id, nombre, visit_period, assigned_user")
    .eq("route_id", routeIdNumber)
    .maybeSingle();

  if (!routeRow) {
    redirect("/mis-rutas");
  }

  routeName = routeRow.nombre;

  const profileUserId = profile.user_id;
  const lapsoUserIdForRoute = routeRow.assigned_user ?? profile.user_id;

  if (
    profile?.role === "rutero" &&
    profileUserId !== routeRow.assigned_user
  ) {
    redirect("/mis-rutas");
  }

  canStartRoute =
    !!routeRow.assigned_user &&
    !!profile.role &&
    (profile.role === "admin" || profileUserId === routeRow.assigned_user);

  const { data: currentLapso } = await supabase
    .from("route_lapso")
    .select("lapso_id, route_id, user_id, status, start_at, end_at, duration_days")
    .eq("route_id", routeIdNumber)
    .eq("user_id", lapsoUserIdForRoute)
    .eq("status", "en_curso")
    .order("start_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (currentLapso) {
    const progress = getLapsoProgress(currentLapso.start_at, currentLapso.end_at);
    lapsoSummary = {
      lapsoId: currentLapso.lapso_id,
      routeId: currentLapso.route_id,
      userId: currentLapso.user_id,
      status: currentLapso.status,
      startAt: currentLapso.start_at,
      endAt: currentLapso.end_at,
      durationDays: currentLapso.duration_days,
      dayLabel: `Dia ${progress.elapsedDay}/${progress.totalDays}`,
      progressPercent: progress.percent,
    };
  }

  const { data: establishments } = await supabase
    .from("establishment")
    .select("establishment_id, name, lat, long")
    .eq("route_id", routeIdNumber)
    .not("lat", "is", null)
    .not("long", "is", null);

  const dbMarkers = (establishments ?? [])
    .map((establishment) => {
      const lat = Number(establishment.lat);
      const lng = Number(establishment.long);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return {
        id: `est-${establishment.establishment_id}`,
        lat,
        lng,
        label: establishment.name,
      } satisfies MapMarker;
    })
    .filter((marker): marker is MapMarker => marker !== null);

  if (dbMarkers.length > 0) {
    markers = dbMarkers;
  }

  return (
    <AppShell
      title="Zona mapa"
      displayName={getDisplayName(user)}
      profilePhotoUrl={profilePhotoUrl}
      onLogout={logoutAction}
      contentClassName="flex min-h-0 flex-1 w-full flex-col gap-4 pt-4"
    >
      <ZonaMapaView
        routeId={routeIdNumber}
        routeName={routeName}
        markers={markers}
        lapso={lapsoSummary}
        canStartRoute={canStartRoute}
      />
    </AppShell>
  );
}
