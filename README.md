# Liona — caffe & bar

Sajt za kafić Liona, Bulevar kralja Aleksandra 173, Beograd (Zvezdara).

## Kako otvoriti
Otvorite **index.html** u Chrome-u (dupli klik). Sve slike i skripte su ugrađene u taj fajl,
pa radi i bez ostalih fajlova (internet treba samo za fontove i Google mapu).

## Kako menjati
- **Adresa, telefon, Google ocena, mapa** → samo u `config.json`.
- **Tekstovi, meni, cene, dizajn** → u `source.html` (koristi fajlove iz `assets/`).

Posle izmene pokrenite build da napravite novi index.html:

    python build.py
    # ili na Windows-u bez Python-a:
    powershell -ExecutionPolicy Bypass -File build.ps1

## Šta još treba dopuniti
- `phone_display` / `phone_tel` u config.json — pravi broj telefona (sada je placeholder).
- `rating` u config.json — prava Google ocena (sada 4,8 kao primer).
- Radno vreme — sajt pretpostavlja „svakog dana do ponoći" (source.html).
- Cene u meniju su okvirne; fotografije su sa Unsplash-a — preporuka je zameniti ih pravim fotografijama lokala.

## Sadržaj
- index.html — gotov sajt (jedan fajl, spreman za hosting)
- source.html — izvorni kod
- config.json — podaci o lokalu
- build.py / build.ps1 — pravi index.html
- assets/js/ — GSAP, ScrollTrigger, Lenis, Three.js, 3D predmeti u meniju (menu3d.js), efekat talasa na početnom ekranu (hero-gl.js)
- assets/img/ — fotografije
