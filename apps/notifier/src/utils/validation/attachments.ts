import type { Attachment } from '../../services/email/base-client';
import type { RequestValidationConfig } from '../../types/config';
import { EmailRequestError } from '../../utils/errors/request-error';

const DEFAULT_MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const DEFAULT_MAX_ATTACHMENTS = 10;

const DEFAULT_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'text/plain',
  'text/csv',
  'application/zip',
];

function attachmentByteSize(content: string | Buffer): number {
  if (Buffer.isBuffer(content)) {
    return content.length;
  }
  return Buffer.from(content, 'base64').length;
}

function isSafeFilename(name: unknown): name is string {
  if (typeof name !== 'string' || name.trim().length === 0) {
    return false;
  }
  if (name.includes('/') || name.includes('\\')) {
    return false;
  }
  for (const ch of name) {
    const code = ch.charCodeAt(0);
    if (code < 32 || code === 127) {
      return false;
    }
  }
  return true;
}

function normalizeMimeType(contentType: string): string {
  return contentType.split(';', 1)[0].trim().toLowerCase();
}

export function validateAttachments(
  attachments: unknown[] | undefined,
  config?: RequestValidationConfig,
): void {
  if (!attachments || attachments.length === 0) {
    return;
  }

  const maxAttachments = config?.maxAttachments ?? DEFAULT_MAX_ATTACHMENTS;
  if (attachments.length > maxAttachments) {
    throw new EmailRequestError(
      `Too many attachments (max ${String(maxAttachments)})`,
      400,
    );
  }

  const maxSize = config?.maxAttachmentSize ?? DEFAULT_MAX_ATTACHMENT_SIZE;
  const allowedMimeTypes =
    config?.allowedAttachmentMimeTypes ?? DEFAULT_ALLOWED_MIME_TYPES;
  const allowed = new Set(
    allowedMimeTypes.map((type) => normalizeMimeType(type)),
  );

  for (let i = 0; i < attachments.length; i++) {
    const raw = attachments[i];
    if (!raw || typeof raw !== 'object') {
      throw new EmailRequestError(
        `Invalid attachment at index ${String(i)}`,
        400,
      );
    }

    const att = raw as Attachment;
    if (!isSafeFilename(att.filename)) {
      att.filename = undefined;
    }
    const label = att.filename ?? `index ${String(i)}`;

    if (!att.contentType) {
      throw new EmailRequestError(
        `Attachment "${label}" has missing or disallowed content type`,
        400,
      );
    }

    const mime = normalizeMimeType(att.contentType);
    if (!allowed.has(mime)) {
      throw new EmailRequestError(
        `Attachment "${label}" has missing or disallowed content type`,
        400,
      );
    }

    if (att.content === undefined) {
      throw new EmailRequestError(
        `Attachment "${label}" is missing content`,
        400,
      );
    }

    if (typeof att.content !== 'string' && !Buffer.isBuffer(att.content)) {
      throw new EmailRequestError(
        `Attachment "${label}" content must be a base64 string or Buffer`,
        400,
      );
    }

    const size = attachmentByteSize(att.content);
    if (size > maxSize) {
      throw new EmailRequestError(
        `Attachment "${label}" exceeds max size of ${String(maxSize)} bytes`,
        400,
      );
    }
  }
}
