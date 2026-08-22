/**
 * 旅行地点数据
 * ============
 * 目前是【示例数据】，用于搭框架。
 * 之后接入真实数据（邮箱订单/行程邮件 + Google 地图足迹分析）时，
 * 只需要按同样的结构重新生成这个文件即可，页面会自动渲染。
 *
 * 字段说明：
 *   id      - 唯一标识（英文小写，不重复）
 *   name    - 中文名称
 *   nameEn  - 英文名称（可选）
 *   country - 国家/地区
 *   emoji   - 地图上显示的图标
 *   lat/lng - 纬度/经度（真实坐标，地图会自动定位）
 *   status  - "visited"（去过） 或 "wishlist"（想去）
 *   visits  - 每次到访记录数组：
 *     date   - 日期 YYYY-MM-DD（用于绘制旅行路线的先后顺序）
 *     title  - 这次行程的标题
 *     notes  - 备注/回忆
 *     photos - 照片 URL 数组（可选，留空显示占位图）
 */
window.TRAVEL_DATA = {
  // 出生点 / 家（一家人初始站的位置）
  home: { name: "家", lat: 39.9, lng: 116.4 },

  places: [
    {
      id: "beijing",
      name: "北京",
      nameEn: "Beijing",
      country: "中国",
      emoji: "🏯",
      lat: 39.9,
      lng: 116.4,
      status: "visited",
      visits: [
        {
          date: "2023-10-01",
          title: "示例 · 国庆故宫长城行",
          notes: "这是示例数据。接入真实邮件/地图数据后会替换成你的记录。",
          photos: []
        }
      ]
    },
    {
      id: "shanghai",
      name: "上海",
      nameEn: "Shanghai",
      country: "中国",
      emoji: "🌃",
      lat: 31.23,
      lng: 121.47,
      status: "visited",
      visits: [
        {
          date: "2024-04-13",
          title: "示例 · 外滩周末",
          notes: "示例记录：外滩夜景、豫园小笼包。",
          photos: []
        },
        {
          date: "2025-01-18",
          title: "示例 · 跨年再访",
          notes: "同一个地方可以有多条到访记录。",
          photos: []
        }
      ]
    },
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
        {
          date: "2024-11-22",
          title: "示例 · 红叶季",
          notes: "示例记录：明治神宫、筑地市场。",
          photos: []
        }
      ]
    },
    {
      id: "chiangmai",
      name: "清迈",
      nameEn: "Chiang Mai",
      country: "泰国",
      emoji: "🐘",
      lat: 18.79,
      lng: 98.98,
      status: "visited",
      visits: [
        {
          date: "2023-02-05",
          title: "示例 · 泼水节前的清迈",
          notes: "示例记录：古城、夜市、大象营。",
          photos: []
        }
      ]
    },
    {
      id: "paris",
      name: "巴黎",
      nameEn: "Paris",
      country: "法国",
      emoji: "🥐",
      lat: 48.86,
      lng: 2.35,
      status: "visited",
      visits: [
        {
          date: "2024-06-30",
          title: "示例 · 卢浮宫与塞纳河",
          notes: "示例记录：埃菲尔铁塔、蒙马特高地。",
          photos: []
        }
      ]
    },
    {
      id: "newyork",
      name: "纽约",
      nameEn: "New York",
      country: "美国",
      emoji: "🗽",
      lat: 40.71,
      lng: -74.01,
      status: "visited",
      visits: [
        {
          date: "2025-05-02",
          title: "示例 · 曼哈顿五日",
          notes: "示例记录：中央公园、大都会博物馆。",
          photos: []
        }
      ]
    },
    {
      id: "sydney",
      name: "悉尼",
      nameEn: "Sydney",
      country: "澳大利亚",
      emoji: "🎭",
      lat: -33.87,
      lng: 151.21,
      status: "visited",
      visits: [
        {
          date: "2022-12-24",
          title: "示例 · 南半球的圣诞",
          notes: "示例记录：歌剧院、邦迪海滩。",
          photos: []
        }
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
