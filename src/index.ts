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
  endpoint: string;
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

const isValidErpTokenArgs = (args: any): args is ErpTokenArgs =>
  typeof args === 'object' && args !== null;

const isValidErpApiArgs = (args: any): args is ErpApiArgs =>
  typeof args === 'object' && args !== null && typeof args.endpoint === 'string';

class ErpTokenServer {
  private server: Server;
  private browser: Browser | null = null;
  private tokenCacheFile: string;

  constructor() {
    // Token cache dosyasının yolu
    this.tokenCacheFile = path.join(__dirname, '..', 'token-cache.json');
    this.server = new Server(
      {
        name: 'erp-token-server',
        version: '1.0.0',
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

  private async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    await this.server.close();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'erp_token_al',
          description: 'ERP sisteminden geçici erişim anahtarı (token) alır. Tarayıcıyı açar, kullanıcının şifre girmesini bekler ve #anahtar elementinden token\'i alır.',
          inputSchema: {
            type: 'object',
            properties: {
              password: {
                type: 'string',
                description: 'ERP şifresi (opsiyonel - belirtilmezse kullanıcı manuel girer)',
              },
            },
            required: [],
          },
        },
        {
          name: 'erp_stok_listele',
          description: 'ERP sisteminden stok listesini getirir. Filtreleme parametreleri ile arama yapabilirsiniz.',
          inputSchema: {
            type: 'object',
            properties: {
              token: { type: 'string', description: 'ERP API token (zorunlu)' },
              EsnekAramaKisiti: { type: 'string', description: 'Stok kodunda, adında arama' },
              StokID: { type: 'string', description: 'Belirli stok ID\'si' },
              SirketID: { type: 'string', description: 'Şirket ID filtresi' },
              SubeID: { type: 'string', description: 'Şube ID filtresi' },
              Sayfa: { type: 'string', description: 'Sayfa numarası' },
              SayfaSatirSayisi: { type: 'string', description: 'Sayfa başına kayıt sayısı' }
            },
            required: ['token'],
          },
        },
        {
          name: 'erp_cari_listele',
          description: 'ERP sisteminden cari listesini getirir. Filtreleme parametreleri ile arama yapabilirsiniz.',
          inputSchema: {
            type: 'object',
            properties: {
              token: { type: 'string', description: 'ERP API token (zorunlu)' },
              EsnekAramaKisiti: { type: 'string', description: 'Cari adında, kodunda arama' },
              CariID: { type: 'string', description: 'Belirli cari ID\'si' },
              CariKodu: { type: 'string', description: 'Cari kodu' },
              VergiNo: { type: 'string', description: 'Vergi numarası' },
              Sayfa: { type: 'string', description: 'Sayfa numarası' },
              SayfaSatirSayisi: { type: 'string', description: 'Sayfa başına kayıt sayısı' }
            },
            required: ['token'],
          },
        },
        {
          name: 'erp_depo_listele',
          description: 'ERP sisteminden depo listesini getirir.',
          inputSchema: {
            type: 'object',
            properties: {
              token: { type: 'string', description: 'ERP API token (zorunlu)' },
              EsnekAramaKisiti: { type: 'string', description: 'Depo adında, kodunda arama' },
              DepoID: { type: 'string', description: 'Belirli depo ID\'si' }
            },
            required: ['token'],
          },
        },
        {
          name: 'erp_seri_lot_listele',
          description: 'ERP sisteminden seri/lot listesini getirir.',
          inputSchema: {
            type: 'object',
            properties: {
              token: { type: 'string', description: 'ERP API token (zorunlu)' },
              StokID: { type: 'string', description: 'Stok ID filtresi' },
              SeriLotKodu: { type: 'string', description: 'Seri/Lot kodu' }
            },
            required: ['token'],
          },
        },
        {
          name: 'erp_barkod_listele',
          description: 'ERP sisteminden barkod listesini getirir.',
          inputSchema: {
            type: 'object',
            properties: {
              token: { type: 'string', description: 'ERP API token (zorunlu)' },
              StokID: { type: 'string', description: 'Stok ID filtresi' },
              BarkodNo: { type: 'string', description: 'Barkod numarası' }
            },
            required: ['token'],
          },
        },
        {
          name: 'erp_doviz_listele',
          description: 'ERP sisteminden döviz listesini getirir.',
          inputSchema: {
            type: 'object',
            properties: {
              token: { type: 'string', description: 'ERP API token (zorunlu)' },
              DovizID: { type: 'string', description: 'Döviz ID filtresi' }
            },
            required: ['token'],
          },
        },
        {
          name: 'erp_kasa_listele',
          description: 'ERP sisteminden kasa listesini getirir.',
          inputSchema: {
            type: 'object',
            properties: {
              token: { type: 'string', description: 'ERP API token (zorunlu)' },
              KasaID: { type: 'string', description: 'Kasa ID filtresi' }
            },
            required: ['token'],
          },
        },
        {
          name: 'erp_banka_listele',
          description: 'ERP sisteminden banka listesini getirir.',
          inputSchema: {
            type: 'object',
            properties: {
              token: { type: 'string', description: 'ERP API token (zorunlu)' },
              BankaID: { type: 'string', description: 'Banka ID filtresi' }
            },
            required: ['token'],
          },
        },
        {
          name: 'erp_personel_listele',
          description: 'ERP sisteminden personel listesini getirir.',
          inputSchema: {
            type: 'object',
            properties: {
              token: { type: 'string', description: 'ERP API token (zorunlu)' },
              PersonelID: { type: 'string', description: 'Personel ID filtresi' }
            },
            required: ['token'],
          },
        },
        {
          name: 'erp_stok_olustur',
          description: 'ERP sisteminde yeni stok kartı oluşturur.',
          inputSchema: {
            type: 'object',
            properties: {
              token: { type: 'string', description: 'ERP API token (zorunlu)' },
              StokKodu: { type: 'string', description: 'Stok kodu (zorunlu)' },
              StokAdi: { type: 'string', description: 'Stok adı (zorunlu)' },
              StokKisaKodu: { type: 'string', description: 'Stok kısa kodu' },
              StokKisaAdi: { type: 'string', description: 'Stok kısa adı' },
              TipID: { type: 'string', description: 'Stok tipi (varsayılan: 105001)' },
              SubeID: { type: 'string', description: 'Şube ID (varsayılan: 1)' },
              SirketID: { type: 'string', description: 'Şirket ID (varsayılan: 1)' },
              Brm1ID: { type: 'string', description: 'Birim ID (varsayılan: 1 - Adet)' },
              StokMuhasebeID: { type: 'string', description: 'Muhasebe ID' },
              Durum: { type: 'boolean', description: 'Aktif/Pasif durumu (varsayılan: true)' }
            },
            required: ['token', 'StokKodu', 'StokAdi'],
          },
        },
        {
          name: 'erp_cari_olustur',
          description: 'ERP sisteminde yeni cari kartı oluşturur.',
          inputSchema: {
            type: 'object',
            properties: {
              token: { type: 'string', description: 'ERP API token (zorunlu)' },
              CariKodu: { type: 'string', description: 'Cari kodu (zorunlu)' },
              CariAdi: { type: 'string', description: 'Cari adı (zorunlu)' },
              VergiNo: { type: 'string', description: 'Vergi numarası' },
              VergiDairesiID: { type: 'string', description: 'Vergi dairesi ID' },
              TipID: { type: 'string', description: 'Cari tipi (varsayılan: 2001)' },
              SubeID: { type: 'string', description: 'Şube ID (varsayılan: 1)' },
              SirketID: { type: 'string', description: 'Şirket ID (varsayılan: 1)' },
              Durum: { type: 'boolean', description: 'Aktif/Pasif durumu (varsayılan: true)' }
            },
            required: ['token', 'CariKodu', 'CariAdi'],
          },
        },
        {
          name: 'erp_siparis_listele',
          description: 'ERP sisteminden sipariş hareketlerini listeler.',
          inputSchema: {
            type: 'object',
            properties: {
              token: { type: 'string', description: 'ERP API token (zorunlu)' },
              EsnekArama: { type: 'string', description: 'Genel arama terimi' },
              TipID: { type: 'string', description: 'Sipariş tipi (10013: Alınan Sipariş)' },
              CariID: { type: 'string', description: 'Cari ID filtresi' },
              StokID: { type: 'string', description: 'Stok ID filtresi' },
              TarihBas: { type: 'string', description: 'Başlangıç tarihi (YYYY-MM-DD)' },
              TarihBit: { type: 'string', description: 'Bitiş tarihi (YYYY-MM-DD)' },
              Sayfa: { type: 'string', description: 'Sayfa numarası' },
              SayfaSatirSayisi: { type: 'string', description: 'Sayfa başına kayıt sayısı' }
            },
            required: ['token'],
          },
        },
        {
          name: 'erp_fatura_listele',
          description: 'ERP sisteminden fatura hareketlerini listeler.',
          inputSchema: {
            type: 'object',
            properties: {
              token: { type: 'string', description: 'ERP API token (zorunlu)' },
              EsnekArama: { type: 'string', description: 'Genel arama terimi' },
              TipID: { type: 'string', description: 'Fatura tipi (10005: Satış Faturası, 10006: Alış Faturası)' },
              CariID: { type: 'string', description: 'Cari ID filtresi' },
              StokID: { type: 'string', description: 'Stok ID filtresi' },
              TarihBas: { type: 'string', description: 'Başlangıç tarihi (YYYY-MM-DD)' },
              TarihBit: { type: 'string', description: 'Bitiş tarihi (YYYY-MM-DD)' },
              BelgeNo: { type: 'string', description: 'Belge numarası' },
              Sayfa: { type: 'string', description: 'Sayfa numarası' },
              SayfaSatirSayisi: { type: 'string', description: 'Sayfa başına kayıt sayısı' }
            },
            required: ['token'],
          },
        },
        {
          name: 'erp_stok_hareketleri_listele',
          description: 'ERP sisteminden stok hareketlerini listeler.',
          inputSchema: {
            type: 'object',
            properties: {
              token: { type: 'string', description: 'ERP API token (zorunlu)' },
              EsnekArama: { type: 'string', description: 'Genel arama terimi' },
              StokID: { type: 'string', description: 'Stok ID filtresi' },
              TipID: { type: 'string', description: 'Hareket tipi' },
              CariID: { type: 'string', description: 'Cari ID filtresi' },
              DepoID: { type: 'string', description: 'Depo ID filtresi' },
              TarihBas: { type: 'string', description: 'Başlangıç tarihi (YYYY-MM-DD)' },
              TarihBit: { type: 'string', description: 'Bitiş tarihi (YYYY-MM-DD)' },
              Sayfa: { type: 'string', description: 'Sayfa numarası' },
              SayfaSatirSayisi: { type: 'string', description: 'Sayfa başına kayıt sayısı' }
            },
            required: ['token'],
          },
        },
        {
          name: 'erp_dekont_listele',
          description: 'ERP sisteminden dekont başlıklarını listeler.',
          inputSchema: {
            type: 'object',
            properties: {
              token: { type: 'string', description: 'ERP API token (zorunlu)' },
              BelgeNo: { type: 'string', description: 'Belge numarası filtresi' },
              TipID: { type: 'string', description: 'Dekont tipi' },
              TarihBas: { type: 'string', description: 'Başlangıç tarihi (YYYY-MM-DD)' },
              TarihBit: { type: 'string', description: 'Bitiş tarihi (YYYY-MM-DD)' },
              Sayfa: { type: 'string', description: 'Sayfa numarası' },
              SayfaSatirSayisi: { type: 'string', description: 'Sayfa başına kayıt sayısı' }
            },
            required: ['token'],
          },
        },
        {
          name: 'erp_api_cagir',
          description: 'ERP API\'sine genel amaçlı çağrı yapar. Herhangi bir endpoint\'e istek gönderebilirsiniz.',
          inputSchema: {
            type: 'object',
            properties: {
              token: { type: 'string', description: 'ERP API token (zorunlu)' },
              endpoint: { type: 'string', description: 'API endpoint (örn: /api/Stok)' },
              method: { type: 'string', enum: ['GET', 'POST'], description: 'HTTP metodu' },
              params: { type: 'object', description: 'Query parametreleri' },
              body: { type: 'object', description: 'POST body verisi' }
            },
            required: ['token', 'endpoint'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'erp_token_al':
            if (!isValidErpTokenArgs(args)) {
              throw new McpError(ErrorCode.InvalidParams, 'Geçersiz ERP token parametreleri');
            }
            const token = await this.getErpToken(args.password);
            return {
              content: [{ type: 'text', text: `ERP Token başarıyla alındı: ${token}` }],
            };

          case 'erp_stok_listele':
            return await this.callErpApi('/api/Stok', 'GET', args);

          case 'erp_cari_listele':
            return await this.callErpApi('/api/Cari/', 'GET', args);

          case 'erp_depo_listele':
            return await this.callErpApi('/api/Depo', 'GET', args);

          case 'erp_seri_lot_listele':
            return await this.callErpApi('/api/SeriLot', 'GET', args);

          case 'erp_barkod_listele':
            return await this.callErpApi('/api/StokBarkod', 'GET', args);

          case 'erp_doviz_listele':
            return await this.callErpApi('/api/Doviz', 'GET', args);

          case 'erp_kasa_listele':
            return await this.callErpApi('/api/Kasa/GetKayit', 'GET', args);

          case 'erp_banka_listele':
            return await this.callErpApi('/api/Banka/GetKayit', 'GET', args);

          case 'erp_personel_listele':
            return await this.callErpApi('/api/Personel/Get', 'GET', args);

          case 'erp_stok_olustur':
            return await this.createStok(args);

          case 'erp_cari_olustur':
            return await this.createCari(args);

          case 'erp_siparis_listele':
            return await this.callErpApi('/api/SipStokHareketleri', 'GET', args);

          case 'erp_fatura_listele':
            return await this.callErpApi('/api/StokHareketleri', 'GET', args);

          case 'erp_stok_hareketleri_listele':
            return await this.callErpApi('/api/StokHareketleri', 'GET', args);

          case 'erp_dekont_listele':
            return await this.callErpApi('/api/Dekont/Basliklar', 'GET', args);

          case 'erp_api_cagir':
            if (!isValidErpApiArgs(args)) {
              throw new McpError(ErrorCode.InvalidParams, 'Geçersiz API çağrı parametreleri');
            }
            return await this.callErpApi(args.endpoint, args.method || 'GET', args);

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Bilinmeyen araç: ${name}`);
        }
      } catch (error) {
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

  // Token cache metodları
  private loadTokenCache(): TokenCache | null {
    try {
      if (fs.existsSync(this.tokenCacheFile)) {
        const data = fs.readFileSync(this.tokenCacheFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Token cache okuma hatası:', error);
    }
    return null;
  }

  private saveTokenCache(token: string, expiresInMinutes: number = 60): void {
    try {
      const now = Date.now();
      const cache: TokenCache = {
        token,
        expiresAt: now + (expiresInMinutes * 700 * 1000),
        createdAt: now
      };
      
      fs.writeFileSync(this.tokenCacheFile, JSON.stringify(cache, null, 2));
      console.error(`Token cache'e kaydedildi. Süre: ${expiresInMinutes} dakika`);
    } catch (error) {
      console.error('Token cache kaydetme hatası:', error);
    }
  }

  private isTokenValid(): boolean {
    const cache = this.loadTokenCache();
    if (!cache) return false;
    
    const now = Date.now();
    const isValid = now < cache.expiresAt;
    
    if (!isValid) {
      console.error('Token süresi dolmuş, yeni token gerekli');
      // Süresi dolmuş cache'i sil
      try {
        fs.unlinkSync(this.tokenCacheFile);
      } catch (error) {
        console.error('Eski token cache silme hatası:', error);
      }
    }
    
    return isValid;
  }

  private getCachedToken(): string | null {
    if (this.isTokenValid()) {
      const cache = this.loadTokenCache();
      if (cache) {
        const remainingMinutes = Math.floor((cache.expiresAt - Date.now()) / (60 * 1000));
        console.error(`Cached token kullanılıyor. Kalan süre: ${remainingMinutes} dakika`);
        return cache.token;
      }
    }
    return null;
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
        url: `https://erp.aaro.com.tr${endpoint}`,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
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

      console.error(`ERP API çağrısı: ${method} ${endpoint}`);
      
      const response = await axios(config);
      
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

    console.error('Cache\'de geçerli token bulunamadı, yeni token alınıyor...');

    try {
      // Tarayıcıyı başlat
      this.browser = await puppeteer.launch({
        headless: false, // Kullanıcının görebilmesi için görünür mod
        defaultViewport: null,
        args: ['--start-maximized']
      });

      const page = await this.browser.newPage();
      
      // ERP URL'sine git
      await page.goto('https://erp.aaro.com.tr/Account/GeciciErisimAnahtari?', {
        waitUntil: 'networkidle2'
      });

      console.error('ERP sayfası açıldı, kullanıcı girişi bekleniyor...');

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
              console.error('Şifre otomatik olarak girildi');
              break;
            } catch (e) {
              // Bu selektör bulunamadı, diğerini dene
              continue;
            }
          }
        } catch (e) {
          console.error('Şifre alanı bulunamadı, kullanıcı manuel girmeli');
        }
      }

      // #anahtar elementinin görünmesini bekle
      console.error('#anahtar elementi bekleniyor...');
      
      await page.waitForSelector('#anahtar', {
        visible: true,
        timeout: 300000 // 5 dakika timeout
      });

      console.error('#anahtar elementi bulundu, token alınıyor...');

      // Token'i al
      const token = await page.$eval('#anahtar', (element) => {
        return element.textContent || element.getAttribute('value') || '';
      });

      if (!token || token.trim() === '') {
        throw new Error('#anahtar elementinde token bulunamadı');
      }

      const cleanToken = token.trim();
      console.error(`Token başarıyla alındı: ${cleanToken}`);

      // Token'i cache'e kaydet (60 dakika geçerlilik süresi)
      this.saveTokenCache(cleanToken, 60);

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
    console.error('ERP Token MCP server stdio üzerinde çalışıyor');
  }
}

const server = new ErpTokenServer();
server.run().catch(console.error);
