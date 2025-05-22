import * as https from 'https';

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
  private readonly GEMINI_API_KEY = 'AIzaSyCMZDAgyMwu8gzZUQ_kSkB7Qdv02NK55To';

  private constructor() {
    this.isAvailable = true; // Direct API call, always available
  }

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  private async callGeminiAPI(requestData: any): Promise<AIResponse> {
    return new Promise((resolve) => {
      const model = 'gemini-1.5-flash';
      const postData = JSON.stringify(requestData);

      const options = {
        hostname: 'generativelanguage.googleapis.com',
        port: 443,
        path: `/v1beta/models/${model}:generateContent?key=${this.GEMINI_API_KEY}`,
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
            text: `${request.systemPrompt || 'Bạn là một trợ lý AI hữu ích về lập trình. Hãy trả lời bằng tiếng Việt.'}\n\n${request.prompt}`
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
