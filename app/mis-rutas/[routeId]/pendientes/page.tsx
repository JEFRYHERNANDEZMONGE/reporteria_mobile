import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import AppShell from "@/app/_components/app-shell";
import { logoutAction } from "@/app/home/actions";
import { isAllowedAppRole } from "@/lib/auth/roles";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRouteScrollableContentClassName } from "@/app/mis-rutas/route-scroll-layout.mjs";
import { resolveActiveLapso } from "@/lib/route-lapsos";
import { getZonaItemsPage } from "../zona-data";
import ZonaListView from "../zona-list-view";

const PROFILE_PHOTO_BUCKET = "profile-photos";

function getDisplayName(user: User | null) {
  if (!user) return "Juan Perez";

  const metadata = user.user_metadata ?? {};
  const fullName = metadata.full_name ?? metadata.name;
  if (typeof fullName === "string" && fullName.trim()) {
    return fullName.trim();
  }

  return user.email ?? "Usuario";
}

export default async function PendientesZonaPage({
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

  const { data: profile } = await supabase
    .from("user_profile")
    .select("user_id, role, photo_path")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile?.user_id || !isAllowedAppRole(profile.role)) {
    redirect("/mis-rutas");
  }

  let profilePhotoUrl: string | null = null;
  if (profile.photo_path) {
    const { data } = await supabase.storage
      .from(PROFILE_PHOTO_BUCKET)
      .createSignedUrl(profile.photo_path, 3600);
    profilePhotoUrl = data?.signedUrl ?? null;
  }

  const { data: routeRow } = await supabase
    .from("route")
    .select("route_id, nombre, assigned_user")
    .eq("route_id", routeIdNumber)
    .maybeSingle();

  if (
    !routeRow ||
    (profile.role === "rutero" && routeRow.assigned_user !== profile.user_id)
  ) {
    redirect("/mis-rutas");
  }

  const lapso = await resolveActiveLapso(supabase, {
    routeId: routeIdNumber,
    assignedUser: routeRow.assigned_user ?? null,
    profileUserId: profile.user_id,
    role: profile.role,
  });

  const { items: initialItems, hasMore: initialHasMore } = await getZonaItemsPage({
    supabase,
    routeId: routeIdNumber,
    lapsoUserId: lapso?.lapsoUserId ?? (routeRow.assigned_user ?? profile.user_id),
    lapsoId: lapso?.lapsoId ?? null,
    source: "pendientes",
    offset: 0,
    limit: DEFAULT_PAGE_SIZE,
  });

  return (
    <AppShell
      title={`Pendientes - ${routeRow.nombre}`}
      displayName={getDisplayName(user)}
      profilePhotoUrl={profilePhotoUrl}
      onLogout={logoutAction}
      contentClassName={getRouteScrollableContentClassName()}
    >
      <ZonaListView
        routeId={routeIdNumber}
        source="pendientes"
        initialItems={initialItems}
        initialHasMore={initialHasMore}
        pageSize={DEFAULT_PAGE_SIZE}
        emptyMessage={
          lapso
            ? "No hay establecimientos pendientes."
            : "No hay lapso activo para esta ruta."
        }
        backHref={`/mis-rutas/${routeIdNumber}`}
      />
    </AppShell>
  );
}
