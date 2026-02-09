import { Role } from '../../generated/prisma';

/**
 * Tempo de expiração do código de verificação (em minutos)
 */
export const VERIFICATION_CODE_EXPIRATION_MINUTES = 10;

/**
 * Tempo mínimo entre envios de códigos de verificação (em minutos)
 */
export const MIN_TIME_BETWEEN_CODES_MINUTES = 2;

/**
 * Período de verificação de códigos recentes (em horas)
 */
export const RECENT_CODES_PERIOD_HOURS = 24;

/**
 * Limite máximo de códigos de verificação em 24 horas
 */
export const MAX_VERIFICATION_CODES_PER_DAY = 5;

/**
 * Número de dígitos do código de verificação
 */
export const VERIFICATION_CODE_LENGTH = 6;

/**
 * Rounds de hash do bcrypt
 */
export const BCRYPT_SALT_ROUNDS = 10;

/**
 * Role padrão para novos usuários
 */
export const DEFAULT_USER_ROLE: Role = Role.CAREGIVER;
