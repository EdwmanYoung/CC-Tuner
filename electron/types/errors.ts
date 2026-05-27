/** Custom error types for CC-Tuner */

export class CCError extends Error {
  code: string;
  recoverable: boolean;

  constructor(code: string, message: string, recoverable = true) {
    super(message);
    this.code = code;
    this.recoverable = recoverable;
    this.name = "CCError";
  }
}

export class ValidationError extends CCError {
  constructor(message: string) {
    super("VALIDATION_ERROR", message, true);
    this.name = "ValidationError";
  }
}

export class EncryptionError extends CCError {
  constructor(message: string, recoverable = false) {
    super("ENCRYPTION_ERROR", message, recoverable);
    this.name = "EncryptionError";
  }
}

export class DecryptionError extends CCError {
  constructor(message: string) {
    super("DECRYPTION_ERROR", message, false);
    this.name = "DecryptionError";
  }
}

export class ConnectionError extends CCError {
  constructor(message: string, recoverable = true) {
    super("CONNECTION_FAILED", message, recoverable);
    this.name = "ConnectionError";
  }
}
