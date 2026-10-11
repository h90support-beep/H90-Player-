/* ================================================================
   H90 Player — Main Logic v3.0
   ✅ شريط تقدم احترافي (Drag + Tap + Pointer Capture)
   ✅ ربط كامل بالفيديو (Seek فوري + Preview + Resume)
   ✅ كل الميزات السابقة
   ================================================================ */

'use strict';

/* ================================================================
   🌐 الحالة العامة
   ================================================================ */
const H90 = {
  video: null,
  screen: null,
  loading: null,
  header: null,
  controls: null,
  isNative: false,
  isLocked: false,

  currentUrl: '',
  currentTitle: '',
  currentPoster: '',

  playlist: [],
  currentIndex: -1,

  settings: {
    brightness: 1.0,
    volume: 1.0,
    speed: 1.0,
    isMuted: false,
    aspect: 'fit',
    sleepTimer: 0
  },

  state: {
    isPlaying: false,
    isDragging: false,
    controlsVisible: true,
    lastTapTime: 0,
    tapTimeout: null,
    hideControlsTimeout: null,
    sleepInterval: null,
    sleepRemaining: 0,
    subtitleTrack: null,
    activeMenu: null
  }
};

/* ================================================================
   🚀 التشغيل الأولي
   ================================================================ */
document.addEventListener('DOMContentLoaded', function () {
  console.log('%c🎬 H90 Player v3.0 Starting...', 'color:#e53935;font-weight:900;font-size:14px;');

  H90.isNative = detectNativeEnv();
  console.log('📱 Native:', H90.isNative ? 'YES (APK)' : 'NO (Browser)');

  H90.video = document.getElementById('videoPlayer');
  H90.screen = document.getElementById('playerScreen');
  H90.loading = document.getElementById('loadingOverlay');
  H90.header = document.getElementById('playerHeader');
  H90.controls = document.getElementById('playerControls');

  if (!H90.video) {
    console.error('❌ video element not found');
    return;
  }

  loadSettings();
  listenForIncomingUrl();
  bindVideoEvents();
  bindControlsEvents();
  bindToolEvents();
  bindProgressBar();        /* ✅ الاحترافي */
  bindGestureEvents();
  bindPopupMenus();
  bindKeyboardEvents();
  bindSubtitleFileInput();

  console.log('✅ H90 Player Ready');
});

/* ================================================================
   📱 اكتشاف البيئة
   ================================================================ */
function detectNativeEnv() {
  try {
    return !!(
      window.Capacitor &&
      window.Capacitor.isNativePlatform &&
      window.Capacitor.isNativePlatform()
    );
  } catch (e) {
    return false;
  }
}

/* ================================================================
   💾 الإعدادات
   ================================================================ */
function saveSettings() {
  try {
    localStorage.setItem('h90player_settings', JSON.stringify({
      brightness: H90.settings.brightness,
      volume: H90.settings.volume,
      speed: H90.settings.speed,
      aspect: H90.settings.aspect
    }));
  } catch (e) {}
}

function loadSettings() {
  try {
    const raw = localStorage.getItem('h90player_settings');
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.volume !== undefined) H90.settings.volume = saved.volume;
      if (saved.brightness !== undefined) H90.settings.brightness = saved.brightness;
      if (saved.speed !== undefined) H90.settings.speed = saved.speed;
      if (saved.aspect !== undefined) H90.settings.aspect = saved.aspect;
    }
  } catch (e) {}

  if (H90.video) {
    H90.video.volume = H90.settings.volume;
    H90.video.playbackRate = H90.settings.speed;
  }
}

/* ================================================================
   🔗 استقبال الروابط
   ================================================================ */
async function listenForIncomingUrl() {
  console.log('🔗 Listening for incoming URL...');

  if (H90.isNative && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
    try {
      const App = window.Capacitor.Plugins.App;
      const launchUrl = await App.getLaunchUrl();
      if (launchUrl && launchUrl.url) {
        handleIncomingUrl(launchUrl.url);
      }
      App.addListener('appUrlOpen', function (data) {
        handleIncomingUrl(data.url);
      });
    } catch (e) {
      console.error('Capacitor App error:', e);
    }
  }

  const params = new URLSearchParams(window.location.search);
  const url = params.get('url');
  if (url) {
    handleIncomingUrl(buildUrlFromParams(params));
  } else {
    showWelcome();
  }
}

function buildUrlFromParams(params) {
  return 'h90player://play?url=' +
    encodeURIComponent(params.get('url') || '') +
    '&title=' + encodeURIComponent(params.get('title') || 'H90 Player') +
    '&poster=' + encodeURIComponent(params.get('poster') || '') +
    '&live=' + (params.get('live') === '1' ? '1' : '0') +
    '&playlist=' + encodeURIComponent(params.get('playlist') || '') +
    '&index=' + encodeURIComponent(params.get('index') || '0');
}

