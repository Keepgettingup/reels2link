# Plan: Facebook Reels Support

Facebook blockiert Server-IPs beim Auslesen von Reels ("Login Wall"). yt-dlp (unser Downloader) scheitert deshalb mit dem Error "Cannot parse data". Um Facebook Reels zuverlässig zu unterstützen, müssen wir eine eingeloggte Facebook-Session (Cookies) nutzen.

Da persönliche Accounts dafür zu unsicher sind (Sperrgefahr durch Facebook bei Zugriff aus dem Rechenzentrum), hier der Plan für die spätere saubere Umsetzung:

## 1. Vorbereitung (Dummy Account)
- Erstelle einen neuen, separaten Facebook-Account (Dummy-Account), der nur für den Server-Zugriff gedacht ist.
- Logge dich in einem Desktop-Browser (z. B. Chrome) mit diesem Dummy-Account ein.
- Installiere eine Browser-Erweiterung wie **"Get cookies.txt LOCALLY"**.
- Gehe auf `facebook.com`, öffne die Erweiterung und klicke auf "Export".
- Speichere den gesamten Inhalt der exportierten Textdatei.

## 2. Server-Konfiguration (Render)
- Gehe in das Render Dashboard zu den Einstellungen des `reels2link` Web Services.
- Gehe zu "Environment Variables".
- Lege eine neue Variable an:
  - **Key:** `FB_COOKIES`
  - **Value:** *Füge hier den gesamten kopierten Inhalt der Cookie.txt Datei ein*
- Klicke auf "Save". Render wird den Service mit den neuen Cookies neu starten.

*(Der Code im Backend `src/converter.js` ist dafür bereits vorbereitet. Er erkennt die Variable `FB_COOKIES`, schreibt sie kurzzeitig in eine temporäre Datei und nutzt sie für den yt-dlp Download-Befehl.)*

## 3. Code reaktivieren
Wenn die Cookies laufen, müssen wir das Frontend und die Backend-Validierung wieder für Facebook freischalten.

**A) In `src/server.js`:**
Benenne `isValidInstagramUrl` um zu `isValidReelUrl` und ersetze die Regex durch:
```javascript
function isValidReelUrl(url) {
  try {
    const u = new URL(url);
    const hostname = u.hostname.replace(/^www\./, '');
    if (hostname === "instagram.com") {
      return u.pathname.includes('/reel') || u.pathname.includes('/p/') || u.pathname.includes('/tv/');
    }
    if (hostname === "facebook.com" || hostname === "fb.watch" || hostname === "web.facebook.com") {
      return u.pathname.includes('/reel') || u.pathname.includes('/watch') || u.pathname.includes('/videos/') || hostname === "fb.watch";
    }
    return false;
  } catch {
    return false;
  }
}
```

**B) In `src/pages/Home.jsx` & `src/App.jsx`:**
Ändere die Validierungs-Regex auf:
```javascript
const isReel = /^https?:\/\/(www\.)?(instagram\.com\/([A-Za-z0-9_.]+\/)?(reel|reels|p|tv)\/[A-Za-z0-9_-]+|facebook\.com\/(reel|watch|videos)\/[A-Za-z0-9_-]+|fb\.watch\/[A-Za-z0-9_-]+|web\.facebook\.com\/(reel|watch|videos)\/[A-Za-z0-9_-]+)/i.test(url);
```
Passe die Fehlermeldungen und den Input-Placeholder an (`"https://www.instagram.com/reel/... or https://www.facebook.com/reel/..."`).

**C) In `src/pages/VideoViewer.jsx`:**
Passe den "Original" Button an, damit er bei Facebook-URLs ein Facebook-Icon und ein blaues Design anzeigt.

## 4. Wartung (WICHTIG)
Facebook Session-Cookies verfallen irgendwann oder der Dummy-Account wird von Facebook zur Passwort-Zurücksetzung markiert.
Wenn im Live-Betrieb wieder 500er Fehler bei Facebook-Reels auftreten:
1. Neu in den Dummy-Account einloggen.
2. Cookies neu exportieren.
3. Die `FB_COOKIES` Environment Variable in Render austauschen.
4. Render neu starten lassen.
