"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  forgotPasswordAction,
} from "./actions";

const initialForgotPasswordActionState = {
  error: null,
  success: false,
  email: "",
};

function ForgotPasswordSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="h-[44px] w-full cursor-pointer rounded-[12px] border-0 bg-[#0D3233] text-[14px] leading-none font-normal text-white transition-all duration-150 ease-out hover:-translate-y-px hover:bg-[#0B2B2C] active:translate-y-px active:bg-[#082122] disabled:cursor-not-allowed disabled:opacity-70"
      type="submit"
      disabled={pending}
    >
      {pending ? "Enviando..." : "Enviar enlace"}
    </button>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" width="48" height="48" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="24" fill="#D9E7D8" />
      <path
        d="m15 24.5 6 6 12-13"
        stroke="#0D3233"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ForgotPasswordPage() {
  const [state, formAction] = useActionState(
    forgotPasswordAction,
    initialForgotPasswordActionState,
  );

  return (
    <main className="flex h-dvh w-full items-center justify-center overflow-hidden bg-[#E9EDE9]">
      <section className="flex h-dvh w-full items-center justify-center overflow-hidden bg-[#E9EDE9] p-[25px] pb-[calc(25px+env(safe-area-inset-bottom))] pt-[calc(25px+env(safe-area-inset-top))]">
        <div className="flex w-full max-w-[360px] flex-col gap-4">
          {state.success ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <CheckIcon />
              <div className="flex flex-col gap-2">
                <h1 className="m-0 text-[24px] leading-none font-normal text-[#0D3233]">
                  Revisa tu correo
                </h1>
                <p className="m-0 text-[14px] leading-[1.5] font-normal text-[#405C62]">
                  Si el correo es valido, te enviamos un enlace para restablecer tu contrasena.
                </p>
              </div>
              <Link
                href="/login"
                className="text-[12px] leading-none font-normal text-[#405C62] underline underline-offset-2"
              >
                Volver al inicio de sesion
              </Link>
            </div>
          ) : (
            <form className="flex w-full flex-col gap-4" action={formAction}>
              <div className="flex flex-col gap-2">
                <h1 className="m-0 text-[24px] leading-none font-normal text-[#0D3233]">
                  Recuperar contrasena
                </h1>
                <p className="m-0 text-[14px] leading-[1.5] font-normal text-[#405C62]">
                  Ingresa tu correo y te enviaremos instrucciones para restablecer tu acceso.
                </p>
              </div>

              <div className="flex w-full flex-col gap-[6px]">
                <label
                  className="m-0 text-[12px] leading-none font-normal text-[#405C62]"
                  htmlFor="email"
                >
                  Correo
                </label>
                <input
                  className="h-[44px] w-full rounded-[12px] border border-[#B3B5B3] bg-white px-3 text-[14px] leading-none font-normal text-[#0D3233] outline-none placeholder:text-[#8A9BA7]"
                  id="email"
                  name="email"
                  type="email"
                  placeholder="usuario@empresa.com"
                  autoComplete="email"
                  defaultValue={state.email}
                  required
                />
              </div>

              {state.error ? (
                <p className="m-0 text-[12px] leading-[1.3] font-normal text-[#B42318]">
                  {state.error}
                </p>
              ) : null}

              <ForgotPasswordSubmitButton />
              <Link
                href="/login"
                className="text-center text-[12px] leading-none font-normal text-[#405C62] underline underline-offset-2"
              >
                Volver al inicio de sesion
              </Link>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
