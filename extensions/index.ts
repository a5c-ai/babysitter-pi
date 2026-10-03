import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { activateBabysitterPi } from "./runtime.js";

export {
  HOOK_TIMEOUT_MS,
  PLUGIN_ROOT,
  activateBabysitterPi,
  continuationFromStopHook,
  hookInput,
  runProxiedHook,
  syncSessionEnvironment,
} from "./runtime.js";

export default function activate(pi: ExtensionAPI): void {
  activateBabysitterPi(pi);
}
