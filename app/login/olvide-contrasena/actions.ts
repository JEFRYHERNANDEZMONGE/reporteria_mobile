"use server";

import { getSiteUrl } from "@/app/auth/auth-flow.mjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createForgotPasswordSuccessState } from "../forgot-password-state.mjs";

export type ForgotPasswordActionState = {
  error: string | null;
  success: boolean;
  email: string;
};

export async function forgotPasswordAction(
  _prevState: ForgotPasswordActionState,
  formData: FormData,
): Promise<ForgotPasswordActionState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email) {
    return {
      error: "Debes ingresar un correo.",
      success: false,
      email,
    };
  }

  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${getSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)}/auth/callback?type=recovery`,
      });
    }
  } catch {
    // Intentionally swallow auth reset errors to avoid exposing account existence.
  }

  return createForgotPasswordSuccessState(email);
}
