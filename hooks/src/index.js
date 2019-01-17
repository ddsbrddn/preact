import { options } from 'preact';

/** @type {number} */
let currentIndex;

/** @type {import('./internal').Component} */
let currentComponent;

/** @type {Array<import('./internal').Component>} */
let afterPaintEffects = [];

/** @type {boolean} */
let stateChanged;

// Temp variables used by for loop
// let i, j;

let oldBeforeRender = options.beforeRender;
options.beforeRender = vnode => {
	if (oldBeforeRender) oldBeforeRender(vnode);

	currentComponent = vnode._component;
	currentIndex = 0;

	// !Drain queue

	// ORIGINAL: 874 B
	// const hooks = currentComponent.__hooks;
	// if (!hooks) return;
	// let effect;
	// while (effect = hooks._pendingEffects.shift()) {
	// 	invokeEffect(effect);
	// }

	// WHILE (SHIFT): 855 B
	// const hooks = currentComponent.__hooks;
	// if (!hooks) return;
	// let effect;
	// while (effect = hooks._pendingEffects.shift()) {
	// 	invokeEffect(effect);
	// }

	// WHILE (POP): 853 B
	// const hooks = currentComponent.__hooks;
	// if (!hooks) return;
	// let effect;
	// while (effect=hooks._pendingEffects.pop()) {
	// 	invokeEffect(effect);
	// }

	// FOR (TEMP): 886 B
	// if (!currentComponent.__hooks) return;
	// let list = currentComponent.__hooks._pendingEffects; currentComponent.__hooks._pendingEffects = [];
	// for (i = 0; i < list.length; i++) {
	// 	invokeEffect(list[i]);
	// }

	// FOREACH (SPLICE): 837 B
	// if (!currentComponent.__hooks) return;
	// currentComponent.__hooks._pendingEffects.splice(0, currentComponent.__hooks._pendingEffects.length).forEach(invokeEffect);

	// FOREACH (TEMP): 832 B
	if (!currentComponent.__hooks) return;
	let effects = currentComponent.__hooks._pendingEffects; currentComponent.__hooks._pendingEffects = [];
	effects.forEach(invokeEffect);

	// FOREACH (RESET AFTER): 829 B
	// if (!currentComponent.__hooks) return;
	// currentComponent.__hooks._pendingEffects.forEach(invokeEffect);
	// currentComponent.__hooks._pendingEffects = [];
};


let oldAfterDiff = options.afterDiff;
options.afterDiff = vnode => {
	if (oldAfterDiff) oldAfterDiff(vnode);

	const c = vnode._component;
	if (!c) return;

	const hooks = c.__hooks;
	if (!hooks) return;

	stateChanged = false;

	// !Drain queue

	// ORIGINAL: 874 B
	// let effect;
	// while (effect = hooks._pendingLayoutEffects.shift()) {
	// 	invokeEffect(effect);
	// }

	// WHILE (SHIFT): 855 B
	// let effect;
	// while (effect = hooks._pendingLayoutEffects.shift()) {
	// 	invokeEffect(effect);
	// }

	// WHILE (POP): 853 B
	// let effect;
	// while (effect=hooks._pendingLayoutEffects.pop()) {
	// 	invokeEffect(effect);
	// }

	// FOR (TEMP): 886 B
	// let list = hooks._pendingLayoutEffects; hooks._pendingLayoutEffects = [];
	// for (i = 0; i < list.length; i++) {
	// 	invokeEffect(list[i]);
	// }

	// FOREACH (SPLICE): 837 B
	// hooks._pendingLayoutEffects.splice(0, hooks._pendingLayoutEffects.length).forEach(invokeEffect);

	// FOREACH (TEMP): 832 B
	// NOTE: Tests pass without neding to store effects in a temp variable when
	// using forEach, so using RESET AFTER strategy here
	hooks._pendingLayoutEffects.forEach(invokeEffect);
	hooks._pendingLayoutEffects = [];

	// FOREACH (RESET AFTER): 829 B
	// hooks._pendingLayoutEffects.forEach(invokeEffect);
	// hooks._pendingLayoutEffects = [];

	if (stateChanged) c.forceUpdate();
};


