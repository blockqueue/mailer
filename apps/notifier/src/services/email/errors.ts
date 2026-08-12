export class EmailRequestError extends Error {
  readonly status: 400 | 502;

  constructor(message: string, status: 400 | 502) {
    super(message);
    this.name = 'EmailRequestError';
    this.status = status;
  }
}

