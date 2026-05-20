#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

interface Reels2LinkConfig {
  apiKey?: string;
  baseUrl?: string;
}

class Reels2LinkMCPServer {
  private server: Server;
  private config: Reels2LinkConfig;

  constructor(config: Reels2LinkConfig = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.REELS2LINK_API_KEY,
      baseUrl: config.baseUrl || 'https://reels2link.onrender.com',
    };

    this.server = new Server(
      {
        name: 'reels2link-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupTools();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupTools(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'convert_reel',
            description: 'Convert an Instagram Reel to a hosted video link',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'Instagram Reel URL (e.g., https://instagram.com/reel/ABC123/)',
                },
                ttl: {
                  type: 'string',
                  description: 'Link expiry time (e.g., 1h, 24h, 7d, 1mo, 1y)',
                  default: '24h',
                },
              },
              required: ['url'],
            },
          },
          {
            name: 'get_user_info',
            description: 'Get current user information and subscription tier',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'get_conversion_stats',
            description: 'Get user conversion statistics',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'get_conversions',
            description: 'Get user conversion history',
            inputSchema: {
              type: 'object',
              properties: {
                limit: {
                  type: 'number',
                  description: 'Maximum number of conversions to return',
                  default: 10,
                },
              },
            },
          },
          {
            name: 'get_video_info',
            description: 'Get information about a converted video',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'Video ID from conversion result',
                },
              },
              required: ['id'],
            },
          },
          {
            name: 'request_magic_link',
            description: 'Request a magic link for email authentication',
            inputSchema: {
              type: 'object',
              properties: {
                email: {
                  type: 'string',
                  description: 'Email address to send magic link to',
                },
              },
              required: ['email'],
            },
          },
        ] as Tool[],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'convert_reel':
            return await this.convertReel(args.url, args.ttl);
          case 'get_user_info':
            return await this.getUserInfo();
          case 'get_conversion_stats':
            return await this.getConversionStats();
          case 'get_conversions':
            return await this.getConversions(args.limit);
          case 'get_video_info':
            return await this.getVideoInfo(args.id);
          case 'request_magic_link':
            return await this.requestMagicLink(args.email);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${errorMessage}`,
            },
          ],
        };
      }
    });
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    return fetch(url, {
      ...options,
      headers,
    });
  }

  private async convertReel(url: string, ttl: string = '24h') {
    if (!this.isValidInstagramUrl(url)) {
      throw new Error('Invalid Instagram URL. Must be an Instagram Reel, Post, or TV URL.');
    }

    const response = await this.makeRequest('/api/convert', {
      method: 'POST',
      body: JSON.stringify({ url, ttl }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Conversion failed: ${error}`);
    }

    const result = await response.json();
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ Reel converted successfully!\n\n🔗 Direct Link: ${result.link}\n⏰ Expires: ${result.expires}\n📊 Size: ${result.size_mb}MB\n\nThe video is now hosted and ready to share.`,
        },
      ],
    };
  }

  private async getUserInfo() {
    if (!this.config.apiKey) {
      throw new Error('API key required for this operation. Set REELS2LINK_API_KEY environment variable or authenticate first.');
    }

    const response = await this.makeRequest('/api/me');
    
    if (!response.ok) {
      throw new Error('Failed to get user info');
    }

    const user = await response.json();
    
    return {
      content: [
        {
          type: 'text',
          text: `👤 User Information:\n\n📧 Email: ${user.email}\n🏷️  Tier: ${user.tier}\n📊 Usage Count: ${user.usage_count}\n📅 Daily Usage: ${user.daily_usage}\n📈 Monthly Usage: ${user.monthly_usage}\n${user.subscription_ends_at ? `🔄 Subscription: ${new Date(user.subscription_ends_at).toLocaleDateString()}` : '🆓 Free Tier'}`,
        },
      ],
    };
  }

  private async getConversionStats() {
    if (!this.config.apiKey) {
      throw new Error('API key required for this operation');
    }

    const response = await this.makeRequest('/api/stats');
    
    if (!response.ok) {
      throw new Error('Failed to get conversion stats');
    }

    const stats = await response.json();
    
    return {
      content: [
        {
          type: 'text',
          text: `📊 Conversion Statistics:\n\n🔢 Total Conversions: ${stats.total_conversions || 0}\n📹 Total Size: ${stats.total_size_mb || 0}MB\n📅 Today: ${stats.today_conversions || 0}\n📈 This Week: ${stats.week_conversions || 0}\n📊 This Month: ${stats.month_conversions || 0}`,
        },
      ],
    };
  }

  private async getConversions(limit: number = 10) {
    if (!this.config.apiKey) {
      throw new Error('API key required for this operation');
    }

    const response = await this.makeRequest('/api/my-conversions');
    
    if (!response.ok) {
      throw new Error('Failed to get conversions');
    }

    const conversions = await response.json();
    const limited = conversions.slice(0, limit);
    
    if (limited.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: '📋 No conversions found. Start by converting an Instagram Reel!',
          },
        ],
      };
    }

    const conversionList = limited.map((conv: any, index: number) => 
      `${index + 1}. ${conv.instagram_url}\n   📅 Created: ${new Date(conv.created_at).toLocaleDateString()}\n   📊 Size: ${conv.size_mb}MB\n   🔗 Link: ${conv.link}\n   ⏰ Expires: ${conv.expires_at}`
    ).join('\n\n');

    return {
      content: [
        {
          type: 'text',
          text: `📋 Recent Conversions (${limited.length} of ${conversions.length} total):\n\n${conversionList}`,
        },
      ],
    };
  }

  private async getVideoInfo(id: string) {
    const response = await this.makeRequest(`/api/v/${id}`);
    
    if (!response.ok) {
      throw new Error('Video not found or expired');
    }

    const video = await response.json();
    
    return {
      content: [
        {
          type: 'text',
          text: `🎬 Video Information:\n\n🆔 ID: ${video.id}\n🔗 Original URL: ${video.instagram_url}\n📹 CDN URL: ${video.cdn_url}\n📊 Size: ${video.size_mb}MB\n👁️  Views: ${video.views}\n⏰ Expires: ${new Date(video.expires_at).toLocaleDateString()}\n📅 Created: ${new Date(video.created_at).toLocaleDateString()}`,
        },
      ],
    };
  }

  private async requestMagicLink(email: string) {
    const response = await this.makeRequest('/api/auth/request-link', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send magic link: ${error}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: `✅ Magic link sent to ${email}!\n\nCheck your email and click the link to authenticate. After authentication, you can use the API key provided in the callback.`,
        },
      ],
    };
  }

  private isValidInstagramUrl(url: string): boolean {
    return /instagram\.com\/(reel|p|tv)\/[A-Za-z0-9_-]+/.test(url);
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Reels2Link MCP server running on stdio');
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new Reels2LinkMCPServer();
  server.run().catch(console.error);
}

export { Reels2LinkMCPServer };
