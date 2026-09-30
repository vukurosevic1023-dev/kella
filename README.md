# Avgust — coffee & cake bar

Sajt za kafić **„Avgust" coffee & cake bar**, Bulevar kralja Aleksandra 225, Lion (Zvezdara), Beograd.
Telefon 062 111 0321 · svakog dana 08–22h · Instagram [@kafeterija.avgust](https://www.instagram.com/kafeterija.avgust/)

## Kako otvoriti
Otvorite **index.html** u Chrome-u (dupli klik). Sve slike i skripte su ugrađene u taj fajl,
pa radi i bez ostalih fajlova (internet je potreban samo za fontove i Google mapu).

## Kako menjati
1. Izmene se rade u **source.html** (koristi fajlove iz foldera `assets/`).
2. Pokrenite build da napravi novi index.html sa svim ugrađenim fajlovima:

       python build.py
   ili na Windows-u:

       powershell -ExecutionPolicy Bypass -File build.ps1

## Sadržaj
- index.html — gotov sajt (jedan fajl, spreman za hosting)
- source.html — izvorni kod za izmene
- assets/js/ — GSAP, ScrollTrigger, Lenis, Three.js
  - menu3d.js — 3D predmeti u meniju i lebdeće parče torte na početnom ekranu
  - anatomy3d.js — „Anatomija torte": 3D torta na stalku koja se pri skrolovanju rastavlja sloj po sloj
  - hero-gl.js — efekat talasa na fotografiji početnog ekrana
- assets/img/ — fotografije (Unsplash)

## Napomene
- Cene i ponuda u meniju su okvirne — zamenite ih pravim cenama i tortama iz vitrine.
- Fotografije su sa Unsplash-a; preporuka je zameniti ih pravim fotografijama lokala i torti
  (isti nazivi fajlova u `assets/img/`, pa `python build.py`).
- Radno vreme (08–22h) je podešeno u skripti na dnu source.html (`OPEN` / `CLOSE`) — status „otvoreno/zatvoreno"
  i odbrojavanje se računaju po beogradskom vremenu.
