declare module "jsdom" {
  export class VirtualConsole {
    on(event: "jsdomError", listener: (error: Error) => void): this;
  }

  export class JSDOM {
    constructor(
      html: string,
      options?: {
        runScripts?: "dangerously" | "outside-only";
        pretendToBeVisual?: boolean;
        url?: string;
        virtualConsole?: VirtualConsole;
      },
    );
    readonly window: Window & { close(): void };
  }
}
