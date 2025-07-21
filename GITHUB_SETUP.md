# GitHub'a Yükleme Talimatları

Bu dosya, AARO ERP MCP Server projesini GitHub'a yükleme adımlarını içerir.

## 🚀 GitHub Repository Oluşturma

### 1. GitHub'da Yeni Repository Oluşturun

1. [GitHub](https://github.com) hesabınıza giriş yapın
2. Sağ üst köşedeki **"+"** butonuna tıklayın
3. **"New repository"** seçeneğini seçin
4. Repository bilgilerini doldurun:
   - **Repository name**: `aaro-erp-mcp-server`
   - **Description**: `AARO ERP MCP Server - Claude Desktop integration for AARO ERP system`
   - **Visibility**: Public (veya Private)
   - **Initialize this repository with**: Hiçbirini seçmeyin (README, .gitignore, license eklemeyin)
5. **"Create repository"** butonuna tıklayın

### 2. Local Repository'yi GitHub'a Bağlayın

Terminal'de proje dizininde aşağıdaki komutları çalıştırın:

```bash
# GitHub repository'nizi remote olarak ekleyin
git remote add origin https://github.com/AaroYazilim/aaro-erp-mcp-server.git

# Ana branch'i main olarak ayarlayın (opsiyonel)
git branch -M main

# İlk push'u yapın
git push -u origin main
```

> **Not**: `AaroYazilim` kısmını kendi GitHub kullanıcı adınızla değiştirin.

## 📝 Repository Ayarları

### 1. Repository Açıklaması ve Konular

GitHub repository sayfanızda:

1. **About** bölümündeki ⚙️ (Settings) ikonuna tıklayın
2. **Description**: `AARO ERP MCP Server - Claude Desktop integration for AARO ERP system`
3. **Website**: `https://aaro.com.tr` (opsiyonel)
4. **Topics** ekleyin:
   - `mcp`
   - `model-context-protocol`
   - `claude-desktop`
   - `aaro-erp`
   - `erp-integration`
   - `typescript`
   - `nodejs`
   - `puppeteer`
   - `api-client`

### 2. Branch Protection (Opsiyonel)

Daha profesyonel bir yaklaşım için:

1. Repository **Settings** > **Branches** bölümüne gidin
2. **Add rule** butonuna tıklayın
3. **Branch name pattern**: `main`
4. Aşağıdaki seçenekleri işaretleyin:
   - ✅ Require pull request reviews before merging
   - ✅ Require status checks to pass before merging

## 🏷️ Release Oluşturma

### İlk Release (v1.0.0)

1. Repository ana sayfasında **Releases** bölümüne gidin
2. **Create a new release** butonuna tıklayın
3. **Tag version**: `v1.0.0`
4. **Release title**: `AARO ERP MCP Server v1.0.0`
5. **Description**:

```markdown
## 🎉 İlk Stabil Sürüm

AARO ERP MCP Server'ın ilk stabil sürümü yayınlandı!

### ✨ Özellikler

- 🔐 **Akıllı Token Yönetimi** - Otomatik token alma ve cache sistemi
- 📊 **Kapsamlı ERP Entegrasyonu** - 17 farklı ERP aracı
- 🚀 **Claude Desktop Entegrasyonu** - MCP protokolü desteği
- 💾 **Token Cache Sistemi** - 60 dakika otomatik saklama
- 🛠️ **TypeScript Desteği** - Tam tip güvenliği

### 📋 Mevcut Araçlar (17 adet)

#### 🔐 Token Yönetimi
- `erp_token_al` - Token alma ve cache yönetimi

#### 📊 Stok Yönetimi
- `erp_stok_listele` - Stok listesi ve filtreleme
- `erp_stok_olustur` - Yeni stok kartı oluşturma
- `erp_stok_hareketleri_listele` - Stok hareketleri
- `erp_seri_lot_listele` - Seri/Lot takibi
- `erp_barkod_listele` - Barkod yönetimi

#### 👥 Cari Yönetimi
- `erp_cari_listele` - Cari hesap listeleme
- `erp_cari_olustur` - Yeni cari hesap oluşturma

#### 📋 Sipariş ve Fatura
- `erp_siparis_listele` - Sipariş hareketleri
- `erp_fatura_listele` - Fatura hareketleri

#### 🏢 Operasyonel Modüller
- `erp_depo_listele` - Depo yönetimi
- `erp_doviz_listele` - Döviz kurları
- `erp_kasa_listele` - Kasa hareketleri
- `erp_banka_listele` - Banka hesapları
- `erp_personel_listele` - Personel bilgileri
- `erp_dekont_listele` - Muhasebe dekontları

#### 🔧 Genel API
- `erp_api_cagir` - Genel API çağrısı

### 🚀 Kurulum

```bash
git clone https://github.com/AaroYazilim/aaro-erp-mcp-server.git
cd aaro-erp-mcp-server
npm install
npm run build
```

### 📋 Gereksinimler

- Node.js v18+
- Claude Desktop
- AARO ERP hesabı

**Full Changelog**: https://github.com/AaroYazilim/aaro-erp-mcp-server/commits/v1.0.0
```

6. **Publish release** butonuna tıklayın

## 🔄 Gelecek Güncellemeler

Yeni özellikler ekledikçe:

```bash
# Değişiklikleri commit edin
git add .
git commit -m "feat: yeni özellik açıklaması"

# GitHub'a push edin
git push origin main

# Yeni release oluşturun (v1.1.0, v1.2.0, vb.)
```

## 📞 Destek

Repository oluşturduktan sonra README.md dosyasındaki aşağıdaki kısımları güncelleyin:

- `AaroYazilim` → Gerçek GitHub kullanıcı adınız
- `info@aaro.com.tr` → Gerçek email adresiniz

## ✅ Kontrol Listesi

- [ ] GitHub repository oluşturuldu
- [ ] Local repository GitHub'a bağlandı
- [ ] İlk commit push edildi
- [ ] Repository açıklaması ve konular eklendi
- [ ] İlk release (v1.0.0) oluşturuldu
- [ ] README.md'deki placeholder'lar güncellendi
- [ ] Repository public/private ayarı yapıldı

Tüm adımlar tamamlandıktan sonra projeniz GitHub'da yayında olacak! 🎉
