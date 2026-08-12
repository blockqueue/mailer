import { z } from 'zod';
import { EmailRequestError } from '../errors/request-error';
import { parseEmailAddress } from '../parseEmailAddress';

function isValidEmail(email: string): boolean {
  try {
    z.email().parse(email);
    return true;
  } catch {
    return false;
  }
}

export function validateEmailAddresses(
  emails: string | string[] | undefined,
  fieldName: string,
  required = false,
): string[] {
  if (required && !emails) {
    const errorMessage =
      fieldName === 'from'
        ? `Missing required field: '${fieldName}' in sendMailOptions. Provide it in request.sendMailOptions, template.from, or account.from`
        : `Missing required field: '${fieldName}' in sendMailOptions`;
    throw new EmailRequestError(errorMessage, 400);
  }

  if (!emails) {
    return [];
  }

  const emailArray = Array.isArray(emails) ? emails : [emails];
  const invalidEmails: string[] = [];

  for (const email of emailArray) {
    if (typeof email !== 'string') {
      invalidEmails.push(String(email));
      continue;
    }
    const { address } = parseEmailAddress(email);
    if (!isValidEmail(address)) {
      invalidEmails.push(email);
    }
  }

  return invalidEmails;
}