function handleIncomingUrl(rawUrl) {
  try {
    let url, title, poster, isLive, playlist, index;

    try {
      const parsed = new URL(rawUrl);
      const params = parsed.searchParams;
      url = decodeURIComponent(params.get('url') || '');
      title = decodeURIComponent(params.get('title') || 'H90 Player');
      poster = decodeURIComponent(params.get('poster') || '');
      isLive = params.get('live') === '1';
      playlist = params.get('playlist');
      index = parseInt(params.get('index') || '0', 10);
    } catch (e) {
      const match = rawUrl.match(/url=([^&]+)/);
      if (match) url = decodeURIComponent(match[1]);

      const titleMatch = rawUrl.match(/title=([^&]+)/);
      title = titleMatch ? decodeURIComponent(titleMatch[1]) : 'H90 Player';

      const posterMatch = rawUrl.match(/poster=([^&]+)/);
      poster = posterMatch ? decodeURIComponent(posterMatch[1]) : '';

      const plMatch = rawUrl.match(/playlist=([^&]+)/);
      playlist = plMatch ? decodeURIComponent(plMatch[1]) : null;

      const idxMatch = rawUrl.match(/index=(\d+)/);
      index = idxMatch ? parseInt(idxMatch[1], 10) : 0;

      isLive = rawUrl.indexOf('live=1') > -1;
    }

    if (!url) {
      showWelcome();
      return;
    }

    if (playlist) {
      try {
        H90.playlist = JSON.parse(playlist);
        H90.currentIndex = index || 0;
      } catch (e) {
        H90.playlist = [];
        H90.currentIndex = -1;
      }
    } else {
      H90.playlist = [];
      H90.currentIndex = -1;
    }

    playVideo({ url, title, poster, isLive });

  } catch (e) {
    console.error('❌ Parse error:', e);
    showWelcome();
  }
}

/* ================================================================
   🎬 تشغيل الفيديو
   ================================================================ */
function playVideo(data) {
  const { url, title, poster, isLive } = data;

  H90.currentUrl = url;
  H90.currentTitle = title || 'H90 Player';
  H90.currentPoster = poster || '';

  const welcome = document.getElementById('welcomeScreen');
  if (welcome) welcome.style.display = 'none';

  H90.screen.classList.add('show');

  const titleEl = document.getElementById('playerTitle');
  if (titleEl) titleEl.textContent = H90.currentTitle;

  showLoading('جارٍ التحميل...');
  updateNavButtons();

  if (H90.isNative && window.Capacitor.Plugins && window.Capacitor.Plugins.VideoPlayer) {
    useNativePlayer(url, title, poster, isLive);
    return;
  }

  useHtml5Player(url, title, isLive);
}

async function useNativePlayer(url, title, poster, isLive) {
  try {
    const VideoPlayer = window.Capacitor.Plugins.VideoPlayer;
    await VideoPlayer.play({
      url: url,
      title: title || 'H90 Player',
      poster: poster || '',
      isLive: isLive || false,
      autoFullscreen: true
    });
  } catch (e) {
    console.error('Native failed:', e);
    useHtml5Player(url, title, isLive);
  }
}

function useHtml5Player(url, title, isLive) {
  const video = H90.video;

  video.pause();
  video.removeAttribute('src');
  video.load();

  if (url.endsWith('.m3u8') && window.Hls && window.Hls.isSupported()) {
    if (video._hls) {
      video._hls.destroy();
      video._hls = null;
    }
    const hls = new window.Hls();
    hls.loadSource(url);
    hls.attachMedia(video);
    video._hls = hls;
  } else {
    video.src = url;
  }

  video.controls = false;
  video.playbackRate = H90.settings.speed;
  video.volume = H90.settings.volume;
  applyAspect(H90.settings.aspect);

  const playPromise = video.play();
  if (playPromise && playPromise.catch) {
    playPromise.catch(function (e) {
      console.warn('Autoplay blocked:', e);
      hideLoading();
      updatePlayIcon(false);
    });
  }
}

/* ================================================================
   📺 أحداث الفيديو
   ================================================================ */
function bindVideoEvents() {
  const video = H90.video;

  video.addEventListener('loadedmetadata', function () {
    const durationEl = document.getElementById('duration');
    if (durationEl) durationEl.textContent = formatTime(video.duration);
    hideLoading();
  });

  video.addEventListener('waiting', function () {
    showLoading('جارٍ التحميل...');
  });

  video.addEventListener('playing', function () {
    H90.state.isPlaying = true;
    hideLoading();
    updatePlayIcon(true);
    showControls();
  });

  video.addEventListener('play', function () {
    H90.state.isPlaying = true;
    updatePlayIcon(true);
  });

  video.addEventListener('pause', function () {
    H90.state.isPlaying = false;
    updatePlayIcon(false);
    showControls();
  });

  video.addEventListener('ended', function () {
    H90.state.isPlaying = false;
    updatePlayIcon(false);
    showControls();
    autoPlayNext();
  });

  /* ⚠️ مهم: نتحدّث الشريط فقط إذا ما كان المستخدم يسحب */
  video.addEventListener('timeupdate', function () {
    if (H90.state.isDragging) return;
    updateProgress();
  });

  video.addEventListener('progress', function () {
    if (video.buffered.length > 0) {
      const bufferedEnd = video.buffered[video.buffered.length - 1].end(0);
      const pct = (bufferedEnd / video.duration) * 100;
      const bufferEl = document.getElementById('progressBuffer');
      if (bufferEl) bufferEl.style.width = pct + '%';
    }
  });

  video.addEventListener('error', function () {
    let msg = 'تعذّر تشغيل الفيديو';
    if (video.error) {
      switch (video.error.code) {
        case 1: msg = 'تم إلغاء التحميل'; break;
        case 2: msg = 'خطأ في الشبكة'; break;
        case 3: msg = 'خطأ في فك الترميز'; break;
        case 4: msg = 'الصيغة غير مدعومة أو الرابط لا يعمل'; break;
      }
    }
    showError(msg);
  });
}

/* ================================================================
   🎛️ أزرار التحكم
   ================================================================ */
