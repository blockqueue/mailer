export class ChannelRequestError extends Error {
  readonly status: 400 | 502;

  constructor(message: string, status: 400 | 502, name: string) {
    super(message);
    this.name = name;
    this.status = status;
  }
}

export class EmailRequestError extends ChannelRequestError {
  constructor(message: string, status: 400 | 502) {
    super(message, status, 'EmailRequestError');
  }
}

export class SmsRequestError extends ChannelRequestError {
  constructor(message: string, status: 400 | 502) {
    super(message, status, 'SmsRequestError');
  }
}
