import * as mock from "./mock";
import * as openrouter from "./openrouter";
import { ProviderError } from "./errors";

export { ProviderError };

const PROVIDERS = { mock, openrouter };

/**
 * The provider named by GENERATION_PROVIDER, for images and video alike.
 * Defaults to the mock, so the app runs without an API key and without
 * spending anything.
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

/**
 * The provider that owns a submitted job, whatever GENERATION_PROVIDER says
 * now, so switching providers mid-render doesn't strand a pending take.
 */
export function providerForJob(jobId) {
  return jobId.startsWith("mock_") ? mock : openrouter;
}
