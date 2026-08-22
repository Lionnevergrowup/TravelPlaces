# 🧳 我的旅行足迹地图

一个可交互的卡通旅行记录网站：一个背着背包的小人在「大致真实」的世界地图上走来走去，
走到去过的地方，地点会亮起弹跳，打开就能看到当时的旅行记录。橙色虚线是按时间顺序连起来的旅行路线。

纯静态页面，无任何构建步骤和依赖，直接托管在 GitHub Pages 上即可。

## 🎮 操作方式

| 平台 | 操作 |
|------|------|
| 💻 Windows / 电脑 | 方向键 或 `WASD` 移动 · `回车`/`空格` 打开地点 · `Esc` 关闭 · `+`/`-` 或滚轮缩放 · `L` 地点列表 · `F` 回到小人 · `H` 帮助 · 鼠标拖动平移 |
| 📱 iPhone / iPad | 左下角虚拟摇杆移动 · 点地点图标自动走过去并打开 · 双指捏合缩放 · 单指拖动平移 · 🎯 回到小人 |

## 🚀 部署到 GitHub Pages

1. 把本分支合并到 `main`（或直接把这些文件放到 `main`）。
2. 打开仓库 **Settings → Pages**。
3. **Source** 选 `Deploy from a branch`，分支选 `main`，目录选 `/ (root)`，保存。
4. 一两分钟后访问 `https://<你的用户名>.github.io/TravelPlaces/`。

之后 iPhone/iPad 上用 Safari 打开这个网址，还可以「添加到主屏幕」，像 App 一样全屏使用。

## 📁 项目结构

```
index.html              页面结构（含卡通小人 SVG）
css/style.css           全部样式（卡通贴纸风、动画、响应式）
css/fonts.css           卡通字体声明（站酷快乐体，自托管）
js/app.js               核心逻辑：相机、键盘/摇杆/触摸输入、地点交互、小飞机动画
js/world-map.js         世界地图轮廓（由 Natural Earth 数据自动生成，勿手改）
data/places.js          ★ 旅行数据（目前是示例数据）
assets/fonts/           站酷快乐体 woff2 分片（浏览器按需加载，国内外都可访问）
assets/icon.svg         网站图标
manifest.webmanifest    PWA 清单（支持添加到主屏幕）
```

## 📝 数据格式（接入真实数据用）

所有旅行数据都在 `data/places.js` 一个文件里，页面自动渲染。
之后分析邮箱行程邮件和 Google 地图记录时，只需要按这个结构生成数据：

```js
window.TRAVEL_DATA = {
  home: { name: "家", lat: 39.9, lng: 116.4 },   // 小人初始位置
  places: [
    {
      id: "tokyo",             // 唯一 id
      name: "东京",             // 显示名称
      nameEn: "Tokyo",
      country: "日本",
      emoji: "⛩️",             // 地图上的图标
      lat: 35.68, lng: 139.69, // 真实经纬度，自动定位到地图上
      status: "visited",       // "visited" 去过 / "wishlist" 想去
      visits: [                // 每次到访一条记录
        {
          date: "2024-11-22",
          title: "红叶季",
          notes: "明治神宫、筑地市场……",
          photos: ["assets/photos/tokyo-1.jpg"]  // 可选，留空显示占位图
        }
      ]
    }
  ]
};
```

- 旅行路线虚线按每个地点**最早一次到访的日期**排序连线。
- 照片放进 `assets/photos/` 目录，然后在 `photos` 里写相对路径即可。

## 🛠️ 本地预览

任何静态服务器都行，例如：

```bash
python -m http.server 8000
# 或
npx serve
```

然后打开 http://localhost:8000

## 🗺️ 关于地图

`js/world-map.js` 由 [world-atlas](https://github.com/topojson/world-atlas)（Natural Earth 1:110m）数据
经等距圆柱投影（x = (lng+180)×10，y = (90−lat)×10，世界坐标 3600×1800）生成，
所以任何真实经纬度都能直接换算成地图位置。
