import { safeStorage } from "electron";

export class SecurityService {
  /** Encrypt a string and return base64-encoded result */
  encrypt(plainText: string): string {
    const encrypted = safeStorage.encryptString(plainText);
    return encrypted.toString("base64");
  }

  /** Decrypt a base64-encoded string back to plaintext */
  decrypt(encryptedBase64: string): string {
    const buffer = Buffer.from(encryptedBase64, "base64");
    return safeStorage.decryptString(buffer);
  }

  /** Check if system encryption is available */
  isEncryptionAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  }
}
