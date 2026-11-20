// Independently written page-turn renderer (WebGL 1). No vendor flipbook code and no graphics library.
import { LIMITS } from './model.js?v=1.0.0';
//
// What is drawn while a page turns (the flat pages underneath stay in the document and remain sharp):
//   1. the turning sheet: a strip of quads bent along a cubic Bézier curve, lit with ambient, diffuse and specular light;
//   2. its shadow: a depth map rendered from the light, blurred, and laid over the pages and the area around the book;
//      the same depth map lets the sheet shade itself where it curls over.
// Units: page width = 1 (x, z), half page height = 1 (y). At height 0 the projection is the identity and a flat page
// gets exactly its own colours, so the sheet coincides with the flat page at the start and at the end of a turn.

export const SEGMENTS = 48;
/**
 * Adjustable look of a turn (set per module in the Joomla back end, see viewer.js):
 * curvature 0 … 2     bend of the paper; 0 = rigid sheet, 1 = default
 * opacity   0 … 0.6   density of the cast shadow
 * blur      0 … 0.1   softness: radius of the shadow edge in page widths
 * shift     0 … 0.8   width: how far the shadow falls beside the lifted paper (light from the upper left front)
 */
export const DEFAULT_LOOK = Object.freeze({curvature: 1, opacity: 0.22, blur: 0.05, shift: 0.4});
const CAMERA = [4.5, 14];   // viewing distance in page widths (nearest, farthest); chosen per turn so the lifted page fits the stage
const RANGE = 1.7;          // the shadow maps cover x and y in [-RANGE, RANGE]
const MAX_HEIGHT = 1.1;     // heights are stored as z / MAX_HEIGHT
const DEPTH_SIZE = 1024, BLUR_SIZE = 512;
const AMBIENT = 0.8, DIFFUSE = 0.22, SPECULAR = 0.1, SHININESS = 15;
// Direction of the middle of the sheet (as a fraction of a half turn) at progress 0, 1/4, 1/2, 3/4 and 1:
// the middle runs ahead of the free edge, which moves evenly. This gives the paper its belly while it turns.
const MIDDLE = [0, 0.5, 0.75, 1, 1];

export const easeOutSine = t => Math.sin(Math.min(1, Math.max(0, t)) * Math.PI / 2);

/**
 * Cross-section of the sheet for progress p (0 = flat on the source side, 1 = flat on the target side).
 * Returns SEGMENTS + 1 points {x, z, s, nx, nz}: x from the spine in page widths (positive = source side),
 * z = height above the pages, s = distance along the paper (0 … 1), (nx, nz) = unit normal of the front face.
 */
export function sheetProfile(p, curvature = DEFAULT_LOOK.curvature) {
  p = Math.min(1, Math.max(0, p));
  const edge = Math.PI * p, f = Math.min(4, p * 4), i = Math.min(3, Math.floor(f));
  const lead = Math.PI * (MIDDLE[i] + (MIDDLE[i + 1] - MIDDLE[i]) * (f - i));
  const middle = Math.min(Math.PI, edge + curvature * (lead - edge));
  // Near the spine the paper first rises more steeply than the sheet as a whole; this rounds the fold while it turns.
  const rise = edge + Math.min(1, curvature) * (Math.PI / 4 - edge / 2), lift = 0.17 * Math.min(1.5, curvature) * Math.sin(Math.PI * p);
  const c1 = [0.5 * lift * Math.cos(rise), lift * Math.sin(rise)], c2 = [0.5 * Math.cos(middle), 0.5 * Math.sin(middle)], end = [Math.cos(edge), Math.sin(edge)];
  const raw = [];
  for (let k = 0; k <= SEGMENTS; k++) {
    const t = k / SEGMENTS, u = 1 - t, a = 3 * u * u * t, b = 3 * u * t * t, c = t * t * t;   // Bézier from the spine (0, 0)
    raw.push([a * c1[0] + b * c2[0] + c * end[0], Math.max(0, a * c1[1] + b * c2[1] + c * end[1])]);
  }
  // Measure the curve and rescale it so that the paper keeps its width; s follows the measured length, so the image is not stretched.
  const lengths = [0];
  for (let k = 1; k <= SEGMENTS; k++) lengths.push(lengths[k - 1] + Math.hypot(raw[k][0] - raw[k - 1][0], raw[k][1] - raw[k - 1][1]));
  const total = lengths[SEGMENTS] || 1;
  return raw.map(([x, z], k) => {
    const before = raw[Math.max(0, k - 1)], after = raw[Math.min(SEGMENTS, k + 1)];
    const tx = after[0] - before[0], tz = after[1] - before[1], norm = Math.hypot(tx, tz) || 1;
    return {x: x / total, z: z / total, s: lengths[k] / total, nx: -tz / norm, nz: tx / norm};
  });
}

