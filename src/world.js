import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { clamp, mix, smooth, progress, track, windowFade } from './timeline.js';

// A continuous, 76-unit-deep scene. The camera actually travels through it.
// All shapes, networks and light fields are generated locally; no video backgrounds.
export function createWorld(canvas) {
  const mobileAtStart = innerWidth < 650;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: false, powerPreference: 'high-performance' });
  renderer.setClearColor(0x03030d, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(43, innerWidth / innerHeight, .035, 120);
  camera.position.z = 7.4;
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .85, .55, .42);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  let randomSeed = 847;
  const rand = () => { randomSeed = randomSeed * 16807 % 2147483647; return (randomSeed - 1) / 2147483646; };
  const bgUniforms = { uTime: { value: 0 }, uProgress: { value: 0 }, uAspect: { value: innerWidth / innerHeight }, uPointer: { value: new THREE.Vector2() } };
  const background = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: bgUniforms, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=vec4(position.xy,0.9999,1.0);}',
    fragmentShader: `
      varying vec2 vUv; uniform float uTime; uniform float uProgress; uniform float uAspect; uniform vec2 uPointer;
      float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p){vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      float fbm(vec2 p){float n=0.;float a=.5;for(int i=0;i<4;i++){n+=a*noise(p);p=p*2.03+3.7;a*=.5;}return n;}
      void main(){
        vec2 uv=vUv; vec2 q=(uv-.5)*vec2(uAspect,1.);
        float t=uTime*.045;
        float hero=1.-smoothstep(.12,.23,uProgress);
        float end=smoothstep(.87,.935,uProgress);
        float aurora=exp(-pow(q.x*1.12+sin(uv.y*3.+t)*.12-uPointer.x*.04,2.)*3.2);
        aurora*=pow(uv.y,1.8)*(0.5+fbm(vec2(q.x*3.+t,uv.y*2.-t)));
        float rays=pow(.5+.5*sin(q.x*14.+fbm(uv*4.+t)*4.),8.)*.18;
        vec3 col=vec3(.0015,.001,.008);
        col+=mix(vec3(.18,.025,.55),vec3(.01,.34,.48),uv.x)*aurora*hero;
        col+=vec3(.08,.025,.24)*rays*pow(uv.y,2.)*hero;
        float strands=fbm(vec2(q.x*1.2+sin(q.y*3.+t),q.y*3.+t));
        float streak=pow(max(0.,1.-abs(strands-.49)*20.),4.);
        col+=vec3(.055,.018,.17)*streak*end;
        float center=exp(-length(q)*2.5);
        col+=vec3(.006,.002,.025)*center;
        col*=.83+hash(uv*1500.)*.17;
        gl_FragColor=vec4(col,1.);
      }
    `
  }));
  background.frustumCulled = false; background.renderOrder = -100; scene.add(background);

  const count = mobileAtStart ? 56000 : 115000;
  const positions = new Float32Array(count * 3), scan = new Float32Array(count * 3), orbitForm = new Float32Array(count * 3), end = new Float32Array(count * 3), seeds = new Float32Array(count * 3), normals = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2, y = rand() * 2 - 1, s = Math.sqrt(1 - y * y);
    const nx = Math.cos(a) * s, nz = Math.sin(a) * s;
    const detail = Math.sin(nx * 7 + y * 3) * Math.cos(nz * 5 - y * 2) * .065 + Math.sin(a * 13 + y * 17) * .019;
    const radius = 1.25 + Math.sin(a * 3 + y * 2.4) * .22 + Math.cos(y * 4.6 - a) * .17 + detail;
    positions.set([nx * radius * 1.25, y * radius * .94, nz * radius], i * 3);
    normals.set([nx, y, nz], i * 3);
    // A faceted seed is scanned in the second chamber.
    const octa = .86 / (Math.abs(nx) + Math.abs(y) + Math.abs(nz));
    scan.set([nx * octa * .8, y * octa * 1.38, nz * octa * .8], i * 3);
    // A five-lobed orbital flower: several tilted trajectories share one core.
    // It reads as a gravitational system, not a biological helix.
    const orbit = i % 4;
    const angle = rand() * Math.PI * 2;
    const petalRadius = 1.14 + .46 * Math.cos(angle * 5 + orbit * .7);
    const tubeAngle = rand() * Math.PI * 2;
    const tube = .055 + rand() * .085;
    let ox = Math.cos(angle) * (petalRadius + Math.cos(tubeAngle) * tube);
    let oy = Math.sin(angle) * (petalRadius + Math.cos(tubeAngle) * tube);
    let oz = .48 * Math.sin(angle * 3 + orbit * .9) + Math.sin(tubeAngle) * tube;
    const tiltX = (orbit - 1.5) * .43;
    const tiltY = (orbit % 2 ? 1 : -1) * .52;
    const y1 = oy * Math.cos(tiltX) - oz * Math.sin(tiltX);
    const z1 = oy * Math.sin(tiltX) + oz * Math.cos(tiltX);
    const x2 = ox * Math.cos(tiltY) + z1 * Math.sin(tiltY);
    const z2 = -ox * Math.sin(tiltY) + z1 * Math.cos(tiltY);
    if (i % 11 === 0) { const core = Math.pow(rand(), 2) * .62; ox = Math.cos(angle) * core; oy = Math.sin(angle) * core; oz = (rand() - .5) * .24; orbitForm.set([ox, oy, oz], i * 3); }
    else orbitForm.set([x2, y1, z2], i * 3);
    const er = .53 + .08 * Math.sin(a * 4 + y * 6);
    const lobe = i % 2 ? 1 : -1;
    end.set([nx * er + .38 * lobe, y * er + .16 * lobe, nz * er], i * 3);
    seeds.set([rand(), rand(), rand()], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aScan', new THREE.BufferAttribute(scan, 3));
  geometry.setAttribute('aOrbit', new THREE.BufferAttribute(orbitForm, 3));
  geometry.setAttribute('aEnd', new THREE.BufferAttribute(end, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  geometry.setAttribute('aNormal', new THREE.BufferAttribute(normals, 3));
  const uniforms = {
    uTime: { value: 0 }, uShape: { value: 0 }, uFade: { value: 1 }, uScatter: { value: 0 }, uPixelRatio: { value: 1 }, uMouse: { value: new THREE.Vector2() }, uMouseActive: { value: 0 }, uAspect: { value: 1 }, uSize: { value: 1 }, uIntensity: { value: 1 }
  };
  const material = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec3 aScan; attribute vec3 aOrbit; attribute vec3 aEnd; attribute vec3 aSeed; attribute vec3 aNormal;
      uniform float uTime; uniform float uShape; uniform float uFade; uniform float uScatter; uniform float uPixelRatio; uniform vec2 uMouse; uniform float uMouseActive; uniform float uAspect; uniform float uSize;
      varying float vAlpha; varying float vLight; varying float vHot;
      void main(){
        vec3 p=position;
        if(uShape<=1.)p=mix(position,aScan,uShape);
        else if(uShape<=2.)p=mix(aScan,aOrbit,uShape-1.);
        else p=mix(aOrbit,aEnd,uShape-2.);
        float organic=1.-smoothstep(.0,.6,uShape);
        float wave=sin(position.y*3.+uTime*.62)+sin(position.x*2.7-uTime*.48)+cos(position.z*4.+uTime*.39);
        p+=aNormal*wave*.085*organic;
        p+=aNormal*sin(aSeed.x*80.+uTime*.8)*.008;
        p+=(aSeed-.5)*uScatter*7.;
        vec4 mv=modelViewMatrix*vec4(p,1.);
        vec4 clip=projectionMatrix*mv;
        vec2 screen=clip.xy/max(.05,clip.w);
        vec2 delta=uMouse-screen;
        vec2 metric=delta*vec2(uAspect,1.);
        float influence=exp(-dot(metric,metric)*3.8)*uMouseActive;
        // Screen-space attraction, not just rotation: individual points leave
        // the surface toward the cursor, with turbulent elastic displacement.
        mv.xy+=metric*influence*1.35;
        mv.z+=influence*(.40+sin(aSeed.x*40.+uTime*2.)*.13);
        mv.xy+=vec2(sin(aSeed.y*35.+uTime*1.4),cos(aSeed.z*30.-uTime))*influence*.05;
        vec3 n=normalize(normalMatrix*aNormal);
        vLight=clamp(dot(n,normalize(vec3(-.45,.75,1.)))*.65+.4,.025,1.);
        vHot=influence*.6;
        vAlpha=uFade*(.28+aSeed.x*.6)*(.22+vLight*.78)*smoothstep(.07,.45,-mv.z);
        gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp((.8+aSeed.y*1.55)*uPixelRatio*5.5/max(.1,-mv.z)*uSize,.6,7.5*uPixelRatio);
      }
    `,
    fragmentShader: `
      varying float vAlpha; varying float vLight; varying float vHot; uniform float uIntensity;
      void main(){vec2 uv=gl_PointCoord-.5;float r=length(uv)*2.;if(r>1.)discard;
        vec3 col=mix(vec3(.11,.025,.42),vec3(.17,.82,1.35),vLight);
        col+=vec3(.68,.28,1.15)*vHot;
        float shape=1.-smoothstep(.2,1.,r);
        gl_FragColor=vec4(col*uIntensity,vAlpha*shape);
      }
    `
  });
  const matter = new THREE.Points(geometry, material); matter.frustumCulled = false; scene.add(matter);

  // Spatial network. Edges and luminous nodes occupy different depths.
  const network = new THREE.Group();
  const nodePositions = [], edgePositions = [], edgeColors = [];
  const rings = 62, perRing = 14, nodes = [];
  for (let ring = 0; ring < rings; ring++) {
    for (let k = 0; k < perRing; k++) {
      const a = k / perRing * Math.PI * 2 + (rand() - .5) * .8 + ring * .08;
      const r = 1.9 + rand() * 2.4;
      const node = new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, -1.5 - ring * .44 - rand() * .9);
      nodes.push(node); nodePositions.push(node.x, node.y, node.z);
    }
  }
  nodes.forEach((node, i) => {
    for (const offset of [1, perRing, perRing + 1]) {
      const other = nodes[i + offset];
      if (!other || node.distanceTo(other) > 3.5 || rand() > .73) continue;
      edgePositions.push(node.x, node.y, node.z, other.x, other.y, other.z);
      const shade = .04 + rand() * .18;
      edgeColors.push(shade * .62, shade * .28, shade, shade * .62, shade * .28, shade);
    }
  });
  const edgeGeometry = new THREE.BufferGeometry();
  edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
  edgeGeometry.setAttribute('color', new THREE.Float32BufferAttribute(edgeColors, 3));
  const edgeMaterial = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .4, blending: THREE.AdditiveBlending, depthWrite: false });
  network.add(new THREE.LineSegments(edgeGeometry, edgeMaterial));
  const nodeGeometry = new THREE.BufferGeometry(); nodeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(nodePositions, 3));
  const nodeMaterial = new THREE.PointsMaterial({ color: 0x86e9ff, size: .022, transparent: true, opacity: .7, blending: THREE.AdditiveBlending, depthWrite: false });
  network.add(new THREE.Points(nodeGeometry, nodeMaterial));
  const ribbonUniforms = { uTime: { value: 0 }, uFade: { value: 0 } };
  const ribbonMaterial = new THREE.ShaderMaterial({
    uniforms: ribbonUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 vUv;uniform float uTime;uniform float uFade;void main(){float flow=pow(.5+.5*sin(vUv.x*62.-uTime*.8),5.);float flicker=.65+.35*sin(vUv.x*193.+uTime);vec3 spectrum=mix(vec3(.42,.08,1.1),vec3(.04,.75,1.2),vUv.x);gl_FragColor=vec4(spectrum*(flow+.12)*flicker,uFade*.7);}`
  });
  for (let j = 0; j < 9; j++) {
    const points = [];
    for (let k = 0; k < 80; k++) {
      const z = -k * .38 - 1.5;
      const a = j / 9 * Math.PI * 2 + Math.sin(k * .23 + j) * .6 + k * .025;
      const r = 2.2 + Math.sin(k * .47 + j) * .4 + (rand() - .5) * .3;
      points.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, z));
    }
    network.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 250, .024, 4, false), ribbonMaterial));
  }
  scene.add(network);

  // A world-space light column opens the scanning chamber.
  const beamUniforms = { uTime: { value: 0 }, uFade: { value: 0 }, uPanel: { value: 0 } };
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(11, 12), new THREE.ShaderMaterial({
    uniforms: beamUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `
      varying vec2 vUv;uniform float uTime;uniform float uFade;uniform float uPanel;
      void main(){
        vec2 uv=vUv-.5; float x=abs(uv.x);float y=uv.y;
        float width=.006+.018*pow(abs(y)*2.,3.)+.045*exp(-abs(y+.22)*28.);
        float ray=exp(-x/max(.002,width));
        float aura=exp(-x/(width*5.))*.11;
        float floorGlow=exp(-abs(y+.22)*80.)*exp(-x*9.)*.6;
        float pulse=.85+.15*sin(uTime*.8+y*10.);
        float energy=(ray+aura+floorGlow)*pulse;
        float panelMask=mix(1.,smoothstep(.21,.32,abs(y)),uPanel);
        vec3 color=mix(vec3(.22,.03,.9),vec3(.18,1.35,1.8),ray);
        gl_FragColor=vec4(color*energy,uFade*panelMask*smoothstep(.5,.35,abs(y)));
      }
    `
  })); beam.position.set(0, .25, -31); scene.add(beam);

  const dustGeometry = new THREE.BufferGeometry(); const dustPositions = [];
  for (let i = 0; i < 2100; i++) dustPositions.push((rand() - .5) * 26, (rand() - .5) * 17, 5 - rand() * 92);
  dustGeometry.setAttribute('position', new THREE.Float32BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: 0xa69cff, size: .016, transparent: true, opacity: .34, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(dust);

  // A soft particle tail makes the mouse attraction visible even off the main form.
  const trailCount = mobileAtStart ? 120 : 420;
  const trailPositions = new Float32Array(trailCount * 3), trailSeeds = new Float32Array(trailCount);
  for (let i = 0; i < trailCount; i++) trailSeeds[i] = rand();
  const trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3).setUsage(THREE.DynamicDrawUsage));
  trailGeometry.setAttribute('aSeed', new THREE.BufferAttribute(trailSeeds, 1));
  const trailUniforms = { uFade: { value: 0 }, uDpr: { value: 1 } };
  const trailMaterial = new THREE.ShaderMaterial({ uniforms: trailUniforms, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute float aSeed;uniform float uDpr;varying float vSeed;void main(){vSeed=aSeed;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=(.8+aSeed*1.4)*uDpr;}',
    fragmentShader: 'uniform float uFade;varying float vSeed;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;vec3 c=mix(vec3(.52,.26,1.),vec3(.25,.9,1.),vSeed);gl_FragColor=vec4(c,(1.-d)*uFade*(.12+vSeed*.45));}'
  });
  const trail = new THREE.Points(trailGeometry, trailMaterial); trail.frustumCulled = false; scene.add(trail);
  const tail = Array.from({ length: 28 }, () => new THREE.Vector2());
  const unproject = new THREE.Vector3(); let trailInitialized = false;

  let width = innerWidth, height = innerHeight;
  function resize() {
    width = innerWidth; height = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, width < 650 ? 1.4 : 1.5);
    renderer.setPixelRatio(dpr); renderer.setSize(width, height, false);
    composer.setPixelRatio(dpr); composer.setSize(width, height);
    camera.aspect = width / height; camera.updateProjectionMatrix();
    uniforms.uPixelRatio.value = dpr; uniforms.uAspect.value = width / height;
    bgUniforms.uAspect.value = width / height; trailUniforms.uDpr.value = dpr;
  }
  function update(p, time, pointer, active, dt, reduced) {
    const mobile = width < 650;
    const z = track(p, [[0,7.4],[.075,7.1],[.16,1.2],[.2,-4],[.276,-21.5],[.315,-23],[.38,-24],[.427,-24.5],[.49,-35.5],[.65,-36.8],[.709,-49],[.88,-53],[.935,-63],[1,-66]]);
    const tunnelAmount = windowFade(p,.13,.17,.265,.32);
    const parallax = reduced ? 0 : .17;
    camera.position.set(pointer.x * parallax + Math.sin(p * 19) * tunnelAmount * .48, pointer.y * parallax + Math.cos(p * 21) * tunnelAmount * .35, z);
    camera.rotation.set(-pointer.y * .014, pointer.x * .018, reduced ? 0 : Math.sin(p * 18) * tunnelAmount * .075);
    camera.fov = mix(mobile ? 52 : 43, mobile ? 62 : 58, tunnelAmount);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    bgUniforms.uTime.value = time; bgUniforms.uProgress.value = p; bgUniforms.uPointer.value.copy(pointer);
    uniforms.uTime.value = time; uniforms.uMouse.value.copy(pointer);
    uniforms.uMouseActive.value = reduced ? 0 : active * (p < .15 ? 1 : p > .90 ? .7 : .22);
    uniforms.uSize.value = mobile ? .85 : 1;
    uniforms.uScatter.value = 0;
    const heroFade = 1 - smooth(p,.17,.211);
    const scanFade = windowFade(p,.335,.372,.447,.49);
    const dnaFade = windowFade(p,.455,.485,.665,.711);
    const endFade = windowFade(p,.9,.927,.974,.997);
    if (p < .28) {
      matter.position.set(pointer.x * (mobile ? .12 : .55) * active, pointer.y * .34 * active, 0);
      matter.rotation.set(.13 + pointer.y * .28, time * .12 + pointer.x * .48, Math.sin(time * .23) * .11);
      const scale = mobile ? .7 : 1;
      matter.scale.setScalar(scale);
      uniforms.uShape.value = 0; uniforms.uFade.value = heroFade;
      uniforms.uIntensity.value = 1.35;
    } else if (p < .454) {
      matter.position.set(0,.1,-29.3);
      matter.rotation.set(.08, time * .18 + pointer.x * .22, .05);
      matter.scale.setScalar(mobile ? .9 : 1.04);
      uniforms.uShape.value = 1; uniforms.uFade.value = scanFade;
      uniforms.uIntensity.value = .64;
    } else if (p < .8) {
      matter.position.set(0,0,mix(-29.3,-45,smooth(p,.45,.491)));
      matter.rotation.set(.06, time * .1 + progress(p,.51,.66)*2.7, -.07);
      matter.scale.setScalar(mobile ? .86 : 1.1);
      uniforms.uShape.value = 1 + smooth(p,.451,.495);
      uniforms.uFade.value = Math.max(dnaFade,scanFade);
      uniforms.uScatter.value = Math.sin(progress(p,.449,.493)*Math.PI)*.8;
      uniforms.uIntensity.value = .85;
    } else {
      matter.position.set(pointer.x*.16*active,1.13+pointer.y*.09*active,-70);
      matter.rotation.set(.2, time * .18 + pointer.x * .6, Math.sin(time*.31)*.19);
      matter.scale.setScalar(mobile ? .63 : .78);
      uniforms.uShape.value = 3; uniforms.uFade.value = endFade;
      uniforms.uIntensity.value = 1.1;
    }
    matter.visible = uniforms.uFade.value > .001;
    network.visible = p > .115 && p < .325;
    network.rotation.z = Math.sin(time*.05)*.09;
    edgeMaterial.opacity = tunnelAmount * .8;
    nodeMaterial.opacity = tunnelAmount * .85;
    ribbonUniforms.uFade.value = tunnelAmount; ribbonUniforms.uTime.value = time;
    beamUniforms.uTime.value = time;
    beamUniforms.uFade.value = windowFade(p,.272,.304,.436,.47);
    beamUniforms.uPanel.value = smooth(p,.345,.38);
    beam.visible = beamUniforms.uFade.value > .001;
    bloom.strength = mix(.7,1.12,tunnelAmount);
    dust.rotation.z = Math.sin(time*.025)*.035;
    const tailFactor = 1-Math.exp(-dt*16);
    if (!trailInitialized) { tail.forEach(v=>v.copy(pointer)); trailInitialized = true; }
    tail[0].lerp(pointer,tailFactor);
    for (let i=1;i<tail.length;i++) tail[i].lerp(tail[i-1],tailFactor*.7);
    for (let i=0;i<trailCount;i++) {
      const t = tail[Math.floor(i / trailCount * (tail.length-1))];
      const spread = .006 + (i/trailCount)*.04;
      unproject.set(t.x + Math.sin(i*2.39+time)*spread, t.y + Math.cos(i*1.7+time*.8)*spread, .6).unproject(camera);
      trailPositions[i*3]=unproject.x; trailPositions[i*3+1]=unproject.y; trailPositions[i*3+2]=unproject.z;
    }
    trailGeometry.attributes.position.needsUpdate = true;
    trailUniforms.uFade.value = reduced ? 0 : active * (p < .14 || p > .9 ? .8 : .28);
    trail.visible = trailUniforms.uFade.value > .001;
    composer.render();
    return { cameraZ: z, points: count, shape: uniforms.uShape.value, attraction: uniforms.uMouseActive.value, drawCalls: renderer.info.render.calls };
  }
  resize();
  return { update, resize, renderer, scene, camera };
}
