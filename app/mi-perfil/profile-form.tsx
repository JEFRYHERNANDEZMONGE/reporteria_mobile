"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  removeProfilePhotoAction,
  type ProfileActionState,
  updateProfileAction,
  uploadProfilePhotoAction,
} from "./actions";
import { useRouter } from "next/navigation";

type ProfileFormProps = {
  initialName: string;
  initialPhone: string;
  profilePhotoUrl: string | null;
};

const initialProfileState: ProfileActionState = {
  error: null,
  success: false,
};

const AVATAR_COLORS = ["#7C8745", "#0D3233", "#405C62", "#5A7984", "#8A9BA7"];
const PROFILE_IMAGE_SIZE = 256;

async function compressProfilePhoto(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = Math.floor((bitmap.width - side) / 2);
  const sy = Math.floor((bitmap.height - side) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = PROFILE_IMAGE_SIZE;
  canvas.height = PROFILE_IMAGE_SIZE;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("No se pudo procesar la imagen.");
  }

  context.drawImage(
    bitmap,
    sx,
    sy,
    side,
    side,
    0,
    0,
    PROFILE_IMAGE_SIZE,
    PROFILE_IMAGE_SIZE,
  );
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", 0.82);
  });

  if (!blob) {
    throw new Error("No se pudo comprimir la imagen.");
  }

  const baseName = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}.webp`, { type: "image/webp" });
}

function getInitial(name: string) {
  const clean = name.trim();
  if (!clean) return "U";
  return clean.charAt(0).toUpperCase();
}

function getAvatarColor(name: string) {
  const clean = name.trim();
  if (!clean) return AVATAR_COLORS[0];
  const total = clean.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_COLORS[total % AVATAR_COLORS.length];
}

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="h-[44px] w-full rounded-[12px] border-0 bg-[#0D3233] text-[16px] leading-none font-normal text-white disabled:opacity-70"
    >
      {pending ? "Guardando..." : "Guardar"}
    </button>
  );
}

export default function ProfileForm({
  initialName,
  initialPhone,
  profilePhotoUrl,
}: ProfileFormProps) {
  const router = useRouter();
  const [isPhotoPending, startPhotoTransition] = useTransition();
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [state, formAction] = useActionState(updateProfileAction, initialProfileState);

  const handleUploadPhoto = async (file: File) => {
    try {
      setPhotoError(null);
      setPhotoMessage(null);

      const compressedFile = await compressProfilePhoto(file);
      const payload = new FormData();
      payload.append("profilePhoto", compressedFile);

      startPhotoTransition(() => {
        void uploadProfilePhotoAction(initialProfileState, payload).then((result) => {
          if (result.error) {
            setPhotoError(result.error);
            return;
          }

          setPhotoMessage("Foto actualizada.");
          router.refresh();
        });
      });
    } catch {
      setPhotoError("No se pudo comprimir la imagen seleccionada.");
    }
  };

  const handleRemovePhoto = () => {
    setPhotoError(null);
    setPhotoMessage(null);

    startPhotoTransition(() => {
      void removeProfilePhotoAction().then((result) => {
        if (result.error) {
          setPhotoError(result.error);
          return;
        }

        setPhotoMessage("Foto eliminada.");
        router.refresh();
      });
    });
  };

  return (
    <form className="flex h-full w-full flex-col gap-[15px]" action={formAction}>
      <div className="flex w-full items-center gap-3">
        <label
          htmlFor="profilePhoto"
          className="relative flex h-[88px] w-[88px] cursor-pointer items-center justify-center overflow-hidden rounded-[12px] border border-[#B3B5B3] bg-white"
        >
          {profilePhotoUrl ? (
            <Image
              src={profilePhotoUrl}
              alt="Foto de perfil"
              fill
              sizes="88px"
              loading="eager"
              className="object-cover"
            />
          ) : (
            <span
              className="flex h-full w-full items-center justify-center text-[30px] leading-none font-semibold text-white"
              style={{ backgroundColor: getAvatarColor(initialName) }}
            >
              {getInitial(initialName)}
            </span>
          )}
        </label>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="profilePhoto"
            className="cursor-pointer text-[15px] leading-none font-normal text-[#7C8745]"
          >
            {isPhotoPending ? "Procesando foto..." : profilePhotoUrl ? "Cambiar foto" : "Agregar foto"}
          </label>
          {profilePhotoUrl ? (
            <button
              type="button"
              disabled={isPhotoPending}
              onClick={handleRemovePhoto}
              className="w-fit border-0 bg-transparent p-0 text-[14px] leading-none font-normal text-[#5A7984] underline disabled:opacity-50"
            >
              Quitar foto
            </button>
          ) : (
            <p className="m-0 text-[14px] leading-none font-normal text-[#5A7984]">
              Sin foto cargada
            </p>
          )}
        </div>
        <input
          id="profilePhoto"
          name="profilePhoto"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            void handleUploadPhoto(file);
            event.currentTarget.value = "";
          }}
          className="hidden"
          disabled={isPhotoPending}
        />
      </div>
      {photoError ? (
        <p className="m-0 text-[14px] leading-[1.3] font-normal text-[#B42318]">
          {photoError}
        </p>
      ) : null}
      {photoMessage ? (
        <p className="m-0 text-[14px] leading-[1.3] font-normal text-[#0D3233]">
          {photoMessage}
        </p>
      ) : null}

      <div className="flex w-full flex-col gap-[6px]">
        <label
          htmlFor="name"
          className="m-0 text-[14px] leading-none font-normal text-[#405C62]"
        >
          Nombre
        </label>
        <input
          id="name"
          name="name"
          type="text"
          defaultValue={initialName}
          className="h-[44px] w-full rounded-[12px] border border-[#B3B5B3] bg-white px-3 text-[16px] leading-none font-normal text-[#0D3233] outline-none"
          required
        />
      </div>

      <div className="flex w-full flex-col gap-[6px]">
        <label
          htmlFor="phone"
          className="m-0 text-[14px] leading-none font-normal text-[#405C62]"
        >
          Telefono
        </label>
        <input
          id="phone"
          name="phone"
          type="text"
          defaultValue={initialPhone}
          className="h-[44px] w-full rounded-[12px] border border-[#B3B5B3] bg-white px-3 text-[16px] leading-none font-normal text-[#0D3233] outline-none"
        />
      </div>

      <p className="m-0 text-[16px] leading-none font-normal text-[#0D3233]">
        Cambiar contrasena
      </p>

      <div className="flex w-full flex-col gap-[6px]">
        <label
          htmlFor="currentPassword"
          className="m-0 text-[14px] leading-none font-normal text-[#405C62]"
        >
          Contrasena actual
        </label>
        <div className="relative">
          <input
            id="currentPassword"
            name="currentPassword"
            type={showCurrentPassword ? "text" : "password"}
            placeholder="********"
            className="h-[44px] w-full rounded-[12px] border border-[#B3B5B3] bg-white pl-3 pr-10 text-[14px] leading-none font-normal text-[#0D3233] outline-none placeholder:text-[#8A9BA7]"
          />
          <button
            type="button"
            onClick={() => setShowCurrentPassword((prev) => !prev)}
            aria-label={showCurrentPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
            className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-0 text-[#8A9BA7]"
          >
            {showCurrentPassword ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div className="flex w-full flex-col gap-[6px]">
        <label
          htmlFor="newPassword"
          className="m-0 text-[14px] leading-none font-normal text-[#405C62]"
        >
          Nueva contrasena
        </label>
        <div className="relative">
          <input
            id="newPassword"
            name="newPassword"
            type={showNewPassword ? "text" : "password"}
            placeholder="********"
            className="h-[44px] w-full rounded-[12px] border border-[#B3B5B3] bg-white pl-3 pr-10 text-[14px] leading-none font-normal text-[#0D3233] outline-none placeholder:text-[#8A9BA7]"
          />
          <button
            type="button"
            onClick={() => setShowNewPassword((prev) => !prev)}
            aria-label={showNewPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
            className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-0 text-[#8A9BA7]"
          >
            {showNewPassword ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div className="flex w-full flex-col gap-[6px]">
        <label
          htmlFor="confirmPassword"
          className="m-0 text-[14px] leading-none font-normal text-[#405C62]"
        >
          Confirmar contrasena
        </label>
        <div className="relative">
          <input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            placeholder="********"
            className="h-[44px] w-full rounded-[12px] border border-[#B3B5B3] bg-white pl-3 pr-10 text-[14px] leading-none font-normal text-[#0D3233] outline-none placeholder:text-[#8A9BA7]"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((prev) => !prev)}
            aria-label={showConfirmPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
            className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-0 text-[#8A9BA7]"
          >
            {showConfirmPassword ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {state.error ? (
        <p className="m-0 text-[14px] leading-[1.3] font-normal text-[#B42318]">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="m-0 text-[14px] leading-[1.3] font-normal text-[#0D3233]">
          Perfil actualizado.
        </p>
      ) : null}

      <div className="flex w-full flex-1" />

      <div className="flex h-[44px] w-full gap-3">
        <Link
          href="/home"
          className="flex h-[44px] w-full items-center justify-center rounded-[12px] border border-[#8A9BA7] bg-white text-[16px] leading-none font-normal text-[#0D3233] shadow-[0_2px_8px_0_#0D32330F]"
        >
          Volver
        </Link>
        <SaveButton />
      </div>
    </form>
  );
}
