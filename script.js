// ========================================
// 给你的一封小情书
// 互动表白网页 JavaScript
// ========================================

// 页面元素
const screens = {
  welcome: document.getElementById("welcomeScreen"),
  question: document.getElementById("questionScreen"),
  letter: document.getElementById("letterScreen"),
  final: document.getElementById("finalScreen")
};

// 表白前那一页要读的信（和 index.html 放在同一个文件夹里）
const LETTER_FILE = "love.txt";

// 读不到 love.txt 时显示的话
const LETTER_FALLBACK = "（这段话还没写完，之后补上。）";

// 点击“我愿意”之后展示的照片：文件名照写，可以放多张
const memoryPhotos = [
  "奶油风海边落日浪漫插画.webp"
];

// 照片所在的文件夹（按顺序尝试，第一个能加载的胜出）
// 现在照片放在和 code/ 平级的 picture/ 里
const PHOTO_DIRS = ["../picture/", "picture/", ""];

const bgm = document.getElementById("bgm");
const bgmLetter = document.getElementById("bgmLetter");
const musicToggle = document.getElementById("musicToggle");
const musicLabel = document.getElementById("musicLabel");

// ========================================
// 背景音乐
// ========================================

// 问答环节轮播的歌（按顺序循环），放在 ../music/ 里
const QUESTION_TRACKS = [
  "one.mp3",
  "two.mp3",
  "three.mp3"
];

// 进入“信”页面之后放的歌
const LETTER_TRACK = "love.mp3";

// 歌曲所在的文件夹（按顺序尝试，第一个能加载的胜出）
// 现在歌曲放在和 code/ 平级的 music/ 里
const MUSIC_DIRS = ["../music/", "music/"];

// 平时听的音量（0 ~ 1）
const MUSIC_VOLUME = 0.6;

// 交叉淡入淡出的时长（毫秒）
const MUSIC_FADE_MS = 1800;

let trackIndex = 0;      // 当前轮播到第几首
let letterMode = false;  // 是否已经换到 love.mp3
let musicOn = true;      // 右上角按钮控制的开关


// 把某个音频的音量在 ms 毫秒内滑到 target。
// 同一个音频如果又发起新的渐变，旧的会立刻让位，避免两个渐变打架
const fadeTokens = new WeakMap();

function fadeAudio(audio, target, ms) {

  const token = {};

  fadeTokens.set(audio, token);

  return new Promise(resolve => {

    const start = audio.volume;

    const steps = Math.max(1, Math.round(ms / 40));

    let step = 0;

    const timer = setInterval(() => {

      // 有更新的渐变接管了这个音频，旧的就此停手
      if (fadeTokens.get(audio) !== token) {

        clearInterval(timer);

        resolve();

        return;

      }

      step += 1;

      const p = Math.min(1, step / steps);

      audio.volume = Math.min(1, Math.max(0, start + (target - start) * p));

      if (p >= 1) {

        clearInterval(timer);

        resolve();

      }

    }, 40);

  });

}


function syncMusicLabel() {

  const playing = (!bgm.paused && !bgm.ended)
    || (!bgmLetter.paused && !bgmLetter.ended);

  musicLabel.textContent = playing ? "暂停" : "音乐";

  musicToggle.setAttribute("aria-pressed", String(playing));

}


// 问答阶段的轮播：一首放完自动切下一首，切歌时轻轻淡入
// 给音频换源：一个目录加载失败就自动试下一个
function setTrackSrc(audio, file) {

  audio.dataset.track = file;

  audio.dataset.dirIndex = "0";

  audio.src = MUSIC_DIRS[0] + file;

}


// 挂上加载失败的自动回退
function attachMusicFallback(audio) {

  audio.addEventListener("error", () => {

    const file = audio.dataset.track;

    if (!file) {

      return;

    }

    const next = Number(audio.dataset.dirIndex || 0) + 1;

    if (next >= MUSIC_DIRS.length) {

      return;

    }

    audio.dataset.dirIndex = String(next);

    audio.src = MUSIC_DIRS[next] + file;

    // 刚才正在播的话，换完源接着播
    if (!audio.paused) {

      audio.play().catch(() => syncMusicLabel());

    }

  });

}

