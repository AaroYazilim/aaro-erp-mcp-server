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
import * as os from 'os';
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
}

interface TokenCache {
  token: string;
  expiresAt: number;
  createdAt: number;
  user?: string;
  validFrom?: string;
  validTo?: string;
  group?: string;
  rawText?: string;
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
  private tempUserDataDir: string | null = null;

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
    
    // Geçici profil dizinini temizle
    if (this.tempUserDataDir && fs.existsSync(this.tempUserDataDir)) {
      try {
        fs.rmSync(this.tempUserDataDir, { recursive: true, force: true });
        this.log('Geçici profil dizini temizlendi');
      } catch (error) {
        this.log('Geçici profil dizini temizleme hatası', 'warn', error);
      }
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

      case 'addManualToken':
        return await this.addManualToken(args);

      case 'createStok':
        return await this.createStok(args);

      case 'createCari':
        return await this.createCari(args);

      case 'createDekont':
        return await this.createDekont(args);

      case 'addDekontKalem':
        return await this.addDekontKalem(args);

      case 'updateDekont':
        return await this.updateDekont(args);

      case 'testWebhook':
        return await this.testWebhook(args);

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

  private saveTokenCache(token: string, expiresInMinutes: number = 720): void {
    try {
      const now = Date.now();
      const cache: TokenCache = {
        token,
        expiresAt: now + (expiresInMinutes * 720 * 1000),
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

  private async addManualToken(args: any) {
    try {
      const { tokenText } = args;
      
      if (!tokenText || typeof tokenText !== 'string') {
        throw new Error('tokenText parametresi gerekli ve string olmalı');
      }

      this.log('Manuel token ekleme işlemi başlıyor', 'info', { 
        tokenTextLength: tokenText.length 
      });

      // Token bilgilerini parse et
      const tokenInfo = this.parseTokenInfo(tokenText);
      
      if (!tokenInfo.token) {
        throw new Error('Token parse edilemedi');
      }

      // Token'i cache'e kaydet
      this.saveTokenCacheWithInfo(tokenInfo);

      this.log('Manuel token başarıyla eklendi', 'info', {
        user: tokenInfo.user,
        validFrom: tokenInfo.validFrom,
        validTo: tokenInfo.validTo,
        group: tokenInfo.group,
        tokenLength: tokenInfo.token.length
      });

      return {
        content: [
          {
            type: 'text',
            text: `Manuel token başarıyla cache'e eklendi!\n\nKullanıcı: ${tokenInfo.user || 'Bulunamadı'}\nGeçerlilik Başlangıç: ${tokenInfo.validFrom || 'Bulunamadı'}\nGeçerlilik Bitiş: ${tokenInfo.validTo || 'Bulunamadı'}\nGrup: ${tokenInfo.group || 'Bulunamadı'}\nToken Uzunluğu: ${tokenInfo.token.length} karakter\n\nToken artık API çağrılarında kullanılabilir.`,
          },
        ],
      };
    } catch (error) {
      this.log('Manuel token ekleme hatası', 'error', error);
      return {
        content: [
          {
            type: 'text',
            text: `Manuel token ekleme hatası: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async createStok(args: any) {
    const { StokKodu, StokAdi, StokKisaKodu, StokKisaAdi, TipID, SubeID, SirketID, Brm1ID, StokMuhasebeID, Durum, ...otherParams } = args;
    
    if (!StokKodu || !StokAdi) {
      throw new Error('StokKodu ve StokAdi gerekli');
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
      KayitTipi: '1', // Yeni kayıt
      body: stokData
    });
  }

  private async createCari(args: any) {
    const { CariKodu, CariAdi, VergiNo, VergiDairesiID, TipID, SubeID, SirketID, Durum, ...otherParams } = args;
    
    if (!CariKodu || !CariAdi) {
      throw new Error('CariKodu ve CariAdi gerekli');
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
      KayitTipi: '1', // Yeni kayıt
      body: cariData
    });
  }

  private async createDekont(args: any) {
    const { TipID, Tarih, BelgeNo, Vade, SirketID, SubeID, RefDepoID, CariID, DovizID, Aciklama } = args;
    
    if (!TipID || !Tarih || !BelgeNo || !CariID) {
      throw new Error('TipID, Tarih, BelgeNo ve CariID gerekli');
    }

    const dekontData = {
      Baslik: {
        Tarih,
        BelgeNo,
        Vade: Vade || Tarih,
        TipID: parseInt(TipID),
        SirketID: parseInt(SirketID || '1'),
        SubeID: parseInt(SubeID || '1'),
        RefDepoID: parseInt(RefDepoID || '1')
      },
      KalemTek: {
        KalemTipi: 4, // Cari olduğunu gösterir
        KartID: parseInt(CariID),
        DovizID: parseInt(DovizID || '1'),
        Aciklama: Aciklama || ''
      }
    };

    this.log('Dekont oluşturuluyor', 'info', dekontData);

    return await this.callErpApi('/api/Dekont/Baslik', 'POST', {
      KayitTipi: '1',
      body: dekontData
    });
  }

  private async addDekontKalem(args: any) {
    const { 
      DekontID, 
      StokID, 
      Miktar, 
      Tutar, 
      DovizID, 
      TutarDvz, 
      BA, 
      DepoID, 
      TeslimTarihi, 
      VergiID, 
      VergiOrani 
    } = args;
    
    if (!DekontID || !StokID || !Miktar || !Tutar) {
      throw new Error('DekontID, StokID, Miktar ve Tutar gerekli');
    }

    const kalemData = {
      KalemTipi: 7, // Sabit değer
      DekontID: parseInt(DekontID),
      KartID: parseInt(StokID),
      Miktar: parseFloat(Miktar),
      Tutar: parseFloat(Tutar),
      DovizID: parseInt(DovizID || '1'),
      TutarDvz: parseFloat(TutarDvz || '0'),
      BA: BA || 'A',
      SiparisStok: {
        DepoID: parseInt(DepoID || '1'),
        TeslimTarihi: TeslimTarihi || new Date().toISOString().split('T')[0],
        VergiDetaylari: [
          {
            VergiID: parseInt(VergiID || '1'),
            Oran: parseFloat(VergiOrani || '20'),
            Tutar: parseFloat(Tutar) * (parseFloat(VergiOrani || '20') / 100),
            TutarDvz: 0,
            DovizID: parseInt(DovizID || '1'),
            Matrah: parseFloat(Tutar),
            MatrahDvz: 0,
            BA: BA || 'A'
          }
        ]
      }
    };

    this.log('Dekont kalemi ekleniyor', 'info', kalemData);

    return await this.callErpApi('/api/Dekont/Kalem', 'POST', {
      KayitTipi: '1',
      body: kalemData
    });
  }

  private async updateDekont(args: any) {
    const { 
      DekontID, 
      Tarih, 
      BelgeNo, 
      Vade, 
      SirketID, 
      SubeID, 
      RefDepoID, 
      CariID, 
      DovizID, 
      Aciklama 
    } = args;
    
    if (!DekontID) {
      throw new Error('DekontID gerekli');
    }

    // Sadece verilen parametreleri güncelle
    const updateData: any = {
      DekontID: parseInt(DekontID)
    };

    if (Tarih) updateData.Tarih = Tarih;
    if (BelgeNo) updateData.BelgeNo = BelgeNo;
    if (Vade) updateData.Vade = Vade;
    if (SirketID) updateData.SirketID = parseInt(SirketID);
    if (SubeID) updateData.SubeID = parseInt(SubeID);
    if (RefDepoID) updateData.RefDepoID = parseInt(RefDepoID);
    if (CariID) updateData.CariID = parseInt(CariID);
    if (DovizID) updateData.DovizID = parseInt(DovizID);
    if (Aciklama) updateData.Aciklama = Aciklama;

    this.log('Dekont güncelleniyor', 'info', updateData);

    const dekontUpdateData = {
      Baslik: updateData
    };

    return await this.callErpApi('/api/Dekont/Baslik', 'POST', {
      KayitTipi: '2', // Güncelleme için 2
      body: dekontUpdateData
    });
  }

  private async testWebhook(args: any) {
    const { endpoint, method, body, params } = args;
    
    if (!endpoint || !method) {
      throw new Error('endpoint ve method gerekli');
    }

    try {
      // Token'ı otomatik olarak al (cache'den veya yeni)
      let token = this.getCachedToken();
      if (!token) {
        this.log('Token bulunamadı, yeni token alınıyor...');
        token = await this.getErpToken();
      }

      // Test webhook URL'si
      const webhookUrl = 'https://webhook-test.com/98d5387842dbdb11a49158e688a67d65';
      
      const config: any = {
        method,
        url: webhookUrl,
        headers: {
          'Authorization': encodeURIComponent(token),
          'X-Original-URL': `${this.settings.erp.baseUrl}${endpoint}`,
          'X-Original-Method': method,
          ...this.settings.api.defaultHeaders,
        },
        timeout: this.settings.api.timeout,
      };

      if (method === 'GET') {
        // Query parametrelerini ekle
        if (params && Object.keys(params).length > 0) {
          config.params = params;
        }
      } else if (method === 'POST') {
        if (body) {
          config.data = body;
        }
        
        // POST için query parametreleri de ekle
        if (params && Object.keys(params).length > 0) {
          config.params = params;
        }
      }

      this.log(`Test webhook çağrısı: ${method} ${endpoint}`, 'info', {
        webhookUrl,
        originalEndpoint: endpoint,
        method: config.method,
        params: config.params,
        headers: config.headers
      });
      
      const response = await axios(config);
      
      this.log(`Test webhook başarılı: ${method} ${endpoint}`, 'info', {
        status: response.status,
        dataLength: JSON.stringify(response.data).length
      });
      
      return {
        content: [
          {
            type: 'text',
            text: `Test webhook başarılı!\n\nOriginal Endpoint: ${endpoint}\nMethod: ${method}\nWebhook URL: ${webhookUrl}\n\nResponse:\n${JSON.stringify(response.data, null, 2)}`,
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

      this.log(`Test webhook hatası: ${method} ${endpoint}`, 'error', { error: errorMessage });

      return {
        content: [
          {
            type: 'text',
            text: `Test Webhook Hatası: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async callErpApi(endpoint: string, method: 'GET' | 'POST', args: any) {
    try {
      // Token'ı otomatik olarak al (cache'den veya yeni)
      let token = this.getCachedToken();
      if (!token) {
        this.log('Token bulunamadı, yeni token alınıyor...');
        token = await this.getErpToken();
      }
      
      // URL'nin harici olup olmadığını kontrol et
      const isExternalUrl = endpoint.startsWith('http://') || endpoint.startsWith('https://');
      const finalUrl = isExternalUrl ? endpoint : `${this.settings.erp.baseUrl}${endpoint}`;
      
      const config: any = {
        method,
        url: finalUrl,
        headers: {
          'Authorization': `Bearer ${encodeURIComponent(token)}`,
          ...this.settings.api.defaultHeaders,
        },
        timeout: this.settings.api.timeout,
      };

      // Harici URL için ek header'lar ekle
      if (isExternalUrl) {
        config.headers['X-Original-ERP-URL'] = `${this.settings.erp.baseUrl}${endpoint.replace(/^https?:\/\/[^\/]+/, '')}`;
        config.headers['X-ERP-Token'] = encodeURIComponent(token);
      }

      if (method === 'GET') {
        // Tüm parametreleri query string olarak ekle
        const queryParams = { ...args };
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
        const queryParams = { ...args };
        delete queryParams.endpoint;
        delete queryParams.method;
        delete queryParams.body;
        
        if (Object.keys(queryParams).length > 0) {
          config.params = queryParams;
        }
      }

      this.log(`API çağrısı: ${method} ${endpoint}`, 'info', {
        url: config.url,
        method: config.method,
        params: config.params,
        isExternal: isExternalUrl
      });
      
      const response = await axios(config);
      
      this.log(`API başarılı: ${method} ${endpoint}`, 'info', {
        status: response.status,
        dataLength: JSON.stringify(response.data).length,
        isExternal: isExternalUrl
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

      this.log(`API hatası: ${method} ${endpoint}`, 'error', { error: errorMessage });

      return {
        content: [
          {
            type: 'text',
            text: `API Hatası: ${errorMessage}`,
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
      // Sistemdeki Chrome'u bul
      const possibleChromePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe')
      ];
      
      let chromePath: string | undefined;
      for (const possiblePath of possibleChromePaths) {
        if (fs.existsSync(possiblePath)) {
          chromePath = possiblePath;
          break;
        }
      }
      
      // Tarayıcı başlatma seçenekleri
      let launchOptions: any = {
        headless: this.settings.browser.headless,
        defaultViewport: this.settings.browser.defaultViewport,
        args: [...this.settings.browser.args],
        executablePath: chromePath
      };
      
      if (chromePath) {
        this.log('Sistemdeki Chrome kullanılıyor: ' + chromePath);
      } else {
        this.log('Sistemdeki Chrome bulunamadı, Puppeteer Chromium kullanılıyor');
      }

      // Önce mevcut Chrome'a bağlanmaya çalış
      try {
        this.log('Mevcut Chrome instance\'ına bağlanmaya çalışılıyor...');
        
        // Chrome'un remote debugging portunu kontrol et
        const debuggingPorts = [9222, 9223, 9224, 9225];
        let connectedBrowser = null;
        
        for (const port of debuggingPorts) {
          try {
            const browserWSEndpoint = `ws://127.0.0.1:${port}`;
            this.log(`Port ${port} kontrol ediliyor...`);
            
            // Mevcut Chrome'a bağlanmaya çalış
            connectedBrowser = await puppeteer.connect({
              browserWSEndpoint,
              defaultViewport: this.settings.browser.defaultViewport
            });
            
            this.log(`Mevcut Chrome'a başarıyla bağlanıldı (port: ${port})`);
            this.browser = connectedBrowser;
            break;
            
          } catch (connectError) {
            // Bu port çalışmıyor, diğerini dene
            continue;
          }
        }
        
        // Eğer mevcut Chrome'a bağlanamazsak, yeni instance başlat
        if (!connectedBrowser) {
          this.log('Mevcut Chrome\'a bağlanılamadı, yeni instance başlatılıyor...');
          
          // Geçici profil dizini oluştur
          this.tempUserDataDir = path.join(os.tmpdir(), 'puppeteer-chrome-profile-' + Date.now());
          const originalUserDataDir = path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data');
          
          if (fs.existsSync(originalUserDataDir)) {
            this.log('Geçici profil dizini oluşturuluyor...');
            
            if (!fs.existsSync(this.tempUserDataDir)) {
              fs.mkdirSync(this.tempUserDataDir, { recursive: true });
            }
            
            const defaultProfileDir = path.join(originalUserDataDir, 'Default');
            const tempDefaultDir = path.join(this.tempUserDataDir, 'Default');
            
            if (fs.existsSync(defaultProfileDir) && !fs.existsSync(tempDefaultDir)) {
              fs.mkdirSync(tempDefaultDir, { recursive: true });
              
              const prefsFile = path.join(defaultProfileDir, 'Preferences');
              const tempPrefsFile = path.join(tempDefaultDir, 'Preferences');
              
              if (fs.existsSync(prefsFile)) {
                fs.copyFileSync(prefsFile, tempPrefsFile);
                this.log('Profil tercihleri kopyalandı');
              }
            }
            
            launchOptions.args.push(`--user-data-dir=${this.tempUserDataDir}`);
            launchOptions.args.push('--profile-directory=Default');
          }
          
          // Remote debugging portunu ekle
          launchOptions.args.push('--remote-debugging-port=9222');
          
          this.browser = await puppeteer.launch(launchOptions);
          this.log('Yeni Chrome instance başlatıldı');
        }
        
      } catch (error) {
        this.log('Chrome bağlantısı başarısız, fallback modda başlatılıyor...', 'warn');
        this.browser = await puppeteer.launch(launchOptions);
      }

      if (!this.browser) {
        throw new Error('Tarayıcı başlatılamadı');
      }

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
      const tokenText = await page.$eval(this.settings.erp.tokenSelector, (element) => {
        return element.textContent || element.getAttribute('value') || '';
      });

      if (!tokenText || tokenText.trim() === '') {
        throw new Error('Token elementinde token bulunamadı');
      }

      const cleanTokenText = tokenText.trim();
      this.log(`Token metni alındı, parse ediliyor...`);

      // Token bilgilerini parse et
      const tokenInfo = this.parseTokenInfo(cleanTokenText);
      
      if (!tokenInfo.token) {
        throw new Error('Token parse edilemedi');
      }

      this.log(`Token başarıyla parse edildi`, 'info', {
        user: tokenInfo.user,
        validFrom: tokenInfo.validFrom,
        validTo: tokenInfo.validTo,
        group: tokenInfo.group
      });

      // Token'i cache'e kaydet (parse edilen bilgilerle)
      this.saveTokenCacheWithInfo(tokenInfo);

      // Tarayıcıyı kapat
      await this.browser.close();
      this.browser = null;

      return tokenInfo.token;

    } catch (error) {
      // Hata durumunda tarayıcıyı kapat
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      
      throw new Error(`ERP token alma işlemi başarısız: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
    }
  }

  private parseTokenInfo(tokenText: string): TokenCache {
    try {
      this.log('Token parse işlemi başlıyor', 'info', { tokenTextLength: tokenText.length });
      
      // HTML tag'lerini temizle ve <br> tag'lerini \n ile değiştir
      let cleanText = tokenText
        .replace(/<br\s*\/?>/gi, '\n')  // <br> tag'lerini \n ile değiştir
        .replace(/<[^>]*>/g, '')        // Diğer HTML tag'lerini kaldır
        .replace(/&nbsp;/g, ' ')        // &nbsp; karakterlerini boşluk ile değiştir
        .trim();
      
      this.log('HTML temizlendi', 'info', { cleanTextLength: cleanText.length, cleanText: cleanText.substring(0, 200) + '...' });
      
      // Regex ile direkt parse et (satır bazlı değil, tüm metin üzerinde)
      let user = '';
      let token = '';
      let validFrom = '';
      let validTo = '';
      let group = '';
      
      // Kullanıcı bilgisini bul
      const userMatch = cleanText.match(/Kullanıcı\s*:\s*([^\s]+@[^\s]+)/);
      if (userMatch) {
        user = userMatch[1];
        this.log('Kullanıcı bulundu', 'info', { user });
      }
      
      // Token'ı bul - "Geçici Erişim Anahtarı : " dan sonra boşluk öncesine kadar
      const tokenMatch = cleanText.match(/Geçici Erişim Anahtarı\s*:\s*([A-Za-z0-9_\-]+)/);
      if (tokenMatch) {
        token = tokenMatch[1];
        this.log('Token bulundu', 'info', { tokenLength: token.length, tokenPreview: token.substring(0, 20) + '...' });
      }
      
      // Geçerlilik başlangıç tarihini bul
      const validFromMatch = cleanText.match(/Geçerlilik Başlangıç\s*:\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/);
      if (validFromMatch) {
        validFrom = validFromMatch[1];
        this.log('Başlangıç tarihi bulundu', 'info', { validFrom });
      }
      
      // Geçerlilik bitiş tarihini bul
      const validToMatch = cleanText.match(/Geçerlilik Bitiş\s*:\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/);
      if (validToMatch) {
        validTo = validToMatch[1];
        this.log('Bitiş tarihi bulundu', 'info', { validTo });
      }
      
      // Grup bilgisini bul
      const groupMatch = cleanText.match(/Grup\s*:\s*(\d+)/);
      if (groupMatch) {
        group = groupMatch[1];
        this.log('Grup bulundu', 'info', { group });
      }
      
      // Token bulunamadıysa fallback
      if (!token || token.length < 10) {
        this.log('Token regex ile bulunamadı, fallback deneniyor...', 'warn');
        
        // Fallback: En uzun alfanumerik+özel karakter dizisini bul
        const tokenFallbackMatch = cleanText.match(/([A-Za-z0-9_\-]{100,})/);
        if (tokenFallbackMatch) {
          token = tokenFallbackMatch[1];
          this.log('Fallback token bulundu', 'info', { 
            tokenLength: token.length,
            tokenPreview: token.substring(0, 20) + '...'
          });
        } else {
          throw new Error(`Token bulunamadı. Metin: ${cleanText.substring(0, 200)}...`);
        }
      }
      
      // Geçerlilik bitiş tarihini parse et ve expiresAt hesapla
      let expiresAt = Date.now() + (this.settings.erp.tokenCacheMinutes * 60 * 1000); // Varsayılan
      
      if (validTo) {
        try {
          // "2025-07-25 22:43" formatını parse et
          const [datePart, timePart] = validTo.split(' ');
          const [year, month, day] = datePart.split('-').map(Number);
          const [hour, minute] = timePart.split(':').map(Number);
          
          const expireDate = new Date(year, month - 1, day, hour, minute);
          expiresAt = expireDate.getTime();
          
          this.log(`Token geçerlilik bitiş tarihi parse edildi: ${expireDate.toISOString()}`);
        } catch (parseError) {
          this.log('Token geçerlilik tarihi parse edilemedi, varsayılan süre kullanılıyor', 'warn', parseError);
        }
      }
      
      const result = {
        token,
        expiresAt,
        createdAt: Date.now(),
        user,
        validFrom,
        validTo,
        group,
        rawText: tokenText
      };
      
      this.log('Token parse işlemi tamamlandı', 'info', {
        hasToken: !!result.token,
        tokenLength: result.token.length,
        hasUser: !!result.user,
        hasValidTo: !!result.validTo,
        user: result.user,
        validFrom: result.validFrom,
        validTo: result.validTo,
        group: result.group
      });
      
      return result;
      
    } catch (error) {
      this.log('Token parse hatası', 'error', { 
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        tokenText: tokenText.substring(0, 200) + '...'
      });
      throw new Error(`Token bilgileri parse edilemedi: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
    }
  }

  private saveTokenCacheWithInfo(tokenInfo: TokenCache): void {
    try {
      fs.writeFileSync(this.tokenCacheFile, JSON.stringify(tokenInfo, null, 2));
      
      const remainingMinutes = Math.floor((tokenInfo.expiresAt - Date.now()) / (60 * 1000));
      this.log(`Token cache'e kaydedildi`, 'info', {
        user: tokenInfo.user,
        validFrom: tokenInfo.validFrom,
        validTo: tokenInfo.validTo,
        group: tokenInfo.group,
        remainingMinutes
      });
    } catch (error) {
      this.log('Token cache kaydetme hatası', 'error', error);
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
