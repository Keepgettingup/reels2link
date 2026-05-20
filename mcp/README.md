# MCP Server for Reels2Link

A Model Context Protocol (MCP) server that enables AI agents to interact with the Reels2Link Instagram Reel conversion API. This allows AI assistants to directly convert Instagram Reels into hosted video links programmatically.

## Features

- 🎬 Convert Instagram Reels to hosted video links
- 👤 User authentication and management
- 📊 Conversion statistics and history
- 🔗 Magic link authentication
- 📈 Subscription tier management
- ⏰ Configurable link expiry times

## Installation

### From Source

```bash
git clone https://github.com/Keepgettingup/reels2link.git
cd reels2link/mcp-reels2link
npm install
npm run build
```

### Global Installation

```bash
npm install -g mcp-reels2link
```

## Configuration

The MCP server can be configured in two ways:

### 1. Environment Variables

```bash
export REELS2LINK_API_KEY="spool_live_your_api_key_here"
```

### 2. Claude Desktop Configuration

Add to your Claude Desktop `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "reels2link": {
      "command": "node",
      "args": ["/path/to/mcp-reels2link/dist/index.js"],
      "env": {
        "REELS2LINK_API_KEY": "spool_live_your_api_key_here"
      }
    }
  }
}
```

## Getting an API Key

1. Visit [reels2link.link](https://reels2link.link)
2. Sign up with Google or GitHub
3. Your API key will be available in your account settings or via the magic link authentication

## Available Tools

### `convert_reel`
Convert an Instagram Reel to a hosted video link.

**Parameters:**
- `url` (required): Instagram Reel URL
- `ttl` (optional): Link expiry time (default: "24h")

**Example:**
```
Convert this Instagram Reel: https://instagram.com/reel/ABC123/ with 1 week expiry
```

### `get_user_info`
Get current user information and subscription tier.

**Example:**
```
Show me my account information and current subscription tier
```

### `get_conversion_stats`
Get user conversion statistics.

**Example:**
```
What are my conversion statistics?
```

### `get_conversions`
Get user conversion history.

**Parameters:**
- `limit` (optional): Maximum number of conversions to return (default: 10)

**Example:**
```
Show me my last 5 conversions
```

### `get_video_info`
Get information about a converted video.

**Parameters:**
- `id` (required): Video ID from conversion result

**Example:**
```
Get details for video ID abc12345
```

### `request_magic_link`
Request a magic link for email authentication.

**Parameters:**
- `email` (required): Email address to send magic link to

**Example:**
```
Send a magic link to user@example.com
```

## Usage Examples

### Basic Conversion

```
Convert this Instagram Reel to a hosted link: https://instagram.com/reel/CiD123XYZ/
```

### With Custom Expiry

```
Convert https://instagram.com/reel/CiD123XYZ/ and make it expire in 1 month
```

### Check Account Status

```
What's my current subscription tier and usage statistics?
```

### View Recent Conversions

```
Show me my recent conversions with their details
```

### Get Video Information

```
I need details about the video with ID abc12345
```

## Authentication Workflow

1. **First time setup**: Use `request_magic_link` with your email
2. **Check email**: Click the magic link in your email
3. **Extract API key**: The callback will provide your API key
4. **Configure**: Set the API key in your environment or Claude Desktop config
5. **Start converting**: Use any of the conversion tools

## Error Handling

The server provides clear error messages for common issues:

- Invalid Instagram URLs
- Missing API keys
- Rate limiting
- Expired links
- Network errors

## Development

```bash
# Development mode
npm run dev

# Build for production
npm run build

# Start built server
npm start
```

## API Reference

The MCP server wraps the Reels2Link REST API:

- Base URL: `https://reels2link.onrender.com`
- Authentication: Bearer token
- Rate limits: Based on user tier
- Supported formats: Instagram Reels, Posts, TV

## License

MIT License - see LICENSE file for details

## Support

- 🌐 [Live Site](https://reels2link.link)
- 📧 Support: Available through the platform
- 🐛 Issues: Report via GitHub Issues

---

**Note**: This MCP server requires a valid Reels2Link account. Free tier has usage limits, while paid tiers offer higher limits and additional features.