attachMusicFallback(bgm);

attachMusicFallback(bgmLetter);


function playTrack(index, fadeInMs) {

  trackIndex = index;

  setTrackSrc(bgm, QUESTION_TRACKS[index]);

  bgm.loop = false;

  bgm.volume = 0;

  if (!musicOn) {

    return Promise.resolve();

  }

  bgm.play().catch(() => syncMusicLabel());

  return fadeAudio(bgm, MUSIC_VOLUME, fadeInMs)
    .then(syncMusicLabel);

}


// 一首放完，接着放下一首（循环）
bgm.addEventListener("ended", () => {

  if (letterMode || !musicOn) {

    return;

  }

  playTrack((trackIndex + 1) % QUESTION_TRACKS.length, 600);

});


// 进入问答环节：从第一首开始轮播
function startQuestionMusic() {

  letterMode = false;

  musicOn = true;

  bgmLetter.pause();

  playTrack(0, MUSIC_FADE_MS);

}


// 进入“信”页面：正在放的歌淡出，love.mp3 淡入
function enterLetterMusic() {

  letterMode = true;

  const fadeOut = (musicOn && !bgm.paused)
    ? fadeAudio(bgm, 0, MUSIC_FADE_MS).then(() => bgm.pause())
    : Promise.resolve();

  if (!musicOn) {

    return fadeOut;

  }

  setTrackSrc(bgmLetter, LETTER_TRACK);

  bgmLetter.volume = 0;

  bgmLetter.play().catch(() => syncMusicLabel());

  return Promise.all([
    fadeOut,
    fadeAudio(bgmLetter, MUSIC_VOLUME, MUSIC_FADE_MS)
  ]).then(syncMusicLabel);

}


// 回到封面：音乐全部淡出并停下
function stopMusic(fadeMs) {

  return Promise.all([
    bgm.paused ? Promise.resolve() : fadeAudio(bgm, 0, fadeMs),
    bgmLetter.paused ? Promise.resolve() : fadeAudio(bgmLetter, 0, fadeMs)
  ]).then(() => {

    bgm.pause();

    bgmLetter.pause();

    syncMusicLabel();

  });

}


// 右上角按钮：没在放就播放（封面上点它=马上听歌），在放就暂停
musicToggle.addEventListener("click", () => {

  const active = letterMode ? bgmLetter : bgm;

  const playing = active.src && !active.paused && !active.ended;

  if (playing) {

    musicOn = false;

    active.pause();

    musicLabel.textContent = "音乐";

    musicToggle.setAttribute("aria-pressed", "false");

    return;

  }

  musicOn = true;

  if (!active.src) {

    // 故事还没开始就点了音乐：先把问答歌单放起来
    letterMode = false;

    playTrack(0, MUSIC_FADE_MS);

    return;

  }

  active.volume = MUSIC_VOLUME;

  active.play().catch(() => syncMusicLabel());

  musicLabel.textContent = "暂停";

  musicToggle.setAttribute("aria-pressed", "true");

});

// ========================================
// 问题和剧情分支
// ========================================

// 开场铺垫：这 9 个问题排在表白之前，
// 像聊天一样先让两个人慢慢熟悉、说点真心话。
// 顺序即展示顺序；最后一个会自动接到 q1。

