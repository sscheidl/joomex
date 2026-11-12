// Independently written curved-sheet renderer. No vendor flipbook code or graphics library.
const vertex = `attribute vec3 aPosition; attribute vec2 aUV; attribute float aShade;
varying vec2 vUV; varying float vShade;
void main(){float perspective=1.0-aPosition.z*0.16;
gl_Position=vec4(aPosition.x/perspective,aPosition.y/perspective,0.0,1.0);
vUV=aUV;vShade=aShade;}`;
const fragment = `precision mediump float; varying vec2 vUV; varying float vShade;
uniform sampler2D uPage;
void main(){vec4 pixel=texture2D(uPage,vUV);gl_FragColor=vec4(pixel.rgb*vShade,pixel.a);}`;

export class PageTurn {
  constructor(canvas) {
    this.canvas = canvas; this.frame = 0;
    const gl = this.gl = canvas.getContext('webgl', {alpha:true, antialias:true, premultipliedAlpha:false});
    if (!gl) return;
    try {
      const shader = (type, source) => { const s=gl.createShader(type); gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error('Shader');return s; };
      this.program=gl.createProgram();
      const vs=shader(gl.VERTEX_SHADER,vertex),fs=shader(gl.FRAGMENT_SHADER,fragment);
      gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);
      gl.deleteShader(vs);gl.deleteShader(fs);
      if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw new Error('Program');
      this.buffer=gl.createBuffer(); this.texture=gl.createTexture();
      gl.useProgram(this.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
      for(const [name,size,offset] of [['aPosition',3,0],['aUV',2,12],['aShade',1,20]]) {
        const attribute=gl.getAttribLocation(this.program,name);gl.enableVertexAttribArray(attribute);gl.vertexAttribPointer(attribute,size,gl.FLOAT,false,24,offset);
      }
      gl.bindTexture(gl.TEXTURE_2D,this.texture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.uniform1i(gl.getUniformLocation(this.program,'uPage'),0);
      this.available=true;
    } catch { this.available=false; }
    canvas.addEventListener('webglcontextlost', event=>{event.preventDefault();this.available=false;this.stop();});
  }
  draw(progress, front, back, direction) {
    const gl=this.gl, right=direction>0, backVisible=progress>.5;
    const source=backVisible?back:front;
    gl.bindTexture(gl.TEXTURE_2D,this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
    const vertices=[], segments=48, bend=Math.sin(Math.PI*progress)*.55;
    let x=0,z=0;
    const points=[{x,z,shade:1}];
    for(let i=1;i<=segments;i++) {
      const s=(i-.5)/segments;
      const angle=Math.PI*progress+bend*Math.sin(Math.PI*s);
      x+=Math.cos(angle)/segments; z+=Math.sin(angle)/segments;
      points.push({x:x*(right?1:-1),z,shade:1-.22*Math.abs(Math.sin(angle))});
    }
    for(let i=0;i<segments;i++) {
      for(const [index,y] of [[i,-1],[i+1,-1],[i,1],[i,1],[i+1,-1],[i+1,1]]) {
        const p=points[index];let u=index/segments;
        if(right===backVisible)u=1-u;
        vertices.push(p.x,y*.94,p.z,u,(y+1)/2,p.shade);
      }
    }
    gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.TRIANGLES,0,vertices.length/6);
  }
  play(front, back, direction, duration) {
    if(!this.available)return Promise.resolve();
    this.canvas.hidden=false;
    this.canvas.width=Math.ceil(this.canvas.clientWidth*Math.min(devicePixelRatio,2));
    this.canvas.height=Math.ceil(this.canvas.clientHeight*Math.min(devicePixelRatio,2));
    return new Promise(resolve=>{
      this.finish=()=>{this.canvas.hidden=true;this.finish=null;resolve();};
      const start=performance.now();
      const tick=now=>{
        const t=Math.min(1,(now-start)/duration), eased=t*t*(3-2*t);
        this.draw(eased,front,back,direction);
        if(t<1)this.frame=requestAnimationFrame(tick);else this.stop();
      };
      this.frame=requestAnimationFrame(tick);
    });
  }
  stop(){cancelAnimationFrame(this.frame);this.finish?.();}
  dispose(){this.stop();if(this.gl){this.gl.deleteBuffer(this.buffer);this.gl.deleteTexture(this.texture);this.gl.deleteProgram(this.program);this.gl.getExtension('WEBGL_lose_context')?.loseContext();}}
}
