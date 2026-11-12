// Independently written page-turn renderer (WebGL 1). No vendor flipbook code and no graphics library.
//
// Model: the turning sheet is a strip of SEGMENTS quads hinged at the spine. Its cross-section is a curve whose
// tangent angle grows from the spine angle to the (leading) edge angle, so the paper bends slightly while it turns.
// Units: page width = 1 (x, z), half page height = 1 (y). At z = 0 the projection is the identity, so the sheet
// coincides exactly with the flat page at the start and at the end of a turn (no size jump).

export const SEGMENTS = 40;
const STIFFNESS = 1.5;    // > 1 keeps the paper straighter near the spine
/**
 * Adjustable look of a turn (set per module in the Joomla back end, see viewer.js):
 * lead    0 … 0.5   how far the free edge runs ahead of the spine (fraction of a half turn at mid-turn); 0 = rigid sheet
 * opacity 0 … 0.6   density of the cast shadow
 * blur    0 … 0.05  softness: half width of the shadow edge in page widths
 * shift   0 … 0.6   width: how far the shadow reaches beside the lifted paper (light from the upper left)
 */
export const DEFAULT_LOOK = Object.freeze({lead: 0.25, opacity: 0.22, blur: 0.025, shift: 0.3});
const SHADOW_PASSES = [-1, -0.5, 0, 0.5, 1];
const CAMERA = [4.5, 14]; // viewing distance in page widths (nearest, farthest); chosen per turn so the lifted page fits the stage

export const easeOutSine = t => Math.sin(Math.min(1, Math.max(0, t)) * Math.PI / 2);

/**
 * Cross-section of the sheet for progress p (0 = flat on the source side, 1 = flat on the target side).
 * Returns SEGMENTS + 1 points {x, z, facing}: x in page widths from the spine (positive = source side),
 * z = height above the pages, facing = cosine of the local angle (> 0: the front face looks at the viewer).
 */
export function sheetProfile(p, lead = DEFAULT_LOOK.lead) {
  p = Math.min(1, Math.max(0, p));
  const spine = Math.PI * p, edge = Math.PI * Math.min(1, p + lead * Math.sin(Math.PI * p));
  const points = [{x: 0, z: 0, facing: Math.cos(spine)}];
  let x = 0, z = 0;
  for (let i = 1; i <= SEGMENTS; i++) {
    const angle = spine + (edge - spine) * Math.pow((i - 0.5) / SEGMENTS, STIFFNESS);
    x += Math.cos(angle) / SEGMENTS; z += Math.sin(angle) / SEGMENTS;
    points.push({x, z: Math.max(0, z), facing: Math.cos(angle)});
  }
  return points;
}

const SHEET_VS = `attribute vec3 aPos; attribute vec3 aTex;
uniform vec2 uCenter; uniform vec2 uScale; uniform float uCamera;
varying vec3 vTex;
void main(){ float k = uCamera / (uCamera - aPos.z);
  gl_Position = vec4(uCenter + aPos.xy * k * uScale, -aPos.z * 0.5, 1.0); vTex = aTex; }`;
// vTex = (s along the sheet, v, facing). Each face samples its own page; shading follows the bend,
// and both faces darken slightly towards the spine like the flat pages do.
const SHEET_FS = `precision mediump float; varying vec3 vTex;
uniform sampler2D uFront; uniform sampler2D uBack; uniform float uMirror;
void main(){ float s = vTex.x; bool front = vTex.z > 0.0;
  float uf = uMirror > 0.0 ? s : 1.0 - s;
  vec4 a = texture2D(uFront, vec2(uf, vTex.y)); vec4 b = texture2D(uBack, vec2(1.0 - uf, vTex.y));
  vec3 c = front ? a.rgb : b.rgb;
  float shade = 0.76 + 0.24 * abs(vTex.z);
  float gutter = 1.0 - 0.10 * exp(-s * 18.0);
  gl_FragColor = vec4(c * shade * gutter, 1.0); }`;
const SHADOW_VS = `attribute vec3 aPos; uniform vec2 uCenter; uniform vec2 uScale; varying float vAlpha;
void main(){ gl_Position = vec4(uCenter + aPos.xy * uScale, 0.0, 1.0); vAlpha = aPos.z; }`;
const SHADOW_FS = `precision mediump float; varying float vAlpha; void main(){ gl_FragColor = vec4(0.0, 0.0, 0.0, vAlpha); }`;