function bindControlsEvents() {
  document.getElementById('backBtn')?.addEventListener('click', closePlayer);
  document.getElementById('infoBtn')?.addEventListener('click', showInfo);
  document.getElementById('lockBtn')?.addEventListener('click', toggleLock);
  document.getElementById('playBtn')?.addEventListener('click', togglePlay);
  document.getElementById('seekBackBtn')?.addEventListener('click', () => seekBy(-10));
  document.getElementById('seekFwdBtn')?.addEventListener('click', () => seekBy(10));
  document.getElementById('prevBtn')?.addEventListener('click', playPrevious);
  document.getElementById('nextBtn')?.addEventListener('click', playNext);
  document.getElementById('muteBtn')?.addEventListener('click', toggleMute);
  document.getElementById('speedBtn')?.addEventListener('click', toggleSpeedMenu);
  document.getElementById('fullscreenBtn')?.addEventListener('click', toggleFullscreen);
  document.getElementById('unlockBtn')?.addEventListener('click', unlockScreen);
}

/* ================================================================
   🔧 الأدوات
   ================================================================ */
function bindToolEvents() {
  document.getElementById('aspectBtn')?.addEventListener('click', toggleAspectMenu);
  document.getElementById('screenshotBtn')?.addEventListener('click', takeScreenshot);
  document.getElementById('subtitleBtn')?.addEventListener('click', toggleSubtitleMenu);
  document.getElementById('sleepBtn')?.addEventListener('click', toggleSleepMenu);
}

/* ================================================================
   📋 القوائم
   ================================================================ */
function bindPopupMenus() {
  document.getElementById('popupOverlay')?.addEventListener('click', closeAllMenus);

  document.querySelectorAll('#aspectMenu .popup-item').forEach(btn => {
    btn.addEventListener('click', function () {
      setAspect(this.dataset.aspect);
      closeAllMenus();
    });
  });

  document.querySelectorAll('#speedMenu .popup-item').forEach(btn => {
    btn.addEventListener('click', function () {
      setSpeed(parseFloat(this.dataset.speed));
      closeAllMenus();
    });
  });

  document.querySelectorAll('#sleepMenu .popup-item').forEach(btn => {
    btn.addEventListener('click', function () {
      setSleepTimer(parseInt(this.dataset.minutes, 10));
      closeAllMenus();
    });
  });

  document.querySelector('#subtitleMenu .popup-item[data-sub="none"]')
    ?.addEventListener('click', function () {
      removeSubtitle();
      closeAllMenus();
    });

  document.getElementById('loadSubBtn')?.addEventListener('click', function () {
    document.getElementById('subtitleFile')?.click();
  });
}

/* ================================================================
   📊 شريط التقدم — v3.0 (احترافي ومربوط بالفيديو)
   ✅ Pointer Events + Capture
   ✅ RTL صحيح
   ✅ Drag + Tap
   ✅ Preview للوقت أثناء السحب
   ✅ تطبيق فوري عند الإفلات
   ================================================================ */
function bindProgressBar() {
  const wrap = document.getElementById('progressWrap');
  const video = H90.video;
  if (!wrap) return;

  let isDraggingLocal = false;
  let dragPercent = 0;
  let wasPlayingBeforeDrag = false;

  /* حساب النسبة (RTL) */
  function getPercent(clientX) {
    const rect = wrap.getBoundingClientRect();
    let pct = (rect.right - clientX) / rect.width;
    return Math.max(0, Math.min(1, pct));
  }

  /* تحديث الواجهة (بدون تطبيق على الفيديو) */
  function updateUI(pct) {
    const fill = document.getElementById('progressFill');
    const thumb = document.getElementById('progressThumb');
    const currentTimeEl = document.getElementById('currentTime');

    if (fill) fill.style.width = (pct * 100) + '%';
    if (thumb) thumb.style.right = (pct * 100) + '%';

    if (currentTimeEl && video.duration) {
      const newTime = pct * video.duration;
      currentTimeEl.textContent = formatTime(newTime);
    }
  }

  /* ✅ تطبيق النسبة على الفيديو (Seek حقيقي) */
  function applySeek(pct) {
    if (!video.duration || isNaN(video.duration)) return;

    const newTime = pct * video.duration;

    /* تجنّب الأخطاء الصغيرة */
    if (Math.abs(video.currentTime - newTime) < 0.1) return;

    try {
      video.currentTime = newTime;
    } catch (e) {
      console.warn('Seek failed:', e);
    }
  }

  /* ============================================
     بدء السحب
     ============================================ */
  function startDrag(clientX) {
    if (H90.isLocked) return;

    isDraggingLocal = true;
    H90.state.isDragging = true;
    wrap.classList.add('dragging');

    /* ✅ تذكّر حالة التشغيل */
    wasPlayingBeforeDrag = !video.paused;

    dragPercent = getPercent(clientX);
    updateUI(dragPercent);

    if (navigator.vibrate) navigator.vibrate(5);
  }

  /* ============================================
     حركة السحب (Preview فقط)
     ============================================ */
  function moveDrag(clientX) {
    if (!isDraggingLocal) return;

    dragPercent = getPercent(clientX);
    updateUI(dragPercent);
  }

  /* ============================================
     انتهاء السحب → تطبيق Seek فوري
     ============================================ */
  function endDrag() {
    if (!isDraggingLocal) return;

    isDraggingLocal = false;
    H90.state.isDragging = false;
    wrap.classList.remove('dragging');

    /* ✅ تطبيق النسبة */
    applySeek(dragPercent);

    /* ✅ استئناف التشغيل إذا كان يعمل */
    if (wasPlayingBeforeDrag && video.paused) {
      video.play().catch(function () {});
    }

    if (navigator.vibrate) navigator.vibrate(8);
  }

  /* ============================================
     Pointer Events
     ============================================ */
  wrap.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    startDrag(e.clientX);

    try {
      wrap.setPointerCapture(e.pointerId);
    } catch (err) {}

    e.preventDefault();
    e.stopPropagation();
  });

  wrap.addEventListener('pointermove', function (e) {
    if (!isDraggingLocal) return;
    moveDrag(e.clientX);
    e.preventDefault();
  });

  wrap.addEventListener('pointerup', function (e) {
    endDrag();
    try { wrap.releasePointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
    e.stopPropagation();
  });

  wrap.addEventListener('pointercancel', function (e) {
    endDrag();
    try { wrap.releasePointerCapture(e.pointerId); } catch (err) {}
  });

  /* ============================================
     Fallback: Touch + Mouse
     ============================================ */
  if (!window.PointerEvent) {
    wrap.addEventListener('touchstart', function (e) {
      startDrag(e.touches[0].clientX);
      e.preventDefault();
    }, { passive: false });

    wrap.addEventListener('touchmove', function (e) {
      if (!isDraggingLocal) return;
      moveDrag(e.touches[0].clientX);
      e.preventDefault();
    }, { passive: false });

    wrap.addEventListener('touchend', function (e) {
      endDrag();
      e.preventDefault();
    }, { passive: false });

    wrap.addEventListener('touchcancel', function () {
      endDrag();
    });

    wrap.addEventListener('mousedown', function (e) {
      startDrag(e.clientX);
      e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
      if (!isDraggingLocal) return;
      moveDrag(e.clientX);
    });

    document.addEventListener('mouseup', function () {
      endDrag();
    });
  }

  /* ============================================
     ✅ Tap-to-Seek (نقرة مباشرة)
     ============================================ */
  wrap.addEventListener('click', function (e) {
    if (H90.isLocked) return;
    if (isDraggingLocal) return;

    const pct = getPercent(e.clientX);
    updateUI(pct);
    applySeek(pct);

    if (navigator.vibrate) navigator.vibrate(5);
  });

  /* ============================================
     ✅ Keyboard
     ============================================ */
  wrap.setAttribute('tabindex', '0');
  wrap.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      seekBy(-5);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      seekBy(5);
    }
  });

  console.log('✅ Progress bar bound v3.0 (Advanced)');
}

