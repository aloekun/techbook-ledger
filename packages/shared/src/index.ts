export {
  type BookData,
  type BookRecord,
  type RegistrationResponse,
  type ValidationResult,
  type DuplicateCheckResult,
  type RegisterResult,
  type ServerConfig,
  type ExtensionConfig,
} from "./types/index.js";
export { DEFAULT_WHITELIST, DEFAULT_EXTENSION_CONFIG } from "./types/config.js";
export { normalizeIsbn } from "./utils/isbn.js";
