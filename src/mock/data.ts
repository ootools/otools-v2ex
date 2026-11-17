import type { V2exMember, V2exNode, V2exNotification, V2exReply, V2exTopic } from '../types';

const now = () => Math.floor(Date.now() / 1000);

const member = (id: number, username: string, tagline?: string): V2exMember => ({
  id,
  username,
  tagline,
  avatar_normal: '',
});

const node = (
  id: number,
  name: string,
  title: string,
  topics: number,
  parent?: string,
  root = false,
): V2exNode => ({
  id,
  name,
  title,
  title_alternative: name,
  topics,
  parent_node_name: parent ?? null,
  root,
  avatar_mini: '',
});

const nodes: V2exNode[] = [
  node(1, 'tech', '技术', 184203, undefined, true),
  node(2, 'programming', '程序员', 60321, 'tech'),
  node(3, 'python', 'Python', 12043, 'tech'),
  node(4, 'javascript', 'JavaScript', 9021, 'tech'),
  node(5, 'rust', 'Rust', 3210, 'tech'),
  node(6, 'android', 'Android', 18742, 'tech'),
  node(7, 'linux', 'Linux', 15203, 'tech'),
  node(8, 'create', '分享创造', 39019, undefined, true),
  node(9, 'ideas', '奇思妙想', 8201, 'create'),
  node(10, 'show', '分享发现', 51203, 'create'),
  node(11, 'qna', '问与答', 42103, undefined, true),
  node(12, 'life', '生活', 39210, undefined, true),
  node(13, 'career', '职场话题', 21033, 'life'),
  node(14, 'travel', '旅行', 7201, 'life'),
  node(15, 'food', '美食', 6201, 'life'),
  node(16, 'apple', 'Apple', 30122, undefined, true),
  node(17, 'macos', 'macOS', 12003, 'apple'),
  node(18, 'ios', 'iOS', 9011, 'apple'),
  node(19, 'jobs', '酷工作', 18021, undefined, true),
  node(20, 'deals', '交易', 22013, undefined, true),
  node(21, 'photography', '摄影', 5102, 'create'),
  node(22, 'reading', '阅读', 4902, 'life'),
  node(23, 'movie', '电影', 3901, 'life'),
  node(24, 'music', '音乐', 4302, 'life'),
];

const nodeByName = (name: string): V2exNode => nodes.find((item) => item.name === name) ?? nodes[1];