let oldBeforeUnmount = options.beforeUnmount;
options.beforeUnmount = vnode => {
	if (oldBeforeUnmount) oldBeforeUnmount(vnode);

	const hooks = vnode._component.__hooks;
	if (!hooks) return;

	// ORIGINAL: 874 B
	// for (let i = 0; i < hooks._list.length; i++) {
	// 	if (hooks._list[i]._cleanup) {
	// 		hooks._list[i]._cleanup();
	// 	}
	// }

	// WHILE (SHIFT): 855 B
	// let hook;
	// while (hook = hooks._list.shift()) {
	// 	if (hook._cleanup) {
	// 		hook._cleanup();
	// 	}
	// }

	// WHILE (POP): 853 B
	// let hook;
	// while (hook = hooks._list.pop()) {
	// 	if (hook._cleanup) {
	// 		hook._cleanup();
	// 	}
	// }

	// FOR: 886 B
	// for (let i = 0; i < hooks._list.length; i++) {
	// 	if (hooks._list[i]._cleanup) {
	// 		hooks._list[i]._cleanup();
	// 	}
	// }

	// FOREACH: 837 B, 832 B, 829 B
	hooks._list.forEach(hook => hook._cleanup && hook._cleanup());
};

/**
 * Create a Hook instance and invoke its implementation as determined by
 * the `shouldRun` parameter
 * @param {import('./internal').HookImplementationFactory} create
 * @param {import('./internal').HookShouldRun} [shouldRun]
 * @returns {import('./internal').Hook}
 */
const createHook = (create, shouldRun) => (...args) => {
	if (!currentComponent) return;

	const hooks = currentComponent.__hooks || (currentComponent.__hooks = { _list: [], _pendingEffects: [], _pendingLayoutEffects: [] });

	let _index = currentIndex++;
	let hook = hooks._list[_index];

	if (!hook) {
		hook = hooks._list[_index] = { _index };
		hook._run = create(hook, currentComponent, ...args);
	}
	else if (shouldRun && shouldRun(hook._args, args) === false) {
		return hook._value;
	}

	hook._args = args;

	return (hook._value = hook._run(...args));
};

// TODO: Do we merge state or always replace it?
export const useState = initialState => useReducer(invokeOrReturn, initialState);

export const useReducer = createHook((hook, component, reducer, initialState, initialAction) => {
	const initState = invokeOrReturn(undefined, initialState);
	const ret = [
		component.state[hook._index] = initialAction ? reducer(initState, initialAction) : initState,
		action => {
			stateChanged = true;
			component.setState(state => ret[0] = state[hook._index] = reducer(ret[0], action));
		}
	];
	return () => ret;
});

// eslint-disable-next-line arrow-body-style
export const useEffect = createHook((hook, component) => {
	return callback => {
		component.__hooks._pendingEffects.push(hook);
		afterPaint(component);
		return callback;
	};
}, propsChanged);

// eslint-disable-next-line arrow-body-style
export const useLayoutEffect = createHook((hook, component) => {
	return callback => {
		component.__hooks._pendingLayoutEffects.push(hook);
		return callback;
	};
}, propsChanged);

export const useRef = createHook((hook, component, initialValue) => {
	const ref = { current: initialValue };
	return () => ref;
});

export const useMemo = createHook(() => callback => callback(), memoChanged);
export const useCallback = createHook(() => callback => callback, propsChanged);


// TODO: Possibly reconsider exposing Component.debounce due to the comment
// with the "❌" below. People shouldn't be able to make Component.debounce
// synchronous because then functions like `setState` are ambiguously sync or
// async. See links below for a discussion about building async APIs
// https://blog.izs.me/2013/08/designing-apis-for-asynchrony
// https://blog.ometer.com/2011/07/24/callbacks-synchronous-and-asynchronous/
// https://github.com/kriskowal/q/wiki/Coming-from-jQuery

// Note: if someone used Component.debounce = requestAnimationFrame,
// then effects will ALWAYS run on the NEXT frame instead of the current one, incurring a ~16ms delay.
// Perhaps this is not such a big deal.
/**
 * Invoke a component's pending effects after the next frame renders
 * @type {(component: import('./internal').Component) => void}
 */
let afterPaint = () => {};

/** @type {MessageChannel} */
let mc;

function onPaint() {
	mc.port1.postMessage(undefined);
}

