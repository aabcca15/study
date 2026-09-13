<script setup lang="ts">
import { useTheme } from '@/composables/useTheme'

const { isDark, toggleTheme } = useTheme()
</script>

<template>
  <header class="app-brand-header">
    <div class="app-brand-inner">
      <router-link class="brand" to="/" aria-label="Uday 首页">
        <i aria-hidden="true">U</i>
        <span>
          <strong>Uday</strong>
          <small>Plan Your Day. Grow Your Way.</small>
        </span>
      </router-link>

      <div class="app-actions">
        <button
          class="theme-toggle"
          type="button"
          :aria-label="isDark ? '切换到白天模式' : '切换到夜间模式'"
          :aria-pressed="isDark"
          @click="toggleTheme"
        >
          <svg v-if="!isDark" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 15.5A8 8 0 0 1 8.5 4 8 8 0 1 0 20 15.5Z" />
          </svg>
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-brand-header {
  position: sticky;
  z-index: 90;
  top: 0;
  padding-top: env(safe-area-inset-top, 0);
  border: 0;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.96),
    inset 0 -1px 0 rgba(255,255,255,.5),
    0 1px 2px rgba(25,31,58,.05),
    0 14px 26px -20px rgba(25,31,58,.45);
}

:global(html[data-theme="dark"]) .app-brand-header {
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.2),
    inset 0 -1px 0 rgba(255,255,255,.08),
    0 1px 2px rgba(0,0,0,.4),
    0 16px 30px -20px rgba(0,0,0,.8);
}

/* 底边的折射高光，让玻璃与内容有一条水光分界 */
.app-brand-header::after {
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    rgba(255,255,255,0) 0%,
    rgba(255,255,255,.85) 22%,
    rgba(255,255,255,.85) 78%,
    rgba(255,255,255,0) 100%
  );
  content: "";
}

:global(html[data-theme="dark"]) .app-brand-header::after {
  background: linear-gradient(
    90deg,
    rgba(255,255,255,0) 0%,
    rgba(255,255,255,.24) 22%,
    rgba(255,255,255,.24) 78%,
    rgba(255,255,255,0) 100%
  );
}

.app-brand-inner {
  display: flex;
  width: min(100%, 480px);
  min-height: 72px;
  margin: 0 auto;
  padding: 10px 18px;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.brand {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.brand > i {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  place-items: center;
  color: #fff;
  border-radius: 14px;
  background: var(--accent-gradient);
  box-shadow: 0 12px 22px -10px rgba(255,122,69,.75), inset 0 1px 0 rgba(255,255,255,.4);
  font-size: 22px;
  font-style: normal;
  font-weight: 850;
  letter-spacing: -.06em;
}

.brand > span {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.brand strong {
  color: var(--ink);
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -.035em;
}

.brand small {
  overflow: hidden;
  color: var(--muted);
  font-size: 8px;
  letter-spacing: .025em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
}

.theme-toggle {
  display: grid;
  width: 38px;
  height: 38px;
  padding: 0;
  place-items: center;
  color: var(--ink);
  border: 0;
  border-radius: 50%;
  background: color-mix(in srgb, var(--paper) 62%, transparent);
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,.7),
    inset 0 1px 0 rgba(255,255,255,.95),
    var(--elev-sm);
  backdrop-filter: blur(10px) saturate(160%);
}

:global(html[data-theme="dark"]) .theme-toggle {
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,.16),
    inset 0 1px 0 rgba(255,255,255,.24),
    var(--elev-sm);
}

.theme-toggle svg {
  width: 19px;
  height: 19px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

@media (max-width: 360px) {
  .brand small { max-width: 138px; }
}
</style>
