# AARO ERP MCP Server

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-Model_Context_Protocol-blue?style=for-the-badge)](https://modelcontextprotocol.io/)

AARO ERP sistemi için Claude Desktop entegrasyonu sağlayan MCP (Model Context Protocol) server'ı. Bu server, AARO ERP API'sine erişim, token yönetimi ve tüm temel ERP işlemlerini Claude Desktop üzerinden gerçekleştirmenizi sağlar.

## ✨ Özellikler

### 🔐 **Akıllı Token Yönetimi**
- 🤖 **Otomatik Token Alma** - Puppeteer ile tarayıcı otomasyonu
- 💾 **Token Cache Sistemi** - 60 dakika boyunca otomatik saklama
- ⚡ **Hızlı Erişim** - Cache'den token kullanımı ile hızlı API çağrıları
- 🔄 **Otomatik Yenileme** - Süre dolduğunda otomatik token yenileme

### 📊 **Stok Yönetimi**
- 📋 `erp_stok_listele` - Gelişmiş filtreleme ile stok listeleme
- ➕ `erp_stok_olustur` - Yeni stok kartı oluşturma
- 📈 `erp_stok_hareketleri_listele` - Stok hareket takibi
- 🏷️ `erp_seri_lot_listele` - Seri/Lot numarası yönetimi
- 📱 `erp_barkod_listele` - Barkod sistemi entegrasyonu

### 👥 **Cari Yönetimi**
- 📇 `erp_cari_listele` - Müşteri/Tedarikçi listeleme
- ➕ `erp_cari_olustur` - Yeni cari hesap oluşturma
- 🔍 Vergi numarası ile arama
- 📊 Gelişmiş filtreleme seçenekleri

### 📋 **Sipariş ve Fatura İşlemleri**
- 🛒 `erp_siparis_listele` - Sipariş takibi ve yönetimi
- 🧾 `erp_fatura_listele` - Fatura listeleme ve arama
- 📅 Tarih aralığı filtreleme
- 🔢 Belge numarası ile arama

### 🏢 **Operasyonel Modüller**
- 🏪 `erp_depo_listele` - Depo yönetimi
- 💱 `erp_doviz_listele` - Döviz kuru takibi
- 💰 `erp_kasa_listele` - Kasa hareketleri
- 🏦 `erp_banka_listele` - Banka hesap yönetimi
- 👨‍💼 `erp_personel_listele` - Personel bilgileri
- 📄 `erp_dekont_listele` - Muhasebe dekontları

### 🔧 **Genel API Araçları**
- 🌐 `erp_api_cagir` - Herhangi bir AARO ERP endpoint'ine doğrudan erişim

## 🚀 Hızlı Başlangıç

### Ön Gereksinimler

- [Node.js](https://nodejs.org/) (v18 veya üzeri)
- [Claude Desktop](https://claude.ai/desktop) uygulaması
- AARO ERP hesabı ve erişim yetkisi

### 📦 Kurulum

1. **Repository'yi klonlayın:**
```bash
git clone https://github.com/AaroYazilim/aaro-erp-mcp-server.git
cd aaro-erp-mcp-server
```

2. **Bağımlılıkları yükleyin:**
```bash
npm install
```

3. **Projeyi derleyin:**
```bash
npm run build
```

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
      "command": "node",
      "args": ["/FULL/PATH/TO/aaro-erp-mcp-server/build/index.js"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

> **Not:** `/FULL/PATH/TO/aaro-erp-mcp-server` kısmını projeyi klonladığınız tam yol ile değiştirin.

### 🔄 Claude Desktop'ı Yeniden Başlatın

Konfigürasyon değişikliklerinin etkili olması için Claude Desktop'ı kapatıp yeniden açın.

## 🎯 Kullanım Örnekleri

### 1. Token Alma
```
erp_token_al aracını kullan
```

**💡 Token Cache Sistemi:**
- İlk token alımından sonra, token otomatik olarak 60 dakika boyunca saklanır
- Sonraki `erp_token_al` çağrılarında, geçerli token varsa tarayıcı açılmaz
- Token süresi dolduğunda otomatik olarak yeni token alınır
- Cache dosyası: `token-cache.json` (proje dizininde)

### 2. Stok Listeleme
```
erp_stok_listele aracını kullan:
- token: "alınan_token"
- EsnekAramaKisiti: "bilgisayar"
- Sayfa: "1"
- SayfaSatirSayisi: "10"
```

### 3. Yeni Stok Kartı Oluşturma
```
erp_stok_olustur aracını kullan:
- token: "alınan_token"
- StokKodu: "STK001"
- StokAdi: "Test Ürünü"
- StokKisaKodu: "TST"
- StokKisaAdi: "Test"
```

### 4. Cari Listeleme
```
erp_cari_listele aracını kullan:
- token: "alınan_token"
- VergiNo: "1234567890"
```

### 5. Yeni Cari Kartı Oluşturma
```
erp_cari_olustur aracını kullan:
- token: "alınan_token"
- CariKodu: "CRI001"
- CariAdi: "Test Müşteri"
- VergiNo: "1234567890"
```

### 6. Sipariş Listeleme
```
erp_siparis_listele aracını kullan:
- token: "alınan_token"
- TipID: "10013"
- TarihBas: "2024-01-01"
- TarihBit: "2024-12-31"
```

### 7. Fatura Listeleme
```
erp_fatura_listele aracını kullan:
- token: "alınan_token"
- TipID: "10005"
- BelgeNo: "FAT001"
```

## 🔍 Filtreleme Özellikleri

Tüm listeleme araçları gelişmiş filtreleme destekler:

### Filtreleme Örnekleri:
- **StokID="100,101,102"** (çoklu seçim)
- **TipID="!105001"** (hariç tutma)
- **TarihBas="2024-01-01"** (tarih aralığı)
- **Sayfa=2, SayfaSatirSayisi=50** (sayfalama)
- **EsnekAramaKisiti="arama_terimi"** (genel arama)

## 📊 Tip ID'leri

### Stok Tipleri
- **105001** - Fiziksel Stok
- **105002** - Gelir-Gider
- **105003** - Demirbaş

### Cari Tipleri
- **2001** - Standart Cari

### Hareket Tipleri
- **10005** - Satış Faturası
- **10006** - Alış Faturası
- **10009** - Satış İrsaliyesi
- **10013** - Alınan Sipariş
- **10019** - Depolar Arası Transfer

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

## 📝 API Endpoint'leri

- **Base URL**: `https://erp.aaro.com.tr`
- **Token URL**: `https://erp.aaro.com.tr/Account/GeciciErisimAnahtari`
- **API Prefix**: `/api/`

## 🐛 Hata Ayıklama

Server logları için terminal çıktısını kontrol edin:
```bash
node build/index.js
```

## 🔧 Geliştirme

### Proje Yapısı
```
aaro-erp-mcp-server/
├── src/
│   └── index.ts          # Ana server dosyası
├── build/                # Derlenmiş JavaScript dosyaları
├── package.json          # Proje bağımlılıkları
├── tsconfig.json         # TypeScript konfigürasyonu
├── token-cache.json      # Token cache dosyası (otomatik oluşur)
└── README.md            # Bu dosya
```

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
node build/index.js

# Başarılı çıktı:
# ERP Token MCP server stdio üzerinde çalışıyor
```

## 🚨 Sorun Giderme

### Yaygın Sorunlar

**1. "Server disconnected" hatası:**
- Node.js versiyonunun v18+ olduğundan emin olun
- `npm run build` komutunu çalıştırın
- Claude Desktop'ı yeniden başlatın

**2. Token alınamıyor:**
- AARO ERP hesabınızın aktif olduğundan emin olun
- İnternet bağlantınızı kontrol edin
- Tarayıcı popup'larının engellenip engellenmediğini kontrol edin

**3. MCP server görünmüyor:**
- Konfigürasyon dosyasının doğru konumda olduğundan emin olun
- JSON formatının geçerli olduğunu kontrol edin
- Dosya yolunun doğru olduğundan emin olun

### Log Dosyaları

Detaylı hata ayıklama için server loglarını kontrol edin:

```bash
# Windows
node build/index.js 2>&1 | tee debug.log

# macOS/Linux  
node build/index.js 2>&1 | tee debug.log
```

## 📋 Mevcut Araçlar Listesi

| Araç Adı | Açıklama | Kategori |
|-----------|----------|----------|
| `erp_token_al` | Token alma ve cache yönetimi | 🔐 Token |
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

**Toplam: 17 araç**

## 🔄 Sürüm Geçmişi

### v1.0.0 (2025-01-18)
- ✅ İlk stabil sürüm
- ✅ 17 temel ERP aracı
- ✅ Token cache sistemi
- ✅ Otomatik token yönetimi
- ✅ Kapsamlı hata yönetimi
- ✅ TypeScript desteği

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasına bakın.

## 🙏 Teşekkürler

- [AARO ERP](https://aaro.com.tr) - API dokümantasyonu ve destek için
- [Model Context Protocol](https://modelcontextprotocol.io/) - MCP framework için
- [Claude Desktop](https://claude.ai/desktop) - Entegrasyon platformu için

## 📞 Destek ve İletişim

- 🐛 **Bug Report**: [GitHub Issues](https://github.com/AaroYazilim/aaro-erp-mcp-server/issues)
- 💡 **Feature Request**: [GitHub Discussions](https://github.com/AaroYazilim/aaro-erp-mcp-server/discussions)
- 📧 **Email**: your-email@example.com

---

⭐ Bu projeyi beğendiyseniz yıldız vermeyi unutmayın!
