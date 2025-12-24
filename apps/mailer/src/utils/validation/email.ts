import { z } from 'zod';

/**
 * Validate a single email address
 */
function isValidEmail(email: string): boolean {
  try {
    z.email().parse(email);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate email addresses (single string, array of strings, or undefined)
 * @param emails - Email addresses to validate
 * @param fieldName - Name of the field being validated (for error messages)
 * @param required - Whether the field is required
 * @returns Array of invalid emails found, or throws error if required field is missing
 */
export function validateEmailAddresses(
  emails: string | string[] | undefined,
  fieldName: string,
  required = false,
): string[] {
  // Check if required field is missing
  if (required && !emails) {
    const errorMessage =
      fieldName === 'from'
        ? `Missing required field: '${fieldName}' in sendMailOptions. Provide it in request.sendMailOptions, template.from, or account.from`
        : `Missing required field: '${fieldName}' in sendMailOptions`;
    throw new Error(errorMessage);
  }

  // If not required and not provided, return empty array
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
