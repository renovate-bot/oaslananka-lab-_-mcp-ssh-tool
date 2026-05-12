# ChatGPT Desktop ile MCP SSH Tool Kullanımı

Bu kılavuz, MCP SSH Tool'u ChatGPT Desktop uygulaması ile nasıl kullanacağınızı açıklar.

## Kurulum

### Otomatik Kurulum (Önerilen)

```bash
pnpm run setup:chatgpt
```

Bu komut, ChatGPT Desktop yapılandırma dosyasını otomatik olarak günceller.

### Manuel Kurulum

1. ChatGPT Desktop yapılandırma dosyasını açın:
   - **macOS**: `~/Library/Application Support/ChatGPT/mcp.json`
   - **Windows**: `%APPDATA%\ChatGPT\mcp.json`
   - **Linux**: `~/.config/chatgpt/mcp.json`

2. Aşağıdaki yapılandırmayı ekleyin:

```json
{
  "mcpServers": {
    "ssh-mcp": {
      "name": "io.github.oaslananka/mcp-ssh-tool",
      "description": "Secure SSH MCP automation server",
      "command": "pnpm",
      "args": ["dlx", "mcp-ssh-tool"]
    }
  }
}
```

3. ChatGPT Desktop'ı yeniden başlatın.

---

## Kullanım Örnekleri

ChatGPT'ye doğal dille SSH işlemleri yaptırabilirsiniz:

### Bağlantı Kurma

```
"myserver.example.com sunucusuna user1 kullanıcısı ile bağlan"
```

### Komut Çalıştırma

```
"Sunucuda disk kullanımını kontrol et"
"Son 100 satır nginx loglarını göster"
"/var/www klasöründeki dosyaları listele"
```

### Dosya İşlemleri

```
"nginx.conf dosyasını oku"
"Yapılandırma dosyasına yeni bir satır ekle"
"/etc/hosts dosyasını göster"
```

### Paket Yönetimi

```
"nginx paketini kur"
"nginx servisini yeniden başlat"
```

---

## Mevcut Araçlar

| Araç | Açıklama |
|------|----------|
| `ssh_open_session` | SSH bağlantısı aç |
| `ssh_close_session` | Oturumu kapat |
| `ssh_list_sessions` | Aktif oturumları listele |
| `proc_exec` | Komut çalıştır |
| `fs_read` | Dosya oku |
| `fs_write` | Dosya yaz |
| `fs_list` | Dizin listele |
| `ensure_package` | Paket kur |
| `ensure_service` | Servis yönet |

Tam liste için: `ssh_ping`, `fs_stat`, `fs_mkdirp`, `fs_rmrf`, `os_detect`, `ensure_lines_in_file`, `ssh_list_configured_hosts`, `ssh_resolve_host`, `get_metrics`

---

## Güvenlik Notları

- SSH anahtarlarınızı, parolalarınızı ve bearer token değerlerinizi sohbete yazmayın.
- Varsayılan host-key politikası strict moddur; `known_hosts` dosyanızı hazırlayın.
- Mutasyon ve yıkıcı işlemler politika tarafından kontrol edilir.
- Oturumlar 15 dakika sonra otomatik olarak kapanır.

---

## Sorun Giderme

### "Session not found" Hatası
Oturum süresi dolmuş olabilir. Yeni bir bağlantı kurun.

### "Authentication failed" Hatası
- SSH anahtarınızın doğru yapılandırıldığından emin olun
- Varsa şifre ile bağlanmayı deneyin

### ChatGPT MCP araçlarını görmüyor
1. ChatGPT Desktop'ı tamamen kapatın
2. `pnpm run setup:chatgpt` komutunu çalıştırın
3. ChatGPT Desktop'ı yeniden başlatın
