export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  readonly fields: Record<string, string>;

  constructor(fields: Record<string, string>, message = 'Data belum valid.') {
    super(message);
    this.name = 'ValidationError';
    this.fields = fields;
  }
}

export function errorMessage(error: unknown, fallback = 'Terjadi kesalahan. Coba lagi.'): string {
  if (error instanceof AppError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new AppError(message);
  }
}