const topics: V2exTopic[] = [
  {
    id: 1257265,
    title: '用 Rust 写了一个本地优先的书签管理器，终于不用再和浏览器书签较劲了',
    content:
      '浏览器书签同步一直是痛点：换设备、换浏览器就要重新整理。这个工具把书签存成 SQLite，本地搜索、标签、全文索引都在本地完成。',
    content_rendered:
      '<p>浏览器书签同步一直是痛点：换设备、换浏览器就要重新整理。这个工具把书签存成 <strong>SQLite</strong>，本地搜索、标签、全文索引都在本地完成。</p><p>目前支持 macOS 和 Windows，数据可以放在 iCloud 或 Syncthing 目录里做同步。欢迎试用后提意见。</p>',
    replies: 18,
    created: now() - 60 * 12,
    last_touched: now() - 60 * 3,
    member: member(788579, 'yuchuan520', '做点小工具'),
    node: nodeByName('create'),
  },
  {
    id: 1257264,
    title: '大家现在还会用 RSS 吗？我整理了一份还能用的源列表',
    content: '最近重新捡起 RSS，发现很多源都停了。整理了一份还在更新的站点列表，欢迎补充。',
    content_rendered:
      '<p>最近重新捡起 RSS，发现很多源都停了。整理了一份还在更新的站点列表，欢迎补充。</p><ul><li>少数派</li><li>阮一峰的网络日志</li><li>Hacker News 前 50</li></ul>',
    replies: 42,
    created: now() - 60 * 48,
    last_touched: now() - 60 * 10,
    member: member(174792, 'langren'),
    node: nodeByName('qna'),
  },
  {
    id: 1257263,
    title: '关于远程办公的一点观察：真正难的不是沟通，而是边界',
    content: '远程三年，最大的感受是工作和生活的边界会慢慢消失。分享一下我现在的做法。',
    content_rendered:
      '<p>远程三年，最大的感受是工作和生活的边界会慢慢消失。分享一下我现在的做法：</p><ol><li>固定工位，只在工位处理工作；</li><li>下班后关掉所有工作通知；</li><li>每周至少两天出门。</li></ol><p>不一定适合所有人，但对我有效。</p>',
    replies: 31,
    created: now() - 60 * 90,
    last_touched: now() - 60 * 25,
    member: member(2333, 'kenshin', '远程工作者'),
    node: nodeByName('career'),
  },
  {
    id: 1257262,
    title: 'Mac mini M4 当家庭服务器两个月：功耗、噪音和踩过的坑',
    content: '主要跑 Docker、媒体库和备份。功耗实测待机 4W 左右，满载不到 30W。',
    content_rendered:
      '<p>主要跑 Docker、媒体库和备份。功耗实测待机 <strong>4W</strong> 左右，满载不到 30W，放在客厅基本听不到声音。</p><p>踩坑：外置硬盘休眠会导致容器报错，最后换了带独立供电的硬盘盒才稳定。</p>',
    replies: 12,
    created: now() - 60 * 150,
    last_touched: now() - 60 * 40,
    member: member(9201, 'northis', '折腾'),
    node: nodeByName('macos'),
  },
  {
    id: 1257261,
    title: '有没有人和我一样，越写代码越不想开会',
    content: '不是抗拒沟通，是很多会根本不需要我参加。',
    content_rendered:
      '<p>不是抗拒沟通，是很多会根本不需要我参加。写代码需要连续的注意力，一个会打断就很难接回来。</p><blockquote>能异步说清楚的事，就别拉会。</blockquote>',
    replies: 57,
    created: now() - 180 * 60,
    last_touched: now() - 55 * 60,
    member: member(5521, 'muxueqz'),
    node: nodeByName('programming'),
  },
  {
    id: 1257260,
    title: '把旧 Android 手机改造成厨房电子相框，成本不到 20 块',
    content: '用旧手机 + 一个支架 + 自动化 App，定时切换家人照片。',
    content_rendered:
      '<p>用旧手机 + 一个支架 + 自动化 App，定时切换家人照片。屏幕常亮、随环境光调亮度、夜间自动熄屏。</p><p>关键是把电池管理关掉，不然系统会把后台任务杀掉。</p>',
    replies: 9,
    created: now() - 200 * 60,
    last_touched: now() - 120 * 60,
    member: member(8811, 'oldphone'),
    node: nodeByName('android'),
  },
  {
    id: 1257259,
    title: '第一次用 Tauri 打包桌面应用，记录一下踩到的坑',
    content: '从 Electron 迁到 Tauri，体积从 120MB 降到 8MB，但跨平台签名花了不少时间。',
    content_rendered:
      '<p>从 Electron 迁到 Tauri，体积从 <strong>120MB</strong> 降到 <strong>8MB</strong>，但跨平台签名花了不少时间。</p><p>记录几个坑：</p><ul><li>Windows 的 WebView2 不是所有机器都有；</li><li>macOS 公证需要处理 hardened runtime；</li><li>Linux 的依赖版本差异最大。</li></ul>',
    replies: 24,
    created: now() - 260 * 60,
    last_touched: now() - 180 * 60,
    member: member(3120, 'taurifan'),
    node: nodeByName('rust'),
  },
  {
    id: 1257258,
    title: '独立开发第 100 天，收入 0，但我还想再试一年',
    content: '做了一个很小众的工具，用户不多，但每天都有几个人在用。',
    content_rendered:
      '<p>做了一个很小众的工具，用户不多，但每天都有几个人在用。有人给我发邮件说解决了他的问题，那一刻觉得值了。</p><p>写下这些不是卖惨，只是想给同样在路上的人一点参考。</p>',
    replies: 68,
    created: now() - 320 * 60,
    last_touched: now() - 240 * 60,
    member: member(6612, 'indie100'),
    node: nodeByName('ideas'),
  },
  {
    id: 1257257,
    title: '求推荐一把安静的机械键盘，办公室用',
    content: '预算 800 以内，最好支持 Mac 键位。',
    content_rendered: '<p>预算 800 以内，最好支持 Mac 键位。现在用的是青轴，同事已经快被我逼疯了。</p>',
    replies: 35,
    created: now() - 400 * 60,
    last_touched: now() - 300 * 60,
    member: member(7701, 'kbuser'),
    node: nodeByName('qna'),
  },
  {
    id: 1257256,
    title: '分享一组最近拍的街景，都是下班路上的十分钟',
    content: '每天固定路线，但光线和行人每天都不一样。',
    content_rendered:
      '<p>每天固定路线，但光线和行人每天都不一样。坚持拍了三个月，挑了几张自己最喜欢的。</p><p>器材是富士 X100V，基本都是直出。</p>',
    replies: 15,
    created: now() - 480 * 60,
    last_touched: now() - 360 * 60,
    member: member(9102, 'streetlight'),
    node: nodeByName('photography'),
  },
];

