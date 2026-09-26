/** A failure the user should see verbatim, such as a model's refusal. */
export class ProviderError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
  }
}