/* ================================================================
   👆 الإيماءات
   ================================================================ */
function bindGestureEvents() {
  const screen = H90.screen;
  const video = H90.video;

  let gestureMode = null;
  let startY = 0;
  let startX = 0;
  let startValue = 0;
  let isHorizontalSwipe = false;
  let seekAmount = 0;

  screen.addEventListener('touchstart', function (e) {
    if (H90.isLocked) return;
    if (e.target.closest('.progress-wrap')) return;
    if (e.target.closest('.ctrl-btn')) return;
    if (e.target.closest('.player-btn')) return;
    if (e.target.closest('.tool-btn')) return;
    if (e.target.closest('.popup-menu')) return;
    if (e.target.closest('.popup-overlay')) return;

    const touch = e.touches[0];
    const rect = screen.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    startX = x;
    startY = y;
    isHorizontalSwipe = false;
    seekAmount = 0;

    if (x > rect.width * 0.6) {
      gestureMode = 'volume';
      startValue = H90.settings.volume;
    } else if (x < rect.width * 0.4) {
      gestureMode = 'brightness';
      startValue = H90.settings.brightness;
    } else {
      gestureMode = 'seek';
      startValue = video.currentTime;
    }
  }, { passive: true });

  screen.addEventListener('touchmove', function (e) {
    if (H90.isLocked) return;
    if (!gestureMode) return;

    const touch = e.touches[0];
    const rect = screen.getBoundingClientRect();
    const currentX = touch.clientX - rect.left;
    const currentY = touch.clientY - rect.top;
    const deltaX = currentX - startX;
    const deltaY = startY - currentY;

    if (Math.abs(deltaX) > 30 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (!isHorizontalSwipe) {
        isHorizontalSwipe = true;
        if (gestureMode === 'seek') {
          startValue = video.currentTime;
        }
      }
    }

    if (isHorizontalSwipe && gestureMode === 'seek') {
      seekAmount = Math.round(deltaX / 8);
      const newTime = Math.max(0, Math.min(video.duration, startValue + seekAmount));

      if (video.duration) {
        const pct = (newTime / video.duration) * 100;
        document.getElementById('progressFill').style.width = pct + '%';
        document.getElementById('progressThumb').style.right = pct + '%';
        document.getElementById('currentTime').textContent = formatTime(newTime);

        showSeekIndicator(
          seekAmount > 0 ? 'forward' : 'backward',
          (seekAmount > 0 ? '+' : '') + seekAmount + ' ثانية'
        );
      }

      e.preventDefault();
      return;
    }

    if (!isHorizontalSwipe) {
      const delta = deltaY / 250;

      if (gestureMode === 'volume') {
        H90.settings.volume = Math.max(0, Math.min(1, startValue + delta));
        video.volume = H90.settings.volume;
        video.muted = H90.settings.volume === 0;
        updateVolumeIcon();
        showGestureIndicator('volume', H90.settings.volume);
      } else if (gestureMode === 'brightness') {
        H90.settings.brightness = Math.max(0.1, Math.min(1, startValue + delta));
        applyBrightness(H90.settings.brightness);
        showGestureIndicator('brightness', H90.settings.brightness);
      }

      e.preventDefault();
    }
  }, { passive: false });

  screen.addEventListener('touchend', function () {
    if (H90.isLocked) return;

    if (isHorizontalSwipe && gestureMode === 'seek' && seekAmount !== 0) {
      video.currentTime = Math.max(0, Math.min(video.duration, startValue + seekAmount));
      setTimeout(() => {
        document.getElementById('seekIndicator')?.classList.remove('show');
      }, 400);
      seekAmount = 0;
    } else if (gestureMode === 'volume' || gestureMode === 'brightness') {
      setTimeout(hideGestureIndicators, 600);
      saveSettings();
    }

    gestureMode = null;
    isHorizontalSwipe = false;
  });

  screen.addEventListener('click', function (e) {
    if (H90.isLocked) return;
    if (e.target.closest('.ctrl-btn')) return;
    if (e.target.closest('.player-btn')) return;
    if (e.target.closest('.tool-btn')) return;
    if (e.target.closest('.progress-wrap')) return;
    if (e.target.closest('.popup-menu')) return;
    if (e.target.closest('.popup-overlay')) return;

    const now = Date.now();
    const deltaTime = now - H90.state.lastTapTime;

    const rect = screen.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const third = rect.width / 3;

    if (deltaTime < 300) {
      if (x > rect.width - third) {
        seekBy(-10);
        showSeekIndicator('backward', '-10 ثانية');
      } else if (x < third) {
        seekBy(10);
        showSeekIndicator('forward', '+10 ثانية');
      } else {
        togglePlay();
      }
      clearTimeout(H90.state.tapTimeout);
      H90.state.lastTapTime = 0;
    } else {
      H90.state.lastTapTime = now;
      H90.state.tapTimeout = setTimeout(function () {
        if (H90.state.controlsVisible) hideControls();
        else showControls();
      }, 250);
    }
  });
}

