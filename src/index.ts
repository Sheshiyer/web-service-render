#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { promises as fs } from 'fs';
import path from 'path';

interface CreateServiceArgs {
  name: string;
  path: string;
  port?: number;
  description?: string;
}

interface GenerateRenderConfigArgs {
  name: string;
  path: string;
  envVars?: Record<string, string>;
  serviceId?: string;  // For existing services
  region?: string;
  plan?: 'free' | 'individual' | 'team' | 'business';
}

interface RenderConfig {
  apiKey?: string;
  region?: string;
}

interface RenderServiceConfig {
  type: string;
  name: string;
  env: string;
  region: string;
  plan: 'free' | 'individual' | 'team' | 'business';
  buildCommand: null;
  startCommand: string;
  envVars: Record<string, string>;
  id?: string;
}

class DenoServiceServer {
  private server: Server;
  private renderConfig: RenderConfig = {};

  constructor() {
    this.server = new Server(
      {
        name: 'deno-service-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Load render.com configuration from environment variables
    this.renderConfig = {
      apiKey: process.env.RENDER_API_KEY,
      region: process.env.RENDER_REGION || 'oregon',
    };

    this.setupToolHandlers();
    
    this.server.onerror = (error) => console.error('[MCP Error]', error);
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'create_deno_service',
          description: 'Create a new Deno web service project with best practices',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Service name',
              },
              path: {
                type: 'string',
                description: 'Directory to create the service in',
              },
              port: {
                type: 'number',
                description: 'Port number for the service',
                default: 8000,
              },
              description: {
                type: 'string',
                description: 'Service description',
              },
            },
            required: ['name', 'path'],
          },
        },
        {
          name: 'generate_render_config',
          description: 'Generate render.yaml configuration for deployment. Optionally link to existing render.com services using serviceId.',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Service name',
              },
              path: {
                type: 'string',
                description: 'Path to service directory',
              },
              envVars: {
                type: 'object',
                description: 'Environment variables for deployment',
                additionalProperties: {
                  type: 'string',
                },
              },
              serviceId: {
                type: 'string',
                description: 'Existing render.com service ID (e.g., srv-xxxxx) for updates',
              },
              region: {
                type: 'string',
                description: 'Deployment region (overrides global setting)',
                enum: ['oregon', 'ohio', 'frankfurt', 'singapore'],
                default: 'oregon',
              },
              plan: {
                type: 'string',
                description: 'Service plan type',
                enum: ['free', 'individual', 'team', 'business'],
                default: 'free',
              },
            },
            required: ['name', 'path'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'create_deno_service':
          return this.handleCreateService(this.validateCreateServiceArgs(request.params.arguments));
        case 'generate_render_config':
          return this.handleGenerateRenderConfig(this.validateGenerateRenderConfigArgs(request.params.arguments));
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  private validateCreateServiceArgs(args: unknown): CreateServiceArgs {
    if (typeof args !== 'object' || args === null) {
      throw new McpError(ErrorCode.InvalidParams, 'Arguments must be an object');
    }

    const { name, path, port, description } = args as Record<string, unknown>;

    if (typeof name !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'name must be a string');
    }
    if (typeof path !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'path must be a string');
    }

    return {
      name,
      path,
      port: typeof port === 'number' ? port : undefined,
      description: typeof description === 'string' ? description : undefined,
    };
  }

  private validateGenerateRenderConfigArgs(args: unknown): GenerateRenderConfigArgs {
    if (typeof args !== 'object' || args === null) {
      throw new McpError(ErrorCode.InvalidParams, 'Arguments must be an object');
    }

    const { name, path, envVars, serviceId, region, plan } = args as Record<string, unknown>;

    if (typeof name !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'name must be a string');
    }
    if (typeof path !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'path must be a string');
    }
    if (envVars !== undefined && (typeof envVars !== 'object' || envVars === null)) {
      throw new McpError(ErrorCode.InvalidParams, 'envVars must be an object if provided');
    }
    if (serviceId !== undefined && typeof serviceId !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'serviceId must be a string if provided');
    }
    if (region !== undefined && typeof region !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'region must be a string if provided');
    }
    if (plan !== undefined && typeof plan !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'plan must be a string if provided');
    }

    return {
      name,
      path,
      envVars: envVars as Record<string, string> | undefined,
      serviceId: serviceId as string | undefined,
      region: region as string | undefined,
      plan: plan as 'free' | 'individual' | 'team' | 'business' | undefined,
    };
  }

  private async handleCreateService(args: CreateServiceArgs) {
    try {
      const projectPath = path.resolve(args.path, args.name);
      await fs.mkdir(projectPath, { recursive: true });

      // Create main.ts
      const mainContent = `import { Application } from "https://deno.land/x/oak/mod.ts";

const app = new Application();
const port = ${args.port || 8000};

// Logger middleware
app.use(async (ctx, next) => {
  await next();
  const rt = ctx.response.headers.get("X-Response-Time");
  console.log(\`\${ctx.request.method} \${ctx.request.url} - \${rt}\`);
});

// Response time middleware
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  ctx.response.headers.set("X-Response-Time", \`\${ms}ms\`);
});

// Routes
app.use((ctx) => {
  ctx.response.body = { message: "Welcome to your Deno service!" };
});

console.log(\`Server running on http://localhost:\${port}\`);
await app.listen({ port });`;

      await fs.writeFile(path.join(projectPath, 'main.ts'), mainContent);

      // Create deno.json configuration
      const denoConfig = {
        tasks: {
          start: "deno run --allow-net main.ts",
          dev: "deno run --allow-net --watch main.ts",
          test: "deno test --allow-net",
        },
        fmt: {
          files: {
            include: ["**/*.ts"],
          },
          options: {
            lineWidth: 100,
            indentWidth: 2,
          },
        },
        lint: {
          files: {
            include: ["**/*.ts"],
          },
          rules: {
            tags: ["recommended"],
          },
        },
      };

      await fs.writeFile(
        path.join(projectPath, 'deno.json'),
        JSON.stringify(denoConfig, null, 2)
      );

      // Create README.md
      const readmeContent = `# ${args.name}
${args.description ? `\n${args.description}\n` : ''}
## Development

Start the development server:

\`\`\`bash
deno task dev
\`\`\`

Run tests:

\`\`\`bash
deno task test
\`\`\`

## Production

Start the production server:

\`\`\`bash
deno task start
\`\`\`

## API Documentation

- \`GET /\` - Welcome message
`;

      await fs.writeFile(path.join(projectPath, 'README.md'), readmeContent);

      return {
        content: [
          {
            type: 'text',
            text: `Successfully created Deno service at ${projectPath}`,
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        content: [
          {
            type: 'text',
            text: `Failed to create service: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleGenerateRenderConfig(args: GenerateRenderConfigArgs) {
    try {
      const service: RenderServiceConfig = {
        type: 'web',
        name: args.name,
        env: 'deno',
        region: args.region || this.renderConfig.region || 'oregon',
        plan: args.plan || 'free',
        buildCommand: null,
        startCommand: 'deno run --allow-net main.ts',
        envVars: args.envVars || {},
      };

      // Add service ID if provided for existing services
      if (args.serviceId) {
        service.id = args.serviceId;
      }

      const renderConfig = {
        services: [service],
      };

      const configPath = path.join(args.path, 'render.yaml');
      await fs.writeFile(configPath, JSON.stringify(renderConfig, null, 2));

      const configMessage = this.renderConfig.apiKey 
        ? 'Using global render.com configuration from MCP settings.'
        : 'Note: No global render.com API key found. You may need to configure this in your MCP settings.';

      return {
        content: [
          {
            type: 'text',
            text: `Generated render.yaml configuration at ${configPath}\n${configMessage}`,
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        content: [
          {
            type: 'text',
            text: `Failed to generate render config: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Deno Service MCP server running on stdio');
  }
}

const server = new DenoServiceServer();
server.run().catch(console.error);
