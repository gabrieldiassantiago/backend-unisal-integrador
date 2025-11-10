import { HttpException, HttpStatus } from '@nestjs/common';

export class DeviceNotFoundException extends HttpException {
  constructor(serial: string) {
    super(
      {
        statusCode: HttpStatus.NOT_FOUND,
        code: 'DEVICE_NOT_FOUND',
        message: `Dispositivo com serial ${serial} não encontrado`,
        details: {
          serial,
          timestamp: new Date().toISOString(),
        },
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class AlertNotFoundException extends HttpException {
  constructor(alertId: string) {
    super(
      {
        statusCode: HttpStatus.NOT_FOUND,
        code: 'ALERT_NOT_FOUND',
        message: `Alerta ${alertId} não encontrado`,
        details: {
          alertId,
          timestamp: new Date().toISOString(),
        },
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class InvalidAlertStatusException extends HttpException {
  constructor(currentStatus: string, attemptedAction: string) {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'INVALID_ALERT_STATUS',
        message: `Alerta com status '${currentStatus}' não pode ser ${attemptedAction}`,
        details: {
          currentStatus,
          attemptedAction,
          timestamp: new Date().toISOString(),
        },
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class PermissionDeniedException extends HttpException {
  constructor(resource: string = 'recurso') {
    super(
      {
        statusCode: HttpStatus.FORBIDDEN,
        code: 'PERMISSION_DENIED',
        message: `Você não tem permissão para acessar este ${resource}`,
        details: {
          timestamp: new Date().toISOString(),
        },
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class ValidationErrorException extends HttpException {
  constructor(errors: Record<string, string[]>) {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'VALIDATION_ERROR',
        message: 'Erro na validação dos dados enviados',
        errors,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
