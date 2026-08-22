import re, sys, html, datetime

def inline(s):
    s = html.escape(s, quote=False)
    s = re.sub(r'`([^`]+)`', r'<code>\1</code>', s)
    s = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', s)
    s = re.sub(r'\*\*\*(.+?)\*\*\*', r'<strong><em>\1</em></strong>', s)
    s = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', s)
    s = re.sub(r'(?<!\*)\*([^*\n]+)\*(?!\*)', r'<em>\1</em>', s)
    s = re.sub(r'~~(.+?)~~', r'<del>\1</del>', s)
    s = re.sub(r'(?<!\w)_([^_\n]+)_(?!\w)', r'<em>\1</em>', s)
    return s

def is_table_sep(l):
    return bool(re.match(r'^\s*\|?[\s:|-]+\|[\s:|-]*$', l)) and '-' in l

def cells(l):
    l = l.strip()
    if l.startswith('|'): l = l[1:]
    if l.endswith('|'): l = l[:-1]
    return [c.strip() for c in l.split('|')]

def render(lines):
    out, i, n = [], 0, len(lines)
    while i < n:
        l = lines[i]
        if not l.strip():
            i += 1; continue
        if re.match(r'^\s*(\*\s*){3,}$|^\s*(-\s*){3,}$|^\s*(_\s*){3,}$', l):
            out.append('<hr>'); i += 1; continue
        m = re.match(r'^(#{1,6})\s+(.*)$', l)
        if m:
            lv = len(m.group(1)); out.append(f'<h{lv}>{inline(m.group(2).strip())}</h{lv}>'); i += 1; continue
        if l.lstrip().startswith('>'):
            blk = []
            while i < n and (lines[i].lstrip().startswith('>') or (blk and lines[i].strip() and not re.match(r'^\s*$', lines[i]) and False)):
                blk.append(re.sub(r'^\s*>\s?', '', lines[i])); i += 1
            out.append('<blockquote>' + render(blk) + '</blockquote>'); continue
        if '|' in l and i + 1 < n and is_table_sep(lines[i+1]):
            head = cells(l); align = []
            for c in cells(lines[i+1]):
                align.append('center' if c.startswith(':') and c.endswith(':') else 'right' if c.endswith(':') else 'left')
            i += 2; body = []
            while i < n and '|' in lines[i] and lines[i].strip():
                body.append(cells(lines[i])); i += 1
            t = ['<div class="tw"><table><thead><tr>']
            for j, c in enumerate(head):
                a = align[j] if j < len(align) else 'left'
                t.append(f'<th style="text-align:{a}">{inline(c)}</th>')
            t.append('</tr></thead><tbody>')
            for row in body:
                t.append('<tr>')
                for j, c in enumerate(row):
                    a = align[j] if j < len(align) else 'left'
                    t.append(f'<td style="text-align:{a}">{inline(c)}</td>')
                t.append('</tr>')
            t.append('</tbody></table></div>')
            out.append(''.join(t)); continue
        m = re.match(r'^(\s*)([-*+]|\d+[.)])\s+(.*)$', l)
        if m:
            ordered = not m.group(2) in ('-', '*', '+')
            tag = 'ol' if ordered else 'ul'
            items, base = [], len(m.group(1))
            while i < n:
                mm = re.match(r'^(\s*)([-*+]|\d+[.)])\s+(.*)$', lines[i])
                if not mm: break
                ind = len(mm.group(1))
                if ind < base: break
                if ind > base:
                    sub = []
                    while i < n:
                        m2 = re.match(r'^(\s*)([-*+]|\d+[.)])\s+', lines[i])
                        if not m2 or len(m2.group(1)) <= base: break
                        sub.append(lines[i][base+2:]); i += 1
                    if items: items[-1] += render(sub)
                    continue
                txt = mm.group(3)
                i += 1
                while i < n and lines[i].strip() and not re.match(r'^(\s*)([-*+]|\d+[.)])\s+|^#{1,6}\s|^\s*>', lines[i]) and '|' not in lines[i]:
                    txt += ' ' + lines[i].strip(); i += 1
                items.append(inline(txt))
            out.append(f'<{tag}>' + ''.join(f'<li>{x}</li>' for x in items) + f'</{tag}>')
            continue
        para = []
        while i < n and lines[i].strip() and not re.match(r'^#{1,6}\s|^\s*>|^\s*([-*+]|\d+[.)])\s', lines[i]) \
              and not ('|' in lines[i] and i + 1 < n and is_table_sep(lines[i+1])):
            para.append(lines[i].rstrip()); i += 1
        if para:
            out.append('<p>' + '<br>'.join(inline(x) for x in para) + '</p>')
    return ''.join(out)

