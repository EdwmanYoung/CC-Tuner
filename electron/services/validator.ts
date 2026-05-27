import { TestResult } from "../../src/types";

export class ValidatorService {
  /**
   * Test API connectivity by sending a minimal request.
   * Returns ok=true with latencyMs on success, ok=false with message on failure.
   */
  async testConnection(
    baseUrl: string,
    apiKey: string,
    model: string,
    timeout = 10000,
  ): Promise<TestResult> {
    const start = Date.now();
    try {
      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
        signal: AbortSignal.timeout(timeout),
      });

      const latencyMs = Date.now() - start;

      if (response.ok) {
        return { ok: true, message: "Connection successful", latencyMs };
      }

      const body = await response.text();
      return {
        ok: false,
        message: `HTTP ${response.status}: ${body}`,
        latencyMs,
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - start;
      const message = err instanceof Error ? err.message : "Unknown error";
      const isTimeout = message.includes("timeout") || message.includes("AbortError");
      return {
        ok: false,
        message: isTimeout ? "Connection timeout" : message,
        latencyMs,
      };
    }
  }
}
