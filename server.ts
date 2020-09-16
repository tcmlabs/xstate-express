import express, { Request, Response, Router } from "express";
import { Machine } from "xstate";

const toggleMachine = Machine({
  initial: "unlit",
  states: {
    unlit: {
      on: {
        TOGGLE: "lighted",
        BREAK: "broken",
      },
    },
    lighted: {
      on: {
        TOGGLE: "unlit",
        BREAK: "broken",
      },
    },
    broken: {
      type: "final",
    },
  },
});

const jsonState = JSON.stringify(toggleMachine);

console.log(jsonState);

const app = express();

const nextEvents = toggleMachine.events;

const router = express.Router();

let currentState = toggleMachine.initialState;

const machineRouter = nextEvents.reduce((accRouter: Router, event) => {
  accRouter.get(`/${event}`, (_req: Request, res: Response) => {
    // TODO: load state + context from database
    currentState = toggleMachine.transition(currentState, event);

    res.send(currentState.value);
  });
  return accRouter;
}, router);

app.use("/machine", machineRouter);

app.listen(4000, () => {
  console.log("Server listening");
});