CSS = """
:root{--bg:#fbfaf7;--fg:#1b1b1a;--mut:#6a6a66;--line:#e2ded4;--acc:#8a2b1f;--card:#fff;--hl:#fff8e6}
@media(prefers-color-scheme:dark){:root{--bg:#15161a;--fg:#e8e6e1;--mut:#9c9a94;--line:#2e3038;--acc:#e0776a;--card:#1c1e23;--hl:#26241c}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);
 font:16px/1.62 -apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",system-ui,sans-serif}
.wrap{max-width:900px;margin:0 auto;padding:28px 22px 120px}
h1,h2,h3,h4,h5,h6{line-height:1.25;font-weight:700}
h1{font-size:1.85em;margin:.2em 0 .5em;letter-spacing:-.02em}
h2{font-size:1.4em;margin:2.2em 0 .5em;padding-bottom:.28em;border-bottom:2px solid var(--acc)}
h3{font-size:1.14em;margin:1.7em 0 .4em;color:var(--acc)}
h4,h5,h6{font-size:1em;margin:1.3em 0 .3em}
p{margin:.55em 0}
a{color:var(--acc)}
code{background:var(--hl);border:1px solid var(--line);border-radius:4px;padding:.08em .32em;
 font:.86em/1.4 ui-monospace,SFMono-Regular,Menlo,monospace}
hr{border:0;border-top:1px solid var(--line);margin:2em 0}
blockquote{margin:1em 0;padding:.7em 1em;background:var(--card);
 border-left:4px solid var(--acc);border-radius:0 8px 8px 0}
blockquote>:first-child{margin-top:0}blockquote>:last-child{margin-bottom:0}
blockquote h1,blockquote h2,blockquote h3{font-size:1.06em;margin:.2em 0 .4em;border:0;padding:0;color:inherit}
ul,ol{margin:.5em 0;padding-left:1.35em}
li{margin:.22em 0}
.tw{overflow-x:auto;margin:1em 0;border:1px solid var(--line);border-radius:8px;background:var(--card)}
table{border-collapse:collapse;width:100%;font-size:.9em}
th,td{padding:.5em .7em;border-bottom:1px solid var(--line);vertical-align:top}
th{background:var(--hl);font-weight:700;white-space:nowrap;position:sticky;top:0}
tr:last-child td{border-bottom:0}
.meta{color:var(--mut);font-size:.8em;margin:0 0 2em;padding-bottom:1em;border-bottom:1px solid var(--line)}
#toc{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 18px;margin:0 0 2.4em}
#toc b{display:block;font-size:.72em;letter-spacing:.09em;text-transform:uppercase;color:var(--mut);margin-bottom:.5em}
#toc a{display:block;padding:.18em 0;text-decoration:none;font-size:.92em}
#toc a.l3{padding-left:1.1em;font-size:.86em;color:var(--mut)}
@media print{
 :root{--bg:#fff;--fg:#000;--card:#fff;--hl:#f2f2f2;--line:#bbb;--acc:#8a2b1f;--mut:#555}
 body{font-size:9.6pt;line-height:1.45}
 .wrap{max-width:none;padding:0}
 #toc,.noprint{display:none}
 h1,h2,h3,h4{page-break-after:avoid}
 table,blockquote,.tw{page-break-inside:avoid}
 th{position:static}
 a{color:#000;text-decoration:none}
 @page{margin:12mm 11mm}
}
"""

src = open(sys.argv[1], encoding='utf-8').read().replace('\t', '    ')
lines = src.split('\n')
body = render(lines)

def slug(t):
    t = re.sub(r'<[^>]+>', '', t)
    s = re.sub(r'[^\w\s-]', '', t, flags=re.U).strip().lower()
    return re.sub(r'[\s_]+', '-', s)[:60] or 'x'

toc, seen = [], {}
def anchor(m):
    lv, txt = int(m.group(1)), m.group(2)
    s = slug(txt)
    seen[s] = seen.get(s, 0) + 1
    if seen[s] > 1: s = f'{s}-{seen[s]}'
    if lv in (2, 3):
        toc.append(f'<a href="#{s}" class="l{lv}">{re.sub(r"<[^>]+>", "", txt)}</a>')
    return f'<h{lv} id="{s}">{txt}</h{lv}>'

body = re.sub(r'<h([1-6])>(.*?)</h\1>', anchor, body, flags=re.S)
title = re.sub(r'<[^>]+>', '', re.search(r'<h1[^>]*>(.*?)</h1>', body, re.S).group(1)) if '<h1' in body else 'Itinerario'
stamp = datetime.date.today().strftime('%d/%m/%Y')

open(sys.argv[2], 'w', encoding='utf-8').write(
 f'<!DOCTYPE html><html lang="it"><head><meta charset="utf-8">'
 f'<meta name="viewport" content="width=device-width,initial-scale=1">'
 f'<title>{html.escape(title)}</title><style>{CSS}</style></head><body><div class="wrap">'
 f'<p class="meta">Copia locale offline · generata il {stamp} · sorgente <code>{html.escape(sys.argv[1].split("/")[-1])}</code></p>'
 f'<nav id="toc"><b>Indice</b>{"".join(toc)}</nav>{body}</div></body></html>')
print('ok', sys.argv[2])
