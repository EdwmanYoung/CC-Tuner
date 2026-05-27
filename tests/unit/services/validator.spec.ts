import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { ValidatorService } from "../../../electron/services/validator";

const server = setupServer(
  http.post("https://api.test.com/v1/messages", async () => {
    return HttpResponse.json({
      id: "msg-test",
      content: [{ type: "text", text: "hi" }],
    });
  }),

  http.post("https://api.error.com/v1/messages", async () => {
    return HttpResponse.json(
      { error: { message: "Invalid API key" } },
      { status: 401 },
    );
  }),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("ValidatorService", () => {
  const validator = new ValidatorService();

  it("成功时返回 ok=true 和 latencyMs", async () => {
    const result = await validator.testConnection(
      "https://api.test.com",
      "sk-test",
      "test-model",
    );
    expect(result.ok).toBe(true);
    expect(result.latencyMs).toBeDefined();
    expect(typeof result.latencyMs).toBe("number");
  });

  it("HTTP 错误时返回 ok=false 和错误信息", async () => {
    const result = await validator.testConnection(
      "https://api.error.com",
      "sk-invalid",
      "test-model",
    );
    expect(result.ok).toBe(false);
    expect(result.message).toContain("Invalid API key");
  });

  it("超时时返回 ok=false 和 timeout 信息", { timeout: 20000 }, async () => {
    server.use(
      http.post("https://api.slow.com/v1/messages", async () => {
        await new Promise((r) => setTimeout(r, 20000));
        return HttpResponse.json({});
      }),
    );
    const result = await validator.testConnection(
      "https://api.slow.com",
      "sk-test",
      "test-model",
    );
    expect(result.ok).toBe(false);
    expect(result.message).toContain("timeout");
  });

  it("网络错误时返回 ok=false", async () => {
    const result = await validator.testConnection(
      "https://api.nonexistent.invalid.example.com",
      "sk-test",
      "test-model",
    );
    expect(result.ok).toBe(false);
  });
});
