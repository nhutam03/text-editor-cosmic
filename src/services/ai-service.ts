import * as https from 'https';
import { getAIConfig } from '../utils/env-loader';

export interface AIRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIResponse {
  success: boolean;
  content?: string;
  error?: string;
}

export class AIService {
  private static instance: AIService;
  private isAvailable: boolean = false;
  private readonly GEMINI_API_KEY: string;
  private readonly GEMINI_MODEL: string;
  private readonly GEMINI_API_HOSTNAME: string;

  private constructor() {
    // Load configuration from environment variables only
    const aiConfig = getAIConfig();
    this.GEMINI_API_KEY = aiConfig.geminiApiKey || '';
    this.GEMINI_MODEL = aiConfig.geminiModel || '';
    this.GEMINI_API_HOSTNAME = aiConfig.geminiApiHostname || '';

    // Check if all required configuration is available
    this.isAvailable = !!(this.GEMINI_API_KEY && this.GEMINI_MODEL && this.GEMINI_API_HOSTNAME);

    if (!this.isAvailable) {
      console.error('❌ [AIService] Missing required environment variables. Please check your .env file.');
      console.error('Required variables: VITE_GEMINI_API_KEY, VITE_GEMINI_MODEL, VITE_GEMINI_API_HOSTNAME');
    } else {
      console.log('🤖 [AIService] Initialized successfully with environment configuration:', {
        model: this.GEMINI_MODEL,
        hostname: this.GEMINI_API_HOSTNAME,
        apiKeySet: '✓ Set'
      });
    }
  }

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  //API Communication Method
  private async callGeminiAPI(requestData: any): Promise<AIResponse> {
    return new Promise((resolve) => {
      const postData = JSON.stringify(requestData);

      const options = {
        hostname: this.GEMINI_API_HOSTNAME,
        port: 443,
        path: `/v1beta/models/${this.GEMINI_MODEL}:generateContent?key=${this.GEMINI_API_KEY}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);

            if (res.statusCode === 200 && response.candidates && response.candidates[0]) {
              const content = response.candidates[0].content.parts[0].text;
              resolve({
                success: true,
                content: content
              });
            } else {
              console.error('❌ [Gemini API] Error response:', response);
              resolve({
                success: false,
                error: response.error?.message || 'Unknown error from Gemini API'
              });
            }
          } catch (parseError) {
            console.error('❌ [Gemini API] Parse error:', parseError);
            resolve({
              success: false,
              error: 'Failed to parse Gemini API response'
            });
          }
        });
      });

      req.on('error', (error) => {
        console.error('❌ [Gemini API] Request error:', error);
        resolve({
          success: false,
          error: error.message
        });
      });

      req.write(postData);
      req.end();
    });
  }

  public async sendMessage(request: AIRequest): Promise<AIResponse> {
    console.log('🚀 [AIService] Sending message to AI:', request);

    try {
      // Prepare Gemini API request
      const geminiRequestData = {
        contents: [{
          parts: [{
            text: `${request.systemPrompt || 'Bạn là một trợ lý AI hữu ích về lập trình. Hãy trả lời bằng tiếng Việt. Bạn có thể sử dụng markdown formatting: **chữ đậm**, *chữ nghiêng*, `code inline`, ```code blocks```, __gạch dưới__, ~~gạch ngang~~.'}\n\n${request.prompt}`
          }]
        }],
        generationConfig: {
          temperature: request.temperature || 0.7,
          maxOutputTokens: request.maxTokens || 1000
        }
      };

      console.log('📤 [AIService] Calling Gemini API directly...');

      // Call Gemini API directly
      const geminiResponse = await this.callGeminiAPI(geminiRequestData);

      if (geminiResponse.success) {
        console.log('📥 [AIService] Received response from Gemini API');
        return {
          success: true,
          content: geminiResponse.content
        };
      } else {
        console.error('❌ [AIService] Gemini API error:', geminiResponse.error);
        return {
          success: false,
          error: geminiResponse.error || 'Failed to get response from AI service'
        };
      }
    } catch (error: any) {
      console.error('❌ [AIService] Error calling AI service:', error);
      return {
        success: false,
        error: error.message || 'Failed to connect to AI service'
      };
    }
  }

  public isServiceAvailable(): boolean {
    return this.isAvailable;
  }

  public async refreshAvailability(): Promise<boolean> {
    // Direct API call, always available
    return this.isAvailable;
  }
}
