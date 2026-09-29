# Isto kao build.py, za Windows bez Python-a:
#   powershell -ExecutionPolicy Bypass -File build.ps1
# Popunjava {{TOKENE}} iz config.json i ugrađuje sve slike i skripte u index.html.
$root = $PSScriptRoot
$cfg = Get-Content "$root\config.json" -Raw -Encoding UTF8 | ConvertFrom-Json
$inv = [Globalization.CultureInfo]::InvariantCulture
$ll = $cfg.lat.ToString($inv) + "," + $cfg.lng.ToString($inv)
$tokens = @{
  ADDRESS = $cfg.address; POSTAL = $cfg.postal; CITY = $cfg.city
  PHONE_DISPLAY = $cfg.phone_display; PHONE_TEL = $cfg.phone_tel
  RATING = $cfg.rating.ToString($inv)
  RATING_DISPLAY = $cfg.rating.ToString("0.0", $inv).Replace(".", ",")
  RATING_PCT = ($cfg.rating / 5 * 100).ToString("0", $inv) + "%"
  COORDS = $cfg.lat.ToString("0.0000", $inv) + [char]0xB0 + " N " + [char]0xB7 + " " + $cfg.lng.ToString("0.0000", $inv) + [char]0xB0 + " E"
  MAPS_EMBED = "https://maps.google.com/maps?q=$ll&z=17&hl=sr&output=embed"
  MAPS_DIR = "https://www.google.com/maps/dir/?api=1&amp;destination=$ll"
  MAPS_URL = $cfg.maps_link
}
$html = [IO.File]::ReadAllText("$root\source.html")
$html = [regex]::Replace($html, '\{\{(\w+)\}\}', { param($m) $tokens[$m.Groups[1].Value] })
$html = [regex]::Replace($html, '<script src="(assets/js/[^"]+)"></script>', {
  param($m) "<script>" + [IO.File]::ReadAllText("$root\" + $m.Groups[1].Value) + "</script>"
})
$html = [regex]::Replace($html, 'src="(assets/img/[^"]+\.jpg)"', {
  param($m) 'src="data:image/jpeg;base64,' + [Convert]::ToBase64String([IO.File]::ReadAllBytes("$root\" + $m.Groups[1].Value)) + '"'
})
$enc = New-Object Text.UTF8Encoding $false
[IO.File]::WriteAllText("$root\index.html", $html, $enc)
"index.html: {0:N0} KB" -f ((Get-Item "$root\index.html").Length / 1KB)
