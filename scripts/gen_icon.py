# 生成随心记图标 — 256x256 PNG
import struct, zlib

def create_png(width, height, pixels):
    """pixels: list of (r,g,b,a) tuples, row by row"""
    def chunk(ctype, data):
        c = ctype + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    
    raw = b''
    for y in range(height):
        raw += b'\x00'  # filter none
        for x in range(width):
            r, g, b, a = pixels[y * width + x]
            raw += struct.pack('BBBB', r, g, b, a)
    
    return (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw))
            + chunk(b'IEND', b''))

W, H = 256, 256
pixels = []

# 紫色渐变背景
for y in range(H):
    for x in range(W):
        t = 1 - y / H
        r = int(60 + 60 * t)
        g = int(40 + 30 * t)
        b = int(140 + 60 * t)
        pixels.append((r, g, b, 255))

# 白色 "记" 或简化的笔+心形
cx, cy = W//2, H//2

# 心形
for y in range(H):
    for x in range(W):
        dx = (x - cx) / 100
        dy = (y - cy) / 100
        # 心形公式: (x^2 + y^2 - 1)^3 - x^2*y^3 < 0
        v = (dx*dx + dy*dy - 1)**3 - dx*dx * dy*dy*dy
        if v < -0.05:
            i = y * W + x
            pixels[i] = (255, 255, 255, 255)

# 笔尖（在心上）
for y in range(cy-50, cy+10):
    for x in range(cx-3, cx+3):
        if 0 <= x < W and 0 <= y < H:
            i = y * W + x
            pixels[i] = (255, 220, 100, 255)

# 笔尖头
for y in range(cy-60, cy-48):
    for x in range(cx-8, cx+8):
        if 0 <= x < W and 0 <= y < H:
            i = y * W + x
            pixels[i] = (255, 200, 50, 255)

png = create_png(W, H, pixels)
with open('electron/icon.png', 'wb') as f:
    f.write(png)
print(f'Icon created: {len(png)} bytes')