const replies: V2exReply[] = [
  {
    id: 9001,
    topic_id: 1257265,
    created: now() - 60 * 10,
    member: member(1001, 'Livid', 'Remember the bigger green'),
    content: '看起来不错，本地优先是正确方向。',
    content_rendered: '<p>看起来不错，本地优先是正确方向。</p>',
  },
  {
    id: 9002,
    topic_id: 1257265,
    created: now() - 60 * 8,
    member: member(1002, 'est'),
    content: '请问全文索引用的是什么方案？',
    content_rendered: '<p>请问全文索引用的是什么方案？</p>',
  },
  {
    id: 9003,
    topic_id: 1257265,
    created: now() - 60 * 6,
    member: member(788579, 'yuchuan520', '做点小工具'),
    content: '用的是 SQLite FTS5，中文分词用 jieba-rs。',
    content_rendered: '<p>用的是 SQLite FTS5，中文分词用 jieba-rs。</p>',
  },
  {
    id: 9004,
    topic_id: 1257265,
    created: now() - 60 * 4,
    member: member(1004, 'muxueqz'),
    content: '建议加一个从 Chrome 导入的入口，迁移成本会低很多。',
    content_rendered: '<p>建议加一个从 Chrome 导入的入口，迁移成本会低很多。</p>',
  },
  {
    id: 9005,
    topic_id: 1257265,
    created: now() - 60 * 2,
    member: member(1005, 'oldphone'),
    content: '已 star，等一个 Linux 版本。',
    content_rendered: '<p>已 star，等一个 Linux 版本。</p>',
  },
];

class MockHttpError extends Error {}

const json = (value: unknown): string => JSON.stringify(value);

interface MockContext {
  method: string;
  auth: boolean;
  token?: string;
}

interface MockResult {
  status: number;
  body: string;
}

/** 模拟已登录账号（?mock=1 时任何 ≥16 位且不含 "bad" 的 token 都能登录）。 */
const selfMember: V2exMember = {
  ...member(1001, 'otools', '本地优先'),
  bio: '把常用的东西做成桌面插件，顺便记录踩过的坑。',
  url: 'https://www.v2ex.com/member/otools',
  avatar_large: '',
};

