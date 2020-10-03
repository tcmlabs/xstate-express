import request from "supertest";
import {
  makeLightBubbleMachine,
  makeMachineHttpServer,
} from "./examples/lightBubbleMachine";
import * as Foo from "./examples/lightBubbleMachine";
import { makeMachineHttpRouter } from "./server";

describe("State machine server", () => {
  describe("when introspecting a machine", () => {
    it("should expose business transition routes", () => {
      const machine = makeLightBubbleMachine("lit");

      const router = makeMachineHttpRouter(
        makeLightBubbleMachine as any,
        async () => machine.initialState,
        async (state) => {
          machine.resolveState(state);
        }
      );

      expect(router.stack.length).toBe(2);
    });
  });

  it("should break the light bubble", async () => {
    const machine = makeLightBubbleMachine("lit");
    const app = makeMachineHttpServer(machine);
    const spy = jest.spyOn(Foo, "resolveToOK");

    const res = await request(app).get("/machine/break");

    expect(spy).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ nextState: "broken" });
  });

  it("should not switch the light on a broken bubble", async () => {
    const spy = jest.spyOn(Foo, "resolveToOK");
    const machine = makeLightBubbleMachine("broken");
    const app = makeMachineHttpServer(machine);

    const res = await request(app).get("/machine/toggle");

    expect(spy).toHaveBeenCalledTimes(0);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ nextState: "broken" });
  });

  it("should remain broken when broken", async () => {
    const machine = makeLightBubbleMachine("broken");
    const app = makeMachineHttpServer(machine);
    const spy = jest.spyOn(Foo, "resolveToOK");

    const res = await request(app).get("/machine/break");
    expect(spy).toHaveBeenCalledTimes(0);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ nextState: "broken" });
  });

  it.skip("should switch the light on and off", async () => {
    console.log("----------");
    const machine = makeLightBubbleMachine("lit");
    const app = makeMachineHttpServer(machine);
    const spy = jest.spyOn(Foo, "resolveToOK");

    expect(spy).toHaveBeenCalledTimes(0);

    const res1 = await request(app).get("/machine/toggle");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(res1.status).toBe(200);
    expect(res1.body).toEqual({ nextState: "unlit" });

    const res2 = await request(app).get("/machine/toggle");
    expect(spy).toHaveBeenCalledTimes(2);
    expect(res2.status).toBe(200);
    expect(res2.body).toEqual({ nextState: "lit" });

    const res3 = await request(app).get("/machine/toggle");
    expect(spy).toHaveBeenCalledTimes(3);
    expect(res3.status).toBe(200);
    expect(res3.body).toEqual({ nextState: "unlit" });
  });
});
