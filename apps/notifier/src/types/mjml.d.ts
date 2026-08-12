declare module 'mjml' {
  interface MjmlOptions {
    validationLevel?: 'strict' | 'soft' | 'skip';
    minify?: boolean;
    beautify?: boolean;
    keepComments?: boolean;
    fonts?: Record<string, unknown>;
    minifyOptions?: Record<string, unknown>;
    beautifyOptions?: Record<string, unknown>;
  }

  interface MjmlError {
    line: number;
    message: string;
    tagName?: string;
    formattedMessage?: string;
  }

  interface MjmlResponse {
    html: string;
    errors: MjmlError[];
  }

  /** MJML 5 returns a Promise. */
  function mjml2html(
    mjml: string,
    options?: MjmlOptions,
  ): Promise<MjmlResponse>;

  export = mjml2html;
}
