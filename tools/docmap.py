"""Build the shared Document Map and write it into index.html and pages/dossier.html.

Rooms are <details data-expand-id>. data-weight="3" marks a main room (listed in the map);
weight 1 marks a small room (nested entry or quote-toggle), tallied under its main room.
Rerun after adding or renaming rooms:  python3 tools/docmap.py   (from the repo root)
"""
import re, html, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IDX, DOS = os.path.join(ROOT, 'index.html'), os.path.join(ROOT, 'pages', 'dossier.html')
START, END = '<!-- docmap:start -->', '<!-- docmap:end -->'

def text(frag):
    frag = re.sub(r'<span class="movietitle">(.*?)</span>', r'<i>\1</i>', frag, flags=re.S)
    frag = re.sub(r'<(?!/?(i|em)\b)[^>]+>', '', frag)
    frag = re.sub(r'\s+', ' ', frag).strip()
    return frag.replace('<em>', '<i>').replace('</em>', '</i>')

def rooms(src):
    """(id, weight, parent_main_id, depth, label_html, pos) for each room, in order."""
    out, stack = [], []
    for m in re.finditer(r'<(/?)details\b([^>]*)>', src):
        if m.group(1):
            stack.pop(); continue
        a = m.group(2)
        rid = re.search(r'data-expand-id="([^"]+)"', a)
        if not rid:
            stack.append(None); continue
        w = int((re.search(r'data-weight="(\d+)"', a) or [0, 1])[1])
        main = next((x for x in reversed(stack) if x and x[1] >= 3), None)
        sm = re.match(r'\s*<summary[^>]*>(.*?)</summary>', src[m.end():], re.S)
        lab = text(re.sub(r'<span class="hint-text">.*?</span>', '', sm.group(1), flags=re.S)) if sm else ''
        out.append((rid.group(1), w, main[0] if main else None, len([x for x in stack if x]), lab, m.start()))
        stack.append((rid.group(1), w))
    return out

def essay_part(idx_src, base):
    """Reuse the essay's hand-written outline, adding weights and tallies."""
    old = re.search(r'<nav class="docmap"[^>]*>\s*<ol>(.*)</ol>\s*</nav>', idx_src, re.S)
    if old and 'docmap-part' not in old.group(1):
        body = old.group(1)
    else:  # already converted: take the essay part back out
        body = re.search(r'<li class="docmap-part" id="mappart-essay">.*?<ol>(.*?)</ol></li>\s*<li class="docmap-part" id="mappart-dossier">',
                         idx_src, re.S).group(1)
        body = re.sub(r' data-weight="\d+"| data-kids="[^"]*"|<span class="docmap-tally"></span>', '', body)
    r = {x[0]: x for x in rooms(idx_src)}
    def fix(m):
        rid = m.group(1); w = r[rid][1] if rid in r else 1
        return f'<li id="mapnode-{rid}" data-weight="{w}">'
    body = re.sub(r'<li id="mapnode-([^"]+)"[^>]*>', fix, body)
    body = body.replace('href="#', f'href="{base}#') if base else body
    return body

def dossier_part(dos_src, base):
    rs = rooms(dos_src)
    heads = [(m.start(), text(m.group(1) or m.group(2)))
             for m in re.finditer(r'(?<!<summary>)<h3>(#\d\d\.[^<]*(?:<[^>]+>[^<]*)*?)</h3>|<h1>.*?DOSSIER:</a>\s*([^<]+)</h1>', dos_src)]
    kids = {}
    for rid, w, main, d, lab, pos in rs:
        if w < 3 and main: kids.setdefault(main, []).append(rid)
    out, cur = [], None
    for rid, w, main, d, lab, pos in rs:
        if w < 3: continue
        h = [t for p, t in heads if p < pos]
        h = h[-1] if h else ''
        if h != cur:
            if cur is not None: out.append('</ol></li>')
            out.append(f'<li class="docmap-group"><span class="docmap-group-title">{h.title() if h.isupper() else h}</span><ol>')
            cur = h
        k = kids.get(rid, [])
        kd = f' data-kids="{" ".join(k)}"' if k else ''
        tally = '<span class="docmap-tally"></span>' if k else ''
        out.append(f'<li id="mapnode-{rid}" data-weight="{w}"{kd}><a href="{base}#{rid}">{lab or rid}</a>{tally}</li>')
    out.append('</ol></li>')
    return '\n'.join(out), rs

def build(page_is_index, idx_src, dos_src):
    essay = essay_part(idx_src, '' if page_is_index else '../index.html')
    dos, drs = dossier_part(dos_src, 'pages/dossier.html' if page_is_index else '')
    ers = rooms(idx_src)
    pts = sum(x[1] for x in ers + drs)
    mains = sum(1 for x in ers + drs if x[1] >= 3)
    home = 'https://ijpauc.net/'
    return (f'{START}\n<nav class="docmap" aria-label="Document map" data-points-total="{pts}" data-rooms-total="{mains}">\n<ol>\n'
            f'<li class="docmap-part" id="mappart-essay"><span class="docmap-part-title"><i>Why IJPAUC?</i></span><ol>{essay}</ol></li>\n'
            f'<li class="docmap-part" id="mappart-dossier"><span class="docmap-part-title">Dossier</span><ol>\n{dos}\n</ol></li>\n'
            f'<li class="docmap-part" id="mappart-ijpauc"><span class="docmap-part-title"><a href="{home}" class="docmap-away"><i>IJPAUC?</i> on ijpauc.net</a></span></li>\n'
            f'</ol>\n</nav>\n{END}'), pts, mains

idx_src = open(IDX, encoding='utf-8').read()
dos_src = open(DOS, encoding='utf-8').read()
for path, is_idx in ((IDX, True), (DOS, False)):
    src = open(path, encoding='utf-8').read()
    block, pts, mains = build(is_idx, idx_src, dos_src)
    if START in src:
        src = re.sub(re.escape(START) + '.*?' + re.escape(END), lambda m: block, src, flags=re.S)
    else:
        src, n = re.subn(r'<nav class="docmap"[^>]*>.*?</nav>', lambda m: block, src, count=1, flags=re.S)
        if not n: raise SystemExit(f'no docmap in {path}: add the map modal first')
    open(path, 'w', encoding='utf-8').write(src)
    print(os.path.relpath(path, ROOT), 'points', pts, 'main rooms', mains)
