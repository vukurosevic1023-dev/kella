# Edit source.html (it uses assets/ folder), then run this to produce the finished site:
# index.html with every image and script inlined — one file that works anywhere.
$root = $PSScriptRoot
$html = [IO.File]::ReadAllText("$root\source.html")

$html = [regex]::Replace($html, '<script src="(assets/js/[^"]+)"></script>', {
  param($m) "<script>" + [IO.File]::ReadAllText("$root\" + $m.Groups[1].Value) + "</script>"
})
$html = [regex]::Replace($html, 'src="(assets/img/[^"]+\.jpg)"', {
  param($m) 'src="data:image/jpeg;base64,' + [Convert]::ToBase64String([IO.File]::ReadAllBytes("$root\" + $m.Groups[1].Value)) + '"'
})

$enc = New-Object Text.UTF8Encoding $false
foreach ($out in 'index.html') {
  [IO.File]::WriteAllText("$root\$out", $html, $enc)
  "{0}: {1:N0} KB" -f $out, ((Get-Item "$root\$out").Length / 1KB)
}
