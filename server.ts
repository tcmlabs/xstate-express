import express, { Request, Response, Router } from "express";
import { interpret, Machine } from "xstate";

const resolveToOK = () => {
  console.log("async invoke???");
  return Promise.resolve("ok");
};

const makeMachine = (initialState: string) => {
  const toggleMachine = Machine({
    initial: initialState,
    states: {
      checkingunlit: {
        invoke: {
          id: "toto",
          src: "resolveToOK",
          onDone: { target: "lit" },
          onError: { target: "unlit" },
        },
      },
      checkinglit: {
        invoke: {
          id: "tata",
          src: "resolveToOK",
          onDone: { target: "unlit" },
          onError: { target: "lit" },
        },
      },
      unlit: {
        on: {
          TOGGLE: "checkingunlit",
          BREAK: "broken",
        },
      },
      lit: {
        on: {
          TOGGLE: "checkinglit",
          BREAK: "broken",
        },
      },
      broken: {
        type: "final",
      },
    },
  }).withConfig({
    actions: {
      //
    },
    services: {
      resolveToOK: async (context, event) => {
        console.log("  invoked", event.type);
        return resolveToOK();
      },
    },
  });

  return toggleMachine;
};

let globalMachine = makeMachine("lit");
let latestGlobalMachineState = globalMachine.initialState;

const machineDescription = JSON.stringify(globalMachine);

// console.log(machineDescription);

const app = express();

const nextEvents = globalMachine.events;

const router = express.Router();

const machineRouter = nextEvents.reduce((accRouter: Router, eventName) => {
  accRouter.get(`/${eventName}`, async (_req: Request, res: Response) => {
    let currentState = latestGlobalMachineState;

    // const machine = makeMachine(currentState.value as string);
    const httpMachine = makeMachine(currentState.value as string);

    // TODO: load state + context from database
    console.log("------");
    console.log("current", currentState.value);
    console.log("transition:", eventName);
    // const currentState = currentState.value;

    const fromState = `${currentState.value}`;
    // const viaEventName = `checking${currentState.value}`;
    const viaEventName = eventName;

    const currentStateValue = currentState.value;
    console.log("currentState", currentStateValue);

    const machineService = interpret(httpMachine)
      .onTransition((newState) => {
        console.log("state transition:", newState.value);

        if (newState.value === currentState.value) {
          console.log("Do nothing");
          return;
        }

        if ((newState.value as string).startsWith("checking")) {
          console.log("Checking...");

          return;
        }

        console.log("Send updated state");
        // if (newState.value === "unlit" && currentState.value === "lit") {
        // console.log("...unlit");
        // globalMachine = httpMachine;
        console.log({ fromState, eventName: viaEventName });

        console.log("=====");
        // console.log(globalMachine);
        const nextGlobalMachineState = globalMachine.transition(
          fromState,
          viaEventName
        );
        console.log("========");
        console.log("========");
        console.log("========");
        // console.log(globalMachine);
        latestGlobalMachineState = newState;
        console.log(nextGlobalMachineState.value);
        // // console.log(globalMachine.start)

        res.send({ nextState: newState.value });
        return;
      })

      .start();

    machineService.send(viaEventName);

    // machineService.subscribe((state) => {
    //   console.log("subscribe", state.value);
    // });

    // console.log('here')
    // await new Promise((resolve, reject) => setTimeout(resolve, 1000));
    // console.log(there)

    // res.send({ nextState });
  });
  return accRouter;
}, router);

app.use("/machine", machineRouter);

app.listen(4000, () => {
  console.log("Server listening");
});
