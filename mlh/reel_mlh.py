import sys, os, json, subprocess, numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter
# usage: reel_mlh.py CONFIG.json W H OUT.mp4 [shots:t1,t2]
CFG = json.load(open(sys.argv[1])); D = os.path.dirname(os.path.abspath(sys.argv[1]))
W, H = int(sys.argv[2]), int(sys.argv[3]); OUT = sys.argv[4]
SHOTS = sys.argv[5][6:] if len(sys.argv) > 5 and sys.argv[5].startswith('shots:') else None
FPS = 30; XF = 0.6; FONTS = CFG.get('fonts', '/home/user/fonts')
shots = CFG['shots']  # [{clip, dur, speed, cap1, cap2}]

class Reader:
    def __init__(self, p):
        self.p = p; self.cap = cv2.VideoCapture(p); self.n = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT))
        self.fps = self.cap.get(cv2.CAP_PROP_FPS) or 24; self.pos = -1; self.cache = {}
    def get(self, i):
        i = max(0, min(i, self.n - 1))
        if i in self.cache: return self.cache[i]
        if i < self.pos: self.cap = cv2.VideoCapture(self.p); self.pos = -1; self.cache = {}
        f = None
        while self.pos < i:
            ok, f = self.cap.read()
            if not ok: break
            self.pos += 1; self.cache[self.pos] = f
            for k in [k for k in self.cache if k < self.pos - 3]: del self.cache[k]
        return self.cache.get(i, self.cache.get(self.pos))
R = {s['clip']: Reader(os.path.join(D, s['clip'])) for s in shots}

def ease(x): x = min(max(x, 0), 1); return x * x * (3 - 2 * x)
def frame_from(img, zoom):
    h, w = img.shape[:2]; s = max(W / w, H / h) * zoom
    vw, vh = W / s, H / s; x0 = (w - vw) / 2; y0 = (h - vh) / 2
    M = np.float32([[s, 0, -x0 * s], [0, s, -y0 * s]])
    return cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
def shot_frame(k, t):
    s = shots[k]; r = R[s['clip']]; sp = s.get('speed', 1.0)
    x = min(t * r.fps * sp, r.n - 1.001); i0 = int(x); a = x - i0
    img = r.get(i0)[:, :, ::-1].astype(np.float32) * (1 - a) + r.get(i0 + 1)[:, :, ::-1].astype(np.float32) * a
    return frame_from(img, 1.0 + 0.03 * ease(t / s['dur']))

starts = []; t = 0
for s in shots: starts.append(t); t += s['dur'] - XF
SHOT_END = t + XF
sc = W / 1080 if H > W else W / 1080 * 0.85
FB = f'{FONTS}/Lora.ttf'; FI = f'{FONTS}/LoraI.ttf'
f1 = ImageFont.truetype(FB, int(84 * sc)); f2 = ImageFont.truetype(FI, int(56 * sc))
try: f1.set_variation_by_name('SemiBold')
except Exception: pass
YREL = 0.40 if H > W else 0.44
cap_cache = {}
def caption_layer(k):
    if k in cap_cache: return cap_cache[k]
    L = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(L)
    sh = Image.new('RGBA', (W, H), (0, 0, 0, 0)); sd = ImageDraw.Draw(sh)
    y = int(H * YREL)
    for txt, f, dy in ((shots[k]['cap1'], f1, 0), (shots[k]['cap2'], f2, int(100 * sc))):
        tw = d.textlength(txt, font=f)
        d.text(((W - tw) / 2, y + dy), txt, font=f, fill=(255, 255, 255, 255))
        sd.text(((W - tw) / 2, y + dy + 3), txt, font=f, fill=(0, 0, 0, 170))
    sh = sh.filter(ImageFilter.GaussianBlur(10 * sc))
    cap_cache[k] = np.asarray(Image.alpha_composite(sh, L)).astype(np.float32) / 255
    return cap_cache[k]
