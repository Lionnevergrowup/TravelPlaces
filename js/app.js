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
  const charEl = $("character");
  const charFlip = charEl.querySelector(".char-flip");
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

  // ---------- 地点标记 ----------
  const places = DATA.places.map((p) => ({
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
      if (p.id === activeId) openCard(p.id);
      else walkTo(p, /*openOnArrive*/ true);
    });
  }

  // ---------- 旅行路线（按首次到访时间连线） ----------
  (function buildTrail() {
    const visited = places
      .filter((p) => p.visits && p.visits.length > 0)
      .map((p) => ({ p, first: p.visits.map((v) => v.date).sort()[0] }))
      .sort((a, b) => (a.first < b.first ? -1 : 1))
      .map((o) => o.p);
    if (visited.length < 2) return;
    trailLine.setAttribute(
      "points",
      visited.map((p) => `${p.x},${p.y}`).join(" ")
    );
  })();

  // ---------- 统计 ----------
  const visitedTotal = places.filter((p) => p.visits && p.visits.length > 0).length;
  $("visited-count").textContent = visitedTotal;
  $("total-count").textContent = places.length;

  // ---------- 状态 ----------
  const home = DATA.home || { lat: 30, lng: 110 };
  const ch = {
    x: toX(home.lng),
    y: toY(home.lat),
    facing: 1, // 1 右 -1 左
    walking: false,
  };

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

  viewport.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".marker-inner, .ctrl-btn, #joystick, #near-hint, #hud")) return;
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
    if (pointers.size === 0) dragging = false;
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
      b1.textContent = "✅ 去过";
      badges.appendChild(b1);
      const b2 = document.createElement("span");
      b2.className = "badge count";
      b2.textContent = `共 ${p.visits.length} 次到访`;
      badges.appendChild(b2);
    } else {
      b1.className = "badge wishlist";
      b1.textContent = "🌟 想去清单";
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
      empty.textContent = "还没有到访记录，这是想去的地方 ✈️";
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
      sub.textContent = p.visits?.length
        ? `${p.country} · ${p.visits.length} 次到访`
        : `${p.country} · 想去`;
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

  // 首次访问显示帮助
  try {
    if (!localStorage.getItem("tp_seen_help")) {
      $("help-overlay").classList.remove("hidden");
      localStorage.setItem("tp_seen_help", "1");
    }
  } catch (_) { /* 隐私模式下忽略 */ }

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
      charEl.classList.toggle("walking", moving);
    }
    charFlip.classList.toggle("flip", ch.facing < 0);

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

    // 标记 / 小人反向缩放，保持屏幕上大小基本恒定
    const inv = clamp(1 / z, 0.4, 1.5);
    world.style.setProperty("--inv", inv.toFixed(3));
    world.classList.toggle("zoomed-out", z < 0.7);
    charEl.style.transform =
      `translate(${ch.x.toFixed(1)}px, ${ch.y.toFixed(1)}px) scale(${clamp(1 / z, 0.5, 1.8).toFixed(3)})`;

    // 地图描边宽度随缩放调整
    landPath.setAttribute("stroke-width", Math.max(0.8, 2.4 / z).toFixed(2));
    trailLine.setAttribute("stroke-width", Math.max(2, 4.5 / z).toFixed(2));

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
            best.visits?.length ? `查看「${best.name}」的记录` : `看看「${best.name}」`;
          nearHint.classList.remove("hidden");
        } else {
          nearHint.classList.add("hidden");
        }
      }
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
