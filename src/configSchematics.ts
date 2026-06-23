import { createConfigSchematics } from "@lmstudio/sdk";

export function buildConfigSchematics() {
  return createConfigSchematics()
    .field("units", "select", {
      options: [
        { displayName: "Celsius", value: "celsius" },
        { displayName: "Fahrenheit", value: "fahrenheit" },
      ],
    }, "celsius")
    .field(
      "defaultCity",
      "string",
      {},
      "",
    )
    .build();
}
