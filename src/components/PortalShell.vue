<script setup>
import { brand } from '../config/site'
import ThemeToggle from './ThemeToggle.vue'
import NotificationCenter from './NotificationCenter.vue'
import {
  Gift,
  ClipboardList,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Medal,
  MoreHorizontal,
  Search,
  MessageSquareText,
  Trophy,
  UserRound,
  Wallet,
} from '@lucide/vue'
import { computed, inject, ref, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDismissibleLayer } from '../composables/useDismissibleLayer'
import { useFittingNavigation } from '../composables/useFittingNavigation'
import { authState, logout } from '../services/authApi'
import { commandShortcutLabel, openCommandPalette } from '../services/commandPalette'

const props = defineProps({
  // Kept for compatibility; page headings no longer show decorative English labels.
  eyebrow: { type: String, default: '' },
  title: { type: String, required: true },
  description: { type: String, default: '' },
})

// Inside AdminLayout the sidebar and top bar persist across admin routes;
// this component then only renders the page heading and content.
const adminLayout = inject('adminLayout', null)
watchEffect(() => {
  if (adminLayout) adminLayout.title = props.title
})

const router = useRouter()
const route = useRoute()
const roleLabels = {
  TEACHER: '教师 · 系统管理员',
  CORE_STUDENT: '核心学生 · 系统管理员',
  MEMBER: '正式成员',
  VISITOR: '报名访客',
}
const accountLabel = computed(() => roleLabels[authState.account?.role] || authState.account?.role)
const accountName = computed(() => authState.account?.displayName || authState.account?.username || '')
const isMember = computed(() => Boolean(authState.account && authState.account.role !== 'VISITOR'))
const navigation = computed(() => {
  const items = isMember.value
    ? [
        { to: '/profile', label: '个人主页', icon: UserRound },
        { to: '/tasks', label: '任务', icon: ListChecks },
        { to: '/bounties', label: '悬赏', icon: Gift },
        { to: '/projects', label: '项目', icon: FolderKanban },
      ]
    : []
  if (authState.account?.role === 'VISITOR') items.push({ to: '/application', label: '我的报名', icon: ClipboardList })
  items.push({ to: '/discussions', label: '讨论', icon: MessageSquareText })
  if (isMember.value)
    items.push(
      { to: '/points', label: '积分榜', icon: Trophy },
      { to: '/fund', label: '实验室基金', icon: Wallet },
      { to: '/competitions', label: '比赛管理', icon: Medal },
    )
  if (authState.account?.systemAdmin) items.push({ to: '/admin', label: '后台管理', icon: LayoutDashboard })
  return items
})
const navContainer = ref(null)
const navMeasurement = ref(null)
const { visibleCount } = useFittingNavigation(
  navContainer,
  navMeasurement,
  computed(() => navigation.value.length),
)
const visibleLinks = computed(() => navigation.value.slice(0, visibleCount.value))
const overflowLinks = computed(() => navigation.value.slice(visibleCount.value))
const moreSectionActive = computed(() => overflowLinks.value.some((item) => route.path.startsWith(item.to)))
const moreMenu = ref(null)

function closeMoreMenu() {
  if (moreMenu.value) moreMenu.value.open = false
}

useDismissibleLayer(moreMenu, {
  isOpen: () => Boolean(moreMenu.value?.open),
  close: closeMoreMenu,
  focusTarget: () => moreMenu.value?.querySelector('summary'),
})

watch(
  () => route.fullPath,
  () => {
    closeMoreMenu()
  },
)

async function signOut() {
  await logout()
  router.push('/')
}
</script>

<template>
  <main v-if="adminLayout" class="portal-main">
    <header class="portal-heading" :class="{ 'has-actions': $slots.actions }">
      <h1>{{ title }}</h1>
      <span v-if="description">{{ description }}</span>
      <div v-if="$slots.actions" class="portal-heading-actions"><slot name="actions" /></div>
    </header>
    <slot />
  </main>
  <div v-else class="portal-page">
    <header class="portal-topbar">
      <RouterLink class="portal-brand" to="/" :aria-label="`返回 ${brand.name} 公开首页`">
        <img :src="brand.logo" :alt="brand.name" width="900" height="300" />
      </RouterLink>
      <nav ref="navContainer" class="portal-navigation" aria-label="成员系统导航">
        <RouterLink v-for="item in visibleLinks" :key="item.to" :to="item.to">
          <component :is="item.icon" :size="17" aria-hidden="true" />{{ item.label }}
        </RouterLink>
        <details
          v-if="overflowLinks.length"
          ref="moreMenu"
          class="portal-admin-menu portal-more-menu"
          @click="(event) => event.target.closest('a') && closeMoreMenu()"
        >
          <summary :class="{ active: moreSectionActive }"><MoreHorizontal :size="17" aria-hidden="true" />更多</summary>
          <div>
            <RouterLink v-for="item in overflowLinks" :key="item.to" :to="item.to">
              <component :is="item.icon" :size="17" aria-hidden="true" />{{ item.label }}
            </RouterLink>
          </div>
        </details>
        <div class="nav-measurement" inert aria-hidden="true">
          <div ref="navMeasurement" class="portal-nav-measure">
            <span v-for="item in navigation" :key="item.to"
              ><component :is="item.icon" :size="17" />{{ item.label }}</span
            >
            <span><MoreHorizontal :size="17" />更多</span>
          </div>
        </div>
      </nav>
      <div class="portal-account">
        <button
          v-if="authState.account"
          class="portal-search-trigger"
          type="button"
          aria-label="搜索与跳转"
          aria-keyshortcuts="Meta+K Control+K"
          @click="openCommandPalette"
        >
          <Search :size="16" aria-hidden="true" /><span>搜索</span><kbd>{{ commandShortcutLabel }}</kbd>
        </button>
        <ThemeToggle /><NotificationCenter v-if="authState.account" />
        <div v-if="!authState.account" class="portal-guest-actions">
          <RouterLink to="/login">登录</RouterLink><RouterLink class="register" to="/register">注册</RouterLink>
        </div>
        <RouterLink
          v-if="authState.account && authState.account.role !== 'VISITOR'"
          class="portal-account-avatar"
          to="/profile"
          aria-label="打开个人主页"
        >
          <img v-if="authState.account?.avatarUrl" :src="authState.account.avatarUrl" alt="" />
          <b v-else>{{ accountName.slice(0, 1) }}</b>
        </RouterLink>
        <span v-if="authState.account"
          ><strong>{{ accountName }}</strong
          ><small>{{ accountLabel }}</small></span
        >
        <button v-if="authState.account" type="button" aria-label="退出登录" @click="signOut">
          <LogOut :size="18" aria-hidden="true" />
        </button>
      </div>
    </header>

    <main class="portal-main">
      <header class="portal-heading" :class="{ 'has-actions': $slots.actions }">
        <h1>{{ title }}</h1>
        <span v-if="description">{{ description }}</span>
        <div v-if="$slots.actions" class="portal-heading-actions"><slot name="actions" /></div>
      </header>
      <slot />
    </main>
  </div>
</template>