/* ================================================================
   ⌨️ الكيبورد
   ================================================================ */
function bindKeyboardEvents() {
  document.addEventListener('keydown', function (e) {
    switch (e.key) {
      case ' ':
      case 'k':
        e.preventDefault();
        togglePlay();
        break;
      case 'ArrowRight': seekBy(-10); break;
      case 'ArrowLeft': seekBy(10); break;
      case 'ArrowUp': adjustVolume(0.1); break;
      case 'ArrowDown': adjustVolume(-0.1); break;
      case 'f':
      case 'F': toggleFullscreen(); break;
      case 'm':
      case 'M': toggleMute(); break;
      case 'l':
      case 'L': toggleLock(); break;
      case 'Escape':
        if (H90.state.activeMenu) closeAllMenus();
        else closePlayer();
        break;
    }
  });
}

/* ================================================================
   📁 الترجمة
   ================================================================ */
function bindSubtitleFileInput() {
  const input = document.getElementById('subtitleFile');
  input?.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    loadSubtitleFile(file);
  });
}

function loadSubtitleFile(file) {
  const reader = new FileReader();

  reader.onload = function (e) {
    const content = e.target.result;
    const ext = file.name.split('.').pop().toLowerCase();

    let vttContent;

    if (ext === 'srt') vttContent = srtToVtt(content);
    else if (ext === 'vtt') vttContent = content;
    else { showToast('صيغة غير مدعومة', 'error'); return; }

    const blob = new Blob([vttContent], { type: 'text/vtt' });
    const url = URL.createObjectURL(blob);

    const video = H90.video;
    Array.from(video.querySelectorAll('track')).forEach(t => t.remove());

    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.label = 'العربية';
    track.srclang = 'ar';
    track.src = url;
    track.default = true;

    video.appendChild(track);

    setTimeout(() => {
      const textTracks = video.textTracks;
      for (let i = 0; i < textTracks.length; i++) textTracks[i].mode = 'showing';
    }, 100);

    H90.state.subtitleTrack = track;
    showToast('تم تحميل الترجمة', 'success');
    document.getElementById('subtitleBtn')?.classList.add('active');
  };

  reader.readAsText(file);
}

function srtToVtt(srt) {
  return 'WEBVTT\n\n' +
    srt
      .replace(/\r+/g, '')
      .replace(/^\d+\n/gm, '')
      .replace(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/g, '$1:$2:$3.$4')
      .trim();
}

function removeSubtitle() {
  Array.from(H90.video.querySelectorAll('track')).forEach(t => t.remove());
  H90.state.subtitleTrack = null;
  document.getElementById('subtitleBtn')?.classList.remove('active');
  showToast('تم إزالة الترجمة', 'info');
}

/* ================================================================
   📸 لقطة
   ================================================================ */
function takeScreenshot() {
  const video = H90.video;

  if (!video.duration || video.readyState < 2) {
    showToast('لا يمكن أخذ لقطة الآن', 'error');
    return;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(function (blob) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = 'h90player_' + timestamp + '.png';

      if (H90.isNative && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {
        saveScreenshotNative(blob, filename);
      } else {
        downloadBlob(blob, filename);
        showToast('تم حفظ اللقطة', 'success');
      }
    }, 'image/png');
  } catch (e) {
    showToast('فشل أخذ اللقطة', 'error');
  }
}

