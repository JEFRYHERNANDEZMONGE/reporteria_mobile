import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AppShell from "@/app/_components/app-shell";
import { logoutAction } from "@/app/home/actions";
import ProfileForm from "./profile-form";

const PROFILE_PHOTO_BUCKET = "profile-photos";

function getDefaultName(email: string | undefined, metadata: Record<string, unknown>) {
  const fullName = metadata.full_name ?? metadata.name;
  if (typeof fullName === "string" && fullName.trim()) {
    return fullName.trim();
  }

  if (email) {
    return email.split("@")[0] ?? "Usuario";
  }

  return "Usuario";
}

export default async function MiPerfilPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const menuDisplayName = getDefaultName(user.email, metadata);

  const { data: existingProfile } = await supabase
    .from("user_profile")
    .select("name, phone_num, photo_path")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  let profileName = existingProfile?.name ?? "";
  let profilePhone = existingProfile?.phone_num ?? "";
  let profilePhotoPath = existingProfile?.photo_path ?? null;

  if (!existingProfile) {
    const fallbackName = getDefaultName(user.email, metadata);

    const { data: createdProfile, error: createdProfileError } = await supabase
      .from("user_profile")
      .insert({
        auth_user_id: user.id,
        name: fallbackName,
        role: "visitante",
      })
      .select("name, phone_num, photo_path")
      .single();

    if (createdProfileError) {
      profileName = fallbackName;
      profilePhone = "";
    } else if (createdProfile) {
      profileName = createdProfile.name ?? fallbackName;
      profilePhone = createdProfile.phone_num ?? "";
      profilePhotoPath = createdProfile.photo_path ?? null;
    } else {
      profileName = fallbackName;
    }
  }

  let profilePhotoUrl: string | null = null;
  if (profilePhotoPath) {
    const { data } = await supabase.storage
      .from(PROFILE_PHOTO_BUCKET)
      .createSignedUrl(profilePhotoPath, 3600);
    profilePhotoUrl = data?.signedUrl ?? null;
  }

  return (
    <AppShell
      title="Mi perfil"
      displayName={menuDisplayName}
      profilePhotoUrl={profilePhotoUrl}
      onLogout={logoutAction}
      contentClassName="flex min-h-0 flex-1 w-full flex-col gap-4 pt-4"
    >
      <ProfileForm
        initialName={profileName}
        initialPhone={profilePhone}
        profilePhotoUrl={profilePhotoUrl}
      />
    </AppShell>
  );
}
