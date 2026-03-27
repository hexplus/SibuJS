import { track } from "../../reactivity/track";
import { devAssert } from "../dev";
import { isSSR } from "../ssr-context";

/**
 * Watches a reactive getter and calls callback with (newValue, oldValue) when it changes.
 *
 * In SSR mode, watch is a no-op — subscriptions should not run on the server.
 *
 * @param getter Function that returns the value to watch (reads reactive signals).
 * @param callback Function called when the watched value changes.
 * @returns Teardown function to cancel the watcher.
 */
export function watch<T>(getter: () => T, callback: (value: T, prev: T | undefined) => void): () => void {
  devAssert(typeof getter === "function", "watch: first argument must be a getter function.");
  devAssert(typeof callback === "function", "watch: second argument must be a callback function.");

  // No-op during SSR — subscriptions are client-only
  if (isSSR()) return () => {};

  let oldValue: T | undefined;
  let first = true;

  // Subscriber function for track
  const subscriber = () => {
    const newValue = getter();
    if (first) {
      // Capture initial value inside tracking scope to avoid dependency leak
      oldValue = newValue;
      first = false;
      return;
    }
    if (!Object.is(newValue, oldValue)) {
      callback(newValue, oldValue);
      oldValue = newValue;
    }
  };

  // Track dependencies and return teardown for unsubscription
  const teardown = track(subscriber);
  return teardown;
}