let mockNotifications: V2exNotification[] = [
  {
    id: 90001,
    member: member(174792, 'langren'),
    text: '在主题 <a href="/t/1257265">用 Rust 写了一个本地优先的书签管理器</a> 中回复了你：<br>请问全文索引用的是什么方案？',
    payload: 'topic:1257265?reply=9002',
    created: now() - 60 * 6,
  },
  {
    id: 90002,
    member: member(2333, 'kenshin', '远程工作者'),
    text: '感谢了你在主题 <a href="/t/1257263">关于远程办公的一点观察</a> 中的回复。',
    payload: 'topic:1257263',
    created: now() - 60 * 48,
  },
  {
    id: 90003,
    member: member(9201, 'northis', '折腾'),
    text: '在主题 <a href="/t/1257262">Mac mini M4 当家庭服务器两个月</a> 中提到了你：<br>@otools 你那边硬盘盒是什么型号？',
    payload: 'topic:1257262?reply=9008',
    created: now() - 60 * 150,
  },
];

const ok = (value: unknown): MockResult => ({ status: 200, body: json(value) });
const v2 = (result: unknown): MockResult => ok({ success: true, result });

export function resolveMock(rawUrl: string, context: MockContext): MockResult | null {
  const url = new URL(rawUrl);
  const path = url.pathname;
  const query = url.searchParams;

  // ---- API 2.0（需要 token）----
  if (path.startsWith('/api/v2/')) {
    // 令牌里带 "bad" 时模拟失效，方便调试错误态。
    if (!context.auth || context.token?.includes('bad')) {
      return { status: 401, body: json({ success: false, message: 'unauthorized' }) };
    }

    if (path === '/api/v2/token') {
      return v2({
        token: 'mock-token-0000-0000-000000000000',
        scope: 'regular',
        created: now() - 86400 * 30,
        expiration: now() + 86400 * 60,
        good_for_days: 90,
      });
    }
    if (path === '/api/v2/member') return v2(selfMember);

    if (path === '/api/v2/notifications') return v2(mockNotifications);

    const removal = path.match(/^\/api\/v2\/notifications\/(\d+)$/);
    if (removal) {
      if (context.method !== 'DELETE') return { status: 405, body: json({ success: false, message: 'method not allowed' }) };
      mockNotifications = mockNotifications.filter((item) => item.id !== Number(removal[1]));
      return v2(null);
    }

    const repliesV2 = path.match(/^\/api\/v2\/topics\/(\d+)\/replies$/);
    if (repliesV2) {
      const topicId = Number(repliesV2[1]);
      // v2 的回复不带 topic_id，这里如实模拟。
      return v2(
        replies
          .filter((item) => item.topic_id === topicId)
          .map((item) => ({
            id: item.id,
            content: item.content,
            content_rendered: item.content_rendered,
            created: item.created,
            member: item.member,
          })),
      );
    }

    const topicV2 = path.match(/^\/api\/v2\/topics\/(\d+)$/);
    if (topicV2) {
      const topic = topics.find((item) => item.id === Number(topicV2[1]));
      return topic ? v2(topic) : { status: 404, body: json({ success: false, message: 'not found' }) };
    }

    const nodeTopicsV2 = path.match(/^\/api\/v2\/nodes\/([^/]+)\/topics$/);
    if (nodeTopicsV2) {
      const name = decodeURIComponent(nodeTopicsV2[1]);
      return v2(topics.filter((item) => item.node?.name === name));
    }

    return null;
  }

  // ---- API 1.0（公开只读）----
  if (path.endsWith('/nodes/all.json')) return ok(nodes);
  if (path.endsWith('/topics/latest.json')) return ok(topics);
  if (path.endsWith('/topics/hot.json')) return ok(topics.slice(0, 6));

  if (path.endsWith('/topics/show.json')) {
    const id = Number(query.get('id'));
    if (Number.isFinite(id) && id > 0) {
      const topic = topics.find((item) => item.id === id);
      return ok(topic ? [topic] : []);
    }
    const nodeName = query.get('node_name');
    if (nodeName) {
      return ok(topics.filter((item) => item.node?.name === nodeName));
    }
    return ok(topics);
  }

  if (path.endsWith('/replies/show.json')) {
    const topicId = Number(query.get('topic_id'));
    return ok(replies.filter((item) => item.topic_id === topicId));
  }

  throw new MockHttpError(`no mock for ${rawUrl}`);
}
