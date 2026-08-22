# 🧳 我的旅行足迹地图

一个可交互的卡通旅行记录网站：爸爸、妈妈、姐姐、弟弟一家四口在「大致真实」的世界地图上排队旅行，
走到去过的地方，地点会亮起弹跳，打开就能看到当时的旅行记录。橙色虚线是按时间顺序连起来的旅行路线。

纯静态页面，无任何构建步骤和依赖，直接托管在 GitHub Pages 上即可。

## 🎮 操作方式

| 平台 | 操作 |
|------|------|
| 💻 Windows / 电脑 | 方向键 或 `WASD` 移动 · `回车`/`空格` 打开地点 · `Esc` 关闭 · `+`/`-` 或滚轮缩放 · `L` 地点列表 · `F` 回到一家人 · `H` 帮助 · 鼠标拖动平移 |
| 📱 iPhone / iPad | 左下角虚拟摇杆移动 · 点地点图标自动走过去并打开 · 双指捏合缩放 · 单指拖动平移 · 🎯 回到一家人 |

## 🚀 部署到 GitHub Pages

1. 把本分支合并到 `main`（或直接把这些文件放到 `main`）。
2. 打开仓库 **Settings → Pages**。
3. **Source** 选 `Deploy from a branch`，分支选 `main`，目录选 `/ (root)`，保存。
4. 一两分钟后访问 `https://<你的用户名>.github.io/TravelPlaces/`。

之后 iPhone/iPad 上用 Safari 打开这个网址，还可以「添加到主屏幕」，像 App 一样全屏使用。

## 📁 项目结构

```
index.html              页面结构
css/style.css           全部样式（卡通贴纸风、动画、响应式）
css/fonts.css           卡通字体声明（站酷快乐体，自托管）
js/app.js               核心逻辑：相机、键盘/摇杆/触摸输入、地点交互、小飞机动画
js/world-map.js         世界地图轮廓（由 Natural Earth 数据自动生成，勿手改）
data/places.js          内置示例数据（没导入文件时显示）
data/travel-data.example.json  用户数据文件格式示例
assets/fonts/           站酷快乐体 woff2 分片（浏览器按需加载，国内外都可访问）
assets/icon.svg         网站图标
manifest.webmanifest    PWA 清单（支持添加到主屏幕）
```

## 📝 导入你自己的数据（🔒 绝不上传）

**隐私原则：这个仓库只是"显示器"，你的真实旅行数据永远不进 git。**
数据文件在网页里本机导入，只保存在那台设备的浏览器 localStorage 里，
不会发送到 GitHub 或任何服务器。换设备/清浏览器数据后重新导入即可。

使用方法：

1. 打开网页，点右下角 **📂** 按钮 → 「下载数据模板」得到 `travel-data.json`
   （或参考仓库里的 `data/travel-data.example.json`）。
2. 按下面的格式填入你的旅行记录（可以手写，也可以让 AI 帮你从邮件/Google 地图记录整理生成）。
3. 回到网页 📂 面板 → 「导入数据文件」选择这个 json；电脑上也可以直接把文件**拖进页面**。
4. 想回到演示状态就点「恢复示例数据」。

没导入过文件时，页面显示的是内置示例数据（`data/places.js`）。

### 文件格式（JSON）

```json
{
  "home": { "name": "家", "lat": 39.9, "lng": 116.4 },
  "places": [
    {
      "id": "tokyo",
      "name": "东京",
      "nameEn": "Tokyo",
      "country": "日本",
      "emoji": "⛩️",
      "lat": 35.68,
      "lng": 139.69,
      "status": "visited",
      "visits": [
        {
          "date": "2024-11-22",
          "title": "红叶季之旅",
          "notes": "明治神宫、筑地市场……",
          "photos": ["https://…/photo.jpg"]
        }
      ]
    }
  ]
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `name` `lat` `lng` | ✅ | 名称 + 真实经纬度（自动定位到地图） |
| `emoji` | | 地图图标，默认 📍 |
| `status` | | `visited` 去过（默认）/ `wishlist` 想去 |
| `visits[]` | | 每次旅行一条：`date`（YYYY-MM-DD）、`title`、`notes`、`photos[]` |
| `home` | | 一家人的出生点，缺省用第一个地点 |

- 旅行路线虚线按每个地点**最早一次到访的日期**排序连线，小飞机沿它飞行。
- 无效条目会被自动跳过并提示，不会导致整个文件导入失败。
- 照片用公网 URL；本地照片暂不支持存储（localStorage 放不下大图）。

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
