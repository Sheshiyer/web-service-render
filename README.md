# Web Service Render MCP Server

An MCP (Model Context Protocol) server that simplifies the creation and deployment of Deno web services to render.com. This server provides tools to scaffold new Deno projects with best practices and generate deployment configurations for render.com.

## Features

- Create new Deno web services with a standardized project structure
- Generate render.com deployment configurations
- Built-in support for environment variables and service configuration
- Multiple deployment region support
- Flexible service plan options in render.com

## Installation

```bash
npm install
npm run build
```

## Configuration

### Environment Variables

The server supports the following environment variables for render.com configuration:

- `RENDER_API_KEY`: Your render.com API key
- `RENDER_REGION`: Default deployment region (optional, defaults to 'oregon')

These can be configured in your MCP settings file.

## Available Tools

### 1. create_deno_service

Creates a new Deno web service project with best practices and a standardized structure.

**Parameters:**
- `name` (required): Service name
- `path` (required): Directory to create the service in
- `port` (optional): Port number for the service (default: 8000)
- `description` (optional): Service description

**Example:**
```json
{
  "name": "my-deno-service",
  "path": "./services",
  "port": 8000,
  "description": "My awesome Deno service"
}
```

### 2. generate_render_config

Generates a render.yaml configuration file for deploying your service to render.com.

**Parameters:**
- `name` (required): Service name
- `path` (required): Path to service directory
- `envVars` (optional): Environment variables for deployment
- `serviceId` (optional): Existing render.com service ID for updates
- `region` (optional): Deployment region (oregon, ohio, frankfurt, singapore)
- `plan` (optional): Service plan type (free, individual, team, business)

**Example:**
```json
{
  "name": "my-deno-service",
  "path": "./services/my-deno-service",
  "envVars": {
    "API_KEY": "your-api-key"
  },
  "region": "oregon",
  "plan": "free"
}
```

## Generated Project Structure

When creating a new Deno service, the following files are generated:

```
your-service/
├── main.ts           # Main application entry point
├── deno.json        # Deno configuration and tasks
└── README.md        # Project documentation
```

### Features of Generated Projects

- Oak framework for HTTP server
- Built-in logging middleware
- Response time tracking
- Configured development tasks
- Code formatting and linting setup
- Basic API structure

## Development

To contribute to this MCP server:

1. Clone the repository
2. Install dependencies: `npm install`
3. Make your changes
4. Build the project: `npm run build`

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