async function saveScreenshotNative(blob, filename) {
  try {
    const Filesystem = window.Capacitor.Plugins.Filesystem;
    const base64 = await blobToBase64(blob);
    const data = base64.split(',')[1];

    await Filesystem.writeFile({
      path: 'H90Player/' + filename,
      data: data,
      directory: 'DOCUMENTS',
      recursive: true
    });
    showToast('تم حفظ اللقطة', 'success');
  } catch (e) {
    downloadBlob(blob, filename);
    showToast('تم حفظ اللقطة', 'success');
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ================================================================
   🔲 نسبة العرض
   ================================================================ */
function setAspect(aspect) {
  H90.settings.aspect = aspect;
  applyAspect(aspect);

  document.querySelectorAll('#aspectMenu .popup-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.aspect === aspect);
  });

  const label = document.getElementById('aspectLabel');
  if (label) {
    const labels = { fit: 'FIT', cover: 'COVER', fill: 'FILL', '16:9': '16:9', '4:3': '4:3' };
    label.textContent = labels[aspect] || 'FIT';
  }

  document.getElementById('aspectBtn')?.classList.add('active');
  saveSettings();
  showToast('نسبة العرض: ' + aspect, 'info');
}

function applyAspect(aspect) {
  const video = H90.video;
  video.classList.remove('cover', 'fill', 'ratio-16-9', 'ratio-4-3');

  switch (aspect) {
    case 'cover': video.classList.add('cover'); break;
    case 'fill': video.classList.add('fill'); break;
    case '16:9': video.classList.add('ratio-16-9'); break;
    case '4:3': video.classList.add('ratio-4-3'); break;
  }
}

/* ================================================================
   ⚡ السرعة
   ================================================================ */
function setSpeed(speed) {
  H90.video.playbackRate = speed;
  H90.settings.speed = speed;

  const label = document.getElementById('speedLabel');
  if (label) label.textContent = speed + 'x';

  document.querySelectorAll('#speedMenu .popup-item').forEach(btn => {
    btn.classList.toggle('active', parseFloat(btn.dataset.speed) === speed);
  });

  saveSettings();
  showToast('السرعة: ' + speed + 'x', 'info');
}

/* ================================================================
   🌙 مؤقت النوم
   ================================================================ */
function setSleepTimer(minutes) {
  if (H90.state.sleepInterval) {
    clearInterval(H90.state.sleepInterval);
    H90.state.sleepInterval = null;
  }

  H90.settings.sleepTimer = minutes;

  if (minutes === 0) {
    document.getElementById('activeTimer')?.classList.remove('show');
    document.getElementById('sleepBtn')?.classList.remove('active');
    showToast('تم إلغاء المؤقت', 'info');
    return;
  }

  H90.state.sleepRemaining = minutes * 60;

  H90.state.sleepInterval = setInterval(() => {
    H90.state.sleepRemaining--;

    const mins = Math.floor(H90.state.sleepRemaining / 60);
    const secs = H90.state.sleepRemaining % 60;
    const text = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');

    const activeText = document.getElementById('activeTimerText');
    if (activeText) activeText.textContent = text;

    if (H90.state.sleepRemaining <= 0) {
      clearInterval(H90.state.sleepInterval);
      H90.state.sleepInterval = null;
      H90.video.pause();
      document.getElementById('activeTimer')?.classList.remove('show');
      document.getElementById('sleepBtn')?.classList.remove('active');
      showToast('توقف التشغيل (مؤقت النوم)', 'info');
    }
  }, 1000);

  document.querySelectorAll('#sleepMenu .popup-item').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.minutes, 10) === minutes);
  });

  document.getElementById('activeTimer')?.classList.add('show');
  document.getElementById('sleepBtn')?.classList.add('active');
  showToast('مؤقت النوم: ' + minutes + ' دقيقة', 'success');
}

/* ================================================================
   🔒 القفل
   ================================================================ */
function toggleLock() {
  H90.isLocked = !H90.isLocked;

  const overlay = document.getElementById('lockOverlay');
  const lockBtn = document.getElementById('lockBtn');

  if (H90.isLocked) {
    overlay?.classList.add('show');
    lockBtn?.classList.add('active');
    hideControls();
    showToast('تم قفل الشاشة', 'info');
  } else {
    overlay?.classList.remove('show');
    lockBtn?.classList.remove('active');
    showControls();
    showToast('تم فتح الشاشة', 'info');
  }

  if (navigator.vibrate) navigator.vibrate(15);
}

function unlockScreen() {
  H90.isLocked = false;
  document.getElementById('lockOverlay')?.classList.remove('show');
  document.getElementById('lockBtn')?.classList.remove('active');
  showControls();
  showToast('تم فتح الشاشة', 'info');
  if (navigator.vibrate) navigator.vibrate(15);
}

/* ================================================================
   ▶️ التحكم بالفيديو
   ================================================================ */
function togglePlay() {
  const video = H90.video;
  if (video.paused) video.play().catch(() => {});
  else video.pause();
  showControls();
}

function seekBy(seconds) {
  const video = H90.video;
  if (!video.duration) return;
  video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
}

function toggleMute() {
  const video = H90.video;
  video.muted = !video.muted;
  H90.settings.isMuted = video.muted;
  updateVolumeIcon();
  showToast(video.muted ? 'كتم الصوت' : 'تشغيل الصوت', 'info');
}

function adjustVolume(delta) {
  H90.settings.volume = Math.max(0, Math.min(1, H90.settings.volume + delta));
  H90.video.volume = H90.settings.volume;
  H90.video.muted = false;
  updateVolumeIcon();
  showGestureIndicator('volume', H90.settings.volume);
  setTimeout(hideGestureIndicators, 600);
}

function toggleFullscreen() {
  const screen = H90.screen;

  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    if (screen.requestFullscreen) screen.requestFullscreen().catch(() => {});
    else if (screen.webkitRequestFullscreen) screen.webkitRequestFullscreen();

    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }
  } else {
    if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  }

  setTimeout(updateFullscreenIcon, 100);
}

