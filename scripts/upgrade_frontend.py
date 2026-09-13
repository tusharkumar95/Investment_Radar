from pathlib import Path

path = Path("index.html")
text = path.read_text(encoding="utf-8")

# Add the custom-stock entry point immediately below the Long/Short selector.
button = '''\n        <div style="display:flex;justify-content:flex-end;margin:-10px 0 18px;">\n            <a href="custom.html" style="display:inline-block;background:#ffffff;color:#263442;border:1px solid #d8dde3;border-radius:14px;padding:11px 16px;font-weight:800;text-decoration:none;box-shadow:0 5px 15px rgba(20,30,40,0.05);">⭐ My Stocks / Custom</a>\n        </div>\n'''
marker = '''        <!-- =====================================\n             RADAR VIEW\n        ====================================== -->'''
if 'href="custom.html"' not in text:
    if marker not in text:
        raise SystemExit("Could not find Radar View marker in index.html")
    text = text.replace(marker, button + "\n" + marker, 1)

# Load the enhanced valuation and analysis layers before app.js.
if 'engine/valuationV2.js' not in text:
    marker = '    <script src="detail.js"></script>'
    if marker not in text:
        raise SystemExit("Could not find detail.js script tag in index.html")
    text = text.replace(marker, '    <script src="engine/valuationV2.js"></script>\n' + marker, 1)

if 'engine/radarInsights.js' not in text:
    marker = '    <script src="app.js"></script>'
    if marker not in text:
        raise SystemExit("Could not find app.js script tag in index.html")
    text = text.replace(marker, '    <script src="engine/radarInsights.js"></script>\n' + marker, 1)

path.write_text(text, encoding="utf-8")
print("Frontend upgrade applied: My Stocks link + enhanced analysis loaders.")
