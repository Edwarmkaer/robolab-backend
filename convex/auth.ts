import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";

const MIN_PASSWORD = 8;

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        const email = String(params.email ?? "").trim().toLowerCase();
        const name = typeof params.name === "string" ? params.name.trim() : "";
        if (params.flow === "signUp" && name.length < 2) {
          throw new ConvexError("Escribe tu nombre.");
        }
        const profile: { email: string } & Record<string, string> = { email };
        if (name) profile.name = name;
        return profile;
      },
      validatePasswordRequirements(password) {
        if (password.length < MIN_PASSWORD) {
          throw new ConvexError(`La contraseña necesita al menos ${MIN_PASSWORD} caracteres.`);
        }
      },
    }),
  ],
});