/* ================================================================
   ⏭️ التالي/السابق
   ================================================================ */
function playNext() {
  if (H90.playlist.length === 0 || H90.currentIndex < 0) { showToast('لا توجد حلقات أخرى', 'info'); return; }
  if (H90.currentIndex >= H90.playlist.length - 1) { showToast('آخر حلقة', 'info'); return; }
  H90.currentIndex++;
  playFromPlaylist(H90.currentIndex);
}

function playPrevious() {
  if (H90.playlist.length === 0 || H90.currentIndex < 0) { showToast('لا توجد حلقات أخرى', 'info'); return; }
  if (H90.currentIndex <= 0) { showToast('أول حلقة', 'info'); return; }
  H90.currentIndex--;
  playFromPlaylist(H90.currentIndex);
}

function playFromPlaylist(index) {
  const item = H90.playlist[index];
  if (!item) return;
  playVideo({ url: item.url, title: item.title, poster: item.poster || '', isLive: false });
}

function autoPlayNext() {
  if (H90.playlist.length > 0 && H90.currentIndex < H90.playlist.length - 1) {
    setTimeout(playNext, 2000);
  }
}

function updateNavButtons() {
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const hasPlaylist = H90.playlist.length > 1;

  if (prevBtn) prevBtn.style.opacity = hasPlaylist && H90.currentIndex > 0 ? '1' : '0.3';
  if (nextBtn) nextBtn.style.opacity = hasPlaylist && H90.currentIndex < H90.playlist.length - 1 ? '1' : '0.3';
}

/* ================================================================
   🎨 الإضاءة
   ================================================================ */
function applyBrightness(value) {
  let overlay = document.getElementById('brightnessOverlay');

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'brightnessOverlay';
    H90.screen.appendChild(overlay);
  }

  overlay.style.opacity = (1 - value).toFixed(2);
}

/* ================================================================
   🎛️ أيقونات
   ================================================================ */
function updatePlayIcon(isPlaying) {
  const icon = document.getElementById('playIcon');
  if (!icon) return;
  icon.innerHTML = isPlaying
    ? '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>'
    : '<polygon points="6 3 20 12 6 21 6 3"/>';
}

function updateVolumeIcon() {
  const icon = document.getElementById('volumeIcon');
  const video = H90.video;
  if (!icon) return;

  if (video.muted || video.volume === 0) {
    icon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>';
  } else if (video.volume < 0.5) {
    icon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>';
  } else {
    icon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>';
  }
}

function updateFullscreenIcon() {
  const icon = document.getElementById('fullscreenIcon');
  if (!icon) return;
  const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
  icon.innerHTML = isFs
    ? '<path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/>'
    : '<path d="M3 3h6v2H5v4H3V3zM15 3h6v6h-2V5h-4V3zM21 15v6h-6v-2h4v-4h2zM3 15h2v4h4v2H3v-6z"/>';
}

/* ================================================================
   📊 تحديث الشريط (من الفيديو)
   ================================================================ */
function updateProgress() {
  const video = H90.video;
  if (!video.duration) return;

  const pct = (video.currentTime / video.duration) * 100;
  const fill = document.getElementById('progressFill');
  const thumb = document.getElementById('progressThumb');
  const currentTimeEl = document.getElementById('currentTime');

  if (fill) fill.style.width = pct + '%';
  if (thumb) thumb.style.right = pct + '%';
  if (currentTimeEl) currentTimeEl.textContent = formatTime(video.currentTime);
}

/* ================================================================
   🎨 مؤشرات
   ================================================================ */
function showGestureIndicator(type, value) {
  const indicator = document.getElementById(type === 'volume' ? 'volumeIndicator' : 'brightnessIndicator');
  const fill = document.getElementById(type === 'volume' ? 'volumeFill' : 'brightnessFill');
  const valueEl = document.getElementById(type === 'volume' ? 'volumeValue' : 'brightnessValue');

  if (!indicator) return;
  indicator.classList.add('show');
  if (fill) fill.style.height = (value * 100) + '%';
  if (valueEl) valueEl.textContent = Math.round(value * 100) + '%';
}

function hideGestureIndicators() {
  document.getElementById('volumeIndicator')?.classList.remove('show');
  document.getElementById('brightnessIndicator')?.classList.remove('show');
}

function showSeekIndicator(direction, text) {
  const indicator = document.getElementById('seekIndicator');
  const seekText = document.getElementById('seekText');
  const seekIcon = document.getElementById('seekIcon');
  if (!indicator) return;

  indicator.classList.remove('forward', 'backward');
  indicator.classList.add(direction, 'show');

  if (seekText) seekText.textContent = text;

  if (seekIcon) {
    seekIcon.innerHTML = direction === 'forward'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>';
  }

  clearTimeout(indicator._timeout);
  indicator._timeout = setTimeout(() => {
    indicator.classList.remove('show');
  }, 800);
}

/* ================================================================
   💬 Toast
   ================================================================ */
function showToast(text, type) {
  const toast = document.getElementById('toastIndicator');
  const toastText = document.getElementById('toastText');
  const toastIcon = document.getElementById('toastIcon');
  if (!toast) return;

  toastText.textContent = text;

  if (type === 'success') {
    toastIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#00e676" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  } else if (type === 'error') {
    toastIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#e53935" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
  } else {
    toastIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#00e5ff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
  }

  toast.classList.add('show');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => toast.classList.remove('show'), 2000);
}

/* ================================================================
   👁️ إظهار/إخفاء
   ================================================================ */
