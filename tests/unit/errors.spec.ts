import { describe, it, expect } from "vitest";
import {
  CCError,
  ValidationError,
  EncryptionError,
  DecryptionError,
  ConnectionError,
} from "../../electron/types/errors";

describe("CCError", () => {
  it("包含 code、message、recoverable", () => {
    const err = new CCError("TEST_CODE", "test message", true);
    expect(err.code).toBe("TEST_CODE");
    expect(err.message).toBe("test message");
    expect(err.recoverable).toBe(true);
    expect(err.name).toBe("CCError");
  });

  it("recoverable 默认为 true", () => {
    const err = new CCError("TEST_CODE", "test message");
    expect(err.recoverable).toBe(true);
  });
});

describe("ValidationError", () => {
  it("继承 CCError，code 为 VALIDATION_ERROR", () => {
    const err = new ValidationError("name 是必填的");
    expect(err).toBeInstanceOf(CCError);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.message).toBe("name 是必填的");
    expect(err.recoverable).toBe(true);
    expect(err.name).toBe("ValidationError");
  });
});

describe("EncryptionError", () => {
  it("可设置 recoverable", () => {
    const err = new EncryptionError("加密失败", false);
    expect(err).toBeInstanceOf(CCError);
    expect(err.code).toBe("ENCRYPTION_ERROR");
    expect(err.recoverable).toBe(false);
    expect(err.name).toBe("EncryptionError");
  });

  it("默认 recoverable 为 false", () => {
    const err = new EncryptionError("加密失败");
    expect(err.recoverable).toBe(false);
  });
});

describe("DecryptionError", () => {
  it("recoverable 为 false", () => {
    const err = new DecryptionError("解密失败");
    expect(err).toBeInstanceOf(CCError);
    expect(err.code).toBe("DECRYPTION_ERROR");
    expect(err.recoverable).toBe(false);
    expect(err.name).toBe("DecryptionError");
  });
});

describe("ConnectionError", () => {
  it("可设置 recoverable", () => {
    const err = new ConnectionError("连接失败", false);
    expect(err).toBeInstanceOf(CCError);
    expect(err.code).toBe("CONNECTION_FAILED");
    expect(err.recoverable).toBe(false);
    expect(err.name).toBe("ConnectionError");
  });

  it("默认 recoverable 为 true", () => {
    const err = new ConnectionError("连接失败");
    expect(err.recoverable).toBe(true);
  });
});
