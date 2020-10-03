import {
  actions,
  DoneInvokeEvent,
  EventObject,
  GuardPredicate,
  InvokeConfig,
  MachineConfig,
  SingleOrArray,
  StateNode,
  StateNodeConfig,
  StateSchema,
  TransitionConfig,
  TransitionDefinition,
  TransitionsConfig,
} from "xstate";

type GuardStateMachine<TContext, TEvent extends EventObject> = {
  nextGuard: string;
  cond:
    | (Record<string, any> & {
        type: string;
      })
    | GuardPredicate<TContext, TEvent>
    | undefined;
  target:
    | StateNode<
        TContext,
        any,
        TEvent,
        {
          value: any;
          context: TContext;
        }
      >[]
    | undefined;
  onError:
    | string
    | TransitionConfig<TContext, DoneInvokeEvent<any>>
    | TransitionConfig<TContext, DoneInvokeEvent<any>>[]
    | undefined;
};

export function createGuardStateMachine<TContext, TEvent extends EventObject>({
  cond,
  target,
  onError,
  nextGuard,
}: GuardStateMachine<TContext, TEvent>) {
  return {
    invoke: {
      src: cond,
      onDone: [
        {
          cond: (ctx, { data }) => data,
          actions: actions.raise(`goto-${target}`),
        },
        { target: nextGuard },
      ],
      onError: {
        target: onError,
        internal: true,
      },
    },
  };
}

function createInternalTransitionName(prefix: string, index: number): string {
  return `internal_${prefix}_transition_guard_${index}`;
}

type MyTransition<TContext, TEvent extends EventObject> = SingleOrArray<
  | string
  | TransitionConfig<TContext, TEvent>
  | StateNode<
      TContext,
      any,
      TEvent,
      {
        value: any;
        context: TContext;
      }
    >
  | undefined
>;

function isConditionalTransition<TContext, TEvent extends EventObject>(
  transition: MyTransition<TContext, TEvent>
): transition is TransitionConfig<TContext, TEvent>[] {
  if (Array.isArray(transition)) {
    return true;
  }

  return false;
}

function createInitialTransition<TContext, TEvent extends EventObject>(
  transitionName: string,
  transition: MyTransition<TContext, TEvent>
) {
  return isConditionalTransition(transition)
    ? {
        target: createInternalTransitionName(transitionName, 0),
      }
    : transition;
}

function createTransitionsForGuardStateMachine<
  TContext,
  TEvent extends EventObject
>(transitions: undefined | TransitionsConfig<TContext, TEvent>) {
  if (!transitions) {
    return {};
  }

  return Object.entries(transitions).reduce(
    (prev, [transitionName, transition]) => ({
      ...prev,
      [transitionName]: createInitialTransition(transitionName, transition),
    }),
    {}
  );
}

type Guard<TContext, TEvent extends EventObject> = InvokeConfig<
  TContext,
  TEvent
> &
  TransitionDefinition<TContext, TEvent>;

function createGuardStateMachines<TContext, TEvent extends EventObject>(
  transitionName: string,
  guards: Guard<TContext, TEvent>[] | string | undefined
) {
  if (!guards) {
    return {};
  }

  if (typeof guards === "string") {
    return {};
  }

  return guards.reduce(
    (prev, { cond, target, onError }, index, array) => ({
      ...prev,
      [createInternalTransitionName(transitionName, index)]:
        index + 1 < array.length
          ? createGuardStateMachine({
              cond,
              target,
              onError,
              nextGuard: createInternalTransitionName(
                transitionName,
                index + 1
              ),
            })
          : {
              type: "final",
              entry: actions.raise(`goto-${target}`),
            },
    }),
    {}
  );
}

function createGuardStates<TContext, TEvent extends EventObject>(
  transitions: TransitionsConfig<TContext, TEvent> | undefined
) {
  if (!transitions) {
    return {};
  }

  return Object.entries(transitions)
    .filter(([transitionName, transition]) =>
      isConditionalTransition(transition)
    )
    .reduce(
      (prev, [transitionName, transition]) => ({
        ...prev,
        ...createGuardStateMachines(transitionName, transition),
      }),
      {}
    );
}

function createTransitionTargets<
  TContext,
  TStateSchema extends StateSchema,
  TEvent extends EventObject
>(state: StateNodeConfig<TContext, TStateSchema["states"][any], TEvent>) {
  if (!state.on) {
    return {};
  }

  return Object.entries(state.on).reduce(
    (prev, [transitionName, transition]) => {
      if (isConditionalTransition(transition)) {
        const targets = transition.reduce(
          (prev, { target }) => ({
            ...prev,
            [`goto-${target}`]: target,
          }),
          {}
        );
        return {
          ...prev,
          ...targets,
        };
      }
      return {
        ...prev,
        [`goto-${transition}`]: transition,
      };
    },
    {}
  );
}

type WithConditionalTransitionsSchema<TStateSchema extends StateSchema> = {
  // TODO: improve this
  states: {
    idle: {};
  } & TStateSchema["states"];
};

export function convertWithConditionalTransitions<
  TContext,
  TStateSchema extends StateSchema,
  TEvent extends EventObject
>(
  state: StateNodeConfig<TContext, TStateSchema["states"][any], TEvent>
): MachineConfig<
  TContext,
  WithConditionalTransitionsSchema<TStateSchema>,
  TEvent
> {
  const { on, ...stateProperties } = state;

  return {
    initial: "idle",
    states: {
      idle: {
        ...stateProperties,
        on: createTransitionsForGuardStateMachine(state.on),
      },
      ...createGuardStates(state.on),
    },
    on: createTransitionTargets(state),
  };
}