ys = np.arange(H) / H; YC = YREL + 50 * sc / H
g = (0.30 * np.exp(-((ys - YC) / 0.11) ** 2)).astype(np.float32)[:, None, None]

def render_shots(T):
    out = None
    for k, s in enumerate(shots):
        s0 = starts[k]
        if s0 - 1e-6 <= T < s0 + s['dur']:
            f = shot_frame(k, T - s0); a = 1.0
            if k > 0 and T < s0 + XF: a = ease((T - s0) / XF)
            out = f if out is None else out * (1 - a) + f * a
    out = out * (1 - g)
    for k, s in enumerate(shots):
        s0 = starts[k]; ci, co = s0 + 0.35, s0 + s['dur'] - XF
        if ci <= T <= co:
            al = min(ease((T - ci) / 0.5), ease((co - T) / 0.4))
            if al <= 0: continue
            lay = caption_layer(k); aa = lay[..., 3:] * al
            out = out * (1 - aa) + lay[..., :3] * 255 * aa
    if T < 0.4: out = out * ease(T / 0.4)
    return out

END_DUR = 3.2; END_START = SHOT_END - XF; TOTAL = END_START + END_DUR
CREAM = np.array([243, 235, 223], np.float32); BROWN = np.array([110, 50, 9], np.float32)
def logo_alpha(path):
    a = np.asarray(Image.open(path).convert('RGBA')).astype(np.float32) / 255
    al = np.clip((1 - a[..., :3].mean(-1)) * 1.25, 0, 1) * a[..., 3]
    yy_, xx_ = np.where(al > 0.05); return al[yy_.min():yy_.max()+1, xx_.min():xx_.max()+1]
LA = logo_alpha(CFG['logo_stack'] if H > W else CFG['logo_wide'])
lw = int(W * (0.62 if H > W else 0.78)); lh = int(LA.shape[0] * lw / LA.shape[1])
LA = cv2.resize(LA, (lw, lh), interpolation=cv2.INTER_AREA)
yy, xx = np.mgrid[0:H, 0:W]
BGC = (CREAM[None, None, :] * (1 - 0.2 * (((xx - W / 2) / W) ** 2 + ((yy - H / 2) / H) ** 2))[..., None]).astype(np.float32)
def end_card(t):
    out = BGC.copy(); p = ease(t / 1.0); s_ = 0.965 + 0.035 * p
    w2, h2 = int(lw * s_), int(lh * s_)
    la = cv2.resize(LA, (w2, h2), interpolation=cv2.INTER_AREA) * p
    y0 = (H - h2) // 2; x0 = (W - w2) // 2
    out[y0:y0+h2, x0:x0+w2] = out[y0:y0+h2, x0:x0+w2] * (1 - la[..., None]) + BROWN * la[..., None]
    return out
def render(T):
    if T < END_START: out = render_shots(T)
    else:
        a = ease((T - END_START) / XF)
        out = end_card(T - END_START) if a >= 1 else render_shots(min(T, SHOT_END - 1e-3)) * (1 - a) + end_card(T - END_START) * a
    if T > TOTAL - 0.5: out = out * ease((TOTAL - T) / 0.5)
    return np.clip(out, 0, 255).astype(np.uint8)

if SHOTS:
    for ts in SHOTS.split(','):
        Image.fromarray(render(float(ts))).save(f'{OUT}_{ts}.jpg', quality=90)
    sys.exit()
if OUT.endswith('.png'):
    Image.fromarray(render(float(sys.argv[5]))).save(OUT); sys.exit()
tmp = OUT.replace('.mp4', '.tmp.mp4')
ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                       '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', tmp], stdin=subprocess.PIPE)
for i in range(int(TOTAL * FPS)): ff.stdin.write(render(i / FPS).tobytes())
ff.stdin.close(); ff.wait()
if ff.returncode == 0: os.replace(tmp, OUT)
print('DONE', OUT, round(TOTAL, 2))
