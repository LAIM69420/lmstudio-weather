import type { PluginContext } from "@lmstudio/sdk";

import { buildConfigSchematics } from "./configSchematics.js";
import { toolsProvider } from "./toolsProvider.js";

export async function main(ctx: PluginContext) {
  const configSchematics = buildConfigSchematics();

  ctx
    .withConfigSchematics(configSchematics)
    .withToolsProvider(toolsProvider);
}
