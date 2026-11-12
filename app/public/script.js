/**
 * Cloud Infrastructure Dashboard - Frontend Application Logic
 * Vanilla JavaScript (ES6+) for fetching genuine telemetry and updating the UI
 */

(function () {
  'use strict';

  // Configuration
  const REFRESH_INTERVAL_MS = 10000; // 10 seconds periodic refresh

  // DOM Elements - Global & Navigation
  const globalStatusBadge = document.getElementById('global-status-badge');
  const globalStatusText = document.getElementById('global-status-text');
  const refreshBtn = document.getElementById('refresh-btn');
  const alertBanner = document.getElementById('alert-banner');
  const alertMessage = document.getElementById('alert-message');
  const alertDismiss = document.getElementById('alert-dismiss');
  const metaLastSync = document.getElementById('meta-last-sync');
  const navLinks = document.querySelectorAll('.nav-item');

  // DOM Elements - Overview Section
  const overviewStatusPill = document.getElementById('overview-status-pill');
  const overviewStatusValue = document.getElementById('overview-status-value');
  const overviewStatusDetail = document.getElementById('overview-status-detail');
  const overviewUptimeValue = document.getElementById('overview-uptime-value');
  const overviewVersionValue = document.getElementById('overview-version-value');
  const overviewTimestampValue = document.getElementById('overview-timestamp-value');

  // DOM Elements - System Health Section
  const sysOs = document.getElementById('sys-os');
  const sysPlatform = document.getElementById('sys-platform');
  const sysArch = document.getElementById('sys-arch');
  const sysRelease = document.getElementById('sys-release');
  const sysUptime = document.getElementById('sys-uptime');
  const sysNodeVersion = document.getElementById('sys-node-version');
  const sysCpuModel = document.getElementById('sys-cpu-model');
  const sysCpuCores = document.getElementById('sys-cpu-cores');
  const sysCpuSpeed = document.getElementById('sys-cpu-speed');
  const sysCpuArch = document.getElementById('sys-cpu-arch');
  const sysMemPercent = document.getElementById('sys-mem-percent');
  const sysMemBar = document.getElementById('sys-mem-bar');
  const sysMemUsed = document.getElementById('sys-mem-used');
  const sysMemFree = document.getElementById('sys-mem-free');
  const sysMemTotal = document.getElementById('sys-mem-total');

  let refreshTimerId = null;
  let isFetching = false;

  // =========================================================================
  // Formatting Utilities
  // =========================================================================

  /**
   * Formats duration in seconds to a human-readable string (Xd Xh Xm Xs)
   */
  function formatDuration(totalSeconds) {
    if (typeof totalSeconds !== 'number' || isNaN(totalSeconds) || totalSeconds < 0) {
      return 'Unavailable';
    }

    const sec = Math.floor(totalSeconds % 60);
    const min = Math.floor((totalSeconds / 60) % 60);
    const hours = Math.floor((totalSeconds / 3600) % 24);
    const days = Math.floor(totalSeconds / 86400);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0 || days > 0) parts.push(`${hours}h`);
    if (min > 0 || hours > 0 || days > 0) parts.push(`${min}m`);
    parts.push(`${sec}s`);

    return parts.join(' ');
  }

  /**
   * Formats byte values into appropriate GB/MB units
   */
  function formatBytes(bytes) {
    if (typeof bytes !== 'number' || isNaN(bytes) || bytes < 0) {
      return 'Unavailable';
    }

    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) {
      return `${gb.toFixed(2)} GB`;
    }
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  }

  /**
   * Formats an ISO date string to a localized timestamp
   */
  function formatTimestamp(isoString) {
    if (!isoString) return 'Unavailable';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return 'Invalid date';
      return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return 'Unavailable';
    }
  }

  // =========================================================================
  // UI State Updaters
  // =========================================================================

  function setGlobalStatus(state, text) {
    globalStatusBadge.className = 'status-indicator-badge';
    if (state === 'healthy') {
      globalStatusBadge.classList.add('status-healthy');
    } else if (state === 'degraded') {
      globalStatusBadge.classList.add('status-degraded');
    } else {
      globalStatusBadge.classList.add('status-offline');
    }
    globalStatusText.textContent = text;
  }

  function showAlert(msg) {
    alertMessage.textContent = msg;
    alertBanner.classList.remove('hidden');
  }

  function hideAlert() {
    alertBanner.classList.add('hidden');
  }

  function setRefreshLoading(loading) {
    if (loading) {
      refreshBtn.classList.add('loading');
      refreshBtn.disabled = true;
    } else {
      refreshBtn.classList.remove('loading');
      refreshBtn.disabled = false;
    }
  }

  /**
   * Sets UI elements to an unavailable state when requests fail
   */
  function setUnavailableState() {
    setGlobalStatus('offline', 'Unreachable');
    overviewStatusPill.className = 'status-pill-display unhealthy';
    overviewStatusValue.textContent = 'Offline';
    overviewStatusDetail.textContent = 'Backend server did not respond';

    overviewUptimeValue.textContent = 'Unavailable';
    overviewVersionValue.textContent = 'Unavailable';
    overviewTimestampValue.textContent = 'Unavailable';

    sysOs.textContent = 'Unavailable';
    sysPlatform.textContent = 'Unavailable';
    sysArch.textContent = 'Unavailable';
    sysRelease.textContent = 'Unavailable';
    sysUptime.textContent = 'Unavailable';
    sysNodeVersion.textContent = 'Unavailable';
    sysCpuModel.textContent = 'Unavailable';
    sysCpuCores.textContent = 'Unavailable';
    sysCpuSpeed.textContent = 'Unavailable';
    sysCpuArch.textContent = 'Unavailable';
    sysMemPercent.textContent = '--%';
    sysMemBar.style.width = '0%';
    sysMemUsed.textContent = 'Unavailable';
    sysMemFree.textContent = 'Unavailable';
    sysMemTotal.textContent = 'Unavailable';
  }

  /**
   * Renders genuine health data into the Overview section
   */
  function renderHealth(health) {
    const isHealthy = health.status === 'healthy' || health.status === 'ok';

    overviewStatusPill.className = 'status-pill-display ' + (isHealthy ? 'healthy' : 'unhealthy');
    overviewStatusValue.textContent = isHealthy ? 'Healthy' : 'Unhealthy';
    overviewStatusDetail.textContent = isHealthy ? 'Probe returning HTTP 200' : 'Probe reported issue';

    overviewUptimeValue.textContent = formatDuration(health.uptime);
    overviewVersionValue.textContent = health.version ? `v${health.version}` : 'Unavailable';
    overviewTimestampValue.textContent = formatTimestamp(health.timestamp);
  }

  /**
   * Renders genuine system info into the System Health section
   */
  function renderSystemInfo(info) {
    // OS & Platform details
    sysOs.textContent = info.type || 'Unavailable';
    sysPlatform.textContent = info.platform || 'Unavailable';
    sysArch.textContent = info.architecture || 'Unavailable';
    sysRelease.textContent = info.release || 'Unavailable';
    sysUptime.textContent = formatDuration(info.systemUptime);

    // Runtime
    sysNodeVersion.textContent = info.nodeVersion || 'Unavailable';

    // CPU details
    if (info.cpu) {
      sysCpuModel.textContent = info.cpu.model || 'Unavailable';
      sysCpuModel.title = info.cpu.model || '';
      sysCpuCores.textContent = typeof info.cpu.cores === 'number' ? `${info.cpu.cores} Cores` : 'Unavailable';
      sysCpuSpeed.textContent = info.cpu.speedMhz ? `${info.cpu.speedMhz} MHz` : 'Unavailable';
      sysCpuArch.textContent = info.architecture || 'Unavailable';
    } else {
      sysCpuModel.textContent = 'Unavailable';
      sysCpuCores.textContent = 'Unavailable';
      sysCpuSpeed.textContent = 'Unavailable';
      sysCpuArch.textContent = 'Unavailable';
    }

    // Memory details
    if (info.memory && typeof info.memory.totalBytes === 'number') {
      const usedPercent = info.memory.usedPercentage;
      sysMemPercent.textContent = typeof usedPercent === 'number' ? `${usedPercent}%` : '--%';
      sysMemBar.style.width = typeof usedPercent === 'number' ? `${Math.min(Math.max(usedPercent, 0), 100)}%` : '0%';

      if (typeof usedPercent === 'number' && usedPercent > 85) {
        sysMemBar.classList.add('high-usage');
      } else {
        sysMemBar.classList.remove('high-usage');
      }

      sysMemUsed.textContent = formatBytes(info.memory.usedBytes);
      sysMemFree.textContent = formatBytes(info.memory.freeBytes);
      sysMemTotal.textContent = formatBytes(info.memory.totalBytes);
    } else {
      sysMemPercent.textContent = 'Unavailable';
      sysMemBar.style.width = '0%';
      sysMemUsed.textContent = 'Unavailable';
      sysMemFree.textContent = 'Unavailable';
      sysMemTotal.textContent = 'Unavailable';
    }
  }

  // =========================================================================
  // Data Fetching
  // =========================================================================

  async function fetchAllData() {
    if (isFetching) return;
    isFetching = true;
    setRefreshLoading(true);

    try {
      const [healthRes, sysRes] = await Promise.all([
        fetch('/api/health', { cache: 'no-store' }),
        fetch('/api/system-info', { cache: 'no-store' })
      ]);

      if (!healthRes.ok || !sysRes.ok) {
        throw new Error(`API returned HTTP ${healthRes.status}/${sysRes.status}`);
      }

      const healthData = await healthRes.json();
      const sysData = await sysRes.json();

      // Render retrieved data
      renderHealth(healthData);
      renderSystemInfo(sysData);

      // Update global operational status
      setGlobalStatus('healthy', 'Operational');
      hideAlert();

      // Update sync timestamp
      const now = new Date();
      metaLastSync.textContent = now.toLocaleTimeString();
    } catch (err) {
      console.error('Failed to fetch dashboard metrics:', err);
      showAlert('Unable to connect to backend server. Retrying automatically in 10s...');
      setUnavailableState();
    } finally {
      isFetching = false;
      setRefreshLoading(false);
    }
  }

  // =========================================================================
  // Navigation & Scroll Tracking
  // =========================================================================

  function setupNavigation() {
    navLinks.forEach((link) => {
      link.addEventListener('click', (e) => {
        navLinks.forEach((l) => l.classList.remove('active'));
        link.classList.add('active');
      });
    });

    // Update active nav based on viewport scroll position
    const sections = document.querySelectorAll('.dashboard-section');
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const id = entry.target.getAttribute('id');
              navLinks.forEach((link) => {
                link.classList.toggle('active', link.getAttribute('data-nav') === id);
              });
            }
          });
        },
        { rootMargin: '-20% 0px -70% 0px', threshold: 0.1 }
      );

      sections.forEach((sec) => observer.observe(sec));
    }
  }

  // =========================================================================
  // Auto-Refresh & Lifecycle Management
  // =========================================================================

  function startAutoRefresh() {
    if (refreshTimerId) clearInterval(refreshTimerId);
    refreshTimerId = setInterval(fetchAllData, REFRESH_INTERVAL_MS);
  }

  function stopAutoRefresh() {
    if (refreshTimerId) {
      clearInterval(refreshTimerId);
      refreshTimerId = null;
    }
  }

  // Pause periodic polling when user switches tabs to conserve resources
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      fetchAllData();
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
  });

  // Event Listeners
  refreshBtn.addEventListener('click', () => {
    fetchAllData();
  });

  alertDismiss.addEventListener('click', () => {
    hideAlert();
  });

  // Initialize
  setupNavigation();
  fetchAllData();
  startAutoRefresh();
})();