const warmupQuestions = [

  {
    title: "对你来说，怎样才算是“完美”的一天？",
    subtitle: "不用急着回答，凭第一感觉说说看。",
    answer: "说好了，继续 →",
    symbol: "☼"
  },

  {
    title: "有什么事想做很久了？还没去做的原因是？",
    subtitle: "也许只是件很小的事。",
    answer: "说完了，继续 →",
    symbol: "✧"
  },

  {
    title: "列举 3 个我们共同拥有的特质。",
    subtitle: "慢慢想，三个就好。",
    answer: "三个都说完了 →",
    symbol: "♡"
  },

  {
    title: "我做过哪件事让你很生气？",
    subtitle: "不用客气，说真的就好。",
    answer: "说出来了，继续 →",
    symbol: "☁"
  },

  {
    title: "用 4 分钟，尽可能详细地讲讲你的人生故事。",
    subtitle: "慢慢讲，我在这里听着。想停的时候，点一下就好。",
    answer: "讲完了，继续 →",
    symbol: "✿"
  },

  {
    title: "有什么事是绝对不能开玩笑的？",
    subtitle: "认真想一想，再说给我听。",
    answer: "想清楚了，继续 →",
    symbol: "✦"
  },

  {
    title: "说出 3 个含有“我们”、并且符合实际情况的句子。",
    subtitle: "比如“我们现在都在这个房间里”。",
    answer: "说满三个了 →",
    symbol: "☕"
  },

  {
    title: "告诉我，你喜欢我什么地方？",
    subtitle: "这题必须非常诚实：要说出你可能不会对刚认识的人说的事。",
    answer: "说完了，继续 →",
    symbol: "♡"
  },

  {
    title: "上次在别人面前哭是什么时候？一个人哭又是什么时候？",
    subtitle: "这里没有标准答案，只有你的答案。",
    answer: "说完了，继续 →",
    symbol: "☂"
  }

];


// 把开场问题按顺序串成一条线，最后一题指向 q1
const story = {};

warmupQuestions.forEach((item, index) => {

  const key = `warm${index + 1}`;

  story[key] = {
    number: index + 1,

    title: item.title,

    subtitle: item.subtitle,

    answers: [
      {
        text: item.answer,
        symbol: item.symbol,
        next: index === warmupQuestions.length - 1 ? "q1" : `warm${index + 2}`
      }
    ]
  };

});


// 开场问题之后的原有剧情
Object.assign(story, {

  // 一起去哪里
  q1: {
    number: warmupQuestions.length + 1,

    title: "如果今天可以和我一起去一个地方，你会选哪里？",

    subtitle: "不用想太久，凭第一感觉就好。",

    answers: [
      {
        text: "去海边看一场温柔的日落",
        symbol: "☼",
        next: "beach"
      },

      {
        text: "去游乐园，把快乐装满一天",
        symbol: "✧",
        next: "park"
      },

      {
        text: "找一家小店，慢慢喝咖啡聊天",
        symbol: "☕",
        next: "cafe"
      }
    ]
  },


  // 海边剧情
  beach: {
    number: warmupQuestions.length + 2,

    title: "海风轻轻吹着，你想对我说什么？",

    subtitle: "想象一下那片橘色的天空。",

    answers: [
      {
        text: "希望这样的日落以后还有很多次",
        symbol: "♡",
        next: "q3"
      },

      {
        text: "今天的风景很好，但你更好看",
        symbol: "✿",
        next: "q3"
      }
    ]
  },


  // 游乐园剧情
  park: {
    number: warmupQuestions.length + 2,

    title: "坐上摩天轮升到最高处，你会？",

    subtitle: "那一刻，整个世界都变得很小。",

    answers: [
      {
        text: "悄悄许一个和你有关的愿望",
        symbol: "☆",
        next: "q3"
      },

      {
        text: "拿出手机，记录我们的笑脸",
        symbol: "☻",
        next: "q3"
      }
    ]
  },


  // 咖啡店剧情
  cafe: {
    number: warmupQuestions.length + 2,

    title: "如果我把最后一块小蛋糕留给你呢？",

    subtitle: "这可是很重要的选择。",

    answers: [
      {
        text: "分你一半，因为快乐要分享",
        symbol: "♡",
        next: "q3"
      },

      {
        text: "先说谢谢，再把最好的一口给你",
        symbol: "✿",
        next: "q3"
      }
    ]
  },


  // 第三个问题
  q3: {
    number: warmupQuestions.length + 3,

    title: "你觉得，最舒服的相处方式是什么？",

    subtitle: "每一种答案，都有它的可爱之处。",

    answers: [
      {
        text: "一起热热闹闹，分享每个新鲜事",
        symbol: "☀",
        next: "q4"
      },

      {
        text: "安安静静待在一起，也不会尴尬",
        symbol: "☁",
        next: "q4"
      },

      {
        text: "偶尔冒险，偶尔慢下来",
        symbol: "✧",
        next: "q4"
      }
    ]
  },


  // 第四个问题：没有选项，出现 2 秒后自动进入信页
  q4: {
    number: warmupQuestions.length + 4,

    title: "最后一个小问题：你相信心意会被认真听见吗？",

    subtitle: "我想把接下来的一句话，认真地告诉你。",

    answers: [],

    autoNext: "letter"
  }

});


