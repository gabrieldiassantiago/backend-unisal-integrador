// Templates de WhatsApp
export * from './fall-alert.template';
export * from './emergency.template';
export * from './false-alarm.template';
export * from './alert-resolved.template';
export * from './call-answered.template';

// Tipos consolidados
export type MessageTemplate<T> = (params: T) => string;
