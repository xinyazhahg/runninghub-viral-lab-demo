const DEBUG_V1_SNAPSHOT_KEY = "rh_debug_v1_full_snapshot_v2";
const state = {
  page: "home",
  selectedInspiration: null,
  uploadedVideo: null,
  flowStatus: "idle",
  analysisTimer: null,
  analyzing: false,
  analyzed: false,
  nodeOffsets: {},
  dragNode: null,
  suppressUploadClick: false,
  activeItemId: null,
  activeBranchId: null,
  openPickerId: null,
  activeTextEditorId: null,
  activeCopyBranchId: null,
  activeCopyModalId: null,
  activeAudioLinkId: null,
  pendingUploadChoice: null,
  playingAudioId: null,
  assetSource: "上传新素材",
  revisingConfig: false,
  currentBase: "上传替换与定制",
  currentConfigNumber: 1,
  currentVersion: null,
  resultPromptDirty: false,
  openQualityParam: null,
  activeResultParamKey: null,
  activeResultParamVersionId: null,
  activeResultParamDraft: null,
  activeResultTimeStart: 0,
  reviseNoticeTimer: null,
  latestVersionId: null,
  branchConfigs: [],
  latestBranchId: null,
  generatingTarget: null,
  flowEdges: [],
  lastFlowGraphSignature: "",
  resultParams: {
    ratio: "9:16",
    quality: "720P",
    duration: "18s",
    timeStart: 0,
  },
  recentUploads: ["我的照片.jpg"],
  versions: [],
  customItems: [
    {
      id: "hero1",
      group: "主体",
      title: "主体 1",
      preview: "preview-subject-1",
      original: "使用原视频主体",
      current: "使用原视频主体",
      changed: false,
    },
    {
      id: "hero2",
      group: "主体",
      title: "主体 2",
      preview: "preview-subject-2",
      original: "使用原视频主体",
      current: "使用原视频主体",
      changed: false,
    },
    {
      id: "hero3",
      group: "主体",
      title: "主体 3",
      preview: "preview-subject-3",
      original: "使用原视频主体",
      current: "使用原视频主体",
      changed: false,
    },
    {
      id: "scene",
      group: "场景",
      title: "场景 1",
      preview: "preview-scene-1",
      original: "保留原场景",
      current: "保留原场景",
      changed: false,
    },
    {
      id: "stadium",
      group: "场景",
      title: "场景 2",
      preview: "preview-scene-2",
      original: "保留原场景",
      current: "保留原场景",
      changed: false,
    },
    {
      id: "scene3",
      group: "场景",
      title: "场景 3",
      preview: "preview-scene-3",
      original: "保留原场景",
      current: "保留原场景",
      changed: false,
    },
    {
      id: "football",
      group: "元素",
      title: "足球",
      preview: "preview-element-football",
      original: "保留原元素",
      current: "保留原元素",
      changed: false,
    },
    {
      id: "goal",
      group: "元素",
      title: "球门",
      preview: "preview-element-goal",
      original: "保留原元素",
      current: "保留原元素",
      changed: false,
    },
    {
      id: "jersey",
      group: "元素",
      title: "球衣",
      preview: "preview-element-jersey",
      original: "保留原元素",
      current: "保留原元素",
      changed: false,
    },
    {
      id: "caption",
      group: "字幕 / 文案",
      title: "字幕内容",
      preview: "preview-copy-caption",
      original: "保留原文案",
      current: "保留原文案",
      changed: false,
    },
    {
      id: "flag",
      group: "元素",
      title: "旗帜",
      preview: "preview-element-flag",
      original: "保留原元素",
      current: "保留原元素",
      changed: false,
    },
    {
      id: "trophy",
      group: "元素",
      title: "奖杯",
      preview: "preview-element-trophy",
      original: "保留原元素",
      current: "保留原元素",
      changed: false,
    },
    {
      id: "scoreboard",
      group: "元素",
      title: "记分牌",
      preview: "preview-element-scoreboard",
      original: "保留原元素",
      current: "保留原元素",
      changed: false,
    },
    {
      id: "microphone",
      group: "元素",
      title: "麦克风",
      preview: "preview-element-microphone",
      original: "保留原元素",
      current: "保留原元素",
      changed: false,
    },
    {
      id: "banner",
      group: "元素",
      title: "横幅",
      preview: "preview-element-banner",
      original: "保留原元素",
      current: "保留原元素",
      changed: false,
    },
    {
      id: "fanSign",
      group: "元素",
      title: "观众牌",
      preview: "preview-element-fansign",
      original: "保留原元素",
      current: "保留原元素",
      changed: false,
    },
    {
      id: "introCopy",
      group: "字幕 / 文案",
      title: "片头文案",
      preview: "preview-copy-intro",
      original: "保留原文案",
      current: "保留原文案",
      changed: false,
    },
    {
      id: "outroCopy",
      group: "字幕 / 文案",
      title: "结尾文案",
      preview: "preview-copy-outro",
      original: "保留原文案",
      current: "保留原文案",
      changed: false,
    },
    {
      id: "worldcupTheme",
      group: "音乐音效",
      title: "2026世界杯主题曲.mp4",
      preview: "preview-audio-theme",
      original: "保留原音效",
      current: "保留原音效",
      changed: false,
    },
    {
      id: "crowdCheer",
      group: "音乐音效",
      title: "现场欢呼声.mp4",
      preview: "preview-audio-cheer",
      original: "保留原音效",
      current: "保留原音效",
      changed: false,
    },
    {
      id: "goalSound",
      group: "音乐音效",
      title: "进球音效.mp4",
      preview: "preview-audio-goal",
      original: "保留原音效",
      current: "保留原音效",
      changed: false,
    },
  ],
  subtitleLines: [
    { time: "00:00 - 00:03", text: "欢迎来到我的高光时刻", original: "欢迎来到我的高光时刻" },
    { time: "00:03 - 00:07", text: "这一刻，全场沸腾", original: "这一刻，全场沸腾" },
    { time: "00:07 - 00:12", text: "属于我的主场来了", original: "属于我的主场来了" },
    { time: "00:12 - 00:18", text: "下一站继续出发", original: "下一站继续出发" },
  ],
  copyDrafts: {
    introCopy: "我的高光时刻",
    outroCopy: "下一站继续出发",
  },
};

const inspirationItems = [
  {
    title: "41岁的C罗连进2个球",
    coverUrl: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=720&q=80",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-pair-of-soccer-court-in-a-view-from-above-41371-large.mp4",
    duration: "00:18",
    ratio: "9:16",
    size: "48.6MB",
  },
  {
    title: "我的高考出分时刻",
    coverUrl: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=720&q=80",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-students-talking-on-a-video-call-6529-large.mp4",
    duration: "00:16",
    ratio: "9:16",
    size: "42.8MB",
  },
  {
    title: "我把旅行做成票根",
    coverUrl: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=720&q=80",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-concept-video-of-travel-items-36824-large.mp4",
    duration: "00:20",
    ratio: "9:16",
    size: "51.2MB",
  },
  {
    title: "内马尔首秀",
    coverUrl: "https://images.unsplash.com/photo-1518091043644-c1d4457512c6?auto=format&fit=crop&w=720&q=80",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-three-football-players-training-at-night-42559-large.mp4",
    duration: "00:15",
    ratio: "9:16",
    size: "39.4MB",
  },
  {
    title: "爱的主打歌",
    coverUrl: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=720&q=80",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-crowd-clapping-in-in-a-music-concert-14107-large.mp4",
    duration: "00:18",
    ratio: "9:16",
    size: "44.1MB",
  },
  {
    title: "跨次元的宿命感",
    coverUrl: "https://images.unsplash.com/photo-1535223289827-42f1e9919769?auto=format&fit=crop&w=720&q=80",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-neon-cyberpunk-triangle-tunnel-18003-large.mp4",
    duration: "00:22",
    ratio: "9:16",
    size: "56.7MB",
  },
];

const customPreviewImages = {
  hero1: "https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=520&q=80",
  hero2: "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=520&q=80",
  hero3: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=520&q=80",
  scene: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=720&q=80",
  stadium: "https://images.unsplash.com/photo-1518091043644-c1d4457512c6?auto=format&fit=crop&w=720&q=80",
  scene3: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=720&q=80",
  football: "https://images.unsplash.com/photo-1575361204480-aadea25e6e68?auto=format&fit=crop&w=420&q=80",
  goal: "https://images.unsplash.com/photo-1553778263-73a83bab9b0c?auto=format&fit=crop&w=420&q=80",
  jersey: "https://images.unsplash.com/photo-1523398002811-999ca8dec234?auto=format&fit=crop&w=420&q=80",
  flag: "https://images.unsplash.com/photo-1508344928928-7165b67de128?auto=format&fit=crop&w=420&q=80",
  trophy: "https://images.unsplash.com/photo-1567427017947-545c5f8d16ad?auto=format&fit=crop&w=420&q=80",
  scoreboard: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=420&q=80",
  microphone: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=420&q=80",
  banner: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=420&q=80",
  fanSign: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=420&q=80",
  caption: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=520&q=80",
  introCopy: "https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=520&q=80",
  outroCopy: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=520&q=80",
};

const originalCustomPreviewImages = { ...customPreviewImages };

const libraryAssets = {
  hero1: ["商务头像.png", "运动员半身照.jpg", "生活感人物.png"],
  hero2: ["双人合影.png", "侧脸人物.jpg", "赛场人物.png"],
  hero3: ["生活感主体.png", "运动人物.jpg", "半身主体.png"],
  scene: ["日式餐厅", "夜间球场", "城市街角"],
  stadium: ["球场全景.png", "演唱会现场.jpg", "城市广场.png"],
  scene3: ["球员通道.png", "领奖台.jpg", "看台入口.png"],
  football: ["football.png", "复古足球.jpg", "金色足球.png"],
  goal: ["goal.png", "白色球门.jpg", "球网素材.png"],
  jersey: ["红色球衣.png", "白色外套.jpg", "品牌服装.png"],
  flag: ["冠军旗帜.png", "队旗素材.jpg", "飘带装饰.png"],
  trophy: ["trophy.png", "金色奖杯.jpg", "冠军杯.png"],
  scoreboard: ["scoreboard.png", "电子记分牌.jpg", "赛事比分板.png"],
  microphone: ["microphone.png", "采访话筒.jpg", "手持麦克风.png"],
  banner: ["banner.png", "赛事横幅.jpg", "品牌横幅.png"],
  fanSign: ["fansign.png", "观众手牌.jpg", "应援牌.png"],
  caption: ["醒目字幕风格", "极简字幕风格", "发布感文案"],
  introCopy: ["开场金句.txt", "赛事开场文案.txt", "情绪铺垫文案.txt"],
  outroCopy: ["结尾号召.txt", "反转收尾文案.txt", "留白收束文案.txt"],
  worldcupTheme: ["theme-song.mp3", "世界杯主题曲.wav", "热血BGM.mp3"],
  crowdCheer: ["crowd-cheer.mp3", "现场欢呼声.wav", "球迷声浪.mp3"],
  goalSound: ["goal-sound.mp3", "进球哨声.wav", "高燃音效.mp3"],
};

