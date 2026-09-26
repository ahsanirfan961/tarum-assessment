import * as mock from "./mock";
import * as openrouter from "./openrouter";
import { ProviderError } from "./errors";

export { ProviderError };

const PROVIDERS = { mock, openrouter };

/**
 * The provider named by GENERATION_PROVIDER. Defaults to the mock, so the app
 * runs without an API key and without spending anything.
 */
export function getProvider() {
  const choice = process.env.GENERATION_PROVIDER || "mock";
  const provider = PROVIDERS[choice];
  if (!provider) {
    throw new ProviderError(
      `Unknown GENERATION_PROVIDER "${choice}". Use one of: ${Object.keys(PROVIDERS).join(", ")}.`,
      500
    );
  }
  return provider;
}

/** Video stays mocked until phase 3, whichever provider is configured. */
export function getVideoProvider() {
  return mock;
}
