"use client";

import { Gamepad2, Globe, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SignInProps {
  onSignIn: () => void;
  signingIn: boolean;
  onOpenProfiles: () => void;
}

export function SignIn({ onSignIn, signingIn, onOpenProfiles }: SignInProps) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#07101f] p-6 text-slate-100">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[.045] p-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 shadow-[0_0_32px_rgba(139,92,246,.3)]">
          <Gamepad2 className="size-8" />
        </div>
        <h1 className="text-3xl font-black tracking-tight">Mi Bóveda Gamer</h1>
        <p className="mt-3 leading-7 text-slate-400">
          Inicia sesión para acceder a tu colección. Tus juegos y tu progreso se guardan de forma privada en Google Cloud.
        </p>
        <Button
          className="mt-7 w-full bg-violet-500 text-white hover:bg-violet-400"
          onClick={onSignIn}
          disabled={signingIn}
        >
          <LogIn />
          {signingIn ? "Conectando con Google…" : "Continuar con Google"}
        </Button>
        <div className="mt-6 border-t border-white/10 pt-6 text-center">
          <p className="text-xs text-slate-400">
            ¿Quieres ver la colección compartida de un amigo o consultar un perfil?
          </p>
          <Button
            variant="outline"
            className="mt-3 w-full border-cyan-400/30 bg-cyan-500/5 text-cyan-300 hover:bg-cyan-500/15"
            onClick={onOpenProfiles}
          >
            <Globe className="mr-2 size-4 text-cyan-300" />
            Ver perfiles públicos
          </Button>
        </div>
      </div>
    </main>
  );
}

export function SetupNotice() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#07101f] p-6 text-slate-100">
      <div className="max-w-lg rounded-3xl border border-amber-400/20 bg-amber-400/5 p-8">
        <h1 className="text-2xl font-black">Falta conectar Google Cloud</h1>
        <p className="mt-3 leading-7 text-slate-300">
          La aplicación está lista. Añade la configuración pública de Firebase para activar el inicio de sesión y la base de datos.
        </p>
      </div>
    </main>
  );
}