const SHEET_VS = `attribute vec3 aPos; attribute vec4 aTex;
uniform vec2 uCenter; uniform vec2 uScale; uniform float uCamera;
varying vec4 vTex;
void main(){ float k = uCamera / (uCamera - aPos.z);
  gl_Position = vec4(uCenter + aPos.xy * k * uScale, -aPos.z * 0.5, 1.0);
  vTex = aTex; }`;
// vTex = (s along the paper, v, normal x, normal z). Each face shows its own page. A flat page (normal straight up)
// gets the factor 1 and no highlight, so it looks exactly like the page in the document.
const SHEET_FS = `precision mediump float; varying vec4 vTex;
uniform sampler2D uFront; uniform sampler2D uBack;
uniform float uMirror; uniform vec3 uL; uniform vec4 uGutter;
void main(){ float s = vTex.x; vec3 n = normalize(vec3(vTex.z, 0.0, vTex.w)); bool front = n.z > 0.0; if (!front) n = -n;
  float uf = uMirror > 0.0 ? s : 1.0 - s;
  vec3 c = front ? texture2D(uFront, vec2(uf, vTex.y)).rgb : texture2D(uBack, vec2(1.0 - uf, vTex.y)).rgb;
  vec2 g = front ? uGutter.xy : uGutter.zw; c *= 1.0 - g.x * clamp(1.0 - s / g.y, 0.0, 1.0);
  // No self-shadow: tested live as a switch in 0.1.0-alpha.9 and visible only frame by frame; the depth lookup that
  // still ran with weight 0 was removed in 0.1.0-alpha.17 (D3). The cast shadow on the ground is unaffected.
  float diffuse = max(dot(n, uL), 0.0);
  float shade = (${AMBIENT.toFixed(2)} + ${DIFFUSE.toFixed(2)} * diffuse) / (${AMBIENT.toFixed(2)} + ${DIFFUSE.toFixed(2)} * uL.z);
  vec3 h = normalize(uL + vec3(0.0, 0.0, 1.0));
  float gloss = ${SPECULAR.toFixed(2)} * (pow(max(dot(n, h), 0.0), ${SHININESS.toFixed(1)}) - pow(h.z, ${SHININESS.toFixed(1)}));
  gl_FragColor = vec4(clamp(c * shade + gloss, 0.0, 1.0), 1.0); }`;
// Depth map seen from the light: for every point of the ground, the height of the paper that the light hits first.
const DEPTH_VS = `attribute vec3 aPos; uniform vec3 uShadow; varying float vHeight;
void main(){ vHeight = aPos.z / ${MAX_HEIGHT.toFixed(1)};
  gl_Position = vec4((aPos.xy + aPos.z * uShadow.xy) * uShadow.z, 1.0 - 2.0 * vHeight, 1.0); }`;