const assetLibraryGroups = {
  主体: [
    { name: "人物素材 1", type: "图片", previewUrl: "https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=420&q=82" },
    { name: "人物素材 2", type: "图片", previewUrl: "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=420&q=82" },
    { name: "人物素材 3", type: "图片", previewUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=420&q=82" },
  ],
  场景: [
    { name: "球场入口", type: "图片", previewUrl: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=520&q=82" },
    { name: "球场中央", type: "图片", previewUrl: "https://images.unsplash.com/photo-1518091043644-c1d4457512c6?auto=format&fit=crop&w=520&q=82" },
    { name: "更衣室", type: "图片", previewUrl: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=520&q=82" },
  ],
  元素: [
    { name: "足球素材", type: "图片", previewUrl: "https://images.unsplash.com/photo-1575361204480-aadea25e6e68?auto=format&fit=crop&w=420&q=82" },
    { name: "球门素材", type: "图片", previewUrl: "https://images.unsplash.com/photo-1553778263-73a83bab9b0c?auto=format&fit=crop&w=420&q=82" },
    { name: "球衣素材", type: "图片", previewUrl: "https://images.unsplash.com/photo-1523398002811-999ca8dec234?auto=format&fit=crop&w=420&q=82" },
    { name: "旗帜素材", type: "图片", previewUrl: "https://images.unsplash.com/photo-1508344928928-7165b67de128?auto=format&fit=crop&w=420&q=82" },
    { name: "奖杯素材", type: "图片", previewUrl: "https://images.unsplash.com/photo-1567427017947-545c5f8d16ad?auto=format&fit=crop&w=420&q=82" },
  ],
  音乐音效: [
    { name: "2026世界杯主题曲.mp4", type: "音频", previewUrl: null },
    { name: "现场欢呼声.mp4", type: "音频", previewUrl: null },
    { name: "进球音效.mp4", type: "音频", previewUrl: null },
  ],
};

const resultParamConfig = {
  ratio: {
  label: "比例",
  modalTitle: "调整生成比例",
  currentLabel: "当前比例",
  options: ["1:1", "3:4", "4:3", "9:16", "16:9", "自由尺寸"],
  optionLabels: {
    "1:1": "方形",
    "3:4": "竖版封面",
    "4:3": "横版经典",
    "9:16": "竖屏短视频",
    "16:9": "横屏视频",
    "自由尺寸": "自定义宽高"
  },
  note: "基于当前版本重新生成一个新比例视频，原版本会保留。",
},
  quality: {
    label: "清晰度",
    currentLabel: "当前清晰度",
    options: ["720P", "1080P"],
  },
  duration: {
    label: "时间",
    modalTitle: "调整视频时长",
    currentLabel: "当前时长",
    options: ["10s", "15s", "18s"],
    note: "时长会影响下一次生成节奏，不会直接修改当前视频。",
  },
};
const resultParamDefaults = {
  ratio: "9:16",
  quality: "720P",
  duration: "18s",
  timeStart: 0,
};
const resultCoverUrls = [
  "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=720&q=82",
  "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=720&q=82",
  "https://images.unsplash.com/photo-1518091043644-c1d4457512c6?auto=format&fit=crop&w=720&q=82",
  "https://images.unsplash.com/photo-1521412644187-c49fa049e84d?auto=format&fit=crop&w=720&q=82",
  "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=720&q=82",
];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function addAgentMessage(text) {
  const wrap = $("#agentMessages");
  const node = document.createElement("div");
  node.className = "agent-message";
  node.textContent = text;
  wrap.appendChild(node);
  wrap.scrollTop = wrap.scrollHeight;
  $(".agent-home")?.classList.add("compact");
}

function showActionFeedback(message) {
  $("#actionFeedbackToast")?.remove();
  if (message) console.info("[action feedback suppressed]", message);
}

function showResultNotice(message) {
  const notice = $("#resultNoticeText");
  if (!notice) return;
  notice.textContent = message;
  openModal("resultNoticeModal");
}

function addAgentBreakdownMessage() {
  const wrap = $("#agentMessages");
  const node = document.createElement("div");
  node.className = "agent-message agent-action-message";
  node.innerHTML = `
    <span>已完成后台拆解。我已经把这个视频按镜头拆开，并识别出了可替换的主体、场景和元素。</span>
    <button class="agent-pill-button" data-open-breakdown="true">查看视频拆解</button>
  `;
  wrap.appendChild(node);
  wrap.scrollTop = wrap.scrollHeight;
}

function disableAgentGenerateCards() {
  $$(".agent-generate-card.is-active").forEach((card) => {
    card.classList.remove("is-active");
    card.querySelectorAll("button").forEach((button) => {
      button.disabled = true;
    });
  });
}

function getGenerateConfirmMarkup() {
  return "";
}

function addAgentGenerateConfirmMessage() {
  const wrap = $("#agentMessages");
  disableAgentGenerateCards();
  const node = document.createElement("div");
  node.className = "agent-message agent-generate-card is-active";
  node.innerHTML = getGenerateConfirmMarkup();
  wrap.appendChild(node);
  wrap.scrollTop = wrap.scrollHeight;
}

function showPage(page) {
  state.page = page;
  $("#homePage").classList.toggle("hidden", page !== "home");
  $("#labShell").classList.toggle("hidden", page !== "lab");
  $("#labPage").classList.toggle("hidden", page !== "lab");
  if (page === "lab" && !$("#agentMessages").children.length) {
    addAgentMessage("上传你想复刻的视频，或从下方热门视频里选一个参考。");
  }
}

function renderInspirations() {
  $("#inspirationGrid").innerHTML = inspirationItems
    .map(
      (item, index) => `
        <article class="inspiration-card" data-index="${index}" tabindex="0">
          <div class="inspiration-cover">
            <img src="${item.coverUrl}" alt="${item.title}" loading="lazy" onerror="this.closest('.inspiration-card').classList.add('cover-failed')" />
            <video src="${item.videoUrl}" poster="${item.coverUrl}" muted loop playsinline preload="metadata"></video>
            <span class="play-dot">▶</span>
          </div>
          <div class="inspiration-meta">
            <strong>${item.title}</strong>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderResultParams() {
  const meta = $("#resultMeta");
  if (!meta) return;
  meta.innerHTML = Object.entries(resultParamConfig)
    .map(([key, config]) => {
      const isChanged = isParamChanged(key, state.resultParams, resultParamDefaults);
      const isQualityOpen = key === "quality" && state.openQualityParam === "root:quality";
      return `
        <div class="result-param-wrap">
          <button class="result-param-pill ${isChanged ? "is-changed" : ""}" data-result-param="${key}" type="button">
            <span>${config.label}：</span><strong>${state.resultParams[key]}</strong><span class="result-param-caret">⌄</span>
          </button>
          ${isQualityOpen ? renderQualityMenu(state.resultParams.quality) : ""}
        </div>
      `;
    })
    .join("");
}

function getResultParamOptionLabel(key, value) {
  return resultParamConfig[key]?.optionLabels?.[value] || value;
}

function isParamChanged(key, params = state.resultParams, baseParams = resultParamDefaults) {
  if (key === "duration") {
    return params.duration !== (baseParams.duration || resultParamDefaults.duration) || Number(params.timeStart || 0) !== Number(baseParams.timeStart || 0);
  }
  return params[key] !== (baseParams[key] || resultParamDefaults[key]);
}

function formatDurationValue(params = state.resultParams) {
  const duration = params.duration || resultParamDefaults.duration;
  const start = Number(params.timeStart || 0);
  const seconds = parseDurationSeconds(duration);
  if (duration === "18s" && start === 0) return "18s";
  return `${duration}，截取 ${start}s - ${start + seconds}s`;
}

function getParamSummaryValue(key, params = state.resultParams) {
  if (key === "duration") return formatDurationValue(params);
  return params[key];
}

function renderQualityMenu(currentValue) {
  return `
    <div class="result-param-menu">
      ${resultParamConfig.quality.options
        .map(
          (option) => `
            <button class="${currentValue === option ? "active" : ""}" data-quality-param-choice="true" data-value="${option}" type="button">${option}</button>
          `,
        )
        .join("")}
    </div>
  `;
}

function getResultParamsForVersion(versionId) {
  const version = state.versions.find((entry) => entry.id === versionId);
  return {
    ...resultParamDefaults,
    ...(version?.params || state.resultParams),
    ...(version?.pendingParams || {}),
  };
}

function getNextParamsFromVersion(version) {
  return {
    ...resultParamDefaults,
    ...(version?.params || {}),
    ...(version?.pendingParams || {}),
  };
}

function getResultParamChanges(version) {
  if (!version) return [];
  const params = getNextParamsFromVersion(version);
  const base = { ...resultParamDefaults, ...(version.params || {}) };
  return Object.entries(resultParamConfig)
    .filter(([key]) => isParamChanged(key, params, base))
    .map(([key, config]) => ({
      title: config.label,
      value: getParamSummaryValue(key, params),
    }));
}

function renderResultParamControls(versionId) {
  const version = state.versions.find((entry) => entry.id === versionId);
  const params = version ? getResultParamsForVersion(versionId) : state.resultParams;
  const baseParams = { ...resultParamDefaults, ...(version?.params || {}) };
  return Object.entries(resultParamConfig)
    .map(([key, config]) => {
      const isChanged = isParamChanged(key, params, baseParams);
      const menuId = `${versionId || "root"}:quality`;
      const isQualityOpen = key === "quality" && state.openQualityParam === menuId;
      return `
        <div class="result-param-wrap">
          <button class="result-param-pill ${isChanged ? "is-changed" : ""}" data-result-param="${key}" data-version="${versionId}" type="button">
            <span>${config.label}：</span><strong>${params[key]}</strong><span class="result-param-caret">⌄</span>
          </button>
          ${isQualityOpen ? renderQualityMenu(params.quality) : ""}
        </div>
      `;
    })
    .join("");
}

function getParamSettingsMarkup(params = state.resultParams) {
  return `
    <div>
      <dt>生成参数</dt>
      <dd class="confirm-param-line">
        <span>比例：${params.ratio}</span>
        <span>清晰度：${params.quality}</span>
        <span>时间：${formatDurationValue(params)}</span>
      </dd>
    </div>
  `;
}

function openResultParamModal(key, versionId = null) {
  const config = resultParamConfig[key];
  if (!config) return;
  if (key === "quality") return;
  const version = versionId ? state.versions.find((entry) => entry.id === versionId) : null;
  const params = version ? getResultParamsForVersion(versionId) : state.resultParams;
  state.activeResultParamKey = key;
  state.activeResultParamVersionId = version?.id || null;
  state.activeResultParamDraft = params[key];
  state.activeResultTimeStart = Number(params.timeStart || 0);
  renderResultParamModal();
  openModal("paramModal");
}

function getParamModalNote(key) {
  if (key === "ratio") {
    return "基于当前版本重新生成一个新比例视频，原版本会保留。";
  }

  if (resultParamConfig[key]?.note) return resultParamConfig[key].note;
  return "该设置会影响下一次生成结果，不会直接修改当前视频。";
}

function renderRatioPreview(value) {
const className = {
  "1:1": "is-square",
  "3:4": "is-three-four",
  "4:3": "is-four-three",
  "9:16": "is-vertical",
  "16:9": "is-wide",
  "自由尺寸": "is-free"
}[value] || "is-vertical";
  const cover = state.selectedInspiration?.coverUrl || state.currentVersion?.coverUrl || resultCoverUrls[0];
  return `
    <div class="param-ratio-preview">
      <div class="param-video-crop">
        <img src="${cover}" alt="比例裁剪预览" />
        <span class="param-crop-frame ${className}"></span>
        <span class="param-safe-frame ${className}"></span>
      </div>
      <small>预览当前视频在新比例下的大致构图。</small>
    </div>
  `;
}

function parseDurationSeconds(value) {
  return Number(String(value || "18s").replace("s", "")) || 18;
}

function clampTimeStart(duration, start) {
  const seconds = parseDurationSeconds(duration);
  const maxStart = Math.max(18 - seconds, 0);
  return Math.min(Math.max(Number(start || 0), 0), maxStart);
}

function renderDurationPreview(value, startValue = 0) {
  const seconds = parseDurationSeconds(value);
  const start = clampTimeStart(value, startValue);
  const end = start + seconds;
  const maxStart = Math.max(18 - seconds, 0);
  const left = (start / 18) * 100;
  const width = (seconds / 18) * 100;
  const presets = seconds === 10 ? [0, 4, 8] : seconds === 15 ? [0, 3] : [0];
  return `
    <div class="param-time-preview">
      <div class="param-time-total">原视频总时长：18s</div>
      <div class="param-time-track">
        <span class="param-time-window" style="left:${left}%; width:${width}%"></span>
        <em>0s</em>
        <em>18s</em>
      </div>
      <strong class="param-time-range">截取 ${start}s - ${end}s</strong>
      ${
        maxStart > 0
          ? `<input class="param-time-slider" data-action="param-time-start" type="range" min="0" max="${maxStart}" value="${start}" step="1" aria-label="调整截取开始时间" />`
          : `<div class="param-time-full">默认保留完整时长</div>`
      }
      <div class="param-time-presets">
        ${presets
          .map(
            (preset) => `
              <button class="${start === preset ? "active" : ""}" data-action="param-time-preset" data-start="${preset}" type="button">
                ${preset}s - ${preset + seconds}s
              </button>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderResultParamModal() {
  const key = state.activeResultParamKey;
  const config = resultParamConfig[key];
  if (!config) return;
  const version = state.activeResultParamVersionId ? state.versions.find((entry) => entry.id === state.activeResultParamVersionId) : null;
  const params = version ? getResultParamsForVersion(version.id) : state.resultParams;
  const currentValue = key === "duration" ? formatDurationValue(version?.params || params) : version?.params?.[key] || params[key];
  const draftValue = state.activeResultParamDraft || params[key];
  state.activeResultTimeStart = key === "duration" ? clampTimeStart(draftValue, state.activeResultTimeStart) : state.activeResultTimeStart;
  $("#paramModalTitle").textContent = config.modalTitle;
  $("#paramModalCurrent").textContent = `${config.currentLabel}：${currentValue}`;
  $("#paramModalNote").textContent = getParamModalNote(key);
  $("#paramModalPreview").innerHTML = key === "ratio" ? renderRatioPreview(draftValue) : key === "duration" ? renderDurationPreview(draftValue, state.activeResultTimeStart) : "";
  $("#paramModalOptions").innerHTML = config.options
  .map((option) => {
    const optionDesc = config.optionLabels?.[option] || "";
    return `
      <button class="param-option-card ${draftValue === option ? "active" : ""}" data-action="param-select" data-value="${option}" type="button">
        <strong>${getResultParamOptionLabel(key, option)}</strong>
        ${optionDesc ? `<span>${optionDesc}</span>` : ""}
      </button>
    `;
  })
  .join("");
}

function closeResultParamModal() {
  state.activeResultParamKey = null;
  state.activeResultParamVersionId = null;
  state.activeResultParamDraft = null;
  state.activeResultTimeStart = 0;
  closeModal("paramModal");
}

function applyResultParamValue(key, value, versionId = null, extras = {}) {
  const version = versionId ? state.versions.find((entry) => entry.id === versionId) : null;
  if (version) {
    version.pendingParams = {
      ...resultParamDefaults,
      ...(version.params || {}),
      ...(version.pendingParams || {}),
      [key]: value,
      ...extras,
    };
  } else {
    state.resultParams = {
      ...state.resultParams,
      [key]: value,
      ...extras,
    };
  }
  renderResultParams();
  renderChangeList();
  renderResultCards($("#resultPanel .result-card.is-generating") !== null);
  queueConnectorUpdateAfterLayout();
}

function saveResultParamModal() {
  const key = state.activeResultParamKey;
  const value = state.activeResultParamDraft;
  const config = resultParamConfig[key];
  if (!config || !value) return;
  const extras = key === "duration" ? { timeStart: clampTimeStart(value, state.activeResultTimeStart) } : {};
  applyResultParamValue(key, value, state.activeResultParamVersionId, extras);
  closeResultParamModal();
}

function getNodeStyle(key) {
  const offset = state.nodeOffsets[key];
  return offset ? `style="transform: translate(${offset.x}px, ${offset.y}px)"` : "";
}

function getResultCover(version, index) {
  if (version.isGenerating) return resultCoverUrls[index % resultCoverUrls.length];
  const number = Number(String(version.id).replace(/\D/g, "")) || index + 1;
  return resultCoverUrls[(number - 1) % resultCoverUrls.length];
}

function renderCopyEditor(item) {
  return "";
}

function getCopyDefaultValue(id) {
  if (id === "introCopy") return state.copyDrafts.introCopy;
  if (id === "outroCopy") return state.copyDrafts.outroCopy;
  return "";
}

function renderCopyModalContent(item, useOriginal = false) {
  $("#copyModalTitle").textContent = `编辑${item.title}`;
  if (item.id === "caption") {
    $("#copyModalSubtitle").textContent = "逐条修改视频中的字幕内容，时间段保持不变。";
    const lines = state.subtitleLines.map((line) => ({ ...line, text: useOriginal ? line.original : line.text }));
    $("#subtitleEditorList").innerHTML = lines
      .map(
        (line, index) => `
          <label class="subtitle-modal-row">
            <span>${line.time}</span>
            <input data-subtitle-modal-index="${index}" value="${escapeHtml(line.text)}" />
          </label>
        `,
      )
      .join("");
    return;
  }

  $("#copyModalSubtitle").textContent = "修改当前文案内容，保存后会同步到本次修改。";
  const defaultValue = getCopyDefaultValue(item.id);
  const value = useOriginal ? defaultValue : item.changed ? item.current : defaultValue;
  $("#subtitleEditorList").innerHTML = `
    <label class="copy-modal-textarea">
      <span>${item.title}</span>
      <textarea data-copy-modal-input="${item.id}">${escapeHtml(value)}</textarea>
    </label>
  `;
}

function openCopyEditor(id) {
  const branch = state.activeCopyBranchId ? state.branchConfigs.find((entry) => entry.id === state.activeCopyBranchId) : null;
  const item = branch ? branch.items.find((entry) => entry.id === id) : state.customItems.find((entry) => entry.id === id);
  if (!item) return;
  state.activeCopyModalId = id;
  renderCopyModalContent(item);
  openModal("subtitleModal");
}

function openBranchCopyEditor(branchId, itemId) {
  state.activeCopyBranchId = branchId;
  openCopyEditor(itemId);
}

function renderCustomItems() {
  const groups = ["主体", "场景", "元素", "字幕 / 文案"];
  $("#customItems").innerHTML = groups
    .map((group) => {
      const groupClass = {
        主体: "subject",
        场景: "scene",
        元素: "element",
        音乐音效: "audio",
        "字幕 / 文案": "copy",
      }[group];
        let cards = state.customItems
        .filter((item) => item.group === group)
        .map((item) => {
          const isChanged = item.changed;
          const isOpen = state.openPickerId === item.id;
          const primaryAction = isChanged ? (group === "字幕 / 文案" ? "更改" : "更换") : group === "字幕 / 文案" ? "修改" : "替换";
          const restoreLabel = group === "元素" ? "恢复" : "恢复原始";
          const menuLabels =
            group === "音乐音效"
              ? ["上传音乐", "资产库"]
              : group === "字幕 / 文案"
                ? []
                : ["上传新素材", "资产库"];
          const cardClass = `custom-item custom-item-${groupClass}${state.activeItemId === item.id && !state.activeBranchId ? " is-selected-item" : ""}`;
          const shouldShowPreview = group !== "音乐音效";
          const isEditingCopy = state.activeTextEditorId === item.id;
          const isPlaying = state.playingAudioId === item.id;
          return `
            <article class="${cardClass}">
              ${
                shouldShowPreview
                  ? `<div class="item-preview ${item.preview}">
                      ${
  (item.previewUrl || state.uploadedVideoCoverUrl)
  ? `<img src="${item.previewUrl || state.uploadedVideoCoverUrl}" alt="${escapeHtml(item.title)}" loading="lazy" />`
  : `<div class="preview-placeholder">视频帧占位</div>`
}
                      <span>${group === "主体" ? "视频截取" : group === "字幕 / 文案" ? "文案预览" : "识别预览"}</span>
                    </div>`
                  : `<div class="audio-glyph" aria-hidden="true"></div>`
              }
              <header>
                <strong>${item.title}</strong>
                ${isChanged ? `<span class="changed-mark">${group === "字幕 / 文案" ? "已修改" : "已替换"}</span>` : ""}
              </header>
              <p>当前：${isChanged ? (group === "字幕 / 文案" ? "已修改" : `已替换为 ${item.current}`) : item.current}</p>
              <div class="item-actions">
                ${
                  group === "音乐音效"
                    ? `<button class="audio-preview-button ${isPlaying ? "is-playing" : ""}" data-action="audio-preview" data-id="${item.id}">${isPlaying ? "播放中" : "试听"}</button>`
                    : ""
                }
                <button data-action="replace" data-id="${item.id}">${primaryAction}</button>
                <button class="restore-button" data-action="restore" data-id="${item.id}" title="恢复原始">${restoreLabel}</button>
              </div>
              ${
                isOpen && group !== "字幕 / 文案"
                  ? `<div class="inline-picker">
                      ${menuLabels
                        .map(
                          (label) => `
                            <button data-action="quick-asset" data-source="${label}" data-id="${item.id}">
                              <span>${label}</span><span>›</span>
                            </button>
                          `,
                        )
                        .join("")}
                    </div>`
                  : ""
              }
              ${isEditingCopy && group === "字幕 / 文案" ? renderCopyEditor(item) : ""}
            </article>
          `;
        })
        .join("");

if (group === "字幕 / 文案" && !cards) {
  cards = `
    <div class="empty-copy-message">
      本视频未识别到任何文字。
    </div>
  `;
}
      return `
        <section class="custom-group custom-group-${groupClass}">
          <h3>${group}</h3>
          <div class="custom-group-grid">${cards}</div>
        </section>
      `;
    })
    .join("");
function ensureCustomAdjustmentBox() {
  const changeList = $("#changeList");
  if (!changeList || $("#customGeneratePanel")) return;

  const panel = document.createElement("div");
  panel.id = "customGeneratePanel";
  panel.className = "custom-generate-panel";

  panel.innerHTML = `
    <div class="custom-generate-summary">
      <strong>补充生成要求</strong>
      <p>这些要求会和上方替换素材一起用于生成新版本，也可以留空。</p>
      <textarea
        id="customAdjustmentInput"
        placeholder="例如：画面更明亮，动作更慢，镜头更稳定，保留夜晚氛围。"
      ></textarea>
    </div>

    <div class="custom-generate-footer">
      <span class="branch-cost-pill">预计消耗：￥15.2</span>
      <button id="customDirectGenerateBtn" class="primary-button branch-generate" type="button">
        生成视频
      </button>
    </div>
  `;

  const container = changeList.closest(".branch-change") || changeList.parentElement;

  // 关键：放进“本次修改”这个大框里面，而不是插到它后面
  container.appendChild(panel);

  $("#generateHint")?.classList.add("hidden");
  $("#generateAction")?.classList.add("hidden");

  const directButton = panel.querySelector("#customDirectGenerateBtn");
if (directButton) {
  directButton.disabled = false;
  directButton.textContent = state.versions?.length ? "生成新版本" : "生成视频";
}
  if (directButton && !directButton.dataset.bound) {
    directButton.dataset.bound = "true";

    directButton.addEventListener("click", (event) => {
      event.preventDefault();

      const card =
        document.querySelector("#replaceRail") ||
        document.querySelector("#customItems")?.closest("section") ||
        document.body;

      handleGenerateAction(directButton, card);
    });
  }
}
    renderChangeList();
}

function getChangeLines() {
  return getChangeSummaryItems().map((item) => `${item.title}：${item.value}`);
}

function getChangedItems() {
  return state.customItems.filter((item) => item.changed);
}

function getParamChangeSummaryItems(params = state.resultParams, baseParams = resultParamDefaults) {
  return Object.entries(resultParamConfig)
    .filter(([key]) => isParamChanged(key, params, baseParams))
    .map(([key, config]) => ({
      title: config.label,
      value: getParamSummaryValue(key, params),
      isParam: true,
    }));
}

function getChangeSummaryItems() {
  return [
    ...getChangedItems().map((item) => ({
      title: item.title,
      value: item.group === "字幕 / 文案" ? "已修改" : item.current,
      isCopy: item.group === "字幕 / 文案",
    })),
    ...getParamChangeSummaryItems(),
  ];
}
function ensureCustomAdjustmentBox() {
  const changeList = $("#changeList");
  if (!changeList || $("#customGeneratePanel")) return;

  const panel = document.createElement("div");
  panel.id = "customGeneratePanel";
  panel.className = "custom-generate-panel";

  panel.innerHTML = `
    <div class="custom-generate-summary">
      <strong>补充生成要求</strong>
      <p>这些要求会和上方替换素材一起用于生成新版本，也可以留空。</p>
      <textarea
        id="customAdjustmentInput"
        placeholder="例如：画面更明亮，动作更慢，镜头更稳定，保留夜晚氛围。"
      ></textarea>
    </div>

    <div class="custom-generate-footer">
      <span class="branch-cost-pill">预计消耗：￥15.2</span>
      <button id="customDirectGenerateBtn" class="primary-button branch-generate" type="button">
        生成视频
      </button>
    </div>
  `;

  const container = changeList.closest(".branch-change") || changeList.parentElement;
  container.insertAdjacentElement("afterend", panel);

  $("#generateHint")?.classList.add("hidden");
  $("#generateAction")?.classList.add("hidden");

  const directButton = panel.querySelector("#customDirectGenerateBtn");

  directButton.addEventListener("click", (event) => {
    event.preventDefault();

    const card =
      document.querySelector("#replaceRail") ||
      document.querySelector("#customItems")?.closest("section") ||
      document.body;

    handleGenerateAction(directButton, card);
  });
}
function renderChangeList() {
  ensureCustomAdjustmentBox();

  const changed = getChangeSummaryItems();
  if (!changed.length) {
    const emptyText = state.revisingConfig ? "还没有替换素材，也可以直接填写补充生成要求" : "还没有替换内容";
    $("#changeList").innerHTML = `<li class="change-empty">${emptyText}</li>`;
    $("#canvasGenerateConfirm")?.classList.add("hidden");
    $(".change-list")?.classList.remove("is-confirming");
    return;
  }
  $("#generateHint")?.classList.add("hidden");

  const tags = changed
    .map((item) => {
      return `
        <li class="change-tag">
          <strong class="change-object">${item.title}</strong>
          <span class="change-arrow">→</span>
          <span class="change-value">${item.value}</span>
        </li>
      `;
    })
    .join("");
  $("#changeList").innerHTML = tags;
}

function showReviseNotice() {
  state.revisingConfig = true;
  const notice = $("#reviseNotice");
  notice.classList.remove("hidden", "is-muted");
  notice.classList.add("is-spotlight");
  $("#replaceRail").classList.add("is-revising");
  window.clearTimeout(state.reviseNoticeTimer);
  state.reviseNoticeTimer = window.setTimeout(() => {
    notice.classList.add("is-muted");
    notice.classList.remove("is-spotlight");
    $("#replaceRail").classList.remove("is-revising");
  }, 1500);
}

function softenReviseNotice() {
  if (!state.revisingConfig) return;
  $("#reviseNotice")?.classList.add("is-muted");
  $("#replaceRail")?.classList.remove("is-revising");
}

function resetCustomItems(fromVersion) {
  state.customItems.forEach((item) => {
    const saved = fromVersion?.items?.find((entry) => entry.id === item.id);
    item.current = saved?.current || item.original;
    item.changed = Boolean(saved?.changed);
    item.preview = saved?.preview || item.preview;
  });
}

function resetRootCustomizationToOriginal() {
  state.customItems.forEach((item) => {
    item.current = item.original;
    item.changed = false;
  });
  Object.keys(originalCustomPreviewImages).forEach((key) => {
    customPreviewImages[key] = originalCustomPreviewImages[key];
  });
  state.subtitleLines = state.subtitleLines.map((line) => ({ ...line, text: line.original }));
  state.openPickerId = null;
  state.activeItemId = null;
  state.activeBranchId = null;
  state.activeTextEditorId = null;
  state.activeCopyBranchId = null;
  state.activeCopyModalId = null;
  state.activeAudioLinkId = null;
  state.pendingUploadChoice = null;
  state.resultPromptDirty = false;
  $("#canvasGenerateConfirm")?.classList.add("hidden");
  $(".change-list")?.classList.remove("is-confirming");
  $("#generateHint")?.classList.add("hidden");
}

function showSelectedSource(title, statusText, meta = {}) {
  $("#uploadEmpty").classList.add("hidden");
  $("#uploadedVideoNode").classList.remove("hidden");
  $("#uploadedVideoName").textContent = title;
  $("#uploadedVideoMeta").textContent = `${meta.duration || "00:18"} · ${meta.ratio || "9:16"} · ${meta.size || "48.6MB"}`;
  const cover = $("#uploadedVideoCover");
  if (cover) {
    cover.src = meta.coverUrl || "https://images.unsplash.com/photo-1518091043644-c1d4457512c6?auto=format&fit=crop&w=720&q=80";
    cover.alt = title;
  }
  $("#sourceStatus").textContent = statusText;
}

function normalizeEdgeKey(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function getConfigEdgeKey(sourceNodeId) {
  if (sourceNodeId === "replaceRail") return "config01";
  if (sourceNodeId?.startsWith("branch-")) {
    const configId = sourceNodeId.replace(/^branch-/, "");
    const config = state.branchConfigs.find((entry) => entry.id === configId);
    const match = String(config?.title || "").match(/(\d+)$/);
    return match ? `config${match[1]}` : normalizeEdgeKey(sourceNodeId);
  }
  return normalizeEdgeKey(sourceNodeId);
}

function getDefaultEdgeId(sourceNodeId, targetNodeId) {
  if (sourceNodeId === "uploadNode" && targetNodeId === "replaceRail") return "edge-source-config01";
  const resultMatch = String(targetNodeId || "").match(/^result-(V\d+)$/);
  if (resultMatch) return `edge-${getConfigEdgeKey(sourceNodeId)}-result-${resultMatch[1].toLowerCase()}`;
  const analysisMatch = String(targetNodeId || "").match(/^branch-analysis-from-(V\d+)$/);
  if (analysisMatch) return `edge-${analysisMatch[1].toLowerCase()}-analysis`;
  const branchMatch = String(sourceNodeId || "").match(/^branch-analysis-from-(V\d+)$/);
  if (branchMatch) {
    const targetConfigId = String(targetNodeId || "").replace(/^branch-/, "");
    const config = state.branchConfigs.find((entry) => entry.id === targetConfigId);
    const match = String(config?.title || "").match(/(\d+)$/);
    return `edge-analysis-${branchMatch[1].toLowerCase()}-${match ? `config${match[1]}` : normalizeEdgeKey(targetNodeId)}`;
  }
  return `edge-${normalizeEdgeKey(sourceNodeId)}-${normalizeEdgeKey(targetNodeId)}`;
}

function getFlowNodeIds() {
  return Array.from(document.querySelectorAll("#uploadNode, #replaceRail, #analysisNode, .result-card, .branch-analysis-card, .branch-config-card"))
    .map((node) => node.id)
    .filter(Boolean);
}

function logFlowGraph(reason = "flow") {
  const nodeIds = getFlowNodeIds();
  const edgeRows = state.flowEdges.map((edge) => ({
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
  }));
  const signature = JSON.stringify({ nodeIds, edgeRows });
  if (reason !== "manual" && signature === state.lastFlowGraphSignature) return;
  state.lastFlowGraphSignature = signature;
  console.groupCollapsed(`[flow] ${reason}`);
  console.log("nodes count", nodeIds.length, nodeIds);
  console.log("edges count", state.flowEdges.length, edgeRows);
  edgeRows.forEach((edge) => console.log(`${edge.id}: ${edge.source} -> ${edge.target}`, edge));
  console.groupEnd();
}

window.__flowDebug = () => {
  logFlowGraph("manual");
  return {
    nodes: getFlowNodeIds(),
    edges: state.flowEdges.map((edge) => ({ ...edge })),
  };
};

function addFlowEdge(sourceNodeId, targetNodeId, edgeId = "", options = {}) {
  if (!sourceNodeId || !targetNodeId) {
    console.warn("[flow-edge] skipped edge without sourceNodeId or targetNodeId", { sourceNodeId, targetNodeId });
    return null;
  }
  if (sourceNodeId === targetNodeId) {
    console.warn("[flow-edge] skipped self edge", { sourceNodeId, targetNodeId });
    return null;
  }
  const source = document.getElementById(sourceNodeId);
  const target = document.getElementById(targetNodeId);
  if (!source || !target) {
    console.warn("[flow-edge] skipped edge because source or target node does not exist", {
      sourceNodeId,
      targetNodeId,
      sourceExists: Boolean(source),
      targetExists: Boolean(target),
    });
    return null;
  }
  const id = edgeId || getDefaultEdgeId(sourceNodeId, targetNodeId);
  const existing = state.flowEdges.find((edge) => edge.id === id || (edge.sourceNodeId === sourceNodeId && edge.targetNodeId === targetNodeId));
  if (existing) return existing;
  const edge = {
    id,
    sourceNodeId,
    targetNodeId,
    sourceHandle: "right-center",
    targetHandle: "left-center",
  };
  state.flowEdges.push(edge);
  if (!options.silent) logFlowGraph("add-edge");
  return edge;
}

function createFlowNode({ node, sourceNodeId = "", focus = true, focusDelay = 120, focusOptions = {}, highlightTarget = "" }) {
  const target = getFocusTarget(node);
  const targetNodeId = target?.id || (typeof node === "string" ? node.replace(/^#/, "") : "");
  if (!target || !targetNodeId) {
    console.warn("[flow-node] skipped flow node because target node does not exist", { node, sourceNodeId });
    return null;
  }
  if (sourceNodeId) addFlowEdge(sourceNodeId, targetNodeId);
  queueConnectorUpdateAfterLayout();
  if (focus) {
    focusAndHighlight(target, focusDelay, {
      ...focusOptions,
      highlightTarget: highlightTarget || focusOptions.highlightTarget || target,
    });
  }
  return target;
}

function removeFlowEdgesByTarget(targetNodeId) {
  const originalLength = state.flowEdges.length;
  state.flowEdges = state.flowEdges.filter((edge) => edge.targetNodeId !== targetNodeId);
  if (state.flowEdges.length !== originalLength) logFlowGraph("remove-edge");
}

function getFlowEdgeSpecsFromState() {
  const specs = [];
  if (state.analyzed || state.versions.length || state.branchConfigs.length) {
    specs.push({ sourceNodeId: "uploadNode", targetNodeId: "replaceRail", id: "edge-source-config01" });
  }
  state.versions.forEach((version) => {
    const sourceNodeId = version.branchId ? `branch-${version.branchId}` : "replaceRail";
    specs.push({ sourceNodeId, targetNodeId: `result-${version.id}`, id: getDefaultEdgeId(sourceNodeId, `result-${version.id}`) });
  });
  if (state.generatingTarget) {
    const sourceNodeId = state.generatingTarget.branchId ? `branch-${state.generatingTarget.branchId}` : "replaceRail";
    specs.push({ sourceNodeId, targetNodeId: "result-生成中", id: `edge-${getConfigEdgeKey(sourceNodeId)}-result-generating` });
  }
  state.branchConfigs.forEach((config) => {
    specs.push({
      sourceNodeId: `result-${config.baseVersionId}`,
      targetNodeId: `branch-analysis-${config.id}`,
      id: getDefaultEdgeId(`result-${config.baseVersionId}`, `branch-analysis-${config.id}`),
    });
    if (config.analysisStatus === "done") {
      specs.push({
        sourceNodeId: `branch-analysis-${config.id}`,
        targetNodeId: `branch-${config.id}`,
        id: getDefaultEdgeId(`branch-analysis-${config.id}`, `branch-${config.id}`),
      });
    }
  });
  return specs;
}

function rebuildFlowEdgesFromState() {
  state.flowEdges = [];
  getFlowEdgeSpecsFromState().forEach((edge) => {
    addFlowEdge(edge.sourceNodeId, edge.targetNodeId, edge.id, { silent: true });
  });
  logFlowGraph("sync-edges");
}

function updateResultConnector() {
  const board = $("#flowBoard");
  const svg = $("#resultConnectorSvg");
  const boardRect = board?.getBoundingClientRect();
  if (!board || !svg || !boardRect || !board.getClientRects().length) {
    if (svg) svg.innerHTML = "";
    return;
  }
  rebuildFlowEdgesFromState();

  const isConnectable = (node) => {
    if (!node || !boardRect || !node.getClientRects().length) return false;
    const rect = node.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    return true;
  };
  const edges = state.flowEdges
    .map((edge) => {
      const source = document.getElementById(edge.sourceNodeId);
      const targetNode = document.getElementById(edge.targetNodeId);
      if (!source || !targetNode) {
        console.warn("[flow-edge] missing source or target node", {
          id: edge.id,
          sourceNodeId: edge.sourceNodeId,
          targetNodeId: edge.targetNodeId,
          sourceExists: Boolean(source),
          targetExists: Boolean(targetNode),
        });
        return null;
      }
      if (edge.sourceNodeId === edge.targetNodeId) {
        console.warn("[flow-edge] skipped self edge during render", edge);
        return null;
      }
      return { ...edge, source, target: targetNode };
    })
    .filter(Boolean)
    .filter((edge) => {
      const connectable = isConnectable(edge.source) && isConnectable(edge.target);
      if (!connectable) {
        console.warn("[flow-edge] source or target is not renderable", {
          id: edge.id,
          sourceNodeId: edge.sourceNodeId,
          targetNodeId: edge.targetNodeId,
        });
      }
      return connectable;
    });
  const shouldShow = edges.length;

  if (!shouldShow) {
    board?.classList.remove("result-connector-ready");
    if (svg) svg.innerHTML = "";
    logFlowGraph("render-edges");
    return;
  }

  if (svg) {
    const buildConnectorRoute = (edgeStartX, edgeStartY, endX, endY) => {
      const deltaX = endX - edgeStartX;
      const deltaY = endY - edgeStartY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      const direction = deltaX >= 0 ? 1 : -1;
      const handle = Math.min(120, Math.max(48, absX * 0.32));
      const yEase = absY < 40 ? 0 : Math.min(24, absY * 0.18);
      const c1x = edgeStartX + handle * direction;
      const c1y = edgeStartY + Math.sign(deltaY) * yEase;
      const c2x = endX - handle * direction;
      const c2y = endY - Math.sign(deltaY) * yEase;

      return {
        path: `M ${edgeStartX} ${edgeStartY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${endX} ${endY}`,
        targetCircleX: endX,
        targetCircleY: endY,
      };
    };

    const svgWidth = Math.max(
      board.scrollWidth,
      boardRect.width,
      ...edges.flatMap((edge) => {
        const sourceRect = edge.source.getBoundingClientRect();
        const targetRect = edge.target.getBoundingClientRect();
        return [sourceRect.right - boardRect.left, targetRect.right - boardRect.left];
      }),
    ) + 80;
    const svgHeight = Math.max(
      board.scrollHeight,
      boardRect.height,
      ...edges.flatMap((edge) => {
        const sourceRect = edge.source.getBoundingClientRect();
        const targetRect = edge.target.getBoundingClientRect();
        return [sourceRect.bottom - boardRect.top, targetRect.bottom - boardRect.top];
      }),
    ) + 80;
    svg.setAttribute("viewBox", `0 0 ${svgWidth} ${svgHeight}`);
    svg.setAttribute("width", `${svgWidth}`);
    svg.setAttribute("height", `${svgHeight}`);
    svg.style.width = `${svgWidth}px`;
    svg.style.height = `${svgHeight}px`;
    svg.innerHTML = edges
      .map((edge) => {
        const sourceRect = edge.source.getBoundingClientRect();
        const targetRect = edge.target.getBoundingClientRect();
        const edgeStartX = sourceRect.right - boardRect.left;
        const edgeStartY = sourceRect.top + sourceRect.height / 2 - boardRect.top;
        const endX = targetRect.left - boardRect.left;
        const endY = targetRect.top + targetRect.height / 2 - boardRect.top;
        const route = buildConnectorRoute(edgeStartX, edgeStartY, endX, endY);
        return `
          <path data-edge-id="${edge.id}" d="${route.path}"></path>
          <circle cx="${edgeStartX}" cy="${edgeStartY}" r="3.5"></circle>
          <circle cx="${route.targetCircleX}" cy="${route.targetCircleY}" r="3.5"></circle>
        `;
      })
      .join("");
  }
  board.classList.add("result-connector-ready");
  logFlowGraph("render-edges");
}

function queueConnectorUpdate() {
  window.requestAnimationFrame(() => {
    updateResultConnector();
  });
}

function queueConnectorUpdateAfterLayout() {
  queueConnectorUpdate();
  window.setTimeout(queueConnectorUpdate, 80);
}

function getCanvasViewport() {
  return $("#labPage");
}

function getFocusTarget(target) {
  if (!target) return null;
  if (typeof Element !== "undefined" && target instanceof Element) return target;
  const value = String(target);
  return document.getElementById(value) || document.querySelector(value);
}

function ensureCanvasFocusRoom(node, anchorY = 0.5) {
  const viewport = getCanvasViewport();
  const board = $("#flowBoard");
  if (!viewport || !board || !node) return;
  let spacer = $("#canvasFocusSpacer");
  if (!spacer) {
    spacer = document.createElement("div");
    spacer.id = "canvasFocusSpacer";
    spacer.setAttribute("aria-hidden", "true");
    spacer.style.cssText = "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;";
    board.appendChild(spacer);
  }
  const boardRect = board.getBoundingClientRect();
  const rect = node.getBoundingClientRect();
  const localCenterX = rect.left - boardRect.left + rect.width / 2;
  const localCenterY = rect.top - boardRect.top + rect.height / 2;
  const requiredRight = Math.ceil(localCenterX + viewport.clientWidth / 2 + 120);
  const requiredBottom = Math.ceil(localCenterY + viewport.clientHeight * (1 - anchorY) + 120);
  spacer.style.left = `${Math.max(requiredRight, board.scrollWidth)}px`;
  spacer.style.top = `${Math.max(requiredBottom, board.scrollHeight)}px`;
}

function smoothCanvasPanByDelta(deltaX, deltaY, duration = 420) {
  const viewport = getCanvasViewport();
  if (!viewport) return;
  const startX = viewport.scrollLeft;
  const startY = viewport.scrollTop;
  const maxX = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
  const maxY = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
  const targetX = Math.min(maxX, Math.max(0, startX + deltaX));
  const targetY = Math.min(maxY, Math.max(0, startY + deltaY));
  const moveX = targetX - startX;
  const moveY = targetY - startY;
  const startedAt = performance.now();
  const ease = (progress) => 1 - Math.pow(1 - progress, 3);

  function tick(now) {
    const progress = Math.min((now - startedAt) / duration, 1);
    const eased = ease(progress);
    viewport.scrollLeft = startX + moveX * eased;
    viewport.scrollTop = startY + moveY * eased;
    if (progress < 1) {
      window.requestAnimationFrame(tick);
    } else {
      queueConnectorUpdateAfterLayout();
    }
  }

  window.requestAnimationFrame(tick);
}

function focusNode(nodeId, options = {}) {
  const node = getFocusTarget(nodeId);
  const viewport = getCanvasViewport();
  if (!node || !viewport) return;
  const delay = typeof options.delay === "number" ? options.delay : 80;
  window.setTimeout(() => {
    const anchorY = typeof options.anchorY === "number" ? options.anchorY : 0.5;
    const duration = typeof options.duration === "number" ? options.duration : 420;
    ensureCanvasFocusRoom(node, anchorY);
    const getDelta = () => {
      const rect = node.getBoundingClientRect();
      const viewportRect = viewport.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      return {
        x: rect.left + rect.width / 2 - (viewportRect.left + viewport.clientWidth / 2),
        y: rect.top + rect.height / 2 - (viewportRect.top + viewport.clientHeight * anchorY),
        rect,
      };
    };

    const delta = getDelta();
    if (!delta) return;

    if (options.forceMotion && Math.abs(delta.x) + Math.abs(delta.y) < 120) {
      const viewportRect = viewport.getBoundingClientRect();
      const nudgeY = delta.rect.top < viewportRect.top + viewport.clientHeight * anchorY ? 120 : -120;
      smoothCanvasPanByDelta(0, nudgeY, 160);
      window.setTimeout(() => {
        const finalDelta = getDelta();
        if (finalDelta) smoothCanvasPanByDelta(finalDelta.x, finalDelta.y, duration);
      }, 180);
      return;
    }

    smoothCanvasPanByDelta(delta.x, delta.y, duration);
  }, delay);
}

window.focusNode = focusNode;

function focusCanvasNode(target, delay = 80, options = {}) {
  focusNode(target, { ...options, delay });
}

function highlightCanvasNode(target, delay = 120, duration = 1500) {
  const node = typeof target === "string" ? document.querySelector(target) : target;
  if (!node) return;
  window.setTimeout(() => {
    node.classList.add("is-focus-highlight");
    window.setTimeout(() => {
      node.classList.remove("is-focus-highlight");
    }, duration);
  }, delay);
}

function focusAndHighlight(target, delay = 100, options = {}) {
  focusCanvasNode(target, delay, options);
  highlightCanvasNode(options.highlightTarget || target, delay + 120, options.highlightDuration || 1500);
}

function getNodeKey(node) {
  return node.dataset.nodeKey || node.id;
}

function getNodeOffset(node) {
  return state.nodeOffsets[getNodeKey(node)] || { x: 0, y: 0 };
}

function setNodeOffset(node, x, y) {
  state.nodeOffsets[getNodeKey(node)] = { x, y };
  node.style.transform = `translate(${x}px, ${y}px)`;
  queueConnectorUpdate();
}

function isInteractiveDragTarget(target) {
  return Boolean(target.closest("button, input, textarea, select, a, label, .inline-picker, .copy-editor"));
}

function getDraggableNode(event) {
  const node = event.target.closest("#uploadNode, #analysisNode, #replaceRail, .result-card, .branch-config-card, .branch-analysis-card, .branch-source-card");
  if (!node || isInteractiveDragTarget(event.target)) return null;
  if (node.id === "uploadNode" && $("#uploadedVideoNode").classList.contains("hidden")) return null;
  if (node.id === "replaceRail" && !event.target.closest(".replace-head")) return null;
  return node;
}

function startNodeDrag(event) {
  if (event.button !== 0) return;
  const node = getDraggableNode(event);
  if (!node) return;

  const offset = getNodeOffset(node);
  state.dragNode = {
    node,
    startX: event.clientX,
    startY: event.clientY,
    offsetX: offset.x,
    offsetY: offset.y,
    moved: false,
  };
  node.classList.add("node-dragging");
  node.setPointerCapture?.(event.pointerId);
}

function moveNodeDrag(event) {
  if (!state.dragNode) return;
  const deltaX = event.clientX - state.dragNode.startX;
  const deltaY = event.clientY - state.dragNode.startY;
  if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) state.dragNode.moved = true;
  if (!state.dragNode.moved) return;
  event.preventDefault();
  setNodeOffset(state.dragNode.node, state.dragNode.offsetX + deltaX, state.dragNode.offsetY + deltaY);
}

function endNodeDrag(event) {
  if (!state.dragNode) return;
  const { node, moved } = state.dragNode;
  node.classList.remove("node-dragging");
  node.releasePointerCapture?.(event.pointerId);
  if (moved && node.id === "uploadNode") {
    state.suppressUploadClick = true;
    window.setTimeout(() => {
      state.suppressUploadClick = false;
    }, 0);
  }
  state.dragNode = null;
  queueConnectorUpdate();
}

function setFlowMode(mode) {
  $("#flowBoard").classList.toggle("is-customizing", mode === "customizing");
  $("#flowBoard").classList.toggle("is-analyzing", mode === "analyzing");
  $("#flowBoard").classList.toggle("is-result", mode === "result");
  if (mode !== "result") $("#flowBoard").classList.remove("is-generating-result");
  queueConnectorUpdate();
}

function setFlowBreakdownStatus(status) {
  const button = $("#flowBreakdownStatus");
  if (!button) return;
  const isReady = status === "ready";
  button.disabled = !isReady;
  button.classList.toggle("ready", isReady);
  button.classList.toggle("analyzing", !isReady);
  button.innerHTML = isReady ? `<span></span>拆解结构` : `<span></span>正在拆解结构...`;
  queueConnectorUpdate();
}

function openBreakdownDetails(versionId = "") {
  const title = versionId ? `${versionId} 视频拆解` : "视频拆解";
  const subtitle = versionId
    ? `当前基于：${versionId} 生成结果。用于后续上传替换与定制。`
    : "按镜头整理视频结构，帮助后续替换和生成更贴近参考效果。";

  $("#breakdownTitle").textContent = title;
  $("#breakdownSubtitle").textContent = subtitle;

  renderBreakdownData(state.breakdownData);

  openModal("breakdownModal");
}

function renderBreakdownData(data) {
  const overview = data?.overview || {};
  const shots = Array.isArray(data?.shots) ? data.shots : [];

  const overviewEl = $("#breakdownOverview");
  if (overviewEl) {
    overviewEl.innerHTML = `
      <div>
        <span>参考视频</span>
        <strong>${escapeHtml(overview.referenceVideo || state.uploadedVideo || "已上传参考视频")}</strong>
      </div>
      <div>
        <span>总镜头</span>
        <strong>${escapeHtml(String(overview.shotCount || shots.length || 0))} 个</strong>
      </div>
      <div>
        <span>可替换主体</span>
        <strong>${escapeHtml(formatList(overview.replaceableSubjects))}</strong>
      </div>
      <div>
        <span>可替换场景</span>
        <strong>${escapeHtml(formatList(overview.replaceableScenes))}</strong>
      </div>
      <div>
        <span>可替换元素</span>
        <strong>${escapeHtml(formatList(overview.replaceableElements))}</strong>
      </div>
    `;
  }

  const shotList = $("#shotList");
  if (!shotList) return;

  if (!shots.length) {
    shotList.innerHTML = `
      <div class="empty-breakdown">
        <h3>暂无视频拆解结果</h3>
        <p>请先上传参考视频，等待系统完成拆解后再查看。</p>
      </div>
    `;
    return;
  }

  shotList.innerHTML = shots
    .map((shot, index) => {
      const title = shot.title || `镜头 ${index + 1}`;
      const time = shot.time || "";
      const description = shot.description || "暂无画面描述";
      const replaceable = Array.isArray(shot.replaceable) ? shot.replaceable : [];
      const suggestKeep = Array.isArray(shot.suggestKeep) ? shot.suggestKeep : [];

      return `
        <details class="shot-card">
          <summary>
            <div class="shot-main">
              <div class="shot-thumb">
                ${
                  state.uploadedVideoObjectUrl
                    ? `<video class="shot-thumb-video" src="${state.uploadedVideoObjectUrl}#t=${getShotStartSeconds(shot.time)}" muted playsinline preload="metadata"></video>`
                    : state.uploadedVideoCoverUrl
                      ? `<img src="${state.uploadedVideoCoverUrl}" alt="镜头 ${index + 1}">`
                      : ""
                }
                <span class="play-dot">▶</span>
                <span>镜头 ${index + 1}</span>
              </div>

              <div class="shot-copy">
                <h3>${escapeHtml(title)}</h3>
                <p>${escapeHtml(description)}</p>
                <div class="shot-tags">
                  ${renderTagList(replaceable, "可替换")}
                </div>
                <div class="shot-tags keep">
                  ${renderTagList(suggestKeep, "建议保留")}
                </div>
              </div>

              <time>${escapeHtml(time)}</time>
            </div>
            <span class="shot-toggle">展开详情</span>
          </summary>

          <div class="shot-detail">
            <section>
              <h4>画面结构</h4>
              <p><strong>人物：</strong>${escapeHtml(shot.people || "未识别")}</p>
              <p><strong>场景：</strong>${escapeHtml(shot.scene || "未识别")}</p>
              <p><strong>动作：</strong>${escapeHtml(shot.action || "未识别")}</p>
              <p><strong>元素：</strong>${escapeHtml(Array.isArray(shot.elements) ? shot.elements.join("、") : shot.elements || "未识别")}</p>
            </section>
            <section>
              <h4>镜头表达</h4>
              <p><strong>镜头：</strong>${escapeHtml(shot.camera || "未识别")}</p>
              <p><strong>节奏：</strong>${escapeHtml(shot.rhythm || "未识别")}</p>
            </section>
          </div>
        </details>
      `;
    })
    .join("");
}

function parseBreakdownResult(rawText = "") {
  const text = String(rawText || "");

  let jsonText = "";

  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");

  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    jsonText = text.slice(jsonStart, jsonEnd + 1);
  }

  if (!jsonText) {
    console.warn("未找到 JSON 拆解结果：", text);
    return getEmptyBreakdownData("未找到可解析的视频拆解结果");
  }

  try {
    const data = JSON.parse(jsonText);
    return normalizeBreakdownData(data);
  } catch (firstError) {
    try {
      const repairedJsonText = jsonText
        .replace(/,\s*}/g, "}")
        .replace(/,\s*]/g, "]")
        .replace(/^json\s*/i, "")
        .trim();

      const data = JSON.parse(repairedJsonText);
      return normalizeBreakdownData(data);
    } catch (secondError) {
      console.error("视频拆解 JSON 解析失败：", secondError);
      console.log("原始拆解结果：", text);
      console.log("提取出的 JSON：", jsonText);

      return getEmptyBreakdownData("视频拆解结果解析失败，请重新拆解");
    }
  }
}

function normalizeBreakdownData(data = {}) {
  const overview = data.overview || {};
  const shots = Array.isArray(data.shots) ? data.shots : [];

  return {
    overview: {
      referenceVideo: overview.referenceVideo || state.uploadedVideo || "已上传参考视频",
      shotCount: overview.shotCount || shots.length || 0,
      replaceableSubjects: normalizeList(overview.replaceableSubjects),
      replaceableScenes: normalizeList(overview.replaceableScenes),
      replaceableElements: normalizeList(overview.replaceableElements),
      replaceableText: normalizeList(overview.replaceableText),
    },
    shots: shots.map((shot, index) => ({
      id: shot.id || `shot${index + 1}`,
      title: shot.title || `镜头${index + 1}`,
      time: shot.time || "",
      description: shot.description || "暂无画面描述",
      replaceable: normalizeList(shot.replaceable),
      suggestKeep: normalizeList(shot.suggestKeep),
      people: shot.people || "未识别",
      scene: shot.scene || "未识别",
      elements: normalizeList(shot.elements),
      action: shot.action || "未识别",
      camera: shot.camera || "未识别",
      rhythm: shot.rhythm || "未识别",
    })),
  };
}

function getEmptyBreakdownData(message = "暂无视频拆解结果") {
  return {
    overview: {
      referenceVideo: message,
      shotCount: 0,
      replaceableSubjects: [],
      replaceableScenes: [],
      replaceableElements: [],
      replaceableText: [],
    },
    shots: [],
  };
}
async function applyBreakdownToCustomItems(data) {
const overview = data?.overview || {};
const shots = Array.isArray(data?.shots) ? data.shots : [];

const subjects = normalizeList(overview.replaceableSubjects, { filterRelationWords: true });
const scenes = buildSceneListFromShots(shots, overview.replaceableScenes);

const elements = uniqueList([
  ...normalizeList(overview.replaceableElements),
  ...collectShotValues(shots, "elements"),
  ...collectShotValues(shots, "replaceable"),
]).filter((item) => !isInvalidElementLabel(item))
.slice(0, 10);

const texts = normalizeList(overview.replaceableText);
const displayTexts = texts.length ? texts : ["本视频未识别到任何文字。"];

const makeItems = (list, group, prefix, previewPrefix) =>
  list.map((name, index) => ({
    id: `${prefix}${index + 1}`,
    group,
    title: name || `${group} ${index + 1}`,
    preview: `${previewPrefix}-${index + 1}`,
    previewUrl: state.uploadedVideoCoverUrl || "",
    original: `保留原视频${group}`,
    current: `保留原视频${group}`,
    changed: false,
  }));

  const nextItems = [
    ...makeItems(subjects, "主体", "realSubject", "preview-subject"),
    ...makeItems(scenes, "场景", "realScene", "preview-scene"),
    ...makeItems(elements, "元素", "realElement", "preview-element"),
    ...makeItems(displayTexts, "字幕/文案", "realCopy", "preview-copy"),
  ];

if (nextItems.length) {
  state.customItems = nextItems;

  const previewMap = await buildCustomItemPreviewMap(state.customItems);

  state.customItems = state.customItems.map((item) => ({
    ...item,
    previewUrl: previewMap[item.id] || item.previewUrl || state.uploadedVideoCoverUrl
  }));

  console.log("真实替换项数据：", state.customItems);
}
}

function normalizeList(value, options = {}) {
  const list = Array.isArray(value)
    ? value.filter(Boolean).map((item) => String(item).trim()).filter(Boolean)
    : typeof value === "string" && value.trim()
      ? value
          .split(/[、,，/]/)
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

  if (!options.filterRelationWords) {
    return list;
  }

  return list.filter((item) => !isInvalidSubjectLabel(item));
}
function collectShotValues(shots = [], key) {
  return shots.flatMap((shot) => {
    const value = shot?.[key];

    if (Array.isArray(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      return value.split(/[、,，/]/);
    }

    return [];
  }).map((item) => String(item).trim()).filter(Boolean);
}

function buildSceneListFromShots(shots = [], overviewScenes = []) {
  const shotScenes = shots
    .map((shot, index) => {
      const rawScene = String(shot?.scene || "").trim();
      const rawTitle = String(shot?.title || "").trim();

      const label = cleanSceneLabel(rawScene || rawTitle || `场景 ${index + 1}`);

      return label || `场景 ${index + 1}`;
    })
    .filter(Boolean);

  const fallbackScenes = normalizeList(overviewScenes).map(cleanSceneLabel).filter(Boolean);

  const merged = uniqueList(shotScenes.length ? shotScenes : fallbackScenes);

  return merged.slice(0, Math.max(3, Math.min(shots.length || 4, 4)));
}

function cleanSceneLabel(label = "") {
  let value = String(label || "").trim();

  if (!value) return "";

  value = value
    .replace(/^镜头\s*\d+\s*[｜|:：-]?\s*/g, "")
    .replace(/^场景\s*\d+\s*[｜|:：-]?\s*/g, "")
    .replace(/[。,.，；;].*$/g, "")
    .trim();

  const tooLong = value.length > 12;
  if (tooLong) {
    value = value.slice(0, 12);
  }

  return value;
}

function uniqueList(list = []) {
  return Array.from(new Set(
    list
      .map((item) => String(item).trim())
      .filter(Boolean)
  ));
}

function isInvalidElementLabel(label = "") {
  const value = String(label || "").trim();

  if (!value) return true;

  const invalidWords = [
    "人物",
    "主体",
    "男性",
    "女性",
    "男",
    "女",
    "情侣",
    "伴侣",
    "夫妻",
    "夫妇",
    "新婚夫妇",
    "新人",
    "男女",
    "两人",
    "二人",
    "舞者",
    "动作",
    "舞蹈",
    "节奏",
    "镜头",
    "画面",
    "场景",
    "背景",
  ];

  return invalidWords.some((word) => value === word || value.includes(word));
}
function isInvalidSubjectLabel(label = "") {
  const value = String(label || "").trim();

  if (!value) return true;

  const relationWords = [
    "情侣",
    "伴侣",
    "夫妻",
    "夫妇",
    "新婚夫妇",
    "新婚夫妻",
    "新人",
    "男女",
    "男女主",
    "男方女方",
    "二人",
    "两人",
    "两位",
    "两名",
    "一对",
    "一组",
    "组合",
    "搭档",
    "同伴",
    "伙伴",
    "朋友",
    "恋人",
    "爱人",
    "对象",
    "人群",
    "观众",
    "路人",
    "群众",
    "围观者",
    "舞者组合",
    "情侣组合",
    "人物组合",
    "主角组合",
    "群体",
    "团队",
    "多人",
  ];

  if (relationWords.some((word) => value.includes(word))) {
    return true;
  }

  const tooGenericWords = [
    "人物",
    "主体",
    "角色",
    "人",
    "男",
    "女",
  ];

  if (tooGenericWords.includes(value)) {
    return true;
  }

  return false;
}

function getShotStartSeconds(time = "") {
  const match = String(time).match(/(\d{1,2}):(\d{2})/);
  if (!match) return 0.8;

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);

  return minutes * 60 + seconds + 0.3;
}

function formatList(value) {
  if (Array.isArray(value) && value.length) {
    return value.join("、");
  }

  if (typeof value === "string" && value.trim()) {
    return value;
  }

  return "未识别";
}

function isValidImageUrl(url = "") {
  const value = String(url || "").trim();

  return (
    value.startsWith("data:image") ||
    value.startsWith("blob:") ||
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("./") ||
    value.startsWith("/")
  );
}

function renderTagList(items, prefix) {
  if (!items.length) return `<span>${prefix}：未识别</span>`;
  return items.map((item) => `<span>${prefix}：${escapeHtml(item)}</span>`).join("");
}

function escapeHtml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function startAnalysis(source = "upload") {
  state.analyzing = true;
  state.analyzed = false;
  state.revisingConfig = false;
  state.breakdownData = null;
  state.flowStatus = source === "inspiration" ? "analyzingReference" : "analyzingUpload";

  setFlowMode("analyzing");
  setFlowBreakdownStatus("analyzing");

  $("#reviseNotice").classList.add("hidden");
  $("#replaceRail").classList.remove("is-revising");
  $("#uploadNode").classList.remove("hidden");
  $("#analysisNode").classList.remove("hidden");
  $("#replaceRail").classList.add("hidden");
  $("#resultPanel").classList.add("hidden");

  queueConnectorUpdate();

  if (state.analysisTimer) window.clearTimeout(state.analysisTimer);

  addAgentMessage("正在拆解视频，稍后会把可替换内容列出来。");

  if (!state.uploadedVideoFile) {
    state.analyzing = false;
    state.analyzed = false;
    setFlowBreakdownStatus("idle");
    addAgentMessage("没有找到上传的视频文件，请先上传参考视频。");
    return;
  }

  try {
    const formData = new FormData();
    formData.append("video", state.uploadedVideoFile);

    const response = await fetch("/api/video-to-text", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.message || data.error || "视频拆解失败");
    }

    state.breakdownData = parseBreakdownResult(data.result);
    await applyBreakdownToCustomItems(state.breakdownData);
    localStorage.setItem("rh_debug_breakdownData", JSON.stringify(state.breakdownData));
localStorage.setItem("rh_debug_uploadedVideo", state.uploadedVideo || "");
localStorage.setItem("rh_debug_uploadedVideoCoverUrl", state.uploadedVideoCoverUrl || "");
    state.analyzing = false;
    state.analyzed = true;
    state.flowStatus = "customizationReady";
    state.analysisTimer = null;

    setFlowMode("customizing");
    setFlowBreakdownStatus("ready");

    $("#analysisNode").classList.add("hidden");
    $("#replaceRail").classList.remove("hidden");
    $("#sourceStatus").textContent = "查看视频拆解";
    $("#sourceLine").textContent = "选择要替换的内容，未修改的部分会保留原样。";

    renderCustomItems();
    createFlowNode({ node: "#replaceRail", sourceNodeId: "uploadNode", focusDelay: 120 });
    addAgentBreakdownMessage();
  } catch (error) {
    console.error(error);

    state.analyzing = false;
    state.analyzed = false;
    state.analysisTimer = null;

    setFlowBreakdownStatus("idle");
    addAgentMessage(`视频拆解失败：${error.message}`);
  }
}
function restoreDebugBreakdown() {
  const cachedBreakdown = localStorage.getItem("rh_debug_breakdownData");
  if (!cachedBreakdown) {
    showActionFeedback("没有可用的缓存拆解结果。");
    return;
  }

  try {
    state.breakdownData = JSON.parse(cachedBreakdown);
    state.uploadedVideo = localStorage.getItem("rh_debug_uploadedVideo") || "缓存视频.mp4";
    state.uploadedVideoCoverUrl = localStorage.getItem("rh_debug_uploadedVideoCoverUrl") || "";
    state.analyzing = false;
    state.analyzed = true;
    state.flowStatus = "customizationReady";

    applyBreakdownToCustomItems(state.breakdownData);
    setFlowMode("customizing");
    setFlowBreakdownStatus("ready");

    $("#analysisNode")?.classList.add("hidden");
    $("#replaceRail")?.classList.remove("hidden");
    $("#uploadNode")?.classList.remove("hidden");
    $("#sourceStatus").textContent = "查看视频拆解";
    $("#sourceLine").textContent = "选择要替换的内容，未修改的部分会保留原样。";

    renderCustomItems();
    createFlowNode({ node: "#replaceRail", sourceNodeId: "uploadNode", focusDelay: 120 });
    addAgentBreakdownMessage();
    showActionFeedback("已恢复上一次拆解结果。");
  } catch (error) {
    console.error(error);
    showActionFeedback("缓存拆解结果恢复失败。");
  }
}
function restoreDebugGenerate() {
  const cachedBreakdown = localStorage.getItem("rh_debug_breakdownData");

  if (!cachedBreakdown) {
    showActionFeedback("没有可用的缓存拆解结果，请先完整跑一次拆解。");
    return;
  }

  try {
    state.breakdownData = JSON.parse(cachedBreakdown);
    state.uploadedVideo = localStorage.getItem("rh_debug_uploadedVideo") || "缓存视频.mp4";
    state.uploadedVideoCoverUrl = localStorage.getItem("rh_debug_uploadedVideoCoverUrl") || "";
    state.analyzing = false;
    state.analyzed = true;
    state.flowStatus = "generationReady";

    applyBreakdownToCustomItems(state.breakdownData);

    const firstItem = state.customItems?.[0];
    if (firstItem) {
      firstItem.changed = true;
      firstItem.current = "测试替换素材";
      firstItem.previewUrl = state.uploadedVideoCoverUrl || firstItem.previewUrl;
    }

    renderCustomItems();

    const prompt = buildGenerationDescription(getChangedItems());

    state.pendingGeneration = {
      items: getChangedItems(),
      prompt,
      duration: state.generationDuration || "默认",
      ratio: state.generationRatio || "9:16",
      clarity: state.generationClarity || "标准"
    };

    setFlowMode("generating");

const debugGenerateButton = {
  textContent: "生成中",
  disabled: false,
  dataset: {
    generateAction: "confirm"
  }
};

handleGenerateAction(debugGenerateButton, null);

showActionFeedback("已跳过前置流程，开始生成视频。");
  } catch (error) {
    console.error(error);
    showActionFeedback("跳转生成步骤失败。");
  }
}
function saveDebugSnapshot() {
  try {
    localStorage.setItem("rh_debug_versions", JSON.stringify(state.versions || []));
    localStorage.setItem("rh_debug_currentVersionId", state.currentVersionId || "");
    localStorage.setItem("rh_debug_breakdownData", JSON.stringify(state.breakdownData || null));
    localStorage.setItem("rh_debug_customItems", JSON.stringify(state.customItems || []));
    const debugUploadedVideoTitle =
  typeof state.uploadedVideo === "string"
    ? state.uploadedVideo
    : state.uploadedVideo?.name || state.uploadedVideo?.title || "缓存视频.mp4";

localStorage.setItem("rh_debug_uploadedVideo", debugUploadedVideoTitle);
    localStorage.setItem("rh_debug_uploadedVideoCoverUrl", state.uploadedVideoCoverUrl || "");
    localStorage.setItem("rh_debug_flowStatus", state.flowStatus || "");
    console.log("[debug] 已保存完整测试快照");
  } catch (error) {
    console.error("[debug] 保存测试快照失败", error);
  }
}
function restoreDebugResult() {
  const cachedVersions = localStorage.getItem("rh_debug_versions");

  if (!cachedVersions) {
    showActionFeedback("没有可用的生成结果缓存，请先成功生成一次视频。");
    return;
  }

  try {
    state.versions = JSON.parse(cachedVersions) || [];
    state.currentVersionId =
      localStorage.getItem("rh_debug_currentVersionId") ||
      state.versions?.[0]?.id ||
      "";

    const cachedBreakdown = localStorage.getItem("rh_debug_breakdownData");
    const cachedCustomItems = localStorage.getItem("rh_debug_customItems");

    if (cachedBreakdown && cachedBreakdown !== "null") {
      state.breakdownData = JSON.parse(cachedBreakdown);
    }

    if (cachedCustomItems) {
      state.customItems = JSON.parse(cachedCustomItems) || [];
    } else if (state.breakdownData) {
      applyBreakdownToCustomItems(state.breakdownData);
    }

    state.uploadedVideo = localStorage.getItem("rh_debug_uploadedVideo") || "缓存视频.mp4";
    state.uploadedVideoCoverUrl = localStorage.getItem("rh_debug_uploadedVideoCoverUrl") || "";

    state.analyzing = false;
    state.analyzed = true;
    state.flowStatus = "resultReady";

    const currentVersion =
      state.versions.find((entry) => entry.id === state.currentVersionId) ||
      state.versions[0];

    if (!currentVersion) {
      showActionFeedback("生成结果缓存为空。");
      return;
    }

    setFlowMode("result");

    if (typeof showSelectedSource === "function" && state.uploadedVideoCoverUrl) {
      const cachedVideoTitle =
  typeof state.uploadedVideo === "string"
    ? state.uploadedVideo
    : state.uploadedVideo?.name || state.uploadedVideo?.title || "缓存视频.mp4";

showSelectedSource({
  title: cachedVideoTitle,
  coverUrl: state.uploadedVideoCoverUrl || currentVersion.coverUrl || currentVersion.videoUrl || "",
  duration: currentVersion.duration || "00:18",
  ratio: currentVersion.ratio || "9:16",
  size: "缓存视频"
});
}
    renderCustomItems();
    showResult(currentVersion);

    showActionFeedback("已恢复上一次完整生成结果。");
  } catch (error) {
    console.error(error);
    showActionFeedback("恢复生成结果失败。");
  }
}
async function handleVideoUpload(file) {
  state.uploadedVideo = file?.name || "上传的视频.mp4";
  state.uploadedVideoFile = file;
  state.flowStatus = "referenceSelected";

  if (state.uploadedVideoObjectUrl) {
  URL.revokeObjectURL(state.uploadedVideoObjectUrl);
}

state.uploadedVideoObjectUrl = file ? URL.createObjectURL(file) : "";

  const fileSize = file ? formatFileSize(file.size) : "未知大小";

  let videoInfo = {
    coverUrl: "",
    duration: "未知时长",
    ratio: "未知比例",
  };

  if (file) {
    videoInfo = await getVideoPreviewInfo(file);
  }

  state.uploadedVideoCoverUrl = videoInfo.coverUrl;
  console.log("上传视频封面：", state.uploadedVideoCoverUrl);
  showSelectedSource(state.uploadedVideo, "已上传", {
    coverUrl: videoInfo.coverUrl,
    duration: videoInfo.duration,
    ratio: videoInfo.ratio,
    size: fileSize,
  });

  $(".inspiration").classList.add("hidden");
  startAnalysis("upload");
}

function getVideoPreviewInfo(file) {
  return new Promise((resolve) => {
    const videoUrl = URL.createObjectURL(file);
    const video = document.createElement("video");

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = videoUrl;

    let resolved = false;

    const finish = (info) => {
      if (resolved) return;
      resolved = true;
      URL.revokeObjectURL(videoUrl);
      resolve(info);
    };

    video.onloadedmetadata = () => {
      const duration = formatDuration(video.duration);
      const ratio = getVideoRatio(video.videoWidth, video.videoHeight);

      // 不截第一帧，跳到 0.8 秒，避免黑屏封面
      const targetTime = Math.min(0.8, Math.max(0, video.duration - 0.1));
      video.currentTime = targetTime;

      video.onseeked = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 320;
          canvas.height = video.videoHeight || 180;

          const ctx = canvas.getContext("2d");
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const coverUrl = canvas.toDataURL("image/jpeg", 0.82);

          finish({
            coverUrl,
            duration,
            ratio,
          });
        } catch (error) {
          finish({
            coverUrl: "",
            duration,
            ratio,
          });
        }
      };
    };

    video.onerror = () => {
      finish({
        coverUrl: "",
        duration: "未知时长",
        ratio: "未知比例",
      });
    };
  });
}

function captureVideoFrameAt(videoUrl, seconds = 0.8) {
  return new Promise((resolve) => {
    if (!videoUrl) {
      resolve(state.uploadedVideoCoverUrl || "");
      return;
    }

    const video = document.createElement("video");
    video.src = videoUrl;
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    video.onloadedmetadata = () => {
      const duration = video.duration || 10;
      const safeTime = Math.min(
        Math.max(seconds, 0.2),
        Math.max(duration - 0.2, 0.2)
      );

      video.currentTime = safeTime;
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 360;
        canvas.height = video.videoHeight || 640;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        resolve(canvas.toDataURL("image/jpeg", 0.82));
      } catch (error) {
        console.warn("抽帧失败，使用首帧兜底", error);
        resolve(state.uploadedVideoCoverUrl || "");
      }
    };

    video.onerror = () => {
      console.warn("视频加载失败，使用首帧兜底");
      resolve(state.uploadedVideoCoverUrl || "");
    };
  });
}

async function buildCustomItemPreviewMap(items = []) {
  const previewMap = {};
  const videoUrl = state.uploadedVideoObjectUrl;

  if (!videoUrl || !items.length) return previewMap;

  const duration =
    state.uploadedVideoDuration ||
    state.uploadedVideoInfo?.duration ||
    10;

  const total = items.length;

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const ratio = total <= 1 ? 0.35 : (index + 1) / (total + 1);
    const seconds = Math.max(0.6, duration * ratio);

    previewMap[item.id] = await captureVideoFrameAt(videoUrl, seconds);
  }

  return previewMap;
}

async function imageUrlToFile(url, filename = "reference-cover.jpg") {
  if (!url) {
    throw new Error("缺少参考图，请先上传视频并完成拆解。");
  }

  if (url.startsWith("data:")) {
    return dataUrlToFile(url, filename);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("参考图读取失败，请重新上传视频。");
  }

  const blob = await response.blob();
  return new File([blob], filename, {
    type: blob.type || "image/jpeg"
  });
}

function dataUrlToFile(dataUrl, filename = "cover.jpg") {
  const [header, base64] = dataUrl.split(",");
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    array[i] = binary.charCodeAt(i);
  }

  return new File([array], filename, { type: mime });
}

function extractGeneratedVideoUrl(raw = "") {
  const text = String(raw || "");
  const outputFileMatch = text.match(/OUTPUT_FILE:\s*(\/[^\s]+\.mp4)/);
if (outputFileMatch) {
  const filename = outputFileMatch[1].split("/").pop();
  return `/generated/${filename}?t=${Date.now()}`;
}

  const directMatch = text.match(/https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/);
  if (directMatch) return directMatch[0];

  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");

  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    try {
      const data = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
      const found = findVideoUrlInObject(data);
      if (found) return found;
    } catch (error) {
      console.warn("生成结果 JSON 解析失败：", error);
    }
  }

  return "";
}

function findVideoUrlInObject(value) {
  if (!value) return "";

  if (typeof value === "string") {
    return value.includes(".mp4") || value.startsWith("http") ? value : "";
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findVideoUrlInObject(item);
      if (found) return found;
    }
  }

  if (typeof value === "object") {
    for (const key of Object.keys(value)) {
      const found = findVideoUrlInObject(value[key]);
      if (found) return found;
    }
  }

  return "";
}

function formatFileSize(bytes = 0) {
  if (!bytes) return "未知大小";
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(1)}MB`;
}

function formatDuration(seconds = 0) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "未知时长";

  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const restSeconds = total % 60;

  return `${String(minutes).padStart(2, "0")}:${String(restSeconds).padStart(2, "0")}`;
}

function getVideoRatio(width = 0, height = 0) {
  if (!width || !height) return "未知比例";

  const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height);

  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
}

function selectInspiration(item, card) {
  state.selectedInspiration = item;
  state.flowStatus = "referenceSelected";
  $$(".inspiration-card").forEach((entry) => entry.classList.toggle("selected", entry === card));
  $("#currentReference").classList.remove("hidden");
  $("#currentReference strong").textContent = item.title;
  showSelectedSource(item.title, "已选参考", item);
  $(".inspiration").classList.add("hidden");
  addAgentMessage(`已选择「${item.title}」作为参考。我先帮你拆解这个视频里的主体、场景和元素。`);
  startAnalysis("inspiration");
}

function openModal(id) {
  $(`#${id}`).classList.remove("hidden");
}

function openAssetModalForItem(item, config) {
  if (!item) {
    showActionFeedback("未找到当前替换项，请重新选择。");
    return;
  }

  state.activeItemId = item.id;
  state.activeBranchId = config?.id || state.activeBranchId;

  const modalTitle = $("#assetTitle");
  if (modalTitle) {
    modalTitle.textContent = `替换：${item.title}`;
  }

  const modalSubtitle = $("#assetSubtitle");
  if (modalSubtitle) {
    modalSubtitle.textContent = `为「${item.title}」上传新素材，或从资产库选择已有素材。`;
  }

  openModal("assetModal");
}

function closeModal(id) {
  $(`#${id}`).classList.add("hidden");
  if (id === "subtitleModal") {
    state.activeCopyModalId = null;
    state.activeCopyBranchId = null;
  }
  if (id === "assetModal") {
    state.activeItemId = null;
    state.activeBranchId = null;
    state.pendingUploadChoice = null;
  }
  if (id === "paramModal") {
    state.activeResultParamKey = null;
    state.activeResultParamVersionId = null;
    state.activeResultParamDraft = null;
  }
}
function triggerLocalAssetUpload(item) {
  if (!item) {
    showActionFeedback("未找到当前替换项，请重新选择。");
    return;
  }

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*,video/*";

  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;

    let previewUrl = "";

    if (file.type.startsWith("image/")) {
      previewUrl = URL.createObjectURL(file);
    }

    if (file.type.startsWith("video/")) {
      const videoInfo = await getVideoPreviewInfo(file);
      previewUrl = videoInfo.coverUrl || URL.createObjectURL(file);
    }

    applyAsset(file.name, previewUrl);
  });

  input.click();
}

function applyAsset(choice, previewUrl = null) {
  const branch = state.activeBranchId ? state.branchConfigs.find((entry) => entry.id === state.activeBranchId) : null;
  const item = branch
    ? branch.items.find((entry) => entry.id === state.activeItemId)
    : state.customItems.find((entry) => entry.id === state.activeItemId);
  if (!item) return;
  if (!branch) softenReviseNotice();
  const finalChoice = choice === "从本地选择" ? `${item.title.replace("：", "")}新素材.jpg` : choice;
  item.current = finalChoice;
  item.changed = true;
  if (previewUrl) {
    if (branch) {
      item.previewUrl = previewUrl;
    } else {
      customPreviewImages[item.id] = previewUrl;
    }
  }
  if (!state.recentUploads.includes(finalChoice)) state.recentUploads.unshift(finalChoice);
  state.openPickerId = null;
  state.activeAudioLinkId = null;
  closeModal("assetModal");
  if (branch) {
    branch.openPickerId = null;
    branch.confirming = false;
    branch.revising = false;
    branch.hint = "";
    renderResultCards(false);
    queueConnectorUpdateAfterLayout();
  } else {
    renderCustomItems();
    refreshResultDescriptionFromItems(true);
  }
  if (item.group === "音乐音效") {
    addAgentMessage(`已替换音乐音效：${item.title}。`);
  } else if (item.group === "主体") {
    addAgentMessage(`已替换${item.title}。其他内容暂时保持原样。`);
  } else if (item.id === "scene") {
    addAgentMessage("已替换场景。生成时会尽量保留原视频的动作和镜头节奏。");
  } else {
    addAgentMessage(`已替换${item.title}。其他内容暂时保持原样。`);
  }
  showActionFeedback(`${item.title} 已替换为 ${finalChoice}`);
}

function getAssetModalTitle(item) {
  return {
    主体: "选择主体素材",
    场景: "选择场景素材",
    元素: "选择元素素材",
    音乐音效: "选择音乐素材",
  }[item.group] || "选择素材";
}

function getUploadFileName(item) {
  return {
    主体: "subject-upload.png",
    场景: "scene-upload.png",
    元素: "element-upload.png",
    音乐音效: "music-upload.mp3",
  }[item.group] || "upload.png";
}

function getUploadPreviewUrl(item) {
  return {
    主体: "https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=420&q=82",
    场景: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=520&q=82",
    元素: "https://images.unsplash.com/photo-1575361204480-aadea25e6e68?auto=format&fit=crop&w=420&q=82",
  }[item.group] || null;
}

function getUploadAcceptText(item) {
  return item.group === "音乐音效" ? "支持音频或视频" : "支持图片或视频";
}

function openAssetModal(id, source, branchId = null) {
  const branch = branchId ? state.branchConfigs.find((entry) => entry.id === branchId) : null;
  const item = branch ? branch.items.find((entry) => entry.id === id) : state.customItems.find((entry) => entry.id === id);
  if (!item) return;
  state.activeItemId = id;
  state.activeBranchId = branchId;
  state.openPickerId = null;
  state.activeTextEditorId = null;
  state.activeAudioLinkId = null;
  state.pendingUploadChoice = null;
  $("#assetTitle").textContent = source === "资产库" ? getAssetModalTitle(item) : "上传新素材";
  $("#assetSubtitle").textContent =
    source === "资产库"
      ? "从资产库选择一个素材用于当前替换项。"
      : `${getUploadAcceptText(item)}，这里先模拟本地上传成功。`;
  $(".asset-modal-actions")?.classList.toggle("hidden", source !== "资产库");

  if (source === "资产库") {
    const assets = assetLibraryGroups[item.group] || [];
    $("#assetChoices").className = "asset-choices";
    $("#assetChoices").innerHTML = assets
      .map(
        (asset, index) => `
          <article class="asset-choice-card" data-action="asset-use" data-index="${index}" tabindex="0">
            ${
              asset.previewUrl
                ? `<img src="${asset.previewUrl}" alt="${asset.name}" loading="lazy" />`
                : `<div class="asset-audio-icon" aria-hidden="true"></div>`
            }
            <div>
              <strong>${asset.name}</strong>
              <span>${asset.type}</span>
            </div>
          </article>
        `,
      )
      .join("");
  } else {
    const fileName = getUploadFileName(item);
    state.pendingUploadChoice = {
      name: fileName,
      previewUrl: getUploadPreviewUrl(item),
    };
    $("#assetChoices").className = "asset-choices upload-choices";
    $("#assetChoices").innerHTML = `
      <button class="upload-dropzone" data-action="asset-upload-pick">
        <span>＋</span>
        <strong>点击上传或拖拽文件到这里</strong>
        <small>${getUploadAcceptText(item)}</small>
      </button>
    `;
  }
  if (branch) {
    branch.openPickerId = null;
    renderResultCards(false);
    queueConnectorUpdateAfterLayout();
  } else {
    renderCustomItems();
  }
  openModal("assetModal");
}

function pickInlineAsset(id, source, branchId = null) {
  openAssetModal(id, source, branchId);
}

function restoreItem(id) {
  const item = state.customItems.find((entry) => entry.id === id);
  softenReviseNotice();
  item.current = item.original;
  item.changed = false;
  state.openPickerId = null;
  state.activeTextEditorId = null;
  state.activeAudioLinkId = null;
  if (id === "caption") {
    state.subtitleLines = state.subtitleLines.map((line) => ({ ...line, text: line.original }));
  }
  renderCustomItems();
  refreshResultDescriptionFromItems(true);
  if (id === "caption") {
    addAgentMessage("已恢复原始字幕内容。");
  } else {
    addAgentMessage(item.group === "音乐音效" ? `已将${item.title}恢复为原始音效。` : `已将${item.title}恢复为原始内容。`);
  }
}

function resetCurrentCustomization() {
  state.customItems.forEach((item) => {
    item.current = item.original;
    item.changed = false;
  });
  state.subtitleLines = state.subtitleLines.map((line) => ({ ...line, text: line.original }));
  state.openPickerId = null;
  state.activeTextEditorId = null;
  state.activeAudioLinkId = null;
  state.activeCopyModalId = null;
  state.activeCopyBranchId = null;
  $("#canvasGenerateConfirm")?.classList.add("hidden");
  $(".change-list")?.classList.remove("is-confirming");
  $("#generateHint")?.classList.add("hidden");
  renderCustomItems();
  refreshResultDescriptionFromItems(true);
  addAgentMessage("已清空当前改造内容，可以重新选择素材或修改文案。");
}

function saveCopyEdit(id, editor) {
  const item = state.customItems.find((entry) => entry.id === id);
  if (!item) return;
  softenReviseNotice();

  if (id === "caption") {
    state.subtitleLines = state.subtitleLines.map((line, index) => {
      const input = editor.querySelector(`[data-subtitle-index="${index}"]`);
      return { ...line, text: input?.value.trim() || line.original };
    });
    item.current = "字幕内容已修改";
  } else {
    const input = editor.querySelector(`[data-copy-input="${id}"]`);
    const defaultValue = id === "introCopy" ? state.copyDrafts.introCopy : state.copyDrafts.outroCopy;
    item.current = input?.value.trim() || defaultValue;
  }

  item.changed = true;
  state.activeTextEditorId = null;
  renderCustomItems();
  refreshResultDescriptionFromItems(true);
  addAgentMessage(`已修改${item.title}。`);
}

function saveSubtitleModal() {
  const id = state.activeCopyModalId || "caption";
  const branch = state.activeCopyBranchId ? state.branchConfigs.find((entry) => entry.id === state.activeCopyBranchId) : null;
  const item = branch ? branch.items.find((entry) => entry.id === id) : state.customItems.find((entry) => entry.id === id);
  if (!item) return;
  if (!branch) softenReviseNotice();

  let isOriginal = false;
  if (id === "caption") {
    state.subtitleLines = state.subtitleLines.map((line, index) => {
      const input = $(`[data-subtitle-modal-index="${index}"]`);
      return { ...line, text: input?.value.trim() || line.original };
    });
    isOriginal = state.subtitleLines.every((line) => line.text === line.original);
    item.current = isOriginal ? item.original : "字幕内容已修改";
  } else {
    const input = $(`[data-copy-modal-input="${id}"]`);
    const value = input?.value.trim() || getCopyDefaultValue(id);
    isOriginal = value === getCopyDefaultValue(id);
    item.current = isOriginal ? item.original : value;
  }

  item.changed = !isOriginal;
  closeModal("subtitleModal");
  state.activeCopyModalId = null;
  state.activeCopyBranchId = null;
  if (branch) {
    branch.confirming = false;
    branch.hint = "";
    branch.revising = false;
    renderResultCards(false);
    queueConnectorUpdateAfterLayout();
  } else {
    renderCustomItems();
    refreshResultDescriptionFromItems(true);
  }
  addAgentMessage(isOriginal ? `已将${item.title}恢复为原始内容。` : `已修改${item.title}。`);
}

function restoreSubtitleModalDraft() {
  const id = state.activeCopyModalId || "caption";
  const branch = state.activeCopyBranchId ? state.branchConfigs.find((entry) => entry.id === state.activeCopyBranchId) : null;
  const item = branch ? branch.items.find((entry) => entry.id === id) : state.customItems.find((entry) => entry.id === id);
  if (!item) return;
  if (!branch) softenReviseNotice();
  if (id === "caption") {
    state.subtitleLines = state.subtitleLines.map((line) => ({ ...line, text: line.original }));
  }
  item.current = item.original;
  item.changed = false;
  closeModal("subtitleModal");
  state.activeCopyModalId = null;
  state.activeCopyBranchId = null;
  if (branch) {
    branch.confirming = false;
    branch.hint = "";
    renderResultCards(false);
    queueConnectorUpdateAfterLayout();
  } else {
    renderCustomItems();
    refreshResultDescriptionFromItems(true);
  }
  addAgentMessage(id === "caption" ? "已恢复原始字幕内容。" : `已将${item.title}恢复为原始内容。`);
}

function cancelCopyEdit() {
  state.activeTextEditorId = null;
  renderCustomItems();
}

function restoreOriginalCaption() {
  state.subtitleLines = state.subtitleLines.map((line) => ({ ...line, text: line.original }));
  restoreItem("caption");
}

function openGenerateConfirm() {
  if (!getChangeSummaryItems().length) {
    const hint = $("#generateHint");
    hint.textContent = "请先替换素材或修改文案后再生成";
    hint.classList.remove("hidden");
    $("#canvasGenerateConfirm").classList.add("hidden");
    showActionFeedback("请先替换素材或修改文案后再生成");
    window.setTimeout(() => hint.classList.add("hidden"), 2200);
    return;
  }
  disableAgentGenerateCards();
  const card = $("#canvasGenerateConfirm");
  card.innerHTML = getGenerateConfirmMarkup();
  card.classList.remove("hidden");
  $(".change-list").classList.add("is-confirming");
  addAgentMessage("本次将根据当前图片素材、文案内容和参考视频拆解结构生成视频。");
  card.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function handleGenerateAction(generateButton, card) {
  if (generateButton.dataset.generateAction === "back") {
    card?.classList.add("hidden");
    $(".change-list").classList.remove("is-confirming");
    card?.classList.remove("is-active");
    card?.querySelectorAll("button").forEach((button) => {
      button.disabled = true;
    });
    addAgentMessage("已返回修改页，你可以继续替换素材或修改生成描述。");
    return;
  }
  card?.querySelectorAll("button").forEach((button) => {
    button.disabled = true;
  });
  generateButton.textContent = "生成中";
  addAgentMessage("已确认生成，正在为你生成新版本。");
  const branchId = generateButton.dataset.branchId;
const config = state.branchConfigs?.find((item) => item.id === branchId);
const promptInput =
  card?.querySelector("[data-branch-prompt]") ||
  document.querySelector("#customAdjustmentInput");

const adjustmentText = promptInput?.value?.trim() || "";

const changedItems = config
  ? getBranchChangedItems(config)
  : getChangedItems();

const description = buildGenerationDescriptionWithAdjustment(
  changedItems,
  adjustmentText || config?.prompt || ""
);
  card?.classList.add("hidden");
  $(".change-list").classList.remove("is-confirming");
  showGeneratingResult(description);
  window.setTimeout(() => {
    card?.classList.remove("is-active");
    createVersion({
  prompt: description,
  adjustmentText
});
  }, 900);
}

function buildGenerationDescription(items = getChangedItems()) {
  const changedByGroup = (group) => items.filter((item) => item.group === group);

  const subjectText = changedByGroup("主体").length
    ? changedByGroup("主体")
        .map((item) => `${item.title}替换为${item.current}`)
        .join("；")
    : "主体保持原视频人物关系、动作节奏和站位。";

  const sceneText = changedByGroup("场景").length
    ? changedByGroup("场景")
        .map((item) => `${item.title}替换为${item.current}`)
        .join("；")
    : "场景保持原视频空间关系、镜头推进和环境氛围。";

  const elementText = changedByGroup("元素").length
    ? changedByGroup("元素")
        .map((item) => `${item.title}替换为${item.current}`)
        .join("；")
    : "元素保持原视频中的核心视觉符号和画面关系。";

  const copyText = changedByGroup("字幕 / 文案").length
    ? changedByGroup("字幕 / 文案")
        .map((item) => `${item.title}修改为${item.current}`)
        .join("；")
    : "不新增无关字幕，若原视频无文字则保持无文字。";

  const shots = Array.isArray(state.breakdownData?.shots) ? state.breakdownData.shots : [];
  const shotDescription = shots.length
    ? shots
        .map((shot, index) => {
          const time = shot.time || `镜头${index + 1}`;
          const title = shot.title || `镜头${index + 1}`;
          const description = shot.description || "保留参考视频画面结构。";
          const action = shot.action ? `动作：${shot.action}` : "";
          const camera = shot.camera ? `镜头：${shot.camera}` : "";
          const rhythm = shot.rhythm ? `节奏：${shot.rhythm}` : "";

          return `${time}：${title}。${description}${action ? ` ${action}。` : ""}${camera ? ` ${camera}。` : ""}${rhythm ? ` ${rhythm}。` : ""}`;
        })
        .join("\n")
    : "按参考视频原有镜头结构生成，保持人物动作、镜头节奏和场景关系。";

  return `【参考视频结构】
${shotDescription}

【本次替换】
主体：${subjectText}
场景：${sceneText}
元素：${elementText}
字幕 / 文案：${copyText}

【生成要求】
根据参考视频拆解结构生成新视频。保持原视频的镜头顺序、人物动作节奏、场景关系、画面氛围和运镜方式；只替换用户指定的主体、场景或元素，未修改内容保持原样。画面真实自然，人物动作连贯，镜头稳定，不要生成无关字幕、水印或额外文字。`;
}

function refreshResultDescriptionFromItems(force = false) {
  if (!force && state.resultPromptDirty) return;
  state.resultPromptDirty = false;
}

function getResultCardMarkup(version, index) {
  const reviseLabel = "重新改造";
const summaryLines = [
  ...(version.summary || []),
  ...getResultParamChanges(version).map((item) => `${item.title} → ${item.value}`),
  ...(version.adjustmentText ? [`补充生成要求：${version.adjustmentText}`] : []),
];
  return `
    <article id="result-${version.id}" class="result-card ${version.isGenerating ? "is-generating" : ""} ${version.id === state.latestVersionId ? "is-new" : ""}" data-version="${version.id}" data-node-key="result-${version.id}" ${getNodeStyle(`result-${version.id}`)}>
      <h2 class="result-node-title">生成结果</h2>
<div class="result-video">
  ${
    version.isGenerating
      ? `
        <div class="generating-visual">
          <div class="generating-orb"></div>
          <div class="generating-ring"></div>
          <p>正在生成...</p>
          <span>预计 1-2 分钟，请勿关闭页面</span>
        </div>
      `
      : version.videoUrl
        ? `<video class="result-video-player" src="${version.videoUrl}" controls playsinline preload="metadata"></video>`
        : `<img src="${getResultCover(version, index)}" alt="${version.id} 生成结果" loading="lazy" />`
  }
 ${version.isGenerating ? "" : `<span class="result-badge">${version.id}</span>`}
  ${version.videoUrl || version.isGenerating ? "" : `<div class="play-ring"></div>`}
</div>
      <div class="result-info">
        <div class="result-info-head">
  <span class="node-caption">版本</span>
  <strong>${version.isGenerating ? `V${index + 1} 正在生成` : version.id}</strong>
</div>
        <div class="result-meta">
          ${renderResultParamControls(version.id)}
        </div>
        <div>
          <h3>本次改造内容</h3>
          <ul>${summaryLines.map((line) => `<li>${line}</li>`).join("")}</ul>
        </div>
        <div class="result-prompt-head">
          <strong>生成依据</strong>
          <span>用于说明本次视频参考了哪些内容</span>
        </div>
<textarea class="result-prompt" data-result-prompt="${version.id}"readonly>${escapeHtml(version.prompt || buildGenerationDescription())}</textarea>        ${
          version.isGenerating
            ? ""
            : `<div class="result-actions">
                <button class="ghost-button" data-result-action="export" data-version="${version.id}">导出视频</button>
                <button class="ghost-button" data-result-action="save" data-version="${version.id}">保存至资产库</button>
                <button class="ghost-button" data-result-action="revise" data-version="${version.id}">${reviseLabel}</button>
              </div>`
        }
      </div>
    </article>
  `;
}

function getBranchAnalysisMarkup(config) {
  const isDone = config.analysisStatus === "done";
  return `
    <article id="branch-analysis-${config.id}" class="branch-analysis-card ${isDone ? "is-done" : "is-analyzing"} ${config.id === state.latestBranchId ? "is-new" : ""}" data-branch-id="${config.id}" data-node-key="branch-analysis-${config.id}" ${getNodeStyle(`branch-analysis-${config.id}`)}>
      <div class="branch-analysis-head">
        <span class="analysis-dot"></span>
        <div>
          <h2>${isDone ? `${config.baseVersionId} 视频拆解` : "正在拆解视频"}</h2>
          ${isDone ? `<span class="node-caption">已完成拆解</span>` : ""}
          <p>${isDone ? "已识别镜头结构、主体、场景、元素和字幕文案。" : "正在整理主体、场景、元素和字幕，完成后会把可操作内容放到画布里。"}</p>
        </div>
      </div>
      ${
        isDone
          ? `<button class="branch-breakdown-button" data-branch-action="breakdown" data-branch-id="${config.id}">查看视频拆解</button>`
          : `<div class="branch-analysis-loading"><span></span><span></span><span></span></div>`
      }
    </article>
  `;
}

function getBranchSourceMarkup(config) {
  const version = state.versions.find((entry) => entry.id === config.baseVersionId);
  const versionIndex = Math.max(
    state.versions.findIndex((entry) => entry.id === config.baseVersionId),
    0,
  );
  const cover = version ? getResultCover(version, versionIndex) : state.selectedInspiration?.coverUrl || inspirationItems[0].coverUrl;
  return `
    <article id="branch-source-${config.id}" class="branch-source-card ${config.id === state.latestBranchId ? "is-new" : ""}" data-branch-id="${config.id}" data-node-key="branch-source-${config.id}" ${getNodeStyle(`branch-source-${config.id}`)}>
      <div class="branch-source-video">
        <img src="${cover}" alt="${config.baseVersionId} 生成结果" loading="lazy" />
        <div class="play-ring">▶</div>
      </div>
      <strong>${config.baseVersionId} 生成结果</strong>
      <span>00:18 · 9:16 · 48.6MB</span>
      <button class="branch-breakdown-button branch-source-breakdown" data-branch-action="breakdown" data-branch-id="${config.id}">查看视频拆解</button>
    </article>
  `;
}

function getBranchConfigItemsMarkup(config) {
  const groups = ["主体", "场景", "元素", "字幕 / 文案"];
  return groups
    .map((group) => {
      const groupClass = {
        主体: "subject",
        场景: "scene",
        元素: "element",
        "字幕 / 文案": "copy",
      }[group];
      const items = (config.items || state.customItems)
        .filter((item) => item.group === group)
        .map((item) => {
          const isCopy = group === "字幕 / 文案";
          const isChanged = item.changed;
          const isOpen = config.openPickerId === item.id;
          const primaryAction = isChanged ? (isCopy ? "更改" : "更换") : isCopy ? "修改" : "替换";
          const restoreLabel = group === "元素" ? "恢复" : "恢复原始";
const previewUrl = state.uploadedVideoCoverUrl || "";

          return `
            <article class="custom-item custom-item-${groupClass} branch-custom-item${state.activeBranchId === config.id && state.activeItemId === item.id ? " is-selected-item" : ""}">
              <div class="item-preview ${item.preview}">
                <div class="preview-placeholder">视频帧占位</div>
                <span>${group === "主体" ? "视频截取" : group === "字幕 / 文案" ? "文案预览" : "识别预览"}</span>
              </div>
              <header>
                <strong>${item.title}</strong>
                ${isChanged ? `<span class="changed-mark">${isCopy ? "已修改" : "已替换"}</span>` : ""}
              </header>
              <p>当前：${isChanged ? (isCopy ? "已修改" : `已替换为 ${item.current}`) : item.current}</p>
              <div class="item-actions">
                <button data-branch-action="${isCopy ? "copy" : "replace"}" data-branch-id="${config.id}" data-branch-item="${item.id}">${primaryAction}</button>
                <button class="restore-button" data-branch-action="restore" data-branch-id="${config.id}" data-branch-item="${item.id}" title="恢复原始">${restoreLabel}</button>
              </div>
              ${
                isOpen && !isCopy
                  ? `<div class="inline-picker">
                      ${["上传新素材", "资产库"]
                        .map(
                          (label) => `
                            <button data-branch-action="quick-asset" data-source="${label}" data-branch-id="${config.id}" data-branch-item="${item.id}">
                              <span>${label}</span><span>›</span>
                            </button>
                          `,
                        )
                        .join("")}
                    </div>`
                  : ""
              }
            </article>
          `;
        })
        .join("");
      return `
        <section class="custom-group custom-group-${groupClass} branch-custom-group">
          <h3>${group}</h3>
          <div class="custom-group-grid">${items}</div>
        </section>
      `;
    })
    .join("");
}

function getBranchGenerateConfirmMarkup(config) {
  return `
    <div class="branch-bottom">
      <button class="primary-button branch-generate" data-branch-action="confirm-generate" data-branch-id="${config.id}">
        生成视频
      </button>
    </div>
  `;
}

function getBranchConfigMarkup(config) {
  const changed = getBranchChangeSummaryItems(config);
  const changedMarkup = changed.length
    ? changed
        .map(
          (item) => `
            <li class="change-tag">
              <strong class="change-object">${item.title}</strong>
              <span class="change-arrow">→</span>
              <span class="change-value">${item.value}</span>
            </li>
          `,
        )
        .join("")
    : `<li class="change-empty">${config.revising ? "还没有新的修改内容，请重新选择素材。" : "还没有新的修改内容，请先替换素材。"}</li>`;
  return `
    <article id="branch-${config.id}" class="branch-config-card ${config.id === state.latestBranchId ? "is-new" : ""} ${config.spotlight ? "is-revising" : ""}" data-branch-id="${config.id}" data-node-key="branch-${config.id}" ${getNodeStyle(`branch-${config.id}`)}>
      <div class="branch-head">
        <span class="node-caption">当前基于：${config.baseVersionId} 视频拆解结果</span>
        <h2>${(config.title || "上传替换与定制").replace(/0[0-9]+$/, "")}</h2>
        <p>可重新选择素材、修改文案或编辑生成描述。</p>
      </div>
      <div class="branch-top-notice ${config.hint ? "" : "hidden"} ${config.spotlight ? "is-spotlight" : ""}">
        <span></span>
        <strong>${config.hint || ""}</strong>
      </div>
      <div class="branch-custom-body">
        ${getBranchConfigItemsMarkup(config)}
      </div>
     <label class="branch-prompt branch-prompt-visible">
  <span>调整要求</span>
  <small>可以补充这次想让视频怎么变，也可以留空，只替换素材。</small>
  <textarea
    data-branch-prompt="${config.id}"
    placeholder="例如：画面更明亮一点，动作更慢，镜头更稳定，保留夜晚氛围。"
  >${escapeHtml(config.prompt || "")}</textarea>
</label>
      <div class="branch-change">
        <strong>本次改造内容</strong>
        <ul>${changedMarkup}</ul>
      </div>
     
      <div class="branch-bottom">
  <button class="primary-button branch-generate" data-branch-action="generate" data-branch-id="${config.id}">
    生成视频
  </button>
</div>
      ${""}
    </article>
  `;
}

function getBranchChangedItems(config) {
  return (config.items || []).filter((item) => item.changed);
}

function getBranchParamChangeSummaryItems(config) {
  return getParamChangeSummaryItems(config.params || state.resultParams, config.baseParams || resultParamDefaults);
}

function getBranchChangeSummaryItems(config) {
  return [
    ...getBranchChangedItems(config).map((item) => ({
      title: item.title,
      value: item.group === "字幕 / 文案" ? "已修改" : item.current,
      group: item.group,
    })),
    ...getBranchParamChangeSummaryItems(config),
  ];
}

function renderBranchChainsForVersion(version, rootIndex) {
  const branches = state.branchConfigs.filter((config) => config.baseVersionId === version.id);
  return branches
    .map((config) => {
      const childVersions = state.versions.filter((version) => version.branchId === config.id);
      const generating =
        state.generatingTarget?.branchId === config.id
          ? [
              {
                id: "生成中",
                summary: ["正在根据当前分支配置生成新版本"],
                prompt: state.generatingTarget.prompt,
                params: { ...(config.params || state.resultParams) },
                isGenerating: true,
                branchId: config.id,
              },
            ]
          : [];
      const childMarkup = [...childVersions, ...generating]
        .map(
          (childVersion, index) => `
            <div class="version-with-branches">
              ${getResultCardMarkup(childVersion, rootIndex + index + 1)}
              ${childVersion.isGenerating ? "" : renderBranchChainsForVersion(childVersion, rootIndex + index + 1)}
            </div>
          `,
        )
        .join("");
      return `
        <div class="branch-chain">
          ${config.analysisStatus === "done" ? `${getBranchAnalysisMarkup(config)}${getBranchConfigMarkup(config)}` : getBranchAnalysisMarkup(config)}
          ${childMarkup ? `<div class="branch-results-stack">${childMarkup}</div>` : ""}
        </div>
      `;
    })
    .join("");
}

function getNextVersionId() {
  const maxNumber = state.versions.reduce((max, version) => {
    const match = String(version.id || "").match(/^V(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `V${maxNumber + 1}`;
}

function renderResultLane(rootVersion, rootIndex) {
  const branchMarkup = renderBranchChainsForVersion(rootVersion, rootIndex);
  return `
    <div class="result-lane">
      ${getResultCardMarkup(rootVersion, rootIndex)}
      ${branchMarkup}
    </div>
  `;
}

function renderResultCards(generating = false, generatingPrompt = "") {
  const panel = $("#resultPanel");
  const rootVersions = state.versions.filter((version) => !version.branchId);
  const rootGenerating =
    generating && !state.generatingTarget?.branchId
      ? [
          {
            id: "生成中",
            summary: ["正在根据当前配置生成新版本"],
            prompt: generatingPrompt,
            params: { ...state.resultParams },
            isGenerating: true,
          },
        ]
      : [];
  panel.innerHTML = [...rootVersions, ...rootGenerating].map((version, index) => renderResultLane(version, index)).join("");
}

function showGeneratingResult(description = buildGenerationDescription()) {
  setFlowMode("result");
  $("#flowBoard").classList.add("is-generating-result");
  state.generatingTarget = { source: "root", prompt: description };
  $("#analysisNode").classList.add("hidden");
  $("#replaceRail").classList.remove("hidden");
  $("#uploadNode").classList.remove("hidden");
  $("#resultPanel").classList.remove("hidden");
  state.resultPromptDirty = false;
  renderResultCards(true, description);
  createFlowNode({ node: "#result-生成中", sourceNodeId: "replaceRail", focusDelay: 120 });
}
function buildGenerationDescriptionWithAdjustment(items = getChangedItems(), adjustmentText = "") {
  const baseDescription = buildGenerationDescription(items);
  const cleanAdjustment = adjustmentText.trim();

  if (!cleanAdjustment) {
    return baseDescription;
  }

  return `${baseDescription}

【用户本次调整要求】
${cleanAdjustment}

【执行要求】
在保留参考视频镜头结构、主体运动节奏和画面关系的基础上，优先满足用户本次调整要求。不要生成无关文字、水印或额外字幕。`;
}
async function createVersion(options = {}) {
  const nextVersionId = getNextVersionId();
  const branch = options.branchId ? state.branchConfigs.find((config) => config.id === options.branchId) : null;
  const changed = branch ? [] : getChangedItems();
  const branchChanged = branch ? getBranchChangedItems(branch) : [];
  const summaryItems = branch ? getBranchChangeSummaryItems(branch) : getChangeSummaryItems();
  const summary = branch
    ? summaryItems.length
      ? summaryItems.map((item) => `${item.title} → ${item.value}`)
      : ["生成描述：已更新"]
    : summaryItems.length
      ? summaryItems.map((item) => `${item.title} → ${item.value}`)
      : options.regeneratedFrom
        ? ["生成描述：已更新"]
        : ["其他内容：保持原视频"];
  const prompt = options.prompt || branch?.prompt || buildGenerationDescription(changed);
  let generatedVideoResult = null;
  let generatedVideoUrl = "";

try {
  if (!state.uploadedVideoCoverUrl) {
    throw new Error("缺少参考图，请先上传视频并完成拆解。");
  }

  const formData = new FormData();
  const coverFile = await imageUrlToFile(
  state.uploadedVideoCoverUrl || state.uploadedVideo?.coverUrl || state.uploadedVideoObjectUrl,
  "reference-cover.jpg"
);

const finalGeneratePrompt =
  prompt ||
  "根据参考图生成一段真实风格的竖屏短视频，人物自然移动，镜头稳定，画面清晰，光线自然，保持参考图的整体氛围和构图。";

formData.append("image", coverFile);
console.log("[debug] 发送给模型的首帧图片:", coverFile.name, coverFile.type, coverFile.size);

formData.append("prompt", finalGeneratePrompt);
console.log("[debug] 发送给模型的 prompt:", finalGeneratePrompt);

  formData.append("duration", "10");
  formData.append("aspectRatio", "9:16");

  const response = await fetch("/api/generate-video", {
    method: "POST",
    body: formData,
  });

  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(data.message || data.error || "视频生成失败");
  }

  generatedVideoResult = data.result;
  console.log("真实视频生成结果：", generatedVideoResult);
  generatedVideoUrl = extractGeneratedVideoUrl(generatedVideoResult);
} catch (error) {
  console.error("真实视频生成失败：", error);
  showActionFeedback(`视频生成失败：${error.message}`);
  throw error;
}
  const version = {
    id: nextVersionId,
    name: branch ? branch.title : options.regeneratedFrom ? "根据配置再生成" : changed[0] ? `替换${changed[0].title}` : "按当前配置生成",
    base: branch ? branch.title : state.currentBase,
    branchId: branch?.id || null,
    parentVersionId: branch?.baseVersionId || null,
    summary,
    prompt,
    adjustmentText: options.adjustmentText || "",
    generatedVideoResult,
    videoUrl: generatedVideoUrl,
    specs: `${(branch?.params || state.resultParams).ratio} / ${(branch?.params || state.resultParams).quality} / ${(branch?.params || state.resultParams).duration}`,
    params: { ...(branch?.params || state.resultParams) },
    time: new Date().toLocaleString("zh-CN", { hour12: false }),
    cost: "￥15.2",
    status: "已生成",
    exported: false,
    saved: false,
    items: branch ? branch.items.map((item) => ({ ...item })) : state.customItems.map((item) => ({ ...item })),
  };
  state.versions.push(version);
  state.currentVersion = version;
  state.latestVersionId = version.id;
  removeFlowEdgesByTarget("result-生成中");
  state.generatingTarget = null;
  showResult(version);
  saveDebugSnapshot();
  createFlowNode({ node: `#result-${version.id}`, sourceNodeId: branch ? `branch-${branch.id}` : "replaceRail", focusDelay: 160 });
  window.setTimeout(() => {
    if (state.latestVersionId === version.id) {
      state.latestVersionId = null;
      renderResultCards(false);
      queueConnectorUpdateAfterLayout();
    }
  }, 1600);
  if (branch) {
    addAgentMessage(`${version.id} 已基于 ${branch.baseVersionId} 后面的定制节点生成，旧结果已保留。`);
  } else if (options.regeneratedFrom) {
    addAgentMessage(`${version.id} 已根据当前图文配置生成，旧结果已保留。`);
  } else if (version.id === "V1") {
    addAgentMessage("V1 已生成，旧版本已保留。");
  } else {
    addAgentMessage(`${version.id} 已生成，旧结果已保留。`);
  }
}

function showResult(version) {
  setFlowMode("result");
  $("#flowBoard").classList.remove("is-generating-result");
  $("#analysisNode").classList.add("hidden");
  $("#replaceRail").classList.remove("hidden");
  $("#uploadNode").classList.remove("hidden");
  $("#resultPanel").classList.remove("hidden");
  state.resultPromptDirty = false;
  if (version.params) state.resultParams = { ...version.params };
  renderResultCards(false);
  queueConnectorUpdateAfterLayout();
}

function regenerateFromPrompt() {
  if (!state.currentVersion) return;
  const previousId = state.currentVersion.id;
  const prompt = $("#resultPrompt").value.trim() || buildGenerationDescription();
  state.currentBase = "上传替换与定制";
  $("#baseChip").textContent = `当前配置：${state.currentBase}`;
  addAgentMessage(`正在根据当前图文配置生成新版本，${previousId} 会保留。`);
  showGeneratingResult(prompt);
  window.setTimeout(() => {
    createVersion({ prompt,
      adjustmentText,
      regeneratedFrom: previousId });
  }, 900);
}

function reviseAfterResult() {
  resetRootCustomizationToOriginal();
  state.currentBase = "上传替换与定制";
  $("#sourceLine").textContent = "选择要替换的内容，未修改的部分会保留原样。";
  $("#baseChip").textContent = "当前阶段：基于原始参考重新改造";
  setFlowMode("result");
  $("#replaceRail").classList.remove("hidden");
  $("#resultPanel").classList.remove("hidden");
  showReviseNotice();
  renderCustomItems();
  refreshResultDescriptionFromItems(true);
  renderResultCards(false);
  queueConnectorUpdateAfterLayout();
  focusAndHighlight("#reviseNotice", 100, { anchorY: 0.36, forceMotion: true, highlightTarget: "#replaceRail" });
  addAgentMessage("已回到上传替换与定制，并清空本次修改。你可以重新选择素材或修改文案后再生成，旧结果会保留。");
}

function reviseVersion(versionId) {
  const version = state.versions.find((entry) => entry.id === versionId);
  if (!version) return;
  if (!version.branchId) {
    reviseAfterResult();
    return;
  }

  const config = state.branchConfigs.find((entry) => entry.id === version.branchId);
  if (!config) return;
  config.baseParams = { ...resultParamDefaults, ...(version.params || {}) };
  config.params = getNextParamsFromVersion(version);
  config.prompt = version.prompt || buildGenerationDescription();
  clearBranchConfigForRevise(config);
  state.latestBranchId = config.id;
  setFlowMode("result");
  const cleanTitle = (config.title || "上传替换与定制").replace(/0[0-9]+$/, "");
$("#baseChip").textContent = `当前阶段：${cleanTitle}`;
  $("#resultPanel").classList.remove("hidden");
  renderResultCards(false);
  queueConnectorUpdateAfterLayout();
  focusAndHighlight(`#branch-${config.id} .branch-top-notice`, 100, { anchorY: 0.36, forceMotion: true, highlightTarget: `#branch-${config.id}` });
  addAgentMessage(`已回到${config.title || "当前定制节点"}，并清空本次修改。你可以重新选择素材或修改文案后再生成，${version.id} 会保留。`);
  window.clearTimeout(config.reviseTimer);
  config.reviseTimer = window.setTimeout(() => {
    config.spotlight = false;
    state.latestBranchId = null;
    renderResultCards(false);
    queueConnectorUpdateAfterLayout();
  }, 1500);
}

function clearBranchConfigForRevise(config) {
  (config.items || []).forEach((item) => {
    item.current = item.original;
    item.changed = false;
    item.previewUrl = item.originalPreviewUrl || customPreviewImages[item.id];
  });
  config.openPickerId = null;
  config.confirming = false;
  config.hint = "已回到当前定制节点，请重新选择素材或修改文案后再生成。";
  config.revising = true;
  config.spotlight = true;
}

function createBranchConfig(versionId) {
  const version = state.versions.find((entry) => entry.id === versionId);
  if (!version) return;
  let config = state.branchConfigs.find((entry) => entry.baseVersionId === versionId);
  const isNewConfig = !config;
  if (!config) {
    const branchTitle = "上传替换与定制";
    config = {
      id: `from-${versionId}`,
      baseVersionId: versionId,
      title: branchTitle,
      analysisStatus: "analyzing",
      items: state.customItems.map((item) => ({
        ...item,
        current: item.original,
        changed: false,
        previewUrl: customPreviewImages[item.id],
        originalPreviewUrl: customPreviewImages[item.id],
      })),
      prompt: version.prompt || buildGenerationDescription(),
      baseParams: { ...resultParamDefaults, ...(version.params || {}) },
      params: getNextParamsFromVersion(version),
      hint: "",
      revising: false,
      spotlight: false,
    };
    state.branchConfigs.push(config);
  } else {
    config.analysisStatus = config.analysisStatus || "done";
    config.baseParams = { ...resultParamDefaults, ...(version.params || {}) };
    config.params = getNextParamsFromVersion(version);
    config.hint = config.analysisStatus === "done" ? `已基于 ${versionId} 视频拆解生成新的定制节点，请继续替换素材或修改文案。` : "";
  }
  state.latestBranchId = config.id;
  setFlowMode("result");
  $("#baseChip").textContent = `当前阶段：基于 ${versionId} 重新定制`;
  $("#resultPanel").classList.remove("hidden");
  renderResultCards(false);
  createFlowNode({ node: `#branch-analysis-${config.id}`, sourceNodeId: `result-${versionId}`, focusDelay: 100 });
  if (config.analysisStatus === "done") addFlowEdge(`branch-analysis-${config.id}`, `branch-${config.id}`);
  addAgentMessage(
    config.analysisStatus === "done"
      ? `已定位到 ${versionId} 后面的上传替换与定制节点。`
      : `正在拆解 ${versionId} 视频，完成后会生成新的上传替换与定制节点。`,
  );
  if (!isNewConfig || config.analysisStatus === "done") {
    config.spotlight = true;
    window.setTimeout(() => {
      renderResultCards(false);
      createFlowNode({
        node: `#branch-${config.id}`,
        sourceNodeId: `branch-analysis-${config.id}`,
        focusDelay: 80,
        focusOptions: { anchorY: 0.36 },
        highlightTarget: `#branch-${config.id}`,
      });
      focusAndHighlight(`#branch-${config.id} .branch-top-notice`, 80, { anchorY: 0.36, highlightTarget: `#branch-${config.id}` });
    }, 560);
  }
  if (isNewConfig && config.analysisStatus !== "done") {
    window.setTimeout(() => {
      config.analysisStatus = "done";
      config.hint = `已基于 ${versionId} 视频拆解生成新的定制节点，请继续替换素材或修改文案。`;
      config.spotlight = true;
      renderResultCards(false);
      createFlowNode({
        node: `#branch-${config.id}`,
        sourceNodeId: `branch-analysis-${config.id}`,
        focusDelay: 140,
        focusOptions: { anchorY: 0.36 },
        highlightTarget: `#branch-${config.id}`,
      });
      focusAndHighlight(`#branch-${config.id} .branch-top-notice`, 140, { anchorY: 0.36, highlightTarget: `#branch-${config.id}` });
      addAgentMessage(`${versionId} 视频拆解完成，已生成新的上传替换与定制节点。`);
    }, 1100);
  }
  window.setTimeout(() => {
    config.spotlight = false;
    state.latestBranchId = null;
    renderResultCards(false);
    queueConnectorUpdateAfterLayout();
  }, 2600);
}

function updateBranchConfig(id, type, itemId = "") {
  const config = state.branchConfigs.find((entry) => entry.id === id);
  if (!config) return;
  const item = (config.items || []).find((entry) => entry.id === itemId);
  if (!item) return;
  if (type === "copy") {
    item.current = "已修改";
  } else {
    item.current = `${item.title}素材.png`;
  }
  item.changed = true;
  config.hint = "";
  config.revising = false;
  renderResultCards(false);
  queueConnectorUpdateAfterLayout();
}

function toggleBranchPicker(id, itemId) {
  const config = state.branchConfigs.find((entry) => entry.id === id);
  if (!config) return;
  state.activeBranchId = id;
  state.activeItemId = itemId;
  config.openPickerId = config.openPickerId === itemId ? null : itemId;
  config.confirming = false;
  renderResultCards(false);
  queueConnectorUpdateAfterLayout();
}

function restoreBranchItem(id, itemId) {
  const config = state.branchConfigs.find((entry) => entry.id === id);
  if (!config) return;
  const item = (config.items || []).find((entry) => entry.id === itemId);
  if (!item) return;
  item.current = item.original;
  item.changed = false;
  item.previewUrl = item.originalPreviewUrl || customPreviewImages[item.id];
  config.hint = "";
  config.revising = false;
  config.spotlight = false;
  renderResultCards(false);
  queueConnectorUpdateAfterLayout();
  addAgentMessage(`已将${item.title}恢复为原始内容。`);
}

function resetBranchCustomization(id) {
  const config = state.branchConfigs.find((entry) => entry.id === id);
  if (!config) return;
  (config.items || []).forEach((item) => {
    item.current = item.original;
    item.changed = false;
    item.previewUrl = item.originalPreviewUrl || customPreviewImages[item.id];
  });
  config.openPickerId = null;
  config.confirming = false;
  config.hint = "已清空当前改造内容，请重新选择素材或修改文案。";
  config.revising = true;
  config.spotlight = true;
  renderResultCards(false);
  queueConnectorUpdateAfterLayout();
  addAgentMessage(`${config.title || "上传替换与定制"} 已清空当前改造内容，可以重新开始。`);
}

function generateFromBranch(id) {
  const promptInput = document.querySelector("#customAdjustmentInput");
  const adjustmentText = promptInput?.value?.trim() || "";

  const changedItems = getChangedItems();
  const description = buildGenerationDescriptionWithAdjustment(
    changedItems,
    adjustmentText
  );

  showGeneratingResult(description);

  window.setTimeout(() => {
    createVersion({
      prompt: description,
      adjustmentText
    });
  }, 900);
}

function syncNaturalLanguageIntent(text) {
  const normalized = text.trim();
  if (!normalized) return;
  const sceneItem = state.customItems.find((item) => item.id === "scene");
  const heroItem = state.customItems.find((item) => item.id === "hero1");
  if (/主体|人物|照片|我刚上传|只换人/.test(normalized) && heroItem) {
    heroItem.current = normalized.includes("照片") ? "我刚上传的照片" : "按描述替换主体";
    heroItem.changed = true;
    state.openPickerId = null;
    renderCustomItems();
    refreshResultDescriptionFromItems(true);
    addAgentMessage("收到，我已将主体替换方向记录到画布里，你可以确认后生成。");
    return;
  }
  if (/场景|球场|餐厅|街角|背景/.test(normalized) && sceneItem) {
    sceneItem.current = normalized.includes("球场") ? "球场" : "按描述调整场景";
    sceneItem.changed = true;
    state.openPickerId = null;
    renderCustomItems();
    refreshResultDescriptionFromItems(true);
    addAgentMessage("收到，我已把场景替换方向设为球场，你可以在画布里确认后生成。");
    return;
  }
  addAgentMessage("收到，我会把这个复刻方向作为补充说明，你可以在画布里确认后生成。");
}

function renderVersions() {
  $("#versionList").innerHTML = state.versions.length
    ? state.versions
        .map(
          (version) => `
            <article class="version-item">
              <div>
                <strong>${version.id} ${version.name}</strong>
                <p>配置来源：${version.base}</p>
                <p>修改：${version.summary.join("；")}</p>
                <p>生成描述：${version.prompt}</p>
                <p>生成规格：${version.specs}</p>
                <p>${version.time}　消耗：${version.cost}</p>
              </div>
              <div class="item-actions">
                <button data-version-action="view" data-version="${version.id}">查看</button>
                <button data-version-action="continue" data-version="${version.id}">基于此版本修改</button>
                <button data-version-action="export" data-version="${version.id}">导出</button>
              </div>
            </article>
          `,
        )
        .join("")
    : `<p>生成后会在这里看到版本记录。</p>`;
}

function chooseVersion(versionId, shouldContinue) {
  const version = state.versions.find((entry) => entry.id === versionId);
  if (!version) return;
  state.currentVersion = version;
  resetCustomItems(version);
  closeModal("versionsModal");
  if (shouldContinue) {
    createBranchConfig(versionId);
  } else {
    state.currentBase = version.base;
    $("#baseChip").textContent = `当前配置：${version.base}`;
    showResult(version);
  }
}

function bindEvents() {
  $("#labEntry").addEventListener("click", () => showPage("lab"));
  $("#labEntry").addEventListener("keydown", (event) => {
    if (event.key === "Enter") showPage("lab");
  });
  $("#backHome").addEventListener("click", () => showPage("home"));
  $("#uploadNode").addEventListener("click", () => {
    if (state.suppressUploadClick) return;
    $("#videoInput").click();
  });
  $("#sourceStatus").addEventListener("click", (event) => {
    event.stopPropagation();
    if (!state.analyzed) {
      showActionFeedback("视频拆解完成后可查看拆解详情");
      return;
    }
    openBreakdownDetails();
  });
  $("#videoInput").addEventListener("change", (event) => handleVideoUpload(event.target.files[0]));

  $("#flowBoard").addEventListener("pointerdown", startNodeDrag);
  document.addEventListener("pointermove", moveNodeDrag);
  document.addEventListener("pointerup", endNodeDrag);
  document.addEventListener("pointercancel", endNodeDrag);

  ["dragenter", "dragover"].forEach((type) => {
    $("#uploadNode").addEventListener(type, (event) => {
      event.preventDefault();
      $("#uploadNode").classList.add("dragging");
    });
  });
  ["dragleave", "drop"].forEach((type) => {
    $("#uploadNode").addEventListener(type, (event) => {
      event.preventDefault();
      $("#uploadNode").classList.remove("dragging");
    });
  });
  $("#uploadNode").addEventListener("drop", (event) => handleVideoUpload(event.dataTransfer.files[0]));

  $("#inspirationGrid").addEventListener("click", (event) => {
    const card = event.target.closest(".inspiration-card");
    if (!card) return;
    const item = inspirationItems[Number(card.dataset.index)];
    selectInspiration(item, card);
  });
  $("#inspirationGrid").addEventListener("pointerover", (event) => {
    const card = event.target.closest(".inspiration-card");
    const video = card?.querySelector("video");
    if (!video) return;
    video.currentTime = 0;
    video.play().catch(() => {});
  });
  $("#inspirationGrid").addEventListener("pointerout", (event) => {
    const card = event.target.closest(".inspiration-card");
    if (!card || card.contains(event.relatedTarget)) return;
    const video = card.querySelector("video");
    if (!video) return;
    video.pause();
    video.currentTime = 0;
  });

  $("#agentMessages").addEventListener("click", (event) => {
    if (event.target.closest("[data-open-breakdown]")) {
      openBreakdownDetails();
      return;
    }
    const generateButton = event.target.closest("[data-generate-action]");
    if (!generateButton) return;
    const card = generateButton.closest(".agent-generate-card");
    handleGenerateAction(generateButton, card);
  });

  $("#canvasGenerateConfirm").addEventListener("click", (event) => {
    const generateButton = event.target.closest("[data-generate-action]");
    if (!generateButton) return;
    handleGenerateAction(generateButton, $("#canvasGenerateConfirm"));
  });

  const flowBreakdownStatus = $("#flowBreakdownStatus");
  flowBreakdownStatus?.addEventListener("click", () => {
    if (flowBreakdownStatus.disabled) return;
    openBreakdownDetails();
  });

  $("#customItems").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    event.stopPropagation();
    const { action, id } = button.dataset;
    if (action === "replace") {
      softenReviseNotice();
      const item = state.customItems.find((entry) => entry.id === id);
      state.activeItemId = id;
      state.activeBranchId = null;
      if (item?.group === "字幕 / 文案") {
        state.activeTextEditorId = null;
        state.openPickerId = null;
        state.activeAudioLinkId = null;
        openCopyEditor(id);
        return;
      }
      state.activeTextEditorId = null;
      state.activeAudioLinkId = null;
      state.openPickerId = state.openPickerId === id ? null : id;
      renderCustomItems();
      if (state.openPickerId) {
        showActionFeedback(`已选择${item?.title || "当前项"}，请选择上传新素材或资产库`);
        if (item?.group === "主体") addAgentMessage(`你正在替换${item.title}，可以上传图片或从资产中选择。`);
      }
    }
    if (action === "quick-asset") pickInlineAsset(id, button.dataset.source);
    if (action === "restore") restoreItem(id);
    if (action === "copy-save") saveCopyEdit(id, button.closest(".copy-editor"));
    if (action === "copy-cancel") cancelCopyEdit();
    if (action === "copy-restore-original") restoreOriginalCaption();
    if (action === "audio-preview") {
      state.playingAudioId = state.playingAudioId === id ? null : id;
      renderCustomItems();
    }
  });

  $("#replaceRail").addEventListener("click", (event) => {
    event.stopPropagation();
    const button = event.target.closest("[data-rail-replace]");
    if (button) {
      state.openPickerId = button.dataset.railReplace;
      renderCustomItems();
    }
  });

  $("#resultMeta")?.addEventListener("click", (event) => {
    event.stopPropagation();
    const qualityChoice = event.target.closest("[data-quality-param-choice]");
    if (qualityChoice) {
      applyResultParamValue("quality", qualityChoice.dataset.value);
      state.openQualityParam = null;
      renderResultParams();
      return;
    }
    const pill = event.target.closest("[data-result-param]");
    if (!pill) return;
    const key = pill.dataset.resultParam;
    if (key === "quality") {
      state.openQualityParam = state.openQualityParam === "root:quality" ? null : "root:quality";
      renderResultParams();
      return;
    }
    state.openQualityParam = null;
    openResultParamModal(key);
  });

  document.addEventListener("click", () => {
    const hasBranchPicker = state.branchConfigs.some((config) => config.openPickerId);
    if (!state.openPickerId && !state.activeAudioLinkId && !state.openQualityParam && !hasBranchPicker) return;
    state.openPickerId = null;
    state.activeAudioLinkId = null;
    state.openQualityParam = null;
    state.branchConfigs.forEach((config) => {
      config.openPickerId = null;
    });
    renderCustomItems();
    renderResultParams();
    if (!$("#resultPanel").classList.contains("hidden")) renderResultCards($("#resultPanel .result-card.is-generating") !== null);
  });

  document.addEventListener("keydown", (event) => {
    const hasBranchPicker = state.branchConfigs.some((config) => config.openPickerId);
    if (event.key !== "Escape" || (!state.openPickerId && !state.activeTextEditorId && !state.activeAudioLinkId && !state.openQualityParam && !hasBranchPicker)) return;
    state.openPickerId = null;
    state.activeTextEditorId = null;
    state.activeAudioLinkId = null;
    state.openQualityParam = null;
    state.branchConfigs.forEach((config) => {
      config.openPickerId = null;
    });
    renderCustomItems();
    renderResultParams();
    if (!$("#resultPanel").classList.contains("hidden")) renderResultCards($("#resultPanel .result-card.is-generating") !== null);
  });

  $("#generateBtn").addEventListener("click", openGenerateConfirm);
  $("#assetModal").addEventListener("click", (event) => {
    event.stopPropagation();
    const closeButton = event.target.closest("[data-close]");
    if (closeButton) {
      closeModal(closeButton.dataset.close);
      return;
    }
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const activeBranch = state.activeBranchId ? state.branchConfigs.find((entry) => entry.id === state.activeBranchId) : null;
    const item = activeBranch
      ? activeBranch.items.find((entry) => entry.id === state.activeItemId)
      : state.customItems.find((entry) => entry.id === state.activeItemId);
    if (!item) return;
    if (button.dataset.action === "asset-upload-pick") {
  triggerLocalAssetUpload(item);
  return;
}
    if (button.dataset.action === "asset-use") {
      const assets = assetLibraryGroups[item.group] || [];
      const asset = assets[Number(button.dataset.index)];
      if (!asset) return;
      button.classList.add("is-selected");
      window.setTimeout(() => applyAsset(asset.name, asset.previewUrl), 300);
    }
  });
  $("#subtitleModal").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const { action } = button.dataset;
    if (action === "subtitle-save") saveSubtitleModal();
    if (action === "subtitle-cancel") {
      state.activeCopyModalId = null;
      state.activeCopyBranchId = null;
      closeModal("subtitleModal");
    }
    if (action === "subtitle-restore") restoreSubtitleModalDraft();
  });
  $("#paramModal").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const { action } = button.dataset;
    if (action === "param-select") {
      state.activeResultParamDraft = button.dataset.value;
      if (state.activeResultParamKey === "duration") {
        state.activeResultTimeStart = clampTimeStart(state.activeResultParamDraft, state.activeResultTimeStart);
      }
      renderResultParamModal();
      return;
    }
    if (action === "param-time-preset") {
      state.activeResultTimeStart = clampTimeStart(state.activeResultParamDraft, button.dataset.start);
      renderResultParamModal();
      return;
    }
    if (action === "param-cancel") {
      closeResultParamModal();
      return;
    }
    if (action === "param-save") {
      saveResultParamModal();
    }
  });
  $("#paramModal").addEventListener("input", (event) => {
    const input = event.target.closest('[data-action="param-time-start"]');
    if (!input) return;
    state.activeResultTimeStart = clampTimeStart(state.activeResultParamDraft, input.value);
    renderResultParamModal();
  });
  $("#resultPanel").addEventListener("click", (event) => {
    const qualityChoice = event.target.closest("[data-quality-param-choice]");
    if (qualityChoice) {
      event.stopPropagation();
      const wrap = qualityChoice.closest(".result-param-wrap");
      const versionId = wrap?.querySelector("[data-version]")?.dataset.version || qualityChoice.closest(".result-card")?.dataset.version || null;
      applyResultParamValue("quality", qualityChoice.dataset.value, versionId === "生成中" ? null : versionId);
      state.openQualityParam = null;
      renderResultCards($("#resultPanel .result-card.is-generating") !== null);
      queueConnectorUpdateAfterLayout();
      return;
    }
    const pill = event.target.closest("[data-result-param]");
    if (pill) {
      event.stopPropagation();
      const versionId = pill.dataset.version || pill.closest(".result-card")?.dataset.version || null;
      const key = pill.dataset.resultParam;
      const safeVersionId = versionId === "生成中" ? null : versionId;
      if (key === "quality") {
        const menuKey = `${safeVersionId || "root"}:quality`;
        state.openQualityParam = state.openQualityParam === menuKey ? null : menuKey;
        renderResultCards($("#resultPanel .result-card.is-generating") !== null);
        queueConnectorUpdateAfterLayout();
        return;
      }
      state.openQualityParam = null;
      openResultParamModal(key, safeVersionId);
      return;
    }
    const button = event.target.closest("[data-result-action]");
    if (!button) return;
    const versionId = button.dataset.version;
    if (button.dataset.resultAction === "export") {
  const version = state.versions.find((entry) => entry.id === versionId);

  if (!version?.videoUrl) {
    showResultNotice("当前视频还没有生成完成，请稍后再导出。");
    return;
  }

  const link = document.createElement("a");
  link.href = version.videoUrl;
  link.download = `${version.id}-爆款实验室生成视频.mp4`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  showResultNotice("视频已开始下载。");
  return;
}
    if (button.dataset.resultAction === "save") {
      showResultNotice("视频已保存至资产库，后续可在资产库中继续使用。");
      return;
    }
    if (button.dataset.resultAction === "breakdown") {
      openBreakdownDetails(versionId);
    }
    if (button.dataset.resultAction === "revise") {
      reviseVersion(versionId);
    }
  });
  $("#resultPanel").addEventListener("input", (event) => {
    const resultPrompt = event.target.closest("[data-result-prompt]");
    if (resultPrompt) {
      const version = state.versions.find((entry) => entry.id === resultPrompt.dataset.resultPrompt);
      if (version) {
        version.prompt = resultPrompt.value;
      }
    }
    const textarea = event.target.closest("[data-branch-prompt]");
    if (!textarea) return;
    const config = state.branchConfigs.find((entry) => entry.id === textarea.dataset.branchPrompt);
    if (config) config.prompt = textarea.value;
  });
  $("#resultPanel").addEventListener("click", (event) => {
    const button = event.target.closest("[data-branch-action]");
    if (!button) return;
    event.stopPropagation();
    const id = button.dataset.branchId;
    if (button.dataset.branchAction === "replace") {
  const config = state.branchConfigs.find((entry) => entry.id === id);
  const item = config?.items?.find((entry) => entry.id === button.dataset.branchItem);

  state.activeBranchId = id;
  state.activeItemId = button.dataset.branchItem;

  openAssetModalForItem(item, config);

  return;
}
    if (button.dataset.branchAction === "quick-asset") pickInlineAsset(button.dataset.branchItem, button.dataset.source, id);
    if (button.dataset.branchAction === "copy") openBranchCopyEditor(id, button.dataset.branchItem);
    if (button.dataset.branchAction === "restore") restoreBranchItem(id, button.dataset.branchItem);
if (button.dataset.branchAction === "generate") {
  generateFromBranch(id);
  return;
}
    if (button.dataset.branchAction === "cancel-generate") {
      const config = state.branchConfigs.find((entry) => entry.id === id);
      if (config) config.confirming = false;
      renderResultCards(false);
      queueConnectorUpdateAfterLayout();
    }
    if (button.dataset.branchAction === "confirm-generate") {
  const card =
    button.closest(".branch-config-card") ||
    button.closest(".custom-panel") ||
    document.querySelector("#replaceRail") ||
    document.querySelector("#customItems")?.closest("section");

  handleGenerateAction(button, card);
  return;
}
    if (button.dataset.branchAction === "breakdown") {
      const config = state.branchConfigs.find((entry) => entry.id === id);
      openBreakdownDetails(config?.baseVersionId || "");
    }
  });
  $("#regenerateVersion")?.addEventListener("click", regenerateFromPrompt);
  $("#confirmGenerate").addEventListener("click", async () => {
  if ($("#confirmGenerate").disabled) return;

  $("#confirmGenerate").disabled = true;
  $("#confirmGenerate").textContent = "生成中";

  try {
    await createVersion();
    closeModal("confirmModal");
  } catch (error) {
    console.error(error);
  } finally {
    $("#confirmGenerate").disabled = false;
    $("#confirmGenerate").textContent = "确认生成";
  }
});
  $("#continueEmpty").addEventListener("click", () => {
    closeModal("emptyModal");
    createVersion();
  });
  $("#openVersions")?.addEventListener("click", () => {
    renderVersions();
    openModal("versionsModal");
  });
  $("#versionList").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-version-action]");
    if (!button) return;
    if (button.dataset.versionAction === "export") {
      showActionFeedback("导出功能暂未接入，当前阶段先支持结果预览");
      return;
    }
    chooseVersion(button.dataset.version, button.dataset.versionAction === "continue");
  });
  $(".agent-input input").addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    if (!event.currentTarget.value.trim()) {
      showActionFeedback("请输入你想补充的效果描述");
      return;
    }
    syncNaturalLanguageIntent(event.currentTarget.value);
    event.currentTarget.value = "";
  });
  $("#resultPrompt")?.addEventListener("input", () => {
    state.resultPromptDirty = true;
  });
  $(".send-button").addEventListener("click", () => {
    const input = $(".agent-input input");
    if (!input.value.trim()) {
      showActionFeedback("请输入你想补充的效果描述");
      return;
    }
    syncNaturalLanguageIntent(input.value);
    input.value = "";
  });
  $(".plus-button").addEventListener("click", () => {
    $("#videoInput").click();
  });
  $$(".text-action").forEach((button) => {
    button.addEventListener("click", () => showActionFeedback("该功能将在后续接入真实能力后开放"));
  });
  $$(".rhtv-nav button, .rhtv-actions button, .go-button").forEach((button) => {
    button.addEventListener("click", () => showActionFeedback("该功能将在后续接入真实能力后开放"));
  });
  $$(".leftbar .tool").forEach((button) => {
    button.addEventListener("click", () => {
      const label = button.title || button.textContent.trim() || "该工具";
      showActionFeedback(button.classList.contains("active") ? `${label}已在当前画布中` : `${label}功能将在后续接入真实能力后开放`);
    });
  });
  $$(".bottom-controls button").forEach((button) => {
    button.addEventListener("click", () => showActionFeedback("该画布工具将在后续接入真实能力后开放"));
  });
  $("#breakdownModal").addEventListener("click", (event) => {
    if (!event.target.closest(".shot-play")) return;
    event.stopPropagation();
    showActionFeedback("镜头预览播放能力暂未接入，当前阶段先支持拆解查看");
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button || button.disabled) return;
    if (button.closest("#labEntry, #customItems, #replaceRail, #assetModal, #subtitleModal, #resultPanel, #agentMessages, #canvasGenerateConfirm, #versionList, .rhtv-nav, .rhtv-actions, .leftbar, .bottom-controls")) return;
    if (
      button.matches(
        "[data-close], [data-action], [data-result-action], [data-result-param], [data-branch-action], [data-generate-action], [data-version-action], #backHome, #sourceStatus, #generateBtn, #confirmGenerate, #continueEmpty, #openVersions, .send-button, .plus-button, .text-action, .tool, .go-button, .watermark",
      )
    ) {
      return;
    }
    showActionFeedback("该功能将在后续接入真实能力后开放");
  });
  $$("[data-close]").forEach((button) => button.addEventListener("click", () => closeModal(button.dataset.close)));
}

renderInspirations();
renderCustomItems();
bindEvents();
window.addEventListener("resize", queueConnectorUpdate);
window.addEventListener("load", queueConnectorUpdate);
queueConnectorUpdate();
function debugDone() {
  const cachedBreakdown = localStorage.getItem("rh_debug_breakdownData");
  const cachedCustomItems = localStorage.getItem("rh_debug_customItems");

  if (cachedBreakdown && cachedBreakdown !== "null") {
    state.breakdownData = JSON.parse(cachedBreakdown);
  }

  if (cachedCustomItems && cachedCustomItems !== "[]") {
    state.customItems = JSON.parse(cachedCustomItems);
  } else if (state.breakdownData) {
    applyBreakdownToCustomItems(state.breakdownData);
  }

  const cachedVideoTitle = localStorage.getItem("rh_debug_uploadedVideo") || "调试参考视频.mp4";
  const cachedCoverUrl = localStorage.getItem("rh_debug_uploadedVideoCoverUrl") || state.uploadedVideoCoverUrl || "";

  state.uploadedVideo = cachedVideoTitle;
  state.uploadedVideoCoverUrl = cachedCoverUrl;
  state.analyzing = false;
  state.analyzed = true;
  state.flowStatus = "resultReady";

  if (!state.customItems || !state.customItems.length) {
    showActionFeedback("没有可用的拆解缓存，请先完整跑一次拆解。");
    return;
  }

  const version = {
    id: "V1",
    videoUrl: "/generated/result.mp4",
    coverUrl: cachedCoverUrl,
    ratio: "9:16",
    duration: "18s",
    clarity: "720P",
    prompt: buildGenerationDescription(getChangedItems()),
    isGenerating: false,
    changes: getChangedItems(),
    createdAt: new Date().toISOString()
  };

  state.versions = [version];
  state.currentVersionId = "V1";

  setFlowMode("result");

  if (typeof showSelectedSource === "function") {
    showSelectedSource({
      title: cachedVideoTitle,
      coverUrl: cachedCoverUrl,
      duration: "00:18",
      ratio: "9:16",
      size: "缓存视频"
    });
  }

  renderCustomItems();
  showResult(version);

  showActionFeedback("已恢复到完整生成结果页，可继续测试重新改造。");
}


function getSafeVideoTitle(value) {
  if (typeof value === "string") return value;
  if (value?.name) return value.name;
  if (value?.title) return value.title;
  return "缓存参考视频.mp4";
}

function saveV1Snapshot() {
  try {
    const currentVersion =
      state.versions?.find((entry) => entry.id === state.currentVersionId) ||
      state.versions?.[0];

    if (!currentVersion || !currentVersion.videoUrl) {
      console.warn("[debug] 当前没有真实生成完成的视频，不保存 V1 快照。");
      showActionFeedback?.("当前没有真实生成完成的视频，不保存快照。");
      return;
    }

    const snapshot = {
      savedAt: new Date().toISOString(),

      uploadedVideo: getSafeVideoTitle(state.uploadedVideo),
      uploadedVideoCoverUrl: state.uploadedVideoCoverUrl || "",
      uploadedVideoObjectUrl: state.uploadedVideoObjectUrl || "",

      breakdownData: state.breakdownData || null,
      customItems: state.customItems || [],

      versions: state.versions || [],
      currentVersionId: state.currentVersionId || currentVersion.id,

      flowStatus: state.flowStatus || "resultReady",
      analyzed: true,
      analyzing: false,

      resultParams: state.resultParams || null,
      generationDuration: state.generationDuration || null,
      generationRatio: state.generationRatio || null,
      generationClarity: state.generationClarity || null
    };

    localStorage.setItem(DEBUG_V1_SNAPSHOT_KEY, JSON.stringify(snapshot));

    console.log("[debug] V1 完整快照已保存：", snapshot);
    showActionFeedback?.("V1 完整快照已保存。");
  } catch (error) {
    console.error("[debug] 保存 V1 快照失败", error);
    showActionFeedback?.("保存 V1 快照失败。");
  }
}

function restoreV1Snapshot() {
  const raw = localStorage.getItem(DEBUG_V1_SNAPSHOT_KEY);

  if (!raw) {
    showActionFeedback?.("没有 V1 快照，请先真实生成一次视频后执行 saveV1Snapshot()。");
    console.warn("[debug] 没有 V1 快照");
    return;
  }

  try {
    const snapshot = JSON.parse(raw);

    if (!snapshot.versions?.length) {
      showActionFeedback?.("V1 快照里没有生成结果。");
      console.warn("[debug] V1 快照缺少 versions", snapshot);
      return;
    }

    const currentVersion =
      snapshot.versions.find((entry) => entry.id === snapshot.currentVersionId) ||
      snapshot.versions[0];

    if (!currentVersion?.videoUrl) {
      showActionFeedback?.("V1 快照里没有真实视频地址。");
      console.warn("[debug] V1 快照缺少 videoUrl", snapshot);
      return;
    }

    state.uploadedVideo = snapshot.uploadedVideo || "缓存参考视频.mp4";
    state.uploadedVideoCoverUrl = snapshot.uploadedVideoCoverUrl || "";
    state.uploadedVideoObjectUrl = snapshot.uploadedVideoObjectUrl || "";

    state.breakdownData = snapshot.breakdownData || null;
    state.customItems = snapshot.customItems || [];

    state.versions = snapshot.versions || [];
    state.currentVersionId = snapshot.currentVersionId || currentVersion.id;

    state.flowStatus = "resultReady";
    state.analyzing = false;
    state.analyzed = true;

    if (snapshot.resultParams) state.resultParams = snapshot.resultParams;
    if (snapshot.generationDuration) state.generationDuration = snapshot.generationDuration;
    if (snapshot.generationRatio) state.generationRatio = snapshot.generationRatio;
    if (snapshot.generationClarity) state.generationClarity = snapshot.generationClarity;

    setFlowMode("result");

    if (typeof showSelectedSource === "function") {
      showSelectedSource({
        title: getSafeVideoTitle(snapshot.uploadedVideo),
        coverUrl: snapshot.uploadedVideoCoverUrl || currentVersion.coverUrl || "",
        duration: currentVersion.duration || "00:18",
        ratio: currentVersion.ratio || "9:16",
        size: "缓存视频"
      });
    }

    renderCustomItems();
    showResult(currentVersion);

    console.log("[debug] 已恢复 V1 完整快照：", snapshot);
    showActionFeedback?.("已恢复到真实 V1 生成完成后的状态。");
  } catch (error) {
    console.error("[debug] 恢复 V1 快照失败", error);
    showActionFeedback?.("恢复 V1 快照失败。");
  }
}