# ERP Token Server - Refactoring Rehberi

## 🎉 Yeni Özellikler

### 1. JSON Tabanlı Konfigürasyon
- **config/tools.json**: Tüm tool tanımları
- **config/settings.json**: Genel ayarlar ve güvenlik konfigürasyonu

### 2. Token Maskeleme Sistemi
- Varsayılan olarak tüm token'lar `****` olarak gösterilir
- `show_token: true` parametresi ile tam token görüntülenebilir
- Tüm hassas veriler otomatik maskelenir

### 3. Gelişmiş Logging
- Structured logging sistemi
- Hassas verilerin otomatik maskelenmesi
- Timestamp ve log level desteği

## 📁 Yeni Dosya Yapısı

```
erp-token-server/
├── config/
│   ├── tools.json      # Tool tanımları
│   └── settings.json   # Genel ayarlar
├── src/
│   └── index.ts        # Refactor edilmiş ana kod
├── build/
│   └── index.js        # Derlenmiş kod
└── token-cache.json    # Token cache (otomatik oluşur)
```

## 🔧 Yeni Tool Ekleme

### Basit API Tool Ekleme
`config/tools.json` dosyasına yeni entry ekleyin:

```json
{
  "erp_yeni_tool": {
    "description": "Yeni tool açıklaması",
    "endpoint": "/api/YeniEndpoint",
    "method": "GET",
    "inputSchema": {
      "type": "object",
      "properties": {
        "token": { "type": "string", "description": "ERP API token (zorunlu)" },
        "YeniParametre": { "type": "string", "description": "Yeni parametre" }
      },
      "required": ["token"]
    }
  }
}
```

### Özel Handler Gerektiren Tool
```json
{
  "erp_ozel_tool": {
    "description": "Özel işlem gerektiren tool",
    "handler": "ozelHandler",
    "inputSchema": {
      // schema tanımı
    }
  }
}
```

Ardından `src/index.ts` dosyasında `callSpecialHandler` metoduna yeni case ekleyin.

## 🔐 Token Maskeleme Kullanımı

### Normal Kullanım (Token Maskelenir)
```json
{
  "name": "erp_stok_listele",
  "arguments": {
    "token": "gerçek_token_değeri",
    "EsnekAramaKisiti": "test"
  }
}
```
**Çıktı**: Token `****` olarak gösterilir

### Token Gösterme
```json
{
  "name": "erp_stok_listele",
  "arguments": {
    "token": "gerçek_token_değeri",
    "show_token": true,
    "EsnekAramaKisiti": "test"
  }
}
```
**Çıktı**: Token tam olarak gösterilir

## ⚙️ Konfigürasyon Ayarları

### settings.json Önemli Ayarlar

```json
{
  "security": {
    "maskToken": true,              // Token maskeleme açık/kapalı
    "tokenMask": "****",            // Maskeleme karakteri
    "showFullTokenParam": "show_token", // Token gösterme parametresi
    "sensitiveFields": ["token", "password", "Authorization"]
  },
  "erp": {
    "tokenCacheMinutes": 60         // Token cache süresi
  },
  "logging": {
    "enabled": true,                // Logging açık/kapalı
    "maskSensitiveData": true       // Log'larda hassas veri maskeleme
  }
}
```

## 🚀 Avantajlar

### ✅ Önceki Sistem
- Yeni tool eklemek için 3-4 yerde değişiklik gerekiyordu
- Hardcoded endpoint'ler ve parametreler
- Token güvenliği yoktu
- 600+ satır kod

### ✅ Yeni Sistem
- Yeni tool eklemek sadece JSON'a entry eklemek
- Konfigürasyon dosyalarından yönetim
- Otomatik token maskeleme
- Modüler ve temiz kod yapısı
- Gelişmiş logging sistemi

## 🔄 Migration

Eski sistem tamamen yeni sistemle değiştirildi. Tüm mevcut tool'lar çalışmaya devam edecek, sadece:

1. **Yeni tool ekleme**: `config/tools.json` dosyasını düzenleyin
2. **Ayar değişiklikleri**: `config/settings.json` dosyasını düzenleyin
3. **Token güvenliği**: Artık otomatik olarak maskelenir

## 📝 Örnek Kullanım

```bash
# Build
npm run build

# Test (MCP client ile)
node build/index.js
```

## 🛠️ Geliştirme

Artık yeni özellik eklemek çok kolay:

1. `config/tools.json` dosyasına tool tanımı ekleyin
2. Gerekirse özel handler ekleyin
3. Build edin
4. Test edin

**Artık kod değişikliği yapmadan yeni API endpoint'leri ekleyebilirsiniz!**
