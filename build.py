"""Build index.html from source.html: fill {{TOKENS}} from config.json and inline every asset.
Usage: python build.py"""
import base64, json, re
from pathlib import Path

root = Path(__file__).parent
cfg = json.loads((root / "config.json").read_text(encoding="utf-8"))
ll = f"{cfg['lat']},{cfg['lng']}"
tokens = {
    "ADDRESS": cfg["address"],
    "POSTAL": cfg["postal"],
    "CITY": cfg["city"],
    "PHONE_DISPLAY": cfg["phone_display"],
    "PHONE_TEL": cfg["phone_tel"],
    "RATING": str(cfg["rating"]),
    "RATING_DISPLAY": f"{cfg['rating']:.1f}".replace(".", ","),
    "RATING_PCT": f"{cfg['rating'] / 5 * 100:.0f}%",
    "COORDS": f"{cfg['lat']:.4f}° N · {cfg['lng']:.4f}° E",
    "MAPS_EMBED": f"https://maps.google.com/maps?q={ll}&z=17&hl=sr&output=embed",
    "MAPS_DIR": f"https://www.google.com/maps/dir/?api=1&amp;destination={ll}",
    "MAPS_URL": cfg["maps_link"],
}

html = (root / "source.html").read_text(encoding="utf-8")
html = re.sub(r"\{\{(\w+)\}\}", lambda m: tokens[m.group(1)], html)
html = re.sub(r'<script src="(assets/js/[^"]+)"></script>',
              lambda m: "<script>" + (root / m.group(1)).read_text(encoding="utf-8") + "</script>", html)
html = re.sub(r'src="(assets/img/[^"]+\.jpg)"',
              lambda m: 'src="data:image/jpeg;base64,' + base64.b64encode((root / m.group(1)).read_bytes()).decode() + '"', html)
(root / "index.html").write_text(html, encoding="utf-8")
print(f"index.html: {len(html.encode()) / 1024:,.0f} KB")