// 总题数：自动取最大题号，以后加减题目不用手动改进度
const totalSteps = Math.max(
  ...Object.values(story).map(node => node.number)
);


// ========================================
// 当前游戏状态
// ========================================

let currentNode = "warm1";

let history = [];

// ========================================
// 自动前进 / 箭头出现的计时器
// ========================================

// 最后一题停留多久后自动进入信页
const AUTO_NEXT_DELAY = 2000;

// 信页停留多久后渐显箭头
const LETTER_HINT_DELAY = 10000;

let autoNextTimer = null;

let letterHintTimer = null;


function clearTimers() {

  clearTimeout(autoNextTimer);

  clearTimeout(letterHintTimer);

  autoNextTimer = null;

  letterHintTimer = null;

}


// ========================================
// 页面切换
// ========================================

function showScreen(name) {

  Object.values(screens).forEach(screen => {
    screen.classList.remove("active");
  });

  screens[name].classList.add("active");

}


// ========================================
// 开始游戏
// ========================================

function startStory() {

  clearTimers();

  hideLetterNext();

  startQuestionMusic();

  history = [];

  currentNode = "warm1";

  renderQuestion(currentNode);

  showScreen("question");

}


// ========================================
// 跳转：final / letter / 下一题
// ========================================

function goTo(nextKey) {

  clearTimers();

  if (nextKey === "final") {

    showFinal();

  } else if (nextKey === "letter") {

    showLetter();

  } else {

    renderQuestion(nextKey);

  }

}


// ========================================
// 渲染问题
// ========================================

function renderQuestion(key) {

  clearTimers();

  const node = story[key];

  currentNode = key;

  // 设置问题标题
  document.getElementById("questionKicker").textContent =
    `第 ${node.number} 个小问题`;

  document.getElementById("questionTitle").textContent =
    node.title;

  document.getElementById("questionSubtitle").textContent =
    node.subtitle;


  // 更新进度条
  const progress = node.number / totalSteps * 100;

  document.getElementById("progressFill").style.width =
    `${progress}%`;

  document.getElementById("progressText").textContent =
    `${String(node.number).padStart(2, "0")} / ${String(totalSteps).padStart(2, "0")}`;


  // 获取答案容器
  const answers = document.getElementById("answers");

  // 清空之前的答案
  answers.replaceChildren();


  // 创建每个答案按钮
  node.answers.forEach(answer => {

    const button = document.createElement("button");

    button.type = "button";

    button.className = "answer-btn";


    // 答案图标
    const symbol = document.createElement("span");

    symbol.className = "answer-symbol";

    symbol.textContent = answer.symbol;


    // 答案文字
    const text = document.createElement("span");

    text.textContent = answer.text;


    // 添加到按钮
    button.append(symbol, text);


    // 点击答案
    button.addEventListener("click", () => {

      // 保存当前问题，用于返回
      history.push(currentNode);


      // 判断去向：先读信，再表白
      goTo(answer.next);

    });


    // 加入页面
    answers.append(button);

  });


  // 没有选项的题（最后一题）：停留一会儿自动进入下一页
  if (node.autoNext) {

    autoNextTimer = setTimeout(() => {

      autoNextTimer = null;

      goTo(node.autoNext);

    }, AUTO_NEXT_DELAY);

  }

}