if (typeof window !== 'undefined') {
	mc = new MessageChannel();

	afterPaint = (component) => {
		// TODO: Consider ways to avoid queuing a component multiple times
		// due to multiple `useEffect`s
		if (afterPaintEffects.push(component) === 1) {
			requestAnimationFrame(onPaint);
		}
	};

	mc.port2.onmessage = () => {
		// !Drain Queue

		// ORIGINAL: 874 B
		// afterPaintEffects.splice(0, afterPaintEffects.length).forEach(component => {
		// 	if (!component._parentDom) return;
		// 	const effects = component.__hooks._pendingEffects;
		// 	// !Drain Queue 2
		// 	effects.splice(0, effects.length).forEach(invokeEffect);
		// });

		// WHILE (SHIFT): 855 B  ❌ if we don't support sync Component.debounce. See 852 B comment below.
		// let c, effect;
		// while (c = afterPaintEffects.shift()) {
		// 	if (!c._parentDom) continue;
		// 	while (effect = c.__hooks._pendingEffects.shift()) {
		// 		invokeEffect(effect);
		// 	}
		// }

		// WHILE (POP): 853 B  ❌ if we don't support sync Component.debounce. See 852 B comment below.
		// let c, effect;
		// while (c = afterPaintEffects.pop()) {
		// 	if (!c._parentDom) continue;
		// 	while (effect = c.__hooks._pendingEffects.pop()) {
		// 		invokeEffect(effect);
		// 	}
		// }

		// FOR (TEMP): 886 B
		// let list1 = afterPaintEffects; afterPaintEffects = [];
		// for (j = 0; j < list1.length; j++) {
		// 	currentComponent = list1[j];
		// 	if (!currentComponent._parentDom) continue;
		// 	let list2 = currentComponent.__hooks._pendingEffects; currentComponent.__hooks._pendingEffects = [];
		// 	for (i = 0; i < list2.length; i++) {
		// 		invokeEffect(list2[i]);
		// 	}
		// }

		// FOREACH (SPLICE): 837 B
		// afterPaintEffects.splice(0, afterPaintEffects.length).forEach(component => {
		// 	if (!component._parentDom) return;
		// 	component.__hooks._pendingEffects.splice(0, component.__hooks._pendingEffects.length).forEach(invokeEffect);
		// });

		// FOREACH (TEMP): 832 B
		afterPaintEffects.forEach(component => {
			if (!component._parentDom) return;
			let effects = component.__hooks._pendingEffects; component.__hooks._pendingEffects = [];
			effects.forEach(invokeEffect);
		});
		afterPaintEffects = [];

		// FOREACH (RESET AFTER): 829 B ❌
		// Doesn't pass sync debounce test cuz we need to clear the _pendingEffects
		// list before traversing it to avoid re-entering effects in the beforeRender loop
		// afterPaintEffects.forEach(component => {
		// 	if (!component._parentDom) return;
		// 	component.__hooks._pendingEffects.forEach(invokeEffect);
		// 	component.__hooks._pendingEffects = [];
		// });
		// afterPaintEffects = [];
	};
}

/**
 * Invoke a Hook's effect
 * @param {import('./internal').HookInstance} hook
 */
function invokeEffect(hook) {
	if (hook._cleanup) hook._cleanup();
	const result = hook._value();
	if (typeof result === 'function') hook._cleanup = result;
}

function propsChanged(oldArgs, newArgs) {
	// const props = newArgs[1];
	// if (!props) return;

	// ORIGINAL: 874 B
	// const oldProps = oldArgs[1];
	// for (let i = 0; i < props.length; i++) {
	// 	if (props[i] !== oldProps[i]) return true;
	// }
	// return false;

	// WHILE: 855 B (shift) or 853 B (pop)
	// NOTE: Terser rewrites while loop as for loop
	// const oldProps = oldArgs[1];
	// let i = 0;
	// while (i < props.length) {
	// 	if (props[i] !== oldProps[i]) return true;
	// 	i++;
	// }
	// return false;

	// FOR: 886 B
	// const oldProps = oldArgs[1];
	// for (let i = 0; i < props.length; i++) {
	// 	if (props[i] !== oldProps[i]) return true;
	// }
	// return false;

	// FOREACH: 837 B, 832 B, 829 B
	// return props.some((prop, index) => prop !== oldArgs[1][index]);

	// FOREACH (SIMPLIFIED): 816 B
	return newArgs[1] === undefined || newArgs[1].some((prop, index) => prop !== oldArgs[1][index]);
}

function memoChanged(oldArgs, newArgs) {
	return newArgs[1] !== undefined ? propsChanged(oldArgs, newArgs) : newArgs[0] !== oldArgs[0];
}

function invokeOrReturn(arg, f) {
	return typeof f === 'function' ? f(arg) : f;
}
