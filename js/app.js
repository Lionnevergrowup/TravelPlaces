/* 旅行足迹地图 —— 核心逻辑
 * 世界坐标：3600 x 1800（经纬度等距投影，x=(lng+180)*10, y=(90-lat)*10）
 * 相机通过对 #world 施加 translate+scale 实现平移缩放。
 */
(() => {
  "use strict";

  const MAP = window.WORLD_MAP;
  const DATA = window.TRAVEL_DATA;

  const toX = (lng) => (lng + 180) * 10;
  const toY = (lat) => (90 - lat) * 10;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const viewport = $("viewport");
  const world = $("world");
  const mapSvg = $("map-svg");
  const landPath = $("land");
  const trailLine = $("trail");
  const markersBox = $("markers");
  const familyBox = $("family");
  const nearHint = $("near-hint");
  const nearHintEmoji = $("near-hint-emoji");
  const nearHintText = $("near-hint-text");

  // ---------- 初始化地图 ----------
  world.style.width = MAP.W + "px";
  world.style.height = MAP.H + "px";
  mapSvg.setAttribute("width", MAP.W);
  mapSvg.setAttribute("height", MAP.H);
  mapSvg.setAttribute("viewBox", `0 0 ${MAP.W} ${MAP.H}`);
  landPath.setAttribute("d", MAP.PATH);
  const landShadow = document.getElementById("land-shadow");
  landShadow.setAttribute("d", MAP.PATH);
  const coastFoam = document.getElementById("coast-foam");
  coastFoam.setAttribute("d", MAP.PATH);

  // ---------- 地图小装饰（海洋 + 陆地） ----------
  const DECOR = [
    // 海洋
    { lng: -152, lat: 12,  e: "🐳" },
    { lng: -128, lat: -22, e: "🌊" },
    { lng: -168, lat: -38, e: "🐠" },
    { lng: -40,  lat: 28,  e: "⛵" },
    { lng: -28,  lat: -22, e: "🌊" },
    { lng: -44,  lat: 52,  e: "🌊" },
    { lng: 74,   lat: -28, e: "🌊" },
    { lng: 88,   lat: 2,   e: "⛵" },
    { lng: 165,  lat: 40,  e: "🌊" },
    { lng: 2,    lat: 82,  e: "❄️" },
    { lng: 140,  lat: -55, e: "🐧" },
    // 陆地
    { lng: 86,   lat: 33,  e: "🏔️" },  // 喜马拉雅
    { lng: 10,   lat: 46.5,e: "🏔️" },  // 阿尔卑斯
    { lng: -114, lat: 51,  e: "🏔️" },  // 落基山
    { lng: -70,  lat: -28, e: "⛰️" },  // 安第斯
    { lng: 95,   lat: 61,  e: "🌲" },  // 西伯利亚
    { lng: -102, lat: 57,  e: "🌲" },  // 加拿大
    { lng: -62,  lat: -5,  e: "🌴" },  // 亚马逊
    { lng: 113,  lat: -1,  e: "🌴" },  // 婆罗洲
    { lng: 8,    lat: 22,  e: "🐫" },  // 撒哈拉
    { lng: -106, lat: 31,  e: "🌵" },  // 墨西哥北部
    { lng: 35,   lat: 0,   e: "🦁" },  // 东非草原
    { lng: 134,  lat: -24, e: "🦘" },  // 澳洲内陆
    { lng: -42,  lat: 73,  e: "⛄" },  // 格陵兰
  ];
  const decorBox = document.getElementById("decor");
  DECOR.forEach((d, i) => {
    const el = document.createElement("div");
    el.className = "decor";
    el.style.left = ((d.lng + 180) * 10) + "px";
    el.style.top = ((90 - d.lat) * 10) + "px";
    const span = document.createElement("span");
    const inner = document.createElement("i");
    inner.textContent = d.e;
    inner.style.animationDelay = (-i * 0.7) + "s";
    span.appendChild(inner);
    el.appendChild(span);
    decorBox.appendChild(el);
  });

  // ---------- 地点标记（可随导入的数据重建） ----------
  let places = [];

  function buildPlaces(data) {
    markersBox.innerHTML = "";
    places = data.places.map((p) => ({
      ...p,
      x: toX(p.lng),
      y: toY(p.lat),
      el: null,
    }));
    for (const p of places) {
    const m = document.createElement("div");
    m.className = "marker" + (p.status === "wishlist" ? " wishlist" : "");
    m.style.left = p.x + "px";
    m.style.top = p.y + "px";
    m.dataset.id = p.id;

    const inner = document.createElement("div");
    inner.className = "marker-inner";

    const bubble = document.createElement("div");
    bubble.className = "marker-bubble";
    bubble.textContent = p.emoji || "📍";
    if (p.visits && p.visits.length > 0) {
      const dot = document.createElement("div");
      dot.className = "visit-dot";
      dot.textContent = p.visits.length;
      bubble.appendChild(dot);
    }

    const label = document.createElement("div");
    label.className = "marker-label";
    label.textContent = p.name;

    inner.appendChild(bubble);
    inner.appendChild(label);
    m.appendChild(inner);
    markersBox.appendChild(m);
    p.el = m;

      inner.addEventListener("click", (e) => {
        e.stopPropagation();
        if (performance.now() < suppressClickUntil) return; // 拖动收尾的误触
        if (p.id === activeId) openCard(p.id);
        else walkTo(p, /*openOnArrive*/ true);
      });
    }
  }

  // ---------- 旅行路线（按首次到访时间连线） ----------
  let trailPts = null;
  function buildTrail() {
    trailPts = null;
    trailLine.setAttribute("points", "");
    const visited = places
      .filter((p) => p.visits && p.visits.length > 0)
      .map((p) => ({
        p,
        // 取最早一次有日期的到访；没有日期的排到最后
        first: p.visits.map((v) => v.date).filter(Boolean).sort()[0] || "9999-99-99",
      }))
      .sort((a, b) => (a.first < b.first ? -1 : 1))
      .map((o) => o.p);
    if (visited.length < 2) return;
    trailLine.setAttribute(
      "points",
      visited.map((p) => `${p.x},${p.y}`).join(" ")
    );
    trailPts = visited.map((p) => [p.x, p.y]);
  }

  // ---------- 沿路线飞行的小飞机 ----------
  const planeEl = document.getElementById("plane");
  let planeSegs = null; // {segs:[{x1,y1,dx,dy,len,start}], total}
  function buildPlane() {
    planeSegs = null;
    planeEl.classList.add("hidden");
    if (!trailPts) return;
    let total = 0;
    const segs = [];
    for (let i = 0; i < trailPts.length - 1; i++) {
      const [x1, y1] = trailPts[i];
      const [x2, y2] = trailPts[i + 1];
      const len = Math.hypot(x2 - x1, y2 - y1);
      if (len < 1) continue;
      segs.push({ x1, y1, dx: (x2 - x1) / len, dy: (y2 - y1) / len, len, start: total });
      total += len;
    }
    if (segs.length) {
      planeSegs = { segs, total };
      planeEl.classList.remove("hidden");
    }
  }

  function updatePlane(now, inv) {
    if (!planeSegs) return;
    const SPEED = 130; // 世界单位/秒
    const dist = (now / 1000 * SPEED) % planeSegs.total;
    let seg = planeSegs.segs[0];
    for (const s of planeSegs.segs) {
      if (dist >= s.start && dist <= s.start + s.len) { seg = s; break; }
    }
    const t = dist - seg.start;
    const x = seg.x1 + seg.dx * t;
    const y = seg.y1 + seg.dy * t;
    // ✈️ emoji 默认朝右上 45°，旋转对齐航向；向左飞时垂直镜像，避免机腹朝上
    const h = Math.atan2(seg.dy, seg.dx) * 180 / Math.PI;
    const rot = seg.dx < 0
      ? `rotate(${(h - 45).toFixed(1)}deg) scaleY(-1)`
      : `rotate(${(h + 45).toFixed(1)}deg)`;
    planeEl.style.transform =
      `translate(${(x - 15).toFixed(1)}px, ${(y - 15).toFixed(1)}px) scale(${inv}) ${rot}`;
  }

  // ---------- 统计 ----------
  function updateStats() {
    const visitedTotal = places.filter((p) => p.visits && p.visits.length > 0).length;
    $("visited-count").textContent = visitedTotal;
    $("total-count").textContent = places.length;
  }

  // ---------- 一家四口 ----------
  const FACE = `
    <circle cx="30.5" cy="13.5" r="1.7" fill="#2b2b2b"/>
    <circle cx="23.5" cy="13.5" r="1.7" fill="#2b2b2b"/>
    <path d="M25,18.5 q2.2,2.2 4.5,0" stroke="#2b2b2b" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    <circle cx="21" cy="17" r="1.8" fill="#ffb3a0" opacity="0.8"/>
    <circle cx="33.5" cy="17" r="1.8" fill="#ffb3a0" opacity="0.8"/>`;

  const LEGS = (c1, c2) => `
    <g class="legs">
      <rect class="leg leg-l" x="17" y="42" width="7" height="14" rx="3.5" fill="${c1}"/>
      <rect class="leg leg-r" x="26" y="42" width="7" height="14" rx="3.5" fill="${c2}"/>
    </g>`;

  const OUTLINE = `stroke="#35405a" stroke-width="2" stroke-linejoin="round" style="paint-order:stroke fill;"`;

  // 爸爸：蓝衣红帽 + 橙色背包
  const SVG_DAD = `
    <g ${OUTLINE}>
      ${LEGS("#3d4a5c", "#2f3a49")}
      <rect x="4" y="24" width="13" height="18" rx="5" fill="#e8833a"/>
      <rect x="6.5" y="27" width="8" height="5" rx="2.5" fill="#c96a26" stroke="none"/>
      <rect x="13" y="22" width="23" height="24" rx="9" fill="#4f86f7"/>
      <rect x="13" y="34" width="23" height="6" fill="#3f6fd6" stroke="none"/>
      <circle cx="37" cy="36" r="4" fill="#ffd9b3"/>
      <circle cx="26" cy="13" r="11" fill="#ffd9b3"/>
    </g>
    <g stroke="#c23a4a" stroke-width="1.6" stroke-linejoin="round" style="paint-order:stroke fill;">
      <path d="M14.5,11 a11.5,11.5 0 0 1 23,0 l0,-1.5 a11.5,10 0 0 0 -23,0 Z" fill="#f45b69"/>
      <path d="M14.5,10.2 Q26,3 37.5,10.2 L37.5,7.5 Q26,0.5 14.5,7.5 Z" fill="#f45b69"/>
      <rect x="33" y="6.5" width="10" height="4" rx="2" fill="#f45b69"/>
    </g>
    ${FACE}`;

  // 妈妈：粉色连衣裙 + 棕色长发别小花
  const SVG_MOM = `
    <g ${OUTLINE}>
      ${LEGS("#5a4a6b", "#4c3d5c")}
      <path d="M17,24 Q26,19 35,24 L39,45 Q26,50 13,45 Z" fill="#ff85a1"/>
      <path d="M13.8,41 Q26,46 38.2,41 L39,45 Q26,50 13,45 Z" fill="#ef6292" stroke="none"/>
      <circle cx="38" cy="34" r="3.6" fill="#ffd9b3"/>
      <circle cx="26" cy="12" r="11.5" fill="#7a4a2b"/>
      <rect x="12.6" y="9" width="5" height="16" rx="2.5" fill="#7a4a2b"/>
      <rect x="30.4" y="9" width="5" height="16" rx="2.5" fill="#7a4a2b"/>
      <circle cx="26" cy="14" r="9.3" fill="#ffd9b3" stroke="none"/>
      <path d="M17.5,10.5 Q20,5.5 26,5.5 Q32,5.5 34.5,10.5 Q30,8 26,8 Q22,8 17.5,10.5 Z" fill="#7a4a2b" stroke="none"/>
    </g>
    <circle cx="34.5" cy="6" r="2.6" fill="#ffd166" stroke="#e0a93e" stroke-width="1.2"/>
    ${FACE}`;

  // 弟弟：绿 T 恤 + 反戴蓝帽（最小的一只）
  const SVG_BRO = `
    <g ${OUTLINE}>
      ${LEGS("#3d4a5c", "#2f3a49")}
      <rect x="13" y="22" width="23" height="24" rx="9" fill="#58c15c"/>
      <rect x="13" y="34" width="23" height="6" fill="#43a44b" stroke="none"/>
      <circle cx="37" cy="36" r="4" fill="#ffd9b3"/>
      <circle cx="26" cy="13" r="11" fill="#ffd9b3"/>
    </g>
    <g stroke="#3861b8" stroke-width="1.6" stroke-linejoin="round" style="paint-order:stroke fill;">
      <path d="M14.5,11 a11.5,11.5 0 0 1 23,0 l0,-1.5 a11.5,10 0 0 0 -23,0 Z" fill="#4f86f7"/>
      <rect x="5" y="6.5" width="10" height="4" rx="2" fill="#4f86f7"/>
    </g>
    ${FACE}`;

  // 姐姐：黄色小裙子 + 双马尾红蝴蝶结（比弟弟高）
  const SVG_SIS = `
    <g ${OUTLINE}>
      ${LEGS("#c96a7c", "#b55a6c")}
      <path d="M17,24 Q26,19 35,24 L38.5,45 Q26,50 13.5,45 Z" fill="#ffd166"/>
      <path d="M14.2,41.5 Q26,46 37.8,41.5 L38.5,45 Q26,50 13.5,45 Z" fill="#f4b53f" stroke="none"/>
      <circle cx="12.5" cy="11.5" r="4.8" fill="#8a5633"/>
      <circle cx="39.5" cy="11.5" r="4.8" fill="#8a5633"/>
      <circle cx="26" cy="13" r="10" fill="#ffd9b3"/>
      <path d="M18,10.5 Q20,5 26,5 Q32,5 34,10.5 Q30,7.5 26,7.5 Q22,7.5 18,10.5 Z" fill="#8a5633" stroke="none"/>
    </g>
    <circle cx="12.5" cy="7.5" r="2.2" fill="#f45b69" stroke="#c23a4a" stroke-width="1"/>
    <circle cx="39.5" cy="7.5" r="2.2" fill="#f45b69" stroke="#c23a4a" stroke-width="1"/>
    ${FACE}`;

  // 队伍按年龄排：爸爸 → 妈妈 → 姐姐 → 弟弟
  const MEMBERS = [
    { id: "dad", size: 1.0, svg: SVG_DAD },
    { id: "mom", size: 0.95, svg: SVG_MOM },
    { id: "sister", size: 0.78, svg: SVG_SIS },
    { id: "brother", size: 0.66, svg: SVG_BRO },
  ];

  // ---------- 状态 ----------
  const home = DATA.home || { lat: 30, lng: 110 };
  const ch = {
    x: toX(home.lng),
    y: toY(home.lat),
    facing: 1, // 1 右 -1 左
    walking: false,
  };

  const family = MEMBERS.map((m, i) => {
    const el = document.createElement("div");
    el.className = "member";
    el.innerHTML =
      `<div class="char-shadow"></div>` +
      `<div class="char-flip"><svg class="char-svg" viewBox="0 0 48 60" xmlns="http://www.w3.org/2000/svg">${m.svg}</svg></div>`;
    familyBox.appendChild(el);
    return {
      ...m, el,
      flip: el.querySelector(".char-flip"),
      x: ch.x - i * 24,
      y: ch.y + (i % 2 ? 6 : -4) * (i ? 1 : 0),
      facing: 1,
    };
  });

  // 领队走过的路径记录，跟队成员沿路径取点
  const hist = [];
  function pushHist(x, y) {
    const last = hist[hist.length - 1];
    if (!last || Math.hypot(x - last.x, y - last.y) > 2) {
      hist.push({ x, y });
      if (hist.length > 500) hist.splice(0, hist.length - 500);
    }
  }
  function samplePos(distBack) {
    let d = 0;
    let prev = { x: ch.x, y: ch.y };
    for (let i = hist.length - 1; i >= 0; i--) {
      const p = hist[i];
      const seg = Math.hypot(prev.x - p.x, prev.y - p.y);
      if (seg > 0 && d + seg >= distBack) {
        const t = (distBack - d) / seg;
        return { x: prev.x + (p.x - prev.x) * t, y: prev.y + (p.y - prev.y) * t };
      }
      d += seg;
      prev = p;
    }
    return null;
  }

  const cam = {
    x: ch.x,
    y: ch.y,
    z: 1.2,
    tz: 1.2, // 目标缩放（平滑过渡）
    follow: true,
  };

  let vw = innerWidth, vh = innerHeight;
  let minZ = 0.2;
  const MAXZ = 8;

  function computeMinZ() {
    vw = innerWidth;
    vh = innerHeight;
    minZ = Math.min(vw / MAP.W, vh / MAP.H) * 0.95;
  }
  computeMinZ();
  addEventListener("resize", () => {
    computeMinZ();
    cam.tz = clamp(cam.tz, minZ, MAXZ);
  });

  // ---------- 输入 ----------
  const keys = new Set();
  const joy = { active: false, dx: 0, dy: 0, pid: null };
  let autoTarget = null; // {x, y, place, open}
  let activeId = null;

  const KEYMAP = {
    ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0],
  };

  addEventListener("keydown", (e) => {
    if (e.repeat && !(e.code in KEYMAP)) return;

    // 弹窗打开时只响应关闭
    if (!$("card-overlay").classList.contains("hidden") ||
        !$("help-overlay").classList.contains("hidden") ||
        !$("data-overlay").classList.contains("hidden") ||
        !$("drawer-overlay").classList.contains("hidden")) {
      if (e.code === "Escape" || e.code === "Enter" || e.code === "Space") {
        closeAllOverlays();
        e.preventDefault();
      }
      return;
    }

    if (e.code in KEYMAP) {
      keys.add(e.code);
      autoTarget = null;
      cam.follow = true;
      e.preventDefault();
    } else if (e.code === "Enter" || e.code === "Space") {
      if (activeId) openCard(activeId);
      e.preventDefault();
    } else if (e.code === "Equal" || e.code === "NumpadAdd") {
      cam.tz = clamp(cam.tz * 1.35, minZ, MAXZ);
    } else if (e.code === "Minus" || e.code === "NumpadSubtract") {
      cam.tz = clamp(cam.tz / 1.35, minZ, MAXZ);
    } else if (e.code === "KeyL") {
      openDrawer();
    } else if (e.code === "KeyF") {
      cam.follow = true;
    } else if (e.code === "KeyH") {
      $("help-overlay").classList.remove("hidden");
    }
  });
  addEventListener("keyup", (e) => keys.delete(e.code));
  addEventListener("blur", () => keys.clear());

  // ---------- 虚拟摇杆 ----------
  const joyEl = $("joystick");
  const knob = $("joystick-knob");
  const JOY_R = 44;

  function setKnob(dx, dy) {
    knob.style.transform = `translate(calc(-50% + ${dx * JOY_R}px), calc(-50% + ${dy * JOY_R}px))`;
  }

  joyEl.addEventListener("pointerdown", (e) => {
    joy.active = true;
    joy.pid = e.pointerId;
    joyEl.setPointerCapture(e.pointerId);
    joyMove(e);
    e.preventDefault();
    e.stopPropagation();
  });
  joyEl.addEventListener("pointermove", (e) => {
    if (joy.active && e.pointerId === joy.pid) joyMove(e);
  });
  function joyEnd(e) {
    if (e.pointerId !== joy.pid) return;
    joy.active = false;
    joy.dx = joy.dy = 0;
    setKnob(0, 0);
  }
  joyEl.addEventListener("pointerup", joyEnd);
  joyEl.addEventListener("pointercancel", joyEnd);

  function joyMove(e) {
    const r = joyEl.getBoundingClientRect();
    let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    joy.dx = dx;
    joy.dy = dy;
    setKnob(dx, dy);
    if (len > 0.15) {
      autoTarget = null;
      cam.follow = true;
    }
  }

  // ---------- 地图拖动 / 捏合缩放 ----------
  const pointers = new Map(); // pointerId -> {x, y}
  let dragging = false;
  let pinchDist = 0;
  let suppressClickUntil = 0; // 拖动结束后短暂屏蔽误触点击

  viewport.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".marker-inner, .ctrl-btn, #joystick, #near-hint, #hud")) return;
    // 捕获指针：即使在窗口外松手也能收到 pointerup，避免拖动状态卡住
    try { viewport.setPointerCapture(e.pointerId); } catch (_) {}
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });

  viewport.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    const cur = { x: e.clientX, y: e.clientY };

    if (pointers.size === 1) {
      const dx = cur.x - prev.x, dy = cur.y - prev.y;
      if (dragging || Math.hypot(dx, dy) > 4) {
        dragging = true;
        cam.follow = false;
        cam.x -= dx / cam.z;
        cam.y -= dy / cam.z;
      }
    } else if (pointers.size === 2) {
      pointers.set(e.pointerId, cur);
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist > 0) {
        const nz = clamp(cam.z * (d / pinchDist), minZ, MAXZ);
        cam.z = nz;
        cam.tz = nz;
      }
      pinchDist = d;
      return;
    }
    pointers.set(e.pointerId, cur);
  });

  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchDist = 0;
    if (pointers.size === 0) {
      // 拖动刚结束时，松手落在标记上会触发一次 click，短暂屏蔽它
      if (dragging) suppressClickUntil = performance.now() + 300;
      dragging = false;
    }
  }
  viewport.addEventListener("pointerup", endPointer);
  viewport.addEventListener("pointercancel", endPointer);

  viewport.addEventListener("wheel", (e) => {
    e.preventDefault();
    cam.tz = clamp(cam.tz * Math.exp(-e.deltaY * 0.0016), minZ, MAXZ);
  }, { passive: false });

  // ---------- 按钮 ----------
  $("btn-zoom-in").onclick = () => { cam.tz = clamp(cam.tz * 1.4, minZ, MAXZ); };
  $("btn-zoom-out").onclick = () => { cam.tz = clamp(cam.tz / 1.4, minZ, MAXZ); };
  $("btn-locate").onclick = () => { cam.follow = true; };
  $("btn-list").onclick = openDrawer;
  $("btn-help").onclick = () => $("help-overlay").classList.remove("hidden");
  nearHint.onclick = () => { if (activeId) openCard(activeId); };

  // ---------- 自动走过去 ----------
  function walkTo(place, openOnArrive) {
    autoTarget = { x: place.x, y: place.y, place, open: !!openOnArrive };
    cam.follow = true;
  }

  // ---------- 地点卡片 ----------
  function openCard(id) {
    const p = places.find((q) => q.id === id);
    if (!p) return;
    $("card-emoji").textContent = p.emoji || "📍";
    $("card-name").textContent = p.name;
    $("card-sub").textContent =
      [p.country, p.nameEn].filter(Boolean).join(" · ") || "";

    const badges = $("card-badges");
    badges.innerHTML = "";
    const b1 = document.createElement("span");
    if (p.visits && p.visits.length > 0) {
      b1.className = "badge visited";
      b1.textContent = "👨‍👩‍👧‍👦 我们来过";
      badges.appendChild(b1);
      const b2 = document.createElement("span");
      b2.className = "badge count";
      b2.textContent = `全家 ${p.visits.length} 次旅行`;
      badges.appendChild(b2);
    } else {
      b1.className = "badge wishlist";
      b1.textContent = "🌟 全家想去";
      badges.appendChild(b1);
    }

    const box = $("card-visits");
    box.innerHTML = "";
    if (p.visits && p.visits.length > 0) {
      const sorted = [...p.visits].sort((a, b) => (a.date < b.date ? 1 : -1));
      for (const v of sorted) {
        const item = document.createElement("div");
        item.className = "visit";

        const d = document.createElement("div");
        d.className = "visit-date";
        d.textContent = "📅 " + (v.date || "日期未知");
        item.appendChild(d);

        if (v.title) {
          const t = document.createElement("div");
          t.className = "visit-title";
          t.textContent = v.title;
          item.appendChild(t);
        }
        if (v.notes) {
          const n = document.createElement("div");
          n.className = "visit-notes";
          n.textContent = v.notes;
          item.appendChild(n);
        }

        const ph = document.createElement("div");
        ph.className = "visit-photos";
        if (v.photos && v.photos.length > 0) {
          for (const url of v.photos) {
            const img = document.createElement("img");
            img.src = url;
            img.alt = v.title || p.name;
            img.loading = "lazy";
            // 图片加载失败时换成占位块，不显示浏览器破图图标
            img.onerror = () => {
              const broken = document.createElement("div");
              broken.className = "photo-placeholder";
              broken.textContent = "🖼️ 图片加载失败";
              img.replaceWith(broken);
            };
            ph.appendChild(img);
          }
        } else {
          const placeholder = document.createElement("div");
          placeholder.className = "photo-placeholder";
          placeholder.textContent = "📷 照片待添加";
          ph.appendChild(placeholder);
        }
        item.appendChild(ph);
        box.appendChild(item);
      }
    } else {
      const empty = document.createElement("div");
      empty.className = "no-visit";
      empty.textContent = "这里在全家的愿望清单上，还没去过 ✈️";
      box.appendChild(empty);
    }

    $("card-overlay").classList.remove("hidden");
  }

  // ---------- 抽屉 ----------
  function openDrawer() {
    const ul = $("drawer-list");
    ul.innerHTML = "";
    const sorted = [...places].sort((a, b) => {
      const av = a.visits?.length ? 0 : 1;
      const bv = b.visits?.length ? 0 : 1;
      return av - bv || (a.name < b.name ? -1 : 1);
    });
    for (const p of sorted) {
      const li = document.createElement("li");
      li.className = "drawer-item" + (p.status === "wishlist" ? " wishlist" : "");

      const em = document.createElement("div");
      em.className = "d-emoji";
      em.textContent = p.emoji || "📍";

      const info = document.createElement("div");
      info.className = "d-info";
      const nm = document.createElement("div");
      nm.className = "d-name";
      nm.textContent = p.name;
      const sub = document.createElement("div");
      sub.className = "d-sub";
      sub.textContent = [
        p.country,
        p.visits?.length ? `${p.visits.length} 次到访` : "想去",
      ].filter(Boolean).join(" · ");
      info.appendChild(nm);
      info.appendChild(sub);

      const go = document.createElement("button");
      go.className = "d-go";
      go.type = "button";
      go.textContent = "前往";
      go.onclick = (e) => {
        e.stopPropagation();
        closeAllOverlays();
        walkTo(p, true);
      };

      li.appendChild(em);
      li.appendChild(info);
      li.appendChild(go);
      li.onclick = () => {
        closeAllOverlays();
        walkTo(p, true);
      };
      ul.appendChild(li);
    }
    $("drawer-overlay").classList.remove("hidden");
  }

  // ---------- 弹窗开关 ----------
  function closeAllOverlays() {
    $("card-overlay").classList.add("hidden");
    $("drawer-overlay").classList.add("hidden");
    $("help-overlay").classList.add("hidden");
    $("data-overlay").classList.add("hidden");
  }
  $("card-close").onclick = closeAllOverlays;
  $("drawer-close").onclick = closeAllOverlays;
  $("help-close").onclick = closeAllOverlays;
  $("help-start").onclick = closeAllOverlays;
  $("card-overlay").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeAllOverlays();
  });
  $("drawer-overlay").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeAllOverlays();
  });
  $("help-overlay").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeAllOverlays();
  });
  $("data-overlay").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeAllOverlays();
  });

  // 首次访问显示帮助
  try {
    if (!localStorage.getItem("tp_seen_help")) {
      $("help-overlay").classList.remove("hidden");
      localStorage.setItem("tp_seen_help", "1");
    }
  } catch (_) { /* 隐私模式下忽略 */ }

  // ========== 数据管理 ==========
  // 用户数据只保存在本机浏览器 localStorage，绝不上传到任何服务器 / GitHub。
  const STORAGE_KEY = "tp_user_data_v1";
  const META_KEY = "tp_user_data_meta_v1";
  let dataMeta = { source: "demo", importedAt: null, fileName: "" };

  // 校验并规范化用户提供的 JSON（宽容模式：跳过无效条目）
  function normalizeData(raw) {
    if (!raw || typeof raw !== "object") throw new Error("文件内容不是有效的 JSON 对象");
    const list = raw.places;
    if (!Array.isArray(list) || list.length === 0) throw new Error("缺少 places 数组（或为空）");
    const seen = new Set();
    const out = [];
    let skipped = 0;
    list.forEach((p, i) => {
      if (!p || typeof p !== "object") { skipped++; return; }
      const lat = Number(p.lat), lng = Number(p.lng);
      const name = (p.name || p.nameEn || "").toString().trim();
      if (!name || !isFinite(lat) || !isFinite(lng) ||
          lat < -90 || lat > 90 || lng < -180 || lng > 180) { skipped++; return; }
      let id = (p.id || "").toString().trim() || ("p" + i);
      while (seen.has(id)) id += "x";
      seen.add(id);
      const visits = Array.isArray(p.visits)
        ? p.visits.filter((v) => v && typeof v === "object").map((v) => ({
            date: (v.date || "").toString(),
            title: (v.title || "").toString(),
            notes: (v.notes || "").toString(),
            photos: Array.isArray(v.photos) ? v.photos.map(String) : [],
          }))
        : [];
      out.push({
        id, name,
        nameEn: (p.nameEn || "").toString(),
        country: (p.country || "").toString(),
        emoji: (p.emoji || "📍").toString(),
        lat, lng,
        status: p.status === "wishlist" ? "wishlist" : "visited",
        visits,
      });
    });
    if (!out.length) throw new Error("没有一条有效的地点记录（每条至少要有 name、lat、lng）");
    let h = raw.home;
    if (h && isFinite(Number(h.lat)) && isFinite(Number(h.lng))) {
      h = { name: (h.name || "家").toString(), lat: Number(h.lat), lng: Number(h.lng) };
    } else {
      h = { name: "家", lat: out[0].lat, lng: out[0].lng };
    }
    return { home: h, places: out, skipped };
  }

  // 应用一份数据：重建地图内容并把一家人送回家
  function applyData(data) {
    buildPlaces(data);
    buildTrail();
    buildPlane();
    updateStats();
    ch.x = clamp(toX(data.home.lng), 8, MAP.W - 8);
    ch.y = clamp(toY(data.home.lat), 8, MAP.H - 8);
    hist.length = 0;
    autoTarget = null;
    activeId = null;
    cheered.clear();
    // 出生点旁边的地点不触发开场庆祝
    for (const p of places) {
      if (Math.hypot(p.x - ch.x, p.y - ch.y) < 80) cheered.add(p.id);
    }
    nearHint.classList.add("hidden");
    family.forEach((f, i) => {
      f.x = ch.x - i * 24;
      f.y = ch.y;
      f.facing = 1;
    });
    cam.x = ch.x;
    cam.y = ch.y;
    cam.follow = true;
  }

  function updateDataStatus() {
    const el = $("data-status");
    if (!el) return;
    if (dataMeta.source === "user") {
      const d = dataMeta.importedAt ? new Date(dataMeta.importedAt) : null;
      const when = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "";
      el.textContent = `📊 当前：我的数据（${places.length} 个地点${dataMeta.fileName ? " · " + dataMeta.fileName : ""}${when ? " · " + when + " 导入" : ""}）`;
    } else {
      el.textContent = "📊 当前：示例数据（还没导入自己的文件）";
    }
  }

  function showDataMsg(msg, isError) {
    const el = $("data-msg");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
    el.classList.toggle("error", !!isError);
  }

  function handleImportFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        // 去掉 Windows 记事本等编辑器写入的 UTF-8 BOM，否则 JSON.parse 会失败
        const norm = normalizeData(JSON.parse(reader.result.replace(/^\uFEFF/, "")));
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ home: norm.home, places: norm.places }));
          localStorage.setItem(META_KEY, JSON.stringify({ importedAt: Date.now(), fileName: file.name }));
        } catch (_) {
          showDataMsg("⚠️ 文件太大，无法保存到本机存储：本次可以正常显示，刷新后需要重新导入", true);
        }
        dataMeta = { source: "user", importedAt: Date.now(), fileName: file.name };
        applyData(norm);
        updateDataStatus();
        showDataMsg(`✅ 导入成功：${norm.places.length} 个地点` + (norm.skipped ? `（跳过 ${norm.skipped} 条无效记录）` : ""), false);
      } catch (err) {
        showDataMsg("❌ 导入失败：" + err.message, true);
      }
    };
    reader.onerror = () => showDataMsg("❌ 文件读取失败", true);
    reader.readAsText(file);
  }

  function resetToDemo() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(META_KEY);
    } catch (_) {}
    dataMeta = { source: "demo", importedAt: null, fileName: "" };
    applyData(normalizeData(DATA));
    updateDataStatus();
    showDataMsg("✅ 已恢复示例数据", false);
  }

  // 数据面板按钮
  $("btn-data").onclick = () => {
    updateDataStatus();
    $("data-msg").classList.add("hidden");
    $("data-overlay").classList.remove("hidden");
  };
  $("data-close").onclick = () => $("data-overlay").classList.add("hidden");
  $("btn-import").onclick = () => $("file-input").click();
  $("file-input").addEventListener("change", (e) => {
    handleImportFile(e.target.files && e.target.files[0]);
    e.target.value = "";
  });
  $("btn-reset-data").onclick = resetToDemo;
  $("btn-template").onclick = () => {
    const template = {
      home: { name: "家", lat: 39.9, lng: 116.4 },
      places: [
        {
          id: "tokyo",
          name: "东京",
          nameEn: "Tokyo",
          country: "日本",
          emoji: "⛩️",
          lat: 35.68,
          lng: 139.69,
          status: "visited",
          visits: [
            { date: "2024-11-22", title: "红叶季之旅", notes: "明治神宫、筑地市场……", photos: [] }
          ]
        },
        {
          id: "reykjavik",
          name: "雷克雅未克",
          nameEn: "Reykjavik",
          country: "冰岛",
          emoji: "🌋",
          lat: 64.15,
          lng: -21.94,
          status: "wishlist",
          visits: []
        }
      ]
    };
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "travel-data.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  // 拖一个 JSON 文件到页面上也能导入（Windows 上很方便）
  addEventListener("dragover", (e) => e.preventDefault());
  addEventListener("drop", (e) => {
    e.preventDefault();
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) {
      closeAllOverlays(); // 避免和其他弹窗叠在一起
      updateDataStatus();
      $("data-msg").classList.add("hidden");
      $("data-overlay").classList.remove("hidden");
      handleImportFile(f);
    }
  });

  // ========== 到达庆祝 ==========
  const cheered = new Set();
  function celebrate(place) {
    if (cheered.has(place.id)) return;
    cheered.add(place.id);
    family.forEach((f, i) => {
      setTimeout(() => {
        f.el.classList.add("cheer");
        setTimeout(() => f.el.classList.remove("cheer"), 1000);
      }, i * 100);
    });
    burstConfetti(place.x, place.y - 20);
  }
  function burstConfetti(wx, wy) {
    const colors = ["#f45b69", "#ffd166", "#4f86f7", "#58c15c", "#ff8f5c", "#a78bfa"];
    const layer = document.createElement("div");
    layer.className = "confetti-layer";
    viewport.appendChild(layer);
    const z = cam.z;
    const sx = vw / 2 + (wx - cam.x) * z;
    const sy = vh / 2 + (wy - cam.y) * z;
    for (let i = 0; i < 24; i++) {
      const s = document.createElement("span");
      s.className = "confetti-piece";
      s.style.background = colors[i % colors.length];
      s.style.left = sx + "px";
      s.style.top = sy + "px";
      layer.appendChild(s);
      const ang = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 90;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist * 0.6 - 70 - Math.random() * 40;
      const rot = Math.random() * 720 - 360;
      s.animate(
        [
          { transform: "translate(-50%,-50%) rotate(0deg)", opacity: 1 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 130}px)) rotate(${rot}deg)`, opacity: 0 },
        ],
        { duration: 900 + Math.random() * 400, easing: "cubic-bezier(.2,.6,.4,1)" }
      );
    }
    setTimeout(() => layer.remove(), 1400);
  }

  // ========== 启动：优先本机保存的数据，否则示例数据 ==========
  (function boot() {
    let data = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        data = normalizeData(JSON.parse(raw));
        const meta = JSON.parse(localStorage.getItem(META_KEY) || "{}");
        dataMeta = { source: "user", importedAt: meta.importedAt || null, fileName: meta.fileName || "" };
      }
    } catch (_) {
      data = null; // 本机存储损坏则退回示例数据
    }
    applyData(data || normalizeData(DATA));
  })();

  // ---------- 主循环 ----------
  let lastT = performance.now();
  let lastActiveCheck = 0;

  function frame(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;

    // 输入向量
    let ix = 0, iy = 0;
    for (const k of keys) {
      const v = KEYMAP[k];
      if (v) { ix += v[0]; iy += v[1]; }
    }
    ix += joy.dx;
    iy += joy.dy;
    const ilen = Math.hypot(ix, iy);
    if (ilen > 1) { ix /= ilen; iy /= ilen; }

    // 速度随缩放调整：拉远时跨洋更快
    const speed = clamp(260 / cam.z, 100, 1100);

    let moving = false;
    if (ilen > 0.12) {
      ch.x += ix * speed * dt;
      ch.y += iy * speed * dt;
      moving = true;
      if (Math.abs(ix) > 0.1) ch.facing = ix > 0 ? 1 : -1;
    } else if (autoTarget) {
      const dx = autoTarget.x - ch.x;
      const dy = autoTarget.y - ch.y;
      const dist = Math.hypot(dx, dy);
      const step = Math.max(speed, 300) * dt;
      if (dist <= step + 2) {
        ch.x = autoTarget.x;
        ch.y = autoTarget.y;
        const t = autoTarget;
        autoTarget = null;
        if (t.open) openCard(t.place.id);
      } else {
        ch.x += (dx / dist) * step;
        ch.y += (dy / dist) * step;
        moving = true;
        if (Math.abs(dx) > 1) ch.facing = dx > 0 ? 1 : -1;
      }
    }

    ch.x = clamp(ch.x, 8, MAP.W - 8);
    ch.y = clamp(ch.y, 8, MAP.H - 8);

    if (moving !== ch.walking) {
      ch.walking = moving;
      for (const f of family) f.el.classList.toggle("walking", moving);
    }

    // 缩放平滑
    cam.z += (cam.tz - cam.z) * Math.min(1, dt * 10);
    if (Math.abs(cam.z - cam.tz) < 0.0005) cam.z = cam.tz;

    // 相机跟随
    if (cam.follow) {
      const k = Math.min(1, dt * 6);
      cam.x += (ch.x - cam.x) * k;
      cam.y += (ch.y - cam.y) * k;
    }

    // 相机限制在世界内
    const halfW = vw / (2 * cam.z);
    const halfH = vh / (2 * cam.z);
    cam.x = halfW * 2 >= MAP.W ? MAP.W / 2 : clamp(cam.x, halfW, MAP.W - halfW);
    cam.y = halfH * 2 >= MAP.H ? MAP.H / 2 : clamp(cam.y, halfH, MAP.H - halfH);

    // 应用变换
    const z = cam.z;
    world.style.transform =
      `translate(${(vw / 2 - cam.x * z).toFixed(2)}px, ${(vh / 2 - cam.y * z).toFixed(2)}px) scale(${z.toFixed(4)})`;

    // 标记 / 人物反向缩放，保持屏幕上大小基本恒定
    const inv = clamp(1 / z, 0.4, 1.5);
    world.style.setProperty("--inv", inv.toFixed(3));
    world.classList.toggle("zoomed-out", z < 0.7);

    // 一家人：爸爸带路，其他人沿走过的路径跟队
    const charScale = clamp(1 / z, 0.5, 1.8);
    const spacing = 30 * charScale;
    pushHist(ch.x, ch.y);
    family[0].x = ch.x;
    family[0].y = ch.y;
    family[0].facing = ch.facing;
    for (let i = 1; i < family.length; i++) {
      const f = family[i];
      const t = samplePos(i * spacing);
      if (t) {
        const k = Math.min(1, dt * 9);
        const nx = f.x + (t.x - f.x) * k;
        const ny = f.y + (t.y - f.y) * k;
        if (Math.abs(nx - f.x) > 0.15) f.facing = nx > f.x ? 1 : -1;
        f.x = nx;
        f.y = ny;
      }
    }
    for (const f of family) {
      f.el.style.zIndex = 20 + ((f.y / 12) | 0);
      f.el.style.transform =
        `translate(${f.x.toFixed(1)}px, ${f.y.toFixed(1)}px) scale(${(charScale * f.size).toFixed(3)})`;
      f.flip.classList.toggle("flip", f.facing < 0);
    }

    // 地图描边宽度 / 浪花圈 / 陆地投影偏移随缩放调整
    landPath.setAttribute("stroke-width", Math.max(0.8, 3 / z).toFixed(2));
    trailLine.setAttribute("stroke-width", Math.max(2, 4.5 / z).toFixed(2));
    coastFoam.setAttribute("stroke-width", clamp(14 / z, 5, 34).toFixed(1));
    landShadow.style.transform = `translateY(${clamp(12 / z, 3, 22).toFixed(1)}px)`;

    // 小飞机
    updatePlane(now, inv);

    // 附近地点检测（每 100ms 一次即可）
    if (now - lastActiveCheck > 100) {
      lastActiveCheck = now;
      const threshold = Math.max(26, 70 / z);
      let best = null, bestD = Infinity;
      for (const p of places) {
        const d = Math.hypot(p.x - ch.x, p.y - ch.y);
        if (d < threshold && d < bestD) { best = p; bestD = d; }
      }
      const newId = best ? best.id : null;
      if (newId !== activeId) {
        if (activeId) {
          const old = places.find((q) => q.id === activeId);
          old && old.el.classList.remove("active");
        }
        activeId = newId;
        if (best) {
          best.el.classList.add("active");
          nearHintEmoji.textContent = best.emoji || "📍";
          nearHintText.textContent =
            best.visits?.length ? `看看我们在「${best.name}」的回忆` : `看看「${best.name}」`;
          nearHint.classList.remove("hidden");
          // 走到去过的地方：全家欢呼 + 彩纸
          if (best.visits?.length) celebrate(best);
        } else {
          nearHint.classList.add("hidden");
        }
      }
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
