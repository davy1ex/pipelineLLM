declare module 'markdown-it' {
  export default class MarkdownIt {
    constructor(options?: { html?: boolean; linkify?: boolean; breaks?: boolean });
    render(src: string): string;
  }
}


