import { describe, expect, it } from 'vitest';
import { validateAttachments } from './attachments';

const pdf = 'application/pdf';
const smallPdf = Buffer.from('hello').toString('base64');

describe('validateAttachments', () => {
  it('allows omitted or empty attachments', () => {
    expect(() => validateAttachments(undefined)).not.toThrow();
    expect(() => validateAttachments([])).not.toThrow();
  });

  it('rejects too many attachments', () => {
    const attachments = [...Array(11).keys()].map((i) => ({
      filename: `file-${String(i)}.pdf`,
      contentType: pdf,
      content: smallPdf,
    }));
    expect(() => validateAttachments(attachments)).toThrow(
      /Too many attachments/,
    );
  });

  it('rejects oversized attachments', () => {
    expect(() =>
      validateAttachments(
        [
          {
            filename: 'big.pdf',
            contentType: pdf,
            content: Buffer.alloc(20),
          },
        ],
        { maxAttachmentSize: 10 },
      ),
    ).toThrow(/exceeds max size/);
  });

  it('allows MIME types with a charset suffix', () => {
    expect(() =>
      validateAttachments([
        {
          filename: 'note.txt',
          contentType: 'text/plain; charset=utf-8',
          content: smallPdf,
        },
      ]),
    ).not.toThrow();
  });

  it('rejects disallowed MIME types', () => {
    expect(() =>
      validateAttachments([
        {
          filename: 'note.exe',
          contentType: 'application/octet-stream',
          content: smallPdf,
        },
      ]),
    ).toThrow(/disallowed content type/);
  });

  it('strips unsafe filenames instead of rejecting them', () => {
    expect(() =>
      validateAttachments([
        {
          filename: '../secret.pdf',
          contentType: pdf,
          content: smallPdf,
        },
      ]),
    ).not.toThrow();
  });

  it('rejects missing content', () => {
    expect(() =>
      validateAttachments([
        {
          filename: 'file.pdf',
          contentType: pdf,
        },
      ]),
    ).toThrow(/missing content/);
  });

  it('accepts Buffer content', () => {
    expect(() =>
      validateAttachments([
        {
          filename: 'file.pdf',
          contentType: pdf,
          content: Buffer.from('hello'),
        },
      ]),
    ).not.toThrow();
  });
});
