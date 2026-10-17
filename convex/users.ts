import { query } from "./_generated/server";
import { requireTeacher } from "./lib/access";

/** Datos del docente que inició sesión, para saludarlo por su nombre. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireTeacher(ctx);
    const user = await ctx.db.get(userId);
    return { name: user?.name ?? "", email: user?.email ?? "" };
  },
});
