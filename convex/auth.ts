import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { normalizeEmail } from "../domain/auth/email";
import { passwordProblem } from "../domain/auth/password";
import { PasswordResetEmail } from "./passwordReset";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        const email = normalizeEmail(String(params.email ?? ""));
        const name = typeof params.name === "string" ? params.name.trim().replace(/\s+/g, " ") : "";
        if (params.flow === "signUp" && name.length < 2) {
          throw new ConvexError("Escribe tu nombre.");
        }
        const profile: { email: string } & Record<string, string> = { email };
        if (name) profile.name = name;
        return profile;
      },
      // Las mismas reglas que muestra el formulario mientras se escribe.
      validatePasswordRequirements(password) {
        const problem = passwordProblem(password);
        if (problem) throw new ConvexError(problem);
      },
      reset: PasswordResetEmail,
    }),
  ],
});
