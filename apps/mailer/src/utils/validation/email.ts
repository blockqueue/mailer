import { z } from 'zod';

function isValidEmail(email: string): boolean {
  try {
    z.email().parse(email);
    return true;
  } catch {
    return false;
  }
}

/** Validate email addresses; throws if a required field is missing */
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
    throw new Error(errorMessage);
  }

  if (!emails) {
    return [];
  }

  const emailArray = Array.isArray(emails) ? emails : [emails];
  const invalidEmails: string[] = [];

  for (const email of emailArray) {
    if (typeof email !== 'string' || !isValidEmail(email)) {
      invalidEmails.push(email);
    }
  }

  return invalidEmails;
}
