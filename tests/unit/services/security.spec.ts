import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock electron safeStorage
vi.mock("electron", () => ({
  safeStorage: {
    encryptString: vi.fn((text: string) => Buffer.from(`encrypted:${text}`)),
    decryptString: vi.fn((buf: Buffer) => {
      const str = buf.toString();
      if (!str.startsWith("encrypted:")) {
        throw new Error("Decryption failed");
      }
      return str.replace("encrypted:", "");
    }),
    isEncryptionAvailable: vi.fn(() => true),
  },
}));

import { SecurityService } from "../../../electron/services/security";

describe("SecurityService", () => {
  let service: SecurityService;

  beforeEach(() => {
    service = new SecurityService();
  });

  describe("encrypt()", () => {
    it("加密后返回 base64 字符串", () => {
      const result = service.encrypt("sk-test-key");
      expect(typeof result).toBe("string");
    });

    it("加密后的数据不等于明文", () => {
      const result = service.encrypt("sk-test-key");
      expect(result).not.toBe("sk-test-key");
    });
  });

  describe("decrypt()", () => {
    it("解密后还原明文", () => {
      const encrypted = service.encrypt("sk-test-key");
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe("sk-test-key");
    });

    it("解密无效的 base64 时抛出错误", () => {
      expect(() => service.decrypt("not-valid-base64!@#")).toThrow();
    });
  });

  describe("isEncryptionAvailable()", () => {
    it("返回布尔值", () => {
      const result = service.isEncryptionAvailable();
      expect(typeof result).toBe("boolean");
    });
  });
});
