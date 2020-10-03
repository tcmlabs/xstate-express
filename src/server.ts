import express, { Request, Response, Router } from "express";
import {
  EventObject,
  interpret,
  State,
  StateNode,
  StateNodeConfig,
  StateSchema,
  StateValue,
  Typestate,
} from "xstate";

type MachineFactory<
  TContext,
  TStateSchema extends StateSchema,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext>
> = (
  state: StateNodeConfig<TContext, TStateSchema, TEvent>["initial"] | StateValue
) => StateNode<TContext, TStateSchema, TEvent, TTypestate>;

type StateLoader<
  TContext,
  TEvent extends EventObject = EventObject,
  TStateSchema extends StateSchema<TContext> = any,
  TTypestate extends Typestate<TContext> = {
    value: any;
    context: TContext;
  }
> = () => Promise<State<TContext, TEvent, TStateSchema, TTypestate>>;

type StateSaver<
  TContext,
  TEvent extends EventObject = EventObject,
  TStateSchema extends StateSchema<TContext> = any,
  TTypestate extends Typestate<TContext> = {
    value: any;
    context: TContext;
  }
> = (state: State<TContext, TEvent, TStateSchema, TTypestate>) => Promise<void>;

const extractStateKey = (stateValue: StateValue): string => {
  return typeof stateValue === "string"
    ? stateValue
    : Object.keys(stateValue)[0];
};

const extractStateValue = (stateValue: StateValue) => {
  return typeof stateValue === "string"
    ? stateValue
    : Object.values(stateValue)[0];
};

export const makeMachineHttpRouter = <
  TContext,
  TEvent extends EventObject = EventObject,
  TStateSchema extends StateSchema<TContext> = any,
  TTypestate extends Typestate<TContext> = {
    value: any;
    context: TContext;
  }
>(
  machineFactory: MachineFactory<TContext, TStateSchema, TEvent, TTypestate>,
  loadCurrentState: StateLoader<TContext, TEvent, TStateSchema, TTypestate>,
  saveNextState: StateSaver<TContext, TEvent, TStateSchema, TTypestate>
): Router => {
  const machineEvents = machineFactory(undefined).events.filter(
    (event: string) => event.toUpperCase() === event
  );

  const router = express.Router();

  const machineRouter = machineEvents.reduce(
    (accRouter: Router, eventName: string) => {
      accRouter.get(`/${eventName}`, async (_req: Request, res: Response) => {
        const currentState = await loadCurrentState(); // TODO: load context ?

        const machineState = extractStateKey(currentState.value);
        const httpMachine = machineFactory(machineState);

        const machineInterpreter = makeHttpInterpreter(
          httpMachine,
          saveNextState,
          res
        ).start();

        machineInterpreter.send(eventName);
      });
      return accRouter;
    },
    router
  );

  return machineRouter;
};

const makeHttpInterpreter = <
  TContext,
  TStateSchema extends StateSchema<TContext>,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext>
>(
  httpMachine: StateNode<TContext, TStateSchema, TEvent, TTypestate>,
  saveNextState: StateSaver<TContext, TEvent, TStateSchema, TTypestate>,
  res: express.Response
) => {
  return interpret(httpMachine).onTransition(async (state) => {
    const unpacked = extractStateValue(state.value);

    console.log(state.changed, state.value, unpacked);

    if (state.changed === false) {
      res.status(409).json({ nextState: state.value });
      return;
    }

    if (state.changed && !unpacked.toString().startsWith("internal_")) {
      try {
        await saveNextState(state);

        res.json({ nextState: extractStateKey(state.value) });
        return;
      } catch (e) {
        res.status(500).json();
        return;
      }
    }
  });
};
