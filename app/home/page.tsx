import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AppShell from "@/app/_components/app-shell";
import { logoutAction } from "./actions";
import Image from "next/image";
import Link from "next/link";

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

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let profilePhotoUrl: string | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from("user_profile")
      .select("photo_path")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (profile?.photo_path) {
      const { data } = await supabase.storage
        .from(PROFILE_PHOTO_BUCKET)
        .createSignedUrl(profile.photo_path, 3600);
      profilePhotoUrl = data?.signedUrl ?? null;
    }
  }

  return (
    <AppShell
      title="Inicio"
      displayName={getDisplayName(user)}
      profilePhotoUrl={profilePhotoUrl}
      onLogout={logoutAction}
      contentClassName="flex min-h-0 flex-1 w-full flex-col gap-[49px] pt-4"
    >
      <div className="flex w-full justify-center">
        <Image
          src="/logo.png"
          alt="Logo Reporteria"
          width={120}
          height={120}
          className="h-[120px] w-[120px] object-contain"
          priority
        />
      </div>

      <nav className="flex h-[314px] w-full flex-col gap-5">
        <Link
          href="/mis-tareas"
          className="flex h-[70px] w-full items-center justify-center rounded-[12px] bg-[#0D3233] text-[24px] leading-none font-normal text-white shadow-[0_2px_8px_0_#0D32330F] transition-all duration-150 ease-out hover:-translate-y-px hover:bg-[#0B2B2C] active:translate-y-px active:bg-[#082122]"
        >
          Mis tareas
        </Link>
        <Link
          href="/mis-rutas"
          className="flex h-[70px] w-full items-center justify-center rounded-[12px] bg-[#0D3233] text-[24px] leading-none font-normal text-white shadow-[0_2px_8px_0_#0D32330F] transition-all duration-150 ease-out hover:-translate-y-px hover:bg-[#0B2B2C] active:translate-y-px active:bg-[#082122]"
        >
          Mis rutas
        </Link>
        <Link
          href="/registros"
          className="flex h-[70px] w-full items-center justify-center rounded-[12px] bg-[#0D3233] text-[24px] leading-none font-normal text-white shadow-[0_2px_8px_0_#0D32330F] transition-all duration-150 ease-out hover:-translate-y-px hover:bg-[#0B2B2C] active:translate-y-px active:bg-[#082122]"
        >
          Registros
        </Link>
      </nav>

      <div className="flex w-full flex-1" />

      <div className="flex w-full items-center justify-center py-[10px]">
        <Link
          href="/registros/nuevo?source=home"
          className="flex h-20 w-20 items-center justify-center rounded-[28px] border-0 bg-[#7C8745] text-[36px] leading-none font-normal text-white transition-transform duration-150 ease-out hover:-translate-y-px active:translate-y-px"
          aria-label="Nueva accion"
        >
          +
        </Link>
      </div>
    </AppShell>
  );
}
