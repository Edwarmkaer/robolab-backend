import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { move, repeat } from "../src/domain/game/program";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const F = move("FORWARD");
const PROGRAM = [F, F, move("TURN_RIGHT"), repeat(2, [F])];

async function withRobot() {
  const t = convexTest(schema, modules);
  const robot = await t.mutation(internal.robot.register, { name: "Kusi" });
  const poll = (key = robot.key) => t.fetch(`/robot/siguiente?codigo=${robot.code}&clave=${key}`);
  return { t, robot, poll };
}

describe("robot por wifi", () => {
  it("se registra con un código para la app y una clave para el firmware", async () => {
    const { robot } = await withRobot();
    expect(robot.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(robot.key).toMatch(/^[0-9a-f]{32}$/);
  });

  it("la app envía el programa y el robot lo recoge como letras", async () => {
    const { t, robot, poll } = await withRobot();
    const sent = await t.mutation(api.robot.send, { code: robot.code.toLowerCase(), program: PROGRAM });
    expect(sent).toMatchObject({ letters: "AADAA", robotName: "Kusi" });

    const first = await poll();
    expect(first.status).toBe(200);
    expect((await first.text()).trim()).toBe("AADAA");
    expect((await poll()).status).toBe(204); // ya no queda nada pendiente

    expect(await t.query(api.robot.status, { code: robot.code })).toMatchObject({ name: "Kusi", lastCommand: { status: "sent" } });
    const done = await t.fetch(`/robot/hecho?codigo=${robot.code}&clave=${robot.key}`, { method: "POST" });
    expect(done.status).toBe(200);
    const status = await t.query(api.robot.status, { code: robot.code });
    expect(status).toMatchObject({ lastCommand: { status: "done", letters: "AADAA" } });
    expect(status?.lastSeenAt).toBeGreaterThan(0);
  });

  it("si se envían dos programas seguidos, el robot hace solo el último", async () => {
    const { t, robot, poll } = await withRobot();
    await t.mutation(api.robot.send, { code: robot.code, program: [F] });
    await t.mutation(api.robot.send, { code: robot.code, program: PROGRAM });
    expect((await (await poll()).text()).trim()).toBe("AADAA");
    expect((await poll()).status).toBe(204);
  });

  it("sin la clave correcta el robot no recibe nada", async () => {
    const { t, robot, poll } = await withRobot();
    await t.mutation(api.robot.send, { code: robot.code, program: PROGRAM });
    expect((await poll("0".repeat(32))).status).toBe(401);
    expect((await t.fetch(`/robot/siguiente?codigo=${robot.code}`)).status).toBe(401);
    expect((await poll()).status).toBe(200); // el programa sigue esperando a su robot
  });

  it("avisa si el código no existe o el programa está vacío", async () => {
    const { t, robot } = await withRobot();
    await expect(t.mutation(api.robot.send, { code: "ZZZZZZ", program: PROGRAM })).rejects.toThrow(/No encontramos/);
    await expect(t.mutation(api.robot.send, { code: robot.code, program: [] })).rejects.toThrow(/vacío/);
    expect(await t.query(api.robot.status, { code: "ZZZZZZ" })).toBeNull();
  });
});
