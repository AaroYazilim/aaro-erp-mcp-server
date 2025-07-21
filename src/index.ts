#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import puppeteer, { Browser, Page } from 'puppeteer';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ErpTokenArgs {
  password?: string;
}

interface ErpApiArgs {
  endpoint?: string;
  method?: 'GET' | 'POST';
  params?: Record<string, any>;
  body?: any;
  token?: string;
}

interface TokenCache {
  token: string;
  expiresAt: number;
  createdAt: number;
}

interface ToolConfig {
  description: string;
  endpoint?: string;
  method?: string;
  handler?: string;
  inputSchema: any;
}

interface Settings {
  server: {
    name: string;
    version: string;
  };
  erp: {
    baseUrl: string;
    loginUrl: string;
    tokenSelector: string;
    tokenCacheMinutes: number;
  };
  browser: {
    headless: boolean;
    timeout: number;
    defaultViewport: any;
    args: string[];
  };
  api: {
    defaultHeaders: Record<string, string>;
    timeout: number;
  };
  logging: {
    enabled: boolean;
    level: string;
  };
}

const isValidErpTokenArgs = (args: any): args is ErpTokenArgs =>
  typeof args === 'object' && args !== null;

const isValidErpApiArgs = (args: any): args is ErpApiArgs =>
  typeof args === 'object' && args !== null;

class ErpTokenServer {
  private server: Server;
  private browser: Browser | null = null;
  private tokenCacheFile: string;
  private toolsConfig: Record<string, ToolConfig> = {};
  private settings: Settings = {} as Settings;

  constructor() {
    // Konfigürasyon dosyalarını yükle
    this.loadConfigurations();
    
    // Token cache dosyasının yolu
    this.tokenCacheFile = path.join(__dirname, '..', 'token-cache.json');
    
    this.server = new Server(
      {
        name: this.settings.server.name,
        version: this.settings.server.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.cleanup();
      process.exit(0);
    });
  }

  private loadConfigurations() {
    try {
      // Settings yükle
      const settingsPath = path.join(__dirname, '..', 'config', 'settings.json');
      this.settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      
      // Tools konfigürasyonu yükle
      const toolsPath = path.join(__dirname, '..', 'config', 'tools.json');
      this.toolsConfig = JSON.parse(fs.readFileSync(toolsPath, 'utf8'));
      
      this.log('Konfigürasyon dosyaları başarıyla yüklendi');
    } catch (error) {
      console.error('Konfigürasyon dosyaları yüklenirken hata:', error);
      process.exit(1);
    }
  }