const DEPTH_FS = `precision mediump float; varying float vHeight;
void main(){ float v = clamp(vHeight, 0.0, 1.0) * 255.0; gl_FragColor = vec4(floor(v) / 255.0, fract(v), 0.0, 1.0); }`;
const QUAD_VS = `attribute vec2 aQuad; varying vec2 vUv; void main(){ gl_Position = vec4(aQuad, 0.0, 1.0); vUv = aQuad * 0.5 + 0.5; }`;
// One direction of a Gaussian blur. The first pass also turns heights into shadow strength: paper close to the page
// casts almost no shadow (so the shadow fades in and out with the lift of the sheet), and paper high above the page
// casts a lighter one, as a real shadow spreads and pales with distance.
const BLUR_FS = `precision mediump float; varying vec2 vUv; uniform sampler2D uSource; uniform vec2 uStep; uniform float uFromDepth;
float value(vec2 uv){ vec4 d = texture2D(uSource, uv); if (uFromDepth < 0.5) return d.r;
  float z = (d.r + d.g / 255.0) * ${MAX_HEIGHT.toFixed(1)};
  return smoothstep(0.01, 0.10, z) * mix(1.0, 0.4, smoothstep(0.15, 0.85, z)); }
void main(){ float sum = 0.0; float total = 0.0;
  for (int i = -6; i <= 6; i++) { float x = float(i); float w = exp(-x * x / 8.0); sum += w * value(vUv + uStep * x); total += w; }
  gl_FragColor = vec4(vec3(sum / total), 1.0); }`;
const GROUND_VS = `attribute vec2 aQuad; uniform vec2 uCenter; uniform vec2 uScale; varying vec2 vUv;
void main(){ gl_Position = vec4(uCenter + aQuad * ${RANGE.toFixed(1)} * uScale, 0.0, 1.0); vUv = aQuad * 0.5 + 0.5; }`;
const GROUND_FS = `precision mediump float; varying vec2 vUv; uniform sampler2D uShade; uniform float uDensity;
void main(){ gl_FragColor = vec4(0.0, 0.0, 0.0, uDensity * texture2D(uShade, vUv).r); }`;