function showControls() {
  if (H90.isLocked) return;
  H90.state.controlsVisible = true;
  H90.header?.classList.remove('hidden');
  H90.controls?.classList.remove('hidden');

  clearTimeout(H90.state.hideControlsTimeout);
  if (H90.state.isPlaying) {
    H90.state.hideControlsTimeout = setTimeout(hideControls, 4000);
  }
}

function hideControls() {
  if (H90.isLocked) return;
  H90.state.controlsVisible = false;
  H90.header?.classList.add('hidden');
  H90.controls?.classList.add('hidden');
}

/* ================================================================
   📋 القوائم
   ================================================================ */
function toggleAspectMenu() { toggleMenu('aspectMenu'); }
function toggleSpeedMenu() { toggleMenu('speedMenu'); }
function toggleSleepMenu() { toggleMenu('sleepMenu'); }
function toggleSubtitleMenu() { toggleMenu('subtitleMenu'); }

function toggleMenu(menuId) {
  const menu = document.getElementById(menuId);
  const overlay = document.getElementById('popupOverlay');
  if (!menu) return;

  const isOpen = menu.classList.contains('show');
  closeAllMenus();

  if (!isOpen) {
    menu.classList.add('show');
    overlay?.classList.add('show');
    H90.state.activeMenu = menuId;
  }
}

function closeAllMenus() {
  document.querySelectorAll('.popup-menu').forEach(m => m.classList.remove('show'));
  document.getElementById('popupOverlay')?.classList.remove('show');
  H90.state.activeMenu = null;
}

/* ================================================================
   ⏳ الشاشات
   ================================================================ */
function showLoading(text) {
  if (!H90.loading) return;
  H90.loading.innerHTML = '<div class="loading-spinner"></div><div class="loading-text">' + (text || 'جارٍ التحميل...') + '</div>';
  H90.loading.classList.add('show');
}

function hideLoading() {
  H90.loading?.classList.remove('show');
}

function showError(msg) {
  if (!H90.loading) return;
  H90.loading.innerHTML =
    '<div style="font-size:18px;font-weight:900;color:#e53935;margin-bottom:8px;">تعذّر التشغيل</div>' +
    '<div style="font-size:13px;color:rgba(255,255,255,0.6);margin-bottom:16px;text-align:center;padding:0 20px;">' + msg + '</div>' +
    '<button id="errorCloseBtn" style="padding:10px 24px;background:linear-gradient(135deg,#e53935,#c62828);color:#fff;border:none;border-radius:12px;font-weight:800;font-size:14px;cursor:pointer;">إغلاق</button>';
  H90.loading.classList.add('show');
  document.getElementById('errorCloseBtn')?.addEventListener('click', closePlayer);
}

/* ================================================================
   🚪 الإغلاق
   ================================================================ */
function closePlayer() {
  const video = H90.video;

  if (video) {
    try {
      video.pause();
      if (video._hls) { video._hls.destroy(); video._hls = null; }
      video.removeAttribute('src');
      video.load();
    } catch (e) {}
  }

  if (H90.state.sleepInterval) {
    clearInterval(H90.state.sleepInterval);
    H90.state.sleepInterval = null;
  }

  if (H90.isNative && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
    try { window.Capacitor.Plugins.App.exitApp(); return; } catch (e) {}
  }

  H90.screen.classList.remove('show');
  showWelcome();
}

function showWelcome() {
  const welcome = document.getElementById('welcomeScreen');
  if (welcome) welcome.style.display = 'flex';
  H90.screen.classList.remove('show');
}

/* ================================================================
   ℹ️ معلومات
   ================================================================ */
function showInfo() {
  const video = H90.video;
  const info = [
    'العنوان: ' + H90.currentTitle,
    'الحالة: ' + (video.paused ? 'متوقف' : 'قيد التشغيل'),
    'المدة: ' + formatTime(video.duration),
    'الوقت الحالي: ' + formatTime(video.currentTime),
    'السرعة: ' + video.playbackRate + 'x',
    'الصوت: ' + Math.round(video.volume * 100) + '%',
    'الإضاءة: ' + Math.round(H90.settings.brightness * 100) + '%',
    'نسبة العرض: ' + H90.settings.aspect,
    'القفل: ' + (H90.isLocked ? 'مقفل' : 'مفتوح'),
    'الحلقة: ' + (H90.currentIndex + 1) + ' / ' + H90.playlist.length
  ].join('\n');
  alert(info);
}

/* ================================================================
   🛠️ أدوات
   ================================================================ */
function formatTime(seconds) {
  if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return h + ':' + pad(m) + ':' + pad(s);
  return m + ':' + pad(s);
}

function pad(n) { return String(n).padStart(2, '0'); }

/* ================================================================
   📱 Message Events
   ================================================================ */
window.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'H90_PLAY') {
    playVideo(event.data);
  }
});

/* ================================================================
   🌐 API
   ================================================================ */
window.H90Player = {
  play: playVideo,
  playUrl: function (url, title) {
    playVideo({ url, title: title || 'H90 Player' });
  },
  playPlaylist: function (playlist, index) {
    H90.playlist = playlist || [];
    H90.currentIndex = index || 0;
    if (H90.playlist[H90.currentIndex]) playVideo(H90.playlist[H90.currentIndex]);
  },
  close: closePlayer,
  isNative: function () { return H90.isNative; },
  getState: function () { return H90.state; },
  getSettings: function () { return H90.settings; }
};

console.log('%c🎬 H90 Player v3.0 Ready',
  'background:linear-gradient(135deg,#e53935,#c62828);color:#fff;padding:6px 14px;border-radius:8px;font-weight:900;font-size:12px;');