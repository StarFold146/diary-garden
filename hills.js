
function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function noise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return (hash(ix, iy) * (1 - u) + hash(ix + 1, iy) * u) * (1 - v) + (hash(ix, iy + 1) * (1 - u) + hash(ix + 1, iy + 1) * u) * v;
}
const fbm = (x, y) => noise(x, y) * .55 + noise(x * 2.1 + 5, y * 2.1) * .3 + noise(x * 4.3 + 9, y * 4.3) * .15;
const ridged = (x, y) => 1 - Math.abs(2 * fbm(x, y) - 1);
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* 唐风的颜色（tang.js 的 P）：松 #3f6a5a、石青 #4d7090、雾蓝 #7C9CC0、水 #86aecb，最远一重往台基灰 #a9b3b8 褪一点 */
const TANG = ['#3f6a5a', '#4d7090', '#7C9CC0', '#86aecb'], TANG_GREY = '#a9b3b8';
/* 四重山：r 脊线半径，w 半宽，H 最高，N 一圈分几段，wob 脊线前后摆多少，f 山头的疏密，gap 断开多少（0 是一整圈），haze 本身化进雾色多少 */
const RANGES = [
  { r: 25, w: 4.2, H: 2.8, N: 100, wob: 2.4, f: .1, gap: .3, haze: .08, sd: 1.7 },
  { r: 30.5, w: 5.2, H: 3.4, N: 92, wob: 3, f: .085, gap: .42, haze: .16, sd: 5.3 },
  { r: 37, w: 6.5, H: 4.9, N: 84, wob: 3.6, f: .07, gap: .2, haze: .25, sd: 9.1 },
  { r: 45, w: 8.5, H: 6.8, N: 76, wob: 4.2, f: .058, gap: 0, haze: .34, sd: 13.3 },
];
const M = 6;   /* 横断面分六段，正中那个点是山脊 */

/* 时辰：tint 乘在山色上，shift 往一个色里拉一点，mist 是雾带往哪个色提亮 */
const PAL = {
  morning: { tint: '#ffffff', shift: ['#dfe8f2', .12], mist: ['#ffffff', .55] },
  day: { tint: '#ffffff', shift: ['#ffffff', 0], mist: ['#ffffff', .35] },
  dusk: { tint: '#f6eaf0', shift: ['#b9a9d6', .22], mist: ['#fff1ea', .45] },
  night: { tint: '#6d7598', shift: ['#3c4470', .25], mist: ['#7a84b4', .3] },
};

