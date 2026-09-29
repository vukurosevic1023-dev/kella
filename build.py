"""Build index.html: inlines every script and image from assets/ into source.html -> one self-contained file.
Run:  python build.py"""
import base64, pathlib, re

root = pathlib.Path(__file__).resolve().parent
html = (root / 'source.html').read_text(encoding='utf-8')
html = re.sub(r'<script src="(assets/js/[^"]+)"></script>',
              lambda m: '<script>' + (root / m.group(1)).read_text(encoding='utf-8') + '</script>', html)
html = re.sub(r'src="(assets/img/[^"]+\.jpg)"',
              lambda m: 'src="data:image/jpeg;base64,' + base64.b64encode((root / m.group(1)).read_bytes()).decode() + '"', html)
out = root / 'index.html'
out.write_text(html, encoding='utf-8')
print(f'index.html: {out.stat().st_size / 1024:,.0f} KB')