  private log(message: string, level: string = 'info', data?: any) {
    if (!this.settings.logging.enabled) return;
    
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [${level.toUpperCase()}] ${message}`, data || '');
  }


  private async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    await this.server.close();
  }

  private setupToolHandlers() {
    // Tools listesini dinamik olarak oluştur
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = Object.entries(this.toolsConfig).map(([name, config]) => ({
        name,
        description: config.description,
        inputSchema: config.inputSchema,
      }));

      return { tools };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        const toolConfig = this.toolsConfig[name];
        if (!toolConfig) {
          throw new McpError(ErrorCode.MethodNotFound, `Bilinmeyen araç: ${name}`);
        }

        // Request bilgilerini logla
        this.log(`Tool çağrısı: ${name}`, 'info', { 
          tool: name, 
          params: args 
        });

        // Özel handler varsa onu kullan
        if (toolConfig.handler) {
          return await this.callSpecialHandler(toolConfig.handler, args);
        }

        // Normal API çağrısı
        if (toolConfig.endpoint && toolConfig.method) {
          return await this.callErpApi(toolConfig.endpoint, toolConfig.method as 'GET' | 'POST', args);
        }

        throw new McpError(ErrorCode.InternalError, `Tool konfigürasyonu eksik: ${name}`);

      } catch (error) {
        this.log(`Tool hatası: ${name}`, 'error', error);
        return {
          content: [
            {
              type: 'text',
              text: `Hata: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async callSpecialHandler(handlerName: string, args: any) {
    switch (handlerName) {
      case 'getErpToken':
        if (!isValidErpTokenArgs(args)) {
          throw new McpError(ErrorCode.InvalidParams, 'Geçersiz ERP token parametreleri');
        }
        const token = await this.getErpToken(args.password);
        return {
          content: [{ type: 'text', text: `ERP Token başarıyla alındı: ${token}` }],
        };

      case 'deleteToken':
        return await this.deleteToken();

      case 'createStok':
        return await this.createStok(args);

      case 'createCari':
        return await this.createCari(args);

      case 'callErpApi':
        if (!isValidErpApiArgs(args)) {
          throw new McpError(ErrorCode.InvalidParams, 'Geçersiz API çağrı parametreleri');
        }
        return await this.callErpApi(args.endpoint!, args.method || 'GET', args);

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Bilinmeyen handler: ${handlerName}`);
    }
  }

  // Token cache metodları
  private loadTokenCache(): TokenCache | null {
    try {
      if (fs.existsSync(this.tokenCacheFile)) {
        const data = fs.readFileSync(this.tokenCacheFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      this.log('Token cache okuma hatası', 'error', error);
    }
    return null;
  }

  private saveTokenCache(token: string, expiresInMinutes: number = 60): void {
    try {
      const now = Date.now();
      const cache: TokenCache = {
        token,
        expiresAt: now + (expiresInMinutes * 60 * 1000),
        createdAt: now
      };
      
      fs.writeFileSync(this.tokenCacheFile, JSON.stringify(cache, null, 2));
      this.log(`Token cache'e kaydedildi. Süre: ${expiresInMinutes} dakika`);
    } catch (error) {
      this.log('Token cache kaydetme hatası', 'error', error);
    }
  }

  private isTokenValid(): boolean {
    const cache = this.loadTokenCache();
    if (!cache) return false;
    
    const now = Date.now();
    const isValid = now < cache.expiresAt;
    
    if (!isValid) {
      this.log('Token süresi dolmuş, yeni token gerekli');
      // Süresi dolmuş cache'i sil
      try {
        fs.unlinkSync(this.tokenCacheFile);
      } catch (error) {
        this.log('Eski token cache silme hatası', 'error', error);
      }
    }
    
    return isValid;
  }

  private getCachedToken(): string | null {
    if (this.isTokenValid()) {
      const cache = this.loadTokenCache();
      if (cache) {
        const remainingMinutes = Math.floor((cache.expiresAt - Date.now()) / (60 * 1000));
        this.log(`Cached token kullanılıyor. Kalan süre: ${remainingMinutes} dakika`);
        return cache.token;
      }
    }
    return null;
  }

  private async deleteToken() {
    try {
      if (fs.existsSync(this.tokenCacheFile)) {
        fs.unlinkSync(this.tokenCacheFile);
        this.log('Token cache başarıyla silindi');
        return {
          content: [{ type: 'text', text: 'Token cache başarıyla silindi. Yeni API çağrıları için yeni token alınması gerekecek.' }],
        };
      } else {
        this.log('Silinecek token cache bulunamadı');
        return {
          content: [{ type: 'text', text: 'Silinecek token cache bulunamadı. Cache zaten boş.' }],
        };
      }
    } catch (error) {
      this.log('Token cache silme hatası', 'error', error);
      return {
        content: [
          {
            type: 'text',
            text: `Token cache silme hatası: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async createStok(args: any) {
    const { token, StokKodu, StokAdi, StokKisaKodu, StokKisaAdi, TipID, SubeID, SirketID, Brm1ID, StokMuhasebeID, Durum, ...otherParams } = args;
    
    if (!token || !StokKodu || !StokAdi) {
      throw new Error('Token, StokKodu ve StokAdi gerekli');
    }

    const stokData = {
      StokID: -1, // Yeni kayıt için -1
      StokKodu,
      StokAdi,
      StokKisaKodu: StokKisaKodu || StokKodu,
      StokKisaAdi: StokKisaAdi || StokAdi,
      TipID: TipID || '105001', // Varsayılan stok tipi
      SubeID: SubeID || '1',
      SirketID: SirketID || '1',
      Brm1ID: Brm1ID || '1', // Varsayılan birim: Adet
      StokMuhasebeID: StokMuhasebeID || '201',
      Durum: Durum !== undefined ? Durum : true,
      ...otherParams
    };

    return await this.callErpApi('/api/Stok', 'POST', {
      token,
      KayitTipi: '1', // Yeni kayıt
      body: stokData
    });
  }

  private async createCari(args: any) {
    const { token, CariKodu, CariAdi, VergiNo, VergiDairesiID, TipID, SubeID, SirketID, Durum, ...otherParams } = args;
    
    if (!token || !CariKodu || !CariAdi) {
      throw new Error('Token, CariKodu ve CariAdi gerekli');
    }

    const cariData = {
      CariID: -1, // Yeni kayıt için -1
      CariKodu,
      CariAdi,
      VergiNo: VergiNo || '',
      VergiDairesiID: VergiDairesiID || null,
      TipID: TipID || '2001', // Varsayılan cari tipi
      SubeID: SubeID || '1',
      SirketID: SirketID || '1',
      Durum: Durum !== undefined ? Durum : true,
      ...otherParams
    };

    return await this.callErpApi('/api/Cari', 'POST', {
      token,
      KayitTipi: '1', // Yeni kayıt
      body: cariData
    });
  }

  private async callErpApi(endpoint: string, method: 'GET' | 'POST', args: any) {
    const { token, ...params } = args;
    
    if (!token) {
      throw new Error('Token gerekli');
    }
    
    try {
      const config: any = {
        method,
        url: `${this.settings.erp.baseUrl}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${token}`,
          ...this.settings.api.defaultHeaders,
        },
        timeout: this.settings.api.timeout,
      };

      if (method === 'GET') {
        // Token hariç tüm parametreleri query string olarak ekle
        const queryParams = { ...params };
        delete queryParams.token;
        delete queryParams.endpoint;
        delete queryParams.method;
        delete queryParams.body;
        
        if (Object.keys(queryParams).length > 0) {
          config.params = queryParams;
        }
      } else if (method === 'POST') {
        if (args.body) {
          config.data = args.body;
        }
        
        // POST için query parametreleri de ekle
        const queryParams = { ...params };
        delete queryParams.token;
        delete queryParams.endpoint;
        delete queryParams.method;
        delete queryParams.body;
        
        if (Object.keys(queryParams).length > 0) {
          config.params = queryParams;
        }
      }

      this.log(`ERP API çağrısı: ${method} ${endpoint}`, 'info', {
        url: config.url,
        method: config.method,
        params: config.params
      });
      
      const response = await axios(config);
      
      this.log(`ERP API başarılı: ${method} ${endpoint}`, 'info', {
        status: response.status,
        dataLength: JSON.stringify(response.data).length
      });
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response.data, null, 2),
          },
        ],
      };
    } catch (error) {
      let errorMessage = 'Bilinmeyen hata';
      
      if (axios.isAxiosError(error)) {
        if (error.response) {
          errorMessage = `HTTP ${error.response.status}: ${error.response.statusText}`;
          if (error.response.data) {
            errorMessage += `\n${JSON.stringify(error.response.data, null, 2)}`;
          }
        } else if (error.request) {
          errorMessage = 'İstek gönderildi ancak yanıt alınamadı';
        } else {
          errorMessage = error.message;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      this.log(`ERP API hatası: ${method} ${endpoint}`, 'error', { error: errorMessage });

      return {
        content: [
          {
            type: 'text',
            text: `ERP API Hatası: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async getErpToken(password?: string): Promise<string> {
    // Önce cache'den token kontrol et
    const cachedToken = this.getCachedToken();
    if (cachedToken) {
      return cachedToken;
    }

    this.log('Cache\'de geçerli token bulunamadı, yeni token alınıyor...');

    try {
      // Tarayıcıyı başlat
      this.browser = await puppeteer.launch({
        headless: this.settings.browser.headless,
        defaultViewport: this.settings.browser.defaultViewport,
        args: this.settings.browser.args
      });

      const page = await this.browser.newPage();
      
      // ERP URL'sine git
      await page.goto(this.settings.erp.loginUrl, {
        waitUntil: 'networkidle2'
      });

      this.log('ERP sayfası açıldı, kullanıcı girişi bekleniyor...');

      // Eğer şifre verilmişse otomatik doldur
      if (password) {
        try {
          // Şifre alanını bul ve doldur (genel şifre input selektörleri)
          const passwordSelectors = [
            'input[type="password"]',
            '#password',
            '#Password',
            '[name="password"]',
            '[name="Password"]'
          ];

          for (const selector of passwordSelectors) {
            try {
              await page.waitForSelector(selector, { timeout: 2000 });
              await page.type(selector, password);
              this.log('Şifre otomatik olarak girildi');
              break;
            } catch (e) {
              // Bu selektör bulunamadı, diğerini dene
              continue;
            }
          }
        } catch (e) {
          this.log('Şifre alanı bulunamadı, kullanıcı manuel girmeli');
        }
      }

      // Token elementinin görünmesini bekle
      this.log('Token elementi bekleniyor...');
      
      await page.waitForSelector(this.settings.erp.tokenSelector, {
        visible: true,
        timeout: this.settings.browser.timeout
      });

      this.log('Token elementi bulundu, token alınıyor...');

      // Token'i al
      const token = await page.$eval(this.settings.erp.tokenSelector, (element) => {
        return element.textContent || element.getAttribute('value') || '';
      });

      if (!token || token.trim() === '') {
        throw new Error('Token elementinde token bulunamadı');
      }

      const cleanToken = token.trim();
      this.log(`Token başarıyla alındı: ${cleanToken}`);

      // Token'i cache'e kaydet
      this.saveTokenCache(cleanToken, this.settings.erp.tokenCacheMinutes);

      // Tarayıcıyı kapat
      await this.browser.close();
      this.browser = null;

      return cleanToken;

    } catch (error) {
      // Hata durumunda tarayıcıyı kapat
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      
      throw new Error(`ERP token alma işlemi başarısız: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.log('ERP Token MCP server stdio üzerinde çalışıyor');
  }
}

const server = new ErpTokenServer();
server.run().catch(console.error);
