import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { launch } from "cloakbrowser/puppeteer";

let browser = null;
let page = null;

const server = new Server(
  { name: "cloak-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "puppeteer_navigate",
      description: "Navigate to a URL using stealth CloakBrowser",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL to navigate to" }
        },
        required: ["url"]
      }
    },
    {
      name: "puppeteer_screenshot",
      description: "Take a screenshot of the current page",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Screenshot name" },
          selector: { type: "string", description: "CSS selector to screenshot (optional)" }
        },
        required: ["name"]
      }
    },
    {
      name: "puppeteer_click",
      description: "Click an element on the page",
      inputSchema: {
        type: "object",
        properties: {
          selector: { type: "string", description: "CSS selector to click" }
        },
        required: ["selector"]
      }
    },
    {
      name: "puppeteer_fill",
      description: "Fill an input field",
      inputSchema: {
        type: "object",
        properties: {
          selector: { type: "string", description: "CSS selector for input" },
          value: { type: "string", description: "Value to fill" }
        },
        required: ["selector", "value"]
      }
    },
    {
      name: "puppeteer_evaluate",
      description: "Execute JavaScript in the browser",
      inputSchema: {
        type: "object",
        properties: {
          script: { type: "string", description: "JavaScript to execute" }
        },
        required: ["script"]
      }
    },
    {
      name: "puppeteer_get_content",
      description: "Get the full HTML content of the current page",
      inputSchema: { type: "object", properties: {} }
    },
    {
      name: "puppeteer_close",
      description: "Close the browser",
      inputSchema: { type: "object", properties: {} }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "puppeteer_navigate") {
      if (!browser) {
        browser = await launch({ headless: true });
        page = await browser.newPage();
      }
      await page.goto(args.url, { waitUntil: "domcontentloaded" });
      return { content: [{ type: "text", text: `Navigated to ${args.url}` }] };
    }

    if (name === "puppeteer_screenshot") {
      if (!page) return { content: [{ type: "text", text: "No page open. Navigate first." }] };
      const options = { encoding: "base64" };
      if (args.selector) {
        const el = await page.$(args.selector);
        if (el) {
          const data = await el.screenshot(options);
          return { content: [{ type: "image", data, mimeType: "image/png" }] };
        }
      }
      const data = await page.screenshot(options);
      return { content: [{ type: "image", data, mimeType: "image/png" }] };
    }

    if (name === "puppeteer_click") {
      if (!page) return { content: [{ type: "text", text: "No page open. Navigate first." }] };
      await page.click(args.selector);
      return { content: [{ type: "text", text: `Clicked ${args.selector}` }] };
    }

    if (name === "puppeteer_fill") {
      if (!page) return { content: [{ type: "text", text: "No page open. Navigate first." }] };
      await page.type(args.selector, args.value);
      return { content: [{ type: "text", text: `Filled ${args.selector} with value` }] };
    }

    if (name === "puppeteer_evaluate") {
      if (!page) return { content: [{ type: "text", text: "No page open. Navigate first." }] };
      const result = await page.evaluate(args.script);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    if (name === "puppeteer_get_content") {
      if (!page) return { content: [{ type: "text", text: "No page open. Navigate first." }] };
      const content = await page.content();
      return { content: [{ type: "text", text: content }] };
    }

    if (name === "puppeteer_close") {
      if (browser) {
        await browser.close();
        browser = null;
        page = null;
      }
      return { content: [{ type: "text", text: "Browser closed." }] };
    }

    return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };

  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