export class PageTurn {
  constructor(canvas) {
    this.canvas = canvas; this.frame = 0; this.available = false; this.look = DEFAULT_LOOK;
    const gl = this.gl = canvas.getContext('webgl', {alpha: true, antialias: true, depth: true, premultipliedAlpha: true});
    if (!gl) return;
    try {
      this.sheet = this.program(SHEET_VS, SHEET_FS); this.shadow = this.program(SHADOW_VS, SHADOW_FS);
      this.buffer = gl.createBuffer();
      this.textures = [this.texture(), this.texture()];
      this.available = true;
    } catch { this.available = false; }
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); this.available = false; this.stop(); });
  }
  program(vertex, fragment) {
    const gl = this.gl, program = gl.createProgram();
    for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
      const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('shader');
      gl.attachShader(program, shader); gl.deleteShader(shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('program');
    return program;
  }
  texture() {
    const gl = this.gl, texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  }
  /** Position of the spread inside the overlay canvas, as clip-space centre and scale per model unit. */
  layout(spread) {
    const c = this.canvas.getBoundingClientRect(), s = spread.getBoundingClientRect();
    if (!c.width || !c.height) return null;
    return {center: [((s.left + s.width / 2 - c.left) / c.width) * 2 - 1, 1 - ((s.top + s.height / 2 - c.top) / c.height) * 2],
            scale: [s.width / c.width, s.height / c.height]};
  }
  draw(progress, mirror, spread) {
    const gl = this.gl, layout = this.layout(spread); if (!layout) return;
    const look = this.look, points = sheetProfile(progress, look.lead), sheet = [], shadow = [];
    const lift = Math.sin(Math.PI * progress);
    for (let i = 0; i < SEGMENTS; i++) {
      for (const [index, y] of [[i, -1], [i + 1, -1], [i, 1], [i, 1], [i + 1, -1], [i + 1, 1]]) {
        const p = points[index];
        sheet.push(p.x * mirror, y, p.z, index / SEGMENTS, (y + 1) / 2, p.facing);
        // Shadow: the sheet projected onto the pages and shifted away from the light.
        const sx = Math.max(-1, Math.min(1, p.x * mirror + p.z * look.shift));
        shadow.push(sx, y, look.opacity / SHADOW_PASSES.length * lift * Math.pow(1 - index / SEGMENTS, 1.3));   // darkest at the spine, fading out towards the free edge
      }
    }
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    // 1) soft cast shadow: several slightly shifted translucent passes (no shift = hard edge)
    gl.useProgram(this.shadow); gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);   // premultiplied alpha: black shadow = (0, 0, 0, a)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(shadow), gl.DYNAMIC_DRAW);
    this.attributes(this.shadow, [['aPos', 3, 0]], 12);
    gl.uniform2fv(gl.getUniformLocation(this.shadow, 'uScale'), layout.scale);
    for (const pass of look.opacity > 0 ? SHADOW_PASSES : []) {
      gl.uniform2f(gl.getUniformLocation(this.shadow, 'uCenter'), layout.center[0] + pass * look.blur * layout.scale[0], layout.center[1]);
      gl.drawArrays(gl.TRIANGLES, 0, shadow.length / 3);
    }
    // 2) the sheet itself, opaque, with depth so that a curled part hides what lies behind it
    gl.useProgram(this.sheet); gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sheet), gl.DYNAMIC_DRAW);
    this.attributes(this.sheet, [['aPos', 3, 0], ['aTex', 3, 12]], 24);
    gl.uniform2fv(gl.getUniformLocation(this.sheet, 'uCenter'), layout.center);
    gl.uniform2fv(gl.getUniformLocation(this.sheet, 'uScale'), layout.scale);
    gl.uniform1f(gl.getUniformLocation(this.sheet, 'uCamera'), this.camera);
    gl.uniform1f(gl.getUniformLocation(this.sheet, 'uMirror'), mirror);
    gl.uniform1i(gl.getUniformLocation(this.sheet, 'uFront'), 0); gl.uniform1i(gl.getUniformLocation(this.sheet, 'uBack'), 1);
    gl.drawArrays(gl.TRIANGLES, 0, sheet.length / 6);
  }
  attributes(program, list, stride) {
    const gl = this.gl;
    for (const [name, size, offset] of list) {
      const location = gl.getAttribLocation(program, name);
      if (location < 0) continue;
      gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset);
    }
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
    gl.deleteBuffer(this.buffer); this.textures?.forEach(texture => gl.deleteTexture(texture));
    gl.deleteProgram(this.sheet); gl.deleteProgram(this.shadow);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
