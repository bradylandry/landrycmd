import { register } from "node:module";

register(new URL("./resolve-ts-hook.mjs", import.meta.url), {
  parentURL: new URL("./", import.meta.url).href,
});
