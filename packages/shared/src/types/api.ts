export interface RegistrationResponse {
  readonly success: boolean;
  readonly message: string;
  readonly notionUrl?: string;
  readonly isDuplicate?: boolean;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly missingFields: readonly string[];
}

export interface DuplicateCheckResult {
  readonly exists: boolean;
  readonly notionPageId?: string;
  readonly notionUrl?: string;
}

export type RegisterResult =
  | { readonly created: true; readonly notionUrl: string }
  | { readonly created: false; readonly notionUrl: string };
