// =============================================================================
// sw.js – Custom Service Worker för Jannes Maskin & Smide
// Hanteras av VitePWA med strategies: 'injectManifest'.
// Workbox injicerar precache-manifest via self.__WB_MANIFEST nedan.
// =============================================================================

import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { clientsClaim } from "workbox-core";

// Workbox injicerar precache-listan här vid build
precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

// Ta över gamla service workers direkt (matchar vite.config workbox.clientsClaim + skipWaiting)
self.skipWaiting();
clientsClaim();

// =============================================================================
// PUSH – ta emot Web Push-notifikationer
// Körs även när appen är stängd. Ingen fetch eller React-kontext behövs.
// Undertrycker separat OS-/webbläsarnotis om adminpanelen redan är öppen och fokuserad
// (eftersom den interna toasten då redan visas i gränssnittet via Realtime).
// =============================================================================
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    console.error("[sw] push: failed to parse payload");
    return;
  }

  const title = data.title || "Jannes Maskin & Smide";
  const options = {
    body:              data.body || "",
    icon:              data.icon || "/Jannes-Maskin-o-Smide/pwa-192x192.png",
    badge:             data.badge || "/Jannes-Maskin-o-Smide/pwa-192x192.png",
    tag:               data.tag  || "jms-push",
    data:              { url: data.url || "/Jannes-Maskin-o-Smide/admin.html#/admin" },
    requireInteraction: false,
    silent:            false,
    vibrate:           [200, 100, 200],
  };

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Kontrollera om adminpanelen är öppen, synlig och fokuserad
        const hasFocusedAdmin = clientList.some((client) => {
          const isUrlMatch = client.url.includes("admin");
          const isVisible = client.visibilityState === "visible";
          const isFocused = Boolean(client.focused);
          return isUrlMatch && isVisible && isFocused;
        });

        if (hasFocusedAdmin) {
          // Adminpanelen är aktiv och fokuserad på denna enhet.
          // Den interna toasten visas redan via Realtime; undertryck OS-notis.
          return;
        }

        // Adminpanelen är minimerad, i bakgrundsflik eller stängd: visa notis
        return self.registration.showNotification(title, options);
      })
      .catch((err) => {
        // Fail-safe: Om klientkontrollen fallerar, visa alltid notisen så vi inte missar larm
        console.error("[sw] Misslyckades att kontrollera aktiva klienter, fallback till notis:", err);
        return self.registration.showNotification(title, options);
      })
  );
});

// =============================================================================
// NOTIFICATION CLICK – öppna/fokusera adminpanelen på rätt förfrågan
// =============================================================================
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url
    || "/Jannes-Maskin-o-Smide/admin.html#/admin";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Kolla om adminpanelen redan är öppen
        for (const client of clientList) {
          if (
            client.url.includes("admin") &&
            "focus" in client &&
            "navigate" in client
          ) {
            // Fokusera befintlig klient utan att navigera/ladda om
            return client.focus();
          }
        }
        // Öppna nytt fönster med adminpanelen
        return self.clients.openWindow(targetUrl);
      })
  );
});
