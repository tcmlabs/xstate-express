import express from "express";
import {
  EventObject,
  Machine,
  StateNode,
  StateNodeConfig,
  StateSchema,
  Typestate,
} from "xstate";
import { convertWithConditionalTransitions } from "../guards";
import { makeMachineHttpRouter } from "../server";

export const resolveToOK = () => {
  return Promise.resolve(true);
};

const takeYourTime = () => {
  return new Promise((resolve) => setTimeout(resolve, 50));
};

type LightBubbleMachineContext = {};

type LightBubbleMachineSchema = {
  states: {
    lit: {};
    unlit: {};
    broken: {};
  };
};

type LightBubbleMachineEvent = { type: "TOGGLE" } | { type: "BREAK" };

type LightBubbleMachineInitialState = StateNodeConfig<
  LightBubbleMachineContext,
  LightBubbleMachineSchema,
  LightBubbleMachineEvent
>;

type LightBubbleStateNode = StateNode<
  LightBubbleMachineContext,
  LightBubbleMachineSchema,
  LightBubbleMachineEvent
>;

export const makeLightBubbleMachine = (
  initialState: LightBubbleMachineInitialState["initial"] | undefined
): LightBubbleStateNode => {
  const lightBubbleMachine = Machine<
    LightBubbleMachineContext,
    LightBubbleMachineEvent
  >({
    id: "light-bubble-machine",
    initial: initialState,
    states: {
      unlit: convertWithConditionalTransitions<
        LightBubbleMachineContext,
        LightBubbleMachineSchema,
        LightBubbleMachineEvent
      >({
        on: {
          TOGGLE: [
            {
              cond: "resolveToOK",
              target: "lit",
            },
            { target: "unlit" },
          ],
          BREAK: [
            {
              cond: "resolveToOK",
              target: "broken",
            },
            { target: "broken" },
          ],
        },
      }),
      lit: convertWithConditionalTransitions<
        LightBubbleMachineContext,
        LightBubbleMachineSchema,
        LightBubbleMachineEvent
      >({
        on: {
          TOGGLE: [
            {
              cond: "resolveToOK",
              target: "unlit",
            },
            { target: "lit" },
          ],
          BREAK: [
            {
              cond: "resolveToOK",
              target: "broken",
            },
            { target: "broken" },
          ],
        },
      }),
      broken: {},
    },
  }).withConfig({
    services: {
      resolveToOK,
      takeYourTime,
    },
  });

  return lightBubbleMachine;
};

export const makeMachineHttpServer = <
  TContext,
  TStateSchema extends StateSchema,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext>
>(
  machine: StateNode<TContext, TStateSchema, TEvent, TTypestate>
) => {
  const app = express();

  let currentState = machine.initialState; // A global in-memory store

  const machineRouter = makeMachineHttpRouter<
    TContext,
    TEvent,
    TStateSchema,
    Typestate<TContext>
  >(
    (initialState) => makeLightBubbleMachine(initialState as any) as any, // TODO: improve type
    async () => currentState,
    async (state) => {
      currentState = state as any;
    }
  );

  app.use("/machine", machineRouter);

  return app;
};