export class PageTurn {
  constructor(canvas) {
    this.canvas = canvas; this.frame = 0; this.available = false; this.look = DEFAULT_LOOK; this.uniforms = new Map();
    const gl = this.gl = canvas.getContext('webgl', {alpha: true, antialias: true, depth: true, premultipliedAlpha: true});
    if (!gl) return;
    this.maxTextureSize = Math.min(LIMITS.dimension, gl.getParameter(gl.MAX_TEXTURE_SIZE));
    try {
      this.sheet = this.program(SHEET_VS, SHEET_FS, ['aPos', 'aTex']);
      this.depth = this.program(DEPTH_VS, DEPTH_FS, ['aPos']);
      this.blur = this.program(QUAD_VS, BLUR_FS, ['aQuad']);
      this.ground = this.program(GROUND_VS, GROUND_FS, ['aQuad']);
      this.buffer = gl.createBuffer(); this.quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      this.textures = [this.texture(gl.LINEAR), this.texture(gl.LINEAR)];
      this.depthMap = this.target(DEPTH_SIZE, gl.NEAREST, true);
      this.blurMaps = [this.target(BLUR_SIZE, gl.LINEAR, false), this.target(BLUR_SIZE, gl.LINEAR, false)];
      this.available = true;
    } catch { this.available = false; }
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); this.available = false; this.stop(); });
  }
  program(vertex, fragment, attributes) {
    const gl = this.gl, program = gl.createProgram();
    for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
      const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('shader');
      gl.attachShader(program, shader); gl.deleteShader(shader);
    }
    attributes.forEach((name, index) => gl.bindAttribLocation(program, index, name));   // fixed slots: 0 = position, 1 = texture data
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('program');
    return program;
  }
  uniform(program, name) {
    let map = this.uniforms.get(program); if (!map) this.uniforms.set(program, map = new Map());
    if (!map.has(name)) map.set(name, this.gl.getUniformLocation(program, name));
    return map.get(name);
  }
  texture(filter) {
    const gl = this.gl, texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  }
  /** Off-screen render target: a square RGBA texture, optionally with a depth buffer. */
  target(size, filter, withDepth) {
    const gl = this.gl, texture = this.texture(filter), framebuffer = gl.createFramebuffer();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    let renderbuffer = null;
    if (withDepth) {
      renderbuffer = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, size, size);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer);
    }
    const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!complete) throw new Error('framebuffer');
    return {texture, framebuffer, renderbuffer, size};
  }
  /** Position of the spread inside the overlay canvas: clip-space centre, scale per model unit, page shape. */
  layout(spread) {
    const c = this.canvas.getBoundingClientRect(), s = spread.getBoundingClientRect();
    if (!c.width || !c.height || !s.width || !s.height) return null;
    return {center: [((s.left + s.width / 2 - c.left) / c.width) * 2 - 1, 1 - ((s.top + s.height / 2 - c.top) / c.height) * 2],
            scale: [s.width / c.width, s.height / c.height],
            aspect: s.height / s.width,      // half page height in page widths
            pagePixels: s.width / 2};
  }
  useQuad(program) {
    const gl = this.gl;
    gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0); gl.disableVertexAttribArray(1);
  }
  useSheet(program, withTexture) {
    const gl = this.gl;
    gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
    if (withTexture) { gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 12); } else gl.disableVertexAttribArray(1);
  }
  draw(progress, mirror, spread) {
    const gl = this.gl, layout = this.layout(spread); if (!layout) return;
    const look = this.look, points = sheetProfile(progress, look.curvature), vertices = [];
    for (let i = 0; i < SEGMENTS; i++) {
      for (const [index, y] of [[i, -1], [i + 1, -1], [i, 1], [i, 1], [i + 1, -1], [i + 1, 1]]) {
        const p = points[index];
        vertices.push(p.x * mirror, y, p.z, p.s, (y + 1) / 2, p.nx * mirror, p.nz);
      }
    }
    const count = vertices.length / 7;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
    // Light from the upper left front: shadows fall to the right and downwards by the same amount.
    const sx = look.shift, sy = look.shift, length = Math.hypot(sx, sy, 1);
    const light = [-sx / length, sy / length, 1 / length], shadow = [sx, -sy / layout.aspect, 1 / RANGE];
    const shadows = look.opacity > 0;
    gl.disable(gl.BLEND);
    if (shadows) {
      // 1) depth map from the light
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.depthMap.framebuffer); gl.viewport(0, 0, DEPTH_SIZE, DEPTH_SIZE);
      gl.clearColor(0, 0, 0, 1); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS);
      this.useSheet(this.depth, false);
      gl.uniform3fv(this.uniform(this.depth, 'uShadow'), shadow);
      gl.drawArrays(gl.TRIANGLES, 0, count);
      // 2) shadow strength, blurred horizontally and vertically (same radius in both directions on the page)
      gl.disable(gl.DEPTH_TEST); this.useQuad(this.blur);
      const step = look.blur / (2 * RANGE) / 6;
      for (const [source, target, direction, fromDepth] of [[this.depthMap, this.blurMaps[0], [step, 0], 1], [this.blurMaps[0], this.blurMaps[1], [0, step / layout.aspect], 0]]) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer); gl.viewport(0, 0, target.size, target.size);
        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, source.texture);
        gl.uniform1i(this.uniform(this.blur, 'uSource'), 2); gl.uniform2fv(this.uniform(this.blur, 'uStep'), direction);
        gl.uniform1f(this.uniform(this.blur, 'uFromDepth'), fromDepth);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (shadows) {
      // 3) the shadow on the pages and around the book
      gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);   // premultiplied alpha
      this.useQuad(this.ground);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.blurMaps[1].texture);
      gl.uniform1i(this.uniform(this.ground, 'uShade'), 3); gl.uniform1f(this.uniform(this.ground, 'uDensity'), look.opacity);
      gl.uniform2fv(this.uniform(this.ground, 'uCenter'), layout.center); gl.uniform2fv(this.uniform(this.ground, 'uScale'), layout.scale);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.disable(gl.BLEND);
    }
    // 4) the sheet: opaque, with depth so that a curled part hides what lies behind it
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    this.useSheet(this.sheet, true);
    const u = name => this.uniform(this.sheet, name);
    gl.uniform1i(u('uFront'), 0); gl.uniform1i(u('uBack'), 1);
    gl.uniform2fv(u('uCenter'), layout.center); gl.uniform2fv(u('uScale'), layout.scale);
    gl.uniform1f(u('uCamera'), this.camera); gl.uniform1f(u('uMirror'), mirror);
    gl.uniform3fv(u('uL'), light);
    // Same darkening towards the spine as the flat pages have in the stylesheet (right page 11 % over 14 px, left page 9 % over 16 px).
    const right = [0.11, 14 / layout.pagePixels], left = [0.09, 16 / layout.pagePixels];
    gl.uniform4fv(u('uGutter'), mirror > 0 ? [...right, ...left] : [...left, ...right]);
    gl.drawArrays(gl.TRIANGLES, 0, count);
  }
  /**
   * Turns one sheet. front/back are the page canvases of its two faces, direction > 0 turns from the right side
   * to the left. The spread element gives the position of the pages; the textures are uploaded once per turn.
   */
  play(front, back, direction, duration, spread, look = DEFAULT_LOOK) {
    if (!this.available) return Promise.resolve();
    this.look = {...DEFAULT_LOOK, ...look};
    const gl = this.gl, ratio = Math.min(devicePixelRatio || 1, 2);
    this.canvas.hidden = false;
    this.canvas.width = Math.max(1, Math.round(this.canvas.clientWidth * ratio));
    this.canvas.height = Math.max(1, Math.round(this.canvas.clientHeight * ratio));
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    [front, back].forEach((source, unit) => {
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, this.textures[unit]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    });
    const mirror = direction > 0 ? 1 : -1;
    // A lifted page grows towards the viewer. Pick the viewing distance so that it still fits into the stage:
    // growth at the highest point (z ≤ 1) is at most 1 / (1 - 1 / camera).
    const room = Math.min(1.25, this.canvas.clientHeight / Math.max(1, spread.getBoundingClientRect().height));
    this.camera = room > 1.001 ? Math.min(CAMERA[1], Math.max(CAMERA[0], 1 / (1 - 1 / room))) : CAMERA[1];
    return new Promise(resolve => {
      this.finish = () => { this.canvas.hidden = true; this.finish = null; resolve(); };
      const start = performance.now();
      const tick = now => {
        if (!this.available) return;
        const t = Math.min(1, (now - start) / duration);
        this.draw(easeOutSine(t), mirror, spread);
        if (t < 1) this.frame = requestAnimationFrame(tick); else this.stop();
      };
      this.draw(0, mirror, spread);   // first frame before the pages underneath change
      this.frame = requestAnimationFrame(tick);
    });
  }
  stop() { cancelAnimationFrame(this.frame); this.finish?.(); }
  dispose() {
    this.stop();
    const gl = this.gl; if (!gl) return;
    gl.deleteBuffer(this.buffer); gl.deleteBuffer(this.quad); this.textures?.forEach(texture => gl.deleteTexture(texture));
    for (const target of [this.depthMap, ...(this.blurMaps || [])]) {
      if (!target) continue;
      gl.deleteTexture(target.texture); gl.deleteFramebuffer(target.framebuffer); if (target.renderbuffer) gl.deleteRenderbuffer(target.renderbuffer);
    }
    for (const program of [this.sheet, this.depth, this.blur, this.ground]) if (program) gl.deleteProgram(program);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
