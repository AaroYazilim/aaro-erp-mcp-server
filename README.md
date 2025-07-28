# AARO ERP MCP Server

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-Model_Context_Protocol-blue?style=for-the-badge)](https://modelcontextprotocol.io/)

AARO ERP sistemi için Claude Desktop entegrasyonu sağlayan MCP (Model Context Protocol) server'ı. Bu server, AARO ERP API'sine erişim, token yönetimi ve tüm temel ERP işlemlerini Claude Desktop üzerinden gerçekleştirmenizi sağlar.


## 📋 Mevcut Araçlar Listesi

| Araç Adı | Açıklama | Kategori |
|-----------|----------|----------|
| `erp_token_al` | Token alma ve cache yönetimi | 🔐 Token |
| `erp_token_sil` | Token cache silme | 🔐 Token |
| `erp_stok_listele` | Stok listesi ve filtreleme | 📊 Stok |
| `erp_stok_olustur` | Yeni stok kartı oluşturma | 📊 Stok |
| `erp_stok_hareketleri_listele` | Stok hareketleri | 📊 Stok |
| `erp_seri_lot_listele` | Seri/Lot takibi | 📊 Stok |
| `erp_barkod_listele` | Barkod yönetimi | 📊 Stok |
| `erp_cari_listele` | Cari hesap listeleme | 👥 Cari |
| `erp_cari_olustur` | Yeni cari hesap oluşturma | 👥 Cari |
| `erp_siparis_listele` | Sipariş hareketleri | 📋 Sipariş |
| `erp_fatura_listele` | Fatura hareketleri | 📋 Fatura |
| `erp_depo_listele` | Depo yönetimi | 🏢 Operasyon |
| `erp_doviz_listele` | Döviz kurları | 🏢 Operasyon |
| `erp_kasa_listele` | Kasa hareketleri | 🏢 Operasyon |
| `erp_banka_listele` | Banka hesapları | 🏢 Operasyon |
| `erp_personel_listele` | Personel bilgileri | 🏢 Operasyon |
| `erp_dekont_listele` | Muhasebe dekontları | 🏢 Operasyon |
| `erp_api_cagir` | Genel API çağrısı | 🔧 Genel |

**Toplam: 18 araç**


## 🚀 Hızlı Başlangıç

### Ön Gereksinimler

- [Node.js](https://nodejs.org/) (v18 veya üzeri)
- [Claude Desktop](https://claude.ai/desktop) uygulaması
- AARO ERP hesabı ve erişim yetkisi

### 📦 Kurulum

**Kurulum gerekmez!** NPX ile doğrudan kullanabilirsiniz. Paket otomatik olarak indirilir ve çalıştırılır.

### ⚙️ Claude Desktop Konfigürasyonu

Claude Desktop'ın MCP ayarları dosyasını düzenleyin:

**Windows:**
```
%APPDATA%\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json
```

**macOS:**
```
~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json
```

**Linux:**
```
~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json
```

Aşağıdaki konfigürasyonu ekleyin:

```json
{
  "mcpServers": {
    "aaro-erp": {
      "command": "npx",
      "args": ["aaro-erp-mcp-server"],
      "disabled": false
    }
  }
}
```

### 🔄 Claude Desktop'ı Yeniden Başlatın

Konfigürasyon değişikliklerinin etkili olması için Claude Desktop'ı kapatıp yeniden açın.

### ✅ Kurulum Tamamlandı!

Artık Claude Desktop'ta AARO ERP araçlarını kullanabilirsiniz. İlk kullanımda paket otomatik olarak NPM'den indirilecektir.
 

## 🔐 Güvenlik

- Bearer token authentication
- HTTPS bağlantıları
- Kapsamlı hata yakalama ve raporlama
- Tarayıcı otomasyonu güvenlik önlemleri

## 🛠️ Teknik Detaylar

- **TypeScript** ile tip güvenliği
- **Puppeteer** ile tarayıcı otomasyonu
- **Axios** ile HTTP istekleri
- **MCP SDK** ile Claude Desktop entegrasyonu
- **Modüler yapı** ile kolay genişletme

## 🐛 Hata Ayıklama

Server logları Claude Desktop'ın developer console'unda görüntülenir. Manuel test için:

```bash
npx aaro-erp-mcp-server
```

## 🔧 Geliştirme

### NPM Paketi Bilgileri
- **Paket Adı**: `aaro-erp-mcp-server`
- **Platform Desteği**: Windows, macOS, Linux
- **Node.js Gereksinimi**: v18+
- **Otomatik Güncellemeler**: NPX her çalıştırmada en son sürümü kullanır

### Katkıda Bulunma

1. Bu repository'yi fork edin
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Değişikliklerinizi commit edin (`git commit -m 'Add some amazing feature'`)
4. Branch'inizi push edin (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun

### Test Etme

Server'ın çalışıp çalışmadığını test etmek için:

```bash
# Server'ı manuel olarak başlatın
npx aaro-erp-mcp-server

# Başarılı çıktı:
# [2025-07-21T06:59:59.000Z] [INFO] Konfigürasyon dosyaları başarıyla yüklendi
# [2025-07-21T06:59:59.000Z] [INFO] ERP Token MCP server stdio üzerinde çalışıyor
```

## 🚨 Sorun Giderme

### Yaygın Sorunlar

**1. "Server disconnected" hatası:**
- Node.js versiyonunun v18+ olduğundan emin olun
- İnternet bağlantınızı kontrol edin
- Claude Desktop'ı yeniden başlatın

**2. "Package not found" hatası:**
- NPM'in düzgün kurulu olduğundan emin olun
- `npm cache clean --force` komutunu çalıştırın
- Tekrar deneyin

**3. Token alınamıyor:**
- AARO ERP hesabınızın aktif olduğundan emin olun
- İnternet bağlantınızı kontrol edin
- Tarayıcı popup'larının engellenip engellenmediğini kontrol edin

**4. MCP server görünmüyor:**
- Konfigürasyon dosyasının doğru konumda olduğundan emin olun
- JSON formatının geçerli olduğunu kontrol edin
- `npx aaro-erp-mcp-server` komutunun çalıştığından emin olun

### Manuel Test

Paketi manuel olarak test etmek için:

```bash
# Paketi çalıştır
npx aaro-erp-mcp-server

# Başka bir terminalde test
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | npx aaro-erp-mcp-server
```

### Cache Temizleme

NPX cache'ini temizlemek için:

```bash
# NPX cache temizle
npm cache clean --force

# Belirli paketi temizle
npx clear-npx-cache aaro-erp-mcp-server
```

## 🔄 Sürüm Geçmişi

### v1.0.0 (2025-01-18)
- ✅ İlk stabil sürüm
- ✅ 17 temel ERP aracı
- ✅ Token cache sistemi
- ✅ Otomatik token yönetimi
- ✅ Kapsamlı hata yönetimi
- ✅ TypeScript desteği

## 📞 Destek ve İletişim
- 📧 **Email**: info@aaro.com.tr