// ========================================
// 表白前的那封信
// ========================================

async function showLetter() {

  clearTimers();

  hideLetterNext();

  showScreen("letter");

  enterLetterMusic();

  // 安静地留出阅读时间，之后箭头才渐显
  letterHintTimer = setTimeout(() => {

    letterHintTimer = null;

    showLetterNext();

  }, LETTER_HINT_DELAY);

  const body = document.getElementById("letterBody");

  // 先显示加载中的占位
  body.replaceChildren(
    Object.assign(document.createElement("p"), {
      className: "letter-loading",
      textContent: "正在打开这封信……"
    })
  );


  try {

    // 加时间戳，改完 love.txt 刷新页面就能看到新内容
    const response = await fetch(
      `${LETTER_FILE}?v=${Date.now()}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    renderLetter(await response.text());

  } catch (error) {

    console.warn("读取 " + LETTER_FILE + " 失败：", error);

    renderLetter(LETTER_FALLBACK);

  }

}


// 把纯文本排成一页信：一行算一段，段内的换行保留
function renderLetter(text) {

  const body = document.getElementById("letterBody");

  const content = String(text || "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .trim();

  body.replaceChildren();

  if (!content) {

    renderLetter(LETTER_FALLBACK);

    return;

  }

  content.split(/\n+/).forEach(line => {

    const paragraph = document.createElement("p");

    paragraph.textContent = line.trim();

    body.append(paragraph);

  });

}


// ========================================
// 最终表白页面
// ========================================

function showFinal() {

  clearTimers();

  showScreen("final");

  document.getElementById("responseNote").textContent = "";

  hideMemoryPhotos();

  makeConfetti();

}


// ========================================
// 信页底部的箭头：10 秒后渐显
// ========================================

function showLetterNext() {

  const arrow = document.getElementById("letterNext");

  // 先让浏览器算一次布局，淡入过渡才会生效
  void arrow.offsetWidth;

  arrow.classList.add("is-visible");

}


function hideLetterNext() {

  document.getElementById("letterNext").classList.remove("is-visible");

}


// ========================================
// 表白成功后出现的照片
// ========================================

// 等一张已经挂上去的图片加载完（失败也算完成，不卡住动画）
function waitForImage(img) {

  if (img.complete) {
    return Promise.resolve();
  }

  return new Promise(resolve => {

    img.addEventListener("load", resolve, { once: true });

    img.addEventListener("error", resolve, { once: true });

  });

}


// 按 PHOTO_DIRS 的顺序找一个能加载的路径
function createPhoto(file, holder) {

  return new Promise(resolve => {

    const img = document.createElement("img");

    img.alt = "想给你看的一张照片";

    let attempt = 0;

    const tryNext = () => {

      // 所有目录都试过了，就当加载完成，别让动画卡住
      if (attempt >= PHOTO_DIRS.length) {

        resolve(img);

        return;

      }

      img.src = PHOTO_DIRS[attempt++] + file;

    };

    img.addEventListener("load", () => resolve(img), { once: true });

    img.addEventListener("error", tryNext);

    holder.append(img);

    tryNext();

  });

}


function showMemoryPhotos() {

  const holder = document.getElementById("memoryPhoto");

  holder.hidden = false;

  holder.classList.remove("photo-in");


  // 先让浏览器记住“透明、靠下”的初始样子，
  // 不然刚显示就加类，淡入可能会被跳过、照片直接闪出来
  void holder.offsetWidth;


  // 第一次点“我愿意”时才去挂图片
  const ready = holder.childElementCount
    ? Promise.all([...holder.querySelectorAll("img")].map(waitForImage))
    : Promise.all(memoryPhotos.map(file => createPhoto(file, holder)));


  // 等图片都加载完，再做淡入放大的出现效果
  ready.then(() => {

    holder.classList.add("photo-in");


    // 照片不完全在屏幕里时，轻轻滚到它面前
    const rect = holder.getBoundingClientRect();

    if (rect.top < 0 || rect.bottom > window.innerHeight) {

      holder.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "center"
      });

    }

  });

}


function hideMemoryPhotos() {

  const holder = document.getElementById("memoryPhoto");

  holder.hidden = true;

  holder.classList.remove("photo-in");

}


// ========================================
// 爱心和飘落动画
// ========================================

function makeConfetti() {

  const holder = document.getElementById("confetti");

  holder.replaceChildren();


  const colors = [
    "#d98e91",
    "#e8c39f",
    "#b8c9ad",
    "#f1b8a7",
    "#d7b8d7"
  ];


  // 创建装饰元素
  for (let i = 0; i < 22; i++) {

    const item = document.createElement("span");

    // 爱心和星星交替
    item.textContent = i % 3 === 0 ? "♥" : "✦";


    // 随机水平位置
    item.style.setProperty(
      "--x",
      `${Math.random() * 100}%`
    );


    // 随机大小
    item.style.setProperty(
      "--s",
      `${9 + Math.random() * 12}px`
    );


    // 随机颜色
    item.style.setProperty(
      "--c",
      colors[i % colors.length]
    );


    // 随机动画时间
    item.style.setProperty(
      "--d",
      `${2.8 + Math.random() * 2.8}s`
    );


    // 随机延迟
    item.style.setProperty(
      "--delay",
      `${Math.random() * 2}s`
    );


    holder.append(item);

  }

}


// ========================================
// 返回上一题
// ========================================

function goBack() {

  clearTimers();

  // 如果已经没有上一题，则返回首页
  if (!history.length) {

    letterMode = false;

    stopMusic(900);

    showScreen("welcome");

    return;

  }


  // 获取上一题
  const previous = history.pop();


  // 重新渲染
  renderQuestion(previous);

}


// ========================================
// 按钮事件
// ========================================


// 开始按钮
document.getElementById("startButton")
  .addEventListener("click", startStory);


// 返回上一题
document.getElementById("backButton")
  .addEventListener("click", goBack);


// 点箭头，进入最后的表白
document.getElementById("letterNext")
  .addEventListener("click", showFinal);


// ========================================
// 表白成功
// ========================================

document.getElementById("yesButton")
  .addEventListener("click", () => {

    // 显示成功提示
    document.getElementById("responseNote").textContent =
      "那以后，请多多指教啦。♡";


    // 更新最终文字
    document.getElementById("finalMessage").innerHTML =
      "谢谢你愿意和我一起。<br>往后的日子，我们慢慢写。";


    // 修改按钮
    document.getElementById("yesButton").textContent =
      "我们在一起啦 ♡";


    // 收起问题和两个选项，画面留给后面的话和照片
    document.getElementById("finalScreen").classList.add("answered");


    // 再次播放装饰动画
    makeConfetti();


    // 出现准备好的照片
    showMemoryPhotos();

  });


// ========================================
// 让我想一想
// ========================================

document.getElementById("thinkButton")
  .addEventListener("click", () => {

    document.getElementById("responseNote").textContent =
      "没关系，我会尊重你的节奏。谢谢你认真看到这里。";

  });


// ========================================
// 重新开始
// ========================================

document.getElementById("restartButton")
  .addEventListener("click", () => {

    // 把问题和选项放回来
    document.getElementById("finalScreen").classList.remove("answered");


    // 恢复表白文字
    document.getElementById("finalMessage").innerHTML =
      "如果你也愿意，未来的日子，<br>我想和你一起慢慢收集温柔。";


    // 恢复按钮文字
    document.getElementById("yesButton").textContent =
      "我愿意 ♡";


    // 收起照片和箭头
    hideMemoryPhotos();

    hideLetterNext();


    // 清空提示
    document.getElementById("responseNote").textContent = "";


    // 清空历史
    history = [];


    // 回到开场，音乐淡出停住
    letterMode = false;

    stopMusic(900);

    showScreen("welcome");

  });