function gradTex(THREE) {
  const t = new THREE.DataTexture(new Uint8Array([150, 210, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
}

export function buildFarHills(THREE, { cx = 4.5, cz = -2.5, gradientMap = null, scale = 1 } = {}) {
  const pos = [], col = [], colD = [], hz = [], idx = [], c = new THREE.Color(), cd = new THREE.Color(), grey = new THREE.Color(TANG_GREY);
  RANGES.forEach((L, li) => {
    const base = pos.length / 3, r = L.r * scale, w = L.w * scale;
    /* 照唐风的色相，提亮成园子的粉彩：一重比一重亮一点点 */
    const lc = new THREE.Color(TANG[li]); if (li === 0) lc.lerp(new THREE.Color(TANG[1]), .3); if (li === 3) lc.lerp(grey, .3);
    /* 白天另用一套更青绿、深浅拉得开的，黄昏和夜里照旧 */
    const hsl = {}; lc.getHSL(hsl); const ld = lc.clone(); lc.setHSL(hsl.h, [.26, .3, .27, .2][li], .56 + li * .045); ld.setHSL(hsl.h, [.42, .36, .3, .22][li], li === 0 ? .44 : .5 + li * .065);
    for (let i = 0; i < L.N; i++) {
      const th = i / L.N * Math.PI * 2, co = Math.cos(th), si = Math.sin(th);
      /* 噪声在圆周上取，首尾自然接上 */
      const px = co * r, pz = si * r;
      const cr = r + (fbm(px * .05 + L.sd, pz * .05) - .5) * 2 * L.wob;
      const peaks = Math.pow(ridged(px * L.f + L.sd, pz * L.f), 1.3) * .65 + fbm(px * L.f * 2.2 + 3, pz * L.f * 2.2) * .35;
      const mask = L.gap ? smooth(L.gap - .08, L.gap + .08, fbm(px * .03 + L.sd * 2, pz * .03)) : 1;
      const top = L.H * (.04 + 1.05 * peaks * peaks + .1 * peaks) * (.3 + .7 * mask);
      const cOff = (fbm(px * .08 + 7, pz * .08 + L.sd) - .5) * .6;   /* 山脊不在正中：一面陡一面缓 */
      const hw = w * (.8 + .45 * fbm(px * .07, pz * .07 + 4));
      for (let j = 0; j <= M; j++) {
        const u = j <= M / 2 ? -1 + (cOff + 1) * (j / (M / 2)) : cOff + (1 - cOff) * ((j - M / 2) / (M / 2));
        const sl = j <= M / 2 ? (u + 1) / (cOff + 1) : (1 - u) / (1 - cOff);
        const rr = cr + u * hw, x = co * rr, z = si * rr;
        const prof = sl * sl * (3 - 2 * sl);   /* 山脚缓缓起来，山头圆钝 */
        const spur = j === 0 || j === M || j === M / 2 ? 1 : .86 + .26 * ridged(x * .2 + L.sd, z * .2);
        const y = -.75 + (top + .75) * prof * spur;
        pos.push(cx + x, y, cz + z);
        const hn = Math.min(1, Math.max(0, (y + .5) / (L.H * 1.1)));
        c.copy(lc).multiplyScalar(.95 + .1 * fbm(x * .3 + 2, z * .3) + .06 * hn);
        col.push(c.r, c.g, c.b);
        cd.copy(ld).multiplyScalar(.95 + .1 * fbm(x * .3 + 2, z * .3) + .06 * hn); colD.push(cd.r, cd.g, cd.b);
        /* 山脚压一道雾：越往下越化进雾色 */
        hz.push(Math.min(1, L.haze + (1 - smooth(.0, .5, hn)) * (.8 - L.haze)));
      }
    }
    for (let i = 0; i < L.N; i++) {
      const a0 = base + i * (M + 1), a1 = base + ((i + 1) % L.N) * (M + 1);
      for (let j = 0; j < M; j++) idx.push(a0 + j, a1 + j, a0 + j + 1, a1 + j, a1 + j + 1, a0 + j + 1);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('colD', new THREE.Float32BufferAttribute(colD, 3));
  g.setAttribute('haze', new THREE.Float32BufferAttribute(hz, 1));
  g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();

  const U = { uHaze: { value: new THREE.Color('#f5f2ea') }, uHazeAdd: { value: 0 }, uShift: { value: new THREE.Color('#ffffff') }, uShiftK: { value: 0 }, uFlat: { value: 1 }, uDay: { value: 1 } };
  const m = new THREE.MeshToonMaterial({ color: '#ffffff', vertexColors: true, gradientMap: gradientMap || gradTex(THREE), fog: false });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float haze;\nattribute vec3 colD;\nuniform float uDay;\nvarying float vHaze;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHaze = haze;')
      .replace('#include <color_vertex>', '#include <color_vertex>\nvColor.rgb = mix(vColor.rgb, colD, uDay);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uHaze;\nuniform float uHazeAdd;\nuniform vec3 uShift;\nuniform float uShiftK;\nuniform float uFlat;\nvarying float vHaze;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, uShift, uShiftK);')
      .replace('#include <tonemapping_fragment>', 'gl_FragColor.rgb = mix(gl_FragColor.rgb, diffuseColor.rgb * uFlat, .45);\ngl_FragColor.rgb = mix(gl_FragColor.rgb, uHaze, clamp(vHaze + uHazeAdd, 0., 1.));\n#include <tonemapping_fragment>');
  };
  const hills = new THREE.Mesh(g, m); hills.userData.keep = true; hills.userData.noLine = true; hills.renderOrder = -1;

  /* 雾带：每重山脚前面立一圈薄纱，底下实、往上散，沿圈一团一团有疏有密 */
  const seg = 96, mp = [], mv = [], mi = [];
  RANGES.forEach((L, k) => {
    const b = mp.length / 3, r = (L.r - L.w * .6) * scale, h = .6 + L.H * .25, a = .3 + k * .06;
    for (let i = 0; i <= seg; i++) {
      const th = i / seg * Math.PI * 2, x = cx + Math.cos(th) * r, z = cz + Math.sin(th) * r;
      mp.push(x, -.55, z, x, -.55 + h, z); mv.push(i / seg, 0, a, k, i / seg, 1, a, k);
    }
    for (let i = 0; i < seg; i++) { const p = b + i * 2; mi.push(p, p + 2, p + 1, p + 2, p + 3, p + 1); }
  });
  const mg = new THREE.BufferGeometry();
  mg.setAttribute('position', new THREE.Float32BufferAttribute(mp, 3));
  mg.setAttribute('aM', new THREE.Float32BufferAttribute(mv, 4));
  mg.setIndex(mi); mg.computeBoundingSphere();
  const MU = { uCol: { value: new THREE.Color('#ffffff') }, uA: { value: 1 } };
  const mist = new THREE.Mesh(mg, new THREE.ShaderMaterial({
    uniforms: MU,
    vertexShader: `attribute vec4 aM; varying vec4 vM;
      void main(){ vM = aM; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform vec3 uCol; uniform float uA; varying vec4 vM;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p, float P){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        float x0 = mod(i.x, P), x1 = mod(i.x + 1., P);
        return mix(mix(h(vec2(x0, i.y)), h(vec2(x1, i.y)), f.x), mix(h(vec2(x0, i.y + 1.)), h(vec2(x1, i.y + 1.)), f.x), f.y); }
      void main(){
        float P = 22. + vM.w * 6., u = vM.x * P, v = vM.y;
        float puff = n(vec2(u, vM.w * 3.1), P) * .65 + n(vec2(u * 3., v * 2. + vM.w), P * 3.) * .35;
        float top = mix(.4, 1., puff);
        float a = (1. - smoothstep(.0, top, v)) * smoothstep(.2, .55, puff + .15) * vM.z * uA;
        if (a < .01) discard;
        gl_FragColor = vec4(uCol, a);
      #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }));
  mist.userData.noLine = true; mist.renderOrder = 2; mist.frustumCulled = false;

  const grp = new THREE.Group(); grp.add(hills, mist); grp.userData.keep = true; grp.userData.noLine = true;
  const tmp = new THREE.Color();
  function setPhase(phase = 'day', fogColor = null, wx = 'clear') {
    const p = PAL[phase] || PAL.day, night = phase === 'night';
    m.color.set(p.tint); U.uDay.value = phase === 'day' || phase === 'morning' ? 1 : 0; U.uFlat.value = night ? .55 : phase === 'dusk' ? .92 : 1;
    U.uShift.value.set(p.shift[0]); U.uShiftK.value = p.shift[1];
    if (wx === 'rain' || wx === 'wind') { U.uShift.value.lerp(tmp.set(night ? '#3a4058' : '#aab4bc'), p.shift[1] ? .5 : 1); U.uShiftK.value = Math.max(U.uShiftK.value, wx === 'rain' ? .3 : .18); }
    if (fogColor) U.uHaze.value.copy(fogColor);
    U.uHazeAdd.value = wx === 'mist' ? .2 : wx === 'rain' ? .12 : 0;
    MU.uCol.value.copy(U.uHaze.value).lerp(tmp.set(p.mist[0]), p.mist[1]);
    MU.uA.value = wx === 'mist' ? 1.25 : wx === 'rain' ? 1.1 : night ? .7 : phase === 'dusk' ? 1 : .8;
  }
  setPhase('day');
  return { mesh: grp, hills, mist, setPhase, tris: idx.length / 3 + mi.length / 3 };
}
